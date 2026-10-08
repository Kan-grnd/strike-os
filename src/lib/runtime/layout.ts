import type { AgentRuntime, ColonyRuntime, TaskRuntime, WorkforceRuntime } from "./types";

/**
 * Deterministic layout engine.
 *
 * The STRIKE BRAIN is the origin of graph space and never moves. Everything
 * else is derived from hierarchy + a deterministic sibling order — never a
 * force simulation, never random.
 *
 * One shape, at every viewport size: a top-down tidy tree. The brain is the
 * topmost card in the graph, colonies hang below it, and each worker's
 * children (sub-agents and operations side by side) hang below their parent.
 * Distances are fixed config constants, never a fraction of the canvas or
 * viewport: neighbouring boxes are exactly `TIDY_SIBLING_GAP` apart and each
 * depth band starts exactly `TIDY_LEVEL_GAP` below the previous band's
 * bottom edge. A two-colony graph is compact; a forty-agent colony grows by
 * the same fixed steps. The viewport chooses the camera, never the shape.
 *
 * Positions come from hierarchy only. Transient relationship edges
 * (delegation, communication, verification) are drawn on top of the tree and
 * never move a node. Collapsed colonies contribute only their own card width.
 *
 * Positions use the measured node sizes when the caller has them (the canvas
 * feeds React Flow's measurements back in), falling back to the rendered card
 * sizes below. No single fixed node width is assumed anywhere.
 */

export interface TopologyLayout {
  brain: { x: number; y: number };
  territories: Map<string, { x: number; y: number }>;
  agents: Map<string, { x: number; y: number }>;
  subAgents: Map<string, { x: number; y: number }>;
  operations: Map<string, { x: number; y: number }>;
}

/** Fixed layout distances, in graph px, in one place. */
/** Exact edge-to-edge gap between neighbouring node boxes at every level. */
export const TIDY_SIBLING_GAP = 32;
/** Exact gap between one depth band's bottom edge and the next band's top.
 *  72 gives the orb room to breathe above the colony row; the reference's
 *  primary `--level-gap` is 88 and its secondary is 72. */
export const TIDY_LEVEL_GAP = 72;
/** Children wider than this wrap into additional rows instead of widening
 *  the tree without limit. Wide enough that two full agent rows (3 x 220px
 *  plus gaps = 724px each) sit side by side with room to spare. */
export const TIDY_MAX_ROW_WIDTH = 2400;

/* Fallback card heights for the custom node family, measured from the
 * reference (`strike_topology (1).html`). The live canvas feeds React Flow's
 * measured sizes back into the layout, so these only matter before measurement
 * lands (SSR, tests): the colony's 28px folder tab overflows above the body
 * box rather than inflating it, so the body is only its own padding plus
 * content. */
const SPECIALIST_CARD_H = 80;
const AGENT_CARD_H = 78;
const SUB_CARD_H = 75;
const OP_CARD_H = 75;

const REMOVED_STATES = new Set(["cancelled", "stopped"]);

/** The brain is a circular orb, not a card: one square size drives its width
 *  reservation, its band anchor and its edge-anchor centre. Reference: 200px
 *  ring canvas with a 140px sphere inset at 30,30. */
const BRAIN_ORB = 200;

/** Rendered card widths for the custom node family, in px (reference
 *  `--colony-w` / `--agent-w` / `--task-w`). */
const CARD_W = {
  brain: BRAIN_ORB,
  specialist: 260,
  agent: 220,
  sub: 200,
  operation: 200,
} as const;

/** Brain height (the orb's diameter). The colony band starts one level gap
 *  below the orb's bottom edge. */
const BRAIN_CARD_H = BRAIN_ORB;

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
  specialist: { w: CARD_W.specialist, h: SPECIALIST_CARD_H },
  agent: { w: CARD_W.agent, h: AGENT_CARD_H },
  sub: { w: CARD_W.sub, h: SUB_CARD_H },
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

/** Measured node size override, keyed by node id. The canvas feeds React
 *  Flow's measured width/height back into the layout; anything missing falls
 *  back to the rendered card sizes, so the engine never assumes one width. */
export interface TidyNodeSize {
  w: number;
  h: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/* ── Walker tidy-tree core ────────────────────────────────────────────────
 * Positions are assigned by the Buchheim–Jünger–Leipert linear-time version
 * of the Reingold–Tilford tidy-tree algorithm — the moral equivalent of
 * d3-hierarchy's `tree().nodeSize([1, levelGap])` with a separation function
 * of `(widthA + widthB) / 2 + siblingGap`, implemented directly so the layout
 * needs no new dependency and every step stays visible in this file.
 *
 * The property that makes it the right algorithm: any two neighbouring boxes
 * at the same depth end up exactly `separation` apart on their centres, i.e.
 * exactly `TIDY_SIBLING_GAP` edge to edge, and every parent is centred over
 * its children. All coordinates are centre-x; the caller converts to the
 * centre-x/top-y convention React Flow uses (`nodeOrigin={[0.5, 0]}`).
 *
 * Everything here is a pure function of the tree, so the same data always
 * produces the same pixels: no randomness, no viewport input, no iteration
 * order except the stable sibling order the tree is built in. */
type TidyKind = "brain" | "specialist" | "agent" | "subagent" | "operation";

interface TidyNode {
  id: string;
  kind: TidyKind;
  w: number;
  h: number;
  depth: number;
  parent: TidyNode | null;
  children: TidyNode[];
  prelim: number;
  mod: number;
  ancestor: TidyNode;
  thread: TidyNode | null;
  change: number;
  shift: number;
  /** 1-based position among siblings; drives the shift distribution. */
  index: number;
  x: number;
  y: number;
}

/** Centre-to-centre distance of two neighbouring boxes. */
const tidySeparation = (a: TidyNode, b: TidyNode): number =>
  (a.w + b.w) / 2 + TIDY_SIBLING_GAP;

const tidyLeftSibling = (v: TidyNode): TidyNode | null =>
  v.parent && v.index > 1 ? v.parent.children[v.index - 2] : null;

const tidyNextLeft = (v: TidyNode): TidyNode | null =>
  v.children.length > 0 ? v.children[0] : v.thread;

const tidyNextRight = (v: TidyNode): TidyNode | null => {
  const n = v.children.length;
  return n > 0 ? v.children[n - 1] : v.thread;
};

function tidyMoveSubtree(wl: TidyNode, wr: TidyNode, shift: number): void {
  const subtrees = wr.index - wl.index;
  if (subtrees === 0) return;
  wr.change -= shift / subtrees;
  wr.shift += shift;
  wl.change += shift / subtrees;
  wr.prelim += shift;
  wr.mod += shift;
}

function tidyAncestor(vil: TidyNode, v: TidyNode, defaultAncestor: TidyNode): TidyNode {
  return vil.ancestor.parent === v.parent ? vil.ancestor : defaultAncestor;
}

function tidyApportion(v: TidyNode, defaultAncestor: TidyNode): TidyNode {
  const w = tidyLeftSibling(v);
  if (!w) return defaultAncestor;
  let vir = v;
  let vor = v;
  let vil = w;
  let vol = v.parent!.children[0];
  let sir = vir.mod;
  let sor = vor.mod;
  let sil = vil.mod;
  let sol = vol.mod;
  while (tidyNextRight(vil) && tidyNextLeft(vir)) {
    vil = tidyNextRight(vil)!;
    vir = tidyNextLeft(vir)!;
    vol = tidyNextLeft(vol)!;
    vor = tidyNextRight(vor)!;
    vor.ancestor = v;
    const shift = vil.prelim + sil - (vir.prelim + sir) + tidySeparation(vir, vil);
    if (shift > 0) {
      const a = tidyAncestor(vil, v, defaultAncestor);
      tidyMoveSubtree(a, v, shift);
      sir += shift;
      sor += shift;
    }
    sil += vil.mod;
    sir += vir.mod;
    sol += vol.mod;
    sor += vor.mod;
  }
  const vilRight = tidyNextRight(vil);
  const virLeft = tidyNextLeft(vir);
  if (vilRight && !virLeft) {
    vor.thread = vilRight;
    vor.mod += sil - sor;
  } else if (virLeft && !tidyNextLeft(vol)) {
    vol.thread = virLeft;
    vol.mod += sir - sol;
  }
  return defaultAncestor;
}

function tidyExecuteShifts(v: TidyNode): void {
  let shift = 0;
  let change = 0;
  for (let i = v.children.length - 1; i >= 0; i -= 1) {
    const w = v.children[i];
    w.prelim += shift;
    w.mod += shift;
    change += w.change;
    shift += w.shift + change;
  }
}

function tidyFirstWalk(v: TidyNode): void {
  if (v.children.length === 0) {
    const l = tidyLeftSibling(v);
    v.prelim = l ? l.prelim + tidySeparation(v, l) : 0;
  } else {
    let defaultAncestor = v.children[0];
    for (const w of v.children) {
      tidyFirstWalk(w);
      defaultAncestor = tidyApportion(w, defaultAncestor);
    }
    tidyExecuteShifts(v);
    const first = v.children[0];
    const last = v.children[v.children.length - 1];
    const midpoint = (first.prelim + last.prelim) / 2;
    const l = tidyLeftSibling(v);
    if (l) {
      v.prelim = l.prelim + tidySeparation(v, l);
      v.mod = v.prelim - midpoint;
    } else {
      v.prelim = midpoint;
    }
  }
}

function tidySecondWalk(v: TidyNode, m: number): void {
  v.x = v.prelim + m;
  for (const w of v.children) tidySecondWalk(w, m + v.mod);
}

/* ── Row wrapping ─────────────────────────────────────────────────────────
 * A parent whose children are wider than `TIDY_MAX_ROW_WIDTH` wraps them into
 * additional rows below instead of widening the tree without limit. This
 * applies to the children of a single parent (agents, tasks) — sibling
 * colonies are never split across rows unless there are more than 4 of them,
 * so two colonies always sit side by side under the sphere. Each
 * chunk row is centred on the parent, so the parent stays centred over the
 * union of its children; rows stack with `TIDY_SIBLING_GAP` pitch that clears
 * the full translated content above, so wrapped rows can never land on
 * another subtree. Member subtrees move rigidly, which preserves every exact
 * gap inside them; only the wrapped rows themselves are new geometry. */

interface TidySpan {
  minX: number;
  maxX: number;
}

/** Horizontal extent of a node card plus every descendant card. */
function tidySubtreeSpan(v: TidyNode): TidySpan {
  let minX = v.x - v.w / 2;
  let maxX = v.x + v.w / 2;
  for (const c of v.children) {
    const s = tidySubtreeSpan(c);
    if (s.minX < minX) minX = s.minX;
    if (s.maxX > maxX) maxX = s.maxX;
  }
  return { minX, maxX };
}

/** Lowest card bottom edge in a subtree. */
function tidySubtreeBottom(v: TidyNode): number {
  let bottom = v.y + v.h;
  for (const c of v.children) bottom = Math.max(bottom, tidySubtreeBottom(c));
  return bottom;
}

/** Rigid translation: the whole subtree keeps its internal geometry. */
function tidyTranslate(v: TidyNode, dx: number, dy: number): void {
  v.x += dx;
  v.y += dy;
  for (const c of v.children) tidyTranslate(c, dx, dy);
}

/** Width of members laid left to right with exact sibling gaps. */
function tidyRowWidth(members: TidyNode[]): number {
  if (members.length === 0) return 0;
  let w = -TIDY_SIBLING_GAP;
  for (const m of members) {
    const s = tidySubtreeSpan(m);
    w += s.maxX - s.minX + TIDY_SIBLING_GAP;
  }
  return w;
}

/** Greedy chunks in stable order: fill each row, then start the next. Fill
 *  order is what keeps existing rows still when a node is added — an addition
 *  only ever extends the last chunk or opens a new one below it. */
function tidyChunkMembers(members: TidyNode[]): TidyNode[][] {
  const chunks: TidyNode[][] = [];
  let cur: TidyNode[] = [];
  let curW = 0;
  for (const m of members) {
    const s = tidySubtreeSpan(m);
    const mw = s.maxX - s.minX;
    if (cur.length > 0 && curW + TIDY_SIBLING_GAP + mw > TIDY_MAX_ROW_WIDTH) {
      chunks.push(cur);
      cur = [];
      curW = 0;
    }
    cur.push(m);
    curW += (cur.length === 1 ? mw : mw + TIDY_SIBLING_GAP);
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks;
}

/** Restore exact sibling gaps across one row, anchoring its left edge where
 *  it is. Every member subtree moves rigidly, so all exact gaps inside the
 *  moved subtrees survive; then the row is recentered on its parent, which
 *  keeps every parent centred over its children. */
function tidyRecompactRow(a: TidyNode): void {
  if (a.children.length === 0) return;
  let cursor = Infinity;
  for (const c of a.children) {
    const s = tidySubtreeSpan(c);
    if (s.minX < cursor) cursor = s.minX;
  }
  for (const c of a.children) {
    const s = tidySubtreeSpan(c);
    tidyTranslate(c, cursor - s.minX, 0);
    cursor += s.maxX - s.minX + TIDY_SIBLING_GAP;
  }
  const first = a.children[0];
  const last = a.children[a.children.length - 1];
  const dx = a.x - (first.x + last.x) / 2;
  if (dx !== 0) for (const c of a.children) tidyTranslate(c, dx, 0);
}

/** Wrap one over-wide parent's children into centred chunk rows and repair
 *  the rows above it. Chunk rows stack below the full translated content of
 *  the previous chunk, so a wrapped row can never land on another subtree;
 *  the upward walk restores exact gaps and centering level by level. Only
 *  horizontal translations happen above the chunks, so no band ever moves. */
function tidyWrapParent(p: TidyNode): void {
  const kids = p.children;
  if (kids.length < 2 || tidyRowWidth(kids) <= TIDY_MAX_ROW_WIDTH) return;
  const chunks = tidyChunkMembers(kids);
  if (chunks.length < 2) return;
  let rowY = kids[0].y;
  for (const chunk of chunks) {
    const cw = tidyRowWidth(chunk);
    let cursor = p.x - cw / 2;
    for (const m of chunk) {
      const s = tidySubtreeSpan(m);
      tidyTranslate(m, cursor - s.minX, rowY - m.y);
      cursor += s.maxX - s.minX + TIDY_SIBLING_GAP;
    }
    let bottom = rowY;
    for (const m of chunk) bottom = Math.max(bottom, tidySubtreeBottom(m));
    rowY = bottom + TIDY_SIBLING_GAP;
  }
  let a: TidyNode | null = p.parent;
  while (a) {
    tidyRecompactRow(a);
    a = a.parent;
  }
}

/* ── Tidy tree assembly ───────────────────────────────────────────────────
 * The tree is hierarchy only: brain → colonies → agents → sub-agents and
 * operations as siblings in one child row. Transient edges never appear here.
 * Collapsed colonies contribute only their own card; a worker's children are
 * the visible sub-agents plus the visible operations, stably ordered. */
export function buildTidyTopologyLayout(
  runtime: WorkforceRuntime,
  expanded: ReadonlySet<string> = new Set(),
  sizes?: ReadonlyMap<string, TidyNodeSize>
): TopologyLayout {

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

  // ── Sub-agent tree and operation ownership ──
  const childrenOf = new Map<string, AgentRuntime[]>();
  for (const agent of liveSubAgents) {
    if (!agent.parentId) continue;
    const list = childrenOf.get(agent.parentId) ?? [];
    list.push(agent);
    childrenOf.set(agent.parentId, list);
  }
  const opsByOwner = new Map<string, TaskRuntime[]>();
  for (const task of liveOps) {
    if (!task.ownerAgentId) continue;
    const list = opsByOwner.get(task.ownerAgentId) ?? [];
    list.push(task);
    opsByOwner.set(task.ownerAgentId, list);
  }

  /* Tree assembly: hierarchy only. Colonies always appear; agents appear when
   * their colony is expanded; sub-agents and operations appear when their
   * owner's toggle is set. A worker's children mix sub-agents and operations
   * in one row, stably ordered by creation time then id. */
  const sizeOf = (kind: TidyKind, id: string): { w: number; h: number } => {
    const measured = sizes?.get(id);
    if (measured && measured.w > 0 && measured.h > 0) return { w: measured.w, h: measured.h };
    if (kind === "brain") return { w: CARD_SIZE.brain.w, h: CARD_SIZE.brain.h };
    if (kind === "specialist") return { w: CARD_W.specialist, h: SPECIALIST_CARD_H };
    if (kind === "agent") return { w: CARD_W.agent, h: AGENT_CARD_H };
    if (kind === "subagent") return { w: CARD_W.sub, h: SUB_CARD_H };
    return { w: CARD_W.operation, h: OP_CARD_H };
  };
  const mkNode = (id: string, kind: TidyKind, depth: number, parent: TidyNode | null): TidyNode => {
    const s = sizeOf(kind, id);
    const node: TidyNode = {
      id, kind, w: s.w, h: s.h, depth, parent, children: [],
      prelim: 0, mod: 0, ancestor: null as unknown as TidyNode, thread: null,
      change: 0, shift: 0, index: parent ? parent.children.length + 1 : 1, x: 0, y: 0,
    };
    node.ancestor = node;
    return node;
  };
  /* `visited` is the cycle guard: a parent loop would otherwise recurse
   * forever. An agent whose parent never attaches (a removed ancestor) stays
   * out of the tree, and its operations park below the graph. */
  const visited = new Set<string>(["brain"]);
  const brainNode = mkNode("brain", "brain", 0, null);
  const attachAgent = (parent: TidyNode, agent: AgentRuntime, depth: number): void => {
    if (visited.has(agent.id)) return;
    visited.add(agent.id);
    const node = mkNode(agent.id, agent.parentId ? "subagent" : "agent", depth, parent);
    parent.children.push(node);
    const kids: Array<{ id: string; at: number; agent?: AgentRuntime; task?: TaskRuntime }> = [];
    if (expanded.has(agent.id + ":sub")) {
      for (const sub of childrenOf.get(agent.id) ?? []) {
        kids.push({ id: sub.id, at: epoch(sub.createdAt), agent: sub });
      }
    }
    if (expanded.has(agent.id + ":ops")) {
      for (const task of opsByOwner.get(agent.id) ?? []) {
        kids.push({ id: task.id, at: epoch(task.timestamps.createdAt), task });
      }
    }
    kids.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const kid of kids) {
      if (kid.agent) attachAgent(node, kid.agent, depth + 1);
      else if (kid.task && !visited.has(kid.task.id)) {
        visited.add(kid.task.id);
        node.children.push(mkNode(kid.task.id, "operation", depth + 1, node));
      }
    }
  };
  for (const colony of liveColonies) {
    const node = mkNode(colony.id, "specialist", 1, brainNode);
    brainNode.children.push(node);
    if (!expanded.has(colony.id)) continue;
    for (const agent of rootsByColony.get(colony.id) ?? []) attachAgent(node, agent, 2);
  }

  /* Vertical bands: one fixed band per depth, starting one level gap below the
   * previous band's bottom edge. Band tops depend only on the tallest card per
   * band, so adding nodes never moves an existing band. */
  const maxH = new Map<number, number>();
  const walkH = (n: TidyNode): void => {
    maxH.set(n.depth, Math.max(maxH.get(n.depth) ?? 0, n.h));
    for (const c of n.children) walkH(c);
  };
  walkH(brainNode);
  const topOf = new Map<number, number>([[0, 0]]);
  for (let d = 1; maxH.has(d); d += 1) {
    topOf.set(d, (topOf.get(d - 1) ?? 0) + (maxH.get(d - 1) ?? 0) + TIDY_LEVEL_GAP);
  }
  const walkY = (n: TidyNode): void => {
    n.y = topOf.get(n.depth) ?? 0;
    for (const c of n.children) walkY(c);
  };
  walkY(brainNode);

  /* Horizontal centres: one Walker pass, which puts neighbouring boxes at the
   * same depth exactly one sibling gap apart and every parent over its own
   * children. */
  tidyFirstWalk(brainNode);
  tidySecondWalk(brainNode, -brainNode.prelim);

  /* Row wrapping with repair, deepest parents first. Only translations happen
   * here — horizontal above the chunks, vertical for the chunks themselves —
   * so band tops of existing rows never move. The brain is exempt unless it
   * parents more than 4 colonies: sibling colonies are never split across
   * rows, so a colony's edge can never be forced to run behind another
   * colony's nodes. */
  const all: TidyNode[] = [];
  const collect = (n: TidyNode): void => {
    all.push(n);
    for (const c of n.children) collect(c);
  };
  collect(brainNode);
  const overWide = all
    .filter((n) => n.children.length > 1 && tidyRowWidth(n.children) > TIDY_MAX_ROW_WIDTH)
    .filter((n) => n.kind !== "brain" || n.children.length > 4)
    .sort((a, b) => b.depth - a.depth || a.x - b.x);
  for (const p of overWide) tidyWrapParent(p);

  /* The repair cascade may have moved the brain; the origin is non-negotiable. */
  if (brainNode.x !== 0) {
    const dx = brainNode.x;
    const shiftAll = (n: TidyNode): void => {
      n.x -= dx;
      for (const c of n.children) shiftAll(c);
    };
    shiftAll(brainNode);
  }

  const territories = new Map<string, { x: number; y: number }>();
  const agents = new Map<string, { x: number; y: number }>();
  const subAgents = new Map<string, { x: number; y: number }>();
  const operations = new Map<string, { x: number; y: number }>();
  const placedIds = new Set<string>(["brain"]);
  const fill = (n: TidyNode): void => {
    const pos = { x: n.x, y: n.y };
    if (n.kind === "specialist") territories.set(n.id, pos);
    else if (n.kind === "agent") agents.set(n.id, pos);
    else if (n.kind === "subagent") subAgents.set(n.id, pos);
    else if (n.kind === "operation") operations.set(n.id, pos);
    placedIds.add(n.id);
    for (const c of n.children) fill(c);
  };
  fill(brainNode);

  /* An operation whose owner never attached (cancelled, or in an archived
   * colony) is parked under the whole graph rather than dropped at the
   * origin — which is the middle of the graph, i.e. on top of the brain. */
  let lowest = 0;
  const bottomWalk = (n: TidyNode): void => {
    lowest = Math.max(lowest, n.y + n.h);
    for (const c of n.children) bottomWalk(c);
  };
  bottomWalk(brainNode);
  let unowned = 0;
  for (const task of liveOps) {
    if (placedIds.has(task.id)) continue;
    operations.set(task.id, { x: 0, y: lowest + TIDY_LEVEL_GAP + unowned * (OP_CARD_H + TIDY_SIBLING_GAP) });
    unowned += 1;
  }

  return {
    brain: { x: brainNode.x, y: brainNode.y },
    territories,
    agents,
    subAgents,
    operations,
  };
}

export function specialistLabel(colony: ColonyRuntime): string {
  return colony.name.replace(/\s+Colony$/i, "").trim() || colony.name;
}

/* ── Camera fit ───────────────────────────────────────────────────────────
 * The layout never sees the viewport, so fitting is entirely the camera's
 * job: frame the whole tree with a fixed pixel padding, never zooming in past
 * 100% and never auto-zooming out below 40%. Past the floor the graph is
 * simply bigger than the pane — a navigation state, not a layout failure —
 * and the user pans. Manual pan/zoom is never overridden: the page only
 * re-fits when the graph no longer fits, and `reset view` always re-fits. */

export const FIT_PADDING = 24;
/** Never zoom in beyond 100%: cards are drawn at their real size or smaller. */
export const FIT_MAX_ZOOM = 1.0;
/** The canvas clamps at this; the fit estimate has to clamp the same way.
 *  Below it, fitting stops and panning takes over. */
export const FIT_MIN_ZOOM = 0.4;
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
  const out: Placed[] = [{ ...layout.brain, w: CARD_SIZE.brain.w, h: CARD_SIZE.brain.h }];
  for (const p of Array.from(layout.territories.values())) out.push({ ...p, w: CARD_W.specialist, h: SPECIALIST_CARD_H });
  for (const p of Array.from(layout.agents.values())) out.push({ ...p, w: CARD_W.agent, h: AGENT_CARD_H });
  for (const p of Array.from(layout.subAgents.values())) out.push({ ...p, w: CARD_W.sub, h: SUB_CARD_H });
  for (const p of Array.from(layout.operations.values())) out.push({ ...p, w: CARD_W.operation, h: OP_CARD_H });
  return out;
}

