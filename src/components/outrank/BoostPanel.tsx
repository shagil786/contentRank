"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import type { Entity } from "@/lib/outrank/types";
import { formatScore, formatUsd } from "@/lib/outrank/types";
import { RankNumber } from "./RankNumber";
import { ScoreCounter } from "./ScoreCounter";
import { Poster } from "./Poster";
import { useUI } from "@/lib/outrank/store";
import { useRealtime } from "./providers";
import { recordBoost } from "@/lib/outrank/identity";
import { toast } from "sonner";

// USD boost presets (in cents for precision). No daily limit — users pay to move up.
const PRESETS = [100, 500, 1000, 2000]; // $1, $5, $10, $20

interface Projection {
  newRank: number;
  prevRank: number;
  newScore: number;
  amount: number;
  gapToNext: number;
  nextRank: number;
}

export function BoostPanel() {
  const target = useUI((s) => s.boostTarget);
  const close = useUI((s) => s.closeBoost);
  const open = !!target;

  return (
    <>
      <Drawer open={open} onOpenChange={(o) => !o && close()}>
        <DrawerContent className="bg-paper text-ink sm:hidden max-h-[92vh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{target ? `Boost ${target.name}` : "Boost"}</DrawerTitle>
            <DrawerDescription>Pay to move this up the board.</DrawerDescription>
          </DrawerHeader>
          {target && <BoostBody key={target.id} target={target} close={close} />}
        </DrawerContent>
      </Drawer>
      <Sheet open={open} onOpenChange={(o) => !o && close()}>
        <SheetContent side="right" className="hidden sm:block w-full sm:max-w-md bg-paper text-ink border-l border-rule p-0 overflow-y-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>{target ? `Boost ${target.name}` : "Boost"}</SheetTitle>
            <SheetDescription>Pay to move this up the board.</SheetDescription>
          </SheetHeader>
          <div className="sticky top-0 bg-ink text-paper px-4 sm:px-6 py-3 flex items-center justify-between rule-b">
            <span className="font-mono text-[10px] tracking-widest flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-signal live-dot" /> BOOST PANEL
            </span>
            <button onClick={close} className="font-mono text-[10px] tracking-widest text-paper/70 hover:text-signal">CLOSE ✕</button>
          </div>
          {target && <BoostBody key={target.id} target={target} close={close} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function BoostBody({ target, close }: { target: Entity; close: () => void }) {
  const { boost, preview } = useRealtime();

  const [amount, setAmount] = useState(500); // default $5
  const [custom, setCustom] = useState("");
  const [projection, setProjection] = useState<Projection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [committed, setCommitted] = useState(false); // shows the post-bid track prompt

  // custom is entered in DOLLARS; convert to cents internally. Max $1B (anti-abuse).
  const customCents = custom ? Math.max(0, Math.min(parseFloat(custom || "0") || 0, 1_000_000_000) * 100) : 0;
  const effAmount = custom ? Math.round(customCents) : amount; // cents
  const calc = !projection || projection.amount !== effAmount;

  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      const r = await preview(target.id, effAmount);
      if (active) {
        setProjection(r ? { ...r, amount: effAmount } : null);
      }
    }, 120);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [target, effAmount, preview]);

  const onCommit = useCallback(() => {
    if (effAmount < 100) {
      toast.error("Minimum boost is $1");
      return;
    }
    setSubmitting(true);
    boost({ entityId: target.id, amount: effAmount });
    recordBoost({ entityId: target.id, entityName: target.name, amount: effAmount, rank: projection?.newRank ?? target.rank, ts: Date.now() });
    const verb =
      projection && projection.newRank === 1
        ? "TOOK #1"
        : projection && projection.newRank < (projection.prevRank || 99)
        ? "BOOSTED"
        : "BACKED";
    toast.success(`${target.name} ${verb} · ${formatUsd(effAmount)}`, {
      description: projection
        ? `#${String(projection.prevRank).padStart(2, "0")} → #${String(projection.newRank).padStart(2, "0")}`
        : undefined,
    });
    setTimeout(() => {
      setSubmitting(false);
      setCommitted(true); // show the post-bid track prompt instead of closing
    }, 650);
  }, [target, effAmount, boost, projection]);

  const newRank = projection?.newRank ?? target.rank;
  const prevRank = target.rank;
  const takesOne = newRank === 1 && prevRank !== 1;
  const defending = newRank === 1 && prevRank === 1;

  if (committed) {
    // post-bid: show the track + claim prompt (only after the bid is added)
    return (
      <div className="px-4 sm:px-6 pb-6">
        <div className="py-8 text-center">
          <div className="font-mono text-[10px] tracking-widest text-up mb-3">✓ BID PLACED</div>
          <div className="font-display tracking-tighter2 text-2xl sm:text-3xl leading-[0.9] mb-2">
            {target.name}
          </div>
          <div className="font-mono text-xs text-muted-foreground mb-6">
            {formatUsd(effAmount)} BACKED
          </div>
          <div className="font-mono text-[10px] tracking-widest text-muted-foreground mb-4">
            WANT TO KNOW WHEN IT MOVES?
          </div>
          <button
            onClick={() => {
              useUI.getState().openSubscribeEntity(target);
              close();
            }}
            className="w-full py-3.5 bg-signal text-white font-mono text-[11px] tracking-widest hover:bg-signal-dim transition-colors mb-2"
          >
            TRACK {target.name} →
          </button>
          <button
            onClick={() => {
              useUI.getState().openClaim(target);
              close();
            }}
            className="w-full py-3 font-mono text-[11px] tracking-widest border border-ink/30 hover:bg-ink hover:text-paper transition-colors mb-2"
          >
            CLAIM THIS ENTITY →
          </button>
          <button
            onClick={close}
            className="w-full py-3 font-mono text-[10px] tracking-widest border border-ink/20 text-muted-foreground hover:bg-ink hover:text-paper transition-colors"
          >
            NO THANKS
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 pb-6">
      {/* header */}
      <div className="flex items-start gap-4 rule-b py-4">
        <div className="w-[60px] sm:w-[80px] shrink-0">
          <Poster entity={target} variant="thumb" className="aspect-[3/4] w-full" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] tracking-widest text-signal mb-1">{target.category.toUpperCase()} · #{String(target.rank).padStart(2, "0")}</div>
          <h2 className="font-display tracking-tighter2 leading-[0.88]" style={{ fontSize: "clamp(1.4rem,3vw,2rem)" }}>
            {target.name}
          </h2>
          <div className="font-mono text-[10px] text-muted-foreground mt-1">{target.sub}</div>
          <div className="flex items-baseline gap-1 mt-2">
            <ScoreCounter value={target.score} className="font-mono font-semibold" />
            <span className="font-mono text-[10px] text-muted-foreground">BACKED · {formatScore(target.supporters)} BACKERS</span>
          </div>
        </div>
      </div>

      {/* rank projection */}
      <div className="rule-b py-5">
        <div className="font-mono text-[10px] tracking-widest text-muted-foreground mb-3">
          {calc ? "CALCULATING NEW POSITION…" : "YOUR BOOST"}
        </div>
        <div className="flex items-center justify-center gap-3 sm:gap-6">
          <div className="text-center">
            <div className="font-mono text-[9px] tracking-widest text-muted-foreground mb-1">FROM</div>
            <RankNumber rank={prevRank} size="lg" />
          </div>
          <div className="flex flex-col items-center">
            <div className="font-mono text-[9px] tracking-widest text-signal mb-1">{formatUsd(effAmount)}</div>
            <div className="text-signal font-display text-2xl sm:text-3xl">→</div>
            <div className="font-mono text-[9px] tracking-widest text-muted-foreground mt-1">PAID</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-[9px] tracking-widest text-muted-foreground mb-1">TO</div>
            <RankNumber rank={newRank} size="lg" pulse={takesOne} className={takesOne ? "text-signal" : ""} />
          </div>
        </div>
        {takesOne && (
          <div className="text-center mt-3 font-mono text-[10px] tracking-widest text-signal">⟶ THIS TAKES #1</div>
        )}
        {defending && (
          <div className="text-center mt-3 font-mono text-[10px] tracking-widest text-muted-foreground">⟶ DEFENDS #1</div>
        )}
        {!takesOne && !defending && newRank === prevRank && projection?.gapToNext && projection.gapToNext > 0 && (
          <div className="text-center mt-3 space-y-1">
            <div className="font-mono text-[10px] tracking-widest text-down">⟶ NOT ENOUGH TO MOVE</div>
            <div className="font-mono text-[10px] tracking-widest text-muted-foreground">
              NEEDS <span className="text-signal">{formatUsd(projection.gapToNext)}</span> MORE TO REACH #{String(projection.nextRank).padStart(2, "0")}
            </div>
          </div>
        )}
        {!takesOne && !defending && newRank < prevRank && (
          <div className="text-center mt-3 font-mono text-[10px] tracking-widest text-up">
            ⟶ MOVES UP {prevRank - newRank} {prevRank - newRank === 1 ? "POSITION" : "POSITIONS"}
          </div>
        )}
      </div>

      {/* amount selector — USD presets */}
      <div className="py-5 rule-b">
        <div className="font-mono text-[10px] tracking-widest text-muted-foreground mb-3">BOOST AMOUNT (USD)</div>
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setCustom("");
                setAmount(p);
              }}
              className={`py-3 font-mono text-sm font-semibold border transition-all ${
                !custom && amount === p
                  ? "bg-ink text-paper border-ink"
                  : "border-ink/30 hover:bg-ink hover:text-paper"
              }`}
            >
              {formatUsd(p)}
            </button>
          ))}
        </div>
        <div className="mt-3 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground pointer-events-none">$</span>
          <Input
            type="number"
            min={1}
            max={1000000000}
            step={1}
            value={custom}
            placeholder="0"
            onChange={(e) => setCustom(e.target.value)}
            className="w-full bg-transparent border-ink/30 font-mono text-sm focus-visible:border-ink focus-visible:ring-0 rounded-none h-12 pl-7 pr-16 text-left"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground pointer-events-none">USD</span>
        </div>
      </div>

      {/* commit */}
      <button
        onClick={onCommit}
        disabled={submitting || effAmount < 100}
        className={`w-full mt-5 py-4 font-display tracking-tighter2 text-lg transition-all ${
          takesOne ? "bg-signal text-white hover:bg-signal-dim" : "bg-ink text-paper hover:bg-signal"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {submitting ? "PROCESSING…" : takesOne ? `TAKE #1 · ${formatUsd(effAmount)} →` : defending ? `DEFEND #1 · ${formatUsd(effAmount)} →` : `BOOST ${formatUsd(effAmount)} →`}
      </button>
      <div className="text-center mt-2 font-mono text-[9px] tracking-widest text-muted-foreground">
        PAYMENT VIA DODO · NO DAILY LIMIT · MAX $1B PER BID · EVERY DOLLAR MOVES YOU UP
      </div>
    </div>
  );
}
