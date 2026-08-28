// OUTRANK background worker service.
// Runs periodic jobs that never directly manipulate HTTP state — they call
// application/domain services. Jobs: metric refresh, ranking recalculation,
// moderation review, payment reconciliation, retry/dead-letter.

import { createServer } from "http";

// We import from the Next.js app's server layer (shared via tsconfig paths).
// In production this would be a separate package; here it shares src/.
import { container } from "../../src/server/application/container";
import { fetchLeaderboard } from "../../src/server/application/fetch-leaderboard";
import { sendResendEmail } from "../../src/server/infrastructure/email";
import { stableUnsubscribeToken } from "../../src/server/infrastructure/subscription-tokens";
import { captureServerError } from "../../src/server/infrastructure/error-tracker";
import { newRequestContext } from "../../src/server/infrastructure/request-context";
import { reconcilePayment } from "../../src/server/application/confirm-payment";
import type { Category } from "../../src/server/domain/types";

// ---- Jobs ----

// 1. Ranking history — snapshot the canonical settled-bid board. The
// OrganicRanking table is retained as a historical snapshot store, but it is
// no longer the source of the paid score.
async function jobRankingRecalc() {
  const { repos } = container;
  try {
    const contents = await repos.content.listAll("live");
    const categories = new Set<Category>(["global", ...contents.map((content) => content.category)]);
    let snapshotCount = 0;
    for (const category of categories) {
      const board = await repos.ranking.rankedContentPage({
        category,
        timeframe: "alltime",
        limit: Math.max(1, contents.length),
      });
      for (const entry of board.rows) {
        await repos.ranking.appendOrganicSnapshot({
          contentId: entry.content.id,
          category,
          rank: entry.rank,
          score: Math.round(entry.score),
          momentum: entry.momentum,
        });
        snapshotCount++;
      }
    }
    console.log(`[worker] ranking history: ${snapshotCount} snapshots written`);
  } catch (e) {
    console.error("[worker] ranking recalc failed:", e);
  }
}

// 2. Metric refresh — call platform adapters to fetch fresh engagement metrics.
//    Adapters without configured official API credentials return null safely.
async function jobMetricRefresh() {
  const { repos, adapters } = container;
  try {
    const contents = await repos.content.listAll("live");
    let refreshed = 0;
    let skipped = 0;
    let failed = 0;
    for (const c of contents.slice(0, 5)) { // quota-safe batch; rotate selection on later runs
      const adapter = adapters.platforms.find((a) => a.platform === c.platform);
      if (!adapter?.fetchMetrics) { skipped++; continue; }
      try {
        const m = await adapter.fetchMetrics(c.platformKey);
        if (!m) { skipped++; continue; }
        await repos.metric.append({ contentId: c.id, source: c.platform, ...m });
        refreshed++;
      } catch (error) {
        failed++;
        console.warn(`[worker] metric refresh failed for ${c.platform}:${c.platformKey}:`, error);
      }
    }
    console.log(`[worker] metric refresh: ${refreshed} updated, ${skipped} skipped, ${failed} failed`);
  } catch (e) {
    console.error("[worker] metric refresh failed:", e);
  }
}

// 3. Moderation review — auto-resolve stale open reports (older than 24h with no action).
async function jobModerationReview() {
  const { repos } = container;
  try {
    const open = await repos.moderation.listOpen();
    const now = Date.now();
    let resolved = 0;
    for (const r of open) {
      if (now - r.createdAt.getTime() > 24 * 3600_000) {
        await repos.moderation.resolve(r.id, "dismissed");
        resolved++;
      }
    }
    console.log(`[worker] moderation review: ${resolved} stale reports dismissed`);
  } catch (e) {
    console.error("[worker] moderation review failed:", e);
  }
}

// 4. Payment reconciliation — check for stuck "initiated" payments older than 1h.
async function jobPaymentReconciliation() {
  const now = Date.now();
  const candidates = await container.repos.payment.listForReconciliation({
    initiatedBefore: new Date(now - 15 * 60_000),
    recheckBefore: new Date(now - 24 * 60 * 60_000),
    limit: 25,
  });
  let reconciled = 0;
  let processing = 0;
  let failed = 0;
  for (const payment of candidates) {
    const ctx = newRequestContext({ actor: "worker:payment-reconciliation" });
    try {
      const result = await reconcilePayment(payment.id, ctx);
      if (result.reason === "processing") processing++;
      else if (result.ok) reconciled++;
      else failed++;
    } catch (error) {
      failed++;
      captureServerError("worker.payment_reconciliation_failed", error, {
        paymentId: payment.id,
        providerPaymentId: payment.providerPaymentId,
        attempt: payment.reconciliationAttempts + 1,
      });
    }
  }
  console.log(`[worker] payment reconciliation: ${reconciled} reconciled, ${processing} processing, ${failed} failed`);
}

