"use client";

import { type NodeProps } from "@xyflow/react";
import type { AgentNodeData } from "./agent-node";
import { CompactShell } from "./compact-node";
import { TasksChevron } from "./node-bits";
import { agentStatePresentation } from "@/lib/runtime/presentation";
import { rgbString, sentenceCase, useNodePalette, type StatusTreatment } from "./node-palette";

function subTreatment(state: string): StatusTreatment {
  if (state === "executing") return "success";
  if (state === "failed") return "danger";
  if (state === "blocked") return "warning";
  if (
    state === "planning" ||
    state === "thinking" ||
    state === "delegating" ||
    state === "reviewing" ||
    state === "initializing" ||
    state === "recovering" ||
    state === "retrying"
  ) {
    return "accent";
  }
  return "muted";
}

export function SubAgentNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as AgentNodeData;
  const entity = d.entity;
  const presenting = agentStatePresentation(entity.runtimeState);
  const treatment = subTreatment(entity.runtimeState);
  const pal = useNodePalette();

  const subCount = d.subCount ?? 0;
  const opCount = d.opCount ?? 0;
  const taskCount = subCount + opCount;
  const tasksOpen = (d.expandedSub ?? false) || (d.expandedOps ?? false);

  return (
    <CompactShell
      id={id}
      label={`Sub-agent ${entity.name}, ${presenting.label.toLowerCase()}`}
      title={entity.name}
      caption={
        <span style={{ fontWeight: 500, color: rgbString(pal.taskTreatments[treatment].text) }}>
          {sentenceCase(presenting.label)}
        </span>
      }
      treatment={treatment}
      pulse={treatment === "success" || treatment === "accent"}
      toggles={
        taskCount > 0 ? (
          <TasksChevron
            open={tasksOpen}
            count={taskCount}
            onToggle={() => d.toggle?.(id)}
            dot={rgbString(pal.taskSecondary)}
            style={{ right: 8, bottom: 8 }}
          />
        ) : undefined
      }
      activateKind="subagent"
      onActivate={d.activate}
      selected={selected}
    />
  );
}
