"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { WorkflowFlow } from "@/components/workflow/workflow-flow";
import { WorkflowEditorDrawer } from "@/components/workflow/workflow-editor-drawer";
import { ArrowLeft, Play, Pause, Square, RefreshCw, Zap, CheckCircle2 } from "lucide-react";
import { useAutomation } from "@/hooks/useApi";
import { safeJson, cn, formatDuration, formatCost } from "@/lib/utils";
import { AUTOMATION_STATUS_COLOR, RUN_STATUS_COLOR, TRIGGER_LABELS } from "@/lib/execution-meta";

type Run = { status: string; startedAt: string; duration?: number | null; cost?: number | null; error?: string | null };
type Automation = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  trigger: string;
  conditions: string;
  actions: string;
  lastRun?: string | null;
  nextRun?: string | null;
  runCount: number;
  errorCount: number;
  runs: Run[];
};

export default function AutomationDetailPage({ params }: { params: { id: string } }) {
  const { data, error, isLoading, mutate } = useAutomation(params.id);

  const [busy, setBusy] = useState<"start" | "pause" | "resume" | "complete" | null>(null);
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const automation = data?.automation as Automation | undefined;
  const actions = (() => {
    const raw = safeJson<Array<{ type: string; config?: Record<string, unknown> }>>(automation?.actions, []);
    return Array.isArray(raw) ? raw : [];
  })();

  if (isLoading && !automation) {
    return <div className="p-6">Loading automation...</div>;
  }

  if (error && !automation) {
    const status = (error as Error & { status?: number }).status;
    return (
      <div className="p-6">
        <Card className="p-12 text-center space-y-4 max-w-md mx-auto">
          <p className="text-lg font-medium">{status === 404 ? "Automation not found" : "Failed to load automation"}</p>
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

  if (!automation) return null;

  const trigger = safeJson<Record<string, unknown>>(automation.trigger, {});
  const conditions = safeJson<Record<string, unknown>>(automation.conditions, {});
  const triggerType = (trigger.type as string) || "manual";
  const conditionKeys = Object.keys(conditions).filter((k) => conditions[k] !== null && conditions[k] !== "" && conditions[k] !== undefined);

  const triggerDetail = (() => {
    if (trigger.cron) return String(trigger.cron);
    if (trigger.event || trigger.eventType) return String(trigger.event || trigger.eventType);
    if (trigger.url) return trigger.method ? `${trigger.method} ${trigger.url}` : String(trigger.url);
    if (trigger.interval || trigger.every) return String(trigger.interval || trigger.every);
    return null;
  })();

  const status = automation.status;
  const terminal = status === "COMPLETED" || status === "FAILED";
  const canStart = status === "DRAFT";
  const canPause = status === "ACTIVE";
  const canResume = status === "PAUSED";
  const canComplete = status === "DRAFT" || status === "ACTIVE" || status === "PAUSED";

  const writeAction = async (key: "start" | "pause" | "resume" | "complete", fn: (id: string) => Promise<unknown>) => {
    if (busy) return;
    if (key === "complete" && !window.confirm("Mark this automation as complete? It will stop running and cannot be restarted.")) {
      return;
    }
    setBusy(key);
    setActionError("");
    try {
      await fn(params.id);
      await mutate();
    } catch (e: any) {
      setActionError(e?.message || "Action failed. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const saveAction = async (index: number, type: string, config: Record<string, unknown>) => {
    const next = actions.map((a, i) => (i === index ? { type, config } : a));
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/automations/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: next, workflowPlan: { steps: next } }),
      });
      if (!res.ok) throw new Error(`Failed to save: ${res.status}`);
      await mutate();
    } catch (e: any) {
      setSaveError(e?.message || "Failed to save step.");
    } finally {
      setSaving(false);
    }
  };

  const formatWhen = (iso?: string | null) => {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(iso).toLocaleDateString();
  };

  const editingAction = editingIndex !== null ? actions[editingIndex] : undefined;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/work?type=automations">
          <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">{automation.name}</h1>
            <Badge className={AUTOMATION_STATUS_COLOR[status] || "bg-muted"}>{status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{automation.description || "No description"}</p>
        </div>
        {!terminal && (
          <div className="flex gap-2">
            {canStart && (
              <Button onClick={() => writeAction("start", startRoute)} disabled={busy !== null} className="gap-2">
                <Play className="h-3.5 w-3.5" /> {busy === "start" ? "Starting..." : "Start"}
              </Button>
            )}
            {canPause && (
              <Button variant="outline" onClick={() => writeAction("pause", pauseRoute)} disabled={busy !== null} className="gap-2">
                <Pause className="h-3.5 w-3.5" /> {busy === "pause" ? "Pausing..." : "Pause"}
              </Button>
            )}
            {canResume && (
              <Button onClick={() => writeAction("resume", resumeRoute)} disabled={busy !== null} className="gap-2">
                <Play className="h-3.5 w-3.5" /> {busy === "resume" ? "Resuming..." : "Resume"}
              </Button>
            )}
            {canComplete && (
              <Button variant="outline" size="sm" onClick={() => writeAction("complete", completeRoute)} disabled={busy !== null} className="gap-2">
                <Square className="h-3.5 w-3.5" /> Mark Complete
              </Button>
            )}
          </div>
        )}
      </div>

      {actionError && (
        <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">{actionError}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Flow
            </h2>
            <span className="text-xs text-muted-foreground">{actions.length} steps</span>
          </div>
          {actions.length > 0 ? (
            <>
              <WorkflowFlow title="Execution Sequence" actions={actions.map((a, i) => ({ ...a, index: i }))} />
              <div className="space-y-1">
                {actions.map((a, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setEditingIndex(i)}
                    className="w-full text-left flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2 border hover:border-primary/40 transition-colors"
                    aria-label={`Edit step ${i + 1}: ${a.config?.goal || a.type}`}
                  >
                    <Badge variant="outline" className="font-mono">{i + 1}</Badge>
                    <span className="font-mono text-xs text-muted-foreground truncate flex-1">{a.type}</span>
                    <span className="text-sm text-muted-foreground truncate">{String(a.config?.goal || a.config?.message || a.config?.description || "")}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Click a step to edit its type and configuration</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No steps defined yet.</p>
          )}
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        </Card>

        <Card className="p-6 space-y-3">
          <h2 className="font-semibold">Status</h2>
          <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Last run</span><span className="font-mono">{formatWhen(automation.lastRun)}</span></div>
            <div className="flex justify-between"><span>Next run</span><span className="font-mono">{formatWhen(automation.nextRun)}</span></div>
            <div className="flex justify-between"><span>Runs</span><span className="font-mono">{automation.runCount || 0}</span></div>
            <div className="flex justify-between"><span>Errors</span><span className="font-mono">{automation.errorCount || 0}</span></div>
          </div>
          <Separator />
          <h2 className="font-semibold">Trigger</h2>
          <Badge variant="outline">{TRIGGER_LABELS[triggerType] || triggerType}{triggerDetail ? ` — ${triggerDetail}` : ""}</Badge>
          <h2 className="font-semibold mt-2">Conditions</h2>
          <p className="text-xs text-muted-foreground">{conditionKeys.length ? conditionKeys.map((k) => `${k}: ${String(conditions[k])}`).join(" · ") : "No conditions set"}</p>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" /> Run History
        </h2>
        {(!automation.runs || automation.runs.length === 0) ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-auto">
            {automation.runs.map((run) => (
              <div key={run.status + run.startedAt} className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2 text-sm">
                <span className={cn("h-2 w-2 rounded-full", RUN_STATUS_COLOR[run.status]?.split(" ")[0] || "bg-muted")} />
                <Badge variant="outline" className="text-xs uppercase">{run.status}</Badge>
                <span className="font-mono text-xs">{new Date(run.startedAt).toLocaleString()}</span>
                <span className="flex-1">{formatDuration(run.duration)}</span>
                <span className="text-xs text-muted-foreground">{formatCost(run.cost)}</span>
                {run.error && <span className="text-xs text-destructive truncate max-w-[180px]">{run.error}</span>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {editingAction && editingIndex !== null && (
        <WorkflowEditorDrawer
          key={editingIndex}
          open={editingIndex !== null}
          onOpenChange={(open) => { if (!open) setEditingIndex(null); }}
          action={{ index: editingIndex, type: editingAction.type, config: editingAction.config || {} }}
          onSave={saveAction}
          actionTypes={["create_mission", "create_task", "invoke_agent", "call_tool", "call_api", "send_webhook", "write_memory", "notify_user"]}
        />
      )}

      {saving && <p className="text-sm text-muted-foreground">Saving...</p>}
    </div>
  );
}

const startRoute = async (id: string) => {
  const res = await fetch(`/api/automations/${id}/start`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to start");
};
const pauseRoute = async (id: string) => {
  const res = await fetch(`/api/automations/${id}/pause`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to pause");
};
const resumeRoute = async (id: string) => {
  const res = await fetch(`/api/automations/${id}/resume`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to resume");
};
const completeRoute = async (id: string) => {
  /* Named `/cancel` upstream, but the handler transitions the automation to
   * COMPLETED (automation-state.complete), which is what this button promises. */
  const res = await fetch(`/api/automations/${id}/cancel`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to mark complete");
};