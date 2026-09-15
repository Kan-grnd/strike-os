"use client";

import * as React from "react";
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
  CheckCircle2,
  Clock,
  AlertCircle,
  Rocket,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
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
import { FleetHealth, isAgentActiveLive } from "@/components/dashboard/charts";

export default function HomePage() {
  const { data: agentsData, isLoading: agentsLoading } = useAgents();
  const { data: tasksData, isLoading: tasksLoading } = useTasks({ status: "RUNNING" });
  const { data: missionsData, isLoading: missionsLoading } = useMissions();
  const { data: automationsData, isLoading: automationsLoading } = useAutomations();
  const { data: eventsData, isLoading: eventsLoading } = useEvents({});
  const { data: performanceData, isLoading: performanceLoading } = usePerformance();
  const { data: costsData, isLoading: costsLoading } = useCosts();

  const agents = agentsData?.agents || [];
  const runningTasks = tasksData?.tasks || [];
  const missions = missionsData?.missions || [];
  const automations = automationsData?.automations || [];
  const missionPercent: Record<string, number> = {};
  for (const m of missions as any[]) {
    const tasks = m.tasks || [];
    const done = tasks.filter((t: any) => t.status === "COMPLETED").length;
    missionPercent[`mission:${m.id}`] = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  }
  const performance = performanceData || { completedTasks: 0, failedTasks: 0 };
  const costs = costsData && costsData.totalCost > 0 ? costsData : undefined;

  const loading =
    agentsLoading ||
    tasksLoading ||
    missionsLoading ||
    automationsLoading ||
    eventsLoading ||
    performanceLoading ||
    costsLoading;

  const activeMissions = missions.filter((m: any) => m.status === "RUNNING");
  const activeAgents = agents.filter((a: any) => isAgentActiveLive(a));
  const completedToday = missions.filter(
    (m: any) =>
      m.status === "COMPLETED" &&
      new Date(m.updatedAt || m.createdAt).toDateString() === new Date().toDateString()
  ).length;
  const activeAutomations = automations.filter((a: any) => a.status === "ACTIVE").length;

  const nowItems: { title: string; description: string; status: "running" | "waiting" | "completed"; time: string }[] = [];
  activeMissions.forEach((m: any) => {
    nowItems.push({
      title: truncate(m.goal, 48),
      description: `${m.tasks?.length || 0} tasks • ${activeAgents.length} agents active`,
      status: "running",
      time: formatRelativeTime(m.createdAt),
    });
  });
  runningTasks.forEach((t: any) => {
    nowItems.push({
      title: truncate(t.description, 48),
      description: `Task ${t.status?.toLowerCase() || "queued"} • owner ${t.ownerAgentId ? "assigned" : "unassigned"}`,
      status: "waiting",
      time: formatRelativeTime(t.createdAt),
    });
  });
  const scheduled = automations.filter(
    (a: any) => (a.status === "ACTIVE" || a.status === "SCHEDULED") && a.nextRun
  );
  scheduled.slice(0, 3).forEach((a: any) => {
    nowItems.push({
      title: truncate(a.name, 48),
      description: a.description || "Scheduled automation",
      status: "waiting",
      time: a.nextRun ? formatRelativeTime(a.nextRun) : "scheduled",
    });
  });
  const nowTop = nowItems.slice(0, 3);
  const nextAutomation = scheduled[0] ?? null;

  const streamEvents: { event: string; description: string; time: string }[] = (eventsData?.events || []).slice(0, 6).map((e: any) => {
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
        "",
      time: formatRelativeTime(e.timestamp),
    };
  });

  return (
    <div className="p-6 space-y-6">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">System Status</h2>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="space-y-3">
                  <div className="h-3 w-20 rounded bg-muted" />
                  <div className="h-8 w-12 rounded bg-muted" />
                  <div className="h-3 w-28 rounded bg-muted" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Users}
              label="Active Agents"
              value={String(activeAgents.length)}
              change={`${agents.length} total`}
              trend="neutral"
            />
            <StatCard
              icon={ListTodo}
              label="Running Tasks"
              value={String(runningTasks.length)}
              change={`${tasksData?.tasks?.length || 0} running now`}
              trend="neutral"
            />
            <StatCard
              icon={Brain}
              label="Active Missions"
              value={String(activeMissions.length)}
              change={`${completedToday} completed today`}
              trend="neutral"
            />
            <StatCard
              icon={Zap}
              label="Automations"
              value={String(activeAutomations)}
              change={
                nextAutomation
                  ? `${automations.length} configured · next ${truncate(nextAutomation.name, 14)} ${formatRelativeTime(nextAutomation.nextRun)}`
                  : `${automations.length} configured`
              }
              trend="neutral"
            />
          </div>
        )}
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Fleet Health</h2>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="space-y-3">
                  <div className="h-3 w-24 rounded bg-muted" />
                  <div className="h-12 w-full rounded bg-muted" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <FleetHealth
            agents={agents}
            runningMissions={activeMissions}
            missionPercent={missionPercent}
            events={eventsData?.events || []}
            completed={performance.completedTasks ?? 0}
            failed={performance.failedTasks ?? 0}
            costs={costs}
          />
        )}
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Current Activity</h2>
          <Badge variant="outline" className="gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Live
          </Badge>
        </div>

        {!loading && agents.length === 0 && missions.length === 0 && automations.length === 0 ? (
          <EmptyState
            icon={Rocket}
            title="No activity yet"
            description="Create your first agent to start building your workforce."
            cta="Create your first agent"
            ctaHref="/architect"
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-6">
              <h3 className="mb-4 text-sm font-semibold text-muted-foreground">NOW</h3>
              {nowTop.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing running right now.</p>
              ) : (
                <div className="space-y-4">
                  {nowTop.map((item, i) => (
                    <ActivityItem key={i} {...item} />
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h3 className="mb-4 text-sm font-semibold text-muted-foreground">
                OPERATIONAL STREAM
              </h3>
              <ScrollArea className="h-[200px]">
                <div className="space-y-3">
                  {streamEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No system events yet.</p>
                  ) : (
                    streamEvents.map((ev, i) => <StreamEvent key={i} {...ev} />)
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Quick Actions</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <QuickActionCard
            title="Create Agent"
            description="Add a new agent to your workforce"
            icon={Users}
          />
          <QuickActionCard
            title="Start Mission"
            description="Launch a new mission"
            icon={Brain}
          />
          <QuickActionCard
            title="View Topology"
            description="See your live system graph"
            icon={Activity}
          />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  change,
  trend,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
}) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{change}</p>
        </div>
        <div className="rounded-md bg-muted p-2.5">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}

function ActivityItem({
  title,
  description,
  status,
  time,
}: {
  title: string;
  description: string;
  status: "running" | "waiting" | "completed";
  time: string;
}) {
  const Icon = status === "running" ? Zap : status === "waiting" ? Clock : CheckCircle2;

  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "mt-0.5 rounded-md p-1.5",
          status === "running" && "bg-primary/10 text-primary",
          status === "waiting" && "bg-muted text-muted-foreground",
          status === "completed" && "bg-success/10 text-success"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
        <p className="text-micro text-muted-foreground">{time}</p>
      </div>
    </div>
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
    <div className="flex items-start gap-3 text-sm">
      <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
      <div className="flex-1 space-y-0.5">
        <p className="font-medium">{event}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
        <p className="text-micro text-muted-foreground">{time}</p>
      </div>
    </div>
  );
}

function truncate(text: string, max: number) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function QuickActionCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="group cursor-pointer transition-colors hover:border-primary/50 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-muted p-2 group-hover:bg-primary/10 transition-colors">
          <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </Card>
  );
}