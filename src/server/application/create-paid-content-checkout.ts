import { submitContent } from "./submit-content";
import { createSponsoredBid } from "./create-sponsored-bid";
import type { RequestContext } from "../infrastructure/request-context";
import type { ContentKind, Category } from "../domain/types";
import { container } from "./container";

export interface CreatePaidContentCheckoutInput {
  url?: string;
  title: string;
  kind?: ContentKind;
  category?: Category;
  blurb?: string;
  sub?: string;
  amount: number;
  currency?: string;
  successUrl?: string;
  cancelUrl?: string;
  idempotencyKey?: string;
  testMode?: boolean;
  analyticsDistinctId?: string;
  analyticsSessionId?: string;
}

export async function createPaidContentCheckout(input: CreatePaidContentCheckoutInput, ctx: RequestContext) {
  const contentResult = await submitContent({
    url: input.url,
    title: input.title,
    kind: input.kind,
    category: input.category,
    blurb: input.blurb,
    sub: input.sub,
    status: "pending",
  }, ctx);
  if (!contentResult.ok || !contentResult.content) return contentResult;

  const successUrl = input.successUrl
    ? `${input.successUrl}${input.successUrl.includes("?") ? "&" : "?"}entityId=${encodeURIComponent(contentResult.content.id)}`
    : undefined;
  try {
    const bid = await createSponsoredBid({
      contentId: contentResult.content.id,
      amount: input.amount,
      currency: input.currency,
      successUrl,
      cancelUrl: input.cancelUrl,
      idempotencyKey: input.idempotencyKey,
      testMode: input.testMode,
      analyticsDistinctId: input.analyticsDistinctId,
      analyticsSessionId: input.analyticsSessionId,
      analyticsFlow: "initial_bid",
    }, ctx);
    return { ...bid, contentId: contentResult.content.id };
  } catch (error) {
    if (!contentResult.flags?.includes("duplicate")) {
      await container.repos.content.updateStatus(contentResult.content.id, "removed").catch(() => undefined);
    }
    throw error;
  }
}
