"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const LINES = [
  { text: "ATTENTION", sub: "IS A MARKET." },
  { text: "EVERY SECOND", sub: "SOMETHING MOVES." },
  { text: "TODAY'S #1", sub: "IS TOMORROW'S #47." },
  { text: "THE BOARD", sub: "NEVER STOPS." },
];

export function ScrollStorytelling() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-25%"]);

  return (
    <section ref={ref} className="relative invert-block overflow-hidden">
      {/* moving mini leaderboard in background */}
      <motion.div
        style={{ x }}
        className="absolute inset-0 flex items-center opacity-[0.07] pointer-events-none select-none"
      >
        <div className="font-display rank-clamp-xl whitespace-nowrap tracking-tightest">
          01 · 02 · 03 · 04 · 05 · 06 · 07 · 08 · 09 · 10 · 11 · 12 · 13 · 14 · 15 · 16 · 17 · 18 · 19 · 20
        </div>
      </motion.div>

      <div className="relative px-6 sm:px-10 py-24 sm:py-36">
        <div className="font-mono text-[10px] tracking-widest text-signal mb-12 sm:mb-20">
          / THE INTERNET IN MOTION
        </div>
        <div className="space-y-16 sm:space-y-24 max-w-5xl">
          {LINES.map((l, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15%" }}
              transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex items-baseline gap-4 sm:gap-8"
            >
              <span className="font-mono text-[10px] tracking-widest text-paper/40 w-[40px] shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <div className="font-display tracking-tightest text-paper leading-[0.82]" style={{ fontSize: "clamp(2.4rem,8vw,6rem)" }}>
                  {l.text}
                </div>
                <div className="font-display tracking-tightest text-signal leading-[0.82] mt-1" style={{ fontSize: "clamp(2.4rem,8vw,6rem)" }}>
                  {l.sub}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
