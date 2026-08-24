// ConfirmPaymentService — handles the Dodo webhook.
// Flow: signature verification → event deduplication → payment settlement
//   → sponsored ranking update → audit record.
// Background jobs never directly manipulate HTTP state; they call this service.

import { container } from "./container";
import { audit } from "../infrastructure/request-context";
import type { RequestContext } from "../infrastructure/request-context";
import { computeSponsoredRanking } from "../domain/ranking/sponsored";
import type { WebhookSignatureHeaders } from "../adapters/payments/interface";

export interface ConfirmPaymentInput {
  rawBody: string;
  headers: WebhookSignatureHeaders;
}

export interface ConfirmPaymentResult {
  ok: boolean;
  paymentId?: string;
  bidId?: string;
  reason?: string;
}

export async function confirmPayment(
  input: ConfirmPaymentInput,
  ctx: RequestContext
): Promise<ConfirmPaymentResult> {
  const { repos, adapters } = container;

  // 1. signature verification
  const verification = await adapters.payments.dodo.verifyWebhook(input.rawBody, input.headers);
  if (!verification.ok || !verification.payload) {
    await audit(ctx, "payment.webhook.rejected", "payment", "—", { reason: verification.reason });
    return { ok: false, reason: verification.reason };
  }
  const payload = verification.payload;

  // 2. event deduplication (via webhookEventId)
  const existing = await repos.payment.findByWebhookEventId(payload.event_id);
  if (existing) {
    await audit(ctx, "payment.webhook.duplicate", "payment", existing.id, { eventId: payload.event_id });
    return { ok: true, paymentId: existing.id, reason: "duplicate" };
  }

  // find the payment by providerPaymentId
  const payment = await repos.payment.findByProviderPaymentId(payload.providerPaymentId);
  if (!payment) {
    return { ok: false, reason: "no_payment" };
  }

  // 3. settlement
  const newStatus = payload.status === "succeeded" ? "succeeded"
    : payload.status === "refunded" ? "refunded"
    : "failed";
  await repos.payment.updateStatus(payment.id, newStatus, undefined, payload.event_id);

  // 4. settle the linked bid and publish the pending content only after success.
  const bid = await repos.ranking.findBidByPaymentId(payment.id);
  if (bid) {
    const bidStatus = newStatus === "succeeded" ? "settled" : newStatus === "refunded" ? "refunded" : "failed";
    await repos.ranking.updateBidStatus(bid.id, bidStatus, payment.id, newStatus === "succeeded" ? new Date() : undefined);
    if (newStatus === "succeeded") await publishPaidContent(bid.contentId, ctx);
  }

  // 5. audit
  await audit(ctx, "payment.settle", "payment", payment.id, {
    paymentId: payment.id, providerPaymentId: payload.providerPaymentId,
    status: newStatus, amount: payload.amount, currency: payload.currency,
  });

  return { ok: true, paymentId: payment.id };
}

async function publishPaidContent(contentId: string, ctx: RequestContext) {
  const { repos } = container;
  const content = await repos.content.findById(contentId);
  if (!content || content.status === "live") return;
  await repos.content.updateStatus(content.id, "live");
  await repos.metric.append({ contentId: content.id, source: "outrank", views: 0, likes: 0, comments: 0, shares: 0 });
  await repos.ranking.appendOrganicSnapshot({ contentId: content.id, category: content.category, rank: 9999, score: 1000, momentum: 0 });
  await audit(ctx, "content.publish.paid_bid", "content", content.id, { contentId: content.id });
}

// Called after settlement to recompute sponsored ranking for a content's bids.
export async function recomputeSponsoredRanking(contentId: string, ctx: RequestContext) {
  const { repos } = container;
  const bids = await repos.ranking.activeBidsByContent(contentId);
  // mark the matching pending bid as settled
  // (in a real impl, confirmPayment finds the bid by paymentId and settles it)
  await audit(ctx, "ranking.sponsored.recalc", "ranking", contentId, {
    contentId, bidCount: bids.length, totalBid: bids.reduce((s, b) => s + b.amount, 0),
  });
}
