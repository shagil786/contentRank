"use client";

import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useUI } from "@/lib/outrank/store";
import { useSearch, useRealtime } from "./providers";
import { Poster } from "./Poster";
import { CATEGORIES } from "@/lib/outrank/types";
import type { Category, Entity } from "@/lib/outrank/types";

export function GlobalSearch() {
  const open = useUI((s) => s.searchOpen);
  const setSearchOpen = useUI((s) => s.setSearchOpen);
  const setCategory = useUI((s) => s.setCategory);
  const openEntity = useUI((s) => s.openEntity);
  const setTab = useUI((s) => s.setTab);
  const [q, setQ] = useState("");
  const { data } = useSearch(q);
  const { entities } = useRealtime();

  const handleOpenChange = (o: boolean) => {
    setSearchOpen(o);
    if (!o) setQ("");
  };

  // ⌘K / ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        handleOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pick = (e: Entity) => {
    handleOpenChange(false);
    openEntity(e);
  };

  const goCategory = (c: Category) => {
    handleOpenChange(false);
    setCategory(c);
    setTab("board");
  };

  const results = data?.results || [];
  // also show local quick results from live entities for instant feel
  const instant = q
    ? entities.filter((e) => e.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6)
    : [];

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange} className="bg-paper text-ink border-ink">
      <CommandInput
        placeholder="SEARCH BY NAME…"
        value={q}
        onValueChange={setQ}
        className="font-mono"
      />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty className="font-mono text-[11px] tracking-widest text-muted-foreground py-8">
          NO ONE OWNS THIS QUERY YET.
        </CommandEmpty>

        {instant.length > 0 && (
          <CommandGroup heading="LIVE NOW" className="font-mono text-[10px] tracking-widest text-muted-foreground">
            {instant.map((e) => (
              <CommandItem
                key={e.id}
                value={`${e.name} ${e.id}`}
                onSelect={() => pick(e)}
                className="gap-3 py-2"
              >
                <Poster entity={e} variant="thumb" className="h-9 w-7 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-display tracking-tighter2 text-sm">{e.name}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{e.sub}</div>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">#{String(e.rank).padStart(2, "0")}</div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.length > 0 && (
          <CommandGroup heading="RESULTS" className="font-mono text-[10px] tracking-widest text-muted-foreground">
            {results
              .filter((r) => !instant.find((i) => i.id === r.id))
              .map((e) => (
                <CommandItem
                  key={e.id}
                  value={`${e.name} ${e.id}`}
                  onSelect={() => pick(e as Entity)}
                  className="gap-3 py-2"
                >
                  <Poster entity={e} variant="thumb" className="h-9 w-7 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-display tracking-tighter2 text-sm">{e.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{e.sub}</div>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">#{String(e.rank).padStart(2, "0")}</div>
                </CommandItem>
              ))}
          </CommandGroup>
        )}

        <CommandGroup heading="JUMP TO CATEGORY" className="font-mono text-[10px] tracking-widest text-muted-foreground">
          {CATEGORIES.map((c) => (
            <CommandItem key={c.id} value={`cat ${c.label} ${c.num}`} onSelect={() => goCategory(c.id)} className="gap-3 py-2">
              <span className="font-mono text-[10px] text-signal">{c.num}</span>
              <span className="font-mono text-xs tracking-widest">{c.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {!q && (
          <CommandGroup heading="PUT SOMETHING ON THE BOARD" className="font-mono text-[10px] tracking-widest text-muted-foreground">
            <CommandItem
              onSelect={() => {
                handleOpenChange(false);
                useUI.getState().setAddOpen(true);
              }}
              className="gap-3 py-2"
            >
              <span className="font-mono text-[10px] text-signal">+</span>
              <span className="font-mono text-xs tracking-widest">ADD A NEW ENTITY</span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
