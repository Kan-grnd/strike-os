import { getHeatmapWeekStartSunday } from "@/components/charts/heatmap";
import type { HeatmapColumn } from "@/components/charts/heatmap";
import type { FunnelStage } from "@/components/charts/funnel-chart";
import type { PieData } from "@/components/charts/pie-context";
import type { RadarData, RadarMetric } from "@/components/charts/radar-context";
import type { RingData } from "@/components/charts/ring-context";

/* ─────────────────────────────────────────────────────────────────────────
 * Pure aggregation for the command-center charts. No React, no fetching —
 * every function buckets arrays the page already holds, so a chart can only
 * ever show a real count. All colours point at the pack tokens defined in
 * globals.css (--chart-N / semantic vars); nothing here hardcodes a hex.
 * ───────────────────────────────────────────────────────────────────────── */

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export type RangeKey = "24h" | "7d" | "30d";

export const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: "24h", label: "24h", days: 1 },
  { key: "7d", label: "7d", days: 7 },
  { key: "30d", label: "30d", days: 30 },
];

export function rangeDays(range: RangeKey): number {
  return range === "24h" ? 1 : range === "30d" ? 30 : 7;
}

export function rangeStart(range: RangeKey, now: number = Date.now()): Date {
  return new Date(now - rangeDays(range) * DAY_MS);
}

/** Human window label used in card hints. */
export function rangeLabel(range: RangeKey): string {
  return range === "24h" ? "last 24h" : range === "30d" ? "last 30d" : "last 7d";
}

/* Series tokens — mirror the --chart-N mapping in globals.css:
 * chart-1 primary · chart-2 info · chart-3 success · chart-4 warning ·
 * chart-5 destructive. */
export const SERIES = {
  primary: "var(--chart-1)",
  info: "var(--chart-2)",
  success: "var(--chart-3)",
  warning: "var(--chart-4)",
  danger: "var(--chart-5)",
} as const;

const ok = (t: unknown): t is string =>
  typeof t === "string" && !Number.isNaN(Date.parse(t));

/* ── Area: event throughput through the selected window ───────────────── */

export type EventPoint = {
  date: Date;
  events: number;
};

export function bucketEventsByTime(
  events: { timestamp?: string }[],
  range: RangeKey,
  now: number = Date.now(),
): EventPoint[] {
  const hourly = range === "24h";
  const n = hourly ? 24 : rangeDays(range);
  const step = hourly ? HOUR_MS : DAY_MS;
  const start = now - n * step;
  const out: EventPoint[] = Array.from({ length: n }, (_, i) => ({
    date: new Date(start + i * step),
    events: 0,
  }));
  for (const e of events) {
    if (!ok(e?.timestamp)) continue;
    const t = Date.parse(e.timestamp);
    if (t < start || t > now) continue;
    const i = Math.min(n - 1, Math.max(0, Math.floor((t - start) / step)));
    out[i].events += 1;
  }
  return out;
}

export function eventTotal(points: EventPoint[]): number {
  return points.reduce((s, p) => s + p.events, 0);
}

/* ── Gauge: task success rate through the window ─────────────────────── */

export function successRate(completed: number, failed: number): number | null {
  const total = completed + failed;
  if (total <= 0) return null;
  return Math.round((completed / total) * 100);
}

/* ── Bar: completed vs failed per bucket ─────────────────────────────── */

export type OutcomePoint = {
  date: Date;
  completed: number;
  failed: number;
};

function taskOutcomeAt(t: any): { status: string; ts: number } | null {
  const status = t?.status;
  if (status !== "COMPLETED" && status !== "FAILED") return null;
  const raw = t?.completedAt ?? t?.updatedAt ?? t?.createdAt;
  if (!ok(raw)) return null;
  return { status, ts: Date.parse(raw) };
}

export function taskOutcomeSeries(
  tasks: any[],
  range: RangeKey,
  now: number = Date.now(),
): OutcomePoint[] {
  const hourly = range === "24h";
  const n = hourly ? 24 : rangeDays(range);
  const step = hourly ? HOUR_MS : DAY_MS;
  const start = now - n * step;
  const out: OutcomePoint[] = Array.from({ length: n }, (_, i) => ({
    date: new Date(start + i * step),
    completed: 0,
    failed: 0,
  }));
  for (const t of tasks) {
    const o = taskOutcomeAt(t);
    if (!o || o.ts < start || o.ts > now) continue;
    const i = Math.min(n - 1, Math.max(0, Math.floor((o.ts - start) / step)));
    if (o.status === "COMPLETED") out[i].completed += 1;
    else out[i].failed += 1;
  }
  return out;
}

