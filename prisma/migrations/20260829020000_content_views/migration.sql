-- Track detail-page views per content item (onsite visitors, deduped per ip/day).
ALTER TABLE "Content" ADD COLUMN "views" INTEGER NOT NULL DEFAULT 0;
