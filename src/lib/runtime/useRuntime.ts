"use client";

import { useEffect, useMemo } from "react";
import { useRuntimeStore } from "./store";
import type { WorkforceRuntime } from "./types";
import { getAttentionRequired, getTopologyGraph } from "./selectors";
import type { TidyNodeSize } from "./layout";

export const useRuntime = () => useRuntimeStore((state) => state.runtime);
export const useConnection = () => useRuntimeStore((state) => state.connection);
export const useTempEdges = () => useRuntimeStore((state) => state.tempEdges);
export const useFlashes = () => useRuntimeStore((state) => state.flashes);
export const useResync = () => useRuntimeStore((state) => state.resync);

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
  expanded: ReadonlySet<string>,
  focusAgentId?: string | null,
  opts: {
    activate?: (id: string, type: string) => void;
    expandAll?: () => void;
    allExpanded?: boolean;
    toggle?: (id: string) => void;
    sizes?: ReadonlyMap<string, TidyNodeSize>;
    selectedId?: string | null;
    /** Fixture override (dev-only brain fixtures); falls back to live data. */
    runtime?: WorkforceRuntime | null;
  } = {}
) {
  const live = useRuntime();
  const runtime = opts.runtime ?? live;
  const tempEdges = useTempEdges();
  const flashes = useFlashes();
  const activate = opts.activate;
  const expandAll = opts.expandAll;
  const allExpanded = opts.allExpanded;
  const toggle = opts.toggle;
  const sizes = opts.sizes;
  const selectedId = opts.selectedId;
  return useMemo(() => {
    if (!runtime) return { nodes: [], edges: [] };
    return getTopologyGraph(runtime, expanded, focusAgentId ?? undefined, {
      flashes,
      tempEdges,
      activate,
      expandAll,
      allExpanded,
      toggle,
      sizes,
      selectedId,
    });
  }, [runtime, expanded, focusAgentId, tempEdges, flashes, sizes, selectedId, activate, expandAll, allExpanded, toggle]);
}

export function useAttentionRequired() {
  const runtime = useRuntime();
  return useMemo(
    () => (runtime ? getAttentionRequired(runtime) : []),
    [runtime]
  );
}