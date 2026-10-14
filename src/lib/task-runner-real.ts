/**
 * Real Task Runner — Phase 7
 * Replaces MockTaskRunner with actual AI calls via ModelGateway.
 */

import { ModelGateway } from "./model-gateway";
import { TaskRunner, TaskResult } from "./task-engine";
import prisma from "@/lib/db";
import { resolveModelPolicy } from "./model-policy";

export class RealTaskRunner implements TaskRunner {
  private gateway: ModelGateway;

  constructor(gateway: ModelGateway) {
    this.gateway = gateway;
  }

  async execute(taskId: string): Promise<TaskResult> {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new Error(`Task ${taskId} not found`);

    const agent = task.ownerAgentId
      ? await prisma.agent.findUnique({ where: { id: task.ownerAgentId } })
      : null;

    // Build the prompt from task input
    const prompt = this.buildPrompt(task, agent);

    // Resolve the model policy down the task → operation → mission → agent chain.
    const [operation, mission] = await Promise.all([
      task.parentOperationId
        ? prisma.operation.findUnique({ where: { id: task.parentOperationId } })
        : Promise.resolve(null),
      prisma.mission.findUnique({ where: { id: task.missionId } }),
    ]);
    const policy = resolveModelPolicy({ task, operation, mission, agent });
    const primaryModelId = policy.primary;
    const fallbackChain = policy.fallback;

    // No silent degradation: if every provider fails the error propagates and
    // the task is marked FAILED. Recovery is M3.2 — never a fake success.
    const start = Date.now();
    const response = await this.gateway.call(
      {
        model: primaryModelId,
        messages: [
          { role: "system", content: this.getSystemPrompt(agent) },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        maxTokens: 4096,
      },
      {
        primaryModelId,
        fallbackChain,
      }
    );
    const duration = Date.now() - start;

    return {
      output: {
        result: response.content,
        simulated: false,
        metadata: {
          model: response.model,
          provider: response.provider,
          tokens: response.usage,
          toolCalls: response.toolCalls,
        },
      },
      cost: response.cost,
      duration,
    };
  }

  private buildPrompt(task: any, agent: any | null): string {
    const input = JSON.parse(task.input || "{}");
    const capabilities = agent ? JSON.parse(agent.capabilities || "[]") : [];
    const tools = agent ? JSON.parse(agent.tools || "[]") : [];

    return `
Task: ${task.description}
Input: ${JSON.stringify(input, null, 2)}
Agent Capabilities: ${capabilities.join(", ") || "none"}
Available Tools: ${tools.join(", ") || "none"}
Agent Type: ${agent?.type || "WORKER"}

Execute this task and return a structured JSON response with your findings/results.
`.trim();
  }

  private getSystemPrompt(agent: any | null): string {
    const type = agent?.type || "WORKER";
    const base = `You are a ${type.toLowerCase()} agent in the Strike OS workforce.`;
    const instructions = `
- Execute the given task precisely
- Use available tools when helpful
- Return structured JSON responses
- Be concise but thorough
- If uncertain, note assumptions in your response
`.trim();
    return base + "\n" + instructions;
  }
}
