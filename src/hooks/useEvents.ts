"use client";
import { useEvents as useEventsApi } from "./useApi";
export function useEvents(filters?: Record<string, string>) {
  return useEventsApi(filters);
}
