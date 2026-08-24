"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import type { ActivityEvent } from "@/lib/outrank/types";
import { formatScore } from "@/lib/outrank/types";

interface Props {
  activity: ActivityEvent[];
  presence: number;
  fighting: number;
  variant?: "vertical" | "horizontal";
}

const timeAgo = (ts: number) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "NOW";
  if (s < 60) return `${s}S AGO`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}M AGO`;
  return `${Math.floor(m / 60)}H AGO`;
};

function EventLine({ ev }: { ev: ActivityEvent }) {
  const verb =
    ev.type === "took_one"
      ? "TOOK"
      : ev.type === "defended"
      ? "DEFENDED"
      : ev.type === "added"
      ? "ADDED"
      : "BOOSTED";
  const moved = ev.fromRank !== ev.toRank;
  return (
    <div className="flex items-center gap-3 font-mono text-[10px] sm:text-[11px] tracking-wide whitespace-nowrap px-4 sm:px-6 py-1.5 rule-r">
      <span className="text-signal font-semibold shrink-0">{verb}</span>
      <span className="text-ink font-semibold truncate max-w-[120px] sm:max-w-[180px] shrink-0">{ev.entityName}</span>
      {moved ? (
        <span className="text-ink/70 shrink-0">
          #{String(ev.fromRank).padStart(2, "0")}→#{String(ev.toRank).padStart(2, "0")}
        </span>
      ) : (
        <span className="text-muted-foreground">HOLD #{String(ev.toRank).padStart(2, "0")}</span>
      )}
      {ev.amount > 0 && <span className="text-up">+{formatScore(ev.amount)}</span>}
      <span className="text-muted-foreground hidden sm:inline">{ev.location}</span>
      <span className="text-muted-foreground">{timeAgo(ev.ts)}</span>
    </div>
  );
}

export function LiveTicker({ activity, presence, fighting, variant = "horizontal" }: Props) {
  // duplicate the list so the marquee can loop seamlessly
  const items = activity.slice(0, 40);
  const doubled = [...items, ...items];

  if (variant === "vertical") {
    return (
    <div className="flex flex-col" aria-live="polite" aria-label="Live activity feed">
        <div className="rule-b bg-ink text-paper px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest">
            <span className="inline-block w-2 h-2 bg-signal live-dot" /> LIVE FEED
          </div>
          <div className="font-mono text-[10px] tracking-widest text-paper/60">
            {presence} WATCHING {fighting > 0 && <>· {fighting} FIGHTING</>}
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto scroll-area-outrank">
          <AnimatePresence initial={false}>
            {items.map((ev) => (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="rule-b"
              >
                <EventLine ev={ev} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="rule-t rule-b bg-paper overflow-hidden flex items-center" aria-live="polite" aria-label="Live activity feed">
      <div className="shrink-0 bg-ink text-paper px-3 sm:px-4 py-2 flex items-center gap-2 font-mono text-[10px] tracking-widest rule-r">
        <span className="inline-block w-2 h-2 bg-signal live-dot" /> LIVE
        <span className="hidden sm:inline text-paper/50">·</span>
        <span className="hidden sm:inline text-paper/70">{presence} WATCHING</span>
      </div>
      <div className="relative flex-1 overflow-hidden">
        {items.length === 0 ? (
          <div className="px-4 py-2 font-mono text-[10px] tracking-widest text-muted-foreground">AWAITING ACTIVITY…</div>
        ) : (
          <div className="ticker-track">
            {doubled.map((ev, i) => (
              <EventLine key={`${ev.id}-${i}`} ev={ev} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
