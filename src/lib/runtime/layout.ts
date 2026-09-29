import type { AgentRuntime, ColonyRuntime, TaskRuntime, WorkforceRuntime } from "./types";

/**
 * Deterministic layout engine.
 *
 * The STRIKE BRAIN is the origin of graph space and never moves. Everything
 * else is derived from hierarchy + a deterministic sibling order — never a
 * force simulation, never random.
 *
 * One shape, at every viewport size: a top-down tree. The brain is the topmost
 * card in the graph, territories hang in a centred row (or rows) below it, and
 * each territory's whole subtree is built as one axis-aligned block hanging
 * beneath its own card, so one territory's workers can never restructure a
 * neighbour's rows. The viewport chooses how much *air* a graph gets; it never
 * chooses the shape.
 *
 * This is the shape a reader already knows — the org chart — so rank is legible
 * without learning the graph: up is the boss, down is the worker, side by side
 * means same level. The layout it replaced was a hub and spokes, with the brain
 * sitting *between* its territories. That is the right shape for a network and
 * the wrong one for a hierarchy, because it spends the brain's most useful
 * property — being the thing everything descends from — to make the two-
 * territory graph look like a badge.
 *
 * The top-down shape also deleted the geometry this file used to need. A block
 * only ever grows downward from its own card, so blocks stacked in a row are
 * separated on x by construction, and each row is a fixed band on y. There is
 * no radius to search and no clash test to pass: a pair of blocks either has
 * disjoint x-ranges (same row) or disjoint y-bands (different rows), and both
 * follow from the row being laid out, not from a number being tuned.
 */

export interface TopologyLayout {
  brain: { x: number; y: number };
  territories: Map<string, { x: number; y: number }>;
  agents: Map<string, { x: number; y: number }>;
  subAgents: Map<string, { x: number; y: number }>;
  operations: Map<string, { x: number; y: number }>;
  /** The spacing this layout was actually built with, after tier + clamping. */
  spacing: TopologySpacing;
}

const BRAIN_Y = 0;
const MAX_AGENTS_PER_ROW = 6;
/** How many territories share one row under the brain before the next row
 *  starts. Past this a graph is a tree with a trunk, not a row of peers, and
 *  eight side-by-side blocks would force the camera so far out that no card is
 *  legible. Matches the `widestRow > 4` spacing trigger on purpose. */
const MAX_TERRITORIES_PER_ROW = 4;

/* Card heights measured in a real browser on the *tallest* content variant, after
 * the compact pass. The decisive change was structural, not numeric: worker
 * action rows can no longer wrap (flex-nowrap + shortened toggle labels), so a
 * worker's height no longer depends on how many toggles it has or how long the
 * labels are. It used to jump 121px -> 161px the moment a worker showed both
 * toggles, which pushed every row below it down and used to overlap outright.
 * Every step below is measured-height + GAP, and each worker reserves exactly
 * the depth its own subtree needs, so siblings can never collide.
 * Measured with /tmp/opencode/measure_cards.py + /tmp/opencode/probe_sub.py. */
const WORKER_CARD_H = 104;
const OP_CARD_H = 104;

const REMOVED_STATES = new Set(["cancelled", "stopped"]);

/** Rendered card widths (Tailwind w-64 / w-60 / w-56 / w-44), in px. */
const CARD_W = {
  brain: 256,
  specialist: 240,
  agent: 240,
  sub: 224,
  operation: 176,
} as const;

/** Brain card height (measured), used only to place the territory band. */
const BRAIN_CARD_H = 123;

/** Every card's rendered size, in one place.
 *
 *  The layout needs widths to reserve blocks and the camera needs widths and
 *  heights to frame, but the *edge* builder needs the height alone: a layout
 *  position is centre-x/top-y, so an endpoint's real centre is `y + h / 2`.
 *  Comparing two top edges instead put a diagonal brain→territory spoke on the
 *  top/bottom handle pair, because the brain's top edge and a raised
 *  territory's top edge are close together even when the two cards are
 *  unmistakably side by side. One table, so the three can never disagree about
 *  how big a card is. */
export const CARD_SIZE = {
  brain: { w: CARD_W.brain, h: BRAIN_CARD_H },
  specialist: { w: CARD_W.specialist, h: WORKER_CARD_H },
  agent: { w: CARD_W.agent, h: WORKER_CARD_H },
  sub: { w: CARD_W.sub, h: WORKER_CARD_H },
  operation: { w: CARD_W.operation, h: OP_CARD_H },
} as const;

export type TopologyCardKind = keyof typeof CARD_SIZE;

/** Epoch ms for a timestamp that may arrive as a Date, a string or a number. */
const epoch = (d: Date | string | number | undefined): number => {
  const t = d instanceof Date ? d.getTime() : typeof d === "number" ? d : Date.parse(String(d ?? ""));
  return Number.isFinite(t) ? t : 0;
};

