"use client";

import { motion, AnimatePresence } from "framer-motion";

interface Props {
  rank: number;
  size?: "sm" | "md" | "lg" | "xl" | "hero";
  className?: string;
  pulse?: boolean;
}

const SIZE_CLASS: Record<NonNullable<Props["size"]>, string> = {
  sm: "text-[1.6rem] sm:text-[2rem]",
  md: "text-[2.4rem] sm:text-[3rem]",
  lg: "text-[3.4rem] sm:text-[4.4rem]",
  xl: "rank-clamp",
  hero: "rank-clamp-xl",
};

// Renders rank as two-digit zero-padded numeral that morphs on change.
export function RankNumber({ rank, size = "md", className = "", pulse = false }: Props) {
  const padded = String(Math.max(1, rank)).padStart(2, "0");

  return (
    <span className={`rank-numeral ${SIZE_CLASS[size]} ${className} inline-flex`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={padded}
          initial={{ y: "0.6em", opacity: 0, filter: "blur(4px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ y: "-0.6em", opacity: 0, filter: "blur(4px)" }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          className={pulse ? "text-signal" : ""}
        >
          {padded}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

interface DeltaProps {
  delta: number; // positive = rose, negative = fell, 0 = no change
  className?: string;
  showArrow?: boolean;
}

export function RankDelta({ delta, className = "", showArrow = true }: DeltaProps) {
  if (delta === 0)
    return (
      <span className={`font-mono text-[10px] tracking-widest text-muted-foreground ${className}`}>—</span>
    );
  const up = delta > 0;
  return (
    <span
      className={`font-mono text-[10px] sm:text-[11px] tracking-widest ${up ? "text-up" : "text-down"} ${className} inline-flex items-center gap-0.5`}
    >
      {showArrow && <span>{up ? "▲" : "▼"}</span>}
      <span>{Math.abs(delta)}</span>
    </span>
  );
}
