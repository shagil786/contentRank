// POST /api/view/[id] — records that a real onsite visitor opened this item's
// detail sheet. Fired as a fire-and-forget beacon from EntityDetail's mount.
//
// Privacy: the dedupe key is a hashed (ip + day + entity) Redis entry with a
// 24h TTL — anonymous and transient, never persisted. Same-origined like the
// click counter so bots and direct hits don't count. Counting failures never
// affect the response.
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRedis } from "@/server/infrastructure/redis";
import { isSameOriginNavigation } from "@/server/infrastructure/request-origin";

export const dynamic = "force-dynamic";

const DEDUPE_TTL_SECONDS = 24 * 60 * 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{20,32}$/i.test(id) || !isSameOriginNavigation(req)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const exists = await db.content.findUnique({ where: { id }, select: { status: true } });
    if (!exists || exists.status !== "live") {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
    const day = new Date().toISOString().slice(0, 10);
    const key = ip
      ? `outrank:view:${createHash("sha256").update(`${ip}:${day}:${id}`).digest("hex").slice(0, 24)}`
      : null;

    let counted = true;
    if (key) {
      const redis = await getRedis();
      if (redis?.isReady) {
        const isNew = await redis.set(key, "1", { EX: DEDUPE_TTL_SECONDS, NX: true });
        counted = isNew !== null; // null = already viewed today from this address
      }
    }

    if (counted) {
      await db.$executeRaw`UPDATE "Content" SET "views" = "views" + 1 WHERE "id" = ${id}`;
    }

    return NextResponse.json({ ok: true, counted });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
