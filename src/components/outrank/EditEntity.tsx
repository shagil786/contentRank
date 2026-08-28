"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useUI } from "@/lib/outrank/store";
import { useQueryClient } from "@/components/outrank/providers";
import { toast } from "sonner";

const inputCls = "bg-transparent border-ink/30 font-mono text-xs focus-visible:border-ink focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none h-10 min-h-10 leading-none";

export function EditEntity() {
  const target = useUI((state) => state.editTarget);
  const close = useUI((state) => state.closeEdit);
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [blurb, setBlurb] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!target) return;
    queueMicrotask(() => {
      setTitle(target.name);
      setBlurb(target.blurb || "");
      setLink(target.link || "");
    });
  }, [target]);

  async function submit() {
    if (!target) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/content/${target.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, blurb, link }) });
      const data = await response.json() as { ok?: boolean; reason?: string };
      if (!data.ok) throw new Error(data.reason || "Update failed");
      toast.success("ENTITY UPDATED");
      close();
      await queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      await queryClient.invalidateQueries({ queryKey: ["search"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally { setBusy(false); }
  }

  return <Dialog open={!!target} onOpenChange={(open) => !open && close()}>
    <DialogContent className="max-w-lg w-[92vw] bg-paper text-ink border-ink p-0 overflow-hidden">
      <DialogHeader className="sr-only"><DialogTitle>Edit entity</DialogTitle><DialogDescription>Edit this entity&apos;s details.</DialogDescription></DialogHeader>
      <div className="bg-ink text-paper px-5 py-3 flex items-center justify-between"><span className="font-mono text-[10px] tracking-widest">EDIT ENTITY</span><button onClick={close} className="font-mono text-[10px] tracking-widest text-paper/60 hover:text-signal">CLOSE ✕</button></div>
      <div className="p-5 space-y-4">
        <label className="block"><span className="font-mono text-[10px] tracking-widest text-muted-foreground block mb-2">NAME</span><Input value={title} onChange={(event) => setTitle(event.target.value)} className={`w-full ${inputCls}`} /></label>
        <label className="block"><span className="font-mono text-[10px] tracking-widest text-muted-foreground block mb-2">BLURB</span><Textarea value={blurb} onChange={(event) => setBlurb(event.target.value)} rows={2} className={`w-full ${inputCls} resize-none`} /></label>
        <label className="block"><span className="font-mono text-[10px] tracking-widest text-muted-foreground block mb-2">LINK</span><Input value={link} onChange={(event) => setLink(event.target.value)} className={`w-full ${inputCls}`} placeholder="https://..." /></label>
        <Button onClick={submit} disabled={busy} className="w-full py-4 bg-signal text-white font-display tracking-tighter2 text-lg hover:bg-signal-dim rounded-none">{busy ? "SAVING…" : "SAVE CHANGES →"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
