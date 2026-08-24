"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { Entity, Category } from "@/lib/outrank/types";
import { formatScore } from "@/lib/outrank/types";
import { RankNumber, RankDelta } from "./RankNumber";
import { ScoreCounter } from "./ScoreCounter";
import { Poster } from "./Poster";
import { useUI } from "@/lib/outrank/store";
import type { DisplayEntity } from "./Leaderboard";

interface Props {
  entities: DisplayEntity[];
  category: Category;
  onBoost: (e: Entity) => void;
}

export function Top3({ entities, onBoost }: Props) {
  if (entities.length === 0) return null;
  const [first, second, third] = entities;

  return (
    <div className="rule-b">
      {/* #1 — full-bleed poster hero */}
      {first && <TopOne entity={first} onBoost={onBoost} />}
      {/* #2 and #3 — split */}
      {(second || third) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 rule-t">
          {second && <RunnerUp entity={second} onBoost={onBoost} />}
          {third && <RunnerUp entity={third} onBoost={onBoost} />}
        </div>
      )}
    </div>
  );
}

function TopOne({ entity, onBoost }: { entity: DisplayEntity; onBoost: (e: Entity) => void }) {
  const openEntity = useUI((s) => s.openEntity);
  const delta = entity.prevRank - entity.rank;
  const elRef = useRef<HTMLDivElement>(null);
  const prevRank = useRef(entity.rank);
  const showGlobalSub = entity.isCategoryView;

  useEffect(() => {
    if (entity.rank !== prevRank.current) {
      prevRank.current = entity.rank;
      const el = elRef.current;
      if (el) {
        el.classList.remove("invert-flash");
        void el.offsetWidth;
        el.classList.add("invert-flash");
        const t = setTimeout(() => el.classList.remove("invert-flash"), 1200);
        return () => clearTimeout(t);
      }
    }
  }, [entity.rank]);

  return (
    <motion.div
      layout
      layoutId={`row-${entity.id}`}
      ref={elRef}
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
      className="relative cursor-pointer overflow-hidden invert-block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal"
      data-cursor="OPEN"
    >
      <div className="grid grid-cols-1 sm:grid-cols-[3fr_2fr]">
        {/* left: poster — portrait aspect ratio matches the SVG (400x560) so nothing clips */}
        <div className="relative aspect-[16/9] sm:aspect-[5/4]">
          <Poster entity={entity} variant="hero" className="absolute inset-0 h-full w-full" />
        </div>
        {/* right: typographic block */}
        <div className="relative flex flex-col justify-between p-5 sm:p-8 border-t sm:border-t-0 sm:border-l border-paper/15">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] tracking-widest text-signal mb-2 flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-signal live-dot" /> CURRENT LEADER
              </div>
              <div className="flex items-end gap-3 sm:gap-5 overflow-hidden">
                <RankNumber rank={entity.localRank} size="lg" className="text-paper" />
                <div className="pb-2 sm:pb-4 shrink-0">
                  {showGlobalSub ? (
                    <span className="font-mono text-[10px] tracking-widest text-paper/60">GLOBAL #{String(entity.globalRank).padStart(2, "0")}</span>
                  ) : (
                    <RankDelta delta={delta} className="text-paper/80" />
                  )}
                </div>
              </div>
            </div>
            <span className="font-mono text-[10px] tracking-widest text-paper/50">PEAK #{String(entity.peakRank).padStart(2, "0")}</span>
          </div>

          <div className="mt-4">
            <h2 className="font-display tracking-tightest text-paper leading-[0.84]" style={{ fontSize: "clamp(2rem,5vw,3.4rem)" }}>
              {entity.name}
            </h2>
            <div className="font-mono text-[11px] tracking-wide text-paper/60 mt-2">{entity.sub}</div>
            {entity.blurb && entity.blurb !== entity.sub && (
              <p className="hidden sm:block text-paper/70 text-sm mt-3 max-w-md leading-snug">{entity.blurb}</p>
            )}
          </div>

          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-1.5">
                <ScoreCounter value={entity.score} className="font-mono font-semibold text-paper text-xl sm:text-2xl" />
                <span className="font-mono text-[11px] text-paper/60">BACKED</span>
              </div>
              <div className="font-mono text-[10px] tracking-widest text-paper/50 mt-1">
                {formatScore(entity.supporters)} BACKERS · 24H {entity.momentum > 0 ? "+" : ""}{entity.momentum}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBoost(entity);
              }}
              className="px-4 sm:px-6 py-2.5 bg-signal text-white font-mono text-[11px] sm:text-xs tracking-widest hover:bg-signal-dim transition-colors border border-signal"
            >
              BID TO HOLD #1 →
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function RunnerUp({ entity, onBoost }: { entity: DisplayEntity; onBoost: (e: Entity) => void }) {
  const openEntity = useUI((s) => s.openEntity);
  const delta = entity.prevRank - entity.rank;
  const showGlobalSub = entity.isCategoryView;
  return (
    <motion.div
      layout
      layoutId={`row-${entity.id}`}
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
      className="group relative cursor-pointer bg-paper hover:bg-paper-dim transition-colors rule-r last:rule-r-0 sm:[&:nth-child(2)]:rule-r-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal"
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-transparent group-hover:bg-signal transition-colors" />
      <div className="flex items-stretch p-3 sm:p-4 gap-3 sm:gap-4">
        <div className="w-[64px] sm:w-[84px] shrink-0">
          <Poster entity={entity} variant="thumb" className="aspect-[3/4] w-full" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <RankNumber rank={entity.localRank} size="sm" />
              {showGlobalSub ? (
                <span className="font-mono text-[9px] tracking-widest text-muted-foreground">GL #{String(entity.globalRank).padStart(2, "0")}</span>
              ) : (
                <RankDelta delta={delta} />
              )}
            </div>
            <h3 className="font-display tracking-tighter2 leading-[0.9] truncate" style={{ fontSize: "clamp(1.1rem,2.6vw,1.6rem)" }}>
              {entity.name}
            </h3>
            <div className="font-mono text-[10px] text-muted-foreground tracking-wide truncate mt-0.5">{entity.sub}</div>
          </div>
          <div className="flex items-end justify-between mt-2">
            <div className="flex items-baseline gap-1">
              <ScoreCounter value={entity.score} className="font-mono font-semibold" />
              <span className="font-mono text-[10px] text-muted-foreground">BACKED</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBoost(entity);
              }}
              className="px-2.5 py-1.5 font-mono text-[10px] tracking-widest border border-ink/30 hover:bg-ink hover:text-paper transition-colors"
            >
              TAKE #{String(entity.localRank - 1).padStart(2, "0")}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
