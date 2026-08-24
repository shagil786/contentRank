"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

// Cinematic first-load: black → LIVE indicator → giant "01" flash → reveal.
export function FirstLoadSequence() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 100),
      setTimeout(() => setStage(2), 320),
      setTimeout(() => setStage(3), 700),
      setTimeout(() => setStage(4), 1000),
      setTimeout(() => setStage(5), 1300),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const done = stage >= 5;

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[120] bg-ink text-paper flex items-center justify-center overflow-hidden"
        >
          {/* stage 1: LIVE dot */}
          {stage >= 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute top-6 left-6 font-mono text-[10px] tracking-widest text-signal flex items-center gap-2"
            >
              <span className="inline-block w-2 h-2 bg-signal live-dot" /> LIVE
            </motion.div>
          )}

          {/* stage 2: giant 01 flash */}
          {stage >= 2 && stage < 4 && (
            <motion.div
              key="one"
              initial={{ opacity: 0, scale: 0.6, filter: "blur(20px)" }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1, 1, 1.3], filter: ["blur(20px)", "blur(0px)", "blur(0px)", "blur(8px)"] }}
              transition={{ duration: 0.6, times: [0, 0.4, 0.7, 1] }}
              className="font-display rank-numeral text-paper"
              style={{ fontSize: "clamp(8rem, 35vw, 24rem)" }}
            >
              01
            </motion.div>
          )}

          {/* stage 3/4: OUTRANK title */}
          {stage >= 3 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute bottom-8 left-0 right-0 text-center"
            >
              <div className="font-display tracking-tightest text-paper text-3xl sm:text-5xl">OUTRANK</div>
              <div className="font-mono text-[9px] tracking-widest text-paper/50 mt-2">THE INTERNET IS COMPETING FOR ATTENTION</div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
