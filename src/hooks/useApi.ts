"use client";

import { useState } from "react";
import useSWR from "swr";

export const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) {
      const err = new Error(`Request failed: ${r.status}`) as Error & { status?: number };
      err.status = r.status;
      throw err;
    }
    return r.json();
  });

export const REFRESH_RATES = {
  live: 3000,
  normal: 10000,
  relaxed: 30000,
  paused: 0,
} as const;

export type RefreshPreset = keyof typeof REFRESH_RATES;

export function useSettings() {
  return useSWR<{ settings: Record<string, string> }>("/api/settings", fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: false,
  });
}

export function useRefreshRate() {
  const { data } = useSettings();
  const preset = (data?.settings?.["refresh.preset"] || "normal") as RefreshPreset;
  return REFRESH_RATES[preset] ?? REFRESH_RATES.normal;
}

function pollOptions(rate: number) {
  return {
    refreshInterval: rate,
    revalidateOnFocus: false,
    dedupingInterval: 2000,
  };
}

export async function updateSettings(settings: Record<string, string>) {
  return fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings }),
  }).then((r) => r.json());
}

export async function resetDatabase() {
  return fetch("/api/admin/reset-demo", { method: "POST" }).then((r) => r.json());
}

export async function cleanContent() {
  return fetch("/api/admin/clean-content", { method: "POST" }).then((r) => r.json());
}

export async function setAutomationsGlobal(paused: boolean) {
  return fetch("/api/admin/automations-global", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paused }),
  }).then((r) => r.json());
}

/* `options.poll` opts a list view into the ambient refresh cadence. Default
 * off so detail/picker call sites keep their current one-shot behaviour; the
 * command center turns it on so its charts read as live. */
export function useAgents(filters?: Record<string, string>, options?: { poll?: boolean }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.type) params.set("type", filters.type);
  if (filters?.colonyId) params.set("colonyId", filters.colonyId);
  const key = `/api/agents${params.toString() ? `?${params}` : ""}`;
  const rate = useRefreshRate();
  return useSWR<{ agents: any[] }>(key, fetcher, options?.poll ? pollOptions(rate) : undefined);
}

/* Single-item execution views. All three poll at the same `live` rate so a
 * mission, an automation and a task never refresh on different cadences — the
 * detail pages used to hardcode 2000ms and 3000ms independently. */
function liveOptions() {
  return { refreshInterval: REFRESH_RATES.live, revalidateOnFocus: false, dedupingInterval: 2000 };
}

export function useMission(id?: string) {
  return useSWR<{ mission: any; health?: string; events: any[] }>(id ? `/api/missions/${id}` : null, fetcher, liveOptions());
}

export function useTask(id?: string) {
  return useSWR<{ task: any }>(id ? `/api/tasks/${id}` : null, fetcher, liveOptions());
}

export function useColonies() {
  return useSWR<{ colonies: any[] }>("/api/colonies", fetcher);
}

export function useMissions(options?: { poll?: boolean }) {
  const rate = useRefreshRate();
  return useSWR<{ missions: any[] }>("/api/missions", fetcher, options?.poll ? pollOptions(rate) : undefined);
}

export function useApprovals(options?: { poll?: boolean }) {
  const rate = useRefreshRate();
  return useSWR<{ approvals: any[] }>("/api/approvals", fetcher, options?.poll ? pollOptions(rate) : undefined);
}

export function useTools() {
  return useSWR<{ tools: any[] }>("/api/tools", fetcher);
}

export function useProviders() {
  return useSWR<{ providers: any[] }>("/api/providers", fetcher);
}

export function useModels() {
  return useSWR<{ models: any[] }>("/api/models", fetcher);
}

export function useAutomations() {
  return useSWR<{ automations: any[] }>("/api/automations", fetcher);
}

export function useMCPConnections() {
  return useSWR<{ connections: any[] }>("/api/mcp", fetcher);
}

export function useMemories(filters?: Record<string, string>) {
  const params = new URLSearchParams();
  if (filters?.scope) params.set("scope", filters.scope);
  const key = `/api/memory${params.toString() ? `?${params}` : ""}`;
  return useSWR<{ memories: any[] }>(key, fetcher);
}

export function useHealth() {
  const rate = useRefreshRate();
  return useSWR<{ name: string; version: string; status: string; time: string }>(
    "/api/health",
    fetcher,
    pollOptions(rate)
  );
}

