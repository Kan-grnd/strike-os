import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Info, Maximize2 } from "lucide-react";
import { AvatarOrb } from "@/components/ui/components-primitives-avatar";
import type { BrainRuntime, SystemRuntime } from "@/lib/runtime/types";
import { HANDLE_IDS, type TopologyNodeData } from "@/lib/runtime/selectors";
import { SideHandles } from "./side-handles";

interface BrainNodeData extends TopologyNodeData<BrainRuntime> {
  system?: SystemRuntime;
  territoryCount?: number;
  allExpanded?: boolean;
  expandAll?: () => void;
}

/** Core status → theme token, base fallback, label and blink behavior. */
const ORB_STATUS: Record<
  string,
  { token: string; fallback: string; label: string; blink: boolean }
> = {
  working: { token: "--info", fallback: "#3d7dd8", label: "Working", blink: true },
  operational: { token: "--success", fallback: "#2a9d5f", label: "Operational", blink: true },
  degraded: { token: "--warning", fallback: "#e27a2a", label: "Degraded", blink: false },
  critical: { token: "--destructive", fallback: "#e74668", label: "Critical", blink: false },
  offline: { token: "--muted-foreground", fallback: "#4f46e5", label: "Offline", blink: false },
};

export function BrainNode({ id, data }: NodeProps) {
  const d = data as unknown as BrainNodeData;
  const entity = d.entity as BrainRuntime;
  const status = ORB_STATUS[entity.state] ?? ORB_STATUS.working;
  const territoryCount = d.territoryCount ?? 0;
  const allExpanded = d.allExpanded ?? false;

  return (
    /* The sphere clips its own content; the handle lives on this unclipped
     * wrapper so the colony edges still start at the bottom center. */
    <div className="node-list-in relative h-[180px] w-[180px] cursor-pointer">
      <Handle type="source" position={Position.Bottom} id={HANDLE_IDS.out} />
      <SideHandles source />
      <AvatarOrb
        baseColor={status.token}
        fallbackColor={status.fallback}
        variant="content"
        size="xl"
        blink={status.blink}
        title="Strike Brain"
        aria-label={`Strike Brain, ${status.label.toLowerCase()}`}
      >
        <span
          style={{
            fontSize: 13,
            lineHeight: 1,
            padding: "4px 12px",
            borderRadius: 999,
            fontWeight: 600,
            background: "rgba(255,255,255,.92)",
            color: "var(--orb-badge-text)",
          }}
        >
          {status.label}
        </span>
        <div
          style={{
            margin: "8px 0 0",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            lineHeight: 1.5,
            color: "#fff",
          }}
        >
          <span>
            {entity.activeCount}/{entity.agentCount} active
          </span>
          <span>
            {entity.missionCount} mission{entity.missionCount === 1 ? "" : "s"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {territoryCount > 0 && (
            <button
              type="button"
              className="av-hit"
              title="Expand all"
              aria-label="Expand all"
              aria-expanded={allExpanded}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                d.expandAll?.();
              }}
            >
              <span className="av-circle">
                <Maximize2 size={12} aria-hidden />
              </span>
            </button>
          )}
          <button
            type="button"
            className="av-hit"
            title="Details"
            aria-label="Details"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              d.activate?.(id, "brain");
            }}
          >
            <span className="av-circle">
              <Info size={12} aria-hidden />
            </span>
          </button>
        </div>
      </AvatarOrb>
    </div>
  );
}
