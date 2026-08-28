# OUTRANK — Technical Gaps

A comprehensive inventory of every known technical gap in the OUTRANK project.
Each item is described with: **what's missing today**, **why it matters**, and
**the concrete next step to close it**. Items are grouped by category and ordered
roughly by production-readiness priority within each group.

The codebase today is a working prototype: real layered backend (API → application →
domain → repositories → Prisma), realtime engine, and editorial frontend. The gaps
below are what stand between "working prototype" and "production marketplace".

---

## 1. Infrastructure

### 1.1 SQLite instead of PostgreSQL — resolved locally 2026-08-24
- **Resolved**: Prisma now uses PostgreSQL, with a reproducible Docker setup in `compose.yaml`, a local Postgres instance on port 5433, and the app services running against it.
- **Migration note**: production still requires a managed Postgres provider and secret-managed `DATABASE_URL`; the local container is the development/staging baseline.

### 1.2 Shared Redis for rate limits/idempotency and Socket.IO — resolved for one-instance launch 2026-08-27
- **Resolved**: rate limits and idempotency use Redis when configured, Socket.IO uses the Redis adapter, and PostgreSQL settled bids are the only authority for rank and money. Realtime hydrates from and invalidates the canonical API; it no longer simulates or mutates backing.
- **Remaining scale concern**: presence and recent activity are process-local. This affects watcher counts only when multiple realtime replicas are introduced; it cannot change durable rank or dollars.

### 1.3 Same-origin image proxy and caching — partially resolved 2026-08-24
- **Resolved**: remote `og:image` URLs now flow through `/api/image`, which validates
  the target scheme/host, enforces image content type and a 5 MB limit, and returns
  cache headers for same-origin reuse. `Poster.tsx` still falls back to its deterministic
  SVG poster if the proxy fails.
- **Remaining**: images are not yet copied into durable object storage or served by a
  dedicated production CDN.
- **Why it matters**: hot-linking remote images still couples the first proxy fetch to
  the source site's CDN, while replicas do not share a durable image asset.
- **Next step**: fetch and store approved images in object storage (S3/R2 or equivalent)
  at submit time, then serve immutable resized variants through a production CDN.

### 1.4 Horizontal scaling and realtime ownership — deferred scale enhancement
- **Resolved**: PostgreSQL is canonical, Redis broadcasts invalidations, and synthetic backing/rank mutation has been removed. A realtime replica cannot overwrite the paid board.
- **Remaining**: the current cheapest deployment is one EC2 instance in one region. Multi-instance presence aggregation, load balancing, and cross-region failover remain future reliability work, not correctness requirements for the MVP.

---

## 2. Data & Persistence

### 2.1 Automatic score decay — intentionally removed 2026-08-27
- **Decision**: paid backing never changes by timer or simulator. All Time sums remaining settled bid value; Today sums bids settled since local day start. Refunds are the only operation that reduces paid backing.

### 2.2 Cursor pagination on leaderboard — resolved 2026-08-27
- **Resolved**: PostgreSQL performs stable keyset ranking by remaining settled bid value, creation time, and ID. The API returns bounded pages and the frontend loads additional pages through infinite scrolling.

### 2.3 No data migration strategy — resolved 2026-08-24
- **Resolved**: PostgreSQL is now managed through the checked-in `prisma/migrations/20260823234548_init/migration.sql` baseline. Deployments should use `prisma migrate deploy`; `db push` is no longer the production path.
- **Why it matters**: the moment there's real user data (emails, claims, payments),
  `db push` becomes dangerous — it can silently drop columns. Production deploys
  need forward-only migrations with review, rollback, and a changelog.
- **Next step**: add migration review and `prisma migrate deploy` to the production release pipeline.

### 2.4 Backup/restore process — partially resolved 2026-08-24
- **Resolved**: `bin/backup-postgres.sh` creates a timestamped PostgreSQL custom-format
  dump, SHA-256 checksum, and manifest. `bin/restore-postgres.sh` verifies the checksum
  when present and requires `CONFIRM_RESTORE=YES` before the destructive restore.
- **Remaining**: production still needs managed daily snapshots, point-in-time recovery,
  offsite retention, and a scheduled staging restore drill.
