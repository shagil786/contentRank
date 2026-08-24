"use client";

import { useEffect, useState } from "react";
import { getIdentity, getTotalBacked, type BoostRecord } from "@/lib/outrank/identity";
import { formatUsd } from "@/lib/outrank/types";

export function ProfilePanel() {
  const [identity, setIdentity] = useState<{ handle: string; boosts: BoostRecord[] } | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    queueMicrotask(() => {
      const id = getIdentity();
      setIdentity({ handle: id.handle, boosts: id.boosts });
      setTotal(getTotalBacked());
    });
  }, []);

  if (!identity) return null;
  return (
    <div className="p-5 space-y-5">
      <div className="rule-b pb-4">
        <div className="font-mono text-[10px] tracking-widest text-muted-foreground mb-1">YOUR IDENTITY</div>
        <div className="font-display tracking-tighter2 text-2xl">{identity.handle.toUpperCase()}</div>
        <div className="font-mono text-[10px] text-muted-foreground mt-1">{formatUsd(total)} TOTAL BACKED · {identity.boosts.length} BIDS</div>
      </div>
      <div>
        <div className="font-mono text-[10px] tracking-widest text-muted-foreground mb-3">YOUR BIDS</div>
        {identity.boosts.length === 0 ? (
          <div className="font-mono text-[10px] tracking-widest text-muted-foreground py-8 text-center">NO BIDS YET.<br />BOOST SOMETHING TO GET STARTED.</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto scroll-area-outrank">
            {identity.boosts.map((boost, index) => (
              <div key={`${boost.ts}-${index}`} className="flex items-center gap-3 p-2 border border-ink/15">
                <div className="flex-1 min-w-0"><div className="font-display tracking-tighter2 truncate" style={{ fontSize: "0.95rem" }}>{boost.entityName}</div><div className="font-mono text-[10px] text-muted-foreground">#{String(boost.rank).padStart(2, "0")} · {timeAgo(boost.ts)}</div></div>
                <div className="font-mono text-sm font-semibold shrink-0">{formatUsd(boost.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="font-mono text-[9px] tracking-widest text-muted-foreground text-center pt-4">STORED LOCALLY · NO ACCOUNT · NO AUTH</div>
    </div>
  );
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s AGO`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h AGO`;
  return `${Math.floor(hours / 24)}d AGO`;
}
