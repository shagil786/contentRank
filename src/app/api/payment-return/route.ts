import { NextRequest, NextResponse } from "next/server";

// Dodo appends payment metadata to return URLs. Redirect immediately to a
// clean app URL so payment IDs, email addresses, and provider status do not
// remain in browser history, bookmarks, referrer headers, or screenshots.
export function GET(req: NextRequest) {
  const publicOrigin = process.env.APP_URL || "https://content-rank.lol";
  const destination = new URL("/", publicOrigin);
  const bid = req.nextUrl.searchParams.get("bid");
  const entityId = req.nextUrl.searchParams.get("entityId");
  const amount = req.nextUrl.searchParams.get("amount");

  if (bid === "success" || bid === "cancel") destination.searchParams.set("bid", bid);
  if (entityId && /^[A-Za-z0-9_-]{8,100}$/.test(entityId)) destination.searchParams.set("entityId", entityId);
  if (amount && /^\d{1,12}$/.test(amount)) destination.searchParams.set("amount", amount);

  return NextResponse.redirect(destination, 303);
}
