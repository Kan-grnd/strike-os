"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkflowFlow } from "@/components/workflow/workflow-flow";
import { WorkflowEditorDrawer } from "@/components/workflow/workflow-editor-drawer";
import { Play, Pause, Square, RefreshCw, Zap, CheckCircle2 } from "lucide-react";
import { useAutomation } from "@/hooks/useApi";
import { DataTable, type DataTableColumn } from "@/components/execution/data-table";
import { safeJson, cn, formatDuration, formatCost } from "@/lib/utils";
import { AUTOMATION_STATUS_COLOR, RUN_STATUS_COLOR, TRIGGER_LABELS } from "@/lib/execution-meta";
import { PageHeader, SectionLabel } from "@/components/shared/page-header";

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

type StepRow = { index: number; action: { type: string; config?: Record<string, unknown> } };

const stepSummary = (a: StepRow["action"]) =>
  String(a.config?.goal || a.config?.message || a.config?.description || "");

const stepColumns = (onEdit: (index: number) => void): DataTableColumn<StepRow>[] => [
  {
    header: "Step",
    width: "70px",
    render: (r) => (
      <Badge variant="outline" className="font-mono">
        {r.index + 1}
      </Badge>
    ),
  },
  {
    header: "Action",
    width: "200px",
    render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.action.type}</span>,
  },
  {
    header: "Summary",
    render: (r) => <span className="block max-w-[320px] truncate">{stepSummary(r.action)}</span>,
  },
  {
    header: "",
    width: "80px",
    align: "right",
    render: (r) => (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        aria-label={`Edit step ${r.index + 1}: ${stepSummary(r.action) || r.action.type}`}
        onClick={() => onEdit(r.index)}
      >
        Edit
      </Button>
    ),
  },
];

