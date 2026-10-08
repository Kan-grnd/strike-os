"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Brain,
  Zap,
  Users,
  ListTodo,
  Activity,
  Rocket,
  Layers,
  ArrowUpRight,
  CircleDot,
} from "lucide-react";
import { cn, formatRelativeTime, truncate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import {
  useAgents,
  useTasks,
  useMissions,
  useAutomations,
  useEvents,
  usePerformance,
  useCosts,
} from "@/hooks/useApi";
import { isAgentActiveLive } from "@/components/dashboard/charts";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ThroughputChart, FleetStateChart } from "@/components/dashboard/recharts";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function HomePage() {
  const { data: agentsData } = useAgents();
  const { data: tasksData } = useTasks({ status: "RUNNING" });
  const { data: missionsData } = useMissions();
  const { data: automationsData } = useAutomations();
  const { data: eventsData } = useEvents({});
  const { data: performanceData } = usePerformance();
  const { data: costsData } = useCosts();

  const agents = agentsData?.agents || [];
  const runningTasks = tasksData?.tasks || [];
  const missions = missionsData?.missions || [];
  const automations = automationsData?.automations || [];
  const events = eventsData?.events || [];
  const performance = performanceData || { completedTasks: 0, failedTasks: 0 };
  const costs = costsData && costsData.totalCost > 0 ? costsData : undefined;

  const activeMissions = missions.filter((m: any) => m.status === "RUNNING");
  const activeAgents = agents.filter((a: any) => isAgentActiveLive(a));
  const completedToday = missions.filter(
    (m: any) =>
      m.status === "COMPLETED" &&
      new Date(m.updatedAt || m.createdAt).toDateString() === new Date().toDateString()
  ).length;
  const activeAutomations = automations.filter((a: any) => a.status === "ACTIVE").length;

  // Trailing event series (12 buckets over 2h) — real data only, used for
  // the KPI sparkline so the visual is never decorative fiction.
  const eventSpark = React.useMemo(() => {
    const BUCKET = 10 * 60_000;
    const N = 12;
    const now = Date.now();
    const start = now - N * BUCKET;
    const arr = new Array<number>(N).fill(0);
    for (const e of events) {
      const t = Date.parse((e as any)?.timestamp ?? "");
      if (Number.isNaN(t) || t < start || t > now) continue;
      const i = Math.min(N - 1, Math.max(0, Math.floor((t - start) / BUCKET)));
      arr[i]++;
    }
    return arr;
  }, [events]);

  const nowItems: {
    title: string;
    description: string;
    status: "running" | "waiting" | "completed";
    time: string;
    href?: string;
  }[] = [];
  activeMissions.forEach((m: any) => {
    nowItems.push({
      title: truncate(m.goal, 52),
      description: `${m.tasks?.length || 0} tasks · ${activeAgents.length} agents active`,
      status: "running",
      time: formatRelativeTime(m.createdAt),
      href: `/missions/${m.id}`,
    });
  });
  runningTasks.slice(0, 3).forEach((t: any) => {
    nowItems.push({
      title: truncate(t.description, 52),
      description: `Task ${t.status?.toLowerCase() || "queued"} · ${t.agentName || "unassigned"}`,
      status: "waiting",
      time: formatRelativeTime(t.createdAt),
      href: `/tasks`,
    });
  });
  const nowTop = nowItems.slice(0, 4);

  const streamEvents = events.slice(0, 8).map((e: any) => {
    let payload: Record<string, unknown> = {};
    try {
      payload = typeof e.payload === "string" ? JSON.parse(e.payload) : e.payload || {};
    } catch {
      payload = {};
    }
    return {
      event: e.type || "event",
      description:
        (typeof payload.description === "string" && payload.description) ||
        (typeof payload.message === "string" && payload.message) ||
        e.subject ||
        e.source ||
        "",
      time: formatRelativeTime(e.timestamp),
    };
  });

  const totalCost = costs?.totalCost ?? 0;
  const successRate =
    performance.completedTasks + performance.failedTasks > 0
      ? Math.round(
          (performance.completedTasks /
            (performance.completedTasks + performance.failedTasks)) *
            100
        )
      : null;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* ── Command deck ─────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-muted/40 p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
              </span>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                System online · live
              </span>
            </div>
            <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              Your AI workforce, at a glance
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              {activeAgents.length > 0
                ? `${activeAgents.length} agents active across ${activeMissions.length} running mission${activeMissions.length === 1 ? "" : "s"}.`
                : "Dispatch a mission and watch the fleet work in real time."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/architect"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-[1.02]"
            >
              <Rocket className="h-4 w-4" />
              Start a mission
            </Link>
            <Link
              href="/topology"
              className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-accent"
            >
              <Layers className="h-4 w-4" />
              Live topology
            </Link>
          </div>
        </div>
      </motion.section>

      {/* ── KPI rail ─────────────────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          index={0}
          icon={Users}
          label="Active agents"
          value={activeAgents.length}
          caption={`${agents.length} in the fleet`}
          accent="hsl(var(--info) / 0.5)"
        />
        <KpiCard
          index={1}
          icon={ListTodo}
          label="Running tasks"
          value={runningTasks.length}
          caption={`${performance.completedTasks} completed · 7d`}
          accent="hsl(var(--primary) / 0.4)"
        />
        <KpiCard
          index={2}
          icon={Brain}
          label="Active missions"
          value={activeMissions.length}
          caption={`${completedToday} completed today`}
        />
        <KpiCard
          index={3}
          icon={Activity}
          label="Events · 2h"
          value={eventSpark.reduce((s, v) => s + v, 0)}
          caption={
            successRate != null ? `${successRate}% task success` : "No outcomes yet"
          }
          spark={eventSpark}
          accent="hsl(var(--success) / 0.4)"
        />
      </section>

      {/* ── Charts ───────────────────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-5">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
          className="lg:col-span-3"
        >
          <ThroughputChart events={events} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16, ease: EASE }}
          className="lg:col-span-2"
        >
          <FleetStateChart agents={agents} />
        </motion.div>
      </section>

      {/* ── Activity ─────────────────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22, ease: EASE }}
        >
          <Card className="flex h-full flex-col p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Happening now
              </h2>
              <Badge variant="outline" className="gap-1.5">
                <CircleDot className="h-3 w-3 text-success" />
                Live
              </Badge>
            </div>
            {agents.length === 0 && missions.length === 0 ? (
              <EmptyState
                icon={Rocket}
                title="No activity yet"
                description="Create your first agent to start building your workforce."
                cta="Create your first agent"
                ctaHref="/architect"
              />
            ) : nowTop.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                Nothing running right now.
              </p>
            ) : (
              <div className="space-y-1">
                {nowTop.map((item, i) => (
                  <ActivityRow key={i} {...item} />
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28, ease: EASE }}
        >
          <Card className="flex h-full flex-col p-6">
            <h2 className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Operational stream
            </h2>
            <ScrollArea className="h-[280px] pr-3">
              <div className="space-y-3">
                {streamEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No system events yet.
                  </p>
                ) : (
                  streamEvents.map((ev, i) => <StreamEvent key={i} {...ev} />)
                )}
              </div>
            </ScrollArea>
          </Card>
        </motion.div>
      </section>

      {/* ── Secondary signals ────────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MiniStat
          icon={Zap}
          label="Automations"
          value={String(automations.filter((a: any) => a.status === "ACTIVE").length)}
          caption={`${automations.length} configured`}
          href="/automations"
        />
        <KpiCost totalCost={totalCost} dims={costs?.dimensions} />
        <MiniStat
          icon={ListTodo}
          label="Fleet success · 7d"
          value={successRate != null ? `${successRate}%` : "—"}
          caption={`${performance.completedTasks} completed / ${performance.failedTasks} failed`}
          href="/performance"
        />
      </section>
    </div>
  );
}

function ActivityRow({
  title,
  description,
  status,
  time,
  href,
}: {
  title: string;
  description: string;
  status: "running" | "waiting" | "completed";
  time: string;
  href?: string;
}) {
  const dot =
    status === "running"
      ? "bg-primary"
      : status === "completed"
        ? "bg-success"
        : "bg-warning";
  const body = (
    <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/50">
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dot)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
      </div>
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
        {time}
      </span>
    </div>
  );
  return href ? (
    <Link href={href} className="group block">
      <div className="flex items-center">
        <div className="min-w-0 flex-1">{body}</div>
        <ArrowUpRight className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  ) : (
    body
  );
}

function StreamEvent({
  event,
  description,
  time,
}: {
  event: string;
  description: string;
  time: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-mono text-[11px] font-medium">{event}</span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
            {time}
          </span>
        </div>
        {description && (
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  caption,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  caption: string;
  href?: string;
}) {
  const inner = (
    <Card className="flex h-full items-center gap-4 p-5 transition-colors hover:border-ring/40">
      <div className="rounded-lg bg-muted/70 p-2.5">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <p className="font-mono text-2xl font-bold tabular-nums">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{caption}</p>
      </div>
    </Card>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function KpiCost({
  totalCost,
  dims,
}: {
  totalCost: number;
  dims?: Record<string, number>;
}) {
  const entries = Object.entries(dims || {}).sort((a, b) => b[1] - a[1]);
  const [topName, topValue] = entries[0] || [null, null];
  return (
    <Card className="flex h-full items-center gap-4 p-5">
      <div className="rounded-lg bg-muted/70 p-2.5">
        <Zap className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Observed cost · 7d
        </p>
        <p className="font-mono text-2xl font-bold tabular-nums">
          ${totalCost.toFixed(2)}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {topName != null
            ? `most in ${topName}: $${Number(topValue).toFixed(2)}`
            : "No metered spend yet"}
        </p>
      </div>
    </Card>
  );
}