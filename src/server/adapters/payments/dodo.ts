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

const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY || "";
const DODO_PRODUCT_ID = process.env.DODO_PRODUCT_ID || "";
const DODO_API_BASE = process.env.DODO_API_BASE_URL || "https://test.dodopayments.com";

export const dodoProvider: PaymentProvider = {
  name: "dodo",

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    if (!DODO_API_KEY || !DODO_PRODUCT_ID) {
      throw new Error("Dodo checkout is not configured: set DODO_PAYMENTS_API_KEY and DODO_PRODUCT_ID");
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

    const secretValue = DODO_SECRET.replace(/^whsec_/, "");
    const secretKey = Buffer.from(secretValue, "base64");
    const standardSignature = headers.id && headers.timestamp && headers.signature
      ? createHmac("sha256", secretKey).update(`${headers.id}.${headers.timestamp}.${rawBody}`).digest()
      : null;
    const standardValid = standardSignature && headers.signature
      ? headers.signature.split(" ").some((part) => {
          const supplied = part.replace(/^v1,/, "");
          const suppliedBuffer = Buffer.from(supplied, "base64");
          return suppliedBuffer.length === standardSignature.length && timingSafeEqual(suppliedBuffer, standardSignature);
        })
      : false;

    const legacySignature = headers.legacySignature?.trim().replace(/^sha256=/i, "");
    const legacyExpected = legacySignature ? createHmac("sha256", DODO_SECRET).update(rawBody).digest() : null;
    const legacyBuffer = legacySignature
      ? (/^[0-9a-f]{64}$/i.test(legacySignature) ? Buffer.from(legacySignature, "hex") : Buffer.from(legacySignature, "base64"))
      : null;
    const legacyValid = legacyExpected && legacyBuffer && legacyBuffer.length === legacyExpected.length && timingSafeEqual(legacyBuffer, legacyExpected);

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