/** Oldest first, id as the tie-break.
 *
 *  Sibling order is presentation, and presentation has to be a function of the
 *  data rather than of the order a query happened to return rows in. Ordering
 *  by creation time and falling back to id is what makes a worker's children
 *  appear in the same left-to-right order on every render and on every
 *  machine, instead of swapping places whenever a `findMany` without an
 *  `orderBy` reshuffles. It reads a field, so it is not a model change. */
const byCreation = <T extends { id: string }>(createdAt: (item: T) => number, a: T, b: T): number => {
  const delta = createdAt(a) - createdAt(b);
  if (delta !== 0) return delta;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

/** Sorted copy. The runtime arrays are never mutated. */
const inCreationOrder = <T extends { id: string }>(items: T[], createdAt: (item: T) => number): T[] =>
  [...items].sort((a, b) => byCreation(createdAt, a, b));

/** How many root agents sit side by side before the row wraps. */
const maxPerRow = (narrow: boolean): number => (narrow ? 2 : MAX_AGENTS_PER_ROW);

/* ── Adaptive spacing ──────────────────────────────────────────────────────
 * A three-node graph and a sixty-node graph cannot both look right at one fixed
 * gap: the small one floats in dead space, the large one has to shrink the
 * camera far enough that the cards stop being readable. So spacing is chosen
 * from the shape of the graph, and every choice is clamped by hard floors that
 * encode what "readable" actually means here.
 *
 * The floors are the whole point. The gutter is negotiable down to MIN_GUTTER
 * because it is only whitespace, but a horizontal *step* is negotiable only
 * down to card-width + MIN_GUTTER — a step narrower than the card it positions
 * is not "tight", it is an overlap. Vertical gaps go tighter than the old 20
 * because rows are what multiply on a deep graph. */
export interface TopologySpacing {
  /** Vertical breathing room between bands. */
  gap: number;
  /** Horizontal breathing room between siblings, on top of card width. */
  gutter: number;
  /** Air between two territory blocks sitting in the same row. */
  territoryGap: number;
  /** Inset from the colony centre edge to the outermost card. */
  pad: number;
}

export type SpacingTier = "small" | "medium" | "large";

/** Hard floors and ceilings, independent of tier. */
export const SPACING_LIMITS = {
  minGap: 12,
  maxGap: 36,
  minGutter: 8,
  maxGutter: 48,
  minTerritoryGap: 96,
  minPad: 24,
} as const;

const TIERS: Record<SpacingTier, TopologySpacing> = {
  small: { gap: 28, gutter: 32, territoryGap: 160, pad: 40 },
  medium: { gap: 20, gutter: 24, territoryGap: 160, pad: 40 },
  large: { gap: 14, gutter: 16, territoryGap: 144, pad: 32 },
};

/* Narrow layouts stack colonies vertically and fit the width first, so they get
 * their own tier values: less air between bands, and tighter territory spacing,
 * because a phone is already width-starved. */
const NARROW_TIERS: Record<SpacingTier, TopologySpacing> = {
  small: { gap: 24, gutter: 28, territoryGap: 120, pad: 32 },
  medium: { gap: 18, gutter: 20, territoryGap: 120, pad: 32 },
  large: { gap: 12, gutter: 12, territoryGap: 104, pad: 24 },
};

const snap = (v: number, step = 2): number => Math.round(v / step) * step;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Which spacing tier a graph of this shape deserves. */
export function spacingTierFor(
  counts: { nodes: number; depth: number; widestRow: number },
  narrow = false
): SpacingTier {
  /* A phone is already width-starved before any of this: two root agents side by
   * side build a ~540px graph inside a ~390px pane, so fitView has to shrink to
   * roughly 0.6x before a single card is legible, and every extra pixel of air
   * costs zoom. A graph that is only "medium" on a desktop therefore has to
   * start compacting earlier here, which is why the node and depth triggers are
   * lower on narrow.
   *
   * Row width is deliberately not a narrow trigger: maxPerRow caps narrow rows
   * at 2, so the wide `widestRow > 4` test could never fire and tightening on it
   * would move nothing. Node count and depth are the signals that actually move. */
  if (narrow) {
    if (counts.nodes > 16 || counts.depth >= 3) return "large";
    return counts.nodes <= 8 ? "small" : "medium";
  }
  if (counts.nodes > 24 || counts.depth >= 4 || counts.widestRow > 4) return "large";
  if (counts.nodes <= 8) return "small";
  return "medium";
}

/**
 * Default spacing for a graph of this shape, clamped to the floors.
 *
 * `narrow` picks both the narrow tier table and the narrow tier triggers; the
 * counts themselves are the same numbers, because a phone showing 40 nodes is
 * still a big graph.
 */
export function spacingFor(
  counts: { nodes: number; depth: number; widestRow: number },
  narrow = false
): TopologySpacing {
  const tier = spacingTierFor(counts, narrow);
  const base = (narrow ? NARROW_TIERS : TIERS)[tier];
  return {
    gap: clamp(base.gap, SPACING_LIMITS.minGap, SPACING_LIMITS.maxGap),
    gutter: clamp(base.gutter, SPACING_LIMITS.minGutter, SPACING_LIMITS.maxGutter),
    territoryGap: Math.max(base.territoryGap, SPACING_LIMITS.minTerritoryGap),
    pad: Math.max(base.pad, SPACING_LIMITS.minPad),
  };
}

/** Pull a proposed spacing back inside the floors. Every override goes through
 * this, so no caller can build a layout that overlaps. */
export function clampSpacing(s: TopologySpacing): TopologySpacing {
  return {
    gap: clamp(snap(s.gap), SPACING_LIMITS.minGap, SPACING_LIMITS.maxGap),
    gutter: clamp(snap(s.gutter), SPACING_LIMITS.minGutter, SPACING_LIMITS.maxGutter),
    territoryGap: Math.max(snap(s.territoryGap), SPACING_LIMITS.minTerritoryGap),
    pad: Math.max(snap(s.pad), SPACING_LIMITS.minPad),
  };
}

/** Merge an override onto tier defaults, then clamp. */
function resolveSpacing(
  counts: { nodes: number; depth: number; widestRow: number },
  narrow: boolean,
  override?: Partial<TopologySpacing>
): TopologySpacing {
  const base = spacingFor(counts, narrow);
  if (!override) return base;
  return clampSpacing({
    gap: override.gap ?? base.gap,
    gutter: override.gutter ?? base.gutter,
    territoryGap: override.territoryGap ?? base.territoryGap,
    pad: override.pad ?? base.pad,
  });
}

/* Horizontal steps must clear the widest card that can sit in that column plus
 * a gutter. The old steps were narrower than the cards themselves (agents 180px
 * apart with 256px cards), so every sibling pair painted over the card next to
 * it, and operations inherited the same too-narrow column. */
const gapFor = (s: TopologySpacing, kind: "territory" | "agent" | "sub" | "pad"): number => {
  if (kind === "pad") return s.pad;
  if (kind === "territory") return s.territoryGap;
  if (kind === "agent") return CARD_W.agent + s.gutter;
  return CARD_W.sub + s.gutter;
};

/* Every sub-agent in a band shares ONE lattice of pitch subGap, instead of each
 * parent fanning its own children out from its own centre. The old fan was the
 * bug: two parents side by side, each with two children, put parent A's right
 * child and parent B's left child only 16px apart while the cards are 224px
 * wide, so they painted over each other. It stayed hidden because a lone child
 * has a zero offset, so the old fixture (one sub-agent) could never reproduce
 * it. On a shared lattice no two sub-agents can be closer than the pitch, which
 * is card width + gutter by construction — the overlap becomes unrepresentable
 * rather than merely unlikely.
 *
 * Slots are claimed nearest-first, walking outward, so a sub-agent stays
 * roughly under its parent while collisions resolve deterministically in stable
 * sibling order. `taken` is owned by the caller, because a lattice is only
 * shared by cards that share a coordinate frame: the tree layout gives every
 * territory its own block, and one block's slot numbering means nothing in
 * another's. */
function claimLatticeSlot(taken: Set<number>, desired: number, pitch: number): number {
  const base = Math.round(desired / pitch);
  for (let d = 0; d < 1000; d += 1) {
    for (const candidate of d === 0 ? [base] : [base - d, base + d]) {
      if (!taken.has(candidate)) {
        taken.add(candidate);
        return candidate;
      }
    }
  }
  return base;
}

/* ── Top-down tree ───────────────────────────────────────────────────────────
 * One territory's subtree, in block-local coordinates: the territory card's
 * centre-x / top-y is the origin, and everything hangs below it. The block is
 * built once, in this frame, and then only translated into its row. */
interface TerritoryBlock {
  colonyId: string;
  agents: Map<string, { x: number; y: number }>;
  subAgents: Map<string, { x: number; y: number }>;
  operations: Map<string, { x: number; y: number }>;
  cards: Placed[];
  box: Box;
}

export function buildTopologyLayout(
  runtime: WorkforceRuntime,
  narrow = false,
  spacingOverride?: Partial<TopologySpacing>
): TopologyLayout {
  const brain = { x: 0, y: BRAIN_Y };

  /* Sibling order is decided here, once, from the data — see byCreation. The
   * runtime arrays are filtered and sorted into copies; nothing downstream is
   * allowed to depend on the order a query happened to return rows in, because
   * that is how a worker's children used to change places between two renders
   * of the same graph. Territories are sorted the same way, which is what makes
   * "the first territory" a stable thing to hang on the left of a row. */
  const liveColonies = inCreationOrder(
    runtime.colonies.filter((c) => c.status !== "ARCHIVED"),
    (c) => epoch(c.timestamps.createdAt)
  );
  const colonyIds = new Set(liveColonies.map((c) => c.id));
  const liveAgents = inCreationOrder(
    runtime.agents.filter(
      (a) => !REMOVED_STATES.has(a.runtimeState) && (!a.colonyId || colonyIds.has(a.colonyId)) && !a.parentId
    ),
    (a) => epoch(a.createdAt)
  );
  const liveSubAgents = inCreationOrder(
    runtime.agents.filter(
      (a) => !REMOVED_STATES.has(a.runtimeState) && a.parentId && (!a.colonyId || colonyIds.has(a.colonyId))
    ),
    (a) => epoch(a.createdAt)
  );
  const liveOps = inCreationOrder(
    runtime.tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED"),
    (t) => epoch(t.timestamps.createdAt)
  );

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
  const opsByOwner = new Map<string, TaskRuntime[]>();
  for (const task of liveOps) {
    if (!task.ownerAgentId) continue;
    opCountOf.set(task.ownerAgentId, (opCountOf.get(task.ownerAgentId) ?? 0) + 1);
    const list = opsByOwner.get(task.ownerAgentId) ?? [];
    list.push(task);
    opsByOwner.set(task.ownerAgentId, list);
  }

  /* Shape of this graph, which decides its spacing tier. Depth is the longest
   * parent chain of live agents; widestRow is the largest number of roots that
   * share a row, because a wide row is what forces the camera out.
   *
   * The parent lookup is a single map built here, not a search through the agent
   * arrays: this runs inside a memo that re-executes on every runtime event, and
   * rebuilding `[...liveSubAgents, ...liveAgents]` per level made the walk
   * O(agents x depth) with an array allocation at every step. Both folds below
   * also avoid `Math.max(...spread)`, which throws once a colony count grows
   * past the argument limit. */
  const parentOf = new Map<string, string | undefined>();
  for (const agent of liveSubAgents) parentOf.set(agent.id, agent.parentId);
  for (const agent of liveAgents) parentOf.set(agent.id, agent.parentId);
  const depthOf = (id: string, seen: Set<string>): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const parent = parentOf.get(id);
    const below = parent ? 1 + depthOf(parent, seen) : 0;
    seen.delete(id);
    return below;
  };
  let depth = 0;
  for (const agent of liveAgents) depth = Math.max(depth, depthOf(agent.id, new Set()));
  for (const agent of liveSubAgents) depth = Math.max(depth, depthOf(agent.id, new Set()));
  let widestRow = 0;
  for (const roots of Array.from(rootsByColony.values())) {
    widestRow = Math.max(widestRow, Math.min(roots.length, maxPerRow(narrow)));
  }

  const spacing = resolveSpacing(
    { nodes: 1 + liveColonies.length + liveAgents.length + liveSubAgents.length + liveOps.length, depth, widestRow },
    narrow,
    spacingOverride
  );
  const GAP = spacing.gap;
  const LEVEL_H = WORKER_CARD_H + GAP; // worker row -> its sub-agent row
  const OP_STACK = OP_CARD_H + GAP; // one operation -> the next under the same owner
  /** Territory card -> the first agent row beneath it. */
  const COLONY_BAND_H = WORKER_CARD_H + GAP * 2;

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

  /* ── Top-down tree: one shape, at every size ──
   *
   * Every block is built on its own, which is what keeps one territory from
   * reaching into another's rows: the rows and the sub-agent lattice are
   * reserved from one territory's workers alone, where the old column path
   * shared one row cursor across all colonies, so a deep subtree in one
   * territory pushed every row of the other one down.
   *
   * There is deliberately no narrow branch here. A phone used to get a
   * different *graph* — territories stacked into bands, one shared sub-agent
   * lattice, a completely different set of coordinates — so the same workforce
   * meant two different hierarchies depending on the window, and a screenshot
   * taken on a phone could not be compared with one taken on a desktop. The
   * viewport now buys air and nothing else, and that includes how many
   * territories share a row: the wrap is a constant, not a response to width. */
  {
    const agentGap = gapFor(spacing, "agent");
    const subGap = gapFor(spacing, "sub");

    const buildBlock = (colonyId: string): TerritoryBlock => {
      const roots = rootsByColony.get(colonyId) ?? [];
      const agents = new Map<string, { x: number; y: number }>();
      const subAgents = new Map<string, { x: number; y: number }>();
      const operations = new Map<string, { x: number; y: number }>();
      const cards: Placed[] = [{ x: 0, y: 0, w: CARD_W.specialist, h: WORKER_CARD_H }];

      let cursor = COLONY_BAND_H;
      for (let r = 0; r * perRow < roots.length; r += 1) {
        const chunk = roots.slice(r * perRow, (r + 1) * perRow);
        chunk.forEach((agent, j) => {
          const pos = { x: (j - (chunk.length - 1) / 2) * agentGap, y: cursor };
          agents.set(agent.id, pos);
          cards.push({ ...pos, w: CARD_W.agent, h: WORKER_CARD_H });
        });
        /* A row reserves as much height as the deepest subtree in it. A flat
         * spacing-derived pitch would be tidier, and wrong: a root with a
         * two-deep subtree would have its own child laid over the next row. The
         * rule that matters here is the scope, not the reserve. What used to be
         * broken is that this cursor was shared by every colony, so one
         * territory's depth moved the rows of all the others. It is now a
         * local, owned by this block alone. */
        cursor += rowDepth(chunk) + GAP;
      }

      // BFS so a parent always resolves before its own children, and the lattice
      // is this block's alone — see claimLatticeSlot.
      const takenSlots = new Set<number>();
      const queue: Array<{ pos: { x: number; y: number }; parentId: string }> = [];
      for (const [id, pos] of Array.from(agents.entries())) queue.push({ pos, parentId: id });
      while (queue.length > 0) {
        const { pos, parentId } = queue.shift() as { pos: { x: number; y: number }; parentId: string };
        const children = childrenOf.get(parentId) ?? [];
        children.forEach((child, k) => {
          const desired = pos.x + (k - (children.length - 1) / 2) * subGap;
          const cPos = {
            x: claimLatticeSlot(takenSlots, desired, subGap) * subGap,
            y: pos.y + subRowOffset(parentId),
          };
          subAgents.set(child.id, cPos);
          cards.push({ ...cPos, w: CARD_W.sub, h: WORKER_CARD_H });
          queue.push({ pos: cPos, parentId: child.id });
        });
      }

      const opStack = new Map<string, number>();
      for (const [ownerId, owned] of Array.from(opsByOwner.entries())) {
        const ownerPos = agents.get(ownerId) ?? subAgents.get(ownerId);
        if (!ownerPos) continue;
        owned.forEach((task) => {
          const stackIdx = opStack.get(ownerId) ?? 0;
          const pos = { x: ownerPos.x, y: ownerPos.y + opRowOffset + stackIdx * OP_STACK };
          operations.set(task.id, pos);
          cards.push({ ...pos, w: CARD_W.operation, h: OP_CARD_H });
          opStack.set(ownerId, stackIdx + 1);
        });
      }

      return { colonyId, agents, subAgents, operations, cards, box: boxOf(cards)! };
    };

    const blocks = liveColonies.map((c) => buildBlock(c.id));

    /* Territories go in centred rows under the brain, at most
     * MAX_TERRITORIES_PER_ROW per row. The wrap count is a constant rather than
     * a function of the pane, because the viewport is not allowed to pick the
     * shape (see the section header) — and it is deliberately the same four the
     * `widestRow > 4` spacing trigger uses, so a graph that wraps its territories
     * is also a graph that has already been given the compact tier. */
    const rows: TerritoryBlock[][] = [];
    for (let start = 0; start < blocks.length; start += MAX_TERRITORIES_PER_ROW) {
      rows.push(blocks.slice(start, start + MAX_TERRITORIES_PER_ROW));
    }

    const territories = new Map<string, { x: number; y: number }>();
    const agents = new Map<string, { x: number; y: number }>();
    const subAgents = new Map<string, { x: number; y: number }>();
    const operations = new Map<string, { x: number; y: number }>();

    /* A block is a fixed box by the time it gets here, so placing one beside
     * another is arithmetic rather than a search: the row is as wide as the sum
     * of the blocks in it plus the gaps between them, and each block's left edge
     * is wherever the cursor is. Overlap is unrepresentable. Two blocks in a row
     * have disjoint x-ranges because the cursor advances past the box it just
     * placed; two blocks in different rows have disjoint y-bands because each
     * row starts a gap below the lowest card of the row above. The hub layout
     * needed a doubling-and-bisection search over a radius to get the same
     * guarantee, and could still return a clashing graph if that search were
     * ever capped. Nothing here can be tuned into a failure.
     *
     * Blocks are reserved by their measured box, not by their territory card,
     * because a block is as wide as its widest row of workers: a territory with
     * six workers is far wider than its own card, and reserving by the card is
     * what let a neighbour's workers land on top of the next territory. */
    const blockGap = gapFor(spacing, "territory");

    /* Everything is below the brain, always. The first row starts a gap under
     * the brain's bottom edge and each later row a gap under the row above, so
     * the brain is both the origin of graph space and its topmost card — the
     * single property the whole layout exists to guarantee. */
    const brainBottom = brain.y + BRAIN_CARD_H;
    let lowest = brainBottom;
    let rowTop = brainBottom + GAP;
    for (const row of rows) {
      const rowWidth = row.reduce((sum, b) => sum + b.box.w, 0) + blockGap * (row.length - 1);
      let left = -rowWidth / 2;
      for (const block of row) {
        /* Measured from the block's left edge and top edge rather than from its
         * own card's centre, since a block's box can extend well past its card
         * on every side. Translating by the negated min is what pins the top of
         * the row, not just the top of the first block in it. */
        const anchor = { x: left - block.box.minX, y: rowTop - block.box.minY };
        territories.set(block.colonyId, anchor);
        block.agents.forEach((pos, id) => agents.set(id, { x: pos.x + anchor.x, y: pos.y + anchor.y }));
        block.subAgents.forEach((pos, id) =>
          subAgents.set(id, { x: pos.x + anchor.x, y: pos.y + anchor.y })
        );
        block.operations.forEach((pos, id) =>
          operations.set(id, { x: pos.x + anchor.x, y: pos.y + anchor.y })
        );
        /* The block's extent is translated, so the bottom is the anchor plus the
         * box's own maxY. Written this way rather than as `rowTop + box.maxY`
         * so the next row's gap stays correct even if a block ever stops
         * starting at local y 0. */
        lowest = Math.max(lowest, anchor.y + block.box.maxY);
        left += block.box.w + blockGap;
      }
      rowTop = lowest + GAP;
    }

    /* An operation whose owner is gone (cancelled, or in an archived colony)
     * belongs to no block, so it is parked under the whole graph rather than
     * under a worker that does not exist. Done last, once the real extents are
     * known, which is why it cannot land on top of anything. The test is
     * "was it placed", not "is its owner present": an owner can exist and still
     * be outside every block, and skipping those would drop the card and leave
     * the node builder to fall back to the origin — which is the middle of the
     * graph, i.e. on top of the brain. */
    let unowned = 0;
    for (const task of liveOps) {
      if (operations.has(task.id)) continue;
      operations.set(task.id, { x: brain.x, y: lowest + GAP + unowned * OP_STACK });
      unowned += 1;
    }

    return { brain, territories, agents, subAgents, operations, spacing };
  }
}

