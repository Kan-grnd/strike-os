"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Play, Pause, Square, RefreshCw, Sparkles, AlertCircle } from "lucide-react";
import { useMission } from "@/hooks/useApi";
import { MissionProgressBar } from "@/components/execution/mission-progress-bar";
import { safeJson, formatCost, formatDuration } from "@/lib/utils";
import { MISSION_STATUS_COLOR, missionProgress } from "@/lib/execution-meta";

export default function MissionDetailPage({ params }: { params: { id: string } }) {
  const { data, error, isLoading, mutate } = useMission(params.id);

  const [busy, setBusy] = useState<"start" | "pause" | "resume" | "cancel" | null>(null);
  const [actionError, setActionError] = useState("");

  const mission = data?.mission;
  const events = data?.events || [];

  const handleStatus = async (action: "start" | "pause" | "resume" | "cancel") => {
    if (busy) return;
    if (action === "cancel" && !window.confirm("Cancel this mission? Running tasks will be cancelled.")) return;
    setBusy(action);
    setActionError("");
    try {
      const res = await fetch(`/api/missions/${params.id}/${action}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed: ${res.status}`);
      }
      await mutate();
    } catch (e: any) {
      setActionError(e?.message || "Action failed. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const genPlan = async () => {
    if (busy) return;
    setBusy("start");
    setActionError("");
    try {
      const res = await fetch(`/api/missions/${params.id}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ llm: false }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Planning failed: ${res.status}`);
      }
      if (mission?.status === "PLANNING") {
        await fetch(`/api/missions/${params.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "READY" }),
        });
      }
      await mutate();
    } catch (e: any) {
      setActionError(e?.message || "Planning failed. Try again.");
    } finally {
      setBusy(null);
    }
  };

  if (isLoading && !mission) return <div className="p-6">Loading mission...</div>;

  if (error && !mission) {
    const status = (error as Error & { status?: number }).status;
    return (
      <div className="p-6">
        <Card className="p-12 text-center space-y-4 max-w-md mx-auto">
          <p className="text-lg font-medium">{status === 404 ? "Mission not found" : "Failed to load mission"}</p>
          <p className="text-sm text-muted-foreground">{status === 404 ? "It may have been deleted." : error.message}</p>
          <Button variant="outline" onClick={() => mutate()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (!mission) return null;

  const plan = safeJson<Array<{ step: number; description: string; agentType: string; estimatedDuration?: number }>>(mission.plan, []);
  const prog = missionProgress(mission);

  const isTerminal = ["COMPLETED", "FAILED", "CANCELLED"].includes(mission.status);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/work?type=missions">
          <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">{mission.goal}</h1>
            <Badge className={MISSION_STATUS_COLOR[mission.status] || "bg-muted"}>{mission.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Mission ID: {mission.id} • Priority: {mission.priority}</p>
          {mission.completedAt && (
            <p className="text-xs text-muted-foreground">Completed: {new Date(mission.completedAt).toLocaleString()}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {mission.status === "PLANNING" && (
            <Button onClick={genPlan} disabled={busy !== null} className="gap-2">
              <Sparkles className="h-3.5 w-3.5" /> {busy === "start" ? "Planning..." : "Generate Plan"}
            </Button>
          )}
          {mission.status === "READY" && (
            <Button onClick={() => handleStatus("start")} disabled={busy !== null} className="gap-2">
              <Play className="h-3.5 w-3.5" /> {busy === "start" ? "Starting..." : "Start"}
            </Button>
          )}
          {mission.status === "RUNNING" && (
            <>
              <Button variant="outline" onClick={() => handleStatus("pause")} disabled={busy !== null} className="gap-2">
                <Pause className="h-3.5 w-3.5" /> {busy === "pause" ? "Pausing..." : "Pause"}
              </Button>
              <Button onClick={() => handleStatus("cancel")} disabled={busy !== null} variant="outline" className="gap-2">
                <Square className="h-3.5 w-3.5" /> Cancel
              </Button>
            </>
          )}
          {mission.status === "PAUSED" && (
            <>
              <Button onClick={() => handleStatus("resume")} disabled={busy !== null} className="gap-2">
                <Play className="h-3.5 w-3.5" /> {busy === "resume" ? "Resuming..." : "Resume"}
              </Button>
              <Button onClick={() => handleStatus("cancel")} disabled={busy !== null} variant="outline" className="gap-2">
                <Square className="h-3.5 w-3.5" /> Cancel
              </Button>
            </>
          )}
          {plan.length > 0 && !isTerminal && (
            <Button variant="outline" size="sm" onClick={genPlan} disabled={busy !== null} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" /> Replan
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <p className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {actionError}
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Progress</p>
          <p className="font-bold text-2xl">{prog.pct}%</p>
          {prog.failed > 0 && <p className="text-xs text-destructive">{prog.failed} failed</p>}
          {prog.cancelled > 0 && <p className="text-xs text-muted-foreground">{prog.cancelled} cancelled</p>}
          <MissionProgressBar mission={mission} className="mt-2" />
        </Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Tasks</p><p className="font-bold text-2xl">{prog.total}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Cost</p><p className="font-bold text-2xl">{formatCost(mission.totalCost)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Duration</p><p className="font-bold text-2xl">{formatDuration(mission.duration)}</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6 lg:col-span-2">
          <h2 className="font-semibold mb-4">Plan</h2>
          {plan.length > 0 ? (
            <div className="space-y-2">
              {plan.map((step: any) => (
                <div key={step.step} className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2 border">
                  <Badge variant="outline" className="font-mono">{step.step}</Badge>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium">{step.description}</p><p className="text-xs text-muted-foreground">{step.agentType}</p></div>
                  <span className="text-xs text-muted-foreground">{formatDuration(step.estimatedDuration)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">No plan defined yet.</p>
              <Button onClick={genPlan} disabled={busy !== null} className="gap-2">
                <Sparkles className="h-3.5 w-3.5" /> Generate Plan
              </Button>
            </div>
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
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet.</p>
          ) : events.slice(0, 20).map((e: any) => {
            const payload = safeJson<Record<string, unknown>>(e.payload, {});
            const payloadText = Object.keys(payload)
              .filter((k) => typeof payload[k] === "string" && (payload[k] as string).length > 0)
              .map((k) => `${k}: ${String(payload[k]).slice(0, 120)}`)
              .join(" · ");
            return (
              <div key={e.id} className="rounded-md bg-muted/30 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{e.type}</span>
                  <span className="text-muted-foreground">{new Date(e.timestamp).toLocaleString()}</span>
                  {e.agentId && <Link href={`/agents/${e.agentId}`} className="text-info hover:underline truncate">agent {e.agentId.slice(0, 8)}</Link>}
                  {e.taskId && <Link href={`/tasks/${e.taskId}`} className="text-info hover:underline truncate">task {e.taskId.slice(0, 8)}</Link>}
                </div>
                {payloadText && <p className="text-muted-foreground mt-1 truncate">{payloadText}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}