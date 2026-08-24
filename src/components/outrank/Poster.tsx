"use client";

import { memo, useState } from "react";
import type { Entity } from "@/lib/outrank/types";

interface Props {
  entity: Pick<Entity, "name" | "poster" | "category" | "kind" | "image" | "link">;
  className?: string;
  variant?: "poster" | "thumb" | "hero";
}

// Poster component: shows the real og:image (from the link the submitter added)
// when available, falling back to the deterministic generative SVG poster.
// The og:image is fetched server-side at submit time and stored on the entity.
function PosterInner({ entity, className = "", variant = "poster" }: Props) {
  const { name, poster, category, kind, image } = entity;
  const [imgError, setImgError] = useState(false);
  const imageSrc = image?.startsWith("http://") || image?.startsWith("https://")
    ? `/api/image?url=${encodeURIComponent(image)}`
    : image;
  const showImage = imageSrc && !imgError;

  // generative poster config
  const initials = name
    .split(/\s+/)
    .filter((w) => /[A-Z0-9]/.test(w[0] || ""))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  const hue = poster?.hue ?? 0;
  const accent = poster?.accent ?? "#ff3b1f";
  const tag = poster?.tag ?? kind?.toUpperCase()?.slice(0, 4) ?? "RANK";
  const id = `pg-${name.replace(/[^a-z0-9]/gi, "")}-${hue}`;
  const seed = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const lines = Array.from({ length: 7 }, (_, i) => ((seed >> i) & 0x3) + 1);

  // ---- THUMB variant ----
  if (variant === "thumb") {
    return (
      <div
        className={`relative overflow-hidden ${className}`}
        style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 22%) 0%, hsl(${(hue + 40) % 360} 60% 10%) 100%)` }}
      >
        {showImage && (
          <img
            src={imageSrc}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        )}
        {!showImage && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity="0.85" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" fill={`url(#${id})`} />
            {lines.map((n, i) => (
              <line key={i} x1="0" y1={i * 14 + n} x2="100" y2={i * 14 + n - 20} stroke="#fff" strokeOpacity="0.06" strokeWidth="0.5" />
            ))}
          </svg>
        )}
        {!showImage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display rank-numeral text-white/90" style={{ fontSize: "2.6rem", lineHeight: 0.8 }}>
              {initials}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ---- POSTER / HERO variant ----
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: `linear-gradient(150deg, hsl(${hue} 68% 20%) 0%, hsl(${(hue + 30) % 360} 55% 8%) 100%)` }}
    >
      {showImage && (
        <img
          src={imageSrc}
          alt={name}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      )}
      {!showImage && (
        <svg viewBox="0 0 400 560" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.9" />
              <stop offset="55%" stopColor={accent} stopOpacity="0.15" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
            <radialGradient id={`${id}-r`} cx="0.3" cy="0.2" r="0.9">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.12" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>
          <rect width="400" height="560" fill={`url(#${id})`} />
          <rect width="400" height="560" fill={`url(#${id}-r)`} />
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 33.3} y1="0" x2={i * 33.3} y2="560" stroke="#fff" strokeOpacity="0.04" strokeWidth="0.6" />
          ))}
          {Array.from({ length: 16 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 35} x2="400" y2={i * 35} stroke="#fff" strokeOpacity="0.04" strokeWidth="0.6" />
          ))}
          <line x1="-40" y1="120" x2="440" y2="40" stroke={accent} strokeOpacity="0.5" strokeWidth="2" />
          <line x1="-40" y1="500" x2="440" y2="420" stroke={accent} strokeOpacity="0.3" strokeWidth="1" />
          <text
            x="200"
            y="320"
            textAnchor="middle"
            fontFamily="var(--font-display), sans-serif"
            fontWeight="900"
            fontSize={variant === "hero" ? "120" : "100"}
            fill="#fff"
            fillOpacity="0.12"
            style={{ letterSpacing: "-0.06em" }}
          >
            {initials}
          </text>
        </svg>
      )}

      {/* overlay typography (always visible, on top of image or SVG) */}
      <div className="absolute inset-0 flex flex-col justify-between p-4 text-white">
        <div className="flex items-start justify-between">
          <span className="font-mono text-[10px] tracking-widest opacity-80">{tag}</span>
          <span className="font-mono text-[10px] tracking-widest opacity-80">{category.toUpperCase()}</span>
        </div>
        <div>
          <div className="font-mono text-[10px] tracking-widest opacity-70 mb-1">OUTRANK</div>
          <div className="font-display leading-[0.82] tracking-tightest" style={{ fontSize: variant === "hero" ? "clamp(1.6rem,3vw,2.4rem)" : "clamp(1.2rem,2vw,1.6rem)" }}>
            {name}
          </div>
        </div>
      </div>
    </div>
  );
}

export const Poster = memo(PosterInner);
