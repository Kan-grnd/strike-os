/**
 * Shared agent-creation path — the single place a plain agent is created from
 * an API body (used by POST /api/agents and the Specialist Forge deploy).
 * The Specialist bundles ride the same path as the Architect form, adding only
 * the model-policy fields the Agent schema already carries.
 */

import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";

export interface AgentCreateInput {
  name?: string;
  description?: string;
  type?: string;
  status?: string;
  runtimeState?: string;
  colonyId?: string;
  parentId?: string;
  capabilities?: string[];
  tools?: string[];
  models?: string[];
  permissions?: string[];
  memoryScope?: string;
  modelPolicy?: Record<string, unknown>;
  fallbackModelIds?: string[];
}

export async function createAgentFromBody(
  body: AgentCreateInput
): Promise<{ id: string; name: string; type: string }> {
  const agent = await prisma.agent.create({
    data: {
      name: body.name ?? "Unnamed Agent",
      description: body.description,
      type: body.type || "WORKER",
      status: "IDLE",
      runtimeState: "idle",
      colonyId: body.colonyId,
      parentId: body.parentId,
      capabilities: JSON.stringify(body.capabilities || []),
      tools: JSON.stringify(body.tools || []),
      models: JSON.stringify(body.models || []),
      permissions: JSON.stringify(body.permissions || []),
      memoryScope: body.memoryScope || "AGENT",
      modelPolicy:
        typeof body.modelPolicy === "object" && body.modelPolicy !== null
          ? JSON.stringify(body.modelPolicy)
          : "{}",
      fallbackModelIds: JSON.stringify(body.fallbackModelIds || []),
    },
  });

  await eventBus.emit({
    type: "agent.created",
    source: "agent-registry",
    subject: "agent",
    subjectId: agent.id,
    agentId: agent.id,
    payload: { name: agent.name, type: agent.type },
  });

  return { id: agent.id, name: agent.name, type: agent.type };
}