// Repository interfaces (ports). The application layer depends on these, not on
// Prisma. Swapping SQLite → PostgreSQL is replacing the adapter implementation;
// the interfaces stay identical.

import type {
  Content, Creator, Metric, OrganicRanking, SponsoredBid,
  Payment, ModerationAction, AuditLog, Session,
  Subscription,
  Category, ContentStatus,
} from "../domain/types";

export interface ContentRepository {
  findById(id: string): Promise<Content | null>;
  findByCanonicalId(canonicalId: string): Promise<Content | null>;
  findByUrl(url: string): Promise<Content | null>;
  listByCategory(category: Category, status?: ContentStatus): Promise<Content[]>;
  listAll(status?: ContentStatus): Promise<Content[]>;
  insert(c: Omit<Content, "id" | "createdAt" | "updatedAt">): Promise<Content>;
  update(id: string, patch: Partial<Pick<Content, "title" | "blurb" | "url">>): Promise<Content>;
  updateStatus(id: string, status: ContentStatus): Promise<void>;
}

export interface CreatorRepository {
  findById(id: string): Promise<Creator | null>;
  findByPlatformHandle(platform: string, handle: string): Promise<Creator | null>;
  upsert(c: Omit<Creator, "id" | "createdAt"> & { id?: string }): Promise<Creator>;
}

export interface MetricRepository {
  append(m: Omit<Metric, "id" | "fetchedAt">): Promise<Metric>;
  latestForContent(contentId: string): Promise<Metric | null>;
}

export interface RankingRepository {
  // organic
  appendOrganicSnapshot(r: Omit<OrganicRanking, "id" | "snapshotAt">): Promise<OrganicRanking>;
  latestOrganicByCategory(category: Category): Promise<OrganicRanking[]>;
  rankedContentPage(input: {
    category: Category;
    timeframe: "today" | "alltime";
    limit: number;
    cursor?: { score: number; createdAt: Date; id: string };
  }): Promise<{ rows: Array<{ content: Content; score: number; backedCents: number; bidCount: number; momentum: number; rank: number }>; total: number; hasMore: boolean; nextCursor?: { score: number; createdAt: Date; id: string } }>;
  organicAtOrBefore(contentId: string, category: Category, at: Date): Promise<OrganicRanking | null>;
  organicHistory(contentId: string, limit: number, category?: Category): Promise<OrganicRanking[]>;
  // sponsored
  appendBid(b: Omit<SponsoredBid, "id" | "createdAt">): Promise<SponsoredBid>;
  findBidByIdempotencyKey(key: string): Promise<SponsoredBid | null>;
  findBidByPaymentId(paymentId: string): Promise<SponsoredBid | null>;
  updateBidStatus(id: string, status: SponsoredBid["status"], paymentId?: string, settledAt?: Date, refundedAmount?: number): Promise<void>;
  activeBidsByContent(contentId: string): Promise<SponsoredBid[]>;
}

export interface PaymentRepository {
  insert(p: Omit<Payment, "id" | "createdAt" | "updatedAt" | "refundedAmount" | "reconciliationAttempts" | "lastReconciledAt" | "lastReconciliationError"> & Partial<Pick<Payment, "refundedAmount">>): Promise<Payment>;
  findById(id: string): Promise<Payment | null>;
  findByProviderPaymentId(pid: string): Promise<Payment | null>;
  findByWebhookEventId(eid: string): Promise<Payment | null>;
  recordWebhookEvent(input: { eventId: string; eventType: string; paymentId: string }): Promise<void>;
  updateStatus(id: string, status: Payment["status"], providerPaymentId?: string, webhookEventId?: string): Promise<void>;
  updateAccounting(id: string, input: { status: Payment["status"]; refundedAmount: number; providerPaymentId?: string; webhookEventId?: string }): Promise<void>;
  listForReconciliation(input: { initiatedBefore: Date; recheckBefore: Date; limit: number }): Promise<Payment[]>;
  markReconciled(id: string, error?: string): Promise<void>;
}

export interface ModerationRepository {
  insert(m: Omit<ModerationAction, "id" | "createdAt">): Promise<ModerationAction>;
  listOpen(): Promise<ModerationAction[]>;
  resolve(id: string, status: ModerationAction["status"]): Promise<void>;
}

export interface AuditRepository {
  insert(a: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog>;
  listByTarget(targetType: AuditLog["targetType"], targetId: string): Promise<AuditLog[]>;
  recent(limit: number): Promise<AuditLog[]>;
}

export interface SessionRepository {
  findById(id: string): Promise<Session | null>;
  create(): Promise<Session>;
  touch(id: string, patch: Partial<Pick<Session, "handle" | "location" | "dailyHypeUsed">>): Promise<void>;
}

export interface SubscriptionRepository {
  upsert(input: Omit<Subscription, "id" | "createdAt"> & { id?: string }): Promise<Subscription>;
  confirmByTokenHash(tokenHash: string): Promise<Subscription | null>;
  deleteByUnsubscribeTokenHash(tokenHash: string): Promise<boolean>;
  listConfirmed(): Promise<Subscription[]>;
  markNotified(id: string, rank: number, contentId: string): Promise<void>;
}

// Idempotency — Redis-shaped (in-memory impl today, Redis impl tomorrow).
export interface IdempotencyStore {
  get<T>(key: string): Promise<{ value: T; storedAt: number } | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
}

// Aggregate, non-personal site counters (all-time visits). The value is a
// monotonically increasing total; no per-visitor rows are ever stored.
export interface SiteStatRepository {
  get(key: string): Promise<bigint>;
  increment(key: string, by?: number): Promise<bigint>;
}
