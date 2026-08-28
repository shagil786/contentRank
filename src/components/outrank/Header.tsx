"use client";

import { useEffect, useState } from "react";
import { useUI } from "@/lib/outrank/store";
import { useRealtime } from "./providers";
import { Search, Plus, Bell, Mail } from "lucide-react";

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  const [tz, setTz] = useState<string>("GMT");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe clock init
    setNow(new Date());
    // Show the user's UTC offset as "GMT+5:30", "GMT-5", "GMT+0", etc.
    // This is universally understood and tells you the exact offset from GMT.
    const offset = -new Date().getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const h = Math.floor(Math.abs(offset) / 60);
    const m = Math.abs(offset) % 60;
    setTz(`GMT${sign}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`);
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return { now, tz };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function Header() {
  const { now, tz } = useClock();
  const { presence, fighting, connected } = useRealtime();
  const [totalVisits, setTotalVisits] = useState<number | null>(null);

  // All-time visitor count. The footer's reportVisit() ping is the canonical
  // counter trigger; this bar reads the total the API returns, so both views
  // agree without double-counting. If the footer never mounted (SSR-only
  // crawl) or the API fails, the stat simply stays hidden.
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/analytics/visits", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((payload: { ok?: boolean; totalVisits?: string } | null) => {
          if (!alive || !payload?.ok || payload.totalVisits === undefined) return;
          const parsed = Number(payload.totalVisits);
          if (Number.isFinite(parsed)) setTotalVisits(parsed);
        })
        .catch(() => undefined);
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  const setSearchOpen = useUI((s) => s.setSearchOpen);
  const setAddOpen = useUI((s) => s.setAddOpen);
  const soundOn = useUI((s) => s.soundOn);
  const toggleSound = useUI((s) => s.toggleSound);
  const timeframe = useUI((s) => s.timeframe);
  const setTimeframe = useUI((s) => s.setTimeframe);
  const setSubscribeOpen = useUI((s) => s.setSubscribeOpen);

  const time = now
    ? `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${tz}`
    : `——:——:—— ${tz}`;

  return (
    <header className="sticky top-0 z-30 bg-ink text-paper rule-b">
      {/* top micro-bar — minimal: LIVE + time + presence */}
      <div className="flex items-center justify-between px-3 sm:px-5 h-7 text-[9px] sm:text-[10px] font-mono tracking-widest">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center gap-1.5 shrink-0">
            <span className={`inline-block w-1.5 h-1.5 ${connected ? "bg-signal live-dot" : "bg-paper/30"}`} />
            {connected ? "LIVE" : "LINKING…"}
          </span>
          <span className="hidden sm:inline text-paper/60">{time}</span>
          {totalVisits !== null && (
            <span className="hidden md:inline text-paper/60" title="All-time site visitors — counted anonymously, at most once per visitor per day.">
              {totalVisits.toLocaleString()} VISITED
            </span>
          )}
          <span className="hidden md:inline text-paper/60">{presence.toLocaleString()} WATCHING</span>
          {fighting > 0 && <span className="hidden md:inline text-signal">{fighting} BIDDING</span>}
        </div>
        <div className="flex items-center border border-paper/20 shrink-0">
          <button
            onClick={() => setTimeframe("today")}
            aria-pressed={timeframe === "today"}
            className={`px-2 py-0.5 font-mono text-[9px] tracking-widest transition-colors ${timeframe === "today" ? "bg-signal text-white" : "text-paper/60 hover:text-paper"}`}
          >
            TODAY
          </button>
          <button
            onClick={() => setTimeframe("alltime")}
            aria-pressed={timeframe === "alltime"}
            className={`px-2 py-0.5 font-mono text-[9px] tracking-widest transition-colors ${timeframe === "alltime" ? "bg-signal text-white" : "text-paper/60 hover:text-paper"}`}
          >
            ALL TIME
          </button>
        </div>
      </div>

      {/* main bar */}
      <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 rule-t border-paper/10">
        <button
          onClick={() => useUI.getState().setTab("board")}
          className="flex items-center gap-2 group"
          data-cursor="HOME"
        >
          <span className="font-display tracking-tightest text-paper text-xl sm:text-2xl leading-none">OUTRANK</span>
          <span className="hidden sm:inline-block font-mono text-[8px] tracking-widest text-signal border border-signal px-1 py-0.5">LIVE</span>
        </button>

        <div className="hidden md:block flex-1 mx-8 text-center">
          <div className="font-mono text-[10px] tracking-widest text-paper/50">THE INTERNET IS NEVER STILL</div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setSubscribeOpen(true)}
            className="flex items-center gap-1.5 border border-paper/25 px-2 sm:px-2.5 py-1.5 font-mono text-[10px] tracking-widest hover:bg-paper hover:text-ink transition-colors"
            aria-label="subscribe"
            title="Get notified on leaderboard changes"
          >
            <Mail size={12} />
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 border border-paper/25 px-2.5 sm:px-3 py-1.5 font-mono text-[10px] tracking-widest hover:bg-paper hover:text-ink transition-colors"
            data-cursor="SEARCH"
          >
            <Search size={12} />
            <span className="hidden sm:inline">SEARCH</span>
            <kbd className="hidden sm:inline text-[9px] text-paper/40">⌘K</kbd>
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 bg-signal text-white px-2.5 sm:px-3 py-1.5 font-mono text-[10px] tracking-widest hover:bg-signal-dim transition-colors"
            data-cursor="ADD"
          >
            <Plus size={12} />
            <span className="hidden sm:inline">PUT ON BOARD</span>
          </button>
        </div>
      </div>
    </header>
  );
}
