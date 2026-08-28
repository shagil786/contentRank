"use client";

import posthog from "posthog-js";

export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

export function analyticsConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN);
}

export function captureClientEvent(event: string, properties: AnalyticsProperties = {}): void {
  if (!analyticsConfigured() || posthog.has_opted_out_capturing()) return;
  posthog.capture(event, properties);
}

export function analyticsRequestHeaders(): Record<string, string> {
  if (!analyticsConfigured() || posthog.has_opted_out_capturing()) return {};
  const distinctId = posthog.get_distinct_id();
  const sessionId = posthog.get_session_id();
  return {
    ...(distinctId ? { "X-PostHog-Distinct-Id": distinctId } : {}),
    ...(sessionId ? { "X-PostHog-Session-Id": sessionId } : {}),
  };
}
