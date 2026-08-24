"use client";

import { useUI } from "@/lib/outrank/store";
import { Search, TrendingUp, Activity, LayoutGrid, User } from "lucide-react";

export function MobileNav() {
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  const setSearchOpen = useUI((s) => s.setSearchOpen);
  const setAddOpen = useUI((s) => s.setAddOpen);

  const items: { id: typeof tab; label: string; icon: any; action?: () => void }[] = [
    { id: "board", label: "BOARD", icon: LayoutGrid },
    { id: "trending", label: "TREND", icon: TrendingUp },
    { id: "search", label: "SEARCH", icon: Search, action: () => setSearchOpen(true) },
    { id: "activity", label: "LIVE", icon: Activity },
    { id: "profile", label: "YOU", icon: User },
  ];

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-ink text-paper grid grid-cols-5 rule-t border-paper/10">
      {items.map((it) => {
        const Icon = it.icon;
        const active = tab === it.id;
        return (
          <button
            key={it.id}
            onClick={() => {
              if (it.id === "profile") setTab("profile");
              else { if (it.action) it.action(); setTab(it.id); }
            }}
            className={`flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
              active ? "text-signal" : "text-paper/60"
            }`}
          >
            <Icon size={16} strokeWidth={2} />
            <span className="font-mono text-[8px] tracking-widest">{it.label}</span>
          </button>
        );
      })}
      <button onClick={() => setAddOpen(true)} className="absolute right-3 -top-5 w-10 h-10 bg-signal text-white flex items-center justify-center rounded-full shadow-lg" aria-label="add entity"><span className="font-display text-xl leading-none">+</span></button>
    </nav>
  );
}