export function outcomeTotals(points: OutcomePoint[]): {
  completed: number;
  failed: number;
} {
  return points.reduce(
    (acc, p) => ({
      completed: acc.completed + p.completed,
      failed: acc.failed + p.failed,
    }),
    { completed: 0, failed: 0 },
  );
}

/* ── Funnel: where the work sits in the task pipeline ────────────────── */

const NOT_STARTED = ["QUEUED", "ASSIGNED"];
const COMPLETED = ["COMPLETED"];
const EXITS = ["FAILED", "CANCELLED"];

export interface FunnelResult {
  stages: FunnelStage[];
  exits: number;
  total: number;
}

/* The funnel normalises each stage against the first (`FunnelChart` divides
 * every value by `data[0].value`), so stages must be cumulative "reached or
 * past this stage" counts — otherwise a busy running stage would render wider
 * than the head. Created ≥ Started ≥ Completed always holds by construction. */
export function taskFunnel(tasks: any[]): FunnelResult {
  const count = (set: string[]) =>
    tasks.filter((t) => set.includes(t?.status)).length;
  const created = tasks.length;
  const started = created - count(NOT_STARTED);
  const completed = count(COMPLETED);
  const stages: FunnelStage[] = [
    { label: "Created", value: created },
    { label: "Started", value: started },
    { label: "Completed", value: completed },
  ];
  return { stages, exits: count(EXITS), total: created };
}

/* ── Pie: fleet composition by runtime state ─────────────────────────── */

const STATE_ORDER = [
  "executing",
  "planning",
  "thinking",
  "delegating",
  "initializing",
  "retrying",
  "waiting",
  "blocked",
  "waiting_for_approval",
  "paused",
  "idle",
  "completed",
  "failed",
  "cancelled",
  "stopped",
  "unknown",
];

const STATE_COLOR: Record<string, string> = {
  executing: SERIES.info,
  planning: SERIES.primary,
  thinking: SERIES.info,
  delegating: SERIES.primary,
  initializing: SERIES.info,
  retrying: SERIES.warning,
  waiting: SERIES.info,
  blocked: SERIES.warning,
  waiting_for_approval: "hsl(var(--approval))",
  paused: SERIES.warning,
  idle: "hsl(var(--muted-foreground))",
  completed: SERIES.success,
  failed: SERIES.danger,
  cancelled: "hsl(var(--muted-foreground))",
  stopped: "hsl(var(--muted-foreground))",
  unknown: "hsl(var(--muted-foreground))",
};

export function agentState(a: any): string {
  return (
    a?.runtimeState ||
    (a?.status ? String(a.status).toLowerCase() : "idle") ||
    "idle"
  );
}

