"use client";

import useSWR from "swr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Brain, Target, Wrench, Cpu, Activity, Play, Pause, Square, Users } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const statusColor: Record<string, string> = {
  IDLE: "bg-muted text-muted-foreground",
  RUNNING: "bg-success/10 text-success",
  WAITING: "bg-warning/10 text-warning",
  PAUSED: "bg-info/10 text-info",
  ERROR: "bg-destructive/10 text-destructive",
  OFFLINE: "bg-muted text-faint",
};

export default function AgentDetailPage({ params }: { params: { id: string } }) {
  const { data, isLoading, mutate } = useSWR(`/api/agents/${params.id}`, fetcher);
  const { data: toolsData } = useSWR("/api/tools", fetcher);
  const { data: modelsData } = useSWR("/api/models", fetcher);
  const { data: coloniesData } = useSWR("/api/colonies", fetcher);

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Loading agent...</div>;
  if (!data?.agent) return <div className="p-6 text-center text-muted-foreground">Agent not found</div>;

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
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/agents">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-lg p-3 bg-primary/10 border border-primary/20">
            <Brain className="h-7 w-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              <Badge className={cn(statusColor[agent.status])}>{agent.status}</Badge>
              <Badge variant="outline">{agent.type}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{agent.description}</p>
            {colony && (
              <p className="text-xs text-faint mt-2">in <Link href="/colonies" className="underline">{colony.name}</Link></p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {agent.status === "IDLE" && (
            <Button size="sm" onClick={() => handleStatusChange("RUNNING")} className="gap-2">
              <Play className="h-3.5 w-3.5" /> Start
            </Button>
          )}
          {agent.status === "RUNNING" && (
            <Button size="sm" variant="outline" onClick={() => handleStatusChange("PAUSED")} className="gap-2">
              <Pause className="h-3.5 w-3.5" /> Pause
            </Button>
          )}
          {agent.status === "PAUSED" && (
            <Button size="sm" onClick={() => handleStatusChange("RUNNING")} className="gap-2">
              <Play className="h-3.5 w-3.5" /> Resume
            </Button>
          )}
          {(agent.status === "RUNNING" || agent.status === "PAUSED") && (
            <Button size="sm" variant="outline" onClick={() => handleStatusChange("IDLE")} className="gap-2">
              <Square className="h-3.5 w-3.5" /> Stop
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Tasks Completed</p>
          <p className="text-2xl font-bold mt-1">{agent.tasksCompleted}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Success Rate</p>
          <p className="text-2xl font-bold mt-1">{agent.successRate}%</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Avg Duration</p>
          <p className="text-2xl font-bold mt-1">{agent.avgDuration ? `${agent.avgDuration}ms` : "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Cost</p>
          <p className="text-2xl font-bold mt-1">${agent.totalCost.toFixed(4)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-6">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Target className="h-4 w-4" /> Capabilities
          </h2>
          {caps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No capabilities assigned</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {caps.map((c) => (
                <Badge key={c} variant="outline" className="font-mono text-xs">{c}</Badge>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Wrench className="h-4 w-4" /> Tools
          </h2>
          {tools.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tools assigned</p>
          ) : (
            <div className="space-y-2">
              {tools.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <span className="font-mono">{t.name}</span>
                  <Badge variant="outline" className="text-xs">{t.source}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Cpu className="h-4 w-4" /> Models
          </h2>
          {models.length === 0 ? (
            <p className="text-sm text-muted-foreground">No models assigned</p>
          ) : (
            <div className="space-y-2">
              {models.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="font-mono">{m.name}</span>
                  <span className="text-xs text-faint">{m.contextWindow.toLocaleString()} ctx</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4" /> Memory Scope
          </h2>
          <Badge variant="outline">{agent.memoryScope}</Badge>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-sm font-semibold mb-3">Recent Activity</h2>
        {!events || events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity</p>
        ) : (
          <div className="space-y-2">
            {events.slice(0, 10).map((e: any) => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs">{e.type}</span>
                <span className="text-xs text-faint">{formatRelativeTime(e.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
