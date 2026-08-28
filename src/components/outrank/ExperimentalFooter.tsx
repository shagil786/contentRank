"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useUI } from "@/lib/outrank/store";
import { useRealtime } from "./providers";
import { formatScore } from "@/lib/outrank/types";
import { reportVisit } from "@/lib/analytics/visit-counter";
import Link from "next/link";

export function ExperimentalFooter() {
  const { entities } = useRealtime();
  const setAddOpen = useUI((s) => s.setAddOpen);
  const top = entities.slice(0, 10);

  // All-time visitor count. One ping per browser session; the response total
  // is displayed in the footer. Failures leave the line empty — never noisy.
  const [totalVisits, setTotalVisits] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    reportVisit().then((payload) => {
      if (!alive || !payload?.ok || payload.totalVisits === undefined) return;
      const parsed = Number(payload.totalVisits);
      if (Number.isFinite(parsed)) setTotalVisits(parsed);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <footer className="relative invert-block overflow-hidden mt-auto">
      {/* mini leaderboard drifting behind */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none overflow-hidden">
        <motion.div
          animate={{ y: ["0%", "-50%"] }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
          className="font-display tracking-tightest whitespace-nowrap"
        >
          {top.concat(top).concat(top).map((e, i) => (
            <div key={i} className="flex items-center gap-4 py-1">
              <span className="text-paper rank-numeral" style={{ fontSize: "3rem" }}>
                {String(e.rank).padStart(2, "0")}
              </span>
              <span className="text-paper font-mono text-xs">{e.name}</span>
              <span className="text-paper font-mono text-xs">{formatScore(e.score)}</span>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="relative px-6 sm:px-10 py-20 sm:py-32 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          className="font-display tracking-tightest text-paper leading-[0.8]"
          style={{ fontSize: "clamp(3rem,14vw,11rem)" }}
        >
          THERE IS
          <br />
          ALWAYS
          <br />
          ANOTHER
          <br />
          <span className="text-signal">#1</span>
        </motion.h2>

        <motion.button
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          onClick={() => setAddOpen(true)}
          className="mt-12 inline-flex items-center gap-3 bg-signal text-white px-6 sm:px-8 py-4 font-display tracking-tighter2 text-lg sm:text-xl hover:bg-signal-dim transition-colors"
        >
          PUT SOMETHING ON THE BOARD →
        </motion.button>

        <div className="mt-16 sm:mt-24 flex flex-col sm:flex-row items-center justify-between gap-4 rule-t border-paper/15 pt-6 max-w-5xl mx-auto">
          <div className="font-display tracking-tighter2 text-paper text-2xl">OUTRANK</div>
          <div className="font-mono text-[9px] tracking-widest text-paper/40">
            THE INTERNET IS COMPETING FOR ATTENTION · NOW YOU CAN SEE WHO OWNS IT.
          </div>
          <div className="font-mono text-[9px] tracking-widest text-paper/40">
            LIVE ATTENTION MARKET · EVERY BID IS PAID
          </div>
        </div>
        {totalVisits !== null && (
          <div className="relative mt-3 text-center font-mono text-[9px] tracking-widest text-paper/50" title="All-time site visitors — counted anonymously, at most once per visitor per day.">
            {totalVisits.toLocaleString("en-US")} VISITORS AND COUNTING
          </div>
        )}
        <nav aria-label="Legal" className="relative mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 font-mono text-[9px] tracking-widest text-paper/50">
          <Link className="hover:text-signal" href="/privacy">PRIVACY</Link>
          <Link className="hover:text-signal" href="/terms">TERMS</Link>
          <Link className="hover:text-signal" href="/refunds">REFUNDS</Link>
          <a className="hover:text-signal" href="mailto:shagil@content-rank.lol">CONTACT</a>
        </nav>
      </div>
    </footer>
  );
}
