"use client";

import { motion } from "framer-motion";
import { CATEGORIES, type Category } from "@/lib/outrank/types";
import { useUI } from "@/lib/outrank/store";

interface Props {
  counts?: Partial<Record<Category, number>>;
}

export function CategoryNavigation({ counts }: Props) {
  const category = useUI((s) => s.category);
  const setCategory = useUI((s) => s.setCategory);
  const setTab = useUI((s) => s.setTab);

  return (
    <div className="rule-t rule-b bg-paper overflow-x-auto no-scrollbar">
      <nav className="flex items-stretch min-w-max">
        {CATEGORIES.map((c) => {
          const active = category === c.id;
          const count = counts?.[c.id];
          return (
            <button
              key={c.id}
              onClick={() => {
                setCategory(c.id);
                setTab("board");
              }}
              aria-pressed={active}
              aria-label={`${c.label}${count !== undefined ? `, ${count} entities` : ""}`}
              className={`relative px-3 sm:px-5 py-2.5 flex items-center gap-2 rule-r font-mono text-[10px] sm:text-[11px] tracking-widest transition-colors ${
                active ? "bg-ink text-paper" : "text-ink hover:bg-paper-dim"
              }`}
            >
              <span className={active ? "text-signal" : "text-muted-foreground"}>{c.num}</span>
              <span>{c.label}</span>
              {count !== undefined && count > 0 && (
                <span className={`text-[9px] ${active ? "text-paper/50" : "text-muted-foreground"}`}>{count}</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
