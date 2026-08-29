import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { fetchEntityCard } from "@/server/application/fetch-leaderboard";
import { formatScore } from "@/lib/outrank/types";

export const dynamic = "force-dynamic";

const SIZE = { width: 1200, height: 630 };

const PAPER = "#f4f1ea";
const SIGNAL = "#ff3b1f";
const INK = "#0a0a0a";

function BrandRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <div
        style={{
          width: 96, height: 96, background: SIGNAL, display: "flex",
          alignItems: "center", justifyContent: "center", borderRadius: 8,
        }}
      >
        <span style={{ color: INK, fontSize: 52, fontWeight: 900, letterSpacing: -4 }}>01</span>
      </div>
      <span style={{ color: PAPER, fontSize: 40, fontWeight: 800, letterSpacing: 2 }}>OUTRANK</span>
    </div>
  );
}

function FooterRow() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ color: PAPER, fontSize: 30, fontWeight: 700, letterSpacing: 2 }}>
        content-rank.lol
      </span>
      <span style={{ color: SIGNAL, fontSize: 26, fontWeight: 700, letterSpacing: 2 }}>
        EVERY BID IS PAID
      </span>
    </div>
  );
}

function BrandedCard() {
  return (
    <div
      style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", background: INK, padding: "72px",
        fontFamily: "sans-serif",
      }}
    >
      <BrandRow />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ color: PAPER, fontSize: 92, fontWeight: 900, letterSpacing: -3, lineHeight: 1.05 }}>
          THE INTERNET IS
        </span>
        <span style={{ color: PAPER, fontSize: 92, fontWeight: 900, letterSpacing: -3, lineHeight: 1.05 }}>
          COMPETING FOR <span style={{ color: SIGNAL }}>ATTENTION.</span>
        </span>
        <span style={{ color: "#8a8a8a", fontSize: 34, fontWeight: 600, marginTop: 16 }}>
          Paste any link. Boost it. Own the #1 — live.
        </span>
      </div>
      <FooterRow />
    </div>
  );
}

// GET /api/og-image            → branded site card
// GET /api/og-image?e=<id>     → per-entity card (rank, name, backed total)
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("e");
  const card = id && /^[a-z0-9]{20,32}$/i.test(id)
    ? await fetchEntityCard(id).catch(() => null)
    : null;
  if (!card) return new ImageResponse(<BrandedCard />, { ...SIZE });

  const { content, rank, score } = card;
  // same hue derivation as the leaderboard's generative poster config
  const hue = (content.title.charCodeAt(0) * 7) % 360;
  const name = content.title.toUpperCase();
  const nameSize = name.length > 28 ? 54 : name.length > 16 ? 72 : 92;
  const rankLabel = rank ? `#${String(rank).padStart(2, "0")}` : "LIVE";
  const meta = [
    `${content.kind.toUpperCase()} · ${content.category.toUpperCase()}`,
    score != null ? `${formatScore(score)} BACKED` : null,
  ].filter(Boolean).join("   ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", background: INK, padding: "72px",
          fontFamily: "sans-serif",
          backgroundImage: `linear-gradient(135deg, hsla(${hue}, 90%, 50%, 0.16), transparent 55%)`,
        }}
      >
        <BrandRow />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ color: SIGNAL, fontSize: 120, fontWeight: 900, letterSpacing: -4, lineHeight: 1 }}>
            {rankLabel}
          </span>
          <span style={{ color: PAPER, fontSize: nameSize, fontWeight: 900, letterSpacing: -2, lineHeight: 1.05 }}>
            {name}
          </span>
          <span style={{ color: "#8a8a8a", fontSize: 32, fontWeight: 700, letterSpacing: 3, marginTop: 8 }}>
            {meta}
          </span>
        </div>
        <FooterRow />
      </div>
    ),
    { ...SIZE }
  );
}