const RUN_COLUMNS: DataTableColumn<Run>[] = [
  {
    header: "Status",
    width: "130px",
    render: (run) => (
      <span className="flex items-center gap-2">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", RUN_STATUS_COLOR[run.status]?.split(" ")[0] || "bg-muted")} />
        <Badge variant="outline" className="text-xs uppercase">
          {run.status}
        </Badge>
      </span>
    ),
  },
  {
    header: "Started",
    width: "180px",
    render: (run) => (
      <span className="whitespace-nowrap font-mono text-xs">{new Date(run.startedAt).toLocaleString()}</span>
    ),
  },
  {
    header: "Duration",
    width: "110px",
    align: "right",
    render: (run) => <span className="text-xs">{formatDuration(run.duration)}</span>,
  },
  {
    header: "Cost",
    width: "100px",
    align: "right",
    render: (run) => <span className="text-xs text-muted-foreground">{formatCost(run.cost)}</span>,
  },
  {
    header: "Error",
    render: (run) =>
      run.error ? (
        <span className="block max-w-[280px] truncate text-xs text-destructive" title={run.error}>
          {run.error}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
];

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
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  if (error && !automation) {
    const status = (error as Error & { status?: number }).status;
    return (
      <div className="mx-auto max-w-md">
        <Card className="space-y-4 p-12 text-center">
          <p className="text-lg font-medium">
            {status === 404 ? "Automation not found" : "Failed to load automation"}
          </p>
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
  const triggerType = (trigger.type as string) || "manual";

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

  const writeAction = async (
    key: "start" | "pause" | "resume" | "complete",
    fn: (id: string) => Promise<unknown>
  ) => {
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
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        backHref="/missions"
        icon={Zap}
        eyebrow="Automation"
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate">{automation.name}</span>
            <Badge className={AUTOMATION_STATUS_COLOR[status] || "bg-muted"}>{status}</Badge>
          </span>
        }
        description={automation.description || "No description"}
        actions={
          !terminal ? (
            <>
              {canStart && (
                <Button onClick={() => writeAction("start", startRoute)} disabled={busy !== null} className="gap-2">
                  <Play className="h-3.5 w-3.5" /> {busy === "start" ? "Starting…" : "Start"}
                </Button>
              )}
              {canPause && (
                <Button
                  variant="outline"
                  onClick={() => writeAction("pause", pauseRoute)}
                  disabled={busy !== null}
                  className="gap-2"
                >
                  <Pause className="h-3.5 w-3.5" /> Pause
                </Button>
              )}
              {canResume && (
                <Button onClick={() => writeAction("resume", resumeRoute)} disabled={busy !== null} className="gap-2">
                  <Play className="h-3.5 w-3.5" /> Resume
                </Button>
              )}
              {canComplete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => writeAction("complete", completeRoute)}
                  disabled={busy !== null}
                  className="gap-2"
                >
                  <Square className="h-3.5 w-3.5" /> Mark Complete
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      {actionError && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-6">
        <div className="bg-background p-4">
          <SectionLabel>Status</SectionLabel>
          <div className="mt-1">
            <Badge className={AUTOMATION_STATUS_COLOR[status] || "bg-muted text-muted-foreground"}>{status}</Badge>
          </div>
        </div>
        <div className="bg-background p-4">
          <SectionLabel>Trigger</SectionLabel>
          <div className="mt-1">
            <Badge variant="outline" className="whitespace-nowrap">
              {TRIGGER_LABELS[triggerType] || triggerType}
              {triggerDetail ? ` — ${triggerDetail}` : ""}
            </Badge>
          </div>
        </div>
        <div className="bg-background p-4">
          <SectionLabel>Last run</SectionLabel>
          <p className="mt-1 font-mono text-sm">{formatWhen(automation.lastRun)}</p>
        </div>
        <div className="bg-background p-4">
          <SectionLabel>Next run</SectionLabel>
          <p className="mt-1 font-mono text-sm">{formatWhen(automation.nextRun)}</p>
        </div>
        <div className="bg-background p-4">
          <SectionLabel>Runs</SectionLabel>
          <p className="mt-1 text-lg font-semibold tabular-nums">{automation.runCount || 0}</p>
        </div>
        <div className="bg-background p-4">
          <SectionLabel>Errors</SectionLabel>
          <p
            className={cn(
              "mt-1 text-lg font-semibold tabular-nums",
              (automation.errorCount || 0) > 0 && "text-destructive"
            )}
          >
            {automation.errorCount || 0}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>
            <span className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-primary" /> Flow
            </span>
          </SectionLabel>
          <span className="text-xs text-muted-foreground">{actions.length} steps</span>
        </div>
        {actions.length > 0 ? (
          <>
            <WorkflowFlow title="Execution Sequence" actions={actions.map((a, i) => ({ ...a, index: i }))} />
            <DataTable
              columns={stepColumns(setEditingIndex)}
              rows={actions.map((a, i) => ({ index: i, action: a }))}
              rowKey={(r) => String(r.index)}
              minWidth="520px"
              caption="Automation steps, click one to edit it"
              onRowClick={(r) => setEditingIndex(r.index)}
            />
            <p className="text-xs text-muted-foreground">Click a step to edit its type and configuration</p>
            {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No steps defined yet.</p>
        )}
      </section>

      <section className="space-y-3">
        <SectionLabel>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Run history
          </span>
        </SectionLabel>
        {!automation.runs || automation.runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <DataTable
            columns={RUN_COLUMNS}
            rows={automation.runs}
            rowKey={(run) => `${run.status}-${run.startedAt}`}
            minWidth="680px"
            caption="Recent automation runs"
          />
        )}
      </section>

      {editingAction && editingIndex !== null && (
        <WorkflowEditorDrawer
          key={editingIndex}
          open={editingIndex !== null}
          onOpenChange={(open) => {
            if (!open) setEditingIndex(null);
          }}
          action={{ index: editingIndex, type: editingAction.type, config: editingAction.config || {} }}
          onSave={saveAction}
          actionTypes={[
            "create_mission",
            "create_task",
            "invoke_agent",
            "call_tool",
            "call_api",
            "send_webhook",
            "write_memory",
            "notify_user",
          ]}
        />
      )}

      {saving && <p className="text-sm text-muted-foreground">Saving…</p>}
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
  const res = await fetch(`/api/automations/${id}/complete`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to mark complete");
};