"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListChecks, RefreshCw } from "lucide-react";
import { useTask } from "@/hooks/useApi";
import { safeJson, formatCost, formatDuration } from "@/lib/utils";
import { TASK_STATUS_COLOR, taskSimulated } from "@/lib/execution-meta";
import { PageHeader, SectionLabel } from "@/components/shared/page-header";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-background p-3">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default function TaskDetailPage({ params }: { params: { id: string } }) {
  const { data, error, isLoading, mutate } = useTask(params.id);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");

  const task = data?.task;

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    setRetryError("");
    try {
      const res = await fetch(`/api/tasks/${params.id}/retry`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed: ${res.status}`);
      }
      await mutate();
    } catch (e: any) {
      setRetryError(e?.message || "Retry failed. Try again.");
    } finally {
      setRetrying(false);
    }
  };

  if (isLoading && !task) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  if (error && !task) {
    const status = (error as Error & { status?: number }).status;
    return (
      <div className="mx-auto max-w-md py-20">
        <Card className="space-y-4 p-12 text-center">
          <p className="text-lg font-medium">{status === 404 ? "Task not found" : "Failed to load task"}</p>
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

  if (!task) return null;

  const input = safeJson<unknown>(task.input, {});
  const output = safeJson<unknown>(task.output, {});
  const simulated = taskSimulated(task);

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <PageHeader
        backHref="/tasks"
        icon={ListChecks}
        eyebrow="Execution"
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate">{task.description || "Task"}</span>
            <Badge className={TASK_STATUS_COLOR[task.status]}>{task.status}</Badge>
            {simulated && <Badge className="bg-warning/10 text-warning">Simulated</Badge>}
          </span>
        }
        description={`Task ${params.id.slice(0, 8)}`}
        actions={
          task.status === "FAILED" ? (
            <Button onClick={handleRetry} disabled={retrying} className="gap-2">
              <RefreshCw className="h-4 w-4" /> {retrying ? "Retrying…" : "Retry"}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {task.missionId ? (
          <Link href={`/missions/${task.missionId}`} className="text-info hover:underline underline-offset-2">
            Mission {task.missionId.slice(0, 8)}
          </Link>
        ) : (
          <span className="text-muted-foreground">No mission</span>
        )}
        {task.ownerAgentId && (
          <Link href={`/agents/${task.ownerAgentId}`} className="text-info hover:underline underline-offset-2">
            Agent {task.ownerAgentId.slice(0, 8)}
          </Link>
        )}
      </div>

      {retryError && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {retryError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
        <Stat label="Priority" value={task.priority || 0} />
        <Stat label="Retries" value={`${task.retryCount || 0}/${task.maxRetries ?? 3}`} />
        <Stat label="Timeout" value={task.timeout ? formatDuration(task.timeout) : "—"} />
        <Stat label="Cost" value={formatCost(task.cost)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <SectionLabel>Input</SectionLabel>
          <pre
            tabIndex={0}
            className="overflow-auto rounded-xl bg-muted/60 p-3 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {JSON.stringify(input, null, 2)}
          </pre>
        </Card>
        <Card className="space-y-3 p-5">
          <SectionLabel>Output</SectionLabel>
          <pre
            tabIndex={0}
            className="overflow-auto rounded-xl bg-muted/60 p-3 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Object.keys(output as Record<string, unknown>).length > 0
              ? JSON.stringify(output, null, 2)
              : "—"}
          </pre>
        </Card>
      </div>
    </div>
  );
}