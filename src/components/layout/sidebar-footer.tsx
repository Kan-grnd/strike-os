"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useAgents, useApprovals, useHealth, useMissions, useTasks } from "@/hooks/useApi";
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

/* Agent runtime states that mean the user, not the machine, has to act next.
   Mirrors ATTENTION_PENDING_STATES in lib/runtime/selectors.ts so the rail and
   the topology agree about what "attention required" means. */
const AGENT_ATTENTION_STATES = new Set(["waiting_for_approval", "blocked", "failed"]);

/**
 * Things that need the user, across every surface that has a "waiting on you"
 * notion. All four sources are the same unfiltered endpoints the pages read, so
 * SWR dedupes — the badge never doubles any payload a page already fetches.
 * Degraded signals belong to the panel's Status row, not here: on error the
 * whole badge goes quiet rather than inventing a number from a partial read.
 */
export function useSidebarAttention() {
  const { data: approvals } = useApprovals();
  const { data: agents } = useAgents();
  const { data: tasks } = useTasks();
  const { data: missions } = useMissions();
  const loading =
    approvals === undefined ||
    agents === undefined ||
    tasks === undefined ||
    missions === undefined;

  let approvalsPending = 0;
  let agentsStuck = 0;
  let tasksFailed = 0;
  let missionsFailed = 0;
  let missionsPaused = 0;

  if (Array.isArray(approvals?.approvals)) {
    for (const a of approvals.approvals) {
      if (a?.status === "PENDING") approvalsPending++;
    }
  }
  if (Array.isArray(agents?.agents)) {
    for (const a of agents.agents) {
      if (AGENT_ATTENTION_STATES.has(a?.runtimeState)) agentsStuck++;
    }
  }
  if (Array.isArray(tasks?.tasks)) {
    for (const t of tasks.tasks) {
      if (t?.status === "FAILED") tasksFailed++;
    }
  }
  if (Array.isArray(missions?.missions)) {
    for (const m of missions.missions) {
      if (m?.status === "FAILED") missionsFailed++;
      /* PAUSED needs the user to Resume — same class of "you must act" as a
         failure, so it counts towards attention. */
      else if (m?.status === "PAUSED") missionsPaused++;
    }
  }

  return { approvalsPending, agentsStuck, tasksFailed, missionsFailed, missionsPaused, loading };
}

type SidebarAttention = ReturnType<typeof useSidebarAttention>;

function joinParts(parts: string[]) {
  return parts.filter(Boolean).join(", ");
}

/** The worst thing's home, for whichever rail control needs a destination.
 *  Missions live in the merged /work list, so the facet goes in the query —
 *  /missions only 308s there and would silently drop the filter. */
function attentionHref(a: SidebarAttention): string {
  if (a.approvalsPending || a.agentsStuck) return "/agents";
  return a.tasksFailed ? "/tasks" : "/work?type=missions";
}

/** One shared reading of "what needs the user right now", for the aria label and
 *  tooltip of every bell-shaped rail control. */
function attentionLabel(a: SidebarAttention): string {
  if (a.loading) return "Loading attention";
  const { approvalsPending, agentsStuck, tasksFailed, missionsFailed, missionsPaused } = a;
  if (approvalsPending + agentsStuck + tasksFailed + missionsFailed + missionsPaused === 0)
    return "All clear";
  return joinParts([
    approvalsPending
      ? `${approvalsPending} approval${approvalsPending === 1 ? "" : "s"} pending`
      : "",
    agentsStuck ? `${agentsStuck} agent${agentsStuck === 1 ? "" : "s"} stuck` : "",
    tasksFailed ? `${tasksFailed} failed task${tasksFailed === 1 ? "" : "s"}` : "",
    missionsFailed ? `${missionsFailed} failed mission${missionsFailed === 1 ? "" : "s"}` : "",
    missionsPaused ? `${missionsPaused} paused mission${missionsPaused === 1 ? "" : "s"}` : "",
  ]);
}

/**
 * The rail's footer while the Level-2 panel is open.
 *
 * The panel already reports connectivity, so a second status dot there would be
 * two controls saying the same thing. This instead surfaces what the panel does
 * not: work sitting on the user. A bell with a count, zero state dimmed.
 *
 * Where a click lands follows the worst thing first and the home of that worst
 * thing. One wrinkle: nothing in the app resolves approvals yet — there is no
 * approvals page or approve/deny action (the `approvals` table is written by the
 * runtime but never surfaced), so approvals point at the agents they concern.
 * That is a deliberate stand-in, not a fix; the resolution UI is a follow-up.
 */
export function SidebarRailAttention() {
  const attentionState = useSidebarAttention();
  const { approvalsPending, agentsStuck, tasksFailed, missionsFailed, missionsPaused, loading } =
    attentionState;
  const total =
    approvalsPending + agentsStuck + tasksFailed + missionsFailed + missionsPaused;
  const attention = !loading && total > 0;

  const label = attentionLabel(attentionState);
  const tip = label;

  const href = attentionHref(attentionState);
  /* Idle, the badge is pure status ("all clear") and has nothing to resolve, so
     it stays a live region rather than a link to nowhere; the moment something
     needs the user it becomes the hop to the worst thing's home. */
  const triggerCls = cn(
    "flex h-8 w-full items-center justify-center gap-1 rounded-md",
    "transition-colors hover:bg-accent/50 hover:text-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
    attention ? "text-foreground" : "text-muted-foreground"
  );
  const bell = (
    <Bell aria-hidden="true" className={cn("h-3.5 w-3.5", attention && "text-warning")} />
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {attention ? (
          <Link href={href} aria-label={label} className={triggerCls}>
            {bell}
            <span className="text-xs tabular-nums font-medium">{total}</span>
          </Link>
        ) : (
          <span role="status" tabIndex={0} aria-label={label} className={triggerCls}>
            {bell}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="right">{tip}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The rail's footer while Level 2 is closed.
 *
 * With the panel gone there is no two-row readout, and the rail has two things
 * left to say: "is all well" and "did something need me?" — so this stacks both
 * signals instead of dropping one. The heights were tuned to the shared h-16
 * zone (32px bell + 24px dot + a 2px gap = 58px) so the band's divider and its
 * neighbours keep their alignment contract.
 *
 * All-clear, the bell goes quiet and aria-hidden and stops being a tab stop —
 * the dot below is the one live region, and the bell keeps only a native
 * `title` so a pointer user still gets the "nothing needs you" reading. The
 * moment something needs the user, the same bell takes the click and becomes
 * the hop to the worst thing's home.
 */
export function SidebarRailClosedFooter({ status }: { status: SidebarStatus }) {
  const attentionState = useSidebarAttention();
  const { approvalsPending, agentsStuck, tasksFailed, missionsFailed, missionsPaused, loading } =
    attentionState;
  const total =
    approvalsPending + agentsStuck + tasksFailed + missionsFailed + missionsPaused;
  const attention = !loading && total > 0;
  const label = attentionLabel(attentionState);

  return (
    <div className="flex w-full flex-col items-center justify-center gap-0.5">
      {attention ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={attentionHref(attentionState)}
              aria-label={label}
              className={cn(
                "flex h-8 w-full items-center justify-center gap-1 rounded-md",
                "transition-colors hover:bg-accent/50 hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                "text-foreground"
              )}
            >
              <Bell aria-hidden="true" className="h-3.5 w-3.5 text-warning" />
              <span className="text-xs tabular-nums font-medium">{total}</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      ) : (
        <span
          aria-hidden="true"
          title={label}
          className="flex h-8 w-full items-center justify-center rounded-md text-muted-foreground"
        >
          <Bell className="h-3.5 w-3.5" />
        </span>
      )}
      <SidebarStatusDot status={status} className="h-6" />
    </div>
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
              status.online ? "bg-success" : "bg-muted-foreground"
            )}
          />
          <span className="truncate" title={status.online ? "Online" : status.status}>
            {status.online ? "Online" : status.status}
          </span>
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span>Agents</span>
        <span
          className="font-medium tabular-nums text-foreground"
          title={status.agentCountKnown ? `${status.agentCount} agents` : "Agent count unknown"}
        >
          {status.agentCountKnown ? status.agentCount : "—"}
        </span>
      </div>
    </div>
  );
}

/**
 * Collapsed footer: one dot in the rail, carrying the same information as a
 * tooltip and an accessible name rather than as a second visible readout.
 */
export function SidebarStatusDot({ status, className }: { status: SidebarStatus; className?: string }) {
  const label = `${status.online ? "Online" : status.status} · ${status.agentCountKnown ? `${status.agentCount} agents` : "agent count unknown"}`;
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
              status.online ? "bg-success" : "bg-muted-foreground"
            )}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
