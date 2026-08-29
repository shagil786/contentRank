import { headers } from "next/headers";
import type { Metadata } from "next";
import { fetchEntityCard } from "@/server/application/fetch-leaderboard";
import { formatScore, type LeaderState } from "@/lib/outrank/types";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

const FALLBACK: LeaderState = {
  entities: [], activity: [], presence: 0, totalBoosts: 0, ts: Date.now(),
};

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

// Shared entity links (?e=<id>) must resolve metadata server-side: social
// crawlers don't run JS, so the client-rendered detail sheet is invisible to
// them. Returning {} falls back to the root layout's generic OUTRANK card.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const e = (await searchParams).e;
  const id = typeof e === "string" ? e : undefined;
  if (!id || !/^[a-z0-9]{20,32}$/i.test(id)) return {};
  try {
    const card = await fetchEntityCard(id);
    if (!card) return {};
    const rankLabel = card.rank ? `#${card.rank}` : "live";
    const title = `${card.content.title.toUpperCase()} — ${rankLabel} on OUTRANK`;
    const description = card.score != null
      ? `${formatScore(card.score)} backed and ranked ${rankLabel}. Boost it to own the #1.`
      : "Boost what you love up the board. Watch ranks move live. Own the #1.";
    const image = `/api/og-image?e=${encodeURIComponent(card.content.id)}`;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        images: [{ url: image, width: 1200, height: 630, alt: card.content.title }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
    };
  } catch {
    return {};
  }
}

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
