import type { AgentRuntimeState } from "@/lib/runtime-state";

export interface AgentRuntime {
  id: string;
  name: string;
  type: string;
  colonyId?: string;
  parentId?: string;
  runtimeState: AgentRuntimeState;
  currentTaskId?: string;
  models: string[];
  capabilities: string[];
  tools: string[];
  permissions: string[];
  successRate: number;
  avgDuration: number;
  totalCost: number;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ColonyRuntime {
  id: string;
  name: string;
  status: string;
  agentIds: string[];
  timestamps: { createdAt: Date; updatedAt: Date };
}

export interface TaskRuntime {
  id: string;
  missionId: string;
  description: string;
  status: string;
  ownerAgentId?: string;
  dependencies: string[];
  retryCount: number;
  maxRetries: number;
  cost: number;
  timestamps: { createdAt: Date; updatedAt: Date; completedAt?: Date };
}

export interface RelationshipRuntime {
  fromId: string;
  fromType: string;
  relation: string;
  toId: string;
  toType: string;
}

export interface EventRuntime {
  id: string;
  type: string;
  timestamp: Date;
  source: string;
  subject?: string;
  subjectId?: string;
  missionId?: string;
  taskId?: string;
  agentId?: string;
  payload: Record<string, unknown>;
  traceId?: string;
}

/** Health of the orchestrator (STRIKE BRAIN). */
export type BrainState =
  | "operational"
  | "working"
  | "degraded"
  | "critical"
  | "offline";

export interface BrainRuntime {
  state: BrainState;
  agentCount: number;
  activeCount: number;
  waitingCount: number;
  errorCount: number;
  colonyCount: number;
  missionCount: number;
  operationCount: number;
}

/** Infrastructure counts shown by the System Inspector (deep zoom). */
export interface SystemRuntime {
  providerCount: number;
  modelCount: number;
  mcpCount: number;
  memoryCount: number;
}

export interface WorkforceRuntime {
  brain: BrainRuntime;
  colonies: ColonyRuntime[];
  agents: AgentRuntime[];
  tasks: TaskRuntime[];
  relationships: RelationshipRuntime[];
  recentEvents: EventRuntime[];
  system: SystemRuntime;
  generatedAt: Date;
}

/** A transient runtime relationship (delegation / communication / verification).
 *  Reflecting a real event, never fabricated by the renderer. */
export interface TempEdge {
  id: string;
  kind: "delegation" | "communication" | "verification";
  source: string;
  target: string;
  taskId?: string;
  eventId?: string;
  label?: string;
  occurredAt: number;
}

/** A brief completion/error indication before the transient entity is swept. */
export interface CompletionFlash {
  id: string;
  entityId: string;
  label: string;
  kind: "success" | "error" | "info";
  occurredAt: number;
}