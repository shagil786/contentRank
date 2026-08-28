# Dodo dispute runbook

## Automated behavior

- Subscribe the production webhook to `dispute.opened`, `dispute.expired`,
  `dispute.accepted`, `dispute.cancelled`, `dispute.challenged`, `dispute.won`,
  and `dispute.lost`.
- Every delivery is signature-verified and deduplicated by `webhook-id`.
- `opened`, `challenged`, `expired`, `accepted`, and `lost` set the payment and bid
  to `disputed`, immediately excluding the bid from paid backing.
- `won` and `cancelled` retrieve the authoritative payment from Dodo and restore
  only the verified, non-refunded amount.
- Every transition is written to `AuditLog` and `PaymentWebhookEvent`, published
  to realtime clients, captured as `payment_dispute_updated` in PostHog, and sent
  to `DISPUTE_ALERT_EMAIL` when Resend is configured.

## Operator response

1. Open the dispute in the authenticated Dodo dashboard from the alert.
2. Confirm the payment ID, amount, deadline, reason, and evidence requirements.
3. For `dispute.opened`, submit evidence or accept the dispute before Dodo's
   displayed deadline. Do not edit payment or ranking rows manually.
4. Confirm OUTRANK received the subsequent `challenged`, `accepted`, `won`,
   `lost`, or `cancelled` webhook with HTTP 200.
5. Confirm the payment and bid statuses match the event and the leaderboard no
   longer includes disputed backing unless the dispute was won or cancelled.
6. If delivery failed, redeliver the event from Dodo. Deduplication makes this
   safe. If Dodo cannot redeliver, run payment reconciliation before any manual
   database action.

## Escalation

- Webhook HTTP 401: verify the matching live/test signing secret.
- Webhook HTTP 400 `no_payment`: compare the Dodo `payment_id` to
  `Payment.providerPaymentId`; do not fabricate a mapping.
- Alert email unavailable: inspect structured logs and `AuditLog`; payment/rank
  state remains durable even when email delivery fails.
- Unexpected state after a terminal event: stop checkout deployment changes,
  preserve the payload/event ID, and reconcile the payment against Dodo.
