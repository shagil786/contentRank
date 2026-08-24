"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

interface Props {
  event: { entityId: string; entityName: string; ts: number } | null;
}

// Full-screen #1 celebration: brief silence + inverted black flash + giant #1 reveal.
export function OneCelebration({ event }: Props) {
  useEffect(() => {
    if (!event) return;
    // lock scroll briefly
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      document.body.style.overflow = "";
    }, 2400);
    return () => {
      document.body.style.overflow = "";
      clearTimeout(t);
    };
  }, [event]);

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
        >
          {/* inverted backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2.4, times: [0, 0.1, 0.85, 1] }}
            className="absolute inset-0 invert-block"
          />
          {/* signal flash */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.4, 0] }}
            transition={{ duration: 0.5, times: [0, 0.4, 1] }}
            className="absolute inset-0 bg-signal"
          />
          {/* impact ripple */}
          <motion.div
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: [0, 8], opacity: [0.5, 0] }}
            transition={{ duration: 1.4, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute w-32 h-32 rounded-full border-4 border-signal"
          />
          {/* giant #1 */}
          <div className="relative text-center px-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.6, filter: "blur(12px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 1.1, filter: "blur(6px)" }}
              transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
              className="font-display text-paper rank-numeral"
              style={{ fontSize: "clamp(8rem, 38vw, 26rem)", color: "var(--paper)" }}
            >
              01
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="absolute left-0 right-0 -bottom-2 sm:bottom-4"
            >
              <div className="font-mono text-[10px] sm:text-xs tracking-widest text-signal mb-1">NEW #1 ON OUTRANK</div>
              <div className="font-display tracking-tightest text-paper" style={{ fontSize: "clamp(1.2rem,4vw,2.4rem)" }}>
                {event.entityName}
              </div>
            </motion.div>
          </div>
          {/* line burst */}
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: [0, 1, 0] }}
            transition={{ duration: 0.8, times: [0, 0.4, 1] }}
            className="absolute left-1/2 top-0 bottom-0 w-px bg-signal origin-center"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
