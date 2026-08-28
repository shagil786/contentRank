CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentWebhookEvent_eventId_key"
ON "PaymentWebhookEvent"("eventId");

CREATE INDEX "PaymentWebhookEvent_paymentId_processedAt_idx"
ON "PaymentWebhookEvent"("paymentId", "processedAt");

CREATE INDEX "PaymentWebhookEvent_eventType_processedAt_idx"
ON "PaymentWebhookEvent"("eventType", "processedAt");

ALTER TABLE "PaymentWebhookEvent"
ADD CONSTRAINT "PaymentWebhookEvent_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PaymentWebhookEvent" ("id", "eventId", "eventType", "paymentId", "processedAt")
SELECT CONCAT('legacy_', "id"), "webhookEventId", 'legacy.unknown', "id", "updatedAt"
FROM "Payment"
WHERE "webhookEventId" IS NOT NULL
ON CONFLICT ("eventId") DO NOTHING;
