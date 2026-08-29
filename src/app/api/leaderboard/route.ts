// GET /api/leaderboard — canonical organic leaderboard from PostgreSQL (source of truth).
// An empty database is a valid state and must never be replaced with stale realtime data.
import { NextRequest, NextResponse } from "next/server";
import { prepareApiContext } from "@/server/infrastructure/api-helpers";
import { fetchLeaderboard, type LeaderboardTimeframe } from "@/server/application/fetch-leaderboard";
import type { LeaderState, Entity, Category } from "@/lib/outrank/types";
import { captureServerError } from "@/server/infrastructure/error-tracker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FALLBACK: LeaderState = {
  entities: [], activity: [], presence: 0, totalBoosts: 0, ts: Date.now(),
};

function cursorParam(value: string | null): string | undefined {
  return value?.trim() || undefined;
}

function limitParam(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 48) : 48;
}

// map a Content+ranking row from PostgreSQL into the Entity shape the frontend expects
function toEntity(entry: {
  content: any; backedCents: number; bidCount: number; rank: number; score: number; momentum: number; prevRank: number; peakRank: number; history: any[];
}): Entity {
  const c = entry.content;
  return {
    id: c.id,
    slug: c.id,
    name: c.title.toUpperCase(),
    category: c.category,
    kind: c.kind,
    sub: c.blurb || c.description || c.platform,
    blurb: c.description || c.blurb || "",
    link: c.url || undefined,
    image: c.imageUrl || undefined,
    score: entry.score,
    supporters: entry.bidCount,
    outboundClicks: Number((entry.content as { outboundClicks?: number }).outboundClicks ?? 0),
    prevRank: entry.prevRank,
    rank: entry.rank,
    peakRank: entry.peakRank,
    momentum: entry.momentum,
    history: entry.history.length ? entry.history : [{ t: Date.now(), rank: entry.rank, score: entry.score }],
    createdAt: new Date(c.createdAt).getTime(),
    poster: { hue: (c.title.charCodeAt(0) * 7) % 360, accent: "#ff3b1f", tag: String(c.kind).toUpperCase().slice(0, 4) },
  };
}

export async function GET(req: NextRequest) {
  const prepared = await prepareApiContext(req, "general");
  if ("error" in prepared) return prepared.error;
  const { ctx } = prepared;

  const category = (req.nextUrl.searchParams.get("category") || "global") as Category;
  const limit = limitParam(req.nextUrl.searchParams.get("limit"));
  const cursor = cursorParam(req.nextUrl.searchParams.get("cursor"));
  const timeframeParam = req.nextUrl.searchParams.get("timeframe");
  const timeframe: LeaderboardTimeframe = timeframeParam === "today" ? "today" : "alltime";

  try {
    const view = await fetchLeaderboard(category, { limit, cursor, timeframe });
    if (view.entries.length === 0) {
      return NextResponse.json(FALLBACK, { headers: { "Cache-Control": "no-store", "X-Request-Id": ctx.requestId } });
    }
    const entities = view.entries.map(toEntity);
    return NextResponse.json(
      { entities, activity: [], presence: 0, totalBoosts: view.totalBoosts, ts: Date.now(), nextCursor: view.nextCursor, total: view.total } as LeaderState,
      { headers: { "Cache-Control": "no-store", "X-Request-Id": ctx.requestId } }
    );
  } catch (e) {
    captureServerError("leaderboard.fetch_failed", e, { requestId: ctx.requestId, path: req.nextUrl.pathname });
    return NextResponse.json(FALLBACK, { headers: { "Cache-Control": "no-store", "X-Request-Id": ctx.requestId } });
  }
}
