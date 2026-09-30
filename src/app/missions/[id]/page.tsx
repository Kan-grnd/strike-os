"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Pause, Square, RefreshCw, Sparkles, AlertCircle } from "lucide-react";
import { useMission } from "@/hooks/useApi";
import { MissionProgressBar } from "@/components/execution/mission-progress-bar";
import { DataTable, type DataTableColumn } from "@/components/execution/data-table";
import { safeJson, formatCost, formatDuration } from "@/lib/utils";
import { MISSION_STATUS_COLOR, TASK_STATUS_COLOR, missionProgress } from "@/lib/execution-meta";

const PLAN_COLUMNS: DataTableColumn<any>[] = [
  {
    header: "Step",
    width: "70px",
    render: (s) => <Badge variant="outline" className="font-mono">{s.step}</Badge>,
  },
  { header: "Description", render: (s) => <span className="font-medium">{s.description}</span> },
  {
    header: "Agent",
    width: "180px",
    render: (s) => <span className="text-xs text-muted-foreground">{s.agentType}</span>,
  },
  {
    header: "Est.",
    width: "90px",
    align: "right",
    render: (s) => (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {formatDuration(s.estimatedDuration)}
      </span>
    ),
  },
];

const TASK_COLUMNS: DataTableColumn<any>[] = [
  {
    header: "Status",
    width: "120px",
    render: (t) => (
      <Badge className={TASK_STATUS_COLOR[t.status] || "bg-muted text-muted-foreground"}>{t.status}</Badge>
    ),
  },
  {
    header: "Description",
    render: (t) => (
      <Link href={`/tasks/${t.id}`} className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-sm">
        {t.description}
      </Link>
    ),
  },
  {
    header: "Owner",
    width: "150px",
    render: (t) => (
      <span className="text-xs text-muted-foreground font-mono truncate block">
        {t.ownerAgentId ? t.ownerAgentId.slice(0, 8) : "—"}
      </span>
    ),
  },
];

const EVENT_COLUMNS: DataTableColumn<any>[] = [
  {
    header: "Type",
    width: "170px",
    render: (e) => <span className="font-mono text-xs font-medium">{e.type}</span>,
  },
  {
    header: "Time",
    width: "180px",
    render: (e) => (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {new Date(e.timestamp).toLocaleString()}
      </span>
    ),
  },
  {
    header: "Links",
    width: "150px",
    render: (e) => (
      <span className="flex items-center gap-2 text-xs">
        {e.agentId && (
          <Link href={`/agents/${e.agentId}`} className="text-info hover:underline font-mono">
            agent {e.agentId.slice(0, 8)}
          </Link>
        )}
        {e.taskId && (
          <Link href={`/tasks/${e.taskId}`} className="text-info hover:underline font-mono">
            task {e.taskId.slice(0, 8)}
          </Link>
        )}
        {!e.agentId && !e.taskId && <span className="text-muted-foreground">—</span>}
      </span>
    ),
  },
  {
    header: "Payload",
    render: (e) => {
      const payload = safeJson<Record<string, unknown>>(e.payload, {});
      const text = Object.keys(payload)
        .filter((k) => typeof payload[k] === "string" && (payload[k] as string).length > 0)
        .map((k) => `${k}: ${String(payload[k]).slice(0, 120)}`)
        .join(" · ");
      return (
        <span className="text-xs text-muted-foreground truncate block max-w-[360px]" title={text}>
          {text || "—"}
        </span>
      );
    },
  },
];

export default function MissionDetailPage({ params }: { params: { id: string } }) {
  const { data, error, isLoading, mutate } = useMission(params.id);

  const [busy, setBusy] = useState<"start" | "pause" | "resume" | "cancel" | null>(null);
  const [actionError, setActionError] = useState("");

  const mission = data?.mission;
  const events = data?.events || [];
  /* The table caption promises newest-last, so sort rather than trust the
     API's order. Unparseable timestamps sink to the bottom instead of
     rendering "Invalid Date" at the top of the log. */
  const eventsByTime = [...events].sort(
    (a: any, b: any) => (new Date(a.timestamp).getTime() || 0) - (new Date(b.timestamp).getTime() || 0)
  );

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

      {/* One dense strip instead of four stat cards: the same four numbers,
          read across instead of down. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden border">
        <div className="bg-background p-3">
          <p className="text-xs text-muted-foreground">Progress</p>
          <p className="font-bold text-xl tabular-nums">{prog.pct}%</p>
          {(prog.failed > 0 || prog.cancelled > 0) && (
            <p className="text-xs">
              {prog.failed > 0 && <span className="text-destructive">{prog.failed} failed</span>}
              {prog.failed > 0 && prog.cancelled > 0 && <span className="text-muted-foreground"> · </span>}
              {prog.cancelled > 0 && <span className="text-muted-foreground">{prog.cancelled} cancelled</span>}
            </p>
          )}
          <MissionProgressBar mission={mission} className="mt-1.5" />
        </div>
        <div className="bg-background p-3">
          <p className="text-xs text-muted-foreground">Tasks</p>
          <p className="font-bold text-xl tabular-nums">{prog.total}</p>
        </div>
        <div className="bg-background p-3">
          <p className="text-xs text-muted-foreground">Cost</p>
          <p className="font-bold text-xl tabular-nums">{formatCost(mission.totalCost)}</p>
        </div>
        <div className="bg-background p-3">
          <p className="text-xs text-muted-foreground">Duration</p>
          <p className="font-bold text-xl tabular-nums">{formatDuration(mission.duration)}</p>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Plan</h2>
        {plan.length > 0 ? (
          <DataTable
            columns={PLAN_COLUMNS}
            rows={plan}
            rowKey={(s: any) => String(s.step)}
            minWidth="560px"
            caption="Mission plan steps"
          />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">No plan defined yet.</p>
            <Button onClick={genPlan} disabled={busy !== null} className="gap-2">
              <Sparkles className="h-3.5 w-3.5" /> Generate Plan
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Tasks</h2>
        {!mission.tasks?.length ? (
          <p className="text-sm text-muted-foreground">No tasks assigned</p>
        ) : (
          <DataTable
            columns={TASK_COLUMNS}
            rows={mission.tasks}
            rowKey={(t: any) => t.id}
            minWidth="480px"
            caption="Tasks assigned to this mission"
          />
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Events</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <DataTable
            columns={EVENT_COLUMNS}
            rows={eventsByTime.slice(0, 20)}
            rowKey={(e: any) => e.id}
            minWidth="620px"
            caption="Mission events, newest last"
          />
        )}
      </section>
    </div>
  );
}