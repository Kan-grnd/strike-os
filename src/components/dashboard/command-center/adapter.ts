import type { DateRangeKey } from "@/lib/range";

export type Tone = "good" | "bad" | "neutral";

export interface KPIChange {
  text: string;
  tone: Tone;
  dir?: "up" | "down";
}

export interface KPIFlag {
  text: string;
  tone: "bad" | "neutral" | "good";
}

export interface KPIItem {
  id: "agents" | "tasks" | "success" | "events" | "missions";
  label: string;
  value: string | number;
  prev?: string | number;
  change?: KPIChange;
  flag?: KPIFlag;
}

export type ActionKind = "blocked" | "stalled" | "waiting";

export interface ActionDetail {
  agent?: string;
  task?: string;
  mission?: string;
  since?: string;
  lastEvent?: string;
  hint?: string;
  recent?: string[];
}

export interface ActionItem {
  id: string;
  kind: ActionKind;
  title: string;
  impact: string;
  impactTone: Tone;
  reason: string;
  priority: "High" | "Medium" | "Low";
  actionLabel: string;
  href?: string;
  traceId?: string;
  detail: ActionDetail;
}

export interface TrendPoint {
  date: Date;
  events: number;
  problems: number;
}

export interface FleetCounts {
  executing: number;
  planning: number;
  waiting: number;
  blocked: number;
  idle: number;
}

export interface DashboardState {
  isStreaming: boolean;
  stale: boolean;
  lastEventAgo?: string;
  agents: { active: number; total: number };
  missions: { active: number };
  kpis: KPIItem[];
  actions: ActionItem[];
  trend: Record<DateRangeKey, TrendPoint[]>;
  fleet: FleetCounts;
}
