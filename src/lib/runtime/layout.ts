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
const Y_SPECIALIST = 232;
const Y_AGENT = 400;
const MAX_AGENTS_PER_ROW = 6;

/* Card heights measured in a real browser at 1440px, on the *tallest* content
 * variant (a worker whose action row wraps because it shows both toggles next
 * to a long name). Fixed row steps used to be smaller than the cards they hold
 * (operation stack 68px vs a 117px card), so stacked operations and nested
 * sub-agents overlapped. Every step below is measured-height + GAP, and each
 * worker reserves exactly the depth its own subtree needs, so siblings can never
 * collide no matter how the content grows.
 * Measured with /tmp/opencode/measure_worst.py. */
const WORKER_CARD_H = 161;
const OP_CARD_H = 117;
const GAP = 20;
const LEVEL_H = WORKER_CARD_H + GAP; // worker row -> its sub-agent row
const OP_STACK = OP_CARD_H + GAP; // one operation -> the next under the same owner


/** Agents that are no longer part of the live workforce. */
const REMOVED_STATES = new Set(["cancelled", "stopped"]);

/** Rendered card widths (Tailwind w-72 / w-64 / w-60 / w-48), in px. */
const CARD_W = {
  brain: 288,
  specialist: 256,
  agent: 256,
  sub: 240,
  operation: 192,
} as const;

/** Visible breathing room between two cards. */
const GUTTER = 24;

/** How many root agents sit side by side before the row wraps. */
const maxPerRow = (narrow: boolean): number => (narrow ? 2 : MAX_AGENTS_PER_ROW);

/* Horizontal steps must clear the widest card that can sit in that column plus
 * a gutter. The old steps were narrower than the cards themselves (agents 180px
 * apart with 256px cards), so every sibling pair painted over the card next to
 * it, and operations inherited the same too-narrow column. */
const gapFor = (narrow: boolean, kind: "territory" | "agent" | "sub" | "pad"): number => {
  if (kind === "pad") return narrow ? 32 : 40;
  if (kind === "territory") return narrow ? 120 : 160;
  if (kind === "agent") return CARD_W.agent + GUTTER;
  return CARD_W.sub + GUTTER;
};

