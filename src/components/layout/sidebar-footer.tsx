"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { Activity } from "lucide-react";
import { useAgents, useHealth, useMissions, useTasks } from "@/hooks/useApi";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Shown while the real agent count is still loading, matching the old
 *  sidebar's behaviour so the footer does not visibly reflow on first paint. */
const AGENT_COUNT_FALLBACK = 8;

/**
 * Status for the sidebar footer.
 *
 * Both footer shapes (the panel's two-row readout and the rail's single dot)
 * read from this, and SWR dedupes by key — so mounting both is still one
 * request per key, which is what keeps "the rail dot and the panel readout" from
 * drifting apart into two different truths.
 */
export function useSidebarStatus() {
  const { data: agents } = useAgents();
  const { data: health } = useHealth();
  const count = Array.isArray(agents?.agents) ? agents.agents.length : null;
  /* The old sidebar asserted "Online" unconditionally. The health endpoint is
   * already polled by the shell, so the dot can report what is actually true
   * instead of a permanent green light. */
  const status = health?.status ?? "online";
  const online = String(status).toLowerCase() === "ok" || String(status).toLowerCase() === "online";
  return {
    agentCount: count ?? AGENT_COUNT_FALLBACK,
    agentCountKnown: count !== null,
    status,
    online,
  };
}

type SidebarStatus = ReturnType<typeof useSidebarStatus>;

/* Mission statuses that mean "the machine is working on this": RUNNING is in
   flight, the queued set is waiting for a slot or agent. PLANNING (a draft the
   user is still deciding on) and PAUSED/CANCELLED are deliberately not work in
   motion, so they neither pulse nor count. */
const MISSION_RUNNING = new Set(["RUNNING"]);
const MISSION_QUEUED = new Set(["QUEUED", "READY", "WAITING"]);
const TASK_RUNNING = new Set(["RUNNING"]);
const TASK_QUEUED = new Set(["QUEUED"]);

/**
 * Work-in-flight for the rail's activity signal.
 *
 * Reads the same `/api/missions` and `/api/tasks` the Missions and Tasks pages
 * read, with the same unfiltered keys, so SWR dedupes — mounting this never
 * doubles the payloads those pages already fetch. No polling of its own: it
 * revalidates on mount and focus like everything else, and a stale snapshot is
 * acceptable for a badge whose job is "something is happening", not precision.
 */
export function useSidebarActivity() {
  const { data: missions } = useMissions();
  const { data: tasks } = useTasks();
  /* One request landing before the other cannot produce a truthful badge, so
     both must be in. On an error neither is, which renders the quiet visual —
     degraded health belongs to the panel's Status row, not the rail. */
  const loading = missions === undefined || tasks === undefined;

  let missionsRunning = 0;
  let missionsQueued = 0;
  let tasksRunning = 0;
  let tasksQueued = 0;

  if (Array.isArray(missions?.missions)) {
    for (const m of missions.missions) {
      if (MISSION_RUNNING.has(m?.status)) missionsRunning++;
      else if (MISSION_QUEUED.has(m?.status)) missionsQueued++;
    }
  }
  if (Array.isArray(tasks?.tasks)) {
    for (const t of tasks.tasks) {
      if (TASK_RUNNING.has(t?.status)) tasksRunning++;
      else if (TASK_QUEUED.has(t?.status)) tasksQueued++;
    }
  }

  return {
    missionsRunning,
    missionsQueued,
    tasksRunning,
    tasksQueued,
    running: missionsRunning + tasksRunning,
    queued: missionsQueued + tasksQueued,
    loading,
  };
}

function joinParts(parts: string[]) {
  return parts.filter(Boolean).join(", ");
}

/**
 * The rail's footer while the Level-2 panel is open.
 *
 * The panel already reports connectivity, so a second status dot there would be
 * two controls saying the same thing. Instead this shows the thing the panel
 * does not: work in flight across missions and tasks. Busy, the icon pulses and
 * carries the count; idle, it sits dimmed. Either way it stays a link, so it is
 * a predictable hop to /missions rather than a dead ornament.
 */