// 5. Retry / dead-letter — payment retries are driven by durable PostgreSQL
// reconciliation state and Dodo webhook redelivery. Other worker jobs are
// individually idempotent and report errors through captureServerError.
async function jobRetryDeadLetter() {
  console.log("[worker] retry/dead-letter: payment retries handled by reconciliation; no queued dead letters");
}

// 7. Session cleanup — anonymous sessions (no handle) idle for 30+ days are
// dead weight. Durable identities (subscriptions) live in their own table and
// are never touched. Keeps the Session table from growing unbounded.
async function jobSessionCleanup() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const removed = await container.repos.session.deleteStale(cutoff);
  console.log(`[worker] session cleanup: ${removed} stale anonymous sessions removed`);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

// 6. Notification delivery — send one email when a confirmed subscription's
// watched rank changes. The stored last-notified state makes this idempotent.
async function jobNotificationDelivery() {
  const { repos } = container;
  const subscriptions = await repos.subscription.listConfirmed();
  if (!subscriptions.length || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.log(`[worker] notification delivery: skipped (${subscriptions.length} subscriptions, Resend not configured)`);
    return;
  }

  const board = await fetchLeaderboard("global", { limit: 48 });
  const byId = new Map(board.entries.map((entry) => [entry.content.id, entry]));
  const leader = board.entries[0];
  let sent = 0;
  let skipped = 0;

  for (const subscription of subscriptions) {
    const watched = subscription.entityId ? byId.get(subscription.entityId) : leader;
    if (!watched) { skipped++; continue; }
    if (!subscription.lastNotifiedContentId) {
      await repos.subscription.markNotified(subscription.id, watched.rank, watched.content.id);
      skipped++;
      continue;
    }
    if (subscription.lastNotifiedRank === watched.rank && subscription.lastNotifiedContentId === watched.content.id) {
      skipped++;
      continue;
    }

    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const unsubscribe = stableUnsubscribeToken(subscription.scopeKey).raw;
    const unsubscribeUrl = `${appUrl}/api/subscribe/unsubscribe?token=${unsubscribe}`;
    const subject = `${watched.content.title} moved to #${watched.rank} on OUTRANK`;
    const title = escapeHtml(watched.content.title);
    try {
      await sendResendEmail({
        to: subscription.email,
        subject,
        text: `${watched.content.title} is now ranked #${watched.rank}.\n\nUnsubscribe: ${unsubscribeUrl}`,
        html: `<p><strong>${title}</strong> is now ranked <strong>#${watched.rank}</strong> on OUTRANK.</p><p><a href="${unsubscribeUrl}">Unsubscribe</a></p>`,
      });
      await repos.subscription.markNotified(subscription.id, watched.rank, watched.content.id);
      sent++;
    } catch (error) {
      captureServerError("worker.notification_failed", error, { subscriptionId: subscription.id });
    }
  }
  console.log(`[worker] notification delivery: ${sent} sent, ${skipped} skipped`);
}

// ---- Scheduler ----
function schedule(name: string, fn: () => Promise<void>, intervalMs: number) {
  const run = async () => {
    const start = Date.now();
    await fn();
    const dur = Date.now() - start;
    console.log(`[worker] ${name} done in ${dur}ms`);
  };
  // run immediately, then on interval
  run();
  setInterval(run, intervalMs);
}

schedule("ranking-recalc", jobRankingRecalc, 5 * 60 * 1000);      // every 5 min
schedule("metric-refresh", jobMetricRefresh, 2 * 60 * 1000);      // every 2 min
schedule("moderation-review", jobModerationReview, 10 * 60 * 1000); // every 10 min
schedule("payment-reconciliation", jobPaymentReconciliation, 5 * 60 * 1000);
schedule("retry-dead-letter", jobRetryDeadLetter, 15 * 60 * 1000);
schedule("notification-delivery", jobNotificationDelivery, 2 * 60 * 1000);
schedule("session-cleanup", jobSessionCleanup, 24 * 60 * 60 * 1000); // daily

// tiny HTTP health endpoint
const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "outrank-worker" }));
});

const PORT = 3005;
httpServer.listen(PORT, () => {
  console.log(`OUTRANK background worker running on port ${PORT}`);
});

process.on("SIGTERM", () => httpServer.close(() => process.exit(0)));
process.on("SIGINT", () => httpServer.close(() => process.exit(0)));