const territoryWidth = (rootCount: number, narrow: boolean): number => {
  const pad = gapFor(narrow, "pad");
  const agent = gapFor(narrow, "agent");
  // The widest row of root agents decides the column, and the outermost cards
  // stick out past the colony centre by half a card.
  const widestRow = Math.min(rootCount, maxPerRow(narrow));
  return Math.max(pad * 2 + CARD_W.specialist, (widestRow - 1) * agent + CARD_W.agent + pad * 2);
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
  const liveOps = runtime.tasks.filter(
    (t) => t.status !== "COMPLETED" && t.status !== "CANCELLED"
  );

  // Ordering is preserved from the runtime (stable sibling ordering).
  const rootsByColony = new Map<string, AgentRuntime[]>();
  for (const agent of liveAgents) {
    if (!agent.colonyId) continue;
    const list = rootsByColony.get(agent.colonyId) ?? [];
    list.push(agent);
    rootsByColony.set(agent.colonyId, list);
  }

  // ── Sub-agent tree and operation counts (needed to size the bands below) ──
  const childrenOf = new Map<string, AgentRuntime[]>();
  for (const agent of liveSubAgents) {
    if (!agent.parentId) continue;
    const list = childrenOf.get(agent.parentId) ?? [];
    list.push(agent);
    childrenOf.set(agent.parentId, list);
  }
  const opCountOf = new Map<string, number>();
  for (const task of liveOps) {
    if (!task.ownerAgentId) continue;
    opCountOf.set(task.ownerAgentId, (opCountOf.get(task.ownerAgentId) ?? 0) + 1);
  }

  /* Vertical bands inside one worker's column run strictly top to bottom:
   *   own card -> its operations -> its sub-agents -> their operations -> …
   * Because each band only starts where the previous one ended, a sub-agent row
   * can never land on an operation card at the same x (which happens whenever a
   * worker has a single child, so the child inherits the parent's x). */
  const opsBelow = (id: string): number => opCountOf.get(id) ?? 0;
  const subRowOffset = (id: string): number =>
    LEVEL_H + (opsBelow(id) > 0 ? opsBelow(id) * OP_STACK + GAP : 0);
  const opRowOffset = LEVEL_H;

  /** Total vertical space this worker's whole column needs, from its own top. */
  const subtreeDepth = (id: string, guard: Set<string>): number => {
    const n = opsBelow(id);
    const kids = childrenOf.get(id) ?? [];
    let bottom = WORKER_CARD_H;
    if (n > 0) bottom = Math.max(bottom, opRowOffset + (n - 1) * OP_STACK + OP_CARD_H);
    if (kids.length > 0 && !guard.has(id)) {
      guard.add(id);
      const below = Math.max(...kids.map((k) => subtreeDepth(k.id, guard)));
      guard.delete(id);
      bottom = Math.max(bottom, subRowOffset(id) + below);
    }
    return bottom;
  };

  const perRow = maxPerRow(narrow);
  // The guard starts empty: it is the ancestor chain, and seeding it with the
  // node's own id would make every worker look like it was already visiting and
  // silently drop its whole subtree (which shrank the bands below).
  const rowDepth = (chunk: AgentRuntime[]): number =>
    Math.max(...chunk.map((a) => subtreeDepth(a.id, new Set())));

  /* ── Specialist territories ──
   * Wide: territories sit side by side as balanced columns under the brain.
   * Narrow: a phone cannot show two columns at a readable size, so each
   * territory gets its own band, stacked down the page, and each band reserves
   * the real height of that colony (territory card + every agent row below it)
   * so the next colony cannot land on top of this one's work. */
  const COLONY_BAND_H = WORKER_CARD_H + GAP * 2;
  const territories = new Map<string, { x: number; y: number }>();
  const colonyX = new Map<string, number>();
  const colonyAgentTop = new Map<string, number>();
  let colonyCursor = Y_SPECIALIST;
  if (narrow) {
    for (const c of liveColonies) {
      const roots = rootsByColony.get(c.id) ?? [];
      colonyX.set(c.id, 0);
      territories.set(c.id, { x: 0, y: colonyCursor });
      colonyAgentTop.set(c.id, colonyCursor + COLONY_BAND_H);
      let h = COLONY_BAND_H;
      for (let r = 0; r * perRow < roots.length; r += 1) {
        h += rowDepth(roots.slice(r * perRow, (r + 1) * perRow)) + GAP;
      }
      colonyCursor += h;
    }
  } else {
    const widths = liveColonies.map((c) => territoryWidth((rootsByColony.get(c.id) ?? []).length, narrow));
    const territoryGap = gapFor(narrow, "territory");
    const total = widths.reduce((a, b) => a + b, 0) + territoryGap * Math.max(0, liveColonies.length - 1);
    let cursor = -total / 2;
    for (const c of liveColonies) {
      const w = widths[liveColonies.indexOf(c)];
      const cx = cursor + w / 2;
      colonyX.set(c.id, cx);
      territories.set(c.id, { x: cx, y: Y_SPECIALIST });
      colonyAgentTop.set(c.id, Y_AGENT);
      cursor += w + territoryGap;
    }
  }

  // ── Root agents, rowed beneath their territory ──
  // Each row reserves as much height as the deepest subtree in it, so the next
  // row clears the content of the one above it. Wide: row r shares a y across
  // every colony, which keeps the columns aligned. Narrow: each colony owns a
  // stacked band, so its rows run from its own top.
  const rowY: number[] = [];
  let rowCursor = Y_AGENT;
  if (!narrow) {
    const rowDepths: number[] = [];
    for (const c of liveColonies) {
      const roots = rootsByColony.get(c.id) ?? [];
      for (let r = 0; r * perRow < roots.length; r += 1) {
        const depth = rowDepth(roots.slice(r * perRow, (r + 1) * perRow));
        rowDepths[r] = Math.max(rowDepths[r] ?? 0, depth);
      }
    }
    for (let r = 0; r < rowDepths.length; r += 1) {
      rowY[r] = rowCursor;
      rowCursor += rowDepths[r] + GAP;
    }
  }

  const agents = new Map<string, { x: number; y: number }>();
  for (const c of liveColonies) {
    const cx = colonyX.get(c.id) ?? 0;
    const roots = rootsByColony.get(c.id) ?? [];
    const agentGap = gapFor(narrow, "agent");
    let y = colonyAgentTop.get(c.id) ?? Y_AGENT;
    for (let r = 0; r * perRow < roots.length; r += 1) {
      const chunk = roots.slice(r * perRow, (r + 1) * perRow);
      const rowTop = narrow ? y : rowY[r] ?? Y_AGENT;
      chunk.forEach((agent, j) => {
        agents.set(agent.id, {
          x: cx + (j - (chunk.length - 1) / 2) * agentGap,
          y: rowTop,
        });
      });
      y += rowDepth(chunk) + GAP;
    }
    if (narrow) rowCursor = Math.max(rowCursor, y);
  }
  const belowAllAgents = Math.max(rowCursor, colonyCursor);

  // ── Sub-agents beneath their parent (BFS so parents resolve before children) ──
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
        y: pos.y + subRowOffset(parentId),
      };
      subAgents.set(child.id, cPos);
      allAgentPos.set(child.id, cPos);
      queue.push({ pos: cPos, parentId: child.id });
    });
  }

  // ── Transient operations beneath their responsible worker ──
  const operations = new Map<string, { x: number; y: number }>();
  const opStack = new Map<string, number>();
  liveOps.forEach((task) => {
    const stackIdx = opStack.get(task.ownerAgentId ?? "") ?? 0;
    if (task.ownerAgentId) {
      const ownerPos = allAgentPos.get(task.ownerAgentId);
      if (ownerPos) {
        operations.set(task.id, {
          x: ownerPos.x,
          y: ownerPos.y + opRowOffset + stackIdx * OP_STACK,
        });
        opStack.set(task.ownerAgentId, stackIdx + 1);
        return;
      }
    }
    // Owner is gone: park it below every agent row so it cannot overlap one.
    operations.set(task.id, {
      x: 0,
      y: belowAllAgents + stackIdx * OP_STACK,
    });
  });

  return { brain, territories, agents, subAgents, operations };
}

export function specialistLabel(colony: ColonyRuntime): string {
  return colony.name.replace(/\s+Colony$/i, "").trim() || colony.name;
}