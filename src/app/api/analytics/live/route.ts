// Retired: this in-memory counter could be inflated by any caller and reset on
// every deploy. Product analytics now comes from the consent-gated PostHog
// integration, while the UI's live presence comes from Socket.IO.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: false, reason: "endpoint_retired" }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ ok: false, reason: "endpoint_retired" }, { status: 410 });
}
