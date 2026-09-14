/**
 * Mission Engine — Phase 5
 *
 * Plans missions, manages lifecycle, generates tasks from plans.
 * Pattern-match planner (demo) + LLM stub (swap in Phase 7).
 */

import { PrismaClient } from "@prisma/client";
import { eventBus } from "./events";
import { TaskEngine } from "./task-engine";
import { setAgentState, pauseAgent, resumeAgent } from "./runtime-state";

export interface PlanStep {
  step: number;
  description: string;
  agentType: string;
  agentId?: string;
  dependencies?: string[]; // step numbers as strings
  tools?: string[];
  estimatedDuration: number; // ms
  estimatedCost: number;
}

// Simple pattern-matching planner
function patternMatchPlan(goal: string): PlanStep[] {
  const lower = goal.toLowerCase();
  const steps: PlanStep[] = [];
  let stepNum = 1;

  if (lower.includes("research") || lower.includes("monitor") || lower.includes("track")) {
    steps.push({
      step: stepNum++,
      description: "Discover relevant sources and collect initial data",
      agentType: "WORKER",
      estimatedDuration: 15000,
      estimatedCost: 0.002,
    });
    steps.push({
      step: stepNum++,
      description: "Extract and catalog metadata from collected sources",
      agentType: "WORKER",
      dependencies: ["1"],
      estimatedDuration: 12000,
      estimatedCost: 0.001,
    });
  }

  if (lower.includes("analyze") || lower.includes("analysis") || lower.includes("compare")) {
    steps.push({
      step: stepNum++,
      description: "Perform detailed analysis and pattern identification",
      agentType: "SPECIALIST",
      dependencies: steps.length ? ["1"] : [],
      estimatedDuration: 20000,
      estimatedCost: 0.003,
    });
  }

  if (lower.includes("alert") || lower.includes("notify") || lower.includes("watch")) {
    steps.push({
      step: stepNum++,
      description: "Configure change detection and alerting rules",
      agentType: "OBSERVER",
      dependencies: steps.length ? [String(steps.length)] : [],
      estimatedDuration: 8000,
      estimatedCost: 0.001,
    });
  }

  if (lower.includes("report") || lower.includes("summarize") || lower.includes("write")) {
    steps.push({
      step: stepNum++,
      description: "Generate summary report with key findings",
      agentType: "SPECIALIST",
      dependencies: steps.length ? [String(steps.length)] : [],
      estimatedDuration: 10000,
      estimatedCost: 0.002,
    });
  }

  if (lower.includes("code") || lower.includes("build") || lower.includes("implement")) {
    steps.push({
      step: stepNum++,
      description: "Implement required code changes",
      agentType: "SPECIALIST",
      estimatedDuration: 25000,
      estimatedCost: 0.005,
    });
  }

  // Fallback: at least one generic step
  if (steps.length === 0) {
    steps.push({
      step: 1,
      description: "Analyze requirements and gather context",
      agentType: "WORKER",
      estimatedDuration: 10000,
      estimatedCost: 0.001,
    });
    steps.push({
      step: 2,
      description: "Execute primary task and collect results",
      agentType: "SPECIALIST",
      dependencies: ["1"],
      estimatedDuration: 20000,
      estimatedCost: 0.003,
    });
    steps.push({
      step: 3,
      description: "Compile findings and present results",
      agentType: "SPECIALIST",
      dependencies: ["2"],
      estimatedDuration: 8000,
      estimatedCost: 0.001,
    });
  }

  return steps;
}

// LLM stub — swaps in real LLM in Phase 7
async function llmPlan(goal: string): Promise<PlanStep[]> {
  // For now, same as pattern match but ready for real implementation
  return patternMatchPlan(goal);
}

export class MissionEngine {
  private taskEngine: TaskEngine;

  constructor(db: PrismaClient, taskEngine: TaskEngine) {
    this.taskEngine = taskEngine;
  }

  async planMission(goal: string, useLlm = false): Promise<PlanStep[]> {
    return useLlm ? llmPlan(goal) : patternMatchPlan(goal);
  }

