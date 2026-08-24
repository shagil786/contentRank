import { NextRequest } from "next/server";
import { prepareApiContext, jsonResponse, withIdempotency } from "@/server/infrastructure/api-helpers";
import { createPaidContentCheckout } from "@/server/application/create-paid-content-checkout";
import { paidContentCheckoutSchema } from "@/server/schemas/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const prepared = await prepareApiContext(req, "submit");
  if ("error" in prepared) return prepared.error;
  const { ctx } = prepared;
  const body = await req.json().catch(() => null);
  const parsed = paidContentCheckoutSchema.safeParse(body);
  if (!parsed.success) return jsonResponse({ ok: false, reason: "validation", errors: parsed.error.flatten() }, 400, { requestId: ctx.requestId, sessionId: ctx.session });

  const idempotencyKey = req.headers.get("idempotency-key")?.trim();
  const result = await withIdempotency(req, () => createPaidContentCheckout({ ...parsed.data, idempotencyKey }, ctx));
  if ("error" in result) return result.error;
  return jsonResponse(result.value, result.value.ok ? 200 : 400, { requestId: ctx.requestId, sessionId: ctx.session });
}
