import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { rankingRepo } from "../src/server/repositories/prisma-impl";

const runId = randomUUID();
const canonicalIds = [`verify:${runId}:a`, `verify:${runId}:b`];

async function main() {
  const [first, second] = await Promise.all([
    db.content.create({
      data: {
        canonicalId: canonicalIds[0],
        platform: "manual",
        platformKey: `${runId}:a`,
        url: `https://example.com/${runId}/a`,
        title: "Ranking verification A",
        kind: "topic",
        category: "tech",
        status: "live",
      },
    }),
    db.content.create({
      data: {
        canonicalId: canonicalIds[1],
        platform: "manual",
        platformKey: `${runId}:b`,
        url: `https://example.com/${runId}/b`,
        title: "Ranking verification B",
        kind: "topic",
        category: "tech",
        status: "live",
      },
    }),
  ]);

  await db.sponsoredBid.createMany({
    data: [
      { contentId: first.id, amount: 1_000, refundedAmount: 300, currency: "usd", status: "settled", settledAt: new Date() },
      { contentId: second.id, amount: 1_200, currency: "usd", status: "settled", settledAt: new Date() },
      { contentId: second.id, amount: 1_300, currency: "usd", status: "settled", settledAt: new Date() },
    ],
  });

  for (const timeframe of ["alltime", "today"] as const) {
    const board = await rankingRepo.rankedContentPage({ category: "global", timeframe, limit: 1_000 });
    const a = board.rows.find((row) => row.content.id === first.id);
    const b = board.rows.find((row) => row.content.id === second.id);
    assert(a && b, `${timeframe}: verification rows are missing`);
    assert.equal(a.score, 7, `${timeframe}: a $3 partial refund must reduce $10 backing to $7`);
    assert.equal(a.backedCents, 700, `${timeframe}: first total cents after partial refund`);
    assert.equal(a.bidCount, 1, `${timeframe}: first backer count`);
    assert.equal(b.score, 25, `${timeframe}: $25 must remain $25`);
    assert.equal(b.backedCents, 2_500, `${timeframe}: second total cents`);
    assert.equal(b.bidCount, 2, `${timeframe}: second backer count`);
    assert(b.rank < a.rank, `${timeframe}: $25 must outrank $10`);
  }

  console.log("paid-ranking verification passed");
}

main()
  .finally(async () => {
    await db.sponsoredBid.deleteMany({ where: { content: { canonicalId: { in: canonicalIds } } } });
    await db.content.deleteMany({ where: { canonicalId: { in: canonicalIds } } });
    await db.$disconnect();
  });
