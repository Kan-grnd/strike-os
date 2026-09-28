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
  /** The spacing this layout was actually built with, after tier + clamping. */
  spacing: TopologySpacing;
}

const Y_BRAIN = 40;
const MAX_AGENTS_PER_ROW = 6;

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

/* Vertical gaps used only when the caller supplies no spacing of its own. */
/** Agents that are no longer part of the live workforce. */
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
  /** Space between two territory columns. */
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

const territoryWidth = (rootCount: number, narrow: boolean, s: TopologySpacing): number => {
  const pad = gapFor(s, "pad");
  const agent = gapFor(s, "agent");
  // The widest row of root agents decides the column, and the outermost cards
  // stick out past the colony centre by half a card.
  const widestRow = Math.min(rootCount, maxPerRow(narrow));
  return Math.max(pad * 2 + CARD_W.specialist, (widestRow - 1) * agent + CARD_W.agent + pad * 2);
};

export function buildTopologyLayout(
  runtime: WorkforceRuntime,
  narrow = false,
  spacingOverride?: Partial<TopologySpacing>
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

  /* The top bands are derived from measured card heights plus the chosen gap,
   * never hand-tuned pixels, so compacting a card or tightening the spacing can
   * never leave the brain overlapping a territory. The brain keeps extra air
   * because it is the single anchor. */
  const Y_SPECIALIST = Y_BRAIN + BRAIN_CARD_H + GAP * 3;
  const Y_AGENT = Y_SPECIALIST + WORKER_CARD_H + GAP * 2;

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
    const widths = liveColonies.map((c) => territoryWidth((rootsByColony.get(c.id) ?? []).length, narrow, spacing));
    const territoryGap = gapFor(spacing, "territory");
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
    const agentGap = gapFor(spacing, "agent");
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
  const subGap = gapFor(spacing, "sub");

  /* Every sub-agent in a band shares ONE lattice of pitch subGap, instead of
   * each parent fanning its own children out from its own centre. The old fan
   * was the bug: two parents side by side, each with two children, put
   * parent A's right child and parent B's left child only 16px apart while the
   * cards are 224px wide, so they painted over each other. It stayed hidden
   * because a lone child has a zero offset, so the old fixture (one sub-agent)
   * could never reproduce it. On a shared lattice no two sub-agents can be
   * closer than subGap, which is card width + gutter by construction — the
   * overlap becomes unrepresentable rather than merely unlikely.
   *
   * Slots are claimed nearest-first, walking outward, so a sub-agent stays
   * roughly under its parent while collisions resolve deterministically in
   * stable sibling order. */
  const takenSlots = new Set<number>();
  const claimSlot = (desired: number): number => {
    const base = Math.round(desired / subGap);
    for (let d = 0; d < 1000; d += 1) {
      for (const candidate of d === 0 ? [base] : [base - d, base + d]) {
        if (!takenSlots.has(candidate)) {
          takenSlots.add(candidate);
          return candidate;
        }
      }
    }
    return base;
  };

  const queue: Array<{ pos: { x: number; y: number }; parentId: string }> = [];
  for (const [id, pos] of Array.from(agents.entries())) queue.push({ pos, parentId: id });
  while (queue.length > 0) {
    const { pos, parentId } = queue.shift() as { pos: { x: number; y: number }; parentId: string };
    const children = childrenOf.get(parentId) ?? [];
    children.forEach((child, k) => {
      const desired = pos.x + (k - (children.length - 1) / 2) * subGap;
      const cPos = { x: claimSlot(desired) * subGap, y: pos.y + subRowOffset(parentId) };
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

  return { brain, territories, agents, subAgents, operations, spacing };
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