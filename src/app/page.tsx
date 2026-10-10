"use client";

import { useMemo } from "react";
import { useAgents } from "@/hooks/useAgents";
import { useMissions } from "@/hooks/useMissions";
import { useTasks } from "@/hooks/useTasks";
import { useApprovals } from "@/hooks/useApprovals";
import { useEvents } from "@/hooks/useEvents";
import { useStreaming } from "@/components/dashboard/command-center/use-streaming";
import { parseDateRange, type DateRangeKey } from "@/lib/range";
import { Hero } from "@/components/dashboard/command-center/hero";
import { KpiCard } from "@/components/dashboard/command-center/kpi-card";
import type { DashboardState, ActionItem } from "@/components/dashboard/command-center/adapter";
import { DASHBOARD_SAMPLE_HEALTHY, DASHBOARD_SAMPLE_PROBLEM } from "@/components/dashboard/command-center/sample";
import { EventsChart } from "@/components/dashboard/command-center/events-chart";
import { FleetDonut } from "@/components/dashboard/command-center/fleet-donut";
import { Actions } from "@/components/dashboard/command-center/actions";
import { ThemeAmbient } from "@/components/dashboard/command-center/theme-ambient";

function isoFrom(date: Date) {
  return date.toISOString();
}

function addDays(d: Date, n: number) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

function groupByDay(points: Array<{ timestamp: string; type?: string }>, days: number): Record<string, { events: number; problems: number }> {
  const map: Record<string, { events: number; problems: number }> = {};
  const start = addDays(new Date(), -days);
  for (const p of points) {
    const t = Date.parse(p.timestamp);
    if (!Number.isFinite(t)) continue;
    if (t < start.getTime()) continue;
    const d = new Date(t);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!map[key]) map[key] = { events: 0, problems: 0 };
    map[key].events += 1;
    const typ = (p.type || "").toLowerCase();
    if (typ.includes("fail") || typ.includes("block")) map[key].problems += 1;
  }
  return map;
}

function groupByHour(points: Array<{ timestamp: string; type?: string }>): Record<string, { events: number; problems: number }> {
  const map: Record<string, { events: number; problems: number }> = {};
  const start = addDays(new Date(), -1);
  for (const p of points) {
    const t = Date.parse(p.timestamp);
    if (!Number.isFinite(t)) continue;
    if (t < start.getTime()) continue;
    const d = new Date(t);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}`;
    if (!map[key]) map[key] = { events: 0, problems: 0 };
    map[key].events += 1;
    const typ = (p.type || "").toLowerCase();
    if (typ.includes("fail") || typ.includes("block")) map[key].problems += 1;
  }
  return map;
}

function toDaySeries(map: Record<string, { events: number; problems: number }>, days: number) {
  const out: Array<{ date: Date; events: number; problems: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(new Date(), -i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ date: d, events: map[key]?.events || 0, problems: map[key]?.problems || 0 });
  }
  return out;
}

function toHourSeries(map: Record<string, { events: number; problems: number }>) {
  const out: Array<{ date: Date; events: number; problems: number }> = [];
  for (let i = 23; i >= 0; i--) {
    const d = addDays(new Date(), -1);
    d.setHours(d.getHours() + (i - 23)); // rough
  }
  const start = addDays(new Date(), -1);
  for (let i = 0; i < 24; i++) {
    const d = new Date(start.getTime());
    d.setHours(start.getHours() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}`;
    out.push({ date: d, events: map[key]?.events || 0, problems: map[key]?.problems || 0 });
  }
  return out;
}