export function SidebarRailActivity() {
  const {
    missionsRunning,
    missionsQueued,
    tasksRunning,
    tasksQueued,
    running,
    queued,
    loading,
  } = useSidebarActivity();
  const busy = !loading && running + queued > 0;

  const label = loading
    ? "Loading activity"
    : busy
      ? joinParts([
          missionsRunning
            ? `${missionsRunning} mission${missionsRunning === 1 ? "" : "s"} running`
            : "",
          missionsQueued
            ? `${missionsQueued} mission${missionsQueued === 1 ? "" : "s"} queued`
            : "",
          tasksRunning ? `${tasksRunning} task${tasksRunning === 1 ? "" : "s"} running` : "",
          tasksQueued ? `${tasksQueued} task${tasksQueued === 1 ? "" : "s"} queued` : "",
        ])
      : "No running work";
  const tip = loading ? label : busy ? `${running} running · ${queued} queued` : "All quiet";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/missions"
          aria-label={label}
          className={cn(
            "flex h-8 w-full items-center justify-center gap-1 rounded-md",
            "transition-colors hover:bg-accent/50 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            busy ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <Activity
            aria-hidden="true"
            className={cn("h-3.5 w-3.5", busy && "animate-pulse motion-reduce:animate-none")}
          />
          {busy && <span className="text-xs tabular-nums font-medium">{running + queued}</span>}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{tip}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The footer zone, shared by the rail, the Level-2 panel, and the mobile drawer.
 *
 * All three hold different things — a single 32px dot, a two-row readout, the
 * same readout in a drawer — and when each was sized by its own padding they
 * landed ~11px apart. Side by side that reads as a broken step along the bottom
 * of the navigation rather than as one deliberate band, and the divider lines
 * stop instead of running across.
 *
 * So the zone owns the height and the divider, and the content is centred inside
 * it. Sizing by padding instead would need each readout to keep matching the
 * others' arithmetic, and would break the moment either of them changed.
 *
 * The rule is a `border-t` rather than a separate `<Separator />` so the divider
 * is part of the measured box. As a sibling, the panel's separator sat 1px above
 * the box it belonged to, which is exactly the kind of 1px jog this is here to
 * remove.
 */
export const SIDEBAR_FOOTER_ZONE =
  "flex h-16 shrink-0 items-center border-t border-border";

/** Expanded footer: the full readout, shown in the Level-2 panel. */
export function SidebarFooter({ status, className }: { status: SidebarStatus; className?: string }) {
  return (
    /* `w-full`: this lives inside the row-flex footer zone, and a block child of
       a flex row otherwise shrinks to fit-content (~92px), bunching both rows to
       the left instead of spreading across the panel. */
    <div className={cn("w-full space-y-1 text-xs text-muted-foreground", className)}>
      <div className="flex items-center justify-between gap-2">
        <span>Status</span>
        <span className="flex min-w-0 items-center gap-1.5">
          {/* The dot is a colour cue, never the only one: the word beside it is
              what actually reports the state. */}
          <span
            aria-hidden="true"
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              status.online
                ? "bg-success animate-pulse motion-reduce:animate-none"
                : "bg-muted-foreground"
            )}
          />
          <span className="truncate" title={status.online ? "Online" : status.status}>
            {status.online ? "Online" : status.status}
          </span>
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span>Agents</span>
        <span className="font-medium tabular-nums text-foreground">{status.agentCount}</span>
      </div>
    </div>
  );
}

/**
 * Collapsed footer: one dot in the rail, carrying the same information as a
 * tooltip and an accessible name rather than as a second visible readout.
 */
export function SidebarStatusDot({ status, className }: { status: SidebarStatus; className?: string }) {
  const label = `${status.online ? "Online" : status.status} · ${status.agentCount} agents`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          role="status"
          aria-label={label}
          className={cn(
            "flex h-8 w-full items-center justify-center rounded-md",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            className
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "h-2 w-2 rounded-full",
              status.online
                ? "bg-success animate-pulse motion-reduce:animate-none"
                : "bg-muted-foreground"
            )}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
