"use client";

import { useEffect, useMemo } from "react";
import { useRuntimeStore } from "./store";
import type { WorkforceRuntime } from "./types";
import {
  getAttentionRequired,
  getTopologyGraph,
} from "./selectors";

export const useRuntime = () => useRuntimeStore((state) => state.runtime);
export const useConnection = () => useRuntimeStore((state) => state.connection);
export const useTempEdges = () => useRuntimeStore((state) => state.tempEdges);
export const useFlashes = () => useRuntimeStore((state) => state.flashes);

export function useSubscribeRuntime() {
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/runtime/snapshot", { cache: "no-store" });
        if (!res.ok) throw new Error(`snapshot failed: ${res.status}`);
        const data = (await res.json()) as { runtime: WorkforceRuntime };
        if (cancelled) return;
        useRuntimeStore.getState().initializeWithSnapshot(data.runtime);
      } catch {
        // snapshot unavailable; the events poll will still run and report
        // DISCONNECTED until it recovers.
      }
      if (cancelled) return;
      unsub = useRuntimeStore.getState().subscribeToEvents();
    })();
    return () => {
      cancelled = true;
      unsub?.();
      useRuntimeStore.getState().unsubscribe();
    };
  }, []);
}

export function useTopologyGraph(
  zoom: number,
  focusAgentId?: string | null,
  opts: { narrow?: boolean; activate?: (id: string, type: string) => void } = {}
) {
  const runtime = useRuntime();
  const tempEdges = useTempEdges();
  const flashes = useFlashes();
  const narrow = opts.narrow;
  const activate = opts.activate;
  return useMemo(() => {
    if (!runtime) return { nodes: [], edges: [] };
    return getTopologyGraph(runtime, zoom, focusAgentId ?? undefined, {
      narrow,
      flashes,
      tempEdges,
      activate,
    });
  }, [runtime, zoom, focusAgentId, tempEdges, flashes, narrow, activate]);
}

export function useAttentionRequired() {
  const runtime = useRuntime();
  return useMemo(
    () => (runtime ? getAttentionRequired(runtime) : []),
    [runtime]
  );
}