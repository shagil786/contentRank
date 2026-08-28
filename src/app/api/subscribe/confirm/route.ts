import { NextRequest } from "next/server";
import { prepareApiContext, jsonResponse } from "@/server/infrastructure/api-helpers";
import { container } from "@/server/application/container";
import { hashSubscriptionToken } from "@/server/infrastructure/subscription-tokens";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const prepared = await prepareApiContext(req, "subscribe");
  if ("error" in prepared) return prepared.error;
  const { ctx } = prepared;
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return jsonResponse({ ok: false, reason: "invalid_token" }, 400, { requestId: ctx.requestId, sessionId: ctx.session });
  const subscription = await container.repos.subscription.confirmByTokenHash(hashSubscriptionToken(token));
  if (!subscription) return jsonResponse({ ok: false, reason: "token_expired_or_invalid" }, 400, { requestId: ctx.requestId, sessionId: ctx.session });
  return jsonResponse({ ok: true, confirmed: true, subscriptionId: subscription.id }, 200, { requestId: ctx.requestId, sessionId: ctx.session });
}
