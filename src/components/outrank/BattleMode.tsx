"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useUI } from "@/lib/outrank/store";
import { useRealtime } from "./providers";
import { Poster } from "./Poster";
import { RankNumber } from "./RankNumber";
import { ScoreCounter } from "./ScoreCounter";
import { formatScore, formatUsd } from "@/lib/outrank/types";
import { toast } from "sonner";
import type { Entity } from "@/lib/outrank/types";

export function BattleMode() {
  const battle = useUI((s) => s.battle);
  const close = useUI((s) => s.closeBattle);
  const openBoost = useUI((s) => s.openBoost);
  const { entities, boost } = useRealtime();

  if (!battle) return null;

  // resolve live versions
  const a = entities.find((e) => e.id === battle.a.id) ?? battle.a;
  const b = entities.find((e) => e.id === battle.b.id) ?? battle.b;

  const aLead = a.score >= b.score;
  const diff = Math.abs(a.score - b.score);

  const pick = (e: Entity) => {
    const amount = 500; // $5
    boost({ entityId: e.id, amount });
    toast.success(`BACKED ${e.name} · ${formatUsd(amount)}`, {
      description: "The board moves.",
    });
  };

  return (
    <Dialog open={!!battle} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-4xl w-[95vw] bg-paper text-ink border-ink p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{a.name} vs {b.name}</DialogTitle>
          <DialogDescription>Head-to-head battle for rank.</DialogDescription>
        </DialogHeader>

        {/* fight card header */}
        <div className="hazard px-5 py-2.5 flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-widest bg-ink text-paper px-2 py-1">BATTLE MODE</span>
          <span className="font-mono text-[10px] tracking-widest bg-paper text-ink px-2 py-1">WHO SHOULD BE ABOVE?</span>
        </div>

        {/* battle grid — symmetric 1fr : auto : 1fr, equal cards on both sides */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px_1fr]">
          {/* A side */}
          <BattleSide entity={a} leading={aLead} onPick={() => pick(a)} onBoost={() => { close(); openBoost(a); }} />

          {/* VS center — fixed narrow column */}
          <div className="bg-ink text-paper flex sm:flex-col items-center justify-center gap-1 py-4 sm:py-0 px-4">
            <div className="font-display text-2xl sm:text-4xl tracking-tightest leading-none">VS</div>
            <div className="font-mono text-[9px] tracking-widest text-paper/60 text-center whitespace-nowrap">{formatUsd(diff)}<br className="hidden sm:block" /> GAP</div>
          </div>

          {/* B side */}
          <BattleSide entity={b} leading={!aLead} onPick={() => pick(b)} onBoost={() => { close(); openBoost(b); }} />
        </div>

        {/* footer */}
        <div className="px-5 py-3 rule-t bg-paper-dim flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground">SHARE THIS FIGHT</span>
          <button
            onClick={() => {
              const text = `${a.name} (#${String(a.rank).padStart(2,"0")}) VS ${b.name} (#${String(b.rank).padStart(2,"0")}) on OUTRANK`;
              navigator.clipboard?.writeText(`${text} ${window.location.href}`);
              toast.success("Fight card link copied");
            }}
            className="font-mono text-[10px] tracking-widest border border-ink/30 px-3 py-1.5 hover:bg-ink hover:text-paper transition-colors"
          >
            COPY LINK
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BattleSide({
  entity,
  leading,
  onPick,
  onBoost,
}: {
  entity: Entity;
  leading: boolean;
  onPick: () => void;
  onBoost: () => void;
}) {
  return (
    <div className={`relative overflow-hidden flex flex-col ${leading ? "bg-paper" : "bg-paper-dim"}`}>
      {/* poster — full width, fixed aspect, same on both sides */}
      <div className="w-full aspect-[16/9] relative overflow-hidden shrink-0">
        <Poster entity={entity} variant="poster" className="absolute inset-0 h-full w-full" />
        {/* rank badge overlay */}
        <div className="absolute top-2 left-2 bg-ink/80 text-paper px-2 py-0.5">
          <RankNumber rank={entity.rank} size="sm" className="text-paper" />
        </div>
        {/* leading/trailing badge */}
        <div className={`absolute top-2 right-2 font-mono text-[9px] tracking-widest px-2 py-0.5 ${leading ? "bg-signal text-white" : "bg-ink/60 text-paper"}`}>
          {leading ? "● LEADING" : "TRAILING"}
        </div>
      </div>

      {/* content — same padding/structure on both sides */}
      <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
        <div className="min-w-0">
          <h3 className="font-display tracking-tightest leading-[0.9] break-words" style={{ fontSize: "clamp(1rem,2vw,1.3rem)" }}>
            {entity.name}
          </h3>
          <div className="font-mono text-[10px] text-muted-foreground mt-1 truncate">{entity.sub}</div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-baseline gap-1">
            <ScoreCounter value={entity.score} className="font-mono font-semibold text-lg" />
            <span className="font-mono text-[10px] text-muted-foreground">BACKED</span>
          </div>
          <div className="font-mono text-[10px] tracking-widest text-muted-foreground">{entity.supporters.toLocaleString()} BACKERS</div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={onPick}
              className="flex-1 py-2.5 font-mono text-[11px] tracking-widest bg-signal text-white hover:bg-signal-dim transition-colors"
            >
              BACK $5
            </button>
            <button
              onClick={onBoost}
              className="px-3 py-2.5 font-mono text-[10px] tracking-widest border border-ink/30 hover:bg-ink hover:text-paper transition-colors"
            >
              CUSTOM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
