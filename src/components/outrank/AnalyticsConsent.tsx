"use client";

import { useSyncExternalStore } from "react";
import posthog from "posthog-js";
import { analyticsConfigured } from "@/lib/analytics/client";
import Link from "next/link";

type Consent = "loading" | "unknown" | "granted" | "denied";

function readConsent(): Consent {
  const saved = localStorage.getItem("outrank_analytics_consent");
  return saved === "granted" ? "granted" : saved === "denied" ? "denied" : "unknown";
}

function subscribeConsent(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("outrank-analytics-consent", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("outrank-analytics-consent", onChange);
  };
}

export function AnalyticsConsent() {
  const consent = useSyncExternalStore(subscribeConsent, readConsent, () => "loading");

  if (!analyticsConfigured() || consent !== "unknown") return null;

  const choose = (next: Exclude<Consent, "unknown">) => {
    localStorage.setItem("outrank_analytics_consent", next);
    if (next === "granted") {
      posthog.opt_in_capturing();
      posthog.startSessionRecording();
      posthog.capture("analytics_consent_granted");
      posthog.capture("$pageview");
    } else {
      posthog.stopSessionRecording();
      posthog.opt_out_capturing();
    }
    window.dispatchEvent(new Event("outrank-analytics-consent"));
  };

  return (
    <aside className="fixed bottom-3 left-3 right-3 z-[100] border border-ink bg-paper p-3 shadow-[4px_4px_0_#0b0b0b] sm:left-auto sm:max-w-md" aria-label="Analytics preference">
      <p className="font-mono text-[10px] leading-relaxed tracking-wider text-ink">
        ALLOW ANONYMOUS USAGE ANALYTICS? INPUTS AND PAGE TEXT ARE MASKED IN REPLAYS.
      </p>
      <Link href="/privacy" className="mt-1 inline-block font-mono text-[9px] tracking-widest text-muted-foreground underline underline-offset-2 hover:text-signal">
        PRIVACY DETAILS
      </Link>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => choose("granted")} className="flex-1 bg-ink px-3 py-2 font-mono text-[10px] tracking-widest text-paper hover:bg-signal">
          ALLOW
        </button>
        <button type="button" onClick={() => choose("denied")} className="flex-1 border border-ink/30 px-3 py-2 font-mono text-[10px] tracking-widest text-ink hover:border-ink">
          NO THANKS
        </button>
      </div>
    </aside>
  );
}
