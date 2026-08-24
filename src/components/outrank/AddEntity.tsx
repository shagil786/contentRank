"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useCallback } from "react";
import { useUI } from "@/lib/outrank/store";
import { CATEGORIES, type Category, type EntityKind, type OgResult } from "@/lib/outrank/types";
import { detectPlatform } from "@/lib/outrank/platform";
import { toast } from "sonner";

// OUTRANK-styled input classes (sharp corners, mono font, editorial)
// Force explicit height + line-height so Select and Input match exactly.
const inputCls = "bg-transparent border-ink/30 font-mono text-xs focus-visible:border-ink focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none h-10 min-h-10 leading-none";
const inputLgCls = "bg-transparent border-ink/30 font-display tracking-tighter2 text-lg focus-visible:border-ink focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none h-11 min-h-11 leading-none";

// Heuristic: guess kind + category from the URL host so a pasted link
// pre-configures the form. User can always override.
function guessFromUrl(url: string): { kind?: EntityKind; category?: Category } {
  const host = (() => {
    try {
      return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return "";
    }
  })();
  if (!host) return {};
  if (host.includes("imdb") || host.includes("letterboxd") || host.includes("rogerebert")) return { kind: "movie", category: "movies" };
  if (host.includes("tmdb")) return { kind: "movie", category: "movies" };
  if (host.includes("trakt") || host.includes("metacritic") && url.includes("tv")) return { kind: "show", category: "tv" };
  if (host.includes("myanimelist") || host.includes("anilist") || host.includes("crunchyroll")) return { kind: "anime", category: "anime" };
  if (host.includes("steampowered") || host.includes("igdb") || host.includes("epicgames") || host.includes("gog")) return { kind: "game", category: "games" };
  if (host.includes("spotify") || host.includes("soundcloud") || host.includes("bandcamp")) return { kind: "song", category: "music" };
  if (host.includes("music.apple")) return { kind: "album", category: "music" };
  if (host.includes("youtube") || host.includes("youtu.be") || host.includes("tiktok") || host.includes("instagram") || host.includes("x.com") || host.includes("twitter") || host.includes("reddit") || host.includes("threads")) return { kind: "post", category: "creators" };
  if (host.includes("twitch")) return { kind: "creator", category: "creators" };
  if (host.includes("openai") || host.includes("anthropic") || host.includes("perplexity") || host.includes("huggingface")) return { kind: "ai", category: "ai" };
  return { kind: "website", category: "tech" };
}

function hostOf(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").toUpperCase();
  } catch {
    return "";
  }
}

