import { headers } from "next/headers";
import type { LeaderState } from "@/lib/outrank/types";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

const FALLBACK: LeaderState = {
  entities: [], activity: [], presence: 0, totalBoosts: 0, ts: Date.now(),
};

async function getInitialLeaderboard(): Promise<LeaderState> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  if (!host) return FALLBACK;
  const protocol = requestHeaders.get("x-forwarded-proto") || "http";
  try {
    const response = await fetch(`${protocol}://${host}/api/leaderboard?limit=48`, { cache: "no-store" });
    return response.ok ? await response.json() as LeaderState : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export default async function Home() {
  return <HomeClient initialData={await getInitialLeaderboard()} />;
}
