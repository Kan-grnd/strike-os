"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { POLLING_INTERVAL } from "@/lib/constants";

export interface StrikeEvent {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  subject?: string;
  subjectId?: string;
  missionId?: string;
  taskId?: string;
  agentId?: string;
  payload: string;
}

interface UseEventStreamOptions {
  initialLimit?: number;
  pollInterval?: number;
}

export function useEventStream(options: UseEventStreamOptions = {}) {
  const { initialLimit = 50, pollInterval = POLLING_INTERVAL } = options;
  const [events, setEvents] = useState<StrikeEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastTimestamp, setLastTimestamp] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"polling" | "connected" | "error">("polling");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchEvents = useCallback(async (since?: string) => {
    try {
      const url = new URL("/api/events", window.location.origin);
      url.searchParams.set("limit", String(initialLimit));
      if (since) url.searchParams.set("since", since);
      if (lastTimestamp && !since) url.searchParams.set("since", lastTimestamp);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch events");

      const data = await res.json();
      const newEvents: StrikeEvent[] = data.events || [];

      setEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const combined = [...prev, ...newEvents.filter((e) => !existingIds.has(e.id))];
        return combined.slice(0, initialLimit * 2);
      });

      if (newEvents.length > 0) {
        const newest = newEvents.reduce((a, b) => (new Date(a.timestamp) > new Date(b.timestamp) ? a : b));
        setLastTimestamp(newest.timestamp);
      }

      setConnectionStatus("polling");
    } catch (err) {
      setConnectionStatus("error");
    } finally {
      setIsLoading(false);
    }
  }, [initialLimit, lastTimestamp]);

  useEffect(() => {
    fetchEvents();
    timerRef.current = setInterval(() => fetchEvents(), pollInterval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchEvents, pollInterval]);

  // Manual refresh
  const refresh = useCallback(() => fetchEvents(), [fetchEvents]);

  // Clear events
  const clear = useCallback(() => setEvents([]), []);

  return {
    events,
    isLoading,
    connectionStatus,
    refresh,
    clear,
  };
}