- **Why it matters**: accidental deletion or a bad migration must not lose submitted
  entities, boosts, payment records, or audit history.
- **Next step**: connect the backup script to encrypted object storage or managed
  PostgreSQL backups and rehearse the restore procedure quarterly in staging.

---

## 3. Security

### 3.1 Authentication — intentionally deferred
- **Decision**: OUTRANK remains an anonymous attention-market experience for the current
  project scope. The existing lightweight PostgreSQL session identifies a browser session
  for rate limiting and audit attribution; no frontend login or backend auth provider is
  required.
- **Why this is acceptable now**: browsing, boosting, content submission, realtime
  participation, and email subscriptions do not require persistent user identity.
- **Future trigger**: revisit authentication only if the product adds verified ownership,
  saved user history, account administration, or payment ownership that must survive
  across devices.

### 3.2 Anti-sybil protection — partially resolved 2026-08-24
- **Resolved**: all abuse-sensitive API limits now key by client IP in the Redis-backed
  token bucket, with anonymous session IDs retained only as a fallback when no network
  address is available. Rotating anonymous sessions therefore does not bypass the
  normal write limits.
- **Remaining**: IP rotation, botnets, and automated paid activity are not fully
  addressed. The product intentionally does not impose a daily HYPE allowance or
  require login/CAPTCHA at this stage.
- **Why it matters**: the leaderboard is the product, so manufactured activity can
  reduce trust even when request-rate limits are working.
- **Next step**: add graduated bot detection and payment-risk controls if abuse appears
  in real traffic; only introduce CAPTCHA or identity-based quotas when the product
  requires that tradeoff.

### 3.3 Webhook signature verification — resolved 2026-08-27
- **Resolved**: `src/server/adapters/payments/dodo.ts` verifies Dodo's Standard Webhooks ID, timestamp, raw body, and versioned signature with `standardwebhooks`, including replay-window enforcement. It accepts separately configured test and live signing secrets and rejects missing, stale, or invalid signatures.
- **Operational requirement**: `DODO_WEBHOOK_SECRET` must be supplied through secret
  management in every deployed environment; it is never committed to source.

### 3.4 Same-origin CSRF checks — partially resolved 2026-08-24
- **Resolved**: `prepareApiContext` rejects mutating API requests with a mismatched
  `Origin` or `Referer` using HTTP 403. Requests with no browser navigation header
  remain valid for the realtime and worker server-to-server calls. The current product
  has no authenticated cookies, so this is the appropriate lightweight boundary.
- **Remaining**: if cookie-based authentication is introduced later, add secure
  `SameSite` cookies and a token-based CSRF defense for sensitive actions.
- **Why it matters**: a malicious site should not be able to use a visitor's browser
  context to submit API mutations to OUTRANK.

### 3.5 Plain-text input/XSS hardening — partially resolved 2026-08-24
- **Resolved**: the source audit found no user-controlled `dangerouslySetInnerHTML`;
  React escapes rendered text, generated poster SVG text is not injected as markup,
  and external links are scheme-validated. Persisted titles, blurbs, claim names, and
  moderation reasons now remove control characters and enforce length bounds through
  `plainText` normalization.
- **Remaining**: a production CSP and a dedicated rich-text sanitizer remain future
  work if the product ever accepts HTML/Markdown content.
- **Why it matters**: defense-in-depth prevents control-character payloads from
  reaching attributes, logs, or downstream renderers while keeping content plain text.
- **Next step**: add CSP headers and a vetted sanitizer only when rich text is introduced.

### 3.6 IP rate limiting on content submission — resolved 2026-08-24
- **Resolved**: `/api/content` uses the Redis-backed `submit` token bucket (10/min),
  and `prepareApiContext` keys it by client IP before falling back to an anonymous
  session only when no address is available. The same boundary protects claim and
  subscription routes with their tighter presets.
- **Follow-up**: adjust capacities or add graduated bot detection from observed traffic;
  this is complementary to the broader anti-sybil controls in 3.2.

---

## 4. Real Platform Integrations

### 4.1 OpenGraph fetcher is the only real integration
- **Today**: `src/lib/outrank/og.ts` fetches the submitted URL, parses `<meta>` tags,
  and extracts `og:title` / `og:image` / `og:description`. This works for any URL
  but only returns what the source site chooses to expose — no engagement metrics,
  no real view counts, no follower counts.
- **Why it matters**: the leaderboard's metric layer (`Metric` model in Prisma) is
  designed to hold real platform engagement data (views, likes, comments, shares).
  Without real API integrations, every `Metric` row is a stub and the ranking is
  purely boost-driven (no signal from actual platform traction).

### 4.2 YouTube Data API — partially resolved 2026-08-24
- **Resolved**: the registered YouTube adapter optionally calls the official
  `videos.list` endpoint with `part=statistics` and maps public view, like, and comment
  counts into the existing metric contract. Missing credentials, channel keys, API
  failures, and timeouts safely return no metric.
- **Remaining**: configure `YOUTUBE_API_KEY` in deployment secrets and add shared
  caching/quota accounting before enabling broad refreshes.
- **Why it matters**: YouTube is a major content source; official metrics provide a
  real engagement signal beyond OpenGraph metadata.
- **Next step**: add Redis metric caching and quota-aware scheduling, then cover
  Instagram/TikTok only when their official access requirements are satisfied.

### 4.3 Instagram Graph API
- **Today**: `src/server/adapters/platforms/instagram.ts` parses URLs (post, reel,
  profile) but doesn't call the Graph API.
- **Why it matters**: Instagram content has real like/comment counts that would
  feed the ranking.
- **Next step**: requires a Facebook app + business account verification (Instagram
  Graph API is gated). Implement `fetchMetrics` calling `/{media-id}?fields=like_count,comments_count`.
  Higher friction than YouTube — defer until the platform mix justifies it.

### 4.4 TikTok Research API
- **Today**: `src/server/adapters/platforms/tiktok.ts` parses URLs only.
- **Why it matters**: TikTok is a top-3 platform for the target audience but
  their API is the most restrictive.
- **Next step**: apply for TikTok Research API access (requires academic /
  registered research org status). Until then, no real metrics from TikTok —
  acceptable for prototype, blocking for production.

### 4.5 Spotify Web API
- **Today**: no Spotify adapter exists in `src/server/adapters/platforms/`.
- **Why it matters**: songs/albums are a content kind in the schema and a category
  in the UI, but Spotify URIs can't be parsed for real play counts.
- **Next step**: add `src/server/adapters/platforms/spotify.ts`, register a Spotify
  client (Client Credentials flow — no user context needed for public track data),
  implement `fetchMetrics` calling `https://api.spotify.com/v1/tracks/{id}` for
  popularity score. Register the adapter in `src/server/adapters/platforms/index.ts`.

### 4.6 Steam Web API
- **Today**: no Steam adapter exists.
- **Why it matters**: `game` is a content kind and `games` is a category, but Steam
  games have no real concurrent-player or review data feeding the rank.
- **Next step**: add `src/server/adapters/platforms/steam.ts`, register a Steam
  Web API key, implement `fetchMetrics` calling
  `ISteamUserStats/GetNumberOfCurrentPlayers` and `appreviews/get` for review
  sentiment. Register the adapter.

### 4.7 TMDB API (for movies/TV)
- **Today**: no TMDB adapter exists. Movies and TV are submitted via Letterboxd /
  IMDB URLs and ranked purely by boosts.
- **Why it matters**: `movies` and `tv` are categories, and TMDB exposes real
  vote counts, popularity scores, and release dates that would make the rankings
  more authoritative.
- **Next step**: add `src/server/adapters/platforms/tmdb.ts`, register a TMDB API
  key, implement `fetchMetrics` calling `/movie/{id}` and `/tv/{id}` for
  `vote_count` / `popularity`. Register the adapter.

### 4.8 Metric refresh worker — partially resolved 2026-08-24
- **Resolved**: the scheduled worker now looks up each registered adapter, calls its
  optional `fetchMetrics`, writes successful results to `Metric`, and isolates failures
  per content so one provider cannot abort the batch. It reports updated, skipped, and
  failed counts. The five-item batch remains a quota-safe prototype guard.
