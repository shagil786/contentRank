// All-time site visit counter — aggregate and non-personal by design.
//
// Storage: a single `SiteStat` row (`site:visits:alltime`) in PostgreSQL holds
// the monotonic total. No IP, session, cookie, or fingerprint is ever stored.
//
// Dedupe: each unique visitor counts at most once per 24h. The dedupe key is
// `outrank:visit:<sha256(ip + daily salt)>` with a 24h TTL in Redis — it is
// transient, anonymous, and cannot be reversed to the visitor's address.
// When Redis is unavailable the visit still counts (fail-open, like the rest
// of the rate-limiting infrastructure) because counting is best-effort.
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { container } from "@/server/application/container";
import { prepareApiContext } from "@/server/infrastructure/api-helpers";
import { getRedis } from "@/server/infrastructure/redis";

export const dynamic = "force-dynamic";

const STAT_KEY = "site:visits:alltime";
const DEDUPE_TTL_SECONDS = 24 * 60 * 60;

function dailySalt(): string {
  return new Date().toISOString().slice(0, 10); // UTC day — rotates at midnight
}

function dedupeKey(ip: string | undefined): string | null {
  if (!ip) return null;
  const hash = createHash("sha256").update(`${ip}:${dailySalt()}`).digest("hex");
  return `outrank:visit:${hash}`;
}

async function currentTotal(): Promise<string> {
  const total = await container.repos.siteStat.get(STAT_KEY);
  return total.toString();
}

export async function GET() {
  try {
    return NextResponse.json(
      { ok: true, totalVisits: await currentTotal() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    // Counting must never break the page: report without a total on failure.
    return NextResponse.json(
      { ok: false, reason: "stats_unavailable" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(req: NextRequest) {
  // Read-mostly endpoint; still runs through the shared context for request
  // IDs and logging. No session is created for this call.
  const prepared = await prepareApiContext(req, "general", { createSessionForWrite: false });
  if ("error" in prepared) return prepared.error;

  try {
    const ip = prepared.ctx.ip;
    const key = dedupeKey(ip);

    if (key) {
      const redis = await getRedis();
      if (redis?.isReady) {
        const isNew = await redis.set(key, "1", { EX: DEDUPE_TTL_SECONDS, NX: true });
        // NX returns null when the visitor already counted today — skip the
        // increment but still return the current total.
        if (isNew === null) {
          return NextResponse.json(
            { ok: true, counted: false, totalVisits: await currentTotal() },
            { headers: { "Cache-Control": "no-store" } }
          );
        }
      }
      // Redis down → fail open and count the visit.
    }

    const total = await container.repos.siteStat.increment(STAT_KEY, 1);
    return NextResponse.json(
      { ok: true, counted: true, totalVisits: total.toString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, reason: "stats_unavailable" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
