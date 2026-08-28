// CreateSponsoredBidService — creates a sponsored bid + initiates payment via
// PaymentProvider (Dodo). The bid is "pending" until the webhook settles it.
// Sponsored rankings are SEPARATE from organic — they never pollute the
// organic leaderboard.

import { container } from "./container";
import { audit } from "../infrastructure/request-context";
import type { RequestContext } from "../infrastructure/request-context";
import { randomUUID } from "crypto";
import { CheckoutCreationError } from "../adapters/payments/interface";
import { captureServerEvent } from "../infrastructure/analytics";

export interface CreateBidInput {
  contentId: string;
  amount: number;       // cents
  currency?: string;
  targetRank?: number;
  successUrl?: string;
  cancelUrl?: string;
  idempotencyKey?: string;
  testMode?: boolean;
  analyticsDistinctId?: string;
  analyticsSessionId?: string;
  analyticsFlow?: "initial_bid" | "defend";
}

export interface CreateBidResult {
  ok: boolean;
  bidId?: string;
  paymentId?: string;
  checkoutUrl?: string;
  reason?: string;
}

export async function createSponsoredBid(
  input: CreateBidInput,
  ctx: RequestContext
): Promise<CreateBidResult> {
  const { repos, adapters } = container;

  const content = await repos.content.findById(input.contentId);
  if (!content) {
    return { ok: false, reason: "no_content" };
  }

  if (input.amount < 100) {
    return { ok: false, reason: "min_1_usd" };
  }

  // Prefer the client key so retries remain deduplicated across processes.
  const idempotencyKey = input.idempotencyKey || `${ctx.requestId}:${input.contentId}:${input.amount}`;
  const existingBid = await repos.ranking.findBidByIdempotencyKey(idempotencyKey);
  if (existingBid) {
    return { ok: false, reason: "duplicate_checkout_request", bidId: existingBid.id, paymentId: existingBid.paymentId };
  }

  // create the bid (pending)
  const bid = await repos.ranking.appendBid({
    contentId: input.contentId,
    amount: input.amount,
    refundedAmount: 0,
    currency: input.currency || "usd",
    status: "pending",
    idempotencyKey,
    session: ctx.session,
    targetRank: input.targetRank,
  });

  // initiate payment via Dodo
  let checkout;
  try {
    checkout = await adapters.payments.dodo.createCheckout({
      amount: input.amount,
      currency: input.currency || "usd",
      contentId: input.contentId,
      bidId: bid.id,
      idempotencyKey,
      successUrl: input.successUrl || "/?bid=success",
      cancelUrl: input.cancelUrl || "/?bid=cancel",
      description: `OUTRANK sponsored bid — ${content.title}`,
      mode: input.testMode ? "test" : "live",
      analyticsDistinctId: input.analyticsDistinctId,
      analyticsSessionId: input.analyticsSessionId,
      analyticsFlow: input.analyticsFlow,
    });
  } catch (error) {
    const paymentId = error instanceof CheckoutCreationError ? error.paymentId : undefined;
    await repos.ranking.updateBidStatus(bid.id, "failed", paymentId);
    await audit(ctx, "bid.checkout_failed", "bid", bid.id, {
      contentId: input.contentId,
      amount: input.amount,
      currency: input.currency || "usd",
      paymentId,
    });
    if (input.analyticsDistinctId) {
      await captureServerEvent({
        distinctId: input.analyticsDistinctId,
        event: "checkout_failed",
        properties: {
          flow: input.analyticsFlow || "defend",
          content_id: input.contentId,
          amount_cents: input.amount,
          currency: input.currency || "usd",
          failure_stage: "checkout_creation",
        },
      });
    }
    throw error;
  }

  // link bid → payment
  await repos.ranking.updateBidStatus(bid.id, "pending", checkout.paymentId);

  if (input.analyticsDistinctId) {
    await captureServerEvent({
      distinctId: input.analyticsDistinctId,
      event: "checkout_started",
      properties: {
        flow: input.analyticsFlow || "defend",
        content_id: input.contentId,
        amount_cents: input.amount,
        currency: input.currency || "usd",
        test_mode: input.testMode === true,
      },
    });
  }

  await audit(ctx, "bid.create", "bid", bid.id, {
    contentId: input.contentId, amount: input.amount, currency: input.currency || "usd",
    bidId: bid.id, paymentId: checkout.paymentId, targetRank: input.targetRank,
  });

  return {
    ok: true,
    bidId: bid.id,
    paymentId: checkout.paymentId,
    checkoutUrl: checkout.checkoutUrl,
  };
}
