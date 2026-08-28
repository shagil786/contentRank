// Dodo Payments provider implementation.
// Checkout uses Dodo's hosted Checkout Sessions API in Test Mode when the
// runtime credentials are configured; webhook verification remains local.

import { randomUUID } from "crypto";
import { Webhook } from "standardwebhooks";
import type {
  PaymentProvider,
  CreateCheckoutInput,
  CreateCheckoutResult,
  WebhookVerification,
  WebhookPayload,
  WebhookSignatureHeaders,
  PaymentSnapshot,
} from "./interface";
import { CheckoutCreationError } from "./interface";
import { paymentRepo } from "../../repositories/prisma-impl";

const DODO_SECRET = process.env.DODO_WEBHOOK_SECRET || "";
const DODO_TEST_SECRET = process.env.DODO_TEST_WEBHOOK_SECRET || "";

function dodoEnvironment(mode: "live" | "test") {
  const testMode = mode === "test";
  return {
    apiKey: testMode ? process.env.DODO_TEST_PAYMENTS_API_KEY || "" : process.env.DODO_PAYMENTS_API_KEY || "",
    productId: testMode ? process.env.DODO_TEST_PRODUCT_ID || "" : process.env.DODO_PRODUCT_ID || "",
    apiBase: testMode
      ? process.env.DODO_TEST_API_BASE_URL || "https://test.dodopayments.com"
      : process.env.DODO_API_BASE_URL || "https://live.dodopayments.com",
  };
}

function analyticsMetadata(metadata: Record<string, unknown> | undefined) {
  return {
    analyticsDistinctId: typeof metadata?.analyticsDistinctId === "string" ? metadata.analyticsDistinctId : undefined,
    analyticsSessionId: typeof metadata?.analyticsSessionId === "string" ? metadata.analyticsSessionId : undefined,
    analyticsFlow: metadata?.analyticsFlow === "initial_bid" ? "initial_bid" as const
      : metadata?.analyticsFlow === "defend" ? "defend" as const
      : undefined,
  };
}

