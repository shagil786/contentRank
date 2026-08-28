ALTER TABLE "SponsoredBid"
ADD COLUMN "refundedAmount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Payment"
ADD COLUMN "refundedAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'live',
ADD COLUMN "reconciliationAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastReconciledAt" TIMESTAMP(3),
ADD COLUMN "lastReconciliationError" TEXT;

CREATE INDEX "Payment_status_lastReconciledAt_idx"
ON "Payment"("status", "lastReconciledAt");
