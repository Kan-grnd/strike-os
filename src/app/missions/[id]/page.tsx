"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, RefreshCw, Sparkles, AlertCircle, Target } from "lucide-react";
import { useMission } from "@/hooks/useApi";
import { MissionProgressBar } from "@/components/execution/mission-progress-bar";
import { DataTable, type DataTableColumn } from "@/components/execution/data-table";
import { safeJson, formatCost, formatDuration } from "@/lib/utils";
import { MISSION_STATUS_COLOR, TASK_STATUS_COLOR, missionProgress, taskSimulated } from "@/lib/execution-meta";
import { parseMissionPlan } from "@/lib/plan";
import { PageHeader, SectionLabel } from "@/components/shared/page-header";

const PLAN_COLUMNS: DataTableColumn<any>[] = [
  {
    header: "Step",
    width: "70px",
    render: (s) => (
      <Badge variant="outline" className="font-mono">
        {s.step}
      </Badge>
    ),
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
      <span className="whitespace-nowrap text-xs text-muted-foreground">
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
      <span className="flex items-center gap-2">
        <Link
          href={`/tasks/${t.id}`}
          className="rounded-xl hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          {t.description}
        </Link>
        {taskSimulated(t.output) && <Badge className="bg-warning/10 text-warning">Simulated</Badge>}
      </span>
    ),
  },
  {
    header: "Owner",
    width: "150px",
    render: (t) => (
      <span className="block truncate font-mono text-xs text-muted-foreground">
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
      <span className="whitespace-nowrap text-xs text-muted-foreground">
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
          <Link href={`/agents/${e.agentId}`} className="font-mono text-info hover:underline">
            agent {e.agentId.slice(0, 8)}
          </Link>
        )}
        {e.taskId && (
          <Link href={`/tasks/${e.taskId}`} className="font-mono text-info hover:underline">
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
        <span className="block max-w-[360px] truncate text-xs text-muted-foreground" title={text}>
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
  const eventsByTime = [...events].sort(
    (a: any, b: any) => (new Date(a.timestamp).getTime() || 0) - (new Date(b.timestamp).getTime() || 0)
  );

  const handleStatus = async (action: "start" | "pause" | "resume" | "cancel") => {
    if (busy) return;
    if (action === "cancel") {
      const draft = mission && ["PLANNING", "READY"].includes(mission.status);
      const msg = draft
        ? "Abandon this mission? Nothing has been run."
        : "Cancel this mission? Running tasks will be cancelled.";
      if (!window.confirm(msg)) return;
    }
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
        body: JSON.stringify({}),
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

  if (isLoading && !mission)
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );

  if (error && !mission) {
    const status = (error as Error & { status?: number }).status;
    return (
      <div className="mx-auto max-w-md">
        <Card className="space-y-4 p-12 text-center">
          <p className="text-lg font-medium">{status === 404 ? "Mission not found" : "Failed to load mission"}</p>
          <p className="text-sm text-muted-foreground">
            {status === 404 ? "It may have been deleted." : error.message}
          </p>
          <Button variant="outline" onClick={() => mutate()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (!mission) return null;

  const parsedPlan = parseMissionPlan(mission.plan);
  const plan = parsedPlan.steps;
  const prog = missionProgress(mission);
  const isTerminal = ["COMPLETED", "FAILED", "CANCELLED"].includes(mission.status);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        backHref="/work?type=missions"
        icon={Target}
        eyebrow="Mission"
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate">{mission.goal}</span>
            <Badge className={MISSION_STATUS_COLOR[mission.status] || "bg-muted"}>{mission.status}</Badge>
          </span>
        }
        description={`Priority ${mission.priority} · ${mission.id.slice(0, 8)}${
          mission.completedAt ? ` · completed ${new Date(mission.completedAt).toLocaleString()}` : ""
        }`}
        actions={
          <>
            {mission.status === "PLANNING" && (
              <>
                <Button onClick={genPlan} disabled={busy !== null} className="gap-2">
                  <Sparkles className="h-3.5 w-3.5" /> {busy === "start" ? "Planning…" : "Generate Plan"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleStatus("cancel")}
                  disabled={busy !== null}
                  className="gap-2"
                >
                  <Square className="h-3.5 w-3.5" /> Abandon
                </Button>
              </>
            )}
            {mission.status === "READY" && (
              <>
                <Button onClick={() => handleStatus("start")} disabled={busy !== null} className="gap-2">
                  <Play className="h-3.5 w-3.5" /> {busy === "start" ? "Starting…" : "Approve & launch"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleStatus("cancel")}
                  disabled={busy !== null}
                  className="gap-2"
                >
                  <Square className="h-3.5 w-3.5" /> Abandon
                </Button>
              </>
            )}
            {mission.status === "RUNNING" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleStatus("pause")}
                  disabled={busy !== null}
                  className="gap-2"
                >
                  <Pause className="h-3.5 w-3.5" /> Pause
                </Button>
                <Button variant="outline" onClick={() => handleStatus("cancel")} disabled={busy !== null} className="gap-2">
                  <Square className="h-3.5 w-3.5" /> Cancel
                </Button>
              </>
            )}
            {mission.status === "PAUSED" && (
              <>
                <Button onClick={() => handleStatus("resume")} disabled={busy !== null} className="gap-2">
                  <Play className="h-3.5 w-3.5" /> Resume
                </Button>
                <Button variant="outline" onClick={() => handleStatus("cancel")} disabled={busy !== null} className="gap-2">
                  <Square className="h-3.5 w-3.5" /> Cancel
                </Button>
              </>
            )}
            {plan.length > 0 && !isTerminal && (
              <Button variant="outline" size="sm" onClick={genPlan} disabled={busy !== null} className="gap-2">
                <RefreshCw className="h-3.5 w-3.5" /> Replan
              </Button>
            )}
          </>
        }
      />

      {actionError && (
        <p className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {actionError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
        <div className="bg-background p-4">
          <SectionLabel>Progress</SectionLabel>
          <p className="mt-1 text-2xl font-bold tabular-nums">{prog.pct}%</p>
          {(prog.failed > 0 || prog.cancelled > 0) && (
            <p className="text-xs">
              {prog.failed > 0 && <span className="text-destructive">{prog.failed} failed</span>}
              {prog.failed > 0 && prog.cancelled > 0 && <span className="text-muted-foreground"> · </span>}
              {prog.cancelled > 0 && <span className="text-muted-foreground">{prog.cancelled} cancelled</span>}
            </p>
          )}
          <MissionProgressBar mission={mission} className="mt-2" />
        </div>
        <div className="bg-background p-4">
          <SectionLabel>Tasks</SectionLabel>
          <p className="mt-1 text-2xl font-bold tabular-nums">{prog.total}</p>
        </div>
        <div className="bg-background p-4">
          <SectionLabel>Cost</SectionLabel>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCost(mission.totalCost)}</p>
        </div>
        <div className="bg-background p-4">
          <SectionLabel>Duration</SectionLabel>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatDuration(mission.duration)}</p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <SectionLabel>Plan</SectionLabel>
          {parsedPlan.simulated && <Badge className="bg-warning/10 text-warning">Simulated</Badge>}
        </div>
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

      <section className="space-y-3">
        <SectionLabel>Tasks</SectionLabel>
        {prog.total > 0 ? (
          <DataTable
            columns={TASK_COLUMNS}
            rows={mission.tasks || []}
            rowKey={(t: any) => t.id}
            minWidth="520px"
            caption="Mission tasks"
          />
        ) : (
          <p className="text-sm text-muted-foreground">No tasks yet.</p>
        )}
      </section>

      <section className="space-y-3">
        <SectionLabel>Activity</SectionLabel>
        {eventsByTime.length > 0 ? (
          <DataTable
            columns={EVENT_COLUMNS}
            rows={eventsByTime}
            rowKey={(e: any) => e.id}
            minWidth="680px"
            caption="Mission event log"
          />
        ) : (
          <p className="text-sm text-muted-foreground">No events recorded yet.</p>
        )}
      </section>
    </div>
  );
}