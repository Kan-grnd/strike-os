import type { DashboardState, TrendPoint } from "./adapter";
import type { DateRangeKey } from "@/lib/range";

function makeTrend(range: DateRangeKey): Array<{ date: Date; events: number; problems: number }> {
  const now = Date.now();
  if (range === "24h") {
    const pts = 24;
    return Array.from({ length: pts }).map((_, i) => {
      const t = new Date(now - (pts - 1 - i) * 60 * 60 * 1000);
      const hour = t.getHours();
      const events = Math.round(6 + Math.sin(hour / 4) * 4 + Math.random() * 3);
      const problems = Math.round(Math.max(0, (hour % 8 === 0 ? 1 : 0) + Math.random() * 1));
      return { date: t, events: Math.max(0, events), problems: Math.max(0, problems) };
    });
  }
  if (range === "7d") {
    const pts = 7;
    return Array.from({ length: pts }).map((_, i) => {
      const t = new Date(now - (pts - 1 - i) * 24 * 60 * 60 * 1000);
      const events = Math.round(24 + Math.random() * 12);
      const problems = Math.round(Math.random() * 3);
      return { date: t, events, problems };
    });
  }
  if (range === "30d") {
    const pts = 30;
    return Array.from({ length: pts }).map((_, i) => {
      const t = new Date(now - (pts - 1 - i) * 24 * 60 * 60 * 1000);
      const events = Math.round(18 + Math.random() * 10);
      const problems = Math.round(Math.random() * 2);
      return { date: t, events, problems };
    });
  }
  const pts = 90;
  return Array.from({ length: pts }).map((_, i) => {
    const t = new Date(now - (pts - 1 - i) * 24 * 60 * 60 * 1000);
    const events = Math.round(15 + Math.random() * 8);
    const problems = Math.round(Math.random() * 2);
    return { date: t, events, problems };
  });
}

const trendAll = {
  "24h": makeTrend("24h"),
  "7d": makeTrend("7d"),
  "30d": makeTrend("30d"),
  "90d": makeTrend("90d"),
} as Record<DateRangeKey, TrendPoint[]>;

function asTrend(r: DateRangeKey) {
  return trendAll[r].map((p) => ({ ...p, date: new Date(p.date.getTime()) }));
}

export const DASHBOARD_SAMPLE_HEALTHY: DashboardState = {
  isStreaming: true,
  stale: false,
  lastEventAgo: "LIVE",
  agents: { active: 12, total: 14 },
  missions: { active: 3 },
  kpis: [
    { id: "agents", label: "Agents", value: 14, prev: 13, change: { text: "+8%", tone: "good", dir: "up" } },
    { id: "tasks", label: "Running tasks", value: 9, prev: 9 },
    { id: "success", label: "Success rate", value: "98%", prev: "97%", change: { text: "+1 pt", tone: "good", dir: "up" } },
    { id: "events", label: "Events (24h)", value: 162, prev: 158 },
    { id: "missions", label: "Missions", value: 5, prev: 4, change: { text: "+25%", tone: "good", dir: "up" } },
  ],
  actions: [],
  trend: {
    "24h": asTrend("24h"),
    "7d": asTrend("7d"),
    "30d": asTrend("30d"),
    "90d": asTrend("90d"),
  },
  fleet: { executing: 9, planning: 3, waiting: 1, blocked: 0, idle: 1 },
};

export const DASHBOARD_SAMPLE_PROBLEM: DashboardState = {
  isStreaming: false,
  stale: true,
  lastEventAgo: "45s ago",
  agents: { active: 6, total: 9 },
  missions: { active: 1 },
  kpis: [
    { id: "agents", label: "Agents", value: 9, prev: 10, change: { text: "-10%", tone: "bad", dir: "down" } },
    { id: "tasks", label: "Running tasks", value: 4, prev: 7, flag: { text: "2 stuck", tone: "bad" } },
    { id: "success", label: "Success rate", value: "86%", prev: "94%", change: { text: "-8 pts", tone: "bad", dir: "down" } },
    { id: "events", label: "Events (24h)", value: 84, prev: 142 },
    { id: "missions", label: "Missions", value: 2, prev: 3, change: { text: "-33%", tone: "bad", dir: "down" } },
  ],
  actions: [
    {
      id: "act-blocked-1",
      kind: "blocked",
      title: "Agent runner-03 is blocked",
      impact: "Blocks 2 tasks",
      impactTone: "bad",
      reason: "Blocked for 5m (limit 10m)",
      priority: "High",
      actionLabel: "Review",
      href: "/work",
      detail: {
        agent: "runner-03",
        task: "ingest-batch-42",
        mission: "Data pipeline",
        since: "5m ago",
        lastEvent: "Failed dependency",
        hint: "Resource contention",
        recent: ["Dependency failed", "Retry pending"],
      },
    },
    {
      id: "act-stalled-1",
      kind: "stalled",
      title: "Task planner-01 is running but silent",
      impact: "Stalled progress",
      impactTone: "bad",
      reason: "No event for 16m (limit 15m)",
      priority: "High",
      actionLabel: "Review",
      href: "/work",
      detail: {
        agent: "planner-01",
        task: "plan-mission-07",
        mission: "Mission 07",
        since: "16m ago",
        lastEvent: "No events",
        hint: "Stalled",
        recent: [],
      },
    },
    {
      id: "act-waiting-1",
      kind: "waiting",
      title: "Approval required",
      impact: "Needs your decision",
      impactTone: "bad",
      reason: "Waiting on you for 8m (limit 10m)",
      priority: "Medium",
      actionLabel: "Review",
      href: "/work",
      detail: {
        agent: "reviewer-01",
        task: "approve-deploy-12",
        mission: "Deploy pipeline",
        since: "8m ago",
        lastEvent: "Approval requested",
        hint: "Review requested",
        recent: ["Approval requested"],
      },
    },
  ],
  trend: {
    "24h": asTrend("24h"),
    "7d": asTrend("7d"),
    "30d": asTrend("30d"),
    "90d": asTrend("90d"),
  },
  fleet: { executing: 6, planning: 1, waiting: 1, blocked: 1, idle: 0 },
};
