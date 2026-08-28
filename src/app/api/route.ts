import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRedis } from "@/server/infrastructure/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();
  let database = false;
  let redis = false;

  try {
    await db.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }

  try {
    const client = await Promise.race([
      getRedis(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_500)),
    ]);
    redis = client ? await client.ping().then(() => true).catch(() => false) : false;
  } catch {
    redis = false;
  }

  const healthy = database;
  return NextResponse.json(
    { status: healthy ? (redis ? "ok" : "degraded") : "unhealthy", checks: { database, redis }, checkedAt },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
