"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { deriveSignals, type SignalGraph, type SignalPacket } from "./signals";
import type { StrikeEvent } from "@/hooks/useEventStream";

export interface UseEdgeSignalsOptions {
  /** Disable packet generation entirely (e.g. page not mounted on a canvas). */
  enabled?: boolean;
}

/**
 * Live edge signals for the topology canvas.
 *
 * Freshness: only events emitted AFTER the hook mounts generate packets, so a
 * page reload never replays the event history as a storm (the initial fetch of
 * the last N events is timestamp-filtered out by `since`).
 *
 * Pruning: a 500ms interval re-derives packets against a moving `now`, so
 * packets die ~500ms-granularly after their TTL instead of only on each 2s poll.
 *
 * Reduced motion: SMIL `<animateMotion>` cannot be frozen with CSS, so the
 * gate is done with matchMedia here — every packet is flagged `motion: "static"`
 * and the renderer draws a static dot instead of animating it.
 */
export function useEdgeSignals(
  events: StrikeEvent[],
  graph: SignalGraph,
  options: UseEdgeSignalsOptions = {}
): SignalPacket[] {
  const { enabled = true } = options;

  const mountedAt = useRef<number>(0);
  if (mountedAt.current === 0) mountedAt.current = Date.now();

  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  // 500ms re-derive cadence → packet expiry is granular even between 2s polls.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return useMemo(() => {
    if (!enabled) return [];
    const packets = deriveSignals(events, graph, { since: mountedAt.current, now: Date.now() });
    if (!reduced) return packets;
    return packets.map((p) => ({ ...p, motion: "static" as const }));
  }, [events, graph, enabled, reduced, tick]);
}