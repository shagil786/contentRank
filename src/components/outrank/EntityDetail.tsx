"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import type { Entity } from "@/lib/outrank/types";
import { formatScore } from "@/lib/outrank/types";
import { detectPlatform } from "@/lib/outrank/platform";
import { RankNumber, RankDelta } from "./RankNumber";
import { ScoreCounter, IntCounter } from "./ScoreCounter";
import { Poster } from "./Poster";
import { RankHistory } from "./RankHistory";
import { useUI } from "@/lib/outrank/store";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  entity: Entity | null;
  allEntities: Entity[];
}

export function EntityDetail({ entity, allEntities }: Props) {
  const open = !!entity;
  const close = () => useUI.getState().openEntity(null);
  const openBoost = useUI((s) => s.openBoost);
  const openBattle = useUI((s) => s.openBattle);
  const openShare = useUI((s) => s.openShare);
  const openEdit = useUI((s) => s.openEdit);
  const isMobile = useIsMobile();
  const live = entity;

  const neighbors = useMemo(() => {
    if (!live) return { above: null, below: null };
    const sorted = [...allEntities].sort((a, b) => a.rank - b.rank);
    const idx = sorted.findIndex((e) => e.id === live.id);
    return {
      above: idx > 0 ? sorted[idx - 1] : null,
      below: idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null,
    };
  }, [live, allEntities]);

  // share card
  const shareCard = () => {
    if (!live) return;
    openShare(live);
  };

  // view beacon: one fire per opened item; the server dedupes per visitor per day.
  // counted responses ping the board so the open sheet reflects the new number.
  const viewedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!live || viewedRef.current === live.id) return;
    viewedRef.current = live.id;
    fetch(`/api/view/${live.id}`, { method: "POST", keepalive: true })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.counted) window.dispatchEvent(new Event("outrank-engagement"));
      })
      .catch(() => undefined);
  }, [live]);

  if (!live) return null;

  const delta = live.prevRank - live.rank;
  const isOne = live.rank === 1;
  const verb = isOne ? "BID TO HOLD #1" : `BID TO TAKE #${String(live.rank - 1).padStart(2, "0")}`;

  const content = (
    <div>
      {/* hero */}
      <div className="relative invert-block overflow-hidden">
        {/* generative poster is the color fallback layer */}
        <Poster entity={live} variant="hero" className="absolute inset-0 h-full w-full opacity-40" />
        {/* og:image sits on top (when available) and darkens to keep text legible */}
        {live.image && (
           
          <img
            src={live.image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-35"
            onError={(e) => ((e.currentTarget.style.display = "none"))}
          />
        )}
        {/* darken gradient for text contrast over any background */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/30 to-black/60" />
        <div className="relative p-5 sm:p-7 pt-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] tracking-widest text-signal mb-2 flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-signal live-dot" /> {live.category.toUpperCase()} · {live.kind.toUpperCase()}
              </div>
              <div className="flex items-end gap-3 sm:gap-5">
                <RankNumber rank={live.rank} size="hero" className="text-paper" />
                <div className="pb-3 sm:pb-5 flex flex-col gap-1">
                  <RankDelta delta={delta} className="text-paper/80" />
                  <span className="font-mono text-[10px] tracking-widest text-paper/50">PEAK #{String(live.peakRank).padStart(2, "0")}</span>
                </div>
              </div>
            </div>
            <Poster entity={live} variant="poster" className="hidden sm:block w-[90px] aspect-[3/4]" />
          </div>
          <h2 className="font-display tracking-tightest text-paper leading-[0.84] mt-3" style={{ fontSize: "clamp(2rem,5vw,3.4rem)" }}>
            {live.name}
          </h2>
          <div className="font-mono text-[11px] tracking-wide text-paper/60 mt-2">{live.sub}</div>
          <p className="text-paper/75 text-sm mt-3 max-w-lg leading-snug">{live.blurb}</p>

          {/* VIEW ORIGINAL — the link to the actual content. This is the point of
              storing a link: visitors click it to view the original post / video /
              song on its native platform, driving traffic back to the creator. */}
          {live.link && (() => {
            const p = detectPlatform(live.link);
            return (
              <a
                href={`/api/go/${live.id}`}
                target="_blank"
                // noopener, NOT noreferrer: legacy browsers have no Sec-Fetch-*
                // headers, so /api/go's counting fallback needs the Referer
                rel="noopener nofollow"
                className="group mt-5 inline-flex items-center gap-2.5 bg-signal text-white px-4 py-2.5 font-mono text-[11px] tracking-widest hover:bg-signal-dim transition-colors"
                data-cursor="OPEN"
              >
                {p && (
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 text-[9px] font-bold text-white"
                    style={{ background: p.color }}
                  >
                    {p.label}
                  </span>
                )}
                <span>{p ? p.openLabel : "VIEW ORIGINAL"} →</span>
              </a>
            );
          })()}
        </div>
        <button onClick={() => openEdit(live)} className="w-full mt-2 py-2.5 font-mono text-[10px] tracking-widest text-muted-foreground hover:text-signal transition-colors">EDIT DETAILS</button>
      </div>

      {/* stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 rule-b">
        <Stat label="BACKED">
          <ScoreCounter value={live.score} className="font-mono font-semibold text-base sm:text-lg" />
        </Stat>
        <Stat label="BACKERS">
          <IntCounter value={live.supporters} className="font-mono font-semibold text-base sm:text-lg" />
        </Stat>
        <Stat label="24H">
          <span className={`font-mono font-semibold text-base sm:text-lg ${live.momentum > 0 ? "text-up" : live.momentum < 0 ? "text-down" : ""}`}>
            {live.momentum > 0 ? "+" : ""}{live.momentum}
          </span>
        </Stat>
        <Stat label="PEAK">
          <span className="font-mono font-semibold text-base sm:text-lg">#{String(live.peakRank).padStart(2, "0")}</span>
        </Stat>
      </div>

      {/* rank history */}
      <div className="p-5 sm:p-6 rule-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-[10px] tracking-widest text-muted-foreground">RANK HISTORY · 24H</h3>
          <span className="font-mono text-[9px] tracking-widest text-muted-foreground">LOWER = BETTER</span>
        </div>
        <RankHistory points={live.history} currentRank={live.rank} peakRank={live.peakRank} />
      </div>

      {/* compact link footer — the hero has the big CTA, this is the plain URL */}
      {live.link && (() => {
        const p = detectPlatform(live.link);
        return (
          <div className="p-5 sm:p-6 rule-b">
            <h3 className="font-mono text-[10px] tracking-widest text-muted-foreground mb-3">FOUND ON</h3>
            <a
              href={`/api/go/${live.id}`}
              target="_blank"
              rel="noopener nofollow"
              className="group flex items-center gap-3 p-3 border border-ink/20 hover:border-ink hover:bg-ink hover:text-paper transition-colors"
            >
              {p && (
                <span
                  className="inline-flex items-center justify-center w-7 h-7 text-[9px] font-bold text-white shrink-0"
                  style={{ background: p.color }}
                >
                  {p.label}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[10px] tracking-widest text-signal group-hover:text-signal mb-0.5 truncate">
                  {p ? p.openLabel : "EXTERNAL LINK"}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground group-hover:text-paper/70 truncate">
                  {live.link}
                </div>
              </div>
              <span className="font-mono text-[10px] tracking-widest shrink-0 group-hover:text-signal">VISIT ↗</span>
              {typeof live.views === "number" && (
                <span className="font-mono text-[10px] tracking-widest text-muted-foreground group-hover:text-paper/70">{live.views.toLocaleString("en-US")} VIEWS</span>
              )}
              {typeof live.outboundClicks === "number" && (
                <span className="font-mono text-[10px] tracking-widest text-muted-foreground group-hover:text-paper/70">{live.outboundClicks.toLocaleString("en-US")} CLICKS</span>
              )}
            </a>
          </div>
        );
      })()}

      {/* competitors */}
      {(neighbors.above || neighbors.below) && (
        <div className="p-5 sm:p-6 rule-b">
          <h3 className="font-mono text-[10px] tracking-widest text-muted-foreground mb-3">ADJACENT · THE FIGHT</h3>
          <div className="space-y-2">
            {neighbors.above && (
              <NeighborRow entity={neighbors.above} label={`#${String(neighbors.above.rank).padStart(2,"0")} ABOVE`} onBoost={openBoost} onBattle={(b) => openBattle(live, b)} />
            )}
            {neighbors.below && (
              <NeighborRow entity={neighbors.below} label={`#${String(neighbors.below.rank).padStart(2,"0")} BELOW`} onBoost={openBoost} onBattle={(b) => openBattle(b, live)} muted />
            )}
          </div>
        </div>
      )}

      {/* actions */}
      <div className="p-5 sm:p-6 space-y-2">
        <button
          onClick={() => openBoost(live)}
          className={`w-full py-4 font-display tracking-tighter2 text-lg transition-all ${
            isOne ? "bg-signal text-white hover:bg-signal-dim" : "bg-ink text-paper hover:bg-signal"
          }`}
        >
          {verb} →
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={shareCard}
            className="py-3 font-mono text-[11px] tracking-widest border border-ink/30 hover:bg-ink hover:text-paper transition-colors"
          >
            SHARE RANK CARD
          </button>
          {neighbors.above ? (
            <button
              onClick={() => openBattle(live, neighbors.above!)}
              className="py-3 font-mono text-[11px] tracking-widest border border-ink/30 hover:bg-ink hover:text-paper transition-colors"
            >
              BATTLE ↑
            </button>
          ) : (
            <button
              disabled
              className="py-3 font-mono text-[11px] tracking-widest border border-ink/15 text-muted-foreground/40 cursor-not-allowed"
            >
              BATTLE ↑
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return isMobile ? (
      <Drawer open={open} onOpenChange={(o) => !o && close()}>
        <DrawerContent className="bg-paper text-ink max-h-[92vh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{live.name}</DrawerTitle>
            <DrawerDescription>Detail view for {live.name}.</DrawerDescription>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
  ) : (
      <Sheet open={open} onOpenChange={(o) => !o && close()}>
        <SheetContent side="right" className="w-full sm:max-w-lg bg-paper text-ink border-l border-rule p-0 overflow-y-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>{live.name}</SheetTitle>
            <SheetDescription>Detail view for {live.name}.</SheetDescription>
          </SheetHeader>
          <div className="sticky top-0 z-10 bg-ink text-paper px-5 py-3 flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-widest flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-signal live-dot" /> ENTITY DETAIL
            </span>
            <button onClick={close} className="font-mono text-[10px] tracking-widest text-paper/70 hover:text-signal">CLOSE ✕</button>
          </div>
          {content}
        </SheetContent>
      </Sheet>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="p-4 sm:p-5 rule-r last:rule-r-0">
      <div className="font-mono text-[9px] tracking-widest text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}

function NeighborRow({
  entity,
  label,
  onBoost,
  onBattle,
  muted = false,
}: {
  entity: Entity;
  label: string;
  onBoost: (e: Entity) => void;
  onBattle: (b: Entity) => void;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3 border border-ink/15">
      <Poster entity={entity} variant="thumb" className="h-12 w-9 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[9px] tracking-widest text-muted-foreground">{label}</div>
        <div className="font-display tracking-tighter2 truncate leading-none" style={{ fontSize: "1.05rem" }}>{entity.name}</div>
        <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{formatScore(entity.score)} BACKED</div>
      </div>
      <button
        onClick={() => onBoost(entity)}
        className="px-3 py-2 font-mono text-[10px] tracking-widest border border-ink/30 hover:bg-ink hover:text-paper transition-colors shrink-0"
      >
        BOOST
      </button>
      <button
        onClick={() => onBattle(entity)}
        className={`px-3 py-2 font-mono text-[10px] tracking-widest border transition-colors shrink-0 ${muted ? "border-ink/15 text-muted-foreground" : "border-signal text-signal hover:bg-signal hover:text-white"}`}
      >
        VS
      </button>
    </div>
  );
}
