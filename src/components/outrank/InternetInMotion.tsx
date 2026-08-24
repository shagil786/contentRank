"use client";

import { motion } from "framer-motion";
import { useRealtime } from "./providers";
import { formatScore } from "@/lib/outrank/types";

// "THE INTERNET IN MOTION" — experimental stats visualization, not a card dashboard.
export function InternetInMotion() {
  const { entities, activity, presence, totalBoosts } = useRealtime();

  const biggestJump = [...entities].sort((a, b) => b.momentum - a.momentum)[0];
  const mostDefended = [...entities].filter((e) => e.rank === 1)[0];
  const activeCategory = (() => {
    const counts: Record<string, number> = {};
    activity.slice(0, 20).forEach((a) => {
      counts[a.category] = (counts[a.category] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0].toUpperCase() : "—";
  })();

  // changes per minute (derived during render — updates when activity changes)
  const cpm = activity.filter((a) => Date.now() - a.ts < 60_000).length;

  const stats = [
    { label: "CHANGES / MIN", value: cpm, accent: true },
    { label: "BIGGEST JUMP 24H", value: biggestJump ? `+${biggestJump.momentum}` : "—", sub: biggestJump?.name },
    { label: "MOST DEFENDED #1", value: mostDefended ? "#01" : "—", sub: mostDefended?.name },
    { label: "HOTTEST CATEGORY", value: activeCategory, accent: false },
    { label: "WATCHING NOW", value: presence.toLocaleString(), accent: false },
    { label: "TOTAL BOOSTS", value: formatScore(totalBoosts), accent: false },
  ];

  return (
    <section className="rule-t rule-b bg-paper-dim/40">
      <div className="px-5 sm:px-10 py-4 flex items-center justify-between rule-b">
        <h2 className="font-mono text-[10px] tracking-widest text-muted-foreground flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-signal live-dot" /> THE INTERNET IN MOTION
        </h2>
        <span className="font-mono text-[9px] tracking-widest text-muted-foreground hidden sm:inline">LIVE TELEMETRY</span>
      </div>

      {/* ribbon of stats with animated bars */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="p-4 sm:p-5 rule-r last:rule-r-0 border-b md:border-b-0 border-rule"
          >
            <div className="font-mono text-[9px] tracking-widest text-muted-foreground mb-2">{s.label}</div>
            <div className={`font-display tracking-tighter2 leading-none ${s.accent ? "text-signal" : "text-ink"}`} style={{ fontSize: "clamp(1.4rem,3vw,2rem)" }}>
              {s.value}
            </div>
            {s.sub && <div className="font-mono text-[10px] text-muted-foreground mt-1 truncate">{s.sub}</div>}
          </motion.div>
        ))}
      </div>

      {/* rank trails visualization */}
      <RankTrails entities={entities} />
    </section>
  );
}

function RankTrails({ entities }: { entities: any[] }) {
  const top = entities.slice(0, 12);
  return (
    <div className="px-5 sm:px-10 py-6 rule-t overflow-hidden">
      <div className="font-mono text-[9px] tracking-widest text-muted-foreground mb-4">RANK TRAILS · TOP 12 · 24H</div>
      <div className="space-y-1.5">
        {top.map((e) => {
          const pts = e.history || [];
          if (pts.length < 2) return null;
          const maxR = Math.max(...pts.map((p: any) => p.rank), 1);
          const W = 100;
          const line = pts
            .map((p: any, i: number) => {
              const x = (i / (pts.length - 1)) * W;
              const y = ((p.rank - 1) / Math.max(1, maxR - 1)) * 100;
              return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join(" ");
          return (
            <div key={e.id} className="flex items-center gap-3 group">
              <div className="font-mono text-[9px] tracking-widest text-muted-foreground w-[24px] shrink-0">
                {String(e.rank).padStart(2, "0")}
              </div>
              <div className="font-mono text-[9px] tracking-widest w-[100px] sm:w-[140px] truncate shrink-0">
                {e.name}
              </div>
              <div className="flex-1 relative h-5 bg-paper-dim/50">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                  <path d={line} fill="none" stroke={e.rank === 1 ? "var(--signal)" : "var(--ink)"} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" opacity={e.rank === 1 ? 1 : 0.85} />
                </svg>
              </div>
              <div className={`font-mono text-[9px] tracking-widest w-[40px] text-right shrink-0 ${e.momentum > 0 ? "text-up" : e.momentum < 0 ? "text-down" : "text-muted-foreground"}`}>
                {e.momentum > 0 ? "+" : ""}{e.momentum}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
