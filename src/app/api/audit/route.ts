import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Audit logs contain internal operational data and are not a public API.
export async function GET() {
  return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
}
