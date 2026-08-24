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

export function EntityClaim() {
  const target = useUI((s) => s.claimTarget);
  const close = useUI((s) => s.closeClaim);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const open = !!target;

  const reset = () => {
    setName("");
    setEmail("");
    setProofUrl("");
    setBusy(false);
  };

  const submit = async () => {
    if (!target) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      toast.error("Tell us your name");
      return;
    }
    if (!trimmedEmail) {
      toast.error("Drop an email so we can reach you");
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      toast.error("That email doesn't look right");
      return;
    }
    const proof = proofUrl.trim();
    if (proof && !/^https?:\/\//i.test(proof)) {
      toast.error("Proof URL should start with http(s)://");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: target.id,
          name: trimmedName,
          email: trimmedEmail,
          proofUrl: proof || undefined,
        }),
      });
      if (!r.ok) {
        const data = (await r.json().catch(() => null)) as { reason?: string } | null;
        throw new Error(data?.reason || `HTTP ${r.status}`);
      }
      toast.success("CLAIM SUBMITTED", {
        description: `${target.name} — under review.`,
      });
      close();
      reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not submit claim";
      toast.error("CLAIM FAILED", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          close();
          reset();
        }
      }}
    >
      <DialogContent
        className="max-w-lg w-[92vw] bg-paper text-ink border-ink p-0 overflow-hidden"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Claim this entity</DialogTitle>
          <DialogDescription>
            Submit a claim to be verified as the owner of an OUTRANK entity.
          </DialogDescription>
        </DialogHeader>

        {/* Header bar */}
        <div className="bg-ink text-paper px-5 py-3 flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-widest">CLAIM THIS ENTITY</span>
          <button
            onClick={() => {
              close();
              reset();
            }}
            className="font-mono text-[10px] tracking-widest text-paper/60 hover:text-signal"
          >
            CLOSE ✕
          </button>
        </div>

        {target && (
          <div className="p-5 space-y-5">
            {/* Entity preview */}
            <div className="rule-b pb-4">
              <div className="font-mono text-[10px] tracking-widest text-signal mb-1">
                {target.category.toUpperCase()} · #{String(target.rank).padStart(2, "0")}
              </div>
              <h2
                className="font-display tracking-tighter2 leading-[0.88]"
                style={{ fontSize: "clamp(1.6rem, 3.4vw, 2.4rem)" }}
              >
                {target.name}
              </h2>
              {target.sub && (
                <div className="font-mono text-[10px] text-muted-foreground mt-1">
                  {target.sub}
                </div>
              )}
            </div>

            {/* Fields */}
            <div className="space-y-4">
              <div>
                <label className="font-mono text-[10px] tracking-widest text-muted-foreground block mb-2">
                  YOUR NAME
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Who's claiming this?"
                  className={`w-full ${inputCls}`}
                  autoCapitalize="words"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>

              <div>
                <label className="font-mono text-[10px] tracking-widest text-muted-foreground block mb-2">
                  EMAIL
                </label>
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
                />
              </div>

              <div>
                <label className="font-mono text-[10px] tracking-widest text-muted-foreground block mb-2">
                  PROOF URL <span className="text-muted-foreground/60">· OPTIONAL</span>
                </label>
                <Input
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  placeholder="link proving you own this"
                  className={`w-full ${inputCls}`}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="url"
                />
              </div>
            </div>

            {/* Commit */}
            <Button
              onClick={submit}
              disabled={busy || !name.trim() || !email.trim()}
              className="w-full h-12 bg-signal text-white font-display tracking-tighter2 text-lg hover:bg-signal-dim transition-colors rounded-none disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? "SUBMITTING…" : "SUBMIT CLAIM →"}
            </Button>

            {/* Small print */}
            <div className="text-center font-mono text-[9px] tracking-widest text-muted-foreground">
              CLAIMS ARE REVIEWED BEFORE APPROVAL. NO ACCOUNT NEEDED.
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
