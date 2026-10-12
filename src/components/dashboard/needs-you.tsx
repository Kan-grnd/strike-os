"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bot,
  ChevronRight,
  PauseCircle,
  ShieldAlert,
  Target,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MissionProgressBar } from "@/components/execution/mission-progress-bar";
import { missionProgress } from "@/lib/execution-meta";
import { cn, formatRelativeTime, truncate } from "@/lib/utils";

/* Agent runtime states that mean the human, not the machine, acts next.
   Mirrors AGENT_ATTENTION_STATES in components/layout/sidebar-footer.tsx,
   which in turn mirrors ATTENTION_PENDING_STATES in
   lib/runtime/selectors.ts. Kept local on purpose so the dashboard bundle does
   not pull the topology selectors in just for a Set. */
const AGENT_ATTENTION_STATES = new Set(["waiting_for_approval", "blocked", "failed"]);

/* "Stalled" is a dashboard default the business has not specified: a RUNNING
   mission that still has non-terminal tasks but has not seen a task update in
   this long is flagged. Surface it loudly so it can be tuned later. */
const STALL_MS = 30 * 60 * 1000;

const MAX_NEEDS = 4;
const MAX_MISSION_ROWS = 5;

type Tone = "warning" | "destructive" | "info";

const TONE_BOX: Record<Tone, string> = {
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
};

const TONE_BADGE: Record<Tone, "warning" | "destructive" | "info"> = {
  warning: "warning",
  destructive: "destructive",
  info: "info",
};

interface NeedItem {
  key: string;
  icon: LucideIcon;
  tone: Tone;
  badge: string;
  title: string;
  detail: string;
  time: string;
  href: string;
}

/* Where a click lands: the home of the worst thing, same priority the sidebar
   footer uses. Missions live in the merged /work list (/missions 308-redirects
   and would drop the filter). */
const WORST_HOME = "/work?type=missions";

function humanize(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!s) return "Unknown";
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildItems(
  approvals: any[],
  agents: any[],
  allTasks: any[],
  missions: any[],
): NeedItem[] {
  const items: NeedItem[] = [];

  approvals
    .filter((a) => a?.status === "PENDING")
    .forEach((a) => {
      items.push({
        key: `approval-${a.id}`,
        icon: ShieldAlert,
        tone: "warning",
        badge: "Approval pending",
        title: truncate(a.description || "Approval requested", 52),
        detail: humanize(a.type),
        time: formatRelativeTime(a.createdAt),
        href: "/agents",
      });
    });

  agents
    .filter((a) => AGENT_ATTENTION_STATES.has(a?.runtimeState))
    .forEach((a) => {
      items.push({
        key: `agent-${a.id}`,
        icon: Bot,
        tone: a?.runtimeState === "failed" ? "destructive" : "warning",
        badge: humanize(a.runtimeState),
        title: a.name || "Unnamed agent",
        detail: a.blockedBy || a.stateReason || "Waiting on you",
        time: formatRelativeTime(a.lastActiveAt || a.updatedAt || a.createdAt),
        href: "/agents",
      });
    });

  allTasks
    .filter((t) => t?.status === "FAILED")
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime(),
    )
    .forEach((t) => {
      items.push({
        key: `task-${t.id}`,
        icon: TriangleAlert,
        tone: "destructive",
        badge: "Task failed",
        title: truncate(t.description || "Task", 52),
        detail: t.agentName ? `Agent ${t.agentName}` : "Unassigned",
        time: formatRelativeTime(t.updatedAt || t.createdAt),
        href: "/tasks",
      });
    });

  missions
    .filter((m) => m?.status === "FAILED" || m?.status === "PAUSED")
    .forEach((m) => {
      const failed = (m.tasks || []).filter((t: any) => t?.status === "FAILED").length;
      items.push({
        key: `mission-${m.id}`,
        icon: m.status === "PAUSED" ? PauseCircle : Target,
        tone: m.status === "PAUSED" ? "info" : "destructive",
        badge: m.status === "PAUSED" ? "Mission paused" : "Mission failed",
        title: truncate(m.goal || "Mission", 52),
        detail:
          m.status === "PAUSED"
            ? "Paused — needs resume"
            : `${failed} failed task${failed === 1 ? "" : "s"}`,
        time: formatRelativeTime(m.updatedAt || m.createdAt),
        href: WORST_HOME,
      });
    });

  return items;
}

