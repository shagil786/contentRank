"use client";

import { useEffect, useMemo, useRef } from "react";
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
import { EntityClaim } from "@/components/outrank/EntityClaim";
import { PostBidPrompt } from "@/components/outrank/PostBidPrompt";
import { ShareCard } from "@/components/outrank/ShareCard";
import { EditEntity } from "@/components/outrank/EditEntity";
import { MobileNav } from "@/components/outrank/MobileNav";
import { CustomCursor } from "@/components/outrank/CustomCursor";
import { SoundEngine } from "@/components/outrank/SoundEngine";
import { FirstLoadSequence } from "@/components/outrank/FirstLoadSequence";
import { ProfilePanel } from "@/components/outrank/ProfilePanel";
import { ErrorBoundary } from "@/components/outrank/ErrorBoundary";

export default function HomeClient({ initialData }: { initialData: LeaderState }) {
  const timeframe = useUI((s) => s.timeframe);
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useLeaderboard(initialData, timeframe);
  const rt = useRealtime();
  const category = useUI((s) => s.category);
  const openBoost = useUI((s) => s.openBoost);
  const tab = useUI((s) => s.tab);
  const selected = useUI((s) => s.selected);
  const apiEntities = data?.pages.flatMap((page) => page.entities) ?? [];
  const entities = useMemo(() => {
    const byId = new Map(apiEntities.map((entity) => [entity.id, entity]));
    // Realtime snapshots contain cumulative/all-time scores. Do not let them
    // overwrite the API's day-scoped scores while TODAY is selected.
    if (timeframe === "alltime") {
      for (const entity of rt.entities) byId.set(entity.id, entity);
    }
    return Array.from(byId.values());
  }, [apiEntities, rt.entities, timeframe]);
  const openedReturnPrompt = useRef(false);
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const entityId = searchParams.get("entityId");
    if (searchParams.get("bid") !== "success" || !entityId || openedReturnPrompt.current) return;
    const entity = entities.find((item) => item.id === entityId);
    if (!entity) return;
    openedReturnPrompt.current = true;
    useUI.getState().openPostBid(entity, Number(searchParams.get("amount")) || 100);
  }, [entities]);
  const firstPage = data?.pages[0];
  const activity = rt.activity.length ? rt.activity : firstPage?.activity ?? [];
  const presence = rt.presence || firstPage?.presence || 0;
  const fighting = rt.fighting || 0;
  const loading = !entities.length;
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
      <BoostPanel /><PostBidPrompt /><EntityDetail entity={selected} allEntities={entities} /><GlobalSearch /><BattleMode /><AddEntity /><SubscribeDialog /><EntityClaim /><ShareCard /><EditEntity />
      <OneCelebration event={rt.oneEvent} /><BidCelebration event={rt.bidCelebration} /><MobileNav />
    </main>
  );
}
