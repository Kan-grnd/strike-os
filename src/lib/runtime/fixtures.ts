"use client";

import * as React from "react";
import type { BrainState, WorkforceRuntime } from "./types";

/* Development-only fixture runtimes for states the live data cannot show
 * (brain roles, ring counts, colony sizes, error states, long text). Enabled
 * everywhere except production; the topology page ignores ?fixture= entirely
 * in a production build, and the orb gate asserts the guard below.
 *
 * Usage: /topology?fixture=brain-working&active=3
 *   brain: brain-working | brain-active | brain-blocked | brain-error | brain-idle
 *     active: 0..6 (default 6); total is always 6.
 *   scenes: colony-0|1|3|6|12|13|40-agents, three-colonies, error-agent,
 *     blocked-agent, unknown-role, agents-with-tasks, long-task-title, long-name
 */

export function isFixtureEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

const BRAIN_FIXTURE_STATE: Record<string, BrainState> = {
  "brain-working": "working",
  "brain-active": "operational",
  "brain-blocked": "degraded",
  "brain-error": "critical",
  "brain-idle": "offline",
};

export interface BrainFixtureSpec {
  state: BrainState;
  active: number;
  total: number;
}

/** Parse ?fixture=brain-<state>&active=<n>. Null when absent or disabled. */
export function parseBrainFixture(search: string): BrainFixtureSpec | null {
  if (!isFixtureEnabled()) return null;
  const params = new URLSearchParams(search);
  const state = BRAIN_FIXTURE_STATE[params.get("fixture") ?? ""];
  if (!state) return null;
  const raw = Number(params.get("active") ?? "6");
  const active = Number.isFinite(raw) ? Math.min(6, Math.max(0, Math.round(raw))) : 6;
  return { state, active, total: 6 };
}

/** Synthetic workforce: one colony, six agents, brain counts as specified. */
export function buildBrainFixtureRuntime(spec: BrainFixtureSpec): WorkforceRuntime {
  const at = new Date(Date.UTC(2026, 0, 1));
  return {
    brain: {
      state: spec.state,
      agentCount: spec.total,
      activeCount: spec.active,
      waitingCount: spec.total - spec.active,
      errorCount: 0,
      colonyCount: 1,
      missionCount: 2,
      operationCount: 0,
    },
    colonies: [
      { id: "fx-col", name: "Fixture Colony", status: "ACTIVE", agentIds: [], timestamps: { createdAt: at, updatedAt: at } },
    ],
    agents: Array.from({ length: spec.total }, (_, i) => ({
      id: `fx-ag-${i}`,
      name: `Fixture Agent ${i}`,
      type: "WORKER",
      colonyId: "fx-col",
      runtimeState: i < spec.active ? ("executing" as const) : ("idle" as const),
      models: [],
      capabilities: [],
      tools: [],
      permissions: [],
      successRate: 100,
      avgDuration: 1,
      totalCost: 1,
      createdAt: new Date(at.getTime() + i * 1000),
      updatedAt: at,
    })),
    tasks: [],
    relationships: [],
    recentEvents: [],
    system: { providerCount: 0, modelCount: 0, mcpCount: 0, memoryCount: 0 },
    generatedAt: new Date(),
  };
}

/** Page hook: synthetic runtime when a fixture is requested, else null.
 *  Applies after mount so the first client render matches SSR (no hydration
 *  mismatch): dev-only fixtures may flash live data for one frame. */
export function useFixtureRuntime(): WorkforceRuntime | null {
  const [runtime, setRuntime] = React.useState<WorkforceRuntime | null>(null);
  React.useEffect(() => {
    const spec = parseFixture(window.location.search);
    setRuntime(spec ? buildFixtureRuntime(spec) : null);
  }, []);
  return runtime;
}

export type FixtureSpec = BrainFixtureSpec | { scene: SceneName };

const SCENES = [
  "colony-0-agents",
  "colony-1-agents",
  "colony-3-agents",
  "colony-6-agents",
  "colony-12-agents",
  "colony-13-agents",
  "colony-40-agents",
  "three-colonies",
  "error-agent",
  "blocked-agent",
  "unknown-role",
  "agents-with-tasks",
  "long-task-title",
  "long-name",
  "pixel-row",
] as const;

export type SceneName = (typeof SCENES)[number];

/** Parse ?fixture=<brain-*|scene>. Null when absent or disabled. */
export function parseFixture(search: string): FixtureSpec | null {
  if (!isFixtureEnabled()) return null;
  const params = new URLSearchParams(search);
  const name = params.get("fixture") ?? "";
  if (BRAIN_FIXTURE_STATE[name]) {
    return parseBrainFixture(search);
  }
  if ((SCENES as readonly string[]).includes(name)) {
    return { scene: name as SceneName };
  }
  return null;
}

const AT = new Date(Date.UTC(2026, 0, 1));

function fxColony(id: string, name: string, status = "ACTIVE") {
  return { id, name, status, agentIds: [], timestamps: { createdAt: AT, updatedAt: AT } };
}

function fxAgent(
  id: string,
  colonyId: string,
  name: string,
  runtimeState: "executing" | "idle" | "waiting" | "failed" | "blocked" | "planning",
  extra: { parentId?: string; reason?: string; createdOffset?: number } = {}
) {
  return {
    id,
    name,
    type: "WORKER",
    colonyId,
    ...(extra.parentId ? { parentId: extra.parentId } : {}),
    runtimeState,
    ...(extra.reason ? { reason: extra.reason } : {}),
    models: [],
    capabilities: [],
    tools: [],
    permissions: [],
    successRate: 100,
    avgDuration: 1,
    totalCost: 1,
    createdAt: new Date(AT.getTime() + (extra.createdOffset ?? 0) * 1000),
    updatedAt: AT,
  };
}

function fxTask(id: string, ownerAgentId: string, description: string, status = "RUNNING") {
  return {
    id,
    missionId: "fx-m1",
    description,
    status,
    ownerAgentId,
    dependencies: [],
    retryCount: 0,
    maxRetries: 3,
    cost: 1,
    timestamps: { createdAt: AT, updatedAt: AT },
  };
}

function fxShell(
  colonies: ReturnType<typeof fxColony>[],
  agents: ReturnType<typeof fxAgent>[],
  tasks: ReturnType<typeof fxTask>[]
): WorkforceRuntime {
  const executing = agents.filter((a) => a.runtimeState === "executing").length;
  return {
    brain: {
      state: "working",
      agentCount: agents.filter((a) => !a.parentId).length,
      activeCount: executing,
      waitingCount: agents.length - executing,
      errorCount: 0,
      colonyCount: colonies.length,
      missionCount: 1,
      operationCount: tasks.length,
    },
    colonies: colonies as WorkforceRuntime["colonies"],
    agents: agents as unknown as WorkforceRuntime["agents"],
    tasks: tasks as unknown as WorkforceRuntime["tasks"],
    relationships: [],
    recentEvents: [],
    system: { providerCount: 0, modelCount: 0, mcpCount: 0, memoryCount: 0 },
    generatedAt: new Date(),
  };
}

/** Deterministic scene runtimes through the real layout/selectors path. */
export function buildSceneRuntime(scene: SceneName): WorkforceRuntime {
  const colonyCount = (n: number) =>
    fxShell(
      [fxColony("fx-col", "Fixture Colony")],
      Array.from({ length: n }, (_, i) =>
        fxAgent(`fx-ag-${i}`, "fx-col", `Fixture Agent ${i}`, i % 3 === 0 ? "executing" : "idle", { createdOffset: i })
      ),
      []
    );
  switch (scene) {
    case "colony-0-agents":
      return colonyCount(0);
    case "colony-1-agents":
      return colonyCount(1);
    case "colony-3-agents":
      return colonyCount(3);
    case "colony-6-agents":
      return colonyCount(6);
    case "colony-12-agents":
      return colonyCount(12);
    case "colony-13-agents":
      return colonyCount(13);
    case "colony-40-agents":
      return colonyCount(40);
    case "three-colonies":
      return fxShell(
        [fxColony("fx-a", "Alpha"), fxColony("fx-b", "Beta"), fxColony("fx-c", "Gamma")],
        ["fx-a", "fx-b", "fx-c"].flatMap((c, ci) => [
          fxAgent(`${c}-ag-0`, c, `Agent ${ci}-0`, "executing", { createdOffset: ci * 2 }),
          fxAgent(`${c}-ag-1`, c, `Agent ${ci}-1`, "idle", { createdOffset: ci * 2 + 1 }),
        ]),
        []
      );
    case "error-agent":
      return fxShell(
        [fxColony("fx-col", "Fixture Colony")],
        [
          fxAgent("fx-ok", "fx-col", "Steady Agent", "executing", { createdOffset: 0 }),
          fxAgent("fx-err", "fx-col", "Failing Agent", "failed", { createdOffset: 1 }),
        ],
        [fxTask("fx-t-err", "fx-err", "Doomed task", "FAILED")]
      );
    case "blocked-agent":
      return fxShell(
        [fxColony("fx-col", "Fixture Colony")],
        [
          fxAgent("fx-ok", "fx-col", "Steady Agent", "executing", { createdOffset: 0 }),
          fxAgent("fx-blocked", "fx-col", "Waiting Agent", "blocked", { createdOffset: 1, reason: "Waiting on Coder" }),
        ],
        []
      );
    case "unknown-role":
      return fxShell(
        [fxColony("fx-col", "Fixture Colony")],
        [fxAgent("fx-weird", "fx-col", "Translator", "executing", { createdOffset: 0 })],
        []
      );
    case "agents-with-tasks":
      return fxShell(
        [fxColony("fx-col", "Fixture Colony")],
        [
          fxAgent("fx-busy", "fx-col", "Busy Agent", "executing", { createdOffset: 0 }),
          fxAgent("fx-sub-0", "fx-col", "Helper Zero", "idle", { parentId: "fx-busy", createdOffset: 1 }),
          fxAgent("fx-sub-1", "fx-col", "Helper One", "idle", { parentId: "fx-busy", createdOffset: 2 }),
        ],
        [
          fxTask("fx-t-0", "fx-busy", "First chore", "RUNNING"),
          fxTask("fx-t-1", "fx-busy", "Second chore", "ASSIGNED"),
        ]
      );
    case "long-task-title":
      return fxShell(
        [fxColony("fx-col", "Fixture Colony")],
        [fxAgent("fx-ag", "fx-col", "Patient Agent", "executing", { createdOffset: 0 })],
        [
          fxTask(
            "fx-long",
            "fx-ag",
            "Investigate the competitor positioning across every public channel including the website, blog, changelog, docs, pricing page, status page, social accounts, conference talks, podcast appearances and customer reviews",
            "RUNNING"
          ),
        ]
      );
    case "long-name":
      return fxShell(
        [fxColony("fx-col", "Fixture Colony")],
        [
          fxAgent(
            "fx-long",
            "fx-col",
            "Alexandria Constantinople Worthington-Smythe the Third Esquire",
            "executing",
            { createdOffset: 0 }
          ),
        ],
        []
      );
    case "pixel-row":
      /* Reference sample data, verbatim (names, statuses, descriptions): the
       * visual-diff harness compares these nodes against the file's renders
       * with text blanked, so layout must not depend on the words. */
      return fxShell(
        [
          fxColony("px-research", "Research"),
          fxColony("px-engineering", "Engineering"),
        ],
        [
          fxAgent("px-researcher", "px-research", "Researcher", "executing", { createdOffset: 0 }),
          fxAgent("px-web", "px-research", "Web Analyst", "executing", { createdOffset: 1 }),
          fxAgent("px-src", "px-research", "Source Reviewer", "waiting", { createdOffset: 2 }),
          fxAgent("px-arch", "px-engineering", "Architect", "planning", { createdOffset: 3 }),
          fxAgent("px-coder", "px-engineering", "Coder", "executing", { createdOffset: 4 }),
          fxAgent("px-qa", "px-engineering", "QA", "blocked", { createdOffset: 5, reason: "Waiting on Coder" }),
          fxAgent("px-translator", "px-engineering", "Translator", "planning", { createdOffset: 6 }),
        ],
        [
          fxTask("px-t1", "px-researcher", "Research competitor public positioning", "RUNNING"),
          fxTask("px-t2", "px-arch", "Architect the report data model", "ASSIGNED"),
          fxTask("px-t3", "px-qa", "Validate report accuracy against sources", "QUEUED"),
        ]
      );
  }
}

export function buildFixtureRuntime(spec: FixtureSpec): WorkforceRuntime {
  if ("scene" in spec) return buildSceneRuntime(spec.scene);
  return buildBrainFixtureRuntime(spec);
}
