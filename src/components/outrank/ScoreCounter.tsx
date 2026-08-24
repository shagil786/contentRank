"use client";

import { useEffect, useRef, useState } from "react";
import { formatScore } from "@/lib/outrank/types";

interface Props {
  value: number;
  className?: string;
  duration?: number;
  format?: (n: number) => string;
}

// Smoothly rolls a number toward `value` whenever it changes.
export function ScoreCounter({ value, className = "", duration = 700, format = formatScore }: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    startRef.current = null;
    fromRef.current = to;

    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / duration);
      const cur = Math.round(from + (to - from) * ease(t));
      setDisplay(cur);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <span className={`num-roll ${className}`}>{format(display)}</span>;
}

// Plain integer roll (no K/M formatting)
export function IntCounter({ value, className = "", duration = 600 }: Props) {
  return <ScoreCounter value={value} className={className} duration={duration} format={(n) => Math.round(n).toString()} />;
}