export default function DashboardPage() {
  const scenario = process.env.NEXT_PUBLIC_DASHBOARD_SAMPLE;
  const useSample = scenario === "healthy" || scenario === "problem";
  if (useSample) {
    const s = scenario === "healthy" ? DASHBOARD_SAMPLE_HEALTHY : DASHBOARD_SAMPLE_PROBLEM;
    return (
      <main className="relative mx-auto grid w-full max-w-[1240px] gap-6">
        <ThemeAmbient />
        <Hero
          isStreaming={s.isStreaming}
          stale={s.stale}
          lastEventAgo={s.lastEventAgo}
          activeAgents={s.agents.active}
          activeMissions={s.missions.active}
          needsYou={s.actions.length}
          actionsCount={s.actions.length}
        />
        <section aria-label="Key numbers" className="relative z-10 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
          {s.kpis.map((k) => (
            <KpiCard key={k.id} item={k} />
          ))}
        </section>
        <section aria-label="Trends" className="relative z-10 grid gap-4 xl:grid-cols-12">
          <EventsChart trend={s.trend} totalEvents={s.trend["7d"].reduce((a, b) => a + b.events, 0)} totalProblems={s.trend["7d"].reduce((a, b) => a + b.problems, 0)} />
          <FleetDonut fleet={s.fleet} />
        </section>
        <Actions actions={s.actions} />
      </main>
    );
  }

  const { data: agents } = useAgents();
  const { data: missions } = useMissions();
  const { data: tasks } = useTasks();
  const { data: approvals } = useApprovals();
  const { data: events } = useEvents({ since: isoFrom(addDays(new Date(), -90)), limit: "2000" });
  const evList = (events?.events || []) as Array<{ timestamp: string; type?: string }>;
  const { streaming, lastEventAt } = useStreaming(evList, 15000);
  const stale = !streaming;
  const lastEventAgo = lastEventAt ? "recent" : "NO EVENTS YET";

  const activeAgents = (agents?.agents || []).filter((a: any) => /executing|planning|thinking|delegating|initializing|retrying|running/i.test(a.status || "")).length;
  const totalAgents = agents?.agents?.length || 0;
  const activeMissions = (missions?.missions || []).filter((m: any) => m.status !== "completed" && m.status !== "cancelled").length;
  const runningTasks = (tasks?.tasks || []).filter((t: any) => (t.status || "").toLowerCase() === "running").length;
  const completed = (tasks?.tasks || []).filter((t: any) => (t.status || "").toLowerCase() === "completed").length;
  const totalTasks = tasks?.tasks?.length || 0;
  const successPct = totalTasks === 0 ? "—" : `${Math.round((completed / totalTasks) * 100)}%`;
  const events24 = evList.filter((e) => Date.parse(e.timestamp) > addDays(new Date(), -1).getTime()).length;
  const missionsTotal = missions?.missions?.length || 0;
  const needsYou = (approvals?.approvals || []).length + runningTasks; // rough

  const actions: ActionItem[] = [];
  for (const a of (approvals?.approvals || [])) {
    actions.push({
      id: `ap-${a.id}`,
      kind: "waiting",
      title: "Approval required",
      impact: "Needs your decision",
      impactTone: "bad",
      reason: "Waiting on you",
      priority: "Medium",
      actionLabel: "Review",
      href: "/work",
      detail: { hint: "Approval requested", since: "recent" },
    });
  }

  const kpis = [
    { id: "agents" as const, label: "Agents", value: totalAgents, prev: totalAgents },
    { id: "tasks" as const, label: "Running tasks", value: runningTasks, prev: runningTasks },
    { id: "success" as const, label: "Success rate", value: successPct, prev: successPct },
    { id: "events" as const, label: "Events (24h)", value: events24, prev: events24 },
    { id: "missions" as const, label: "Missions", value: missionsTotal, prev: missionsTotal },
  ];

  const hmap = groupByHour(evList);
  const d7 = groupByDay(evList, 7);
  const d30 = groupByDay(evList, 30);
  const d90 = groupByDay(evList, 90);
  const trend: Record<DateRangeKey, Array<{ date: Date; events: number; problems: number }>> = {
    "24h": toHourSeries(hmap),
    "7d": toDaySeries(d7, 7),
    "30d": toDaySeries(d30, 30),
    "90d": toDaySeries(d90, 90),
  };

  const fleet = {
    executing: (tasks?.tasks || []).filter((t: any) => (t.status || "").toLowerCase() === "running").length,
    planning: 0,
    waiting: (tasks?.tasks || []).filter((t: any) => (t.status || "").toLowerCase() === "waiting").length,
    blocked: 0,
    idle: Math.max(0, totalAgents - activeAgents),
  };

  return (
    <main className="relative mx-auto grid w-full max-w-[1240px] gap-6">
      <ThemeAmbient />
      <Hero
        isStreaming={streaming}
        stale={stale}
        lastEventAgo={lastEventAgo}
        activeAgents={activeAgents}
        activeMissions={activeMissions}
        needsYou={actions.length}
        actionsCount={actions.length}
      />
      <section aria-label="Key numbers" className="relative z-10 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <KpiCard key={k.id} item={k} />
        ))}
      </section>
      <section aria-label="Trends" className="relative z-10 grid gap-4 xl:grid-cols-12">
        <EventsChart trend={trend} totalEvents={events24} totalProblems={0} />
        <FleetDonut fleet={fleet} />
      </section>
      <Actions actions={actions} />
    </main>
  );
}