  async createMission(
    db: PrismaClient,
    goal: string,
    planSteps: PlanStep[],
    agentIds: string[],
    priority = 0,
  ) {
    // Assign agents to steps based on type matching
    const agents = await db.agent.findMany({ where: { id: { in: agentIds } } });
    const agentByType: Record<string, string[]> = {};
    agents.forEach((a) => {
      if (!agentByType[a.type]) agentByType[a.type] = [];
      agentByType[a.type].push(a.id);
    });

    const mission = await db.mission.create({
      data: {
        goal,
        status: "READY",
        plan: JSON.stringify(planSteps),
        agentIds: JSON.stringify(agentIds),
        priority,
      },
    });

    // Create tasks for each step
    const createdTasks: { id: string; step: number }[] = [];
    for (const step of planSteps) {
      // Resolve which agent owns this step
      const candidates = agentByType[step.agentType] || agentByType["SPECIALIST"] || agentIds;
      const ownerAgentId = candidates[0] || agentIds[0];

      const task = await db.task.create({
        data: {
          missionId: mission.id,
          description: step.description,
          status: "QUEUED",
          input: JSON.stringify({ step: step.step, estimatedDuration: step.estimatedDuration }),
          ownerAgentId,
          dependencies: JSON.stringify(
            (step.dependencies || []).map((dep) => {
              const found = createdTasks.find((t) => String(t.step) === dep);
              return found?.id;
            }).filter(Boolean),
          ),
          priority,
          timeout: step.estimatedDuration * 3 || 60000,
        },
      });

      createdTasks.push({ id: task.id, step: step.step });

      await eventBus.emit({
        type: "task.created",
        source: "mission-engine",
        subject: "task",
        subjectId: task.id,
        taskId: task.id,
        missionId: mission.id,
        agentId: ownerAgentId,
        payload: { description: task.description, step: step.step },
      });
    }

    await eventBus.emit({
      type: "mission.created",
      source: "mission-engine",
      subject: "mission",
      subjectId: mission.id,
      missionId: mission.id,
      payload: { goal: mission.goal, taskCount: createdTasks.length },
    });

    return mission;
  }

  async startMission(db: PrismaClient, missionId: string) {
    const mission = await db.mission.findUnique({ where: { id: missionId } });
    if (!mission) throw new Error("Mission not found");
    if (!["READY", "PLANNING"].includes(mission.status)) throw new Error(`Mission is ${mission.status}, cannot start`);

    await db.mission.update({
      where: { id: missionId },
      data: { status: "RUNNING" },
    });

    await eventBus.emit({
      type: "mission.started",
      source: "mission-engine",
      subject: "mission",
      subjectId: mission.id,
      missionId: mission.id,
      payload: { goal: mission.goal },
    });
  }

  async pauseMission(db: PrismaClient, missionId: string) {
    const mission = await db.mission.findUnique({ where: { id: missionId } });
    if (!mission) throw new Error("Mission not found");
    if (mission.status !== "RUNNING") throw new Error(`Mission is ${mission.status}, cannot pause`);

    // Pause all RUNNING tasks
    await db.task.updateMany({
      where: { missionId, status: "RUNNING" },
      data: { status: "WAITING" },
    });

    await db.mission.update({
      where: { id: missionId },
      data: { status: "PAUSED" },
    });

    // Pause the agents executing this mission so the topology reflects it
    const missionAgents = await db.task.findMany({
      where: { missionId, ownerAgentId: { not: null } },
      select: { ownerAgentId: true },
      distinct: ["ownerAgentId"],
    });
    for (const t of missionAgents) {
      if (t.ownerAgentId) await pauseAgent(t.ownerAgentId, { reason: "mission paused", source: "mission-engine" });
    }

    await eventBus.emit({
      type: "mission.paused",
      source: "mission-engine",
      subject: "mission",
      subjectId: mission.id,
      missionId: mission.id,
      payload: { goal: mission.goal },
    });
  }

