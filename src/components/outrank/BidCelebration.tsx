"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";
import { formatUsd } from "@/lib/outrank/types";

interface Props {
  event: { entityName: string; amount: number; ts: number } | null;
}

// OUTRANK palette — signal red leads, party accents follow.
const BALLOON_COLORS = [
  "#ff3b1f", // signal red
  "#f4c542", // gold
  "#2ecc71", // green
  "#3a86ff", // blue
  "#9b5de5", // purple
];

const CONFETTI_COLORS = [
  "#ff3b1f",
  "#f4c542",
  "#2ecc71",
  "#3a86ff",
  "#9b5de5",
  "#0a0a0a", // ink
  "#f4f1ea", // paper
];

// Deterministic LCG so each event lays out the same across re-renders,
// while still feeling random per-firework.
function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Full-screen celebration overlay: balloons rising + confetti/firecracker burst.
// Triggered whenever a real bid lands. Parent (realtime hook) clears the event
// after 3s; we just render + exit-fade on AnimatePresence.
export function BidCelebration({ event }: Props) {
  const { balloons, confetti } = useMemo(() => {
    const r = makeRng(event?.ts ?? 1);

    const balloons = Array.from({ length: 10 }, (_, i) => {
      const color = BALLOON_COLORS[i % BALLOON_COLORS.length];
      const startX = 4 + r() * 92; // vw
      const size = 34 + r() * 30; // px
      const duration = 2.6 + r() * 1.5; // s — varied rise speeds
      const delay = r() * 0.35; // s
      const sway = 10 + r() * 26; // px horizontal sway
      const drift = (r() - 0.5) * 50; // px terminal drift
      return { color, startX, size, duration, delay, sway, drift };
    });

    const confetti = Array.from({ length: 36 }, (_, i) => {
      const angle = (i / 36) * Math.PI * 2 + r() * 0.35;
      const dist = 110 + r() * 270; // px burst radius
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist - 30; // slight upward bias
      const fall = 220 + r() * 200; // px gravity drop after burst
      const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      const size = 6 + r() * 8; // px
      const rot = (r() - 0.5) * 760; // deg spin
      const duration = 1.5 + r() * 1.1;
      const delay = r() * 0.05;
      return { x, y, fall, color, size, rot, duration, delay };
    });

    return { balloons, confetti };
  }, [event?.ts]);

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          key={event.ts}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] pointer-events-none overflow-hidden"
        >
          {/* radial ink wash — gives the paper/ink center text something to sit on */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0.55, 0] }}
            transition={{ duration: 3, times: [0, 0.12, 0.8, 1] }}
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 45%, rgba(10,10,10,0.72) 0%, rgba(10,10,10,0.35) 38%, rgba(10,10,10,0) 68%)",
            }}
          />

          {/* signal flash */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.22, 0] }}
            transition={{ duration: 0.5, times: [0, 0.35, 1] }}
            className="absolute inset-0 bg-signal"
          />

          {/* center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
              className="font-mono text-[10px] sm:text-xs tracking-[0.3em] text-signal mb-2"
            >
              NEW BID
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(4px)" }}
              transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1], delay: 0.05 }}
              className="font-display tracking-tighter2 leading-[0.95] text-paper"
              style={{ fontSize: "clamp(1.8rem,6vw,4rem)" }}
            >
              {event.entityName}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1], delay: 0.12 }}
              className="font-display tracking-tighter2 text-signal mt-1"
              style={{ fontSize: "clamp(1.4rem,5vw,3rem)" }}
            >
              {formatUsd(event.amount)}
            </motion.div>
          </div>

          {/* balloons rising from the bottom */}
          {balloons.map((b, i) => (
            <motion.div
              key={`b${i}`}
              initial={{ y: "115vh", x: 0, opacity: 0 }}
              animate={{
                y: ["115vh", "70vh", "30vh", "-5vh", "-30vh"],
                x: [0, b.sway, -b.sway, b.sway * 0.5, b.drift],
                opacity: [0, 1, 1, 0.9, 0],
              }}
              transition={{
                duration: b.duration,
                delay: b.delay,
                times: [0, 0.25, 0.55, 0.8, 1],
                ease: "easeOut",
              }}
              className="absolute will-change-transform"
              style={{ left: `${b.startX}vw`, bottom: 0 }}
            >
              <Balloon color={b.color} size={b.size} />
            </motion.div>
          ))}

          {/* confetti / firecracker burst from screen center */}
          <div
            className="absolute left-1/2 top-1/2"
            style={{ width: 0, height: 0 }}
            aria-hidden
          >
            {confetti.map((c, i) => (
              <motion.span
                key={`c${i}`}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                animate={{
                  x: [0, c.x, c.x * 0.7],
                  y: [0, c.y, c.y + c.fall],
                  opacity: [1, 1, 0],
                  scale: [1, 1, 0.55],
                  rotate: [0, c.rot * 0.5, c.rot],
                }}
                transition={{
                  duration: c.duration,
                  delay: c.delay,
                  times: [0, 0.42, 1],
                  ease: "easeOut",
                }}
                className="absolute block will-change-transform"
                style={{
                  width: c.size,
                  height: c.size * 1.4,
                  background: c.color,
                  marginLeft: -c.size / 2,
                  marginTop: -(c.size * 1.4) / 2,
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// A balloon = colored body (with highlight) + knot + dangling string.
// Pure CSS — no images, transform-friendly.
function Balloon({ color, size }: { color: string; size: number }) {
  return (
    <div style={{ width: size, height: size * 1.3, position: "relative" }}>
      {/* string */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: size,
          width: 1,
          height: size * 0.9,
          background: "rgba(244,241,234,0.55)",
          transform: "translateX(-50%)",
        }}
      />
      {/* knot */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: size - 3,
          width: 5,
          height: 5,
          background: color,
          transform: "translateX(-50%) rotate(45deg)",
        }}
      />
      {/* body */}
      <div
        style={{
          width: size,
          height: size * 1.2,
          borderRadius: "50% 50% 48% 48% / 55% 55% 45% 45%",
          background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.6), ${color} 58%)`,
          boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
        }}
      />
    </div>
  );
}