- **Remaining**: rotate through all content instead of always selecting the first five,
  add per-platform Redis quota/rate limiting, and persist `lastFetchedAt` for durable
  scheduling across worker restarts.
- **Next step**: add a metric-refresh cursor and Redis quota budget, then increase the
  batch only for providers with configured official credentials.

---

## 5. Payment

### 5.1 Dodo checkout — code complete; merchant activation external (2026-08-27)
- **Resolved**: test/live credentials and products are isolated, variable USD bids use hosted checkout, return URLs carry no customer/payment details, and only verified webhooks publish or rank content. Test checkout and webhook flows have been exercised.
- **External**: live checkout remains intentionally blocked until Dodo completes merchant activation. No code workaround is appropriate.

### 5.2 Idempotency on bid creation — resolved 2026-08-24
- **Resolved**: `/api/bids/checkout` now caches retries with `withIdempotency`, passes the caller's `Idempotency-Key` into the application service, and checks the unique `SponsoredBid.idempotencyKey` in the database before creating a new bid.
- **Verification**: the database-backed lookup protects retries across separate application workers; the in-process in-flight map protects concurrent duplicate requests within one worker.

### 5.3 Refund accounting and reconciliation — resolved 2026-08-27
- **Resolved**: verified `refund.succeeded` events retrieve the current Dodo payment and apply the cumulative successful refund amount. Partial refunds proportionally reduce backing; full refunds remove the bid. Operations are absolute/idempotent, audited, broadcast, and covered by integration tests.
- **Resolved**: the worker polls old initiated payments and periodically rechecks successful payments through `GET /payments/{payment_id}`, recording attempts and errors so missed success/refund webhooks converge.
- **Operational decision**: refunds are initiated in the authenticated Dodo dashboard because OUTRANK intentionally has no admin accounts. A public refund API would be unsafe without administrator identity.

### 5.4 Payment dispute handling — resolved 2026-08-27
- **Resolved**: all seven Dodo dispute events are signature-verified and durably
  deduplicated. Open, challenged, expired, accepted, and lost disputes suspend the
  entire bid from paid backing; won and cancelled disputes retrieve the authoritative
  Dodo payment and restore only verified non-refunded backing.
- **Operations**: every transition is audited, broadcast, captured in PostHog, and
  optionally emailed through Resend. `ops/DODO_DISPUTE_RUNBOOK.md` defines the manual
  dashboard response and escalation process.

---

## 6. Realtime

### 6.1 Socket.IO Redis adapter — resolved 2026-08-27
- **Resolved**: the realtime service uses `@socket.io/redis-adapter`. PostgreSQL remains authoritative and Redis carries cross-instance invalidation/broadcast events.

### 6.2 Reconnection state sync — partially resolved 2026-08-24
- **Resolved**: the client tracks the latest event timestamp and requests `state.sync`
  with `{ since }` after every socket connection. The realtime service responds with
  an authoritative bounded snapshot plus activity events observed after that watermark.
- **Remaining**: rank deltas are not yet replayed individually; the snapshot is the
  consistency boundary. Durable event history in PostgreSQL/Redis is needed for exact
  replay across long disconnects.
- **Why it matters**: reconnecting users now converge to current ranks and recent
  activity instead of depending only on live events that occurred while offline.
- **Next step**: persist rank-event history and replay compact deltas for long gaps.

### 6.3 Realtime boost backpressure — partially resolved 2026-08-24
- **Resolved**: rank updates are coalesced per entity into a 100 ms broadcast window.
  The first previous rank/score and latest rank/score are preserved, while boost
  acknowledgements remain immediate for the source socket.
- **Remaining**: activity events are still emitted individually, and client rendering
  is not explicitly frame-debounced.
- **Why it matters**: high-velocity boosts should not force every connected client to
  process one rank event per boost.
- **Next step**: batch activity events and debounce visible leaderboard updates to one
  animation frame under sustained bursts.

---

## 7. Frontend

### 7.1 Leaderboard virtualization — deferred with bounded infinite scroll
- **Resolved**: the API and frontend use bounded cursor pages, and an intersection
  observer loads additional pages without a full-page reload.
