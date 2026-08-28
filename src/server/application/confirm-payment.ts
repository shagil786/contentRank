// ConfirmPaymentService — handles the Dodo webhook.
// Flow: signature verification → event deduplication → payment settlement
//   → sponsored ranking update → audit record.
// Background jobs never directly manipulate HTTP state; they call this service.

import { container } from "./container";
import { audit } from "../infrastructure/request-context";
import type { RequestContext } from "../infrastructure/request-context";
import type { WebhookPayload, WebhookSignatureHeaders } from "../adapters/payments/interface";
import { stableUnsubscribeToken } from "../infrastructure/subscription-tokens";
import { sendResendEmail } from "../infrastructure/email";
import { captureServerEvent } from "../infrastructure/analytics";
import { getRedis } from "../infrastructure/redis";
import type { Payment, SponsoredBid } from "../domain/types";
import type { PaymentSnapshot } from "../adapters/payments/interface";

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

  // Dodo can deliver informational events (for example payment.processing or
  // refund.failed) to the same endpoint. They are authentic, but they must not
  // mutate a final payment or bid state.
  if (payload.status === "ignored") {
    await audit(ctx, "payment.webhook.ignored", "payment", payload.providerPaymentId || "—", {
      eventId: payload.event_id,
      eventType: payload.eventType,
    });
    return { ok: true, reason: "ignored" };
  }

  // 2. event deduplication (via webhookEventId)
  const existing = await repos.payment.findByWebhookEventId(payload.event_id);
  if (existing) {
    await audit(ctx, "payment.webhook.duplicate", "payment", existing.id, { eventId: payload.event_id });
    return { ok: true, paymentId: existing.id, reason: "duplicate" };
  }

  // find the payment by providerPaymentId
  const payment = payload.internalPaymentId
    ? await repos.payment.findById(payload.internalPaymentId)
    : payload.providerPaymentId
      ? await repos.payment.findByProviderPaymentId(payload.providerPaymentId)
      : null;
  if (!payment) {
    return { ok: false, reason: "no_payment" };
  }

  if (payload.status === "disputed") {
    return handleDisputeEvent(payment, payload, ctx);
  }

  if (payload.status !== "refunded" && payload.amount > 0 && payload.amount !== payment.amount) {
    await audit(ctx, "payment.webhook.rejected", "payment", payment.id, {
      reason: "amount_mismatch",
      expected: payment.amount,
      received: payload.amount,
      eventId: payload.event_id,
    });
    return { ok: false, reason: "amount_mismatch" };
  }
  if (payload.currency && payload.currency.toLowerCase() !== payment.currency.toLowerCase()) {
    await audit(ctx, "payment.webhook.rejected", "payment", payment.id, {
      reason: "currency_mismatch",
      expected: payment.currency,
      received: payload.currency,
      eventId: payload.event_id,
    });
    return { ok: false, reason: "currency_mismatch" };
  }

  let snapshot: PaymentSnapshot;
  if (payload.status === "refunded") {
    if (!payment.providerPaymentId && !payload.providerPaymentId) return { ok: false, reason: "no_payment_id" };
    // Refund webhooks contain the amount for one refund. Retrieve the payment
    // to obtain the cumulative successful refund total, making multiple partial
    // refunds and webhook retries idempotent.
    snapshot = await adapters.payments.dodo.retrievePayment(
      payment.providerPaymentId || payload.providerPaymentId!,
      payment.mode
    );
  } else {
    snapshot = {
      providerPaymentId: payment.providerPaymentId || payload.providerPaymentId || "",
      status: payload.status === "succeeded" ? "succeeded" : "failed",
      amount: payload.amount || payment.amount,
      refundedAmount: payment.refundedAmount,
      currency: payload.currency || payment.currency,
      customerEmail: payload.customerEmail,
      analyticsDistinctId: payload.analyticsDistinctId,
      analyticsSessionId: payload.analyticsSessionId,
      analyticsFlow: payload.analyticsFlow,
    };
  }

  const result = await applyPaymentSnapshot(payment, snapshot, ctx, payload.event_id);
  if (result.ok) {
    await repos.payment.recordWebhookEvent({
      eventId: payload.event_id,
      eventType: payload.eventType,
      paymentId: payment.id,
    });
  }
  return result;
}

