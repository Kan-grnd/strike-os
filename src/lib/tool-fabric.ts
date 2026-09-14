/**
 * Tool Fabric — Phase 8
 * Unified layer for all external actions via standardized tools.
 */

import { eventBus } from "./events";
import prisma from "@/lib/db";

export interface ToolExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  duration: number;
  cost: number;
  toolCalls?: Array<{ name: string; arguments: unknown; result?: unknown }>;
}

function resolveCredential(toolSource: string, sourceId?: string | null): { apiKey?: string; endpoint?: string } | null {
  // References only — never expose to frontend
  // Read from environment via secret names
  if (sourceId) return null; // Not needed for native
  return { apiKey: process.env["TOOL_API_KEY"] || undefined };
}

export async function executeTool(
  toolId: string,
  input: unknown,
  agentId?: string
): Promise<ToolExecutionResult> {
  const start = Date.now();

  try {
    // 1. Load tool
    const tool = await prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool) throw new Error(`Tool ${toolId} not found`);

    // 2. Permission check (if agent specified)
    if (agentId) {
      const agent = await prisma.agent.findUnique({ where: { id: agentId } });
      if (agent) {
        const allowedTools = JSON.parse(agent.tools || "[]") as string[];
        // In Phase 8 basic model: agent must have tool in its tools array
        // Full permission matrix in Phase 9
        if (!allowedTools.includes(tool.name) && !allowedTools.includes(toolId)) {
          await eventBus.emit({
            type: "tool.failed",
            source: "tool-fabric",
            subject: "tool",
            subjectId: tool.id,
            payload: { error: "Permission denied", agentId, toolId },
          });
          return { success: false, error: "Agent lacks permission for this tool", duration: Date.now() - start, cost: 0 };
        }
      }
    }

    // 3. Execute based on source
    let result: unknown;
    let cost = 0;

    switch (tool.source) {
      case "NATIVE": {
        // Built-in mock execution for demo
        result = input;
        cost = 0.001;
        break;
      }
      case "MCP": {
        // Call MCP server (stub for now — real MCP call in Phase 9)
        result = { mcp_result: input, server: tool.sourceId || "mcp" };
        cost = 0.002;
        break;
      }
      case "API": {
        // Call external API (stub — real call when connector configured)
        result = { api_result: input, endpoint: tool.sourceId || "unknown" };
        cost = 0.003;
        break;
      }
      default: {
        result = input;
        cost = 0;
      }
    }

    const duration = Date.now() - start;

    // 4. Emit events
    await eventBus.emit({
      type: "tool.completed",
      source: "tool-fabric",
      subject: "tool",
      subjectId: tool.id,
      payload: { tool: tool.name, source: tool.source, cost, duration, agentId: agentId ?? undefined },
    });

    // 5. Update tool stats
    await prisma.tool.update({
      where: { id: tool.id },
      data: {
        lastUsedAt: new Date(),
        totalCalls: { increment: 1 },
        successRate: 99, // simplified
      },
    });

    return { success: true, output: result, duration, cost };
  } catch (err) {
    const duration = Date.now() - start;
    await eventBus.emit({
      type: "tool.failed",
      source: "tool-fabric",
      subject: "tool",
      subjectId: toolId,
      payload: { error: (err as Error).message, agentId },
    });
    return { success: false, error: (err as Error).message, duration, cost: 0 };
  }
}