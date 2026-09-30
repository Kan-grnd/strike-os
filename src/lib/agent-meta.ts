export const AGENT_TYPE_COLOR: Record<string, string> = {
  ARCHITECT: "border-info/40 text-info",
  PLANNER: "border-warning/40 text-warning",
  SPECIALIST: "border-success/40 text-success",
  WORKER: "border-primary/40 text-primary",
  OBSERVER: "border-muted-foreground/40 text-muted-foreground",
  EVALUATOR: "border-accent-foreground/40 text-accent-foreground",
  SUB_AGENT: "border-accent/40 text-accent",
  CORE: "border-primary text-primary",
};

export const AGENT_TYPE_OPTIONS = [
  "ARCHITECT",
  "PLANNER",
  "SPECIALIST",
  "WORKER",
  "OBSERVER",
  "EVALUATOR",
] as const;

export const AGENT_STATUS_COLOR: Record<string, string> = {
  IDLE: "bg-muted text-muted-foreground",
  RUNNING: "bg-success/10 text-success",
  WAITING: "bg-warning/10 text-warning",
  PAUSED: "bg-info/10 text-info",
  ERROR: "bg-destructive/10 text-destructive",
  OFFLINE: "bg-muted text-muted-foreground",
};

export const AGENT_STATUS_OPTIONS = ["IDLE", "RUNNING", "WAITING", "ERROR"] as const;

export const ATTENTION_STATES = new Set(["waiting_for_approval", "blocked", "failed"]);

export const ATTENTION_LABELS: Record<string, string> = {
  waiting_for_approval: "Needs approval",
  blocked: "Blocked",
  failed: "Failed",
};

export const ATTENTION_COLOR: Record<string, string> = {
  waiting_for_approval: "bg-warning/10 text-warning",
  blocked: "bg-warning/10 text-warning",
  failed: "bg-destructive/10 text-destructive",
};