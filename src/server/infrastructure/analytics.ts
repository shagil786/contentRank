import { PostHog } from "posthog-node";
import { logger } from "./logger";

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

export async function captureServerEvent(input: {
  distinctId: string;
  event: string;
  properties?: AnalyticsProperties;
}): Promise<void> {
  const token = process.env.POSTHOG_PROJECT_TOKEN || process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return;

  const client = new PostHog(token, {
    host: process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
    requestTimeout: 1_500,
    fetchRetryCount: 0,
    disableRemoteConfig: true,
    disableSurveys: true,
  });
  try {
    client.capture({
      distinctId: input.distinctId,
      event: input.event,
      properties: { ...input.properties, $process_person_profile: false },
    });
  } catch (error) {
    logger.warn("analytics.capture_failed", {
      event: input.event,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await client.shutdown().catch(() => undefined);
  }
}
