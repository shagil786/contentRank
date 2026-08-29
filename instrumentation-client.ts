import posthog from "posthog-js";

// Analytics init is consent-gated: PostHog only initializes for visitors who
// clicked ALLOW. The banner reloads the page on consent so this runs with
// capture enabled from the first byte. DENY never initializes PostHog.
const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";
const consent = typeof window !== "undefined" ? localStorage.getItem("outrank_analytics_consent") : null;

if (token && consent === "granted") {
  posthog.init(token, {
    api_host: host,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    person_profiles: "identified_only",
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "*",
    },
  });
}
