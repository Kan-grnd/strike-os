import type { Agent, Colony, Event, Mission, Relationship, Task } from "@prisma/client";
import type {
  AgentRuntime,
  BrainRuntime,
  ColonyRuntime,
  EventRuntime,
  RelationshipRuntime,
  SystemRuntime,
  TaskRuntime,
} from "./types";

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function parsePayload(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function mapColony(colony: Colony): ColonyRuntime {
  return {
    id: colony.id,
    name: colony.name,
    status: colony.status,
    agentIds: [],
    timestamps: { createdAt: colony.createdAt, updatedAt: colony.updatedAt },
  };
}

export function mapAgent(agent: Agent): AgentRuntime {
  return {
    id: agent.id,
    name: agent.name,
    type: agent.type,
    colonyId: agent.colonyId ?? undefined,
    parentId: agent.parentId ?? undefined,
    runtimeState: agent.runtimeState as AgentRuntime["runtimeState"],
    currentTaskId: agent.currentTaskId ?? undefined,
    models: parseJsonArray(agent.models),
    capabilities: parseJsonArray(agent.capabilities),
    tools: parseJsonArray(agent.tools),
    permissions: parseJsonArray(agent.permissions),
    successRate: agent.successRate,
    avgDuration: agent.avgDuration,
    totalCost: agent.totalCost,
    lastActiveAt: agent.lastActiveAt ?? undefined,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  };
}

export function mapTask(task: Task): TaskRuntime {
  return {
    id: task.id,
    missionId: task.missionId,
    description: task.description,
    status: task.status,
    ownerAgentId: task.ownerAgentId ?? undefined,
    dependencies: parseJsonArray(task.dependencies),
    retryCount: task.retryCount,
    maxRetries: task.maxRetries,
    cost: task.cost,
    timestamps: {
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt ?? undefined,
    },
  };
}

export function mapRelationship(relationship: Relationship): RelationshipRuntime {
  return {
    fromId: relationship.fromId,
    fromType: relationship.fromType,
    relation: relationship.relation,
    toId: relationship.toId,
    toType: relationship.toType,
  };
}

export function mapEvent(event: Event): EventRuntime {
  return {
    id: event.id,
    type: event.type,
    timestamp: event.timestamp,
    source: event.source,
    subject: event.subject ?? undefined,
    subjectId: event.subjectId ?? undefined,
    missionId: event.missionId ?? undefined,
    taskId: event.taskId ?? undefined,
    agentId: event.agentId ?? undefined,
    payload: parsePayload(event.payload),
    traceId: event.traceId ?? undefined,
  };
}

const ACTIVE_STATES = ["executing", "thinking", "planning", "delegating", "retrying"];

export function computeBrainRuntime(
  agents: AgentRuntime[],
  colonies: ColonyRuntime[],
  missions: Mission[],
  tasks: Task[]
): BrainRuntime {
  const failedCount = agents.filter((a) => a.runtimeState === "failed").length;
  const activeCount = agents.filter((a) => ACTIVE_STATES.includes(a.runtimeState)).length;
  const waitingCount = agents.filter((a) =>
    ["waiting", "waiting_for_approval", "blocked"].includes(a.runtimeState)
  ).length;
  // Attention = work that actively needs human/dependency unblocking. A single
  // stuck agent must NOT degrade the whole brain (error localization, §14) —
  // health is derived from the aggregate, not propagated from individual nodes.
  const attentionCount = agents.filter((a) =>
    ["waiting_for_approval", "blocked", "failed"].includes(a.runtimeState)
  ).length;
  const operationCount = tasks.filter(
    (t) => t.status !== "COMPLETED" && t.status !== "CANCELLED"
  ).length;

  let state: BrainRuntime["state"] = "operational";
  if (agents.length === 0) state = "offline";
  else if (activeCount === 0 && attentionCount > 0) state = "critical";
  else if (attentionCount >= Math.ceil(agents.length / 3)) state = "degraded";
  else if (activeCount > 0) state = "working";
  else state = "operational";

  return {
    state,
    agentCount: agents.length,
    activeCount,
    waitingCount,
    errorCount: failedCount,
    colonyCount: colonies.length,
    missionCount: missions.length,
    operationCount,
  };
}

export function computeSystemRuntime(counts: {
  providers: number;
  models: number;
  mcps: number;
  memories: number;
}): SystemRuntime {
  return {
    providerCount: counts.providers,
    modelCount: counts.models,
    mcpCount: counts.mcps,
    memoryCount: counts.memories,
  };
}