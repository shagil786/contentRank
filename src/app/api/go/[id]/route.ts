// GET /api/go/[id] — outbound click-through for a content item.
//
// The VISIT buttons point here instead of the external URL so we can count
// real click-throughs from OUTRANK. Privacy: the dedupe key is a hashed
// (ip + day + entity) Redis entry with a 24h TTL — anonymous and transient,
// never persisted. Redis down → the click still counts (fail-open).
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { container } from "@/server/application/container";
import { getRedis } from "@/server/infrastructure/redis";
import { captureServerEvent } from "@/server/infrastructure/analytics";
import { isSameOriginNavigation } from "@/server/infrastructure/request-origin";

export const dynamic = "force-dynamic";

const DEDUPE_TTL_SECONDS = 24 * 60 * 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{20,32}$/i.test(id)) {
    return NextResponse.json({ ok: false, reason: "bad_id" }, { status: 400 });
  }

  const content = await db.content.findUnique({ where: { id }, select: { url: true, status: true } });
  if (!content || content.status !== "live" || !content.url) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
    const day = new Date().toISOString().slice(0, 10);
    const key = ip
      ? `outrank:click:${createHash("sha256").update(`${ip}:${day}:${id}`).digest("hex").slice(0, 24)}`
      : null;

    // Count only navigations that actually started on one of our pages — bots,
    // scrapers, and direct hits to the endpoint still get redirected, just not counted.
    let counted = isSameOriginNavigation(req);
    if (counted && key) {
      const redis = await getRedis();
      if (redis?.isReady) {
        const isNew = await redis.set(key, "1", { EX: DEDUPE_TTL_SECONDS, NX: true });
        counted = isNew !== null; // null = already clicked today from this address
      }
    }

    if (counted) {
      await db.$executeRaw`UPDATE "Content" SET "outboundClicks" = "outboundClicks" + 1 WHERE "id" = ${id}`;
      await captureServerEvent({
        distinctId: "system",
        event: "outbound_click",
        properties: { content_id: id, url: content.url },
      }).catch(() => undefined);
    }

    return NextResponse.redirect(content.url, { status: 302 });
  } catch {
    // Counting must never block the redirect out.
    return NextResponse.redirect(content.url, { status: 302 });
  }
}
