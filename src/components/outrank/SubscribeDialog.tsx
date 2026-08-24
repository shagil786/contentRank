"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUI } from "@/lib/outrank/store";
import { toast } from "sonner";

// OUTRANK-styled input classes (sharp corners, mono font, editorial)
const inputCls =
  "bg-transparent border-ink/30 font-mono text-xs focus-visible:border-ink focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none h-11";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SubscribeDialog() {
  const open = useUI((s) => s.subscribeOpen);
  const setOpen = useUI((s) => s.setSubscribeOpen);
  const subscribeTarget = useUI((s) => s.subscribeTarget);

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setEmail("");
    setBusy(false);
  };

  const submit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Drop an email first");
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      toast.error("That email doesn't look right");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, string> = { email: trimmed };
      if (subscribeTarget) {
        body.entityId = subscribeTarget.id;
        body.entityName = subscribeTarget.name;
      }
      const r = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = (await r.json().catch(() => null)) as { reason?: string } | null;
        throw new Error(data?.reason || `HTTP ${r.status}`);
      }
      toast.success("SUBSCRIBED", {
        description: subscribeTarget
          ? `We'll ping you when ${subscribeTarget.name} moves on the board.`
          : "We'll ping you when the board moves.",
      });
      setOpen(false);
      reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not subscribe";
      toast.error("SUBSCRIBE FAILED", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogContent
        className="max-w-lg w-[92vw] bg-paper text-ink border-ink p-0 overflow-hidden"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Get notified</DialogTitle>
          <DialogDescription>
            Subscribe to OUTRANK board movement notifications by email.
          </DialogDescription>
        </DialogHeader>

        {/* Header bar */}
        <div className="bg-ink text-paper px-5 py-3 flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-widest">GET NOTIFIED</span>
          <button
            onClick={() => setOpen(false)}
            className="font-mono text-[10px] tracking-widest text-paper/60 hover:text-signal"
          >
            CLOSE ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Title block */}
          <div>
            <h2
              className="font-display tracking-tighter2 leading-[0.88]"
              style={{ fontSize: "clamp(1.6rem, 3.4vw, 2.4rem)" }}
            >
              {subscribeTarget
                ? `TRACK ${subscribeTarget.name}.`
                : "WHEN THE BOARD MOVES, YOU'LL KNOW."}
            </h2>
            <p className="font-mono text-[11px] leading-relaxed text-muted-foreground mt-3">
              {subscribeTarget
                ? `Drop your email. We'll ping you whenever ${subscribeTarget.name} moves up, gets overtaken, or defends its rank.`
                : "Drop your email. We'll ping you when something takes #1, when your picks get overtaken, or when the leaderboard shifts."}
            </p>
          </div>

          {/* divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-ink/15" />
            <span className="font-mono text-[9px] tracking-widest text-muted-foreground">
              YOUR EMAIL
            </span>
            <div className="flex-1 h-px bg-ink/15" />
          </div>

          {/* Form */}
          <div className="space-y-3">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@somewhere.com"
              className={`w-full ${inputCls}`}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="email"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy) submit();
              }}
            />

            <Button
              onClick={submit}
              disabled={busy || !email.trim()}
              className="w-full h-12 bg-signal text-white font-display tracking-tighter2 text-lg hover:bg-signal-dim transition-colors rounded-none disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? "SUBSCRIBING…" : "SUBSCRIBE →"}
            </Button>
          </div>

          {/* Small print */}
          <div className="text-center font-mono text-[9px] tracking-widest text-muted-foreground">
            NO SPAM. UNSUBSCRIBE ANYTIME. NO ACCOUNT NEEDED.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
