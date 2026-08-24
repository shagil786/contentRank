"use client";

import { QueryClient, QueryClientProvider, useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type {
  LeaderState,
  ServerEvent,
  BoostRequest,
  Entity,
  ActivityEvent,
} from "@/lib/outrank/types";

export { useQuery, useInfiniteQuery, useMutation, useQueryClient, QueryClient };

export function QueryProvider({ children }: { children: ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------- Realtime socket singleton ----------------
let socketSingleton: Socket | null = null;

export function getSocket(): Socket {
  if (socketSingleton) return socketSingleton;
  socketSingleton = io("/?XTransformPort=3003", {
    transports: ["websocket", "polling"],
    forceNew: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 4000,
    timeout: 10000,
  });
  return socketSingleton;
}

// ---------------- Hooks ----------------
export function useLeaderboard(initialData?: LeaderState) {
  return useInfiniteQuery<LeaderState>({
    queryKey: ["leaderboard"],
    queryFn: async ({ pageParam }) => {
      const r = await fetch(`/api/leaderboard?limit=48&cursor=${pageParam as number}`, { cache: "no-store" });
      if (!r.ok) throw new Error("fetch_failed");
      return r.json();
    },
    initialPageParam: 0,
    initialData: initialData ? { pages: [initialData], pageParams: [0] } : undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ? Number(lastPage.nextCursor) : undefined,
    staleTime: 1000,
  });
}

export function useTrending() {
  return useQuery<{ rising: any[]; falling: any[] }>({
    queryKey: ["trending"],
    queryFn: async () => {
      const r = await fetch("/api/trending", { cache: "no-store" });
      if (!r.ok) throw new Error("fetch_failed");
      return r.json();
    },
    staleTime: 5000,
  });
}

export function useSearch(q: string) {
  return useQuery<{ results: any[] }>({
    queryKey: ["search", q],
    queryFn: async () => {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      if (!r.ok) throw new Error("fetch_failed");
      return r.json();
    },
    enabled: q.length > 0,
    staleTime: 2000,
  });
}

export interface RealtimeState {
  connected: boolean;
  presence: number;
  fighting: number;
  entities: Entity[];
  activity: ActivityEvent[];
  totalBoosts: number;
  lastRankUpdate: any | null;
  oneEvent: { entityId: string; entityName: string; ts: number } | null;
  bidCelebration: { entityName: string; amount: number; ts: number } | null;
}

export function useRealtime() {
  const qc = useQueryClient();
  const [state, setState] = useState<RealtimeState>({
    connected: false,
    presence: 0,
    fighting: 0,
    entities: [],
    activity: [],
    totalBoosts: 0,
    lastRankUpdate: null,
    oneEvent: null,
    bidCelebration: null,
  });
  const oneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bidTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventTsRef = useRef(0);

  useEffect(() => {
    const s = getSocket();

    const onDisconnect = () => setState((p) => ({ ...p, connected: false }));

    const onSnapshot = (ev: any) => {
      const st = ev.state as LeaderState;
      lastEventTsRef.current = Math.max(lastEventTsRef.current, st.ts || 0);
      setState((p) => ({
        ...p,
        entities: st.entities,
        activity: st.activity,
        presence: st.presence,
        totalBoosts: st.totalBoosts,
      }));
      // Keep the cache in the shape expected by useInfiniteQuery. The
      // realtime snapshot is the newest first page, but must not replace the
      // whole InfiniteData object with a plain LeaderState.
      qc.setQueryData<{ pages: LeaderState[]; pageParams: unknown[] }>(["leaderboard"], (current) => {
        if (!current) return { pages: [st], pageParams: [0] };
        return { ...current, pages: [st, ...current.pages.slice(1)] };
      });
    };

    const onConnect = () => {
      setState((p) => ({ ...p, connected: true }));
      s.emit("state.sync", { since: lastEventTsRef.current }, (ev: any) => {
        if (ev?.state) onSnapshot(ev);
      });
    };

    const onRank = (ev: any) => {
      lastEventTsRef.current = Math.max(lastEventTsRef.current, ev.ts || 0);
      setState((p) => {
        // reorder entities by recomputing ranks from score
        const next = [...p.entities];
        const idx = next.findIndex((e) => e.id === ev.entityId);
        if (idx >= 0) {
          const e = { ...next[idx] };
          e.prevRank = ev.prevRank;
          e.rank = ev.newRank;
          e.score = ev.newScore;
          next[idx] = e;
        }
        // also nudge displaced entities' ranks (approx) — they will be corrected by next snapshot
        next.sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
        next.forEach((e, i) => (e.rank = i + 1));
        return { ...p, entities: next, lastRankUpdate: ev };
      });
    };

    const onActivity = (ev: any) => {
      const a = ev.event as ActivityEvent;
      lastEventTsRef.current = Math.max(lastEventTsRef.current, a.ts || 0);
      setState((p) => ({ ...p, activity: [a, ...p.activity].slice(0, 60) }));
    };

    const onPresence = (ev: any) => {
      setState((p) => ({ ...p, presence: ev.count, fighting: ev.fighting }));
    };

    const onLeader = (ev: any) => {
      // #1 celebration trigger
      const one = { entityId: ev.entityId, entityName: ev.entityName, ts: Date.now() };
      setState((p) => ({ ...p, oneEvent: one }));
      if (oneTimeoutRef.current) clearTimeout(oneTimeoutRef.current);
      oneTimeoutRef.current = setTimeout(() => {
        setState((p) => ({ ...p, oneEvent: null }));
      }, 2600);
    };

    const onBidCelebration = (ev: any) => {
      // celebration overlay (balloons + firecrackers) when any new bid is added
      const bid = { entityName: ev.entityName, amount: ev.amount, ts: Date.now() };
      setState((p) => ({ ...p, bidCelebration: bid }));
      if (bidTimeoutRef.current) clearTimeout(bidTimeoutRef.current);
      bidTimeoutRef.current = setTimeout(() => {
        setState((p) => ({ ...p, bidCelebration: null }));
      }, 3000);
    };

    const onEntityAdded = (ev: any) => {
      // a new entity was submitted (by this user or another). Add it to local
      // state immediately so it appears on the board without waiting for a
      // reconnect snapshot. Carries link/image if the submitter provided them.
      const e = ev.entity as Entity;
      setState((p) => {
        if (p.entities.find((x) => x.id === e.id)) return p;
        const next = [...p.entities, e];
        next.sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
        next.forEach((x, i) => (x.rank = i + 1));
        return { ...p, entities: next };
      });
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("snapshot", onSnapshot);
    s.on("rank.updated", onRank);
    s.on("activity.created", onActivity);
    s.on("presence.updated", onPresence);
    s.on("leader.changed", onLeader);
    s.on("bid.celebration", onBidCelebration);
    s.on("entity.added", onEntityAdded);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("snapshot", onSnapshot);
      s.off("rank.updated", onRank);
      s.off("activity.created", onActivity);
      s.off("presence.updated", onPresence);
      s.off("leader.changed", onLeader);
      s.off("bid.celebration", onBidCelebration);
      s.off("entity.added", onEntityAdded);
    };
  }, [qc]);

  const boost = useCallback((req: BoostRequest) => {
    const s = getSocket();
    s.emit("boost", req);
  }, []);

  const preview = useCallback(
    (entityId: string, amount: number): Promise<{ newRank: number; prevRank: number; newScore: number } | null> => {
      return new Promise((resolve) => {
        const s = getSocket();
        const to = setTimeout(() => resolve(null), 1200);
        s.emit("preview", { entityId, amount }, (r: any) => {
          clearTimeout(to);
          resolve(r);
        });
      });
    },
    []
  );

  const addEntity = useCallback(
    (req: any): Promise<any> => {
      return new Promise((resolve) => {
        const s = getSocket();
        const to = setTimeout(() => resolve({ ok: false, reason: "timeout" }), 2000);
        s.emit("add", req, (r: any) => {
          clearTimeout(to);
          resolve(r);
        });
      });
    },
    []
  );

  return { ...state, boost, preview, addEntity };
}
