"use client";

import { useEffect, useRef, useState } from "react";

// Custom cursor (desktop only). Reacts to hovered elements via data-cursor attr.
export function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<string>("VIEW");
  const [active, setActive] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR guard: only enable on client with pointer
    setHidden(false);
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let tx = 0, ty = 0, cx = 0, cy = 0;
    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!active) {
        cx = tx; cy = ty;
        el.style.transform = `translate(${cx}px, ${cy}px)`;
      }
      const t = e.target as HTMLElement;
      const labeled = t.closest("[data-cursor]") as HTMLElement | null;
      if (labeled) {
        setLabel(labeled.dataset.cursor || "VIEW");
        setActive(true);
      } else {
        setActive(false);
      }
    };
    const loop = () => {
      cx += (tx - cx) * 0.22;
      cy += (ty - cy) * 0.22;
      el.style.transform = `translate(${cx}px, ${cy}px)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [active]);

  if (hidden) return null;

  return (
    <div
      ref={ref}
      className="cursor-outrank"
      style={{ marginLeft: -22, marginTop: -22 }}
    >
      <div
        className={`flex items-center justify-center border-2 transition-all duration-200 ${
          active ? "w-[44px] h-[44px] bg-signal border-signal text-white" : "w-[20px] h-[20px] border-ink/60 text-transparent"
        }`}
      >
        {active && <span className="font-mono text-[8px] tracking-widest">{label}</span>}
      </div>
    </div>
  );
}
