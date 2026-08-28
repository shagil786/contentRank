"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatUsd } from "@/lib/outrank/types";
import { useUI } from "@/lib/outrank/store";

export function PostBidPrompt() {
  const postBid = useUI((s) => s.postBidTarget);
  const close = useUI((s) => s.closePostBid);

  return (
    <Dialog open={!!postBid} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-lg w-[92vw] bg-paper text-ink border-ink p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Bid placed</DialogTitle>
          <DialogDescription>Choose whether to track this entity.</DialogDescription>
        </DialogHeader>
        {postBid && (
          <div className="p-5 sm:p-8 text-center">
            <div className="font-mono text-[10px] tracking-widest text-up mb-3">✓ BID PLACED · {formatUsd(postBid.amount)} BACKED</div>
            <div className="font-display tracking-tighter2 text-2xl sm:text-3xl leading-[0.9] mb-7">{postBid.entity.name}</div>
            <div className="font-mono text-[10px] tracking-widest text-muted-foreground mb-4">WANT TO KNOW WHEN IT MOVES?</div>
            <button
              onClick={() => {
                useUI.getState().openSubscribeEntity(postBid.entity);
                close();
              }}
              className="w-full py-3.5 bg-signal text-white font-mono text-[11px] tracking-widest hover:bg-signal-dim transition-colors mb-2"
            >
              TRACK THIS ENTITY →
            </button>
            <button
              onClick={close}
              className="w-full py-3 font-mono text-[10px] tracking-widest border border-ink/20 text-muted-foreground hover:bg-ink hover:text-paper transition-colors"
            >
              NO THANKS
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
