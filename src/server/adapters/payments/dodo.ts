// Dodo Payments provider implementation.
// Checkout uses Dodo's hosted Checkout Sessions API in Test Mode when the
// runtime credentials are configured; webhook verification remains local.

import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import type {
  PaymentProvider,
  CreateCheckoutInput,
  CreateCheckoutResult,
  WebhookVerification,
  WebhookPayload,
  WebhookSignatureHeaders,
} from "./interface";
import { paymentRepo } from "../../repositories/prisma-impl";

const DODO_SECRET = process.env.DODO_WEBHOOK_SECRET || "";
const DODO_TEST_SECRET = process.env.DODO_TEST_WEBHOOK_SECRET || "";

export const dodoProvider: PaymentProvider = {
  name: "dodo",

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const testMode = input.mode === "test";
    if (testMode && process.env.PAYMENT_TEST_MODE_ENABLED !== "true") {
      throw new Error("Dodo payment test mode is disabled");
    }
    const DODO_API_KEY = testMode
      ? process.env.DODO_TEST_PAYMENTS_API_KEY || ""
      : process.env.DODO_PAYMENTS_API_KEY || "";
    const DODO_PRODUCT_ID = testMode
      ? process.env.DODO_TEST_PRODUCT_ID || ""
      : process.env.DODO_PRODUCT_ID || "";
    const DODO_API_BASE = testMode
      ? process.env.DODO_TEST_API_BASE_URL || "https://test.dodopayments.com"
      : process.env.DODO_API_BASE_URL || "https://live.dodopayments.com";
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
      status: "initiated",
    });
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
        metadata: { bidId: input.bidId, contentId: input.contentId, internalPaymentId: payment.id },
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
  },

  async verifyWebhook(rawBody: string, headers: WebhookSignatureHeaders): Promise<WebhookVerification> {
    if (!DODO_SECRET) {
      return { ok: false, payload: null, reason: "webhook_secret_not_configured" };
    }
    if (!headers.signature && !headers.legacySignature) {
      return { ok: false, payload: null, reason: "missing_signature" };
    }

    const legacySignature = headers.legacySignature?.trim().replace(/^sha256=/i, "");
    const standardValid = [DODO_SECRET, DODO_TEST_SECRET].filter(Boolean).some((secret) => {
      const secretValue = secret.replace(/^whsec_/, "");
      const secretKey = Buffer.from(secretValue, "base64");
      const expected = headers.id && headers.timestamp && headers.signature
        ? createHmac("sha256", secretKey).update(`${headers.id}.${headers.timestamp}.${rawBody}`).digest()
        : null;
      return Boolean(expected && headers.signature && headers.signature.split(" ").some((part) => {
        const suppliedBuffer = Buffer.from(part.replace(/^v1,/, ""), "base64");
        return suppliedBuffer.length === expected.length && timingSafeEqual(suppliedBuffer, expected);
      }));
    });
    const legacyValid = [DODO_SECRET, DODO_TEST_SECRET].filter(Boolean).some((secret) => {
      if (!legacySignature) return false;
      const expected = createHmac("sha256", secret).update(rawBody).digest();
      const supplied = /^[0-9a-f]{64}$/i.test(legacySignature) ? Buffer.from(legacySignature, "hex") : Buffer.from(legacySignature, "base64");
      return supplied.length === expected.length && timingSafeEqual(supplied, expected);
    });

    if (!standardValid && !legacyValid) {
      return { ok: false, payload: null, reason: "bad_signature" };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return { ok: false, payload: null, reason: "bad_json" };
    }

    const data = (parsed.data && typeof parsed.data === "object" ? parsed.data : parsed) as Record<string, unknown>;
    const eventType = String(parsed.type || parsed.event_type || "").toLowerCase();
    const providerPaymentId = String(data.payment_id || data.paymentId || parsed.providerPaymentId || parsed.payment_id || "");
    const event_id = String(headers.id || parsed.event_id || parsed.id || randomUUID());
    const rawStatus = String(data.status || parsed.status || eventType.split(".").pop() || "succeeded").toLowerCase();
    const status = (rawStatus === "success" || rawStatus === "succeeded" ? "succeeded" : rawStatus === "refunded" ? "refunded" : "failed") as WebhookPayload["status"];
    const amount = Number(data.total_amount || data.amount || parsed.amount || 0);
    const currency = String(data.currency || parsed.currency || "usd");

    if (!providerPaymentId) {
      return { ok: false, payload: null, reason: "no_payment_id" };
    }

    return {
      ok: true,
      payload: { providerPaymentId, event_id, status, amount, currency, raw: parsed },
    };
  },
};