export const dodoProvider: PaymentProvider = {
  name: "dodo",

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const testMode = input.mode === "test";
    if (testMode && process.env.PAYMENT_TEST_MODE_ENABLED !== "true") {
      throw new Error("Dodo payment test mode is disabled");
    }
    const { apiKey: DODO_API_KEY, productId: DODO_PRODUCT_ID, apiBase: DODO_API_BASE } = dodoEnvironment(testMode ? "test" : "live");
    if (!DODO_API_KEY || !DODO_PRODUCT_ID) {
      throw new Error(testMode
        ? "Dodo test checkout is not configured: set DODO_TEST_PAYMENTS_API_KEY and DODO_TEST_PRODUCT_ID"
        : "Dodo checkout is not configured: set DODO_PAYMENTS_API_KEY and DODO_PRODUCT_ID");
    }

    // create an internal payment record (source of truth)
    const payment = await paymentRepo.insert({
      provider: "dodo",
      amount: input.amount,
      currency: input.currency,
      mode: testMode ? "test" : "live",
      status: "initiated",
    });
    try {
      const response = await fetch(`${DODO_API_BASE}/checkouts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DODO_API_KEY}`,
          "Content-Type": "application/json",
          "User-Agent": "outrank/1.0",
          "Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify({
          product_cart: [{ product_id: DODO_PRODUCT_ID, quantity: 1, amount: input.amount }],
          return_url: input.successUrl,
          cancel_url: input.cancelUrl,
          metadata: {
            bidId: input.bidId,
            contentId: input.contentId,
            internalPaymentId: payment.id,
            analyticsDistinctId: input.analyticsDistinctId,
            analyticsSessionId: input.analyticsSessionId,
            analyticsFlow: input.analyticsFlow || "defend",
          },
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Dodo checkout failed (${response.status}): ${detail.slice(0, 240)}`);
      }
      const data = await response.json() as { payment_id?: string; session_id?: string; checkout_url?: string };
      const providerPaymentId = data.payment_id || data.session_id || "dodo_" + randomUUID();
      const checkoutUrl = data.checkout_url;
      if (!checkoutUrl) throw new Error("Dodo checkout response did not include checkout_url");
      await paymentRepo.updateStatus(payment.id, "initiated", providerPaymentId);
      return {
        paymentId: payment.id,
        checkoutUrl,
        providerPaymentId,
      };
    } catch (error) {
      await paymentRepo.updateStatus(payment.id, "failed").catch(() => undefined);
      throw new CheckoutCreationError(
        error instanceof Error ? error.message : "Dodo checkout failed",
        payment.id,
        { cause: error }
      );
    }
  },

  async retrievePayment(providerPaymentId: string, mode: "live" | "test"): Promise<PaymentSnapshot> {
    const { apiKey, apiBase } = dodoEnvironment(mode);
    if (!apiKey) throw new Error(`Dodo ${mode} API key is not configured`);
    const response = await fetch(`${apiBase}/payments/${encodeURIComponent(providerPaymentId)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, "User-Agent": "outrank/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Dodo payment retrieval failed (${response.status}): ${detail.slice(0, 240)}`);
    }
    const data = await response.json() as Record<string, unknown>;
    const refunds = Array.isArray(data.refunds) ? data.refunds as Array<Record<string, unknown>> : [];
    const refundedAmount = refunds
      .filter((refund) => String(refund.status || "").toLowerCase() === "succeeded")
      .reduce((sum, refund) => sum + Math.max(0, Number(refund.amount || 0)), 0);
    const providerStatus = String(data.status || "").toLowerCase();
    const status: PaymentSnapshot["status"] = providerStatus === "succeeded"
      ? "succeeded"
      : providerStatus === "failed" || providerStatus === "cancelled"
        ? "failed"
        : "initiated";
    const customer = data.customer && typeof data.customer === "object" ? data.customer as Record<string, unknown> : undefined;
    const metadata = data.metadata && typeof data.metadata === "object" ? data.metadata as Record<string, unknown> : undefined;
    return {
      providerPaymentId,
      status,
      amount: Number(data.total_amount || 0),
      refundedAmount,
      currency: String(data.currency || "usd"),
      customerEmail: typeof customer?.email === "string" && customer.email.includes("@") ? customer.email : undefined,
      ...analyticsMetadata(metadata),
    };
  },

  async verifyWebhook(rawBody: string, headers: WebhookSignatureHeaders): Promise<WebhookVerification> {
    if (!DODO_SECRET && !DODO_TEST_SECRET) {
      return { ok: false, payload: null, reason: "webhook_secret_not_configured" };
    }
    if (!headers.id || !headers.signature || !headers.timestamp) {
      return { ok: false, payload: null, reason: "missing_signature" };
    }

    let parsed: Record<string, unknown> | null = null;
    for (const secret of [DODO_SECRET, DODO_TEST_SECRET].filter(Boolean)) {
      try {
        const verified = new Webhook(secret).verify(rawBody, {
          "webhook-id": headers.id,
          "webhook-signature": headers.signature,
          "webhook-timestamp": headers.timestamp,
        });
        if (verified && typeof verified === "object") {
          parsed = verified as Record<string, unknown>;
          break;
        }
      } catch {
        // Try the other configured environment secret before rejecting.
      }
    }
    if (!parsed) return { ok: false, payload: null, reason: "bad_signature" };

    const data = (parsed.data && typeof parsed.data === "object" ? parsed.data : parsed) as Record<string, unknown>;
    const eventType = String(parsed.type || parsed.event_type || "").toLowerCase();
    const providerPaymentId = String(data.payment_id || data.paymentId || parsed.providerPaymentId || parsed.payment_id || "");
    const event_id = headers.id;
    const isDisputeEvent = eventType.startsWith("dispute.");
    const status: WebhookPayload["status"] = eventType === "payment.succeeded"
      ? "succeeded"
      : eventType === "payment.failed" || eventType === "payment.cancelled"
        ? "failed"
        : eventType === "refund.succeeded"
          ? "refunded"
          : isDisputeEvent
            ? "disputed"
          : "ignored";
    const amount = Number(data.total_amount || data.amount || parsed.amount || 0);
    const refundAmount = eventType === "refund.succeeded" ? Math.max(0, Number(data.amount || 0)) : undefined;
    const isPartialRefund = eventType === "refund.succeeded" ? data.is_partial === true : undefined;
    const disputeId = isDisputeEvent && typeof data.dispute_id === "string" ? data.dispute_id : undefined;
    const disputeStatus = isDisputeEvent && typeof data.dispute_status === "string" ? data.dispute_status : undefined;
    const disputeStage = isDisputeEvent && typeof data.dispute_stage === "string" ? data.dispute_stage : undefined;
    const currency = String(data.currency || parsed.currency || "usd");
    const customer = data.customer && typeof data.customer === "object" ? data.customer as Record<string, unknown> : undefined;
    const customerEmail = [
      customer?.email,
      data.customer_email,
      data.email,
      parsed.customer_email,
      parsed.email,
    ].find((value): value is string => typeof value === "string" && value.includes("@"));
    const metadata = (data.metadata && typeof data.metadata === "object" ? data.metadata : parsed.metadata) as Record<string, unknown> | undefined;
    const internalPaymentId = typeof metadata?.internalPaymentId === "string" ? metadata.internalPaymentId : undefined;
    const analytics = analyticsMetadata(metadata);

    if (status !== "ignored" && !providerPaymentId && !internalPaymentId) {
      return { ok: false, payload: null, reason: "no_payment_id" };
    }

    return {
      ok: true,
      payload: {
        providerPaymentId: providerPaymentId || undefined,
        internalPaymentId,
        event_id,
        eventType,
        status,
        amount,
        refundAmount,
        isPartialRefund,
        disputeId,
        disputeStatus,
        disputeStage,
        currency,
        customerEmail,
        ...analytics,
        raw: parsed,
      },
    };
  },
};