export function AddEntity() {
  const open = useUI((s) => s.addOpen);
  const setOpen = useUI((s) => s.setAddOpen);

  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("movies");
  const [kind, setKind] = useState<EntityKind | undefined>(undefined);
  const [sub, setSub] = useState("");
  const [blurb, setBlurb] = useState("");
  const [initialBid, setInitialBid] = useState("");
  const [image, setImage] = useState<string | undefined>(undefined);
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState(false);

  const reset = () => {
    setUrl("");
    setName("");
    setSub("");
    setBlurb("");
    setInitialBid("");
    setKind(undefined);
    setCategory("movies");
    setImage(undefined);
    setResolvedUrl(undefined);
    setFetched(false);
    setFetching(false);
  };

  // Fetch OpenGraph metadata from /api/og and auto-fill the form.
  // Only fills fields that are empty (so the user's edits are preserved on re-fetch).
  const fetchOg = useCallback(async () => {
    if (!url.trim()) {
      toast.error("Paste a link first");
      return;
    }
    setFetching(true);
    try {
      const r = await fetch(`/api/og?url=${encodeURIComponent(url.trim())}`, { cache: "no-store" });
      const data = (await r.json()) as OgResult;
      if (!data.ok) {
        toast.error(`Couldn't read that link — ${data.reason || "unknown"}`, {
          description: "You can still fill the fields manually.",
        });
        setFetching(false);
        return;
      }
      // auto-fill from OG, only if field is empty
      if (data.title && !name) setName(data.title);
      if (data.description && !blurb) setBlurb(data.description.slice(0, 240));
      if (data.siteName && !sub) setSub(data.siteName);
      if (data.image) setImage(data.image);
      if (data.url) setResolvedUrl(data.url);
      // smart kind/category guess from host
      const g = guessFromUrl(data.url || url);
      if (g.kind) setKind(g.kind);
      if (g.category && category === "movies") setCategory(g.category);
      setFetched(true);
      toast.success(`Fetched from ${data.siteName || hostOf(data.url || url)}`, {
        description: data.title ? data.title.slice(0, 60) : undefined,
      });
    } catch {
      toast.error("Fetch failed — fill the fields manually.");
    } finally {
      setFetching(false);
    }
  }, [url, name, blurb, sub, category]);

  // Re-fetch automatically when the user pastes a URL and blurs the field.
  // Always run the platform guess (even if the fetch later fails) so a YouTube
  // link still auto-selects "post / creators", an Instagram link still picks
  // "post / creators", etc.
  const onUrlBlur = () => {
    if (!url.trim()) return;
    const g = guessFromUrl(url);
    if (g.kind) setKind(g.kind);
    if (g.category && category === "movies") setCategory(g.category);
    if (!fetched && !fetching) {
      fetchOg();
    }
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Give it a name");
      return;
    }
    const bidDollars = Number.parseFloat(initialBid);
    if (!initialBid.trim() || !Number.isFinite(bidDollars) || bidDollars < 1) {
      toast.error("Enter an initial bid of at least $1");
      return;
    }
    setBusy(true);
    try {
      const link = resolvedUrl || url.trim() || undefined;
      const bidResponse = await fetch("/api/content/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": globalThis.crypto.randomUUID(),
        },
        body: JSON.stringify({
          title: name,
          category,
          kind,
          sub,
          blurb,
          url: link,
          amount: Math.round(bidDollars * 100),
          currency: "usd",
          testMode: new URLSearchParams(window.location.search).has("test"),
          successUrl: `${window.location.origin}/?bid=success&amount=${Math.round(bidDollars * 100)}`,
          cancelUrl: `${window.location.origin}/?bid=cancel`,
        }),
      });
      const bidResult = await bidResponse.json().catch(() => null) as { checkoutUrl?: string; reason?: string } | null;
      if (!bidResponse.ok || !bidResult?.checkoutUrl) {
        const reason = bidResult?.reason === "csrf_failed"
          ? "Please refresh the page and try again."
          : bidResult?.reason === "api_unreachable"
          ? "The board is temporarily unavailable. Please try again."
          : "Your item was not added.";
        toast.error("Checkout could not be started", { description: reason });
        return;
      }
      window.location.assign(bidResult.checkoutUrl);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) reset();
        setOpen(nextOpen);
      }}
    >
      <DialogContent className="max-w-lg w-[92vw] bg-paper text-ink border-ink p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Put something on the board</DialogTitle>
          <DialogDescription>Add a new entity to the OUTRANK leaderboard.</DialogDescription>
        </DialogHeader>
        <div className="bg-ink text-paper px-5 py-3 flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-widest">+ PUT SOMETHING ON THE BOARD</span>
          <button
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="font-mono text-[10px] tracking-widest text-paper/60 hover:text-signal"
          >
            CLOSE ✕
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* THE LINK — where the content actually lives. This is the point:
              visitors click it to view the original post/video/song on its
              native platform, driving traffic back to the creator. */}
          <div>
            <label className="font-mono text-[10px] tracking-widest text-muted-foreground block mb-2">
              LINK TO THIS <span className="text-signal">·</span> WHERE DOES IT LIVE?
            </label>
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setFetched(false);
                }}
                onBlur={onUrlBlur}
                placeholder="instagram post, youtube video, spotify track, tweet…"
                className={`flex-1 min-w-0 ${inputCls}`}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                onClick={fetchOg}
                disabled={fetching || !url.trim()}
                className="px-3 py-3 font-mono text-[10px] tracking-widest border border-ink/30 hover:bg-ink hover:text-paper transition-colors disabled:opacity-40 shrink-0"
                title="Optional: grab a preview image + title from the link"
              >
                {fetching ? "…" : "GRAB PREVIEW"}
              </button>
            </div>
            {/* platform badge + preview */}
            {(resolvedUrl || url.trim()) && (
              <div className="mt-2 flex items-center gap-3 p-2.5 border border-ink/15 bg-paper-dim/40">
                {image && (
                  <img
                    src={image}
                    alt=""
                    className="h-12 w-12 object-cover shrink-0 bg-ink/10"
                    onError={(e) => ((e.currentTarget.style.display = "none"))}
                  />
                )}
                <div className="min-w-0 flex-1">
                  {(() => {
                    const p = detectPlatform(resolvedUrl || url);
                    return (
                      <div className="flex items-center gap-2 mb-0.5">
                        {p && (
                          <span className="font-mono text-[9px] tracking-widest px-1.5 py-0.5 text-white" style={{ background: p.color }}>
                            {p.label}
                          </span>
                        )}
                        <span className="font-mono text-[9px] tracking-widest text-up">✓ LINK READY</span>
                      </div>
                    );
                  })()}
                  <div className="font-mono text-[10px] text-muted-foreground truncate">
                    {(() => {
                      const p = detectPlatform(resolvedUrl || url);
                      return p ? `${p.openLabel} · ${p.host}` : hostOf(resolvedUrl || url);
                    })()}
                  </div>
                </div>
                <button
                  onClick={() => { setImage(undefined); setResolvedUrl(undefined); setFetched(false); }}
                  className="font-mono text-[9px] tracking-widest text-muted-foreground hover:text-signal shrink-0"
                >
                  CLEAR
                </button>
              </div>
            )}
            <div className="mt-1.5 font-mono text-[9px] tracking-widest text-muted-foreground leading-relaxed">
              THIS LINK IS SHOWN ON THE BOARD · PEOPLE CLICK IT TO VIEW THE ORIGINAL · DRIVES VIEWS TO THE CREATOR
            </div>
          </div>

          {/* divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-ink/15" />
            <span className="font-mono text-[9px] tracking-widest text-muted-foreground">THE DETAILS</span>
            <div className="flex-1 h-px bg-ink/15" />
          </div>

          {/* name */}
          <div>
            <label className="font-mono text-[10px] tracking-widest text-muted-foreground block mb-2">NAME</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. THE BRUTALIST"
              className={`w-full ${inputLgCls}`}
            />
          </div>

          {/* category + context */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="min-w-0">
              <div className="min-h-8 mb-1.5 flex items-end">
                <label className="font-mono text-[10px] tracking-widest text-muted-foreground leading-tight">CATEGORY</label>
              </div>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger className={`w-full min-w-0 ${inputCls}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-paper border-ink/30 rounded-none">
                  {CATEGORIES.filter((c) => c.id !== "global").map((c) => (
                    <SelectItem key={c.id} value={c.id} className="font-mono text-xs rounded-none focus:bg-ink focus:text-paper">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <div className="min-h-8 mb-1.5 flex items-end">
                <label className="font-mono text-[10px] tracking-widest text-muted-foreground leading-tight">CONTEXT (YEAR · MAKER · PLATFORM)</label>
              </div>
              <Input
                value={sub}
                onChange={(e) => setSub(e.target.value)}
                placeholder="2024 · A24"
                className={`w-full min-w-0 ${inputCls}`}
              />
            </div>
          </div>

          {/* optional first sponsored bid */}
          <div>
            <label className="font-mono text-[10px] tracking-widest text-muted-foreground block mb-2">
              INITIAL BID <span className="text-signal">·</span> USD AMOUNT
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                min="1"
                step="0.01"
                inputMode="decimal"
                value={initialBid}
                onChange={(e) => setInitialBid(e.target.value)}
                placeholder="Enter your opening bid"
                className={`w-full pl-7 ${inputCls}`}
              />
            </div>
            <div className="mt-1.5 font-mono text-[9px] tracking-widest text-muted-foreground leading-relaxed">
              YOUR OPENING BID STARTS THE PAID AUCTION · MINIMUM $1
            </div>
          </div>

          {/* blurb */}
          <div>
            <label className="font-mono text-[10px] tracking-widest text-muted-foreground block mb-2">ONE-LINE BLURB</label>
            <Textarea
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              placeholder="Why does it deserve a spot?"
              rows={2}
              className={`w-full ${inputCls} resize-none`}
            />
          </div>

          {/* commit */}
          <button
            onClick={submit}
            disabled={busy || !name.trim() || !initialBid.trim()}
            className="w-full py-4 bg-signal text-white font-display tracking-tighter2 text-lg hover:bg-signal-dim transition-colors disabled:opacity-40"
          >
            {busy ? "ADDING…" : "ADD →"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
