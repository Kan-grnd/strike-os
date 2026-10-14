/**
 * Mission plan types + parsing.
 *
 * Client-safe: no server-only imports, so it can be used from both the
 * MissionEngine (server) and mission pages ("use client").
 *
 * A mission plan is stored on Mission.plan as JSON. Two shapes exist:
 *   - legacy: a bare PlanStep[] array
 *   - current: { steps, simulated, planner, model?, provider?, ... }
 * parseMissionPlan() accepts both.
 */

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

export type PlanPlanner = "llm" | "simulated" | "unknown";

export interface MissionPlan {
  steps: PlanStep[];
  simulated: boolean;
  planner: PlanPlanner;
  model?: string;
  provider?: string;
  generatedAt?: string;
  note?: string;
}

export const EMPTY_PLAN: MissionPlan = { steps: [], simulated: false, planner: "unknown" };

/** Tolerant parse of a stored plan (object, legacy array, JSON string, or null). */
export function parseMissionPlan(raw: unknown): MissionPlan {
  if (raw == null) return EMPTY_PLAN;

  let value: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "{}" || trimmed === "[]") return EMPTY_PLAN;
    try {
      value = JSON.parse(trimmed);
    } catch {
      return EMPTY_PLAN;
    }
  }

  if (Array.isArray(value)) {
    return { steps: normalizeSteps(value), simulated: false, planner: "unknown" };
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const planner: PlanPlanner =
      obj.planner === "llm" || obj.planner === "simulated" ? (obj.planner as PlanPlanner) : "unknown";
    return {
      steps: normalizeSteps(obj.steps),
      simulated: obj.simulated === true,
      planner,
      model: typeof obj.model === "string" ? obj.model : undefined,
      provider: typeof obj.provider === "string" ? obj.provider : undefined,
      generatedAt: typeof obj.generatedAt === "string" ? obj.generatedAt : undefined,
      note: typeof obj.note === "string" ? obj.note : undefined,
    };
  }

  return EMPTY_PLAN;
}

export function normalizeSteps(input: unknown): PlanStep[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s, i) => ({
      step: typeof s.step === "number" ? s.step : i + 1,
      description:
        typeof s.description === "string" && s.description.trim() ? s.description : `Step ${i + 1}`,
      agentType:
        typeof s.agentType === "string" && s.agentType.trim() ? s.agentType : "WORKER",
      agentId: typeof s.agentId === "string" ? s.agentId : undefined,
      dependencies: Array.isArray(s.dependencies) ? s.dependencies.map(String) : undefined,
      tools: Array.isArray(s.tools) ? s.tools.map(String) : undefined,
      estimatedDuration: typeof s.estimatedDuration === "number" ? s.estimatedDuration : 15000,
      estimatedCost: typeof s.estimatedCost === "number" ? s.estimatedCost : 0.002,
    }));
}

/**
 * A plan produced WITHOUT a model. Deliberately generic and explicitly
 * labelled (simulated: true) — it never pretends to have understood the goal.
 * Only used when no model provider is configured.
 */
export function simulatedPlan(goal: string): PlanStep[] {
  const g = goal.trim();
  const short = g.length > 90 ? `${g.slice(0, 87)}…` : g;
  return [
    {
      step: 1,
      description: `Interpret the goal and gather required context: ${short || "the mission goal"}`,
      agentType: "WORKER",
      estimatedDuration: 12000,
      estimatedCost: 0.001,
    },
    {
      step: 2,
      description: "Execute the primary work for the goal",
      agentType: "SPECIALIST",
      dependencies: ["1"],
      estimatedDuration: 20000,
      estimatedCost: 0.003,
    },
    {
      step: 3,
      description: "Verify the results and report the outcome",
      agentType: "SPECIALIST",
      dependencies: ["2"],
      estimatedDuration: 8000,
      estimatedCost: 0.001,
    },
  ];
}
