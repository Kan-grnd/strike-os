"use client";

import { type NodeProps } from "@xyflow/react";
import type { TaskRuntime } from "@/lib/runtime/types";
import { type TopologyNodeData } from "@/lib/runtime/selectors";
import { CompactShell } from "./compact-node";
import { rgbString, useNodePalette, type StatusTreatment } from "./node-palette";

interface OperationNodeData extends TopologyNodeData<TaskRuntime> {
  ownerName?: string;
}

/* TaskRuntime status → one casing for all: Active, Assigned, Queued, Error. */
function taskTreatment(status: string): { treatment: StatusTreatment; word: string; pulse: boolean } {
  if (status === "RUNNING") return { treatment: "accent", word: "Active", pulse: true };
  if (status === "ASSIGNED") return { treatment: "assigned", word: "Assigned", pulse: false };
  if (status === "FAILED") return { treatment: "danger", word: "Error", pulse: false };
  return { treatment: "muted", word: "Queued", pulse: false };
}

export function OperationNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as OperationNodeData;
  const entity = d.entity as TaskRuntime;
  const { treatment, word, pulse } = taskTreatment(entity.status);
  const pal = useNodePalette();
  const owner = d.ownerName ? `by ${d.ownerName}` : "operation";

  return (
    <CompactShell
      id={id}
      label={`Task ${entity.description}, ${word.toLowerCase()}, ${owner}`}
      title={entity.description}
      caption={
        <>
          <span style={{ fontWeight: 500, color: rgbString(pal.taskTreatments[treatment].text) }}>{word}</span>
          <span style={{ color: rgbString(pal.taskSecondary) }}> · {owner}</span>
        </>
      }
      treatment={treatment}
      pulse={pulse}
      activateKind="operation"
      onActivate={d.activate}
      selected={selected}
    />
  );
}
