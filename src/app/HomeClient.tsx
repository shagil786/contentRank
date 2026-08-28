"use client";

import { useEffect, useMemo } from "react";
import { useRealtime, useLeaderboard } from "@/components/outrank/providers";
import { useUI } from "@/lib/outrank/store";
import type { LeaderState, Category } from "@/lib/outrank/types";
import { Header } from "@/components/outrank/Header";
import { CategoryNavigation } from "@/components/outrank/CategoryNavigation";
import { LiveTicker } from "@/components/outrank/LiveTicker";
import { Leaderboard } from "@/components/outrank/Leaderboard";
import { InternetInMotion } from "@/components/outrank/InternetInMotion";
import { TrendingMomentum } from "@/components/outrank/TrendingMomentum";
import { ScrollStorytelling } from "@/components/outrank/ScrollStorytelling";
import { ExperimentalFooter } from "@/components/outrank/ExperimentalFooter";
import { BoostPanel } from "@/components/outrank/BoostPanel";
import { EntityDetail } from "@/components/outrank/EntityDetail";
import { GlobalSearch } from "@/components/outrank/GlobalSearch";
import { BattleMode } from "@/components/outrank/BattleMode";
import { AddEntity } from "@/components/outrank/AddEntity";
import { OneCelebration } from "@/components/outrank/OneCelebration";
import { BidCelebration } from "@/components/outrank/BidCelebration";
import { SubscribeDialog } from "@/components/outrank/SubscribeDialog";
import { ShareCard } from "@/components/outrank/ShareCard";
import { EditEntity } from "@/components/outrank/EditEntity";
import { MobileNav } from "@/components/outrank/MobileNav";
import { CustomCursor } from "@/components/outrank/CustomCursor";
import { SoundEngine } from "@/components/outrank/SoundEngine";
import { FirstLoadSequence } from "@/components/outrank/FirstLoadSequence";
import { ProfilePanel } from "@/components/outrank/ProfilePanel";
import { ErrorBoundary } from "@/components/outrank/ErrorBoundary";
import { captureClientEvent } from "@/lib/analytics/client";

export default function HomeClient({ initialData }: { initialData: LeaderState }) {
  const timeframe = useUI((s) => s.timeframe);
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage, isLoading, refetch } = useLeaderboard(initialData, timeframe);
  const rt = useRealtime();
  const category = useUI((s) => s.category);
  const openBoost = useUI((s) => s.openBoost);
  const tab = useUI((s) => s.tab);
  const selected = useUI((s) => s.selected);
  const apiEntities = data?.pages.flatMap((page) => page.entities) ?? [];
  // Settled bids in PostgreSQL are the only authority for money and rank.
  // Realtime is presence/notification transport; it must never overwrite the
  // canonical board with an in-memory projection.
  const entities = apiEntities;
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const bidReturn = searchParams.get("bid");
    if (bidReturn !== "success" && bidReturn !== "cancel") return;
    captureClientEvent(bidReturn === "success" ? "checkout_returned" : "checkout_cancelled", {
      provider: "dodo",
      return_status: bidReturn,
    });
    // Legacy Dodo return URLs may still contain provider metadata. Remove all
    // query parameters; paid bidders are subscribed by the verified webhook.
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`);
    if (bidReturn === "success") {
      void refetch();
      const retryA = window.setTimeout(() => void refetch(), 2_000);
      const retryB = window.setTimeout(() => void refetch(), 6_000);
      return () => {
        window.clearTimeout(retryA);
        window.clearTimeout(retryB);
      };
    }
  }, [refetch]);
  const firstPage = data?.pages[0];
  const activity = rt.activity.length ? rt.activity : firstPage?.activity ?? [];
  const presence = rt.presence || firstPage?.presence || 0;
  const fighting = rt.fighting || 0;
  const loading = isLoading && !entities.length;
  const lastUpdate = rt.lastRankUpdate ? { entityId: rt.lastRankUpdate.entityId, ts: rt.lastRankUpdate.ts } : null;
  const counts = useMemo(() => {
    const m: Partial<Record<Category, number>> = {};
    for (const e of entities) m[e.category] = (m[e.category] || 0) + 1;
    m.global = entities.length;
    return m;
  }, [entities]);

  return (
    <main className="min-h-screen flex flex-col bg-paper text-ink">
      <FirstLoadSequence /><CustomCursor /><SoundEngine lastUpdateTs={lastUpdate?.ts} oneEvent={rt.oneEvent} /><Header />
      <div className="flex-1 flex flex-col">
        {tab === "board" && <>
          <CategoryNavigation counts={counts} /><LiveTicker activity={activity} presence={presence} fighting={fighting} />
          <section className="flex-1"><div className="max-w-[1400px] mx-auto"><ErrorBoundary><Leaderboard entities={entities} category={category} loading={loading} onBoost={openBoost} lastUpdate={lastUpdate} hasMore={hasNextPage} loadingMore={isFetchingNextPage} onLoadMore={() => fetchNextPage()} /></ErrorBoundary></div></section>
          <InternetInMotion /><TrendingMomentum /><ScrollStorytelling />
        </>}
        {tab === "trending" && <div className="sm:hidden flex-1"><TrendingMomentum /></div>}
        {tab === "activity" && <div className="sm:hidden flex-1"><LiveTicker activity={activity} presence={presence} fighting={fighting} variant="vertical" /></div>}
        {tab === "profile" && <div className="sm:hidden flex-1"><ProfilePanel /></div>}
      </div>
      <ExperimentalFooter /><div className="sm:hidden h-14" />
      <BoostPanel /><EntityDetail entity={selected} allEntities={entities} /><GlobalSearch /><BattleMode /><AddEntity /><SubscribeDialog /><ShareCard /><EditEntity />
      <OneCelebration event={rt.oneEvent} /><BidCelebration event={rt.bidCelebration} /><MobileNav />
    </main>
  );
}
