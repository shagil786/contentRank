import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Ownership claims are not part of the anonymous paid-ranking product. Keep a
// tombstone response so old clients cannot create unreviewed moderation data.
export async function POST() {
  return NextResponse.json(
    { ok: false, reason: "endpoint_retired" },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}