- **Remaining scale enhancement**: accumulated rows are not virtualized. Add
  `@tanstack/react-virtual` only after real board size makes DOM growth measurable,
  preserving the animated top-three treatment.

### 7.2 SSR leaderboard data — partially resolved (2026-08-24)
- **Resolved**: `src/app/page.tsx` is now a dynamic server component. It fetches
  the first 48 leaderboard entities server-side and passes the result to
  `src/app/HomeClient.tsx` as TanStack Query `initialData`.
- **Resolved**: the initial HTML contains real leaderboard content rather than
  only the loading skeleton. A live `curl /` smoke check returned HTTP 200 and
  found a seeded entity name in the HTML.
- **Still open**: the interactive client shell still hydrates in the browser,
  TanStack Query may refetch after hydration, and per-entity
  `generateMetadata`/OG tags for `?e=<slug>` are not implemented yet.

### 7.3 PWA / offline support — partially resolved (2026-08-24)
- **Resolved**: added `public/manifest.webmanifest` with OUTRANK branding,
  standalone display mode, theme color, and install icon.
- **Resolved**: added a small production-only service worker in `public/sw.js`.
  It uses network-first behavior for navigation and `/api/leaderboard`, then
  falls back to the cached shell or last-known leaderboard response offline.
- **Resolved**: `PwaRegister` registers the worker without affecting local
  development or normal app behavior when service workers are unavailable.
- **Still open**: offline mutations are intentionally not queued, and the
  service worker should receive a broader device/browser compatibility test
  before being treated as a production offline guarantee.

### 7.4 Accessibility — partially resolved (2026-08-24)
- **Resolved**: leaderboard rows and the top-three cards can now receive focus
  and open details with Enter or Space, with visible focus outlines and labels
  identifying the entity and rank.
- **Resolved**: category and timeframe controls expose their selected state via
  `aria-pressed`; live activity feeds expose polite live regions.
- **Still open**: run axe-core in CI, complete a contrast audit for muted
  typography, add arrow-key movement if the leaderboard becomes a roving-focus
  interaction, and verify nested row controls with a screen reader.

### 7.5 Error boundaries — partially resolved (2026-08-24)
- **Resolved**: `ErrorBoundary` isolates the leaderboard section and offers a
  branded retry without unmounting the rest of the page.
- **Resolved**: `src/app/error.tsx` catches route-level render errors and offers
  both Next.js segment recovery and a full page reload.
- **Still open**: modal-level boundaries can be added if modal components become
  independently shipped features; the route-level fallback remains the final
  safety net for those dialogs.

---

## 8. Observability

### 8.1 Structured logging — partially resolved (2026-08-24)
- **Resolved**: `src/server/infrastructure/logger.ts` emits JSON log entries with
  timestamp, level, service, event, request ID, method, path, status, session ID,
  and duration when responses use the shared `jsonResponse` helper.
- **Resolved**: CSRF and rate-limit rejections are emitted as structured warning
  events, and audit write failures now carry their request ID.
- **Still open**: direct `NextResponse.json` routes need to migrate to the shared
  response helper for complete end-to-end request coverage; worker/realtime logs
  should adopt the same logger contract later.

### 8.2 Metrics/monitoring — partially resolved (2026-08-24)
- **Resolved**: `/metrics` now exposes Prometheus-compatible request counters,
  duration buckets, request count, and process uptime without adding a runtime
  dependency.
- **Resolved**: completed requests using `jsonResponse` are recorded by route
  and status through the structured logging lifecycle.
- **Still open**: direct response routes, realtime/worker gauges, and a hosted
  Prometheus/Grafana or Datadog deployment are not configured yet.

### 8.3 Error tracking — resolved for the low-cost launch baseline
- **Resolved**: server failures can now use a central `captureServerError`
  seam that emits structured error events with safe error details and request
  context, without logging request bodies or credentials.
- **Resolved**: leaderboard fallback failures are captured with their request ID
  before returning the stale/empty fallback response.
- **Decision**: paid Sentry integration is intentionally deferred. Structured server
  logs, trace IDs, health checks, and PostHog product events are the launch baseline;
  add a hosted exception tracker when traffic or incident volume justifies it.

