"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, History, AlertCircle, Clock, DollarSign, ListChecks, GitBranch, FileText } from "lucide-react";
import { useOperation } from "@/hooks/useApi";
import { DataTable, type DataTableColumn } from "@/components/execution/data-table";
import { PageHeader, SectionLabel } from "@/components/shared/page-header";
import { formatCost, formatDuration, formatRelativeTime, pluralize } from "@/lib/utils";
import {
  OPERATION_STATUS_COLOR,
  TASK_STATUS_COLOR,
  HEALTH_COLOR,
  HEALTH_LABEL,
  taskSimulated,
} from "@/lib/execution-meta";
import { runDurationMs } from "@/lib/activity";

const terminal = (s: string) => ["COMPLETED", "FAILED", "CANCELLED"].includes(s);

function Recovery({ task }: { task: any }) {
  let tried: string[] = [];
  try {
    tried = JSON.parse(task.recovery || "{}").tried || [];
  } catch {}
  if (!tried.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {tried.map((stage: string) => (
        <Badge key={stage} variant="outline" className="text-[11px] font-normal">
          {stage}
        </Badge>
      ))}
    </span>
  );
}

const COLUMNS: DataTableColumn<any>[] = [
  {
    header: "Task",
    render: (t) => (
      <div className="min-w-[220px] max-w-[420px]">
        <p className="truncate text-sm font-medium">{t.description}</p>
        {t.ownerAgentId && (
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{t.ownerAgentId.slice(0, 12)}</p>
        )}
      </div>
    ),
  },
  {
    header: "Status",
    width: "120px",
    render: (t) => (
      <Badge className={TASK_STATUS_COLOR[t.status] || "bg-muted text-muted-foreground"}>{t.status}</Badge>
    ),
  },
  {
    header: "Health",
    width: "110px",
    render: (t) => {
      if (!t.health || terminal(t.status)) return <span className="text-xs text-muted-foreground">—</span>;
      return (
        <Badge className={HEALTH_COLOR[t.health] || "bg-muted text-muted-foreground"}>
          {HEALTH_LABEL[t.health] || t.health}
        </Badge>
      );
    },
  },
  {
    header: "Retries",
    width: "90px",
    align: "right",
    render: (t) => (
      <span className="text-xs tabular-nums text-muted-foreground">
        {t.retryCount}/{t.maxRetries}
      </span>
    ),
  },
  {
    header: "Recovery",
    width: "170px",
    render: (t) => <Recovery task={t} />,
  },
  {
    header: "Cost",
    width: "90px",
    align: "right",
    render: (t) => <span className="text-sm tabular-nums">{formatCost(t.cost)}</span>,
  },
  {
    header: "Execution",
    width: "110px",
    render: (t) => (
      <Badge
        className={
          taskSimulated(t) ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"
        }
        title="Whether this task ran against a real provider or the honest simulator"
      >
        {taskSimulated(t) ? "Simulated" : "Real"}
      </Badge>
    ),
  },
];

export default function RunDetailPage({ params }: { params: { id: string } }) {
  const { data, error, isLoading, mutate } = useOperation(params.id);
  const op = data?.operation;
  const health = data?.health;
  const traces = data?.traces || [];
  const tasks = op?.tasks || [];

  if (error) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6">
        <PageHeader icon={History} eyebrow="Activity" title="Run not found" backHref="/activity" />
        <Card className="p-8 space-y-4 text-center">
          {String(error.message).includes("not found") || error.status === 404 ? (
            <p className="text-sm text-muted-foreground">
              This run no longer exists. It may have been removed with its mission.
            </p>
          ) : (
            <>
              <p className="text-lg font-medium text-destructive">Failed to load run</p>
              <p className="text-sm text-muted-foreground">{error.message}</p>
              <Button variant="outline" onClick={() => mutate()} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Retry
              </Button>
            </>
          )}
          <div>
            <Button variant="outline" asChild>
              <Link href="/activity">Back to runs</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (isLoading && !op) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6">
        <PageHeader icon={History} eyebrow="Activity" title="Run" backHref="/activity" />
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Loading run…
        </p>
      </div>
    );
  }

  if (!op) return null;

  const ms = runDurationMs(op);
  const simulatedCount = tasks.filter((t: any) => taskSimulated(t)).length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        icon={History}
        eyebrow="Activity"
        title={`Run ${op.id.slice(0, 8)}`}
        description={op.mission?.goal}
        backHref="/activity"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={OPERATION_STATUS_COLOR[op.status] || "bg-muted text-muted-foreground"}>
              {op.status}
            </Badge>
            {!terminal(op.status) && health && (
              <Badge className={HEALTH_COLOR[health] || "bg-muted text-muted-foreground"}>
                {HEALTH_LABEL[health] || health}
              </Badge>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
        <div className="flex items-center gap-3 bg-background p-4">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">Cost</div>
            <div className="text-lg font-bold tabular-nums">{formatCost(op.cost)}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-background p-4">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">Duration</div>
            <div className="text-lg font-bold tabular-nums">{ms != null ? formatDuration(ms) : "—"}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-background p-4">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">Tasks</div>
            <div className="text-lg font-bold tabular-nums">
              {tasks.length} {simulatedCount > 0 && <span className="text-xs font-normal text-muted-foreground">({simulatedCount} simulated)</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-background p-4">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">Started</div>
            <div className="text-sm font-bold">{op.startedAt ? formatRelativeTime(op.startedAt) : "—"}</div>
          </div>
        </div>
      </div>

      {op.mission && (
        <Card className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <SectionLabel>Mission</SectionLabel>
            <Link href={`/missions/${op.mission.id}`} className="mt-1 block truncate text-sm font-medium hover:underline">
              {op.mission.goal}
            </Link>
          </div>
        </Card>
      )}

      <section className="space-y-3">
        <SectionLabel>Tasks · {tasks.length} {pluralize(tasks.length, "task")}</SectionLabel>
        {tasks.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            This run produced no tasks.
          </Card>
        ) : (
          <DataTable columns={COLUMNS} rows={tasks} rowKey={(t: any) => t.id} minWidth="1040px" caption="Tasks in this run" />
        )}
      </section>

      <section className="space-y-3">
        <SectionLabel>Traces · {traces.length}</SectionLabel>
        {traces.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No traces recorded for this run's tasks.
          </Card>
        ) : (
          <Card className="divide-y p-2">
            {traces.map((t: any) => (
              <Link
                key={t.id}
                href={`/activity/traces/${t.id}`}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <span className="flex items-center gap-2 font-mono text-xs">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  {t.id.slice(0, 10)}
                </span>
                <span className="flex items-center gap-4 text-xs tabular-nums text-muted-foreground">
                  {t.duration != null && <span>{formatDuration(t.duration)}</span>}
                  {t.cost != null && <span>{formatCost(t.cost)}</span>}
                  <span>{formatRelativeTime(t.createdAt)}</span>
                </span>
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