export function specialistLabel(colony: ColonyRuntime): string {
  return colony.name.replace(/\s+Colony$/i, "").trim() || colony.name;
}

/* ── Viewport fill ──────────────────────────────────────────────────────────
 * `fitView` already decides how far to zoom out, so if spacing also chased the
 * viewport the two would cancel each other out and every resize would make the
 * cards swim. They are therefore kept in disjoint regimes: fit only gets a say
 * while the graph is mid-range, and spacing is only allowed to move in the two
 * cases fit cannot fix on its own —
 *
 *   - the graph is pinned at maxZoom but still covers less than half the pane,
 *     so there is dead space nothing will consume (a 3-node graph); or
 *   - fitting would drop the zoom below MIN_FIT_ZOOM, so the cards would become
 *     unreadable and only tighter spacing can save it.
 *
 * In between, tier defaults stand and fit does its normal job. That is what
 * makes the two non-conflicting rather than merely usually-agreeing. */

export const FIT_PADDING = 0.18;
export const FIT_MAX_ZOOM = 0.72;
/** The canvas clamps at this; the fit estimate has to clamp the same way. */
export const FIT_MIN_ZOOM = 0.2;
/** Below this fit zoom, cards stop being readable, so spacing takes over. */
export const MIN_FIT_ZOOM = 0.45;
/** Under this share of the pane, a maxZoom-pinned graph is wasting space. */
export const MIN_FILL_COVERAGE = 0.5;
/** Sizes only react to viewport changes larger than this, so a drag-resize
 *  cannot make cards jitter. */
