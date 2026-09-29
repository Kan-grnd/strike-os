"use client";

import { cn } from "@/lib/utils";
import { useAgents, useHealth } from "@/hooks/useApi";
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

/** Expanded footer: the full readout, shown in the Level-2 panel. */
export function SidebarFooter({ status, className }: { status: SidebarStatus; className?: string }) {
  return (
    <div className={cn("space-y-1 px-1 text-xs text-muted-foreground", className)}>
      <div className="flex items-center justify-between">
        <span>Status</span>
        <span className="flex items-center gap-1.5">
          {/* The dot is a colour cue, never the only one: the word beside it is
              what actually reports the state. */}
          <span
            aria-hidden="true"
            className={cn("h-1.5 w-1.5 rounded-full", status.online ? "bg-success animate-pulse" : "bg-muted-foreground")}
          />
          {status.online ? "Online" : status.status}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span>Agents</span>
        <span className="font-medium text-foreground">{status.agentCount}</span>
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
            className={cn("h-2 w-2 rounded-full", status.online ? "bg-success animate-pulse" : "bg-muted-foreground")}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
