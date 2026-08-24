"use client";

import { useEffect, useRef } from "react";
import { useUI } from "@/lib/outrank/store";

// Subtle WebAudio UI sounds. Muted unless the user toggles sound on.

function getCtx(ref: React.MutableRefObject<AudioContext | null>): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ref.current) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AC) ref.current = new AC();
  }
  return ref.current;
}

function playBlip(ctx: AudioContext) {
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(660, t);
  o.frequency.exponentialRampToValueAtTime(880, t + 0.08);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.2);
}

function playChord(ctx: AudioContext) {
  const t = ctx.currentTime;
  [523.25, 659.25, 783.99].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(f, t + i * 0.04);
    g.gain.setValueAtTime(0.0001, t + i * 0.04);
    g.gain.exponentialRampToValueAtTime(0.06, t + i * 0.04 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.04 + 0.9);
    o.connect(g).connect(ctx.destination);
    o.start(t + i * 0.04);
    o.stop(t + i * 0.04 + 1.0);
  });
}

export function SoundEngine({ lastUpdateTs, oneEvent }: { lastUpdateTs?: number | null; oneEvent?: { ts: number } | null }) {
  const soundOn = useUI((s) => s.soundOn);
  const ctxRef = useRef<AudioContext | null>(null);
  const lastPlayRef = useRef(0);

  useEffect(() => {
    if (!soundOn) return;
    if (!lastUpdateTs) return;
    if (Date.now() - lastPlayRef.current < 250) return;
    lastPlayRef.current = Date.now();
    const ctx = getCtx(ctxRef);
    if (ctx) playBlip(ctx);
  }, [lastUpdateTs, soundOn]);

  useEffect(() => {
    if (!soundOn || !oneEvent) return;
    const ctx = getCtx(ctxRef);
    if (ctx) playChord(ctx);
  }, [oneEvent, soundOn]);

  return null;
}
