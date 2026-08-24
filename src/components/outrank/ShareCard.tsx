"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUI } from "@/lib/outrank/store";
import { formatScore, type Entity } from "@/lib/outrank/types";
import { Poster } from "./Poster";
import { toast } from "sonner";

// Build a canonical shareable OUTRANK URL for an entity.
// Uses a relative path so it works regardless of gateway/proxy.
function shareUrl(entity: Entity): string {
  const slug = encodeURIComponent(entity.slug || entity.id);
  if (typeof window !== "undefined") {
    // relative URL — works through any gateway/proxy without 404
    return `${window.location.pathname}?e=${slug}`;
  }
  return `/?e=${slug}`;
}

export function ShareCard() {
  const target = useUI((s) => s.shareTarget);
  const close = useUI((s) => s.closeShare);

  const [copied, setCopied] = useState(false);
  const open = !!target;

  const { shareText, url } = useMemo(() => {
    if (!target) return { shareText: "", url: "" };
    const rank = String(target.rank).padStart(2, "0");
    const text = `${target.name} is #${rank} on OUTRANK with ${formatScore(target.score)} backed. Join the board.`;
    return { shareText: text, url: shareUrl(target) };
  }, [target]);

  const onCopy = async () => {
    if (!target) return;
    const payload = `${shareText} ${url}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(payload);
      } else {
        // Fallback for non-secure contexts (e.g. http preview)
        const ta = document.createElement("textarea");
        ta.value = payload;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast.success("COPIED", { description: "Share text + link in clipboard." });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy — long-press to copy manually.");
    }
  };

  const onShareX = () => {
    if (!target) return;
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  };

  const onShareReddit = () => {
    if (!target) return;
    const submit = `https://www.reddit.com/submit?title=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
    window.open(submit, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <DialogContent
        className="max-w-md w-[92vw] bg-paper text-ink border-ink p-0 overflow-hidden"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Share {target?.name}</DialogTitle>
          <DialogDescription>
            Share this entity&apos;s rank card on OUTRANK.
          </DialogDescription>
        </DialogHeader>

        {/* Header bar */}
        <div className="bg-ink text-paper px-5 py-3 flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-widest">SHARE THIS RANK</span>
          <button
            onClick={close}
            className="font-mono text-[10px] tracking-widest text-paper/60 hover:text-signal"
          >
            CLOSE ✕
          </button>
        </div>

        {target && (
          <div className="p-5 space-y-4">
            {/* Visual rank card — styled div, NOT a canvas */}
            <div
              className="relative w-full aspect-[4/5] overflow-hidden border border-ink/20"
              style={{ background: "#0a0a0a" }}
            >
              {/* Poster as background */}
              <Poster
                entity={target}
                variant="poster"
                showOverlay={false}
                className="absolute inset-0 h-full w-full"
              />
              {/* Darken for legibility */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/45 to-black/80" />

              {/* Top row: rank + score */}
              <div className="absolute top-0 left-0 right-0 p-4 flex items-start justify-between text-paper">
                <div>
                  <div className="font-mono text-[10px] tracking-widest opacity-70 mb-1">
                    CURRENT RANK
                  </div>
                  <div
                    className="font-display leading-[0.8] tracking-tighter2 text-signal"
                    style={{ fontSize: "clamp(3rem, 12vw, 4.5rem)" }}
                  >
                    #{String(target.rank).padStart(2, "0")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[10px] tracking-widest opacity-70 mb-1">
                    BACKED
                  </div>
                  <div
                    className="font-display leading-[0.8] tracking-tighter2 text-paper"
                    style={{ fontSize: "clamp(1.6rem, 6vw, 2.4rem)" }}
                  >
                    {formatScore(target.score)}
                  </div>
                </div>
              </div>

              {/* Bottom block: name + branding */}
              <div className="absolute bottom-0 left-0 right-0 p-4 text-paper overflow-hidden">
                <div className="font-mono text-[10px] tracking-widest text-signal mb-1.5">
                  ON OUTRANK
                </div>
                <div
                  className="font-display leading-[0.86] tracking-tighter2 line-clamp-2 break-words"
                  style={{ fontSize: "clamp(1.6rem, 6.5vw, 2.6rem)" }}
                >
                  {target.name}
                </div>
                {target.sub && (
                  <div className="font-mono text-[10px] tracking-widest opacity-60 mt-2 truncate">
                    {target.sub.toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* Share buttons */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={onCopy}
                className="h-11 bg-ink text-paper font-mono text-[10px] tracking-widest hover:bg-signal rounded-none"
              >
                {copied ? "COPIED ✓" : "COPY LINK"}
              </Button>
              <Button
                onClick={onShareX}
                className="h-11 bg-ink text-paper font-mono text-[10px] tracking-widest hover:bg-signal rounded-none"
              >
                SHARE ON X
              </Button>
              <Button
                onClick={onShareReddit}
                className="h-11 bg-ink text-paper font-mono text-[10px] tracking-widest hover:bg-signal rounded-none"
              >
                SHARE ON REDDIT
              </Button>
            </div>

            {/* Share text preview */}
            <div className="border border-ink/15 bg-paper-dim/40 px-3 py-2.5">
              <div className="font-mono text-[9px] tracking-widest text-muted-foreground mb-1">
                SHARE TEXT
              </div>
              <div className="font-mono text-[11px] leading-relaxed text-ink break-words">
                {shareText}
              </div>
              <div className="font-mono text-[10px] text-signal mt-1.5 truncate">{url}</div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
