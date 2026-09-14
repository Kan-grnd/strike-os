"use client";

import { useSWRConfig } from "swr";
import useSWR from "swr";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Brain, Play, Pause, Square, RefreshCw, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const statusColor: Record<string, string> = {
  PLANNING: "bg-muted text-muted-foreground",
  READY: "bg-muted text-muted-foreground",
  RUNNING: "bg-success/10 text-success",
  PAUSED: "bg-info/10 text-info",
  BLOCKED: "bg-warning/10 text-warning",
  COMPLETED: "bg-success/10 text-success",
  FAILED: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-faint",
};

export default function MissionDetailPage({ params }: { params: { id: string } }) {
  const { mutate } = useSWRConfig();
  const { data } = useSWR(`/api/missions/${params.id}`, fetcher, { refreshInterval: 2000 });

  const mission = data?.mission;
  const events = data?.events || [];

  const handleStatus = async (action: string) => {
    await fetch(`/api/missions/${params.id}/${action}`, { method: "POST" });
    mutate(`/api/missions/${params.id}`);
  };

  const progress = () => {
    if (!mission?.tasks?.length) return 0;
    const done = mission.tasks.filter((t: any) => ["COMPLETED", "FAILED", "CANCELLED"].includes(t.status)).length;
    return Math.round((done / mission.tasks.length) * 100);
  };

  if (!mission) return <div className="p-6">Loading...</div>;

  const plan = JSON.parse(mission.plan || "[]");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/missions">
          <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">{mission.goal}</h1>
            <Badge className={statusColor[mission.status] || "bg-muted"}>{mission.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Mission ID: {mission.id} • Priority: {mission.priority}</p>
          {mission.completedAt && (
            <p className="text-xs text-faint">Completed: {new Date(mission.completedAt).toLocaleString()}</p>
          )}
        </div>
        <div className="flex gap-2">
          {mission.status === "READY" && <Button onClick={() => handleStatus("start")} className="gap-2"><Play className="h-3.5 w-3.5" /> Start</Button>}
          {mission.status === "RUNNING" && <Button variant="outline" onClick={() => handleStatus("pause")} className="gap-2"><Pause className="h-3.5 w-3.5" /> Pause</Button>}
          {mission.status === "PAUSED" && <Button onClick={() => handleStatus("resume")} className="gap-2"><Play className="h-3.5 w-3.5" /> Resume</Button>}
          {mission.status === "RUNNING" && <Button onClick={() => handleStatus("cancel")} variant="outline" size="sm" className="gap-2"><Square className="h-3.5 w-3.5" /> Cancel</Button>}
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.location.reload()}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Progress</p><p className="font-bold text-2xl">{progress()}%</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Tasks</p><p className="font-bold text-2xl">{mission.tasks?.length || 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Cost</p><p className="font-bold text-2xl">${mission.totalCost?.toFixed(4) || "0"}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Duration</p><p className="font-bold text-2xl">{mission.duration ? `${Math.round(mission.duration / 1000)}s` : "—"}</p></Card>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-6 col-span-2">
          <h2 className="font-semibold mb-4">Plan</h2>
          {plan.length > 0 ? (
            <div className="space-y-2">
              {plan.map((step: any) => (
                <div key={step.step} className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2 border">
                  <Badge variant="outline" className="font-mono">{step.step}</Badge>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium">{step.description}</p><p className="text-xs text-faint">{step.agentType}</p></div>
                  <span className="text-xs text-faint">~{Math.round((step.estimatedDuration || 0) / 1000)}s</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No plan defined yet. You can replan this mission.</p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-3">Tasks</h2>
          {!mission.tasks?.length ? (
            <p className="text-sm text-muted-foreground">No tasks assigned</p>
          ) : (
            <div className="space-y-2">
              {mission.tasks.map((t: any) => (
                <Link key={t.id} href={`/tasks/${t.id}`}>
                  <div className="flex items-center gap-2 text-sm p-2 rounded-md hover:bg-muted transition-colors">
                    <Badge variant="outline" className="text-xs font-mono">{t.status}</Badge>
                    <span className="truncate">{t.description}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Separator />

      <div>
        <h2 className="font-semibold mb-2">Events</h2>
        <div className="max-h-64 overflow-auto space-y-2">
          {events.slice(0, 10).map((e: any) => (
            <div key={e.id} className="text-xs text-muted-foreground">
              <span className="font-mono">{e.type}</span> — {new Date(e.timestamp).toLocaleTimeString()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
