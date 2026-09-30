"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useTask } from "@/hooks/useApi";
import { safeJson, formatCost, formatDuration } from "@/lib/utils";
import { TASK_STATUS_COLOR } from "@/lib/execution-meta";

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

  if (isLoading && !task) return <div className="p-6">Loading task...</div>;

  if (error && !task) {
    const status = (error as Error & { status?: number }).status;
    return (
      <div className="p-6">
        <Card className="p-12 text-center space-y-4 max-w-md mx-auto">
          <p className="text-lg font-medium">{status === 404 ? "Task not found" : "Failed to load task"}</p>
          <p className="text-sm text-muted-foreground">{status === 404 ? "It may have been deleted." : error.message}</p>
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/tasks"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold">Task</h1>
            <Badge className={TASK_STATUS_COLOR[task.status]}>{task.status}</Badge>
          </div>
          <p className="text-base font-medium">{task.description}</p>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm">
            {task.missionId ? (
              <Link href={`/missions/${task.missionId}`} className="text-info hover:underline underline-offset-2">Mission {task.missionId.slice(0, 8)}</Link>
            ) : <span className="text-muted-foreground">No mission</span>}
            {task.ownerAgentId && (
              <Link href={`/agents/${task.ownerAgentId}`} className="text-info hover:underline underline-offset-2">Agent {task.ownerAgentId.slice(0, 8)}</Link>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {task.status === "FAILED" && (
            <Button onClick={handleRetry} disabled={retrying} className="gap-2">
              <RefreshCw className="h-4 w-4" /> {retrying ? "Retrying..." : "Retry"}
            </Button>
          )}
        </div>
      </div>

      {retryError && (
        <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">{retryError}</p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Priority</p><p className="font-bold text-xl">{task.priority || 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Retries</p><p className="font-bold text-xl">{task.retryCount || 0}/{task.maxRetries ?? 3}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Timeout</p><p className="font-bold text-xl">{task.timeout ? formatDuration(task.timeout) : "—"}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Cost</p><p className="font-bold text-xl">{formatCost(task.cost)}</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <h2 className="font-semibold mb-3">Input</h2>
          <pre className="text-xs bg-muted p-3 rounded-md overflow-auto font-mono">{JSON.stringify(input, null, 2)}</pre>
        </Card>
        <Card className="p-6">
          <h2 className="font-semibold mb-3">Output</h2>
          <pre className="text-xs bg-muted p-3 rounded-md overflow-auto font-mono">
            {Object.keys(output as Record<string, unknown>).length > 0 ? JSON.stringify(output, null, 2) : "—"}
          </pre>
        </Card>
      </div>
    </div>
  );
}