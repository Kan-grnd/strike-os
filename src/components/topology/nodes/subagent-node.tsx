import { type NodeProps } from "@xyflow/react";
import type { AgentNodeData } from "./agent-node";
import { AgentShell } from "./agent-node";

export function SubAgentNode({ id, data }: NodeProps) {
  const d = data as unknown as AgentNodeData;
  return <AgentShell id={id} activate={d.activate} data={d} nodeType="subagent" />;
}