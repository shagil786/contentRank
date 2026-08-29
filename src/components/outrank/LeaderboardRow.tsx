"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import type { Entity } from "@/lib/outrank/types";
import { formatScore } from "@/lib/outrank/types";
import { detectPlatform } from "@/lib/outrank/platform";
import { RankNumber, RankDelta } from "./RankNumber";
import { ScoreCounter } from "./ScoreCounter";
import { Poster } from "./Poster";
import { useUI } from "@/lib/outrank/store";
import type { DisplayEntity } from "./Leaderboard";

interface Props {
  entity: DisplayEntity;
  index: number;
  onBoost: (e: Entity) => void;
  lastUpdateTs?: number; // when this entity's rank last changed (to trigger pulse)
}

// A single leaderboard row. Uses framer-motion layout animation (FLIP) so when
// the list reorders, rows physically slide into place.
export function LeaderboardRow({ entity, index, onBoost, lastUpdateTs }: Props) {
  const openEntity = useUI((s) => s.openEntity);
  const [hovered, setHovered] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const prevRankRef = useRef(entity.rank);
  const prevUpdateRef = useRef<number | undefined>(lastUpdateTs);

  useEffect(() => {
    const changed = entity.rank !== prevRankRef.current;
    const boosted = lastUpdateTs !== undefined && lastUpdateTs !== prevUpdateRef.current;
    prevUpdateRef.current = lastUpdateTs;
    if (changed || boosted) {
      prevRankRef.current = entity.rank;
      const el = rowRef.current;
      if (el) {
        el.classList.remove("row-pulse");
        // force reflow so the animation can restart
        void el.offsetWidth;
        el.classList.add("row-pulse");
        const t = setTimeout(() => el.classList.remove("row-pulse"), 1400);
        return () => clearTimeout(t);
      }
    }
  }, [entity.rank, lastUpdateTs]);

  const delta = entity.prevRank - entity.rank; // moved up => positive (global)
  const isTop = entity.localRank === 1;
  const showGlobalSub = entity.isCategoryView;

  return (
    <motion.div
      layout
      layoutId={`row-${entity.id}`}
      // Rank updates can move an entity between the top-three treatment and
      // the regular list. Keep the component mounted visually stable in that
      // case; Framer Motion's layout animation still handles the movement.
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ layout: { type: "spring", stiffness: 520, damping: 42, mass: 0.7 }, default: { duration: 0.4 } }}
      ref={rowRef}
      onClick={() => openEntity(entity)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openEntity(entity);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open details for ${entity.name}, rank ${entity.localRank}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative cursor-pointer rule-b focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal ${isTop ? "bg-ink text-paper" : "bg-paper hover:bg-paper-dim"} transition-colors`}
      data-rank={entity.rank}
      data-cursor="OPEN"
    >
      {/* left signal bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-[3px] ${isTop ? "bg-signal" : "bg-transparent"} group-hover:bg-signal transition-colors`}
      />

      <div className="flex items-stretch">
        {/* RANK */}
        <div className="flex items-center pl-3 sm:pl-5 pr-2 sm:pr-4 py-2 sm:py-3 w-[64px] sm:w-[110px] shrink-0">
          <div className="flex flex-col items-start leading-none">
            <RankNumber rank={entity.localRank} size="md" className={isTop ? "text-paper" : ""} />
            <div className="mt-1 h-[14px] flex items-center gap-1.5">
              {showGlobalSub ? (
                <span className="font-mono text-[9px] tracking-widest text-muted-foreground">GL #{String(entity.globalRank).padStart(2, "0")}</span>
              ) : (
                <RankDelta delta={delta} />
              )}
            </div>
          </div>
        </div>

        {/* POSTER THUMB (hidden on smallest) */}
        <div className="hidden sm:flex items-center py-2 pr-3 shrink-0">
          <div className="h-[44px] w-[34px] sm:h-[54px] sm:w-[42px]">
            <Poster entity={entity} variant="thumb" className="h-full w-full" />
          </div>
        </div>

        {/* NAME + SUB */}
        <div className="flex-1 min-w-0 flex items-center py-2 sm:py-3 pr-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`font-display tracking-tighter2 truncate ${isTop ? "text-paper" : ""}`} style={{ fontSize: "clamp(1rem,2.4vw,1.55rem)", lineHeight: 1 }}>
                {entity.name}
              </h3>
              {entity.link && (() => {
                const p = detectPlatform(entity.link);
                return (
                  <a
                    href={`/api/go/${entity.id}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    onClick={(e) => e.stopPropagation()}
                    className={`shrink-0 inline-flex items-center gap-1 font-mono text-[8px] sm:text-[9px] tracking-widest px-1.5 py-0.5 border transition-colors ${isTop ? "border-paper/40 text-paper/80 hover:bg-signal hover:border-signal hover:text-white" : "border-ink/25 text-ink/80 hover:bg-ink hover:text-paper hover:border-ink"}`}
                    title={p ? `${p.openLabel} — ${entity.link}` : `View original — ${entity.link}`}
                    aria-label={p ? p.openLabel : "view original"}
                    data-cursor="OPEN"
                  >
                    {p && (
                      <span
                        className="inline-block w-1.5 h-1.5"
                        style={{ background: p.color }}
                      />
                    )}
                    <span>{p ? p.label : "VIEW"} ↗</span>
                  </a>
                );
              })()}
            </div>
            <div className={`font-mono text-[10px] sm:text-[11px] tracking-wide truncate mt-0.5 ${isTop ? "text-paper/60" : "text-muted-foreground"}`}>
              {entity.sub}
            </div>
            {/* hover-reveal stats */}
            <div className="hidden md:flex items-center gap-3 mt-1.5 h-[14px] overflow-hidden">
              <AnimatePresence>
                {hovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-3 font-mono text-[10px] tracking-widest"
                  >
                    <span className={isTop ? "text-signal" : "text-muted-foreground"}>{entity.supporters.toLocaleString()} BACKERS</span>
                    <span className={isTop ? "text-paper/50" : "text-muted-foreground"}>PEAK #{String(entity.peakRank).padStart(2, "0")}</span>
                    {entity.momentum !== 0 && (
                      <span className={entity.momentum > 0 ? "text-up" : "text-down"}>
                        {entity.momentum > 0 ? "+" : ""}{entity.momentum} 24H
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* SCORE */}
        <div className="flex flex-col items-end justify-center pr-3 sm:pr-5 py-2 sm:py-3 shrink-0 min-w-[78px] sm:min-w-[120px]">
          <div className="flex items-baseline gap-1">
            <ScoreCounter value={entity.score} className={`font-mono font-semibold ${isTop ? "text-paper" : ""}`} />
            <span className={`font-mono text-[10px] ${isTop ? "text-paper/60" : "text-muted-foreground"}`}>BACKED</span>
          </div>
          <div className={`font-mono text-[9px] sm:text-[10px] tracking-widest mt-0.5 ${isTop ? "text-signal" : "text-muted-foreground"}`}>
            {isTop ? "BID TO HOLD" : entity.localRank <= 4 ? "BID TO TAKE #" + String(entity.localRank - 1).padStart(2, "0") : "PLACE BID"}
          </div>
        </div>

        {/* BOOST BUTTON */}
        <div className="hidden sm:flex items-center pr-3 sm:pr-5 py-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBoost(entity);
            }}
            className={`px-2.5 sm:px-3 py-1.5 font-mono text-[10px] sm:text-[11px] tracking-widest border transition-all ${
              isTop
                ? "border-paper/40 text-paper hover:bg-signal hover:border-signal"
                : "border-ink/30 text-ink hover:bg-ink hover:text-paper"
            }`}
          >
            BOOST
          </button>
        </div>
      </div>
    </motion.div>
  );
}
