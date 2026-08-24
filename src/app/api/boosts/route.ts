// POST /api/boosts — apply an organic hype boost.
// Enforces daily allocation, writes to PostgreSQL + audit.
import { jsonResponse } from "@/server/infrastructure/api-helpers";

export const dynamic = "force-dynamic";

export async function POST() {
  return jsonResponse({ ok: false, reason: "paid_bid_required" }, 410);
}
