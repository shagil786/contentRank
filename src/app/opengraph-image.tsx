import { ImageResponse } from "next/og";

export const alt = "OUTRANK — The internet is competing for attention.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0a",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              background: "#ff3b1f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
            }}
          >
            <span style={{ color: "#0a0a0a", fontSize: 52, fontWeight: 900, letterSpacing: -4 }}>01</span>
          </div>
          <span style={{ color: "#f4f1ea", fontSize: 40, fontWeight: 800, letterSpacing: 2 }}>OUTRANK</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ color: "#f4f1ea", fontSize: 92, fontWeight: 900, letterSpacing: -3, lineHeight: 1.05 }}>
            THE INTERNET IS
          </span>
          <span style={{ color: "#f4f1ea", fontSize: 92, fontWeight: 900, letterSpacing: -3, lineHeight: 1.05 }}>
            COMPETING FOR <span style={{ color: "#ff3b1f" }}>ATTENTION.</span>
          </span>
          <span style={{ color: "#8a8a8a", fontSize: 34, fontWeight: 600, marginTop: 16 }}>
            Paste any link. Boost it. Own the #1 — live.
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#f4f1ea", fontSize: 30, fontWeight: 700, letterSpacing: 2 }}>
            content-rank.lol
          </span>
          <span style={{ color: "#ff3b1f", fontSize: 26, fontWeight: 700, letterSpacing: 2 }}>
            EVERY BID IS PAID
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
