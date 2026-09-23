import type { AgentRuntime, ColonyRuntime, WorkforceRuntime } from "./types";

/**
 * Deterministic top-down layout engine.
 *
 * The STRIKE BRAIN is a fixed anchor near the top-center. Everything below is
 * derived: first the specialist territories (balanced columns beneath the
 * brain), then their agents, then sub-agents beneath their parent agent, then
 * transient operations beneath their responsible worker.
 *
 * Positions are derived from hierarchy + stable sibling ordering — never a
 * force simulation, never random. Adding/removing a worker only shifts its own
 * region; the brain never moves.
 */

export interface TopologyLayout {
  brain: { x: number; y: number };
  territories: Map<string, { x: number; y: number }>;
  agents: Map<string, { x: number; y: number }>;
  subAgents: Map<string, { x: number; y: number }>;
  operations: Map<string, { x: number; y: number }>;
}

const Y_BRAIN = 40;
const Y_SPECIALIST = 250;
const Y_AGENT = 430;
const AGENT_ROW_H = 120;
const SUB_STEP_Y = 150;
const OP_STEP_Y = 150;
const OP_STACK = 52;
const MAX_AGENTS_PER_ROW = 6;

/** Agents that are no longer part of the live workforce. */
const REMOVED_STATES = new Set(["cancelled", "stopped"]);

const gapFor = (narrow: boolean, kind: "territory" | "agent" | "sub" | "pad"): number => {
  if (narrow) {
    switch (kind) {
      case "territory":
        return 110;
      case "agent":
        return 140;
      case "sub":
        return 82;
      case "pad":
        return 34;
    }
  }
  switch (kind) {
    case "territory":
      return 150;
    case "agent":
      return 180;
    case "sub":
      return 110;
    case "pad":
      return 44;
  }
};

const territoryWidth = (rootCount: number, narrow: boolean): number => {
  const pad = gapFor(narrow, "pad");
  const agent = gapFor(narrow, "agent");
  const min = pad * 2;
  return Math.max(min, (rootCount - 1) * agent + min);
};

export function buildTopologyLayout(
  runtime: WorkforceRuntime,
  narrow = false
): TopologyLayout {
  const brain = { x: 0, y: Y_BRAIN };

  const liveColonies = runtime.colonies.filter((c) => c.status !== "ARCHIVED");
  const colonyIds = new Set(liveColonies.map((c) => c.id));
  const liveAgents = runtime.agents.filter(
    (a) => !REMOVED_STATES.has(a.runtimeState) && (!a.colonyId || colonyIds.has(a.colonyId)) && !a.parentId
  );
  const liveSubAgents = runtime.agents.filter(
    (a) => !REMOVED_STATES.has(a.runtimeState) && a.parentId && (!a.colonyId || colonyIds.has(a.colonyId))
  );

  // Ordering is preserved from the runtime (stable sibling ordering).
  const rootsByColony = new Map<string, AgentRuntime[]>();
  for (const agent of liveAgents) {
    if (!agent.colonyId) continue;
    const list = rootsByColony.get(agent.colonyId) ?? [];
    list.push(agent);
    rootsByColony.set(agent.colonyId, list);
  }

  // ── Specialist territory columns, balanced about the brain ──
  const territories = new Map<string, { x: number; y: number }>();
  const colonyX = new Map<string, number>();
  const widths = liveColonies.map((c) => territoryWidth((rootsByColony.get(c.id) ?? []).length, narrow));
  const territoryGap = gapFor(narrow, "territory");
  const total = widths.reduce((a, b) => a + b, 0) + territoryGap * Math.max(0, liveColonies.length - 1);
  let cursor = -total / 2;
  liveColonies.forEach((c, i) => {
    const w = widths[i];
    const cx = cursor + w / 2;
    colonyX.set(c.id, cx);
    territories.set(c.id, { x: cx, y: Y_SPECIALIST });
    cursor += w + territoryGap;
  });

  // ── Root agents, rowed beneath their territory ──
  const agents = new Map<string, { x: number; y: number }>();
  for (const c of liveColonies) {
    const cx = colonyX.get(c.id) ?? 0;
    const roots = rootsByColony.get(c.id) ?? [];
    const agentGap = gapFor(narrow, "agent");
    for (let r = 0; r * MAX_AGENTS_PER_ROW < roots.length; r += 1) {
      const chunk = roots.slice(r * MAX_AGENTS_PER_ROW, (r + 1) * MAX_AGENTS_PER_ROW);
      chunk.forEach((agent, j) => {
        agents.set(agent.id, {
          x: cx + (j - (chunk.length - 1) / 2) * agentGap,
          y: Y_AGENT + r * AGENT_ROW_H,
        });
      });
    }
  }

  // ── Sub-agents beneath their parent (BFS so parents resolve before children) ──
  const childrenOf = new Map<string, AgentRuntime[]>();
  for (const agent of liveSubAgents) {
    if (!agent.parentId) continue;
    const list = childrenOf.get(agent.parentId) ?? [];
    list.push(agent);
    childrenOf.set(agent.parentId, list);
  }
  const allAgentPos = new Map<string, { x: number; y: number }>(agents);

  const subAgents = new Map<string, { x: number; y: number }>();
  const subGap = gapFor(narrow, "sub");
  const queue: Array<{ pos: { x: number; y: number }; parentId: string }> = [];
  for (const [id, pos] of Array.from(agents.entries())) queue.push({ pos, parentId: id });
  while (queue.length > 0) {
    const { pos, parentId } = queue.shift() as { pos: { x: number; y: number }; parentId: string };
    const children = childrenOf.get(parentId) ?? [];
    children.forEach((child, k) => {
      const cPos = {
        x: pos.x + (k - (children.length - 1) / 2) * subGap,
        y: pos.y + SUB_STEP_Y,
      };
      subAgents.set(child.id, cPos);
      allAgentPos.set(child.id, cPos);
      queue.push({ pos: cPos, parentId: child.id });
    });
  }

  // ── Transient operations beneath their responsible worker ──
  const operations = new Map<string, { x: number; y: number }>();
  const opStack = new Map<string, number>();
  runtime.tasks.forEach((task) => {
    const stackIdx = opStack.get(task.ownerAgentId ?? "") ?? 0;
    if (task.ownerAgentId) {
      const ownerPos = allAgentPos.get(task.ownerAgentId);
      if (ownerPos) {
        operations.set(task.id, {
          x: ownerPos.x,
          y: ownerPos.y + OP_STEP_Y + stackIdx * OP_STACK,
        });
        opStack.set(task.ownerAgentId, stackIdx + 1);
        return;
      }
    }
    operations.set(task.id, {
      x: 0,
      y: Y_SPECIALIST + OP_STEP_Y + stackIdx * OP_STACK,
    });
  });

  return { brain, territories, agents, subAgents, operations };
}

export function specialistLabel(colony: ColonyRuntime): string {
  return colony.name.replace(/\s+Colony$/i, "").trim() || colony.name;
}