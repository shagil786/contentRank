// FetchLeaderboardService — reads the organic ranking (source of truth = latest
// OrganicRanking snapshots in PostgreSQL). The realtime mini-service caches this
// in memory for speed; this service is the canonical read.

import { container } from "./container";
import type { Category, Content } from "../domain/types";

export interface LeaderboardEntry {
  content: Content;
  backedCents: number;
  bidCount: number;
  rank: number;
  score: number;
  momentum: number;
  prevRank: number;
  peakRank: number;
  history: { t: number; rank: number; score: number }[];
}

export interface LeaderboardView {
  entries: LeaderboardEntry[];
  category: Category;
  totalBoosts: number;
  presence: number;
  ts: number;
  nextCursor?: string;
  total: number;
}

export type LeaderboardTimeframe = "today" | "alltime";

type LeaderboardCursor = { score: number; createdAt: string; id: string };

function decodeCursor(value?: string): LeaderboardCursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as LeaderboardCursor;
    if (!Number.isFinite(parsed.score) || !parsed.createdAt || !parsed.id) return undefined;
    return parsed;
  } catch { return undefined; }
}

function encodeCursor(cursor: { score: number; createdAt: Date; id: string }): string {
  return Buffer.from(JSON.stringify({ score: cursor.score, createdAt: cursor.createdAt.toISOString(), id: cursor.id })).toString("base64url");
}

export async function fetchLeaderboard(category: Category = "global", options: { limit?: number; cursor?: string; timeframe?: LeaderboardTimeframe } = {}): Promise<LeaderboardView> {
  const { repos } = container;
  const limit = Math.min(48, Math.max(1, options.limit ?? 48));
  const timeframe = options.timeframe ?? "alltime";

  const cursor = decodeCursor(options.cursor);
  const page = await repos.ranking.rankedContentPage({ category, timeframe, limit, cursor: cursor ? { score: cursor.score, createdAt: new Date(cursor.createdAt), id: cursor.id } : undefined });


  // Paginate before loading per-entity history so large boards do not hydrate
  // history for rows that will never be sent to the client.
  const entries: LeaderboardEntry[] = [];
  for (let pageIndex = 0; pageIndex < page.rows.length; pageIndex++) {
    const r = page.rows[pageIndex];
    const rank = r.rank;
    const history = await repos.ranking.organicHistory(r.content.id, 24, category);
    const peakRank = history.length ? Math.min(...history.map(h => h.rank)) : rank;
    const prevRank = history.length >= 2 ? history[history.length - 2].rank : rank;
    entries.push({
      content: r.content,
      backedCents: r.backedCents,
      bidCount: r.bidCount,
      rank,
      score: r.score,
      momentum: r.momentum,
      prevRank,
      peakRank: peakRank === Infinity ? rank : peakRank,
      history: history.map(h => ({ t: h.snapshotAt.getTime(), rank: h.rank, score: h.score })),
    });
  }

  return {
    entries,
    category,
    totalBoosts: 0, // filled by realtime cache
    presence: 0,    // filled by realtime cache
    ts: Date.now(),
    nextCursor: page.nextCursor ? encodeCursor(page.nextCursor) : undefined,
    total: page.total,
  };
}

// Single-entity lookup for social share cards (og tags / og-image). Returns
// rank + score when the item sits on the first board page, content-only
// otherwise; null when the id is unknown or not live.
export async function fetchEntityCard(id: string): Promise<{ content: Content; rank: number | null; score: number | null } | null> {
  try {
    const view = await fetchLeaderboard("global", { limit: 48 });
    const hit = view.entries.find((en) => en.content.id === id);
    if (hit) return { content: hit.content, rank: hit.rank, score: hit.score };
  } catch {
    // ranking read failed — still worth a content-only card below
  }
  const content = await container.repos.content.findById(id);
  if (!content || content.status !== "live") return null;
  return { content, rank: null, score: null };
}

// Full state for the realtime engine to hydrate from on boot.
export async function fetchFullState() {
  const { repos } = container;
  const contents = await repos.content.listAll("live");
  const allSnapshots: { contentId: string; score: number; momentum: number; category: string }[] = [];
  for (const c of contents) {
    const snaps = await repos.ranking.organicHistory(c.id, 24);
    const latest = snaps[snaps.length - 1];
    if (latest) allSnapshots.push({ contentId: c.id, score: latest.score, momentum: latest.momentum, category: c.category });
  }
  return { contents, snapshots: allSnapshots };
}
