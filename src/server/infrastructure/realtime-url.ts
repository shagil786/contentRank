/**
 * Internal URL for the realtime service used by server-side route handlers.
 * The container deployment overrides this with http://realtime:3004 while
 * local development keeps the localhost default.
 */
export function realtimeUrl(path: string): string {
  const base = process.env.REALTIME_BASE_URL || "http://localhost:3004";
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}