### 8.4 Request tracing — partially resolved (2026-08-24)
- **Resolved**: API requests now accept or generate a validated trace ID,
  propagate it through `RequestContext`, include it in structured request logs,
  and return it as `X-Trace-Id` on shared API responses.
- **Resolved**: request IDs and trace IDs remain separate, allowing one trace to
  contain multiple request attempts while preserving idempotency correlation.
- **Still open**: full OpenTelemetry spans for Prisma, application services,
  realtime broadcasts, and an external trace collector are deployment work.

---

## 9. Product

### 9.1 No public user accounts — intentional product decision
- **Decision**: OUTRANK has no signup/login flow. Paid bids are authorized by Dodo,
  and the payment email is subscribed server-side to movement notifications with an
  unsubscribe token. Anonymous submission convenience is preferred over account
  continuity for launch.
- **Future trigger**: add identity only if durable claims, bidder history, or a human
  moderation/admin surface becomes a validated product requirement.

### 9.2 Notification system — partially resolved (2026-08-24)
- **Resolved**: `POST /api/subscribe` validates and durably persists global or
  entity-scoped subscriptions in PostgreSQL, deduplicated by `scopeKey`.
- **Resolved**: subscriptions now receive hashed confirmation and unsubscribe
  tokens, with `/api/subscribe/confirm` and `/api/subscribe/unsubscribe`
  endpoints. Tokens are never stored in plaintext.
- **Resolved**: the Resend REST adapter sends confirmation email when
  `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are configured; local environments
  remain safe and explicit when delivery is not configured.
- **Resolved**: the worker now checks confirmed subscriptions every two minutes,
  compares watched ranks against stored notification state, sends movement
  emails through Resend, and advances state only after a successful send.
- **Still open**: production delivery requires a verified Resend sender and a
  long-running worker deployment; global subscriptions currently track the
  board leader while entity subscriptions track their selected entity.

### 9.3 Entity editing — partially resolved (2026-08-24)
- **Resolved**: `PATCH /api/content/:id` validates title, blurb, and link edits,
  restricts them to the original anonymous submitter session within 24 hours,
  and rejects edits after that window.
- **Resolved**: edits are persisted through the repository boundary and audited
  with changed fields plus before/after values; the existing edit dialog is wired
  to the endpoint and refreshes the board after success.
- **Still open**: realtime `entity.updated` broadcast, a moderation/admin edit
  path, and editing category/kind/image metadata remain deferred.

### 9.4 Moderation queue UI — deferred by scope
- **Current state**: anonymous users can submit reports through
  `/api/moderation`; the worker auto-resolves stale reports. There is no human
  moderation UI.
- **Reason for deferral**: moderation actions require authenticated admin
  identity and authorization, which is intentionally out of scope after the
  decision to remove login.
- **Next step**: revisit alongside an admin identity system; do not expose the
  queue or destructive actions publicly.

### 9.5 Admin dashboard — deferred by scope
- **Current state**: there is no admin surface; operational inspection uses
  protected server/database tooling.
- **Reason for deferral**: an admin dashboard without authentication and role
  checks would create a public destructive control plane.
- **Next step**: revisit only if admin identity, authorization, and audit policy
  are brought back into project scope.

---

## Priority Order (suggested)

The remaining work should be tackled in this order:

1. **Dodo merchant activation and one live smoke payment** — external launch gate;
   keep production checkout blocked until Dodo enables the account.
2. **Production configuration and deployment verification** — provide the PostHog
   token, Dodo live secrets, Resend secrets, Redis, and database URL through runtime
   secret management; then verify health, migrations, webhook delivery, and rollback.
3. **1.4 Reliability** — introduce multi-instance/cross-region failover when traffic
   or the uptime target justifies moving beyond the cheapest single-instance launch.
4. **Accessibility and platform-metadata depth** — axe/screen-reader verification,
   richer per-entity metadata, and measured virtualization/platform refresh work.

---

*This document is a snapshot of the project's known gaps as of the current
worklog entry. It should be updated whenever a gap is closed or a new gap is
discovered. Each closed item should be moved to a "Resolved" section at the
bottom with the date and the PR that closed it.*