export function fleetComposition(agents: any[]): PieData[] {
  const counts: Record<string, number> = {};
  for (const a of agents) {
    const s = agentState(a);
    counts[s] = (counts[s] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([state, value]) => ({
      label: state,
      value,
      color: STATE_COLOR[state] ?? SERIES.primary,
    }))
    .sort((a, b) => {
      const ia = STATE_ORDER.indexOf(a.label);
      const ib = STATE_ORDER.indexOf(b.label);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || b.value - a.value;
    });
}

/* ── Rings: mission outcomes · fleet capacity ────────────────────────── */

export function missionOutcomeRing(missions: any[]): RingData[] {
  const count = (status: string) =>
    missions.filter((m) => m?.status === status).length;
  const total = missions.length || 1;
  return [
    {
      label: "Completed",
      value: count("COMPLETED"),
      maxValue: total,
      color: SERIES.success,
    },
    {
      label: "Failed",
      value: count("FAILED"),
      maxValue: total,
      color: SERIES.danger,
    },
    {
      label: "Cancelled",
      value: count("CANCELLED"),
      maxValue: total,
      color: "hsl(var(--muted-foreground))",
    },
  ];
}

export function fleetCapacityRing(
  total: number,
  active: number,
): RingData[] {
  const max = total || 1;
  return [
    { label: "Active", value: active, maxValue: max, color: SERIES.success },
    {
      label: "Idle",
      value: Math.max(total - active, 0),
      maxValue: max,
      color: "hsl(var(--muted-foreground))",
    },
  ];
}

/* ── Heatmap: completion rhythm, GitHub-style calendar grid ──────────── */

export interface HeatmapResult {
  columns: HeatmapColumn[];
  weeks: number;
  total: number;
  start: Date;
  end: Date;
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function completionHeatmap(
  tasks: any[],
  weeks = 26,
  now: number = Date.now(),
): HeatmapResult {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t?.status !== "COMPLETED") continue;
    const raw = t?.completedAt ?? t?.updatedAt ?? t?.createdAt;
    if (!ok(raw)) continue;
    const d = new Date(raw);
    d.setHours(0, 0, 0, 0);
    const k = dayKey(d);
    counts.set(k, (counts.get(k) || 0) + 1);
  }

  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  const start = getHeatmapWeekStartSunday(
    new Date(now - (weeks - 1) * 7 * DAY_MS),
  );

  let total = 0;
  const columns: HeatmapColumn[] = [];
  for (let w = 0; w < weeks; w++) {
    const bins = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + (w * 7 + d) * DAY_MS);
      date.setHours(0, 0, 0, 0);
      const count = date > end ? 0 : counts.get(dayKey(date)) || 0;
      total += count;
      bins.push({ count, bin: d, date });
    }
    columns.push({ bin: w, bins });
  }

  return { columns, weeks, total, start, end };
}

/* ── Radar: top agents on four qualitative axes ──────────────────────── */

export interface RadarResult {
  eligible: boolean;
  data: RadarData[];
  metrics: RadarMetric[];
}

const RADAR_METRICS: RadarMetric[] = [
  { key: "volume", label: "Volume" },
  { key: "reliability", label: "Reliability" },
  { key: "speed", label: "Speed" },
  { key: "economy", label: "Economy" },
];

function normalize(values: number[]): (v: number) => number {
  const max = Math.max(...values, 0);
  if (max <= 0) return () => 0;
  return (v) => Math.round((v / max) * 100);
}

export function agentRadar(
  agents: any[],
  tasks: any[],
  performance: { byAgent?: any[] } | undefined,
  limit = 3,
): RadarResult {
  const byAgent = (performance?.byAgent || []).filter(
    (e) => e && typeof e.agent === "string",
  );
  if (byAgent.length < 2) {
    return { eligible: false, data: [], metrics: RADAR_METRICS };
  }

  const nameById = new Map(agents.map((a) => [a?.id, a?.name]));
  const taskStats = new Map<string, { done: number; failed: number }>();
  for (const t of tasks) {
    const id = t?.ownerAgentId;
    if (!id) continue;
    const s = taskStats.get(id) || { done: 0, failed: 0 };
    if (t?.status === "COMPLETED") s.done += 1;
    else if (t?.status === "FAILED") s.failed += 1;
    taskStats.set(id, s);
  }

  const picked = [...byAgent]
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, limit);

  const volume = picked.map((e) => e.count || 0);
  const reliability = picked.map((e) => {
    const s = taskStats.get(e.agent);
    const total = (s?.done || 0) + (s?.failed || 0);
    return total > 0 ? (s!.done / total) * 100 : 0;
  });
  const latency = picked.map((e) => e.avgLatencyMs || 0);
  const cost = picked.map((e) => e.totalCost || 0);

  const normVolume = normalize(volume);
  const normLatency = normalize(latency);
  const normCost = normalize(cost);

  const data: RadarData[] = picked.map((e, i) => ({
    label: nameById.get(e.agent) || e.agent.slice(0, 8),
    color: ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"][i],
    values: {
      volume: normVolume(volume[i]),
      reliability: Math.round(reliability[i]),
      speed: Math.round(100 - normLatency(latency[i])),
      economy: Math.round(100 - normCost(cost[i])),
    },
  }));

  return { eligible: true, data, metrics: RADAR_METRICS };
}
