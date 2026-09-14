/**
 * Tool Permission Engine — Phase 8
 * Manages agent → tool access policies.
 */

import prisma from "@/lib/db";

export type PermissionPolicy = "ALLOW" | "DENY" | "ASK";

export interface ToolPermission {
  toolId: string;
  agentId: string;
  policy: PermissionPolicy;
  grantedAt: Date;
  grantedBy?: string;
}

/**
 * Check if agent has permission to execute tool
 * Returns: { allowed: boolean; reason?: string; requiresApproval: boolean }
 */
export async function checkToolPermission(
  agentId: string,
  toolId: string
): Promise<{ allowed: boolean; reason?: string; requiresApproval: boolean }> {
  const [agent, tool] = await Promise.all([
    prisma.agent.findUnique({ where: { id: agentId } }),
    prisma.tool.findUnique({ where: { id: toolId } }),
  ]);

  if (!agent) return { allowed: false, reason: "Agent not found", requiresApproval: false };
  if (!tool) return { allowed: false, reason: "Tool not found", requiresApproval: false };

  // Current simple model: agent's tools array contains tool IDs it can use
  const allowedTools = JSON.parse(agent.tools || "[]") as string[];
  const hasAccess = allowedTools.includes(tool.name) || allowedTools.includes(toolId);

  if (hasAccess) {
    return { allowed: true, requiresApproval: false };
  }

  // Tool not in agent's list — default to ASK (would trigger approval flow)
  return { allowed: false, reason: "Tool not in agent's permitted list", requiresApproval: true };
}

/**
 * Grant tool permission to agent
 */
export async function grantToolPermission(
  agentId: string,
  toolId: string,
  policy: PermissionPolicy = "ALLOW"
): Promise<void> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error("Agent not found");

  const currentTools = JSON.parse(agent.tools || "[]") as string[];
  if (!currentTools.includes(toolId)) {
    await prisma.agent.update({
      where: { id: agentId },
      data: { tools: JSON.stringify([...currentTools, toolId]) },
    });
  }
}

/**
 * Revoke tool permission from agent
 */
export async function revokeToolPermission(agentId: string, toolId: string): Promise<void> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return;

  const currentTools = JSON.parse(agent.tools || "[]") as string[];
  const updated = currentTools.filter((t) => t !== toolId);
  await prisma.agent.update({
    where: { id: agentId },
    data: { tools: JSON.stringify(updated) },
  });
}

/**
 * Get all permissions for an agent
 */
export async function getAgentToolPermissions(agentId: string): Promise<ToolPermission[]> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return [];

  const toolIds = JSON.parse(agent.tools || "[]") as string[];
  const tools = await prisma.tool.findMany({ where: { id: { in: toolIds } } });

  return tools.map((t) => ({
    toolId: t.id,
    agentId,
    policy: "ALLOW" as PermissionPolicy,
    grantedAt: new Date(),
  }));
}

/**
 * Get all agents with permission for a tool
 */
export async function getToolAgents(toolId: string) {
  const allAgents = await prisma.agent.findMany();
  const permitted = allAgents.filter((a) => {
    const tools = JSON.parse(a.tools || "[]") as string[];
    return tools.includes(toolId);
  });
  return permitted;
}