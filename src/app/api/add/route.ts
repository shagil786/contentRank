import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Legacy free-add endpoint retained as an explicit tombstone so old clients
// cannot bypass the paid checkout flow.
export async function POST() {
  return NextResponse.json({ ok: false, reason: "payment_required" }, { status: 410 });
}