/**
 * The strip of work sitting on the user: approvals, stuck agents and failed or
 * paused work. Distinct from "Happening now" — that feed shows what the fleet is
 * doing, this shows what the fleet cannot do without a human.
 *
 * Renders nothing when there is nothing to act on (including while the data is
 * still loading, so the calm state never flashes), because an empty attention
 * strip would not earn its place on the page.
 */
export function NeedsYouStrip({
  approvals,
  agents,
  allTasks,
  missions,
  loading,
}: {
  approvals: any[] | undefined;
  agents: any[] | undefined;
  allTasks: any[] | undefined;
  missions: any[] | undefined;
  loading?: boolean;
}) {
  const items = React.useMemo(
    () =>
      buildItems(approvals || [], agents || [], allTasks || [], missions || []),
    [approvals, agents, allTasks, missions],
  );

  if (loading || items.length === 0) return null;

  const shown = items.slice(0, MAX_NEEDS);
  const overflow = items.length - shown.length;

  return (
    <Card className="flex min-w-0 flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Needs you
          </h2>
          <Badge variant="warning" className="tabular-nums">
            {items.length}
          </Badge>
        </div>
        {overflow > 0 && (
          <Link
            href={WORST_HOME}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            +{overflow} more
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className="group flex min-w-0 items-start gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:border-ring/40 hover:bg-accent/40"
            >
              <span className={cn("shrink-0 rounded-md p-2", TONE_BOX[item.tone])}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={TONE_BADGE[item.tone]} className="truncate">
                    {item.badge}
                  </Badge>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70">
                    {item.time}
                  </span>
                </div>
                <p className="mt-1.5 truncate text-sm font-medium">{item.title}</p>
                <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

/** Latest updatedAt across a mission's tasks, joined from the full task list
 *  (the missions endpoint only selects id/status/description/ownerAgentId). */
function latestTaskUpdate(missionTasks: any[], byId: Map<string, any>): number | null {
  let latest: number | null = null;
  for (const t of missionTasks) {
    const full = byId.get(t?.id);
    const raw = full?.updatedAt || t?.updatedAt;
    if (!raw) continue;
    const ts = new Date(raw).getTime();
    if (Number.isFinite(ts) && (latest === null || ts > latest)) latest = ts;
  }
  return latest;
}

function isStalled(m: any, byId: Map<string, any>): boolean {
  const prog = missionProgress(m);
  if (prog.active <= 0) return false;
  const latest = latestTaskUpdate(m.tasks || [], byId);
  const reference = latest ?? new Date(m.updatedAt || m.createdAt).getTime();
  if (!Number.isFinite(reference)) return false;
  return Date.now() - reference > STALL_MS;
}

/**
 * One row per running mission with its completion bar and a stalled flag.
 *
 * The bar is MissionProgressBar — the single canonical bar also used by /work
 * and the mission detail — so the same mission can never render two different
 * bars. Renders nothing when no mission is running.
 */
export function MissionProgressSection({
  missions,
  allTasks,
}: {
  missions: any[] | undefined;
  allTasks: any[] | undefined;
}) {
  const byId = React.useMemo(() => {
    const map = new Map<string, any>();
    (allTasks || []).forEach((t) => {
      if (t?.id != null) map.set(t.id, t);
    });
    return map;
  }, [allTasks]);

  const running = React.useMemo(
    () => (missions || []).filter((m) => m?.status === "RUNNING"),
    [missions],
  );

  if (running.length === 0) return null;

  const shown = running.slice(0, MAX_MISSION_ROWS);
  const overflow = running.length - shown.length;

  return (
    <Card className="flex min-w-0 flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Mission progress
          </h2>
          <Badge variant="info" className="tabular-nums">
            {running.length}
          </Badge>
        </div>
        {overflow > 0 && (
          <Link
            href="/work?type=missions"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            +{overflow} more
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="flex flex-col divide-y divide-border/60">
        {shown.map((m) => {
          const prog = missionProgress(m);
          const stalled = isStalled(m, byId);
          return (
            <Link
              key={m.id}
              href={`/missions/${m.id}`}
              className="group block rounded-lg px-1 py-3 transition-colors first:pt-0 last:pb-0 hover:bg-accent/40"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-medium">
                    {truncate(m.goal || "Mission", 64)}
                  </p>
                  {stalled && (
                    <Badge variant="warning" className="shrink-0">
                      Stalled
                    </Badge>
                  )}
                </div>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {prog.pct}% · {prog.completed}/{prog.total}
                </span>
              </div>
              <MissionProgressBar mission={m} className="mt-2" />
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
