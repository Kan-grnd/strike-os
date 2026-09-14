"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function TaskDetailPage({ params }: { params: { id: string } }) {
  const { data, mutate } = useSWR(`/api/tasks/${params.id}`, fetcher, { refreshInterval: 2000 });
  const task = data?.task;

  const handleRetry = async () => {
    await fetch(`/api/tasks/${params.id}/retry`, { method: "POST" });
    mutate();
  };

  if (!task) return <div className="p-6">Loading task...</div>;

  const statusColor = (s: string) => {
    const m: Record<string, string> = {
      QUEUED: "bg-muted text-muted-foreground", ASSIGNED: "bg-info/10 text-info",
      RUNNING: "bg-success/10 text-success", WAITING: "bg-warning/10 text-warning",
      COMPLETED: "bg-success/10 text-success", FAILED: "bg-destructive/10 text-destructive",
      CANCELLED: "bg-muted text-faint",
    };
    return m[s] || "bg-muted";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/tasks"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold">Task</h1>
            <Badge className={statusColor(task.status)}>{task.status}</Badge>
          </div>
          <p className="text-base font-medium">{task.description}</p>
          <p className="text-sm text-muted-foreground">Mission: {task.missionId?.slice(0, 8) || "—"}</p>
        </div>
        <div className="flex gap-2">
          {task.status === "FAILED" && <Button onClick={handleRetry} className="gap-2"><RefreshCw className="h-4 w-4" /> Retry</Button>}
          <Button variant="outline" onClick={() => window.location.reload()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Priority</p><p className="font-bold text-xl">{task.priority || 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Retries</p><p className="font-bold text-xl">{task.retryCount || 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Timeout</p><p className="font-bold text-xl">{task.timeout ? `${task.timeout / 1000}s` : "—"}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Cost</p><p className="font-bold text-xl">${task.cost?.toFixed(4) || "0"}</p></Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-6">
          <h2 className="font-semibold mb-3">Input</h2>
          <pre className="text-xs bg-muted p-3 rounded-md overflow-auto font-mono">{JSON.stringify(JSON.parse(task.input || "{}"), null, 2)}</pre>
        </Card>
        <Card className="p-6">
          <h2 className="font-semibold mb-3">Output</h2>
          <pre className="text-xs bg-muted p-3 rounded-md overflow-auto font-mono">{task.output ? JSON.stringify(JSON.parse(task.output), null, 2) : "—"}</pre>
        </Card>
      </div>
    </div>
  );
}
