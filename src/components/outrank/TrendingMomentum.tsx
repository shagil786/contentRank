"use client";

import { motion } from "framer-motion";
import { useTrending, useRealtime } from "./providers";
import { useUI } from "@/lib/outrank/store";
import { Poster } from "./Poster";
import { formatScore } from "@/lib/outrank/types";

export function TrendingMomentum() {
  const { data } = useTrending();
  const { entities } = useRealtime();
  const openEntity = useUI((s) => s.openEntity);
  const openBoost = useUI((s) => s.openBoost);

  // prefer live momentum over the (stale) trending snapshot
  const live = [...entities].sort((a, b) => b.momentum - a.momentum);
  const rising = (data?.rising?.length ? data.rising : live.slice(0, 8)).map((r) => {
    const e = entities.find((x) => x.id === r.id);
    return e ? { ...r, momentum: e.momentum, rank: e.rank, score: e.score } : r;
  }).filter((r) => r.momentum > 0).slice(0, 8);
  const falling = (data?.falling?.length ? data.falling : [...live].reverse().slice(0, 8)).map((r) => {
    const e = entities.find((x) => x.id === r.id);
    return e ? { ...r, momentum: e.momentum, rank: e.rank, score: e.score } : r;
  }).filter((r) => r.momentum < 0).slice(0, 8);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 rule-t">
      {/* RISING */}
      <div className="rule-r">
        <div className="bg-ink text-paper px-5 py-3 flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-widest flex items-center gap-2">
            <span className="text-signal">▲</span> FASTEST RISING · 24H
          </span>
          <span className="font-mono text-[9px] tracking-widest text-paper/50">VELOCITY</span>
        </div>
        <div>
          {rising.length === 0 ? (
            <div className="px-5 py-6 font-mono text-[10px] tracking-widest text-muted-foreground">NOTHING MOVING YET.</div>
          ) : (
            rising.map((r, i) => (
              <motion.button
                key={r.id}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
                onClick={() => openEntity(entities.find((e) => e.id === r.id) as any || ({ id: r.id, name: r.name } as any))}
                className="w-full flex items-center gap-3 sm:gap-4 px-5 py-3 rule-b hover:bg-paper-dim transition-colors text-left group"
              >
                <span className="font-mono text-[10px] tracking-widest text-up w-[52px] shrink-0">+{r.momentum}</span>
                <Poster entity={r as any} variant="thumb" className="h-10 w-8 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-display tracking-tighter2 truncate leading-none" style={{ fontSize: "1rem" }}>{r.name}</div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{r.category.toUpperCase()} · #{String(r.rank).padStart(2, "0")} · {formatScore(r.score)} BACKED</div>
                </div>
                <span className="font-mono text-[9px] tracking-widest text-muted-foreground group-hover:text-signal transition-colors">BOOST →</span>
              </motion.button>
            ))
          )}
        </div>
      </div>

      {/* FALLING */}
      <div>
        <div className="bg-paper-dim px-5 py-3 flex items-center justify-between rule-b">
          <span className="font-mono text-[10px] tracking-widest flex items-center gap-2 text-down">
            <span>▼</span> FALLING FAST · 24H
          </span>
          <span className="font-mono text-[9px] tracking-widest text-muted-foreground">DEFEND THEM</span>
        </div>
        <div>
          {falling.length === 0 ? (
            <div className="px-5 py-6 font-mono text-[10px] tracking-widest text-muted-foreground">EVERYONE IS RISING.</div>
          ) : (
            falling.map((r, i) => (
              <motion.button
                key={r.id}
                initial={{ opacity: 0, x: 10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
                onClick={() => {
                  const e = entities.find((x) => x.id === r.id);
                  if (e) openBoost(e);
                }}
                className="w-full flex items-center gap-3 sm:gap-4 px-5 py-3 rule-b hover:bg-paper-dim transition-colors text-left group"
              >
                <span className="font-mono text-[10px] tracking-widest text-down w-[52px] shrink-0">{r.momentum}</span>
                <Poster entity={r as any} variant="thumb" className="h-10 w-8 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-display tracking-tighter2 truncate leading-none" style={{ fontSize: "1rem" }}>{r.name}</div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{r.category.toUpperCase()} · #{String(r.rank).padStart(2, "0")} · {formatScore(r.score)} BACKED</div>
                </div>
                <span className="font-mono text-[9px] tracking-widest text-muted-foreground group-hover:text-signal transition-colors">SAVE →</span>
              </motion.button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
