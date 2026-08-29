// Whether a request looks like a navigation from one of our own pages.
//
// Used to gate engagement counters (outbound clicks, detail views) so bots,
// scrapers, and direct URL hits don't inflate them. Real browser navigations
// always send Sec-Fetch-Site; when it's absent (older browsers), fall back to
// comparing the Referer host against the request host.
import type { NextRequest } from "next/server";

export function isSameOriginNavigation(req: NextRequest): boolean {
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite) return secFetchSite === "same-origin" || secFetchSite === "same-site";

  const referer = req.headers.get("referer");
  if (!referer) return false;
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(referer).host === host;
  } catch {
    return false;
  }
}
