/* Pure presentation logic for the Missions surface (M4.2).
 *
 * A mission is the persistent unit of work. This module decides how a list of
 * missions is ordered and how a mission's cadence and trigger schedule read —
 * nothing here touches the database, so it is unit-testable and both the list
 * and detail views derive from the same helpers. */

export interface TriggerInput {
  status?: string | null;
  nextRun?: string | Date | null;
  lastRun?: string | Date | null;
}

export interface MissionInput {
  id: string;
  goal?: string | null;
  status: string;
  health?: string | null;
  /** JSON string, e.g. {"every":"1d"} or {"cron":"0 9 * * *"}. Null = manual. */
  cadence?: string | null;
  totalCost?: number | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  automations?: TriggerInput[] | null;
}

export const TERMINAL_MISSION_STATUSES = ["COMPLETED", "FAILED", "CANCELLED"];

export function isTerminalMission(status: string): boolean {
  return TERMINAL_MISSION_STATUSES.includes(status);
}

/* Attention ordering: worst health first, then running work, then everything
 * else; terminal missions sink to the bottom. Health is the primary signal
 * (it already folds in FAILING/BLOCKED/DEGRADED on read, D56), so the list
 * answers "what needs me?" the same way the Control Center queue does. */
export function missionAttentionRank(m: MissionInput): number {
  const health = (m.health || "").toUpperCase();
  if (health === "FAILING") return 0;
  if (health === "BLOCKED") return 1;
  if (health === "DEGRADED") return 2;
  if (m.status === "RUNNING") return 3;
  if (!isTerminalMission(m.status)) return 4;
  return 5;
}

function timeOf(v?: string | Date | null): number {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

/* Sort a copy: attention rank ascending, then most recently updated first. */
export function sortMissionsByAttention<T extends MissionInput>(missions: T[]): T[] {
  return [...missions].sort((a, b) => {
    const r = missionAttentionRank(a) - missionAttentionRank(b);
    if (r !== 0) return r;
    return timeOf(b.updatedAt) - timeOf(a.updatedAt);
  });
}

/* Human label for a mission's own recurrence. Never invents a schedule: a
 * mission with no cadence reads as "Manual". */
export function formatCadence(cadence?: string | null): string {
  if (!cadence) return "Manual";
  let parsed: unknown;
  try {
    parsed = JSON.parse(cadence);
  } catch {
    return String(cadence);
  }
  if (parsed && typeof parsed === "object") {
    const c = parsed as Record<string, unknown>;
    if (typeof c.every === "string" && c.every) return `Every ${c.every}`;
    if (typeof c.everyMinutes === "number") return `Every ${c.everyMinutes}m`;
    if (typeof c.cron === "string" && c.cron) return c.cron;
  }
  if (typeof parsed === "string" && parsed) return parsed;
  return "Manual";
}

export function activeTriggers(automations?: TriggerInput[] | null): TriggerInput[] {
  return (automations || []).filter((a) => (a.status || "").toUpperCase() === "ACTIVE");
}

export function triggerCount(automations?: TriggerInput[] | null): number {
  return (automations || []).length;
}

/* Earliest next run across ACTIVE triggers, or null when nothing is scheduled. */
export function missionNextRun(automations?: TriggerInput[] | null): Date | null {
  let best: number | null = null;
  for (const a of activeTriggers(automations)) {
    const t = timeOf(a.nextRun);
    if (t > 0 && (best === null || t < best)) best = t;
  }
  return best === null ? null : new Date(best);
}

/* Most recent trigger run across all triggers, or null. */
export function missionLastTriggerRun(automations?: TriggerInput[] | null): Date | null {
  let best: number | null = null;
  for (const a of automations || []) {
    const t = timeOf(a.lastRun);
    if (t > 0 && (best === null || t > best)) best = t;
  }
  return best === null ? null : new Date(best);
}

/* A mission "has a schedule" when it declares cadence or links an ACTIVE trigger. */
export function isScheduled(m: MissionInput): boolean {
  return Boolean(m.cadence) || activeTriggers(m.automations).length > 0;
}
