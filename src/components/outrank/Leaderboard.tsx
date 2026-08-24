"use client";

import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Fragment, useEffect, useMemo, useRef } from "react";
import type { Entity, Category } from "@/lib/outrank/types";
import { useUI } from "@/lib/outrank/store";
import { LeaderboardRow } from "./LeaderboardRow";
import { SkeletonRow } from "./SkeletonRow";
import { Top3 } from "./Top3";

interface Props {
  entities: Entity[];
  category: Category;
  loading: boolean;
  onBoost: (e: Entity) => void;
  lastUpdate?: { entityId: string; ts: number } | null;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

export interface DisplayEntity extends Entity {
  localRank: number; // 1-based rank within the current category view
  globalRank: number; // the entity's true global rank
  isCategoryView: boolean;
}

export function Leaderboard({ entities, category, loading, onBoost, lastUpdate, hasMore = false, loadingMore = false, onLoadMore }: Props) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const list = useMemo(() => {
    const filtered = category === "global" ? entities : entities.filter((e) => e.category === category);
    const sorted = [...filtered].sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
    const isCategoryView = category !== "global";
    return sorted.map((e, i) => ({
      ...e,
      localRank: i + 1,
      globalRank: e.rank,
      isCategoryView,
    })) as DisplayEntity[];
  }, [entities, category]);

  const top3 = list.slice(0, 3);
  const rest = list.slice(3);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMore || !onLoadMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loadingMore) onLoadMore();
    }, { rootMargin: "800px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  return (
    <div className="w-full">
      {/* column header */}
      <div className="hidden sm:flex items-center rule-b font-mono text-[10px] tracking-widest text-muted-foreground bg-paper-dim/60">
        <div className="pl-5 pr-4 py-1.5 w-[110px]">RANK</div>
        <div className="w-[42px] py-1.5" />
        <div className="flex-1 py-1.5">ENTITY</div>
        <div className="pr-5 py-1.5 text-right min-w-[120px]">BACKED</div>
        <div className="pr-5 py-1.5 w-[78px]" />
      </div>

      <LayoutGroup>
        <AnimatePresence mode="popLayout">
          {loading && list.length === 0 ? (
            <div key="skeletons">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonRow key={i} index={i} />
              ))}
            </div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* TOP 3 hero treatment */}
              <Top3 entities={top3} category={category} onBoost={onBoost} />

              {/* THE REST */}
              {rest.map((e, i) => {
                const rank = i + 4; // 1-based rank within the "rest" (top3 is 1-3, rest starts at 4)
                const showDivider = rank === 10 || rank === 25;
                return (
                  <Fragment key={e.id}>
                    {showDivider && (
                      <div className="rule-t rule-b bg-paper-dim/70 px-5 py-1.5 flex items-center justify-between">
                        <span className="font-mono text-[9px] tracking-widest text-muted-foreground">
                          {rank === 10 ? "10 · TOP TEN" : "25 · CONTENDERS"}
                        </span>
                        <span className="font-mono text-[9px] tracking-widest text-muted-foreground">SCROLL FOR MORE</span>
                      </div>
                    )}
                    <LeaderboardRow
                      entity={e}
                      index={i + 3}
                      onBoost={onBoost}
                      lastUpdateTs={lastUpdate && lastUpdate.entityId === e.id ? lastUpdate.ts : undefined}
                    />
                  </Fragment>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </LayoutGroup>

      {hasMore && (
        <div ref={loadMoreRef} className="py-8 text-center font-mono text-[9px] tracking-widest text-muted-foreground">
          {loadingMore ? "LOADING MORE…" : "KEEP SCROLLING FOR MORE"}
        </div>
      )}

      {list.length === 0 && !loading && (
        <div className="px-5 py-20 text-center">
          <div className="font-display tracking-tightest text-3xl sm:text-4xl text-ink">NO ONE OWNS THIS CATEGORY YET.</div>
          <button
            onClick={() => useUI.getState().setAddOpen(true)}
            className="mt-6 inline-block bg-signal text-white px-6 py-3 font-mono text-xs tracking-widest hover:bg-signal-dim transition-colors"
          >
            BE FIRST →
          </button>
        </div>
      )}
    </div>
  );
}
