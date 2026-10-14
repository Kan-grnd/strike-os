/**
 * Attention queue — the Control Center's "Needs you" list, as pure data (M4.1).
 *
 * The primary surface answers "what needs me?" by ranking everything the
 * operator must act on: open gates (approvals) and missions whose health says
 * they are blocked, failing or degraded. Deriving it here (not in the DOM) keeps
 * the ranking testable and keeps the page honest — the queue is a function of
 * data the API already returns, nothing is invented.
 *
 * Ranking: most severe first, and within a severity the longest-waiting first
 * (an item that has been stuck for an hour outranks one from a minute ago).
 */

import { denyCancelsScope, isInterventionTrigger } from "./approval-policy";

export interface ApprovalInput {
  id: string;
  trigger?: string;
  scope?: string;
  description?: string;
  status?: string;
  missionId?: string | null;
  createdAt: string | Date;
}

export interface MissionInput {
  id: string;
  goal?: string;
  status: string;
  health?: string;
  updatedAt?: string | Date;
  createdAt?: string | Date;
  tasks?: Array<{ status: string }>;
}

export type AttentionKind = "approval" | "mission";

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  /** 0 = critical, 1 = high, 2 = medium (lower sorts first). */
  severity: number;
  severityLabel: "Critical" | "High" | "Medium";
  title: string;
  detail: string;
  missionId: string | null;
  missionGoal: string | null;
  ageMs: number;
  href: string;
  actionLabel: string;
  approvalId?: string;
  trigger?: string;
  blocking?: boolean;
}

/** Human title per intervention trigger (permissions.md §4). */
export const TRIGGER_TITLE: Record<string, string> = {
  TOOL_PERMISSION: "Tool permission requested",
  SPEND_CEILING: "Spending ceiling reached",
  MODEL_FALLBACK: "Model fallback needs approval",
  DRIFT: "Mission has drifted off cadence",
  SPAWN_CEILING: "Spawn ceiling reached",
  ESCALATION: "Escalation needs a decision",
};

/** Health values that warrant the operator's attention, most severe first. */
export const ATTENTION_HEALTH: Record<string, { severity: number; title: string }> = {
  FAILING: { severity: 0, title: "Mission failing" },
  BLOCKED: { severity: 0, title: "Mission blocked" },
  DEGRADED: { severity: 2, title: "Mission degraded" },
};

const SEVERITY_LABEL = ["Critical", "High", "Medium"] as const;

export function severityLabel(severity: number): "Critical" | "High" | "Medium" {
  return SEVERITY_LABEL[severity] ?? "Medium";
}

function ms(value: string | Date | undefined | null): number {
  if (!value) return NaN;
  return typeof value === "string" ? Date.parse(value) : value.getTime();
}

function missionProgress(tasks?: Array<{ status: string }>): string {
  if (!tasks || tasks.length === 0) return "no tasks yet";
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "COMPLETED").length;
  const active = tasks.filter((t) => ["QUEUED", "ASSIGNED", "RUNNING", "WAITING"].includes(t.status)).length;
  return `${done}/${total} complete${active ? ` · ${active} in flight` : ""}`;
}

/**
 * Build the ranked attention queue. A mission that already has an open gate is
 * represented by that gate (its health is a consequence of it), so it is not
 * listed a second time.
 */
export function buildAttentionQueue(
  input: { approvals?: ApprovalInput[]; missions?: MissionInput[]; now?: number },
): AttentionItem[] {
  const now = input.now ?? Date.now();
  const items: AttentionItem[] = [];

  const pending = (input.approvals ?? []).filter((a) => (a.status ?? "PENDING") === "PENDING");
  const gatedMissionIds = new Set<string>();
  for (const a of pending) {
    if (a.missionId) gatedMissionIds.add(a.missionId);
  }

  for (const a of pending) {
    const trigger = a.trigger && isInterventionTrigger(a.trigger) ? a.trigger : "ESCALATION";
    const blocking = denyCancelsScope(trigger);
    const createdAt = ms(a.createdAt);
    const ageMs = Number.isFinite(createdAt) ? Math.max(0, now - createdAt) : 0;
    items.push({
      id: `approval-${a.id}`,
      kind: "approval",
      severity: blocking ? 0 : 1,
      severityLabel: severityLabel(blocking ? 0 : 1),
      title: TRIGGER_TITLE[trigger] ?? "Approval required",
      detail: a.description || "Waiting on your decision",
      missionId: a.missionId ?? null,
      missionGoal: null,
      ageMs,
      href: a.missionId ? `/missions/${a.missionId}` : "/decisions",
      actionLabel: "Review",
      approvalId: a.id,
      trigger,
      blocking,
    });
  }

  for (const m of input.missions ?? []) {
    const health = m.health || "";
    const attention = ATTENTION_HEALTH[health];
    if (!attention) continue;
    if (gatedMissionIds.has(m.id)) continue; // already shown as its gate

    const updatedAt = ms(m.updatedAt) || ms(m.createdAt);
    const ageMs = Number.isFinite(updatedAt) ? Math.max(0, now - updatedAt) : 0;
    items.push({
      id: `mission-${m.id}`,
      kind: "mission",
      severity: attention.severity,
      severityLabel: severityLabel(attention.severity),
      title: attention.title,
      detail: `${m.goal || "Untitled mission"} · ${missionProgress(m.tasks)}`,
      missionId: m.id,
      missionGoal: m.goal ?? null,
      ageMs,
      href: `/missions/${m.id}`,
      actionLabel: "Open mission",
    });
  }

  items.sort((a, b) => (a.severity !== b.severity ? a.severity - b.severity : b.ageMs - a.ageMs));
  return items;
}