export async function createAutomation(data: {
  name: string;
  description?: string;
  trigger: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  actions: Record<string, unknown>[];
  status?: string;
  missionId?: string;
}) {
  return fetch("/api/automations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => r.json());
}

export async function startAutomation(id: string) {
  return fetch(`/api/automations/${id}/start`, { method: "POST" }).then((r) => r.json());
}

export async function pauseAutomation(id: string) {
  return fetch(`/api/automations/${id}/pause`, { method: "POST" }).then((r) => r.json());
}

export async function resumeAutomation(id: string) {
  return fetch(`/api/automations/${id}/resume`, { method: "POST" }).then((r) => r.json());
}

export async function cancelAutomation(id: string) {
  return fetch(`/api/automations/${id}/cancel`, { method: "POST" }).then((r) => r.json());
}

/* The single automation reader. There is no `/run` route — an automation is
 * driven by its trigger — so nothing posts a manual run. */
export function useAutomation(id?: string) {
  return useSWR<{ automation: any }>(id ? `/api/automations/${id}` : null, fetcher, liveOptions());
}

export function useMemory(id?: string) {
  return useSWR<{ memory: any }>(id ? `/api/memory/${id}` : null, fetcher);
}

export function useRelationships(filters?: Record<string, string>) {
  const params = new URLSearchParams();
  if (filters?.relation) params.set("relation", filters.relation);
  if (filters?.fromType) params.set("fromType", filters.fromType);
  if (filters?.fromId) params.set("fromId", filters.fromId);
  if (filters?.toType) params.set("toType", filters.toType);
  if (filters?.toId) params.set("toId", filters.toId);
  const key = `/api/relationships${params.toString() ? `?${params}` : ""}`;
  return useSWR<{ relationships: any[] }>(key, fetcher);
}

export function useTraces(filters?: Record<string, string>) {
  const params = new URLSearchParams();
  if (filters?.missionId) params.set("missionId", filters.missionId);
  if (filters?.taskId) params.set("taskId", filters.taskId);
  if (filters?.agentId) params.set("agentId", filters.agentId);
  const key = `/api/observability/traces${params.toString() ? `?${params}` : ""}`;
  return useSWR<{ traces: any[] }>(key, fetcher);
}

export function useDecisions(filters?: Record<string, string>) {
  const params = new URLSearchParams();
  if (filters?.q) params.set("q", filters.q);
  const key = `/api/decisions${params.toString() ? `?${params}` : ""}`;
  return useSWR<{ decisions: any[] }>(key, fetcher);
}

export function useTrace(id?: string) {
  return useSWR<{ trace: any }>(id ? `/api/observability/traces/${id}` : null, fetcher);
}

export function useEvents(filters?: Record<string, string>) {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.limit) params.set("limit", filters.limit);
  if (filters?.since) params.set("since", filters.since);
  const key = `/api/events${params.toString() ? `?${params}` : ""}`;
  const rate = useRefreshRate();
  return useSWR<{ events: any[] }>(key, fetcher, pollOptions(rate));
}

export function useLogs(filters?: Record<string, string>) {
  const params = new URLSearchParams();
  if (filters?.level) params.set("level", filters.level);
  if (filters?.service) params.set("service", filters.service);
  const key = `/api/observability/logs${params.toString() ? `?${params}` : ""}`;
  const rate = useRefreshRate();
  return useSWR<{ logs: any[] }>(key, fetcher, pollOptions(rate));
}

export function useCosts(range = "7d", groupBy = "model") {
  const rate = useRefreshRate();
  return useSWR<{ totalCost: number; dimensions: Record<string, number>; traceCount: number }>(
    `/api/observability/costs?range=${range}&groupBy=${groupBy}`,
    fetcher,
    pollOptions(rate)
  );
}

export function usePerformance(range = "7d") {
  const rate = useRefreshRate();
  return useSWR<{ totalTraces: number; avgLatencyMs: number; errorRate: number; completedTasks: number; failedTasks: number; byAgent: any[] }>(
    `/api/observability/performance?range=${range}`,
    fetcher,
    pollOptions(rate)
  );
}

export async function createAgent(data: {
  name: string;
  description?: string;
  type?: string;
  colonyId?: string;
  parentId?: string;
  capabilities?: string[];
  tools?: string[];
  models?: string[];
}) {
  return fetch("/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => r.json());
}

export async function createMission(data: {
  goal: string;
  plan?: Record<string, unknown>;
  agentIds?: string[];
  priority?: number;
}) {
  return fetch("/api/missions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => r.json());
}

export function useTasks(filters?: Record<string, string>, options?: { poll?: boolean }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.missionId) params.set("missionId", filters.missionId);
  if (filters?.agentId) params.set("agentId", filters.agentId);
  const key = `/api/tasks${params.toString() ? `?${params}` : ""}`;
  const rate = useRefreshRate();
  return useSWR<{ tasks: any[] }>(key, fetcher, options?.poll ? pollOptions(rate) : undefined);
}

export async function createColony(data: { name: string; description?: string }) {
  return fetch("/api/colonies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => r.json());
}
