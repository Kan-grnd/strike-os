import {
  Activity,
  AlertTriangle,
  Ban,
  Check,
  Circle,
  ClipboardList,
  Clock,
  GitBranch,
  HeartPulse,
  Lightbulb,
  Loader2,
  Minus,
  Pause,
  Play,
  Power,
  RefreshCw,
  ShieldAlert,
  Square,
  X,
  Zap,
  Eye,
  type LucideIcon,
} from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

export interface StatePresentation {
  icon: LucideIcon;
  label: string;
  variant: BadgeVariant;
}

const AGENT_PRESENTATION: Record<string, StatePresentation> = {
  idle: { icon: Circle, label: "Idle", variant: "secondary" },
  initializing: { icon: Loader2, label: "Starting", variant: "info" },
  thinking: { icon: Lightbulb, label: "Thinking", variant: "info" },
  planning: { icon: ClipboardList, label: "Planning", variant: "info" },
  executing: { icon: Play, label: "Running", variant: "success" },
  delegating: { icon: GitBranch, label: "Delegating", variant: "info" },
  waiting: { icon: Clock, label: "Waiting", variant: "secondary" },
  waiting_for_approval: { icon: ShieldAlert, label: "Approval", variant: "warning" },
  retrying: { icon: RefreshCw, label: "Recovering", variant: "warning" },
  recovering: { icon: HeartPulse, label: "Recovering", variant: "warning" },
  reviewing: { icon: Eye, label: "Reviewing", variant: "info" },
  blocked: { icon: Ban, label: "Blocked", variant: "warning" },
  paused: { icon: Pause, label: "Paused", variant: "secondary" },
  stopped: { icon: Square, label: "Stopped", variant: "secondary" },
  completed: { icon: Check, label: "Done", variant: "success" },
  failed: { icon: X, label: "Failed", variant: "destructive" },
  cancelled: { icon: X, label: "Cancelled", variant: "secondary" },
  disabled: { icon: Minus, label: "Disabled", variant: "secondary" },
  terminating: { icon: Power, label: "Stopping", variant: "secondary" },
};

export function agentStatePresentation(state: string): StatePresentation {
  return (
    AGENT_PRESENTATION[state] ?? { icon: Circle, label: state.replace(/_/g, " "), variant: "secondary" }
  );
}

export const BRAIN_PRESENTATION: Record<string, StatePresentation> = {
  operational: { icon: Activity, label: "Operational", variant: "success" },
  working: { icon: Zap, label: "Working", variant: "info" },
  degraded: { icon: AlertTriangle, label: "Degraded", variant: "warning" },
  critical: { icon: AlertTriangle, label: "Critical", variant: "destructive" },
  offline: { icon: Power, label: "Offline", variant: "secondary" },
};

export function brainStatePresentation(state: string): StatePresentation {
  return (
    BRAIN_PRESENTATION[state] ?? { icon: Activity, label: state, variant: "secondary" }
  );
}

export function formatState(s: string): string {
  return s.replace(/_/g, " ").toUpperCase();
}

export function formatDate(d?: Date | string): string {
  if (!d) return "—";
  const date = new Date(String(d));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}