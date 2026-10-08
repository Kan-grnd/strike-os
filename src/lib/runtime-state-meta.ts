/**
 * Runtime state presentation — the display layer for runtime states.
 *
 * Kept separate from `@/lib/runtime-state`, which is the canonical lifecycle
 * engine (persists transitions, drives the event bus). This file only maps a
 * state string to a visual tone + label for badges and dots. Tones are token
 * classes (`bg-success`, …) so the contrast gates keep owning colour values.
 */

export type StateTone = "active" | "waiting" | "blocked" | "idle";

const ACTIVE = new Set([
  "executing",
  "planning",
  "thinking",
  "delegating",
  "initializing",
  "retrying",
  "running",
]);
const WAITING = new Set([
  "waiting",
  "waiting_for_approval",
  "pending",
  "queued",
  "queued_for_agent",
  "paused",
  "blocked",
]);
const BLOCKED = new Set(["failed", "error", "errored"]);
const DONE = new Set(["completed", "succeeded", "cancelled", "stopped"]);

function humanize(value: string): string {
  return value
    .replace(/[_\s]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolve any runtime/status string to a tone + label.
 *
 * `blocked` (a human decision queue) and `failed` (an error) are deliberately
 * distinguished: both need attention, but only one is an incident.
 */
export function runtimeStateMeta(state?: string | null): {
  tone: StateTone;
  label: string;
  pulse: boolean;
} {
  const key = (state ?? "").toLowerCase().replace(/\s+/g, "_");
  if (ACTIVE.has(key)) return { tone: "active", label: humanize(key), pulse: true };
  if (BLOCKED.has(key)) return { tone: "blocked", label: humanize(key), pulse: false };
  if (DONE.has(key)) return { tone: "active", label: humanize(key), pulse: false };
  if (WAITING.has(key)) return { tone: "waiting", label: humanize(key), pulse: false };
  if (key === "idle" || key === "offline" || key === "")
    return { tone: "idle", label: key === "" ? "Idle" : humanize(key), pulse: false };
  return { tone: "idle", label: humanize(key), pulse: false };
}

const TONE_DOT: Record<StateTone, string> = {
  active: "bg-success",
  waiting: "bg-warning",
  blocked: "bg-destructive",
  idle: "bg-muted-foreground/50",
};

const TONE_TEXT: Record<StateTone, string> = {
  active: "text-success",
  waiting: "text-warning",
  blocked: "text-destructive",
  idle: "text-muted-foreground",
};

export function stateDotClass(tone: StateTone): string {
  return TONE_DOT[tone];
}

export function stateTextClass(tone: StateTone): string {
  return TONE_TEXT[tone];
}