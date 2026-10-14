"use client";

import * as React from "react";
import useSWR from "swr";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Target,
  Wrench,
  Cpu,
  Activity,
  Play,
  Pause,
  Square,
  ListTodo,
  Gauge,
  CircleDollarSign,
  type LucideIcon,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StateDot } from "@/components/shared/state-dot";

const EASE = [0.16, 1, 0.3, 1] as const;

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function Panel({
  title,
  icon: Icon,
  children,
  index = 0,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.05 + index * 0.06, ease: EASE }}
    >
      <Card className="h-full p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </h2>
        {children}
      </Card>
    </motion.div>
  );
}

export default function AgentDetailPage({ params }: { params: { id: string } }) {
  const { data, isLoading, mutate } = useSWR(`/api/agents/${params.id}`, fetcher);
  const { data: toolsData } = useSWR("/api/tools", fetcher);
  const { data: modelsData } = useSWR("/api/models", fetcher);
  const { data: coloniesData } = useSWR("/api/colonies", fetcher);

  if (isLoading)
    return (
      <div className="mx-auto flex max-w-[1400px] items-center justify-center py-24 text-sm text-muted-foreground">
        Loading agent…
      </div>
    );
  if (!data?.agent)
    return (
      <div className="mx-auto flex max-w-[1400px] items-center justify-center py-24 text-sm text-muted-foreground">
        Agent not found
      </div>
    );

  const { agent, events } = data;
  const caps = JSON.parse(agent.capabilities || "[]") as string[];
  const toolIds = JSON.parse(agent.tools || "[]") as string[];
  const modelIds = JSON.parse(agent.models || "[]") as string[];
  const tools = (toolsData?.tools || []).filter((t: any) => toolIds.includes(t.id));
  const models = (modelsData?.models || []).filter((m: any) => modelIds.includes(m.id));
  const colony = (coloniesData?.colonies || []).find((c: any) => c.id === agent.colonyId);

  const handleStatusChange = async (newStatus: string) => {
    await fetch(`/api/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    mutate();
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        backHref="/agents"
        backLabel="All agents"
        eyebrow={colony ? `Workforce · ${colony.name}` : "Workforce"}
        icon={Brain}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {agent.name}
            <Badge variant="outline" className="font-mono text-[11px] uppercase">
              {agent.type}
            </Badge>
            <StateDot state={agent.runtimeState} />
          </span>
        }
        description={agent.description}
        actions={
          <>
            {agent.status === "IDLE" && (
              <Button
                size="sm"
                onClick={() => handleStatusChange("RUNNING")}
                className="gap-2"
              >
                <Play className="h-3.5 w-3.5" /> Start
              </Button>
            )}
            {agent.status === "RUNNING" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange("PAUSED")}
                className="gap-2"
              >
                <Pause className="h-3.5 w-3.5" /> Pause
              </Button>
            )}
            {agent.status === "PAUSED" && (
              <Button
                size="sm"
                onClick={() => handleStatusChange("RUNNING")}
                className="gap-2"
              >
                <Play className="h-3.5 w-3.5" /> Resume
              </Button>
            )}
            {(agent.status === "RUNNING" || agent.status === "PAUSED") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange("IDLE")}
                className="gap-2"
              >
                <Square className="h-3.5 w-3.5" /> Stop
              </Button>
            )}
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          index={0}
          icon={ListTodo}
          label="Tasks completed"
          value={agent.tasksCompleted ?? 0}
          caption={agent.status ? `Status: ${agent.status}` : "No status"}
        />
        <KpiCard
          index={1}
          icon={Target}
          label="Success rate"
          value={agent.successRate ?? 0}
          suffix="%"
          caption="Across all runs"
          accent="hsl(var(--success) / 0.4)"
        />
        <KpiCard
          index={2}
          icon={Gauge}
          label="Avg duration"
          value={agent.avgDuration ?? 0}
          suffix="ms"
          caption="Mean task time"
        />
        <KpiCard
          index={3}
          icon={CircleDollarSign}
          label="Total cost"
          value={Number(agent.totalCost ?? 0)}
          prefix="$"
          caption="Metered spend"
          accent="hsl(var(--primary) / 0.4)"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Capabilities" icon={Target} index={0}>
          {caps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No capabilities assigned</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {caps.map((c) => (
                <Badge key={c} variant="secondary" className="font-mono text-xs">
                  {c}
                </Badge>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Tools" icon={Wrench} index={1}>
          {tools.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tools assigned</p>
          ) : (
            <div className="space-y-2">
              {tools.map((t: any) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between border-b border-border/60 pb-2 text-sm last:border-0 last:pb-0"
                >
                  <span className="font-mono">{t.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {t.source}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Models" icon={Cpu} index={2}>
          {models.length === 0 ? (
            <p className="text-sm text-muted-foreground">No models assigned</p>
          ) : (
            <div className="space-y-2">
              {models.map((m: any) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between border-b border-border/60 pb-2 text-sm last:border-0 last:pb-0"
                >
                  <span className="font-mono">{m.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.contextWindow?.toLocaleString?.() ?? m.contextWindow} ctx
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Memory scope" icon={Activity} index={3}>
          <Badge variant="outline" className="font-mono">
            {agent.memoryScope || "default"}
          </Badge>
        </Panel>
      </section>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.2, ease: EASE }}
      >
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-muted-foreground" /> Recent activity
          </h2>
          {!events || events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          ) : (
            <ol className="relative space-y-4 border-l border-border/60 pl-4">
              {events.slice(0, 10).map((e: any) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-muted-foreground/50" />
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-mono text-xs">{e.type}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {formatRelativeTime(e.timestamp)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </motion.div>
    </div>
  );
}