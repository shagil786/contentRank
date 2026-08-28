import posthog from "posthog-js";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

if (token) {
  posthog.init(token, {
    api_host: host,
    defaults: "2026-05-30",
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: true,
    opt_out_capturing_by_default: localStorage.getItem("outrank_analytics_consent") !== "granted",
    person_profiles: "identified_only",
    tracing_headers: ["content-rank.lol", "localhost", "127.0.0.1"],
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "*",
      maskCapturedNetworkRequestFn: (request) => {
        if (request.name) request.name = request.name.split("?")[0];
        return request;
      },
    },
  });
}
