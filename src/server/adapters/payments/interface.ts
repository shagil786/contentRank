// PaymentProvider interface. Payments are accessed ONLY through this.
// Dodo is one implementation. Stripe/Razorpay/etc. would be another.

export interface CreateCheckoutInput {
  amount: number;          // cents
  currency: string;        // "usd"
  contentId: string;       // what the bid is for
  bidId: string;           // the SponsoredBid id
  idempotencyKey: string;  // replay protection
  successUrl: string;
  cancelUrl: string;
  description: string;
  mode?: "live" | "test";
  analyticsDistinctId?: string;
  analyticsSessionId?: string;
  analyticsFlow?: "initial_bid" | "defend";
}

export interface CreateCheckoutResult {
  paymentId: string;       // internal payment id
  checkoutUrl: string;     // redirect the user here
  providerPaymentId?: string;
}

export class CheckoutCreationError extends Error {
  constructor(message: string, readonly paymentId?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CheckoutCreationError";
  }
}

export interface WebhookPayload {
  providerPaymentId?: string;
  internalPaymentId?: string;
  event_id: string;        // for dedup
  eventType: string;
  status: "succeeded" | "failed" | "refunded" | "disputed" | "ignored";
  amount: number;
  refundAmount?: number;
  isPartialRefund?: boolean;
  disputeId?: string;
  disputeStatus?: string;
  disputeStage?: string;
  currency: string;
  customerEmail?: string;
  analyticsDistinctId?: string;
  analyticsSessionId?: string;
  analyticsFlow?: "initial_bid" | "defend";
  raw: Record<string, unknown>;
}

export interface PaymentSnapshot {
  providerPaymentId: string;
  status: "initiated" | "succeeded" | "failed";
  amount: number;
  refundedAmount: number;
  currency: string;
  customerEmail?: string;
  analyticsDistinctId?: string;
  analyticsSessionId?: string;
  analyticsFlow?: "initial_bid" | "defend";
}

export interface WebhookVerification {
  ok: boolean;
  payload: WebhookPayload | null;
  reason?: string;
}

export interface WebhookSignatureHeaders {
  id: string | null;
  signature: string | null;
  timestamp: string | null;
}

export interface PaymentProvider {
  readonly name: "dodo" | "stripe" | "stub";
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  retrievePayment(providerPaymentId: string, mode: "live" | "test"): Promise<PaymentSnapshot>;
  verifyWebhook(rawBody: string, headers: WebhookSignatureHeaders): Promise<WebhookVerification>;
}
