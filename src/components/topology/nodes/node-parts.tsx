import type { ReactNode } from "react";
import { FoldVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TopologyLevel } from "@/lib/runtime/selectors";

const LEVEL_LABEL: Record<TopologyLevel, string> = {
  core: "CORE",
  territory: "TERRITORY",
  agent: "AGENT",
  sub: "SUB",
  op: "OP",
};

const LEVEL_TEXT: Record<TopologyLevel, string> = {
  core: "text-[hsl(var(--level-core))]",
  territory: "text-[hsl(var(--level-territory))]",
  agent: "text-[hsl(var(--level-agent))]",
  sub: "text-[hsl(var(--level-sub))]",
  op: "text-[hsl(var(--level-op))]",
};

const LEVEL_BG: Record<TopologyLevel, string> = {
  core: "bg-[hsl(var(--level-core))]",
  territory: "bg-[hsl(var(--level-territory))]",
  agent: "bg-[hsl(var(--level-agent))]",
  sub: "bg-[hsl(var(--level-sub))]",
  op: "bg-[hsl(var(--level-op))]",
};

/** Tiny colored word naming the hierarchy level. Color is never the only cue. */
export function LevelTag({ level }: { level: TopologyLevel }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap text-[11px] font-semibold uppercase leading-none tracking-wider",
        LEVEL_TEXT[level]
      )}
    >
      {LEVEL_LABEL[level]}
    </span>
  );
}

/** Colored strip along the left edge of a node card (level color). */
export function LevelBar({ level }: { level: TopologyLevel }) {
  return (
    <span
      aria-hidden
      className={cn("absolute inset-y-1 left-0 w-[3px] rounded-r-full", LEVEL_BG[level])}
    />
  );
}

/** Shared node CTA. ≥28px tall, stops propagation so React Flow node click
 *  (and Enter/Space on the card) never double-fires. */
export function NodeButton({
  children,
  onClick,
  active = false,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex h-7 min-h-7 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
        active
          ? "border-primary/40 bg-primary/10 text-foreground hover:border-primary/60"
          : "border-border bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

export function ExpandToggleButton({
  expanded,
  count,
  label,
  onToggle,
}: {
  expanded: boolean;
  count: number;
  label: string;
  onToggle: () => void;
}) {
  const Icon = expanded ? FoldVertical : Plus;
  return (
    <NodeButton active={!expanded} onClick={onToggle} aria-expanded={expanded}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {expanded ? "Hide" : `+ ${label} (${count})`}
    </NodeButton>
  );
}

export { LEVEL_BG };