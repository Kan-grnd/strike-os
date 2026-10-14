/**
 * Mission Engine — Phase 5
 *
 * Plans missions, manages lifecycle, and materializes plans into tasks.
 *
 * Planner: a real ModelGateway call (structured JSON). When no model provider
 * is configured the engine returns an explicitly-labelled simulated plan —
 * never a silent fallback disguised as real output. A configured provider that
 * fails to plan throws, so the caller surfaces the error and no mission runs.
 */

import { PrismaClient } from "@prisma/client";
import { eventBus } from "./events";
import { TaskEngine } from "./task-engine";
import { ModelGateway } from "./model-gateway";
import { hasConfiguredProvider } from "./providers/config";
import { PlanStep, MissionPlan, parseMissionPlan, normalizeSteps, simulatedPlan } from "./plan";
import { setAgentState, pauseAgent, resumeAgent, spawnAgent } from "./runtime-state";
import { settleMissionIfComplete } from "./completion";
import { setBrainState, BRAIN_ID } from "./brain";
import { resolveSpawnCeiling } from "./spawn-policy";
import { requestApproval } from "./approvals";

export type { PlanStep } from "./plan";
export { parseMissionPlan, simulatedPlan } from "./plan";

export interface MissionPlanResult {
  steps: PlanStep[];
  simulated: boolean;
  planner: "llm" | "simulated";
  model?: string;
  provider?: string;
  cost?: number;
  durationMs?: number;
  note?: string;
}

const PLANNER_MODEL = "auto/best-coding";
const DEFAULT_AGENT_TYPES = ["WORKER", "SPECIALIST", "OBSERVER"];

const PLANNER_SYSTEM_PROMPT = [
  "You are the mission planner for an autonomous agent workforce.",
  "Decompose the operator's goal into a short, ordered list of concrete, executable steps.",
  "Return ONLY a JSON object of the form {\"steps\": Step[]} with no prose and no markdown fences.",
  "Step shape: {",
  '  "step": number,',
  '  "description": string,',
  '  "agentType": string (prefer one of the available agent types, otherwise "WORKER"),',
  '  "dependencies": string[] (step numbers this step must wait for; [] if none),',
  '  "estimatedDuration": number (milliseconds, between 1000 and 120000),',
  '  "estimatedCost": number (USD, between 0.0001 and 1)',
  "}",
  "Produce between 2 and 8 steps. Use a linear dependency chain unless steps can genuinely run in parallel.",
].join("\n");

function buildPlannerUserPrompt(goal: string, agentTypes: string[]): string {
  return [
    `Mission goal: ${goal}`,
    "",
    `Available agent types: ${agentTypes.join(", ")}`,
    "Plan the mission now.",
  ].join("\n");
}

/** Extract and validate the plan from a model response. Throws on garbage. */
function parsePlanStepsFromModel(content: string): PlanStep[] {
  let text = (content || "").trim();
  // Strip markdown fences if the model added them.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  // Fall back to the outermost JSON object/array in the response.
  if (!text.startsWith("{") && !text.startsWith("[")) {
    const objStart = text.indexOf("{");
    const arrStart = text.indexOf("[");
    const starts = [objStart, arrStart].filter((i) => i >= 0);
    if (starts.length) {
      const start = Math.min(...starts);
      const endObj = text.lastIndexOf("}");
      const endArr = text.lastIndexOf("]");
      const end = Math.max(endObj, endArr);
      if (end > start) text = text.slice(start, end + 1);
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Planner returned invalid JSON");
  }

  const rawSteps =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).steps
      : parsed;

  const steps = normalizeSteps(rawSteps);
  if (steps.length === 0) throw new Error("Planner returned an empty plan");
  return steps;
}

export class MissionEngine {
  private db: PrismaClient;
  private taskEngine: TaskEngine;
  private gateway: ModelGateway;

  constructor(db: PrismaClient, taskEngine: TaskEngine, gateway: ModelGateway) {
    this.db = db;
    this.taskEngine = taskEngine;
    this.gateway = gateway;
  }

  /**
   * Plan a mission. Real model call when a provider is configured; otherwise a
   * clearly-labelled simulated plan. A configured provider that fails throws.
   */
  async planMission(goal: string): Promise<MissionPlanResult> {
    await setBrainState("planning", { detail: goal, decision: "Planning mission" });
    if (!(await hasConfiguredProvider())) {
      const steps = simulatedPlan(goal);
      await setBrainState("idle", {
        detail: goal,
        decision: `Planned ${steps.length} steps (simulated)`,
      });
      return {
        steps,
        simulated: true,
        planner: "simulated",
        note: "No model provider configured — this is a placeholder plan, not a model-generated one.",
      };
    }

    const agents = await this.db.agent.findMany({ select: { type: true } });
    const agentTypes = Array.from(new Set(agents.map((a) => a.type).filter(Boolean)));
    const availableTypes = agentTypes.length ? agentTypes : DEFAULT_AGENT_TYPES;

    const response = await this.gateway.call({
      model: PLANNER_MODEL,
      messages: [
        { role: "system", content: PLANNER_SYSTEM_PROMPT },
        { role: "user", content: buildPlannerUserPrompt(goal, availableTypes) },
      ],
      temperature: 0.2,
      maxTokens: 2000,
    });

    const steps = parsePlanStepsFromModel(response.content);
    await setBrainState("idle", {
      detail: goal,
      decision: `Planned ${steps.length} steps`,
    });
    return {
      steps,
      simulated: false,
      planner: "llm",
      model: response.model,
      provider: response.provider,
      cost: response.cost,
      durationMs: response.duration,
    };
  }

  /** Parse the mission's agentIds JSON into a string[]. */
  private agentIdsFromMission(mission: { agentIds?: string | null }): string[] {
    try {
      const ids = JSON.parse(mission.agentIds || "[]");
      return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }

  /**
   * Ensure the mission has a run (Operation) and its plan materialized into
   * tasks. Idempotent: reuses the latest operation, and only creates tasks when
   * none exist yet (materialize-at-start).
   */
  private async ensureOperationAndTasks(
    db: PrismaClient,
    mission: { id: string; plan: string; policy: string; agentIds?: string | null; priority: number },
  ): Promise<{ operationId: string; createdTasks: number }> {
    let operation = await db.operation.findFirst({
      where: { missionId: mission.id },
      orderBy: { createdAt: "desc" },
    });
    if (!operation) {
      operation = await db.operation.create({
        data: {
          missionId: mission.id,
          status: "PLANNING",
          plan: mission.plan,
          policy: mission.policy,
          priority: mission.priority,
        },
      });
    }

    let createdTasks = 0;
    const existing = await db.task.count({ where: { missionId: mission.id } });
    if (existing === 0) {
      const plan: MissionPlan = parseMissionPlan(mission.plan);
      if (plan.steps.length > 0) {
        createdTasks = await this.materializePlan(
          db,
          mission.id,
          operation.id,
          plan.steps,
          this.agentIdsFromMission(mission),
          mission.priority,
          resolveSpawnCeiling(mission.policy),
        );
      }
    }

    return { operationId: operation.id, createdTasks };
  }

  /** Create a mission (READY) and materialize its plan into an operation + tasks. */
  async createMission(
    db: PrismaClient,
    goal: string,
    planSteps: PlanStep[],
    agentIds: string[],
    priority = 0,
  ) {
    const mission = await db.mission.create({
      data: {
        goal,
        status: "READY",
        plan: JSON.stringify({ steps: planSteps, simulated: false, planner: "unknown" }),
        agentIds: JSON.stringify(agentIds),
        priority,
      },
    });

    const { createdTasks: created } = await this.ensureOperationAndTasks(db, mission);

    await eventBus.emit({
      type: "mission.created",
      source: "mission-engine",
      subject: "mission",
      subjectId: mission.id,
      missionId: mission.id,
      payload: { goal: mission.goal, taskCount: created },
    });

    return mission;
  }

  /**
   * Create tasks for a plan, linked to the operation (run) they belong to.
   * Returns the number of tasks created.
   * Owners are resolved by matching step.agentType to an available agent;
   * steps with no matching agent run unowned (the runner does not require one).
   */
  private async materializePlan(
    db: PrismaClient,
    missionId: string,
    operationId: string,
    steps: PlanStep[],
    agentIds: string[] = [],
    priority = 0,
    spawnCeiling = resolveSpawnCeiling(undefined),
  ): Promise<number> {
    const agents = await db.agent.findMany(
      agentIds.length ? { where: { id: { in: agentIds } } } : undefined,
    );
    const byType: Record<string, string[]> = {};
    for (const a of agents) {
      (byType[a.type] ||= []).push(a.id);
    }
    let anyAgent = agents[0]?.id;

    // The ceiling is per-mission across its whole life, so count spawns already
    // recorded for this mission rather than only what this call creates.
    let spawnsUsed = await db.event.count({ where: { type: "agent.spawned", missionId } });

    const created: { id: string; step: number }[] = [];
    for (const step of steps) {
      let ownerAgentId =
        (step.agentId && agents.find((a) => a.id === step.agentId)?.id) ||
        byType[step.agentType]?.[0] ||
        byType["SPECIALIST"]?.[0] ||
        anyAgent ||
        null;

      const task = await db.task.create({
        data: {
          missionId,
          parentOperationId: operationId,
          description: step.description,
          status: "QUEUED",
          input: JSON.stringify({ step: step.step, estimatedDuration: step.estimatedDuration }),
          ownerAgentId,
          dependencies: JSON.stringify(
            (step.dependencies || [])
              .map((dep) => created.find((t) => String(t.step) === dep)?.id)
              .filter(Boolean),
          ),
          priority,
          timeout: step.estimatedDuration ? step.estimatedDuration * 3 : 60000,
        },
      });

      created.push({ id: task.id, step: step.step });

      // No existing agent can take this step — the Brain spawns the capacity it
      // needs up to the mission's ceiling. Past the ceiling it does not silently
      // give up: the spawn becomes a real gate (D17/M3.1) — the affected
      // operation pauses and the operator is asked to allow the extra worker.
      if (!ownerAgentId) {
        if (spawnsUsed >= spawnCeiling) {
          await eventBus.emit({
            type: "spawn.denied",
            source: "mission-engine",
            subject: "mission",
            subjectId: missionId,
            missionId,
            taskId: task.id,
            payload: {
              reason: "spawn ceiling reached",
              ceiling: spawnCeiling,
              step: step.step,
              agentType: step.agentType ?? "WORKER",
            },
          });
          await requestApproval(db, {
            trigger: "SPAWN_CEILING",
            scope: "OPERATION",
            missionId,
            operationId,
            taskId: task.id,
            description: `Step ${step.step} needs a sub-agent, but the mission's spawn ceiling (${spawnCeiling}) is reached.`,
            metadata: {
              step: step.step,
              agentType: step.agentType ?? "WORKER",
              parentAgentId: anyAgent ?? null,
            },
          }).catch((err) => console.error("[mission-engine] spawn gate failed:", err));
        } else {
          try {
            const spawned = await spawnAgent({
              name: `${step.agentType || "WORKER"} · ${step.description.slice(0, 40)}`,
              type: step.agentType || "WORKER",
              description: `Sub-agent spawned for mission step ${step.step}`,
              /* Parent off a real, loaded agent only — `agentIds` may name agents
               * that do not exist, and a bad parentId is an FK violation. */
              parentId: anyAgent || undefined,
              missionId,
              source: "mission-engine",
            });
            ownerAgentId = spawned?.id ?? null;
            if (ownerAgentId) {
              (byType[step.agentType] ||= []).push(ownerAgentId);
              anyAgent = anyAgent ?? ownerAgentId;
              spawnsUsed += 1;
              await db.task.update({ where: { id: task.id }, data: { ownerAgentId } });
            }
          } catch (err) {
            // A spawn failure must not abort the mission — the step just runs
            // unowned, exactly as it would have without the spawn attempt.
            console.error("[mission-engine] sub-agent spawn failed:", err);
          }
        }
      }

      await eventBus.emit({
        type: "task.created",
        source: "mission-engine",
        subject: "task",
        subjectId: task.id,
        taskId: task.id,
        missionId,
        agentId: ownerAgentId || undefined,
        payload: { description: task.description, step: step.step },
      });
    }

    return created.length;
  }

  async startMission(db: PrismaClient, missionId: string) {
    const mission = await db.mission.findUnique({ where: { id: missionId } });
    if (!mission) throw new Error("Mission not found");
    if (!["READY", "PLANNING"].includes(mission.status)) throw new Error(`Mission is ${mission.status}, cannot start`);

    // Materialize the stored plan into tasks the first time the mission runs,
    // and open its run (Operation).
    const { operationId, createdTasks } = await this.ensureOperationAndTasks(db, mission);

    // A gate may have fired during materialization (e.g. a spawn past the
    // ceiling). If so the run starts paused, awaiting the operator — do not
    // force it RUNNING over an outstanding approval.
    const gated =
      (await db.approval.count({
        where: {
          status: "PENDING",
          OR: [{ operationId }, { missionId }],
        },
      })) > 0;

    if (gated) {
      await db.mission.update({ where: { id: missionId }, data: { status: "PAUSED" } });
    } else {
      await db.operation.update({
        where: { id: operationId },
        data: { status: "RUNNING", startedAt: new Date() },
      });

      await db.mission.update({
        where: { id: missionId },
        data: { status: "RUNNING" },
      });
    }

    await eventBus.emit({
      type: "mission.started",
      source: "mission-engine",
      subject: "mission",
      subjectId: mission.id,
      missionId: mission.id,
      payload: { goal: mission.goal, taskCount: createdTasks, operationId },
    });

    await setBrainState("delegating", {
      missionId: mission.id,
      detail: mission.goal,
      decision: `Launched mission — ${createdTasks} task${createdTasks === 1 ? "" : "s"} delegated`,
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

    await db.operation.updateMany({
      where: { missionId, status: { in: ["PLANNING", "RUNNING"] } },
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
        await eventBus.emit({
          type: "delegation.completed",
          source: "mission-engine",
          subject: "delegation",
          subjectId: t.ownerAgentId,
          taskId: t.id,
          missionId,
          agentId: t.ownerAgentId,
          payload: { from: BRAIN_ID, to: t.ownerAgentId },
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
    await settleMissionIfComplete(db, missionId);
  }
}