/** The zoom that frames this graph in this pane with a fixed pixel padding,
 *  clamped the same way the canvas clamps it: never above 100%, never below
 *  the 40% floor where panning takes over. */
export function fitZoomFor(bounds: Placed[], viewport: ViewportSize): number {
  const box = boxOf(bounds);
  if (!box) return FIT_MAX_ZOOM;
  const zoomX = viewport.w / (Math.max(1, box.w) + FIT_PADDING * 2);
  const zoomY = viewport.h / (Math.max(1, box.h) + FIT_PADDING * 2);
  return Math.min(FIT_MAX_ZOOM, Math.max(FIT_MIN_ZOOM, Math.min(zoomX, zoomY)));
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

/* ── Top-aligned framing ─────────────────────────────────────────────────────
 * The brain is the graph's origin and its topmost card, so "where the brain
 * lands on screen" is really "where the camera puts the top of the graph". A
 * centred fit floats it near the middle, which reads as a graph that starts
 * arbitrarily low; pulling the top down by one headroom makes the brain the
 * first thing the eye meets on load, with air above it. This is a camera
 * decision only — the layout still keeps the brain at graph-space y=0. */

/** Headroom above the graph, as a share of the usable pane height, clamped. It
 *  is deliberately kept below the fit-padding headroom (`1 + FIT_PADDING`
 *  already reserves ~15% around the graph): a larger value could push a graph
 *  that fitted before past the bottom edge. */
export const FIT_TOP_HEADROOM_RATIO = 0.06;
export const FIT_TOP_HEADROOM_MIN = 24;
export const FIT_TOP_HEADROOM_MAX = 64;

/** The top margin the camera leaves above the graph, given the free area. */
export function fitTopHeadroom(usable: ViewportSize): number {
  return clamp(usable.h * FIT_TOP_HEADROOM_RATIO, FIT_TOP_HEADROOM_MIN, FIT_TOP_HEADROOM_MAX);
}

/** Like fitTransformFor, but pins the top of the graph a fixed headroom below
 *  the top of the free area instead of centring it vertically. The zoom is fit
 *  against the free area *minus* the headroom, so the pin can never push the
 *  bottom edge off the pane; horizontal centring matches fitTransformFor. This
 *  is what Fit-all uses to frame the whole tree. */
export function fitTopAlignedTransformFor(
  cards: Placed[],
  usable: ViewportSize,
  headroom: number = fitTopHeadroom(usable)
): { x: number; y: number; zoom: number } {
  const box = boxOf(cards);
  if (!box || usable.w <= 0 || usable.h <= 0) {
    return { x: 0, y: 0, zoom: FIT_MAX_ZOOM };
  }
  const centreX = (box.minX + box.maxX) / 2;
  const zoom = fitZoomFor(cards, { w: usable.w, h: Math.max(1, usable.h - headroom) });
  return {
    zoom,
    x: usable.w / 2 - centreX * zoom,
    y: headroom - box.minY * zoom,
  };
}

/** Sphere-centred readable framing: the given zoom, with the brain's centre
 *  at the centre of the free area. Auto-fit calls this at exactly 1.0; Reset
 *  view at min(1.0, whole-tree fit). */
export function fitReadableTransformFor(
  brainCenter: { x: number; y: number },
  usable: ViewportSize,
  zoom: number
): { x: number; y: number; zoom: number } {
  return {
    zoom,
    x: usable.w / 2 - brainCenter.x * zoom,
    y: usable.h / 2 - brainCenter.y * zoom,
  };
}

/* ── Top-anchored framing ────────────────────────────────────────────────
 * The sphere is never centred vertically: at zoom 1.0 its 190px box top sits
 * 56px below the pane top and its centre x sits on the pane centre x, so the
 * tree grows downward and the top half is never empty. Expanding or collapsing
 * below cannot move the sphere — only its x recentres when the tree widens —
 * and the same anchor serves load, Reset and the untouched auto-fit. */

/** Top-anchored readable framing at the given zoom. Pure. */
export function fitTopAnchoredTransformFor(
  brainCenterX: number,
  brainTop: number,
  usable: ViewportSize,
  zoom: number
): { x: number; y: number; zoom: number } {
  return {
    zoom,
    x: usable.w / 2 - brainCenterX * zoom,
    y: 56 - brainTop * zoom,
  };
}

/** Fit-all framing: the whole tree inside 56px top / 24px side padding,
 *  centred on the tree, down to the 0.4 floor. Pure. */
export function fitAllTransformFor(
  cards: Placed[],
  usable: ViewportSize
): { x: number; y: number; zoom: number } {
  const box = boxOf(cards);
  if (!box || usable.w <= 0 || usable.h <= 0) {
    return { x: 0, y: 0, zoom: FIT_MAX_ZOOM };
  }
  const availW = Math.max(1, usable.w - 24 * 2);
  const availH = Math.max(1, usable.h - 56 - 24);
  const zoom = Math.min(FIT_MAX_ZOOM, Math.max(FIT_MIN_ZOOM, Math.min(availW / Math.max(1, box.w), availH / Math.max(1, box.h))));
  const centreX = (box.minX + box.maxX) / 2;
  return {
    zoom,
    x: usable.w / 2 - centreX * zoom,
    y: 56 - box.minY * zoom,
  };
}

/** Live zoom readout: viewport zoom as a whole percent. */
export function formatZoomPct(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
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
