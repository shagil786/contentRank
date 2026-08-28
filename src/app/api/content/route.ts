import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Unpaid submissions are intentionally disabled. New content must enter via
// /api/content/checkout and is published only after a verified payment webhook.
export async function POST() {
  return NextResponse.json({ ok: false, reason: "payment_required" }, { status: 410 });
}
