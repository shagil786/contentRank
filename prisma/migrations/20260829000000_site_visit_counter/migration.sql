-- Aggregate, non-personal site counters (all-time visits).
CREATE TABLE "SiteStat" (
    "key" TEXT NOT NULL,
    "value" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteStat_pkey" PRIMARY KEY ("key")
);
