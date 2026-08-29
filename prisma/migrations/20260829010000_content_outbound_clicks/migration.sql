-- Track outbound clicks per content item (clicks through /api/go/[id]).
ALTER TABLE "Content" ADD COLUMN "outboundClicks" INTEGER NOT NULL DEFAULT 0;
