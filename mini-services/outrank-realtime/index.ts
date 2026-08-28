import { createServer, IncomingMessage, ServerResponse } from "http";
import { Server } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import type {
  Entity,
  Category,
  ActivityEvent,
  LeaderState,
  BoostRequest,
  AddEntityRequest,
} from "../../src/lib/outrank/types";
import { SEED_LOCATIONS } from "./seed";

const API_BASE_URL = (process.env.API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const APP_ORIGIN = (() => {
  try { return new URL(process.env.APP_URL || "http://localhost:3000").origin; }
  catch { return "http://localhost:3000"; }
})();
const SOCKET_ORIGINS = new Set([
  APP_ORIGIN,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3100",
  "http://127.0.0.1:3100",
]);

// ---------------- HYDRATION FROM POSTGRESQL ----------------
// PostgreSQL is the source of truth. On boot we hydrate the in-memory cache
// (Redis-equivalent) from PostgreSQL via the Next.js app's leaderboard API.
// We RETRY until PostgreSQL is available — we never fall back to a static seed,
// because that would show fake data instead of real backend data.
async function hydrateFromPostgres(): Promise<Entity[]> {
  const MAX_RETRIES = 30;
  const RETRY_DELAY = 1000;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(`${API_BASE_URL}/api/leaderboard`, {
        signal: ctrl.signal,
        cache: "no-store",
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`bad_status_${res.status}`);
      const data = (await res.json()) as LeaderState;
      if (Array.isArray(data.entities)) {
        console.log(`[hydrate] loaded ${data.entities.length} entities from PostgreSQL (attempt ${attempt})`);
        return data.entities;
      }
      throw new Error("invalid_payload");
    } catch (e) {
      console.log(`[hydrate] attempt ${attempt}/${MAX_RETRIES} failed: ${(e as Error).message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY));
      }
    }
  }
  console.error("[hydrate] FAILED after all retries — starting with empty state");
  return [];
}

// ---------------- STATE ----------------
let entities: Entity[] = []; // hydrated below
const activity: ActivityEvent[] = [];
let presence = 0;
let fighting = 0;
let totalBoosts = 0;

// Ephemeral display metadata only. Reconnects must not create durable database
// sessions; paid writes go through the Next.js checkout API and its cookie.
const ledgers = new Map<string, { handle: string; location: string }>();
const INSTANCE_ID = process.env.INSTANCE_ID || `realtime-${Math.random().toString(36).slice(2, 10)}`;
let redisAdapterEnabled = false;

const HANDLES = ["anon", "ghost", "vega", "neon", "k9", "ruby", "echo", "halo", "zed", "milo", "noir", "pixel", "rune", "volt", "wren", "cyan", "onyx", "cobalt", "fenn", "jett"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function rankedForCategory(cat: Category): Entity[] {
  if (cat === "global") {
    return [...entities].sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
  }
  return [...entities]
    .filter((e) => e.category === cat)
    .sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
}

// ---------------- PREVIEW (rank projection without committing) ----------------
// Returns the projected rank after a boost, PLUS how much more hype is needed
// to reach the next rank up (so the UI can show "NEEDS +X TO REACH #N").
function previewBoost(entityId: string, amount: number): { newRank: number; prevRank: number; newScore: number; needed: number; nextRank: number; gapToNext: number } | null {
  const e = entities.find((x) => x.id === entityId || x.slug === entityId);
  if (!e) return null;
  const projectedScore = e.score + Math.max(100, Math.floor(amount)) / 100;
  // count how many entities (global) would be strictly above projectedScore, or equal-but-newer
  let above = 0;
  for (const o of entities) {
    if (o.id === e.id) continue;
    if (o.score > projectedScore) above++;
    else if (o.score === projectedScore && o.createdAt < e.createdAt) above++;
  }
  const newRank = above + 1;

  // find the entity directly above (the one at rank newRank - 1 after boost)
  // and compute how much more hype is needed to overtake it
  const sorted = entities
    .map((entity) => entity.id === e.id ? { ...entity, score: projectedScore } : entity)
    .sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
  const myProjectedIndex = sorted.findIndex((x) => x.id === e.id);
  let nextRank = newRank;
  let gapToNext = 0;
  if (myProjectedIndex > 0) {
    const aboveEntity = sorted[myProjectedIndex - 1];
    // need to beat aboveEntity.score (or equal + older, but we can't change createdAt)
    gapToNext = Math.max(0, Math.ceil((aboveEntity.score - projectedScore + 0.01) * 100));
    nextRank = aboveEntity.rank;
  }
  return { newRank, prevRank: e.rank, newScore: projectedScore, needed: gapToNext, nextRank, gapToNext };
}

// ---------------- STATE SNAPSHOT ----------------
function snapshot(limit = 48, cursor = 0): LeaderState {
  const ranked = [...entities].sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
  const safeLimit = Math.min(48, Math.max(1, limit));
  const safeCursor = Math.max(0, cursor);
  return {
    entities: ranked.slice(safeCursor, safeCursor + safeLimit).map((e) => ({ ...e, history: e.history.slice(-24) })),
    activity: activity.slice(0, 60),
    presence,
    totalBoosts,
    ts: Date.now(),
    nextCursor: safeCursor + safeLimit < ranked.length ? String(safeCursor + safeLimit) : undefined,
    total: ranked.length,
  };
}

// ---------------- REST API (separate port, server-to-server; not via caddy) ----------------
// socket.io with path "/" claims all requests on its port, so REST lives on 3004.
const httpServer = createServer((_req: IncomingMessage, res: ServerResponse) => {
  // socket.io handles its own paths; anything else 404s
  res.writeHead(404);
  res.end(JSON.stringify({ error: "not_found_ws" }));
});

const restServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.method === "OPTIONS") {
    res.writeHead(405);
    res.end();
    return;
  }
  if (req.url?.startsWith("/state") && req.method === "GET") {
    const u = new URL(req.url, "http://x");
    const limit = Number(u.searchParams.get("limit")) || 48;
    const cursor = Number(u.searchParams.get("cursor")) || 0;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(snapshot(limit, cursor)));
    return;
  }
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "outrank-realtime", instanceId: INSTANCE_ID, redisAdapter: redisAdapterEnabled, entities: entities.length }));
    return;
  }
  if (req.url === "/leaderboard" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(snapshot()));
    return;
  }
  if (req.url?.startsWith("/preview") && req.method === "GET") {
    const u = new URL(req.url, "http://x");
    const id = u.searchParams.get("id") || "";
    const amt = parseInt(u.searchParams.get("amount") || "1", 10);
    const r = previewBoost(id, amt);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(r));
    return;
  }
  if (req.url === "/add" && req.method === "POST") {
    res.writeHead(410, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, reason: "payment_required" }));
    return;
  }
  res.writeHead(404);
  res.end(JSON.stringify({ error: "not_found" }));
});

const io = new Server(httpServer, {
  path: "/",
  cors: {
    origin(origin, callback) {
      callback(null, !origin || SOCKET_ORIGINS.has(origin));
    },
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

function applyEntityUpdate(update: { id: string; title?: string; blurb?: string; description?: string; platform?: string; url?: string }) {
  const current = entities.find((entity) => entity.id === update.id);
  if (!current) return;
  const entity = {
    ...current,
    name: update.title ? update.title.toUpperCase() : current.name,
    sub: update.blurb || update.description || update.platform || current.sub,
    blurb: update.description || update.blurb || current.blurb,
    link: update.url || current.link,
  };
  entities = entities.map((item) => item.id === update.id ? entity : item);
  io.emit("entity.updated", { type: "entity.updated", entity: { id: entity.id, name: entity.name, sub: entity.sub, blurb: entity.blurb, link: entity.link } });
}

const redisAdapterReady = (async () => {
  try {
    const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    const pubClient = createClient({ url });
    const subClient = pubClient.duplicate();
    pubClient.on("error", () => {});
    subClient.on("error", () => {});
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    await subClient.subscribe("outrank:entity-updated", (message) => {
      try { applyEntityUpdate(JSON.parse(message) as { id: string; title?: string; blurb?: string; description?: string; platform?: string; url?: string }); } catch { /* ignore malformed internal events */ }
    });
    await subClient.subscribe("outrank:leaderboard-updated", async () => {
      try {
        entities = await hydrateFromPostgres();
        io.emit("snapshot", { type: "snapshot", state: snapshot() } as const);
        io.emit("leaderboard.invalidate", { type: "leaderboard.invalidate", ts: Date.now() });
      } catch {
        // The browser also refetches periodically, so a transient refresh
        // failure cannot make Redis authoritative.
      }
    });
    redisAdapterEnabled = true;
    console.log("[realtime] Redis Socket.IO adapter enabled");
  } catch {
    console.warn("[realtime] Redis unavailable; using local Socket.IO adapter");
  }
})();

io.on("connection", (socket) => {
  presence += 1;
  const handle = pick(HANDLES) + Math.floor(Math.random() * 90 + 10);
  const location = pick(SEED_LOCATIONS);
  ledgers.set(socket.id, { handle, location });

  socket.emit("snapshot", { type: "snapshot", state: snapshot() } as const);
  io.emit("presence.updated", { type: "presence.updated", count: presence, fighting } as const);

  socket.on("state.sync", async (req: { since?: number }, ackFn?: (r: any) => void) => {
    const refreshed = await hydrateFromPostgres();
    if (refreshed.length > 0) {
      entities = refreshed;
    }
    const since = Number.isFinite(req?.since) ? Math.max(0, Number(req.since)) : 0;
    const missedActivity = activity.filter((event) => event.ts > since).slice(0, 60);
    ackFn?.({ type: "state.sync", state: snapshot(), missedActivity });
  });

  socket.on("boost", (req: BoostRequest) => {
    socket.emit("boost.ack", {
      type: "boost.ack",
      ok: false,
      reason: "paid_bid_required",
      entityId: req.entityId,
      newRank: 0,
      prevRank: 0,
      newScore: 0,
      remaining: 0,
    } as const);
  });

  socket.on("preview", (req: { entityId: string; amount: number }, ackFn?: (r: any) => void) => {
    const r = previewBoost(req.entityId, req.amount);
    if (ackFn) ackFn(r);
  });

  socket.on("add", (_req: AddEntityRequest, ackFn?: (r: any) => void) => {
    if (ackFn) ackFn({ ok: false, reason: "payment_required" });
  });

  socket.on("set_handle", (h: { handle: string; location: string }) => {
    const led = ledgers.get(socket.id);
    if (led) {
      if (h.handle) led.handle = h.handle.slice(0, 24);
      if (h.location) led.location = h.location.toUpperCase().slice(0, 24);
    }
  });

  socket.on("disconnect", () => {
    presence = Math.max(0, presence - 1);
    ledgers.delete(socket.id);
    io.emit("presence.updated", { type: "presence.updated", count: presence, fighting } as const);
  });
});

const WSPORT = 3003;
const RESTPORT = 3004;

// Hydrate from PostgreSQL (source of truth) on boot. No simulator or local
// score mutation is allowed in production: only settled payment data ranks.
hydrateFromPostgres().then((hydrated) => {
  entities.push(...hydrated);
  console.log(`[boot] ${entities.length} entities hydrated from canonical API`);
}).catch((e) => {
  console.error("[boot] hydration failed, starting with empty state:", e);
}).finally(async () => {
  await redisAdapterReady;
  httpServer.listen(WSPORT, () => {
    console.log(`OUTRANK realtime socket.io on port ${WSPORT}`);
  });
  restServer.listen(RESTPORT, () => {
    console.log(`OUTRANK REST api on port ${RESTPORT}`);
  });
});

process.on("SIGTERM", () => {
  httpServer.close(() => process.exit(0));
  restServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  httpServer.close(() => process.exit(0));
  restServer.close(() => process.exit(0));
});
