import assert from "node:assert/strict";
import { Webhook } from "standardwebhooks";

const secret = `whsec_${Buffer.from("content-rank-local-verification-key").toString("base64")}`;
process.env.DODO_WEBHOOK_SECRET = secret;

async function main() {
  const { dodoProvider } = await import("../src/server/adapters/payments/dodo");

  const rawBody = JSON.stringify({
    type: "payment.succeeded",
    data: {
      payment_id: "pay_verify",
      total_amount: 2_500,
      currency: "USD",
      metadata: { internalPaymentId: "internal_verify" },
    },
  });
  const webhook = new Webhook(secret);
  const id = "evt_verify";
  const now = new Date();
  const signature = webhook.sign(id, now, rawBody);

  const verified = await dodoProvider.verifyWebhook(rawBody, {
    id,
    signature,
    timestamp: String(Math.floor(now.getTime() / 1_000)),
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.payload?.status, "succeeded");
  assert.equal(verified.payload?.amount, 2_500);
  assert.equal(verified.payload?.currency, "USD");
  assert.equal(verified.payload?.internalPaymentId, "internal_verify");

  const refundBody = JSON.stringify({
    type: "refund.succeeded",
    data: {
      payment_id: "pay_verify",
      amount: 300,
      currency: "USD",
      is_partial: true,
    },
  });
  const refundId = "evt_refund_verify";
  const refundVerified = await dodoProvider.verifyWebhook(refundBody, {
    id: refundId,
    signature: webhook.sign(refundId, now, refundBody),
    timestamp: String(Math.floor(now.getTime() / 1_000)),
  });
  assert.equal(refundVerified.ok, true);
  assert.equal(refundVerified.payload?.status, "refunded");
  assert.equal(refundVerified.payload?.refundAmount, 300);
  assert.equal(refundVerified.payload?.isPartialRefund, true);

  const stale = new Date(Date.now() - 10 * 60 * 1_000);
  const staleResult = await dodoProvider.verifyWebhook(rawBody, {
    id: "evt_stale",
    signature: webhook.sign("evt_stale", stale, rawBody),
    timestamp: String(Math.floor(stale.getTime() / 1_000)),
  });
  assert.equal(staleResult.ok, false);
  assert.equal(staleResult.reason, "bad_signature");

  console.log("webhook verification passed");
}

void main();
