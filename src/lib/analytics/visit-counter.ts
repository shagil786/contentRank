"use client";

// All-time visitor counter. One POST per browser session (sessionStorage
// guard), so refreshing or navigating never double-counts; a new tab or a
// returning visitor after 24h counts again (server-side dedupe is the
// authoritative one — this guard just saves request volume).
const FLAG = "outrank_visit_counted";

export interface VisitPayload {
  ok: boolean;
  counted?: boolean;
  totalVisits?: string;
}

export function reportVisit(): Promise<VisitPayload | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  try {
    if (sessionStorage.getItem(FLAG)) return Promise.resolve(null);
  } catch {
    // Private-mode browsers can block storage — still send the ping.
  }

  const send = fetch("/api/analytics/visits", {
    method: "POST",
    cache: "no-store",
  })
    .then((r) => (r.ok ? (r.json() as Promise<VisitPayload>) : null))
    .then((payload) => {
      try {
        sessionStorage.setItem(FLAG, "1");
      } catch { /* ignore */ }
      return payload;
    })
    .catch(() => null);

  return send;
}
