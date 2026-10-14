export const MISSION_STATUS_COLOR: Record<string, string> = {
  PLANNING: "bg-muted text-muted-foreground",
  READY: "bg-muted text-muted-foreground",
  RUNNING: "bg-success/10 text-success",
  PAUSED: "bg-info/10 text-info",
  BLOCKED: "bg-warning/10 text-warning",
  COMPLETED: "bg-success/10 text-success",
  FAILED: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
};

export const MISSION_STATUS_OPTIONS = [
  "PLANNING",
  "READY",
  "RUNNING",
  "PAUSED",
  "BLOCKED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export const TASK_STATUS_COLOR: Record<string, string> = {
  QUEUED: "bg-muted text-muted-foreground",
  ASSIGNED: "bg-info/10 text-info",
  RUNNING: "bg-success/10 text-success",
  WAITING: "bg-warning/10 text-warning",
  COMPLETED: "bg-success/10 text-success",
  FAILED: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
};

export const TASK_STATUS_OPTIONS = [
  "QUEUED",
  "ASSIGNED",
  "RUNNING",
  "WAITING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export const AUTOMATION_STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-success/10 text-success",
  PAUSED: "bg-info/10 text-info",
  COMPLETED: "bg-success/10 text-success",
  FAILED: "bg-destructive/10 text-destructive",
};

export const AUTOMATION_STATUS_OPTIONS = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "FAILED"] as const;

export const TRIGGER_LABELS: Record<string, string> = {
  schedule: "Schedule",
  webhook: "Webhook",
  event: "Event",
  data_change: "Data change",
  condition: "Condition",
  manual: "Manual",
};

export const RUN_STATUS_COLOR: Record<string, string> = {
  running: "bg-info/10 text-info",
  completed: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export function missionProgress(m: { tasks?: Array<{ status: string }> } | null | undefined) {
  const tasks = Array.isArray(m?.tasks) ? m.tasks : [];
  const total = tasks.length;
  if (total === 0) return { pct: 0, completed: 0, failed: 0, cancelled: 0, active: 0, total: 0 };
  const completed = tasks.filter((t) => t.status === "COMPLETED").length;
  const failed = tasks.filter((t) => t.status === "FAILED").length;
  const cancelled = tasks.filter((t) => t.status === "CANCELLED").length;
  return {
    pct: Math.round((completed / total) * 100),
    completed,
    failed,
    cancelled,
    active: total - completed - failed - cancelled,
    total,
  };
}

/**
 * True when a task's stored output was produced by a simulated (mock) runner.
 * Reads Task.output JSON, tolerating both a raw object and a JSON string.
 */
export function taskSimulated(output: unknown): boolean {
  let value: unknown = output;
  if (typeof output === "string") {
    const trimmed = output.trim();
    if (!trimmed) return false;
    try {
      value = JSON.parse(trimmed);
    } catch {
      return false;
    }
  }
  return !!value && typeof value === "object" && (value as Record<string, unknown>).simulated === true;
}
