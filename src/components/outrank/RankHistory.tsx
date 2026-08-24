"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { RankPoint } from "@/lib/outrank/types";

interface Props {
  points: RankPoint[];
  currentRank: number;
  peakRank: number;
}

// Bespoke rank-history visualization.
// Y axis is INVERTED (rank 1 at the top = best). "Lower number = better."
// Features: smooth stepped curve, gradient area fill, hover tooltip with
// rank + score + time, peak marker, current-position marker, gridlines.
export function RankHistory({ points, currentRank, peakRank }: Props) {
  const [hover, setHover] = useState<{ x: number; y: number; p: RankPoint } | null>(null);
  const W = 600;
  const H = 160;
  const PAD_L = 28;
  const PAD_R = 12;
  const PAD_T = 10;
  const PAD_B = 20;

  const { path, area, dots, maxRank, minRank, gridLines } = useMemo(() => {
    if (!points.length) return { path: "", area: "", dots: [], maxRank: 1, minRank: 1, gridLines: [] };
    const ts = points.map((p) => p.t);
    const minT = Math.min(...ts);
    const maxT = Math.max(...ts);
    const ranks = points.map((p) => p.rank);
    const maxRank = Math.max(...ranks, currentRank + 1);
    const minRank = 1;
    const span = maxT - minT || 1;
    const rankSpan = maxRank - minRank || 1;

    const xy = points.map((p) => {
      const x = PAD_L + ((p.t - minT) / span) * (W - PAD_L - PAD_R);
      const y = PAD_T + ((p.rank - minRank) / rankSpan) * (H - PAD_T - PAD_B);
      return { x, y, p };
    });

    // smooth stepped path using horizontal segments with slight curves at corners
    let d = `M ${xy[0].x} ${xy[0].y}`;
    for (let i = 1; i < xy.length; i++) {
      const prev = xy[i - 1];
      const cur = xy[i];
      const midX = (prev.x + cur.x) / 2;
      d += ` L ${midX} ${prev.y} L ${midX} ${cur.y} L ${cur.x} ${cur.y}`;
    }
    const a = `${d} L ${xy[xy.length - 1].x} ${H - PAD_B} L ${xy[0].x} ${H - PAD_B} Z`;

    // gridlines at every 5 ranks (or every rank if <10)
    const step = maxRank > 10 ? 5 : 1;
    const gl: { y: number; rank: number }[] = [];
    for (let r = minRank; r <= maxRank; r += step) {
      const y = PAD_T + ((r - minRank) / rankSpan) * (H - PAD_T - PAD_B);
      gl.push({ y, rank: r });
    }
    return { path: d, area: a, dots: xy, maxRank, minRank, gridLines: gl };
  }, [points, currentRank]);

  if (!points.length) {
    return <div className="font-mono text-[10px] tracking-widest text-muted-foreground py-8 text-center">NO HISTORY YET</div>;
  }

  const formatTime = (t: number) => {
    const d = new Date(t);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="w-full relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[140px]"
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="rh-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--signal)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rh-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--ink)" />
            <stop offset="100%" stopColor="var(--signal)" />
          </linearGradient>
        </defs>

        {/* gridlines */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={g.y} x2={W - PAD_R} y2={g.y} stroke="var(--rule)" strokeWidth="0.5" />
            <text x={2} y={g.y + 3} fontSize="8" fontFamily="var(--font-mono)" fill="var(--muted-foreground)">
              #{String(g.rank).padStart(2, "0")}
            </text>
          </g>
        ))}

        {/* area fill */}
        <motion.path
          d={area}
          fill="url(#rh-area)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        />

        {/* line */}
        <motion.path
          d={path}
          fill="none"
          stroke="url(#rh-line)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: "easeInOut" }}
        />

        {/* peak marker */}
        {dots.map((d, i) =>
          d.p.rank === peakRank ? (
            <g key={`pk${i}`}>
              <line x1={d.x} y1={PAD_T} x2={d.x} y2={H - PAD_B} stroke="var(--signal)" strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
              <rect x={d.x - 16} y={PAD_T - 2} width={32} height={12} fill="var(--signal)" />
              <text x={d.x} y={PAD_T + 7} fontSize="7" fontFamily="var(--font-mono)" fill="white" textAnchor="middle" fontWeight="bold">PEAK</text>
            </g>
          ) : null
        )}

        {/* data points */}
        {dots.map((d, i) => {
          const isLast = i === dots.length - 1;
          const isPeak = d.p.rank === peakRank;
          return (
            <motion.circle
              key={i}
              cx={d.x}
              cy={d.y}
              r={isLast ? 5 : 3}
              fill={isLast ? "var(--signal)" : isPeak ? "var(--signal)" : "var(--ink)"}
              stroke="var(--paper)"
              strokeWidth="1.5"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4 + i * 0.03, duration: 0.2 }}
              className="cursor-pointer"
              onMouseEnter={() => setHover({ x: d.x, y: d.y, p: d.p })}
            />
          );
        })}

        {/* hover tooltip */}
        {hover && (
          <g>
            <line x1={hover.x} y1={PAD_T} x2={hover.x} y2={H - PAD_B} stroke="var(--ink)" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.3" />
          </g>
        )}
      </svg>

      {/* hover tooltip (HTML overlay for crisp text) */}
      {hover && (
        <div
          className="absolute pointer-events-none bg-ink text-paper px-2 py-1.5 font-mono text-[9px] tracking-widest z-10"
          style={{
            left: `${(hover.x / W) * 100}%`,
            top: `${(hover.y / H) * 100}%`,
            transform: "translate(-50%, -130%)",
          }}
        >
          <div className="text-signal">#{String(hover.p.rank).padStart(2, "0")}</div>
          <div>${hover.p.score.toLocaleString()}</div>
          <div className="text-paper/60">{formatTime(hover.p.t)}</div>
        </div>
      )}

      {/* x-axis time labels */}
      <div className="flex justify-between mt-1 px-7">
        <span className="font-mono text-[8px] text-muted-foreground">{formatTime(points[0]?.t)}</span>
        <span className="font-mono text-[8px] text-muted-foreground">{formatTime(points[points.length - 1]?.t)}</span>
      </div>
    </div>
  );
}
