import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { container } from "../src/server/application/container";
import { reconcilePayment } from "../src/server/application/confirm-payment";
import { newRequestContext } from "../src/server/infrastructure/request-context";
import type { PaymentSnapshot } from "../src/server/adapters/payments/interface";
import { closeRedis } from "../src/server/infrastructure/redis";

const runId = randomUUID();
let contentId = "";
let paymentId = "";
const originalRetrieve = container.adapters.payments.dodo.retrievePayment;

function snapshot(refundedAmount: number): PaymentSnapshot {
  return {
    providerPaymentId: `pay_reconcile_${runId}`,
    status: "succeeded",
    amount: 1_000,
    refundedAmount,
    currency: "USD",
  };
}

async function main() {
  const content = await db.content.create({
    data: {
      canonicalId: `verify:reconcile:${runId}`,
      platform: "manual",
      platformKey: runId,
      url: `https://example.com/reconcile/${runId}`,
      title: "Payment reconciliation verification",
      kind: "topic",
      category: "tech",
      status: "pending",
    },
  });
  contentId = content.id;
  const payment = await db.payment.create({
    data: {
      provider: "dodo",
      providerPaymentId: `pay_reconcile_${runId}`,
      amount: 1_000,
      currency: "usd",
      mode: "test",
      status: "initiated",
    },
  });
  paymentId = payment.id;
  await db.sponsoredBid.create({
    data: { contentId, amount: 1_000, currency: "usd", status: "pending", paymentId },
  });

  const provider = container.adapters.payments.dodo as typeof container.adapters.payments.dodo & {
    retrievePayment: (id: string, mode: "live" | "test") => Promise<PaymentSnapshot>;
  };
  provider.retrievePayment = async () => snapshot(0);
  const ctx = newRequestContext({ actor: "verify:payment-reconciliation" });
  assert.equal((await reconcilePayment(paymentId, ctx)).ok, true);
  assert.equal((await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).status, "succeeded");
  assert.equal((await db.sponsoredBid.findFirstOrThrow({ where: { paymentId } })).status, "settled");
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: contentId } })).status, "live");

  provider.retrievePayment = async () => snapshot(300);
  await reconcilePayment(paymentId, ctx);
  const partialPayment = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  const partialBid = await db.sponsoredBid.findFirstOrThrow({ where: { paymentId } });
  assert.equal(partialPayment.status, "succeeded");
  assert.equal(partialPayment.refundedAmount, 300);
  assert.equal(partialBid.status, "settled");
  assert.equal(partialBid.refundedAmount, 300);
  const partialBoard = await container.repos.ranking.rankedContentPage({ category: "global", timeframe: "alltime", limit: 1_000 });
  assert.equal(partialBoard.rows.find((row) => row.content.id === contentId)?.backedCents, 700);

  provider.retrievePayment = async () => snapshot(1_000);
  await reconcilePayment(paymentId, ctx);
  assert.equal((await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).status, "refunded");
  assert.equal((await db.sponsoredBid.findFirstOrThrow({ where: { paymentId } })).status, "refunded");
  const refundedBoard = await container.repos.ranking.rankedContentPage({ category: "global", timeframe: "alltime", limit: 1_000 });
  assert.equal(refundedBoard.rows.find((row) => row.content.id === contentId)?.backedCents, 0);

  console.log("payment reconciliation verification passed");
}

main().finally(async () => {
  container.adapters.payments.dodo.retrievePayment = originalRetrieve;
  if (contentId) {
    await db.auditLog.deleteMany({ where: { targetId: { in: [contentId, paymentId] } } });
    await db.organicRanking.deleteMany({ where: { contentId } });
    await db.metric.deleteMany({ where: { contentId } });
    await db.sponsoredBid.deleteMany({ where: { contentId } });
    if (paymentId) await db.payment.deleteMany({ where: { id: paymentId } });
    await db.content.deleteMany({ where: { id: contentId } });
  }
  await closeRedis();
  await db.$disconnect();
});
