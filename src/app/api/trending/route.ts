import { NextResponse } from "next/server";
import { realtimeUrl } from "@/server/infrastructure/realtime-url";
import type { Entity } from "@/lib/outrank/types";

export const dynamic = "force-dynamic";

// GET /api/trending — fastest rising & falling across all entities
export async function GET() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(realtimeUrl("state"), {
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(t);
    if (!res.ok) throw new Error("bad_status");
    const data = await res.json();
    const ents: Entity[] = data.entities || [];
    const rising = [...ents]
      .filter((e) => e.momentum > 0)
      .sort((a, b) => b.momentum - a.momentum)
      .slice(0, 8);
    const falling = [...ents]
      .filter((e) => e.momentum < 0)
      .sort((a, b) => a.momentum - b.momentum)
      .slice(0, 8);
    return NextResponse.json({ rising, falling }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ rising: [], falling: [] });
  }
}
