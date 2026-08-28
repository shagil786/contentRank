import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Webhook } from "standardwebhooks";

const runId = randomUUID();
const secret = `whsec_${Buffer.from(`content-rank-dispute-${runId}`).toString("base64")}`;
process.env.DODO_WEBHOOK_SECRET = secret;
process.env.DODO_TEST_WEBHOOK_SECRET = "";
process.env.DISPUTE_ALERT_EMAIL = "";
process.env.POSTHOG_PROJECT_TOKEN = "";

let contentId = "";
let paymentId = "";

async function main() {
  const [{ db }, { container }, { confirmPayment }, { newRequestContext }, { closeRedis }] = await Promise.all([
    import("../src/lib/db"),
    import("../src/server/application/container"),
    import("../src/server/application/confirm-payment"),
    import("../src/server/infrastructure/request-context"),
    import("../src/server/infrastructure/redis"),
  ]);
  const originalRetrieve = container.adapters.payments.dodo.retrievePayment;
  const providerPaymentId = `pay_dispute_${runId}`;
  const webhook = new Webhook(secret);
  const ctx = newRequestContext({ actor: "verify:dispute-workflow" });

  try {
    const content = await db.content.create({
      data: {
        canonicalId: `verify:dispute:${runId}`,
        platform: "manual",
        platformKey: runId,
        url: `https://example.com/dispute/${runId}`,
        title: "Dispute workflow verification",
        kind: "topic",
        category: "tech",
        status: "live",
      },
    });
    contentId = content.id;
    const payment = await db.payment.create({
      data: {
        provider: "dodo",
        providerPaymentId,
        amount: 1_000,
        currency: "usd",
        mode: "test",
        status: "succeeded",
      },
    });
    paymentId = payment.id;
    await db.sponsoredBid.create({
      data: {
        contentId,
        amount: 1_000,
        currency: "usd",
        status: "settled",
        paymentId,
        settledAt: new Date(),
      },
    });

    async function deliver(eventType: string, eventId: string) {
      const rawBody = JSON.stringify({
        type: eventType,
        data: {
          dispute_id: `dp_${runId}`,
          payment_id: providerPaymentId,
          amount: 1_000,
          currency: "USD",
          dispute_status: eventType.split(".")[1],
          dispute_stage: "chargeback",
        },
      });
      const now = new Date();
      return confirmPayment({
        rawBody,
        headers: {
          id: eventId,
          signature: webhook.sign(eventId, now, rawBody),
          timestamp: String(Math.floor(now.getTime() / 1_000)),
        },
      }, ctx);
    }

    const openedId = `evt_dispute_opened_${runId}`;
    assert.equal((await deliver("dispute.opened", openedId)).ok, true);
    assert.equal((await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).status, "disputed");
    assert.equal((await db.sponsoredBid.findFirstOrThrow({ where: { paymentId } })).status, "disputed");
    const suspendedBoard = await container.repos.ranking.rankedContentPage({
      category: "global", timeframe: "alltime", limit: 1_000,
    });
    assert.equal(suspendedBoard.rows.find((row) => row.content.id === contentId)?.backedCents, 0);

    const duplicate = await deliver("dispute.opened", openedId);
    assert.equal(duplicate.reason, "duplicate");
    assert.equal(await db.paymentWebhookEvent.count({ where: { eventId: openedId } }), 1);

    container.adapters.payments.dodo.retrievePayment = async () => ({
      providerPaymentId,
      status: "succeeded",
      amount: 1_000,
      refundedAmount: 0,
      currency: "USD",
    });
    assert.equal((await deliver("dispute.won", `evt_dispute_won_${runId}`)).ok, true);
    assert.equal((await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).status, "succeeded");
    assert.equal((await db.sponsoredBid.findFirstOrThrow({ where: { paymentId } })).status, "settled");
    const restoredBoard = await container.repos.ranking.rankedContentPage({
      category: "global", timeframe: "alltime", limit: 1_000,
    });
    assert.equal(restoredBoard.rows.find((row) => row.content.id === contentId)?.backedCents, 1_000);

    console.log("dispute workflow verification passed");
  } finally {
    container.adapters.payments.dodo.retrievePayment = originalRetrieve;
    if (contentId) {
      await db.auditLog.deleteMany({ where: { targetId: { in: [contentId, paymentId] } } });
      await db.sponsoredBid.deleteMany({ where: { contentId } });
      if (paymentId) await db.payment.deleteMany({ where: { id: paymentId } });
      await db.content.deleteMany({ where: { id: contentId } });
    }
    await closeRedis();
    await db.$disconnect();
  }
}

void main();