  async resumeMission(db: PrismaClient, missionId: string) {
    const mission = await db.mission.findUnique({ where: { id: missionId } });
    if (!mission) throw new Error("Mission not found");
    if (mission.status !== "PAUSED") throw new Error(`Mission is ${mission.status}, cannot resume`);

    // Resume WAITING tasks back to QUEUED
    await db.task.updateMany({
      where: { missionId, status: "WAITING" },
      data: { status: "QUEUED" },
    });

    await db.mission.update({
      where: { id: missionId },
      data: { status: "RUNNING" },
    });

    const missionAgents = await db.task.findMany({
      where: { missionId, ownerAgentId: { not: null } },
      select: { ownerAgentId: true },
      distinct: ["ownerAgentId"],
    });
    for (const t of missionAgents) {
      if (t.ownerAgentId) await resumeAgent(t.ownerAgentId, { reason: "mission resumed", source: "mission-engine" });
    }

    await eventBus.emit({
      type: "mission.resumed",
      source: "mission-engine",
      subject: "mission",
      subjectId: mission.id,
      missionId: mission.id,
      payload: { goal: mission.goal, resumedFrom: "PAUSED" },
    });
  }

  async cancelMission(db: PrismaClient, missionId: string) {
    const cancelledTasks = await db.task.findMany({
      where: { missionId, status: { in: ["QUEUED", "ASSIGNED", "RUNNING", "WAITING"] } },
      select: { id: true, ownerAgentId: true },
    });

    await db.task.updateMany({
      where: { missionId, status: { in: ["QUEUED", "ASSIGNED", "RUNNING", "WAITING"] } },
      data: { status: "CANCELLED" },
    });

    await db.mission.update({
      where: { id: missionId },
      data: { status: "CANCELLED", completedAt: new Date() },
    });

    for (const t of cancelledTasks) {
      if (t.ownerAgentId) {
        await setAgentState(t.ownerAgentId, "cancelled", {
          reason: "mission cancelled",
          taskId: t.id,
          missionId,
          source: "mission-engine",
        });
      }
    }

    await eventBus.emit({
      type: "mission.cancelled",
      source: "mission-engine",
      subject: "mission",
      subjectId: missionId,
      missionId,
      payload: {},
    });
  }

  async checkCompletion(db: PrismaClient, missionId: string) {
    const mission = await db.mission.findUnique({ where: { id: missionId } });
    if (!mission || mission.status !== "RUNNING") return;

    const tasks = await db.task.findMany({ where: { missionId } });
    const allDone = tasks.every((t) => ["COMPLETED", "FAILED", "CANCELLED"].includes(t.status));
    const anyFailed = tasks.some((t) => t.status === "FAILED");
    const allCancelled = tasks.every((t) => t.status === "CANCELLED");

    if (allDone) {
      const status = anyFailed ? "FAILED" : allCancelled ? "CANCELLED" : "COMPLETED";
      const totalCost = tasks.reduce((sum, t) => sum + t.cost, 0);

      await db.mission.update({
        where: { id: missionId },
        data: {
          status,
          completedAt: new Date(),
          totalCost,
        },
      });

      // Reflect completion in agent lifecycle (only for the executors)
      const executors = await db.task.findMany({
        where: { missionId, ownerAgentId: { not: null } },
        select: { ownerAgentId: true },
        distinct: ["ownerAgentId"],
      });
      for (const t of executors) {
        if (!t.ownerAgentId) continue;
        if (status === "COMPLETED") {
          await setAgentState(t.ownerAgentId, "completed", {
            reason: "mission completed",
            missionId,
            source: "mission-engine",
          }).catch(() => undefined);
        } else {
          await setAgentState(t.ownerAgentId, "failed", {
            reason: "mission ended with failures",
            missionId,
            source: "mission-engine",
          }).catch(() => undefined);
        }
      }

      await eventBus.emit({
        type: status === "COMPLETED" ? "mission.completed" : "mission.failed",
        source: "mission-engine",
        subject: "mission",
        subjectId: mission.id,
        missionId: mission.id,
        payload: { goal: mission.goal, totalCost, taskCount: tasks.length },
      });
    }
  }
}