export const VIEWPORT_DEADBAND = 48;

/** Pane width at which colonies stop sitting side by side and start stacking. */
export const NARROW_BREAKPOINT = 800;
/** How far past the breakpoint the pane has to travel before the layout mode
 *  flips. Without this, a window drag sitting on the threshold re-stacks the
 *  whole graph on every other pixel, and each rebuild moves every card. */
export const NARROW_HYSTERESIS = 24;

/** The layout mode a pane width implies, given the mode it is in now.
 *
 *  Stacking colonies and putting them side by side are two completely different
 *  graphs — the same workers land at different coordinates in each — so a mode
 *  flip has to move the camera. What it must not do is flicker while the user
 *  drags a window edge across the threshold, which is what a bare `w < 800`
 *  comparison does. So the two directions are deliberately asymmetric: leaving
 *  narrow needs the pane to be genuinely narrow, while entering it needs the
 *  pane to be genuinely wide again. */
export function narrowFor(width: number, current: boolean): boolean {
  if (!Number.isFinite(width) || width <= 0) return current;
  return current
    ? width < NARROW_BREAKPOINT + NARROW_HYSTERESIS
    : width < NARROW_BREAKPOINT - NARROW_HYSTERESIS;
}

export interface ViewportSize {
  w: number;
  h: number;
}

