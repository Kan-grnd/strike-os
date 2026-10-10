"use client";
import { useAgents as useAgentsApi } from "./useApi";
export function useAgents(filters?: Record<string, string>, options?: { poll?: boolean }) {
  return useAgentsApi(filters, options);
}
