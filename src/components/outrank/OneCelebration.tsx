"use client";

import { motion, AnimatePresence } from "framer-motion";

interface Props {
  event: { entityId: string; entityName: string; ts: number } | null;
}

// Non-blocking #1 celebration. The leaderboard owns rank movement; this
// notification must never cover the page or lock scrolling during an update.
export function OneCelebration({ event }: Props) {
  return (
    <AnimatePresence>
      {event && (
        <motion.div
          key={event.ts}
          initial={{ opacity: 0, y: -12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.25 }}
          className="fixed top-[4.75rem] right-3 sm:right-5 z-[60] w-[min(22rem,calc(100vw-1.5rem))] pointer-events-none"
        >
          <div className="relative overflow-hidden border border-signal/80 bg-ink text-paper px-4 py-3 shadow-xl">
            <div className="absolute inset-y-0 left-0 w-1 bg-signal" />
            <div className="pl-2">
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-[10px] tracking-[0.18em] text-signal">↑ NEW #1</div>
                <div className="font-mono text-[9px] tracking-widest text-paper/50">LIVE SHIFT</div>
              </div>
              <div className="mt-1 font-display text-base sm:text-lg tracking-tightest leading-none truncate">{event.entityName}</div>
              <div className="mt-2 font-mono text-[9px] tracking-widest text-paper/55">LEADERBOARD UPDATED · JUST NOW</div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