export async function reconcilePayment(paymentId: string, ctx: RequestContext): Promise<ConfirmPaymentResult> {
  const { repos, adapters } = container;
  const payment = await repos.payment.findById(paymentId);
  if (!payment?.providerPaymentId) return { ok: false, reason: "no_payment" };
  try {
    const snapshot = await adapters.payments.dodo.retrievePayment(payment.providerPaymentId, payment.mode);
    const result = await applyPaymentSnapshot(payment, snapshot, ctx);
    await repos.payment.markReconciled(payment.id);
    return result;
  } catch (error) {
    await repos.payment.markReconciled(payment.id, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function handleDisputeEvent(
  payment: Payment,
  payload: WebhookPayload,
  ctx: RequestContext
): Promise<ConfirmPaymentResult> {
  const { repos, adapters } = container;
  const outcome = payload.eventType.slice("dispute.".length);
  const restoresBacking = outcome === "won" || outcome === "cancelled";

  if (restoresBacking) {
    if (!payment.providerPaymentId && !payload.providerPaymentId) {
      return { ok: false, reason: "no_payment_id" };
    }
    const snapshot = await adapters.payments.dodo.retrievePayment(
      payment.providerPaymentId || payload.providerPaymentId!,
      payment.mode
    );
    const result = await applyPaymentSnapshot(payment, snapshot, ctx, payload.event_id);
    if (!result.ok) return result;
    await repos.payment.recordWebhookEvent({
      eventId: payload.event_id,
      eventType: payload.eventType,
      paymentId: payment.id,
    });
    await auditDisputeAndAlert(payment, payload, result.bidId, "restored_after_provider_reconciliation", ctx);
    return result;
  }

  await repos.payment.updateAccounting(payment.id, {
    status: "disputed",
    refundedAmount: payment.refundedAmount,
    providerPaymentId: payment.providerPaymentId || payload.providerPaymentId,
    webhookEventId: payload.event_id,
  });
  const bid = await repos.ranking.findBidByPaymentId(payment.id);
  if (bid) {
    await repos.ranking.updateBidStatus(
      bid.id,
      "disputed",
      payment.id,
      undefined,
      payment.refundedAmount
    );
  }
  await repos.payment.recordWebhookEvent({
    eventId: payload.event_id,
    eventType: payload.eventType,
    paymentId: payment.id,
  });

  try {
    const redis = await getRedis();
    await redis?.publish("outrank:leaderboard-updated", JSON.stringify({
      contentId: bid?.contentId,
      paymentId: payment.id,
      status: "disputed",
      ts: Date.now(),
    }));
  } catch {
    // PostgreSQL is authoritative; clients retain their polling fallback.
  }

  await auditDisputeAndAlert(payment, payload, bid?.id, "backing_suspended", ctx);
  return { ok: true, paymentId: payment.id, bidId: bid?.id };
}

async function auditDisputeAndAlert(
  payment: Payment,
  payload: WebhookPayload,
  bidId: string | undefined,
  action: "backing_suspended" | "restored_after_provider_reconciliation",
  ctx: RequestContext
) {
  const details = {
    eventId: payload.event_id,
    eventType: payload.eventType,
    disputeId: payload.disputeId,
    disputeStatus: payload.disputeStatus,
    disputeStage: payload.disputeStage,
    amount: payload.amount,
    currency: payload.currency,
    bidId,
    action,
  };
  await audit(ctx, `payment.${payload.eventType}`, "payment", payment.id, details);
  await captureServerEvent({
    distinctId: "system:payment-operations",
    event: "payment_dispute_updated",
    properties: { ...details, payment_id: payment.id },
  });

  const alertEmail = process.env.DISPUTE_ALERT_EMAIL;
  if (!alertEmail) return;
  const lines = [
    `Dodo event: ${payload.eventType}`,
    `Internal payment: ${payment.id}`,
    `Provider payment: ${payment.providerPaymentId || payload.providerPaymentId || "unknown"}`,
    `Dispute: ${payload.disputeId || "unknown"}`,
    `Amount: ${payload.amount} ${payload.currency}`,
    `Action: ${action}`,
    "Review the dispute in the authenticated Dodo dashboard.",
  ];
  await sendResendEmail({
    to: alertEmail,
    subject: `[OUTRANK] ${payload.eventType} requires review`,
    text: lines.join("\n"),
    html: `<pre>${escapeHtml(lines.join("\n"))}</pre>`,
  }).catch(() => undefined);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[character] || character);
}

async function applyPaymentSnapshot(
  payment: Payment,
  snapshot: PaymentSnapshot,
  ctx: RequestContext,
  webhookEventId?: string
): Promise<ConfirmPaymentResult> {
  const { repos } = container;
  if (snapshot.amount > 0 && snapshot.amount !== payment.amount) {
    await audit(ctx, "payment.reconciliation.rejected", "payment", payment.id, {
      reason: "amount_mismatch", expected: payment.amount, received: snapshot.amount,
    });
    return { ok: false, reason: "amount_mismatch" };
  }
  if (snapshot.currency && snapshot.currency.toLowerCase() !== payment.currency.toLowerCase()) {
    return { ok: false, reason: "currency_mismatch" };
  }

  const refundedAmount = Math.min(payment.amount, Math.max(0, snapshot.refundedAmount));
  const fullyRefunded = payment.amount > 0 && refundedAmount >= payment.amount;
  const newStatus: Payment["status"] = fullyRefunded ? "refunded" : snapshot.status;
  if (payment.status === "refunded" && newStatus !== "refunded") {
    return { ok: true, paymentId: payment.id, reason: "stale_state_transition" };
  }
  if (payment.status === "succeeded" && newStatus === "failed") {
    return { ok: true, paymentId: payment.id, reason: "stale_state_transition" };
  }
  if (newStatus === "initiated") return { ok: true, paymentId: payment.id, reason: "processing" };

  const statusChanged = payment.status !== newStatus;
  const refundChanged = payment.refundedAmount !== refundedAmount;
  await repos.payment.updateAccounting(payment.id, {
    status: newStatus,
    refundedAmount,
    providerPaymentId: snapshot.providerPaymentId,
  });

  const bid = await repos.ranking.findBidByPaymentId(payment.id);
  const bidWasSettled = bid?.status === "settled";
  if (bid) {
    const bidStatus: SponsoredBid["status"] = fullyRefunded ? "refunded" : newStatus === "succeeded" ? "settled" : "failed";
    await repos.ranking.updateBidStatus(
      bid.id,
      bidStatus,
      payment.id,
      newStatus === "succeeded" && !bid.settledAt ? new Date() : undefined,
      refundedAmount
    );
    if (newStatus === "succeeded") {
      await publishPaidContent(bid.contentId, ctx);
      if (!bidWasSettled && payment.status !== "disputed" && snapshot.customerEmail) {
        await subscribePaidBidder(snapshot.customerEmail, bid.contentId, ctx).catch(() => undefined);
      }
    }
  }

  // Record the webhook id last. All state operations above are absolute and
  // idempotent, so a retry after a process crash safely converges.
  await repos.payment.updateAccounting(payment.id, {
    status: newStatus,
    refundedAmount,
    providerPaymentId: snapshot.providerPaymentId,
    webhookEventId,
  });

  if (statusChanged || refundChanged) {
    try {
      const redis = await getRedis();
      await redis?.publish("outrank:leaderboard-updated", JSON.stringify({
        contentId: bid?.contentId, paymentId: payment.id, status: newStatus, refundedAmount, ts: Date.now(),
      }));
    } catch {
      // PostgreSQL remains authoritative; clients have a polling fallback.
    }
  }

  await audit(ctx, "payment.settle", "payment", payment.id, {
    paymentId: payment.id,
    providerPaymentId: snapshot.providerPaymentId,
    status: newStatus,
    amount: payment.amount,
    refundedAmount,
    currency: payment.currency,
    source: webhookEventId ? "webhook" : "reconciliation",
  });

  if ((statusChanged || refundChanged) && snapshot.analyticsDistinctId) {
    const event = refundChanged
      ? fullyRefunded ? "payment_refunded" : "payment_partially_refunded"
      : newStatus === "succeeded" ? "checkout_completed" : "checkout_failed";
    await captureServerEvent({
      distinctId: snapshot.analyticsDistinctId,
      event,
      properties: {
        flow: snapshot.analyticsFlow || "defend",
        content_id: bid?.contentId,
        amount_cents: payment.amount,
        refunded_amount_cents: refundedAmount,
        currency: payment.currency,
        provider: "dodo",
        ...(snapshot.analyticsSessionId ? { $session_id: snapshot.analyticsSessionId } : {}),
      },
    });
  }

  return { ok: true, paymentId: payment.id, bidId: bid?.id };
}

async function subscribePaidBidder(email: string, contentId: string, ctx: RequestContext) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return;
  const content = await container.repos.content.findById(contentId);
  if (!content) return;

  const scopeKey = `entity:${contentId}:${normalizedEmail}`;
  const unsubscribe = stableUnsubscribeToken(scopeKey);
  const subscription = await container.repos.subscription.upsert({
    email: normalizedEmail,
    entityId: contentId,
    scopeKey,
    session: ctx.session,
    confirmedAt: new Date(),
    confirmationTokenHash: undefined,
    confirmationExpiresAt: undefined,
    unsubscribeTokenHash: unsubscribe.hash,
  });

  const appUrl = process.env.APP_URL || "https://content-rank.lol";
  const unsubscribeUrl = `${appUrl}/api/subscribe/unsubscribe?token=${unsubscribe.raw}`;
  try {
    await sendResendEmail({
      to: normalizedEmail,
      subject: `You're tracking ${content.title}`,
      text: `You're now subscribed to rank updates for ${content.title} on OUTRANK.\n\nUnsubscribe anytime: ${unsubscribeUrl}`,
      html: `<p>You're now subscribed to rank updates for <strong>${content.title}</strong> on OUTRANK.</p><p><a href="${unsubscribeUrl}">Unsubscribe anytime</a></p>`,
    });
  } catch {
    // Payment settlement remains successful even if notification delivery is unavailable.
  }
  await audit(ctx, "subscribe.paid_bidder", "content", contentId, {
    contentId, subscriptionId: subscription.id,
  });
}

async function publishPaidContent(contentId: string, ctx: RequestContext) {
  const { repos } = container;
  const content = await repos.content.findById(contentId);
  if (!content || content.status === "live") return;
  await repos.content.updateStatus(content.id, "live");
  await repos.metric.append({ contentId: content.id, source: "outrank", views: 0, likes: 0, comments: 0, shares: 0 });
  const liveCount = (await repos.content.listAll("live")).length;
  for (const category of new Set(["global", content.category] as const)) {
    const board = await repos.ranking.rankedContentPage({
      category,
      timeframe: "alltime",
      limit: Math.max(1, liveCount),
    });
    const entry = board.rows.find((row) => row.content.id === content.id);
    if (entry) {
      await repos.ranking.appendOrganicSnapshot({
        contentId: content.id,
        category,
        rank: entry.rank,
        score: Math.round(entry.score),
        momentum: 0,
      });
    }
  }
  await audit(ctx, "content.publish.paid_bid", "content", content.id, { contentId: content.id });
}