/** One card's box in graph space: `x` is its centre, `y` its top edge, which is
 *  exactly what React Flow's `nodeOrigin={[0.5, 0]}` means. Keeping that
 *  convention in one exported shape is what lets the layout engine and the
 *  camera agree on where a card actually is. */
export type Placed = { x: number; y: number; w: number; h: number };

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w: number;
  h: number;
}

/** The single box every consumer agrees "the graph" means.
 *
 *  This used to be re-derived three times with slightly different arithmetic,
 *  which is how a card could end up outside the box the camera framed: the fit
 *  estimate and the coverage check each built their own extents, and the canvas
 *  built a fourth. One function, one answer. */
export function boxOf(cards: Placed[]): Box | null {
  if (cards.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of cards) {
    minX = Math.min(minX, c.x - c.w / 2);
    maxX = Math.max(maxX, c.x + c.w / 2);
    minY = Math.min(minY, c.y);
    maxY = Math.max(maxY, c.y + c.h);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Every card's on-screen box, from a layout plus the measured card sizes. */
export function layoutBounds(layout: TopologyLayout): Placed[] {
  const out: Placed[] = [{ ...layout.brain, w: CARD_W.brain, h: BRAIN_CARD_H }];
  for (const p of Array.from(layout.territories.values())) out.push({ ...p, w: CARD_W.specialist, h: WORKER_CARD_H });
  for (const p of Array.from(layout.agents.values())) out.push({ ...p, w: CARD_W.agent, h: WORKER_CARD_H });
  for (const p of Array.from(layout.subAgents.values())) out.push({ ...p, w: CARD_W.sub, h: WORKER_CARD_H });
  for (const p of Array.from(layout.operations.values())) out.push({ ...p, w: CARD_W.operation, h: OP_CARD_H });
  return out;
}

/** The zoom `fitView` would choose for this graph in this pane, clamped the
 * same way the canvas clamps it.
 *
 * The padding term is `1 + FIT_PADDING`, not `1 - 2 * FIT_PADDING`. The earlier
 * form reserved the padding per side and then divided by the remainder, which
 * made every estimate roughly 1.8x too high; the saturation rule below reads
 * that number directly, so the error was not cosmetic — it reported "already
 * pinned at maxZoom" for graphs the canvas was still zooming out on, and
 * "comfortably readable" for panes sitting below the legibility floor.
 *
 * Calibrated against the live canvas (React Flow 12.11.6) with
 * /tmp/opencode/calibrate_fit.py + /tmp/opencode/calib_models.ts: eight
 * configurations (4 pane sizes x collapsed/expanded, wide and narrow), reading
 * the zoom off `.react-flow__viewport` and the graph extent off the rendered
 * cards. Agreement was within 0.12% on every unclamped case. The competing
 * reading of the library's own source (per-side pixel padding) was 4-9% off,
 * so the form used here is the one the installed version actually exhibits.
 */
export function fitZoomFor(bounds: Placed[], viewport: ViewportSize): number {
  const box = boxOf(bounds);
  if (!box) return FIT_MAX_ZOOM;
  const usable = 1 + FIT_PADDING;
  const zoomX = viewport.w / (usable * Math.max(1, box.w));
  const zoomY = viewport.h / (usable * Math.max(1, box.h));
  return Math.min(FIT_MAX_ZOOM, Math.max(FIT_MIN_ZOOM, Math.min(zoomX, zoomY)));
}

/** How much of the pane the graph covers when fit is pinned at maxZoom. */
function coverageAtMaxZoom(bounds: Placed[], viewport: ViewportSize): number {
  const box = boxOf(bounds);
  if (!box) return 0;
  return ((box.w * FIT_MAX_ZOOM) / viewport.w) * ((box.h * FIT_MAX_ZOOM) / viewport.h);
}

/* ── Camera ──────────────────────────────────────────────────────────────────
 * The fit zoom above answers "how far out?". A camera also needs "and where is
 * the centre of the graph, in pane pixels?", which is where a resize goes
 * wrong: React Flow keeps the old {x, y, zoom} until something tells it
 * otherwise, so a pane that shrinks around a fixed transform pushes the top of
 * the graph off the top of the screen while the middle stays put — exactly the
 * reported symptom. Deriving the whole transform from the current pane and the
 * current graph is what makes the two move together. */

/** Pane edges covered by floating UI. `usable` is the pane minus these, and the
 *  graph is centred in the remainder rather than in the pane. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** The viewport that frames `cards` inside `usable`, with the graph centred in
 *  the free area rather than in the pane. */
export function fitTransformFor(
  cards: Placed[],
  usable: ViewportSize
): { x: number; y: number; zoom: number } {
  const box = boxOf(cards);
  if (!box || usable.w <= 0 || usable.h <= 0) {
    return { x: 0, y: 0, zoom: FIT_MAX_ZOOM };
  }
  const centreX = (box.minX + box.maxX) / 2;
  const centreY = (box.minY + box.maxY) / 2;
  const zoom = fitZoomFor(cards, usable);
  return {
    zoom,
    x: usable.w / 2 - centreX * zoom,
    y: usable.h / 2 - centreY * zoom,
  };
}

/** Whether the graph already sits entirely inside the free area at the current
 *  transform. Used to decide if a change actually needs the camera to move: if
 *  the answer is yes, the user's own zoom is left alone.
 *
 *  `insets` describe where the free area sits inside the pane, and `usable` how
 *  big it is, so a point is on screen when it is past the inset and short of
 *  the far edge. A one-pixel tolerance keeps float noise from reading as
 *  "clipped" and nudging the camera on every frame. */
export function graphFitsIn(
  cards: Placed[],
  viewport: { x: number; y: number; zoom: number },
  usable: ViewportSize,
  insets: Insets = NO_INSETS
): boolean {
  const box = boxOf(cards);
  if (!box || usable.w <= 0 || usable.h <= 0) return false;
  const z = viewport.zoom;
  const left = box.minX * z + viewport.x;
  const right = box.maxX * z + viewport.x;
  const top = box.minY * z + viewport.y;
  const bottom = box.maxY * z + viewport.y;
  const slop = 1;
  return (
    left >= insets.left - slop &&
    top >= insets.top - slop &&
    right <= insets.left + usable.w + slop &&
    bottom <= insets.top + usable.h + slop
  );
}


/**
 * Build a layout whose spacing also considers the pane, but only where fit
 * cannot help. Returns tier-default spacing when the viewport says nothing, so
 * a mid-size graph is byte-identical to the pure layout.
 *
 * Pass the pane the layout is being drawn in. The camera frames inside the same
 * pane minus whatever floating panels cover, but spacing deliberately keys off
 * the whole pane: opening a card should not re-space every card in the graph.
 * The fit number this rule reads is the same one the camera applies, so the two
 * can only disagree by the covered area, and only about how much air the graph
 * deserves.
 */
export function buildAdaptiveTopologyLayout(
  runtime: WorkforceRuntime,
  narrow = false,
  viewport?: ViewportSize
): TopologyLayout {
  const base = buildTopologyLayout(runtime, narrow);
  if (!viewport || viewport.w <= 0 || viewport.h <= 0) return base;

  const bounds = layoutBounds(base);
  const fit = fitZoomFor(bounds, viewport);
  const loosest: TopologySpacing = clampSpacing({
    ...base.spacing,
    gap: SPACING_LIMITS.maxGap,
    gutter: SPACING_LIMITS.maxGutter,
    territoryGap: base.spacing.territoryGap + 24,
    pad: base.spacing.pad + 16,
  });

  let spacing: TopologySpacing | undefined;
  // Case 1: fit is pinned at maxZoom and still leaves the pane half empty.
  if (fit >= FIT_MAX_ZOOM - 1e-6 && coverageAtMaxZoom(bounds, viewport) < MIN_FILL_COVERAGE) {
    spacing = loosest;
  } else if (fit < MIN_FIT_ZOOM) {
    /* Case 2: cards would be illegible. Tighten toward the floors, but only by
     * whatever the shortfall actually needs.
     *
     * This is a bounded improvement, NOT a rescue, and it is worth knowing why
     * before trying to make it one. Sweeping 346 generated runtimes, none could
     * be lifted back over MIN_FIT_ZOOM: the best was 0.258 -> 0.268, and the
     * ceiling was 0.425 against a 0.45 floor. Card dimensions dominate the
     * graph extent, and the floors exist precisely to stop horizontal steps
     * being narrower than the cards they separate, so there is almost nothing
     * left to take. Going further would mean either overlapping cards or
     * refusing to fit the whole graph and letting the user pan -- both are
     * product decisions about navigation, not tuning. The assertions in
     * scripts/check-selectors.ts are written to match this reality: they check
     * that a cramped pane is detected, that tightening helps, and that the
     * floors still prevent overlap. They deliberately do not claim a rescue. */
    const shortfall = MIN_FIT_ZOOM / Math.max(1e-6, fit);
    const target = {
      gap: base.spacing.gap / shortfall,
      gutter: base.spacing.gutter / shortfall,
      territoryGap: base.spacing.territoryGap / shortfall,
      pad: base.spacing.pad / shortfall,
    };
    const tightened = clampSpacing(target);
    // Only adopt it if it actually helps: a graph that stays illegibly small
    // after tightening is better served by zooming than by overlapping.
    spacing = fitZoomFor(layoutBounds(buildTopologyLayout(runtime, narrow, tightened)), viewport) > fit
      ? tightened
      : undefined;
  }

  return spacing ? buildTopologyLayout(runtime, narrow, spacing) : base;
}