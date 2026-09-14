/**
 * Automation Actions Engine — Phase 9
 * Executes all action types for automations
 */

import { eventBus } from "./events";
import prisma from "@/lib/db";
import { getMissionEngine } from "./engine";
import { modelGateway } from "./model-gateway";
import { executeTool } from "./tool-fabric";
import { getSecret } from "./secrets";

export interface ActionConfig {
  type: "create_mission" | "create_task" | "invoke_agent" | "call_tool" | "call_api" | "send_webhook" | "write_memory" | "notify_user";
  config: Record<string, unknown>;
}

export interface ActionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  duration: number;
  cost: number;
}

export class ActionEngine {
  private missionEnginePromise: Promise<any> = getMissionEngine();
  private modelGateway = modelGateway;

  constructor() {
    // Lazy init via promise
  }
  
  async getMissionEngine() {
    return await this.missionEnginePromise;
  }

  /**
   * Execute a single action
   */
  async execute(automationId: string, action: ActionConfig, context: Record<string, unknown> = {}): Promise<ActionResult> {
    const start = Date.now();

    try {
      let result: ActionResult;

      switch (action.type) {
        case "create_mission":
          result = await this.createMission(action.config, context);
          break;
        case "create_task":
          result = await this.createTask(action.config, context);
          break;
        case "invoke_agent":
          result = await this.invokeAgent(action.config, context);
          break;
        case "call_tool":
          result = await this.callTool(action.config, context);
          break;
        case "call_api":
          result = await this.callApi(action.config, context);
          break;
        case "send_webhook":
          result = await this.sendWebhook(action.config, context);
          break;
        case "write_memory":
          result = await this.writeMemory(action.config, context);
          break;
        case "notify_user":
          result = await this.notifyUser(action.config, context);
          break;
        default:
          throw new Error(`Unknown action type: ${(action as any).type}`);
      }

      await eventBus.emit({
        type: "automation.running",
        source: "automation-engine",
        subject: "automation",
        subjectId: automationId,
        payload: { action: action.type, success: result.success, duration: result.duration, cost: result.cost },
      });

      return { ...result, duration: Date.now() - start };
    } catch (err) {
      const duration = Date.now() - start;
      await eventBus.emit({
        type: "automation.failed",
        source: "automation-engine",
        subject: "automation",
        subjectId: automationId,
        payload: { action: action.type, error: (err as Error).message },
      });
      return { success: false, error: (err as Error).message, duration, cost: 0 };
    }
  }

  // --- Action Implementations ---

  private async createMission(config: Record<string, unknown>, context: Record<string, unknown>): Promise<any> {
    const missionEngine = await this.getMissionEngine();
    const goal = (config.goal as string) || "Automated mission";
    const useLlm = config.useLlm === true;

    const planSteps = await missionEngine.planMission(goal, useLlm);
    const agentIds = (config.agentIds as string[]) || [];

    const mission = await missionEngine.createMission(prisma, goal, planSteps, agentIds, config.priority as number || 0);

    // Start mission immediately if configured
    if (config.autoStart === true) {
      await missionEngine.startMission(prisma, mission.id);
    }

    return { missionId: mission.id, goal: mission.goal };
  }

  private async createTask(config: Record<string, unknown>, context: Record<string, unknown>): Promise<any> {
    const missionId = (config.missionId as string) || (context.missionId as string);
    if (!missionId) throw new Error("Mission ID required for create_task action");

    const task = await prisma.task.create({
      data: {
        missionId,
        description: (config.description as string) || "Automated task",
        status: "QUEUED",
        input: JSON.stringify(config.input || {}),
        ownerAgentId: config.ownerAgentId as string,
        dependencies: JSON.stringify(config.dependencies || []),
        priority: config.priority as number || 0,
        timeout: config.timeout as number || 60000,
      },
    });

    return { taskId: task.id, description: task.description };
  }

  private async invokeAgent(config: Record<string, unknown>, context: Record<string, unknown>): Promise<any> {
    const agentId = config.agentId as string;
    if (!agentId) throw new Error("Agent ID required");

    const agent = await prisma.agent.update({
      where: { id: agentId },
      data: { status: "RUNNING" },
    });

    // If there's a task to run, it will be picked up by TaskEngine
    if (config.taskDescription) {
      // Create a task for the agent
      const missionId = config.missionId as string;
      if (missionId) {
        await prisma.task.create({
          data: {
            missionId,
            description: (config.taskDescription as string) || "Automated task",
            status: "QUEUED",
            ownerAgentId: agentId,
            priority: config.priority as number || 0,
          },
        });
      }
    }

    return { agentId: agent.id, status: "RUNNING" };
  }

  private async callTool(config: Record<string, unknown>, context: Record<string, unknown>): Promise<any> {
    const toolId = config.toolId as string;
    if (!toolId) throw new Error("Tool ID required");

    const agentId = config.agentId as string;
    const input = config.input || {};

    return await executeTool(toolId, input, agentId);
  }

  private async callApi(config: Record<string, unknown>, context: Record<string, unknown>): Promise<any> {
    const connectorId = config.connectorId as string;
    const endpointPath = config.path as string;
    const method = (config.method as string) || "GET";
    const body = config.body;
    const headers = config.headers || {};

    if (!connectorId || !endpointPath) throw new Error("Connector ID and path required");

    // Fetch connector for auth
    const connector = await prisma.connector.findUnique({ where: { id: connectorId } });
    if (!connector) throw new Error("Connector not found");

    const authConfig = JSON.parse(connector.authConfig || "{}");
    const baseUrl = connector.baseUrl || "";

    // Build auth headers
    const requestHeaders: Record<string, string> = { ...headers };
    if (connector.authType === "API_KEY") {
      const apiKey = await getSecret("connector", `CONNECTOR_${connectorId}_API_KEY`);
      if (apiKey) requestHeaders["Authorization"] = `Bearer ${apiKey}`;
    } else if (connector.authType === "BEARER") {
      const token = await getSecret("connector", `CONNECTOR_${connectorId}_TOKEN`);
      if (token) requestHeaders["Authorization"] = `Bearer ${token}`;
    } else if (connector.authType === "BASIC") {
      const credentials = await getSecret("connector", `CONNECTOR_${connectorId}_CREDENTIALS`);
      if (credentials) requestHeaders["Authorization"] = `Basic ${credentials}`;
    }

    const url = `${baseUrl}${endpointPath}`;
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return { response: data, status: response.status };
  }

  private async sendWebhook(config: Record<string, unknown>, context: Record<string, unknown>): Promise<any> {
    const url = config.url as string;
    const method = (config.method as string) || "POST";
    const payload = config.payload || context;
    const headers = config.headers || {};

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json().catch(() => ({}));
    return { response: data, status: response.status };
  }

  private async writeMemory(config: Record<string, unknown>, context: Record<string, unknown>): Promise<any> {
    const memory = await prisma.memory.create({
      data: {
        content: (config.content as string) || JSON.stringify(context),
        importance: config.importance as number || 0.5,
        source: "automation",
        scope: (config.scope as string) || "GLOBAL",
        subjectId: config.subjectId as string,
        subjectType: config.subjectType as string,
        confidence: config.confidence as number || 1.0,
        expiresAt: config.expiresAt ? new Date(config.expiresAt as string) : undefined,
      },
    });

    return { memoryId: memory.id };
  }

  private async notifyUser(config: Record<string, unknown>, context: Record<string, unknown>): Promise<any> {
    const message = (config.message as string) || "Automation notification";
    const severity = (config.severity as string) || "info";

    await eventBus.emit({
      type: "user.notification",
      source: "automation-engine",
      payload: { message, severity, context },
    });

    // Also could send via email/slack/etc if configured
    return { notified: true, message, severity };
  }
}

// Singleton
export const actionEngine = new ActionEngine();