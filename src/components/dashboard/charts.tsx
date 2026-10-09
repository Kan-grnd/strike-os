/* Shared dashboard helpers. The chart primitives that used to live here were
 * replaced by the Bklit chart adapters in `@/components/dashboard/bklit`; this
 * module now only carries the runtime-state predicate the command center uses
 * to count live agents. */

const ACTIVE_LIVE = [
  "executing",
  "planning",
  "thinking",
  "delegating",
  "initializing",
  "retrying",
];

export function isAgentActiveLive(a: any): boolean {
  if (ACTIVE_LIVE.includes(a?.runtimeState)) return true;
  return (
    (a?.runtimeState == null || a?.runtimeState === "") && a?.status === "RUNNING"
  );
}
