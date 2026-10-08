/**
 * Pure, deterministic graph layout and cubic-Bezier edge routing for the
 * Knowledge page.
 *
 * No DOM, no React, no imports — so every geometric invariant can be exercised
 * by a plain Node script (scripts/check-graph-layout.ts) and a bad layout fails
 * the build instead of shipping a picture that looks plausible but is wrong.
 *
 * Model (Step 2: two-column grid placement, fixed card sizes):
 *  - Column 1 holds agents; column 0 holds every non-agent entity (colonies,
 *    missions, memories, tools, unknowns). No layering, no intermediate
 *    columns, so cross-column links are always adjacent.
 *  - Both columns share one 30px grid. Agents take even slots (60px pitch) in
 *    barycenter-sweep order; each source takes the free slot nearest the mean
 *    slot of its agent neighbours (3 free slots minimum between sources).
 *    Orphans drop into a fixed block at the bottom of their column.
 *  - Source cards are 170x76, agent cards 140x44, 8px radius. Cards never grow:
 *    a busier side overflows past the card top/bottom at full port spacing.
 *  - Every edge becomes its own port on a card side — 10px minimum apart on
 *    source cards, 12px on agent cards — sorted by where the other end sits.
 *    Because every target port belongs to exactly one edge, every arrowhead
 *    lands on its own point.
 *  - One routing rule: every edge is a single smooth cubic Bezier with
 *    horizontal tangents at both ends — control points sit at the horizontal
 *    midpoint between the two ends, so a line leaves and enters perpendicular
 *    to the card edge. Same-column edges bulge outward off their side instead
 *    of degenerating. No vertical runs, no lanes, no right-angle corners.
 *  - The drawn curve stops 2px short of the target card edge so the arrowhead
 *    sits against it; the arrow tip itself lands exactly on the port.
 *  - The column gap is derived from the data (the steepest curve stays near a
 *    MAX_SLOPE_DEG angle) rather than hard-coded.
 */

export type Side = "top" | "right" | "bottom" | "left";

export interface LayoutNodeInput {
  key: string;
  type: string;
  label: string;
  degree: number;
}

export interface LayoutEdgeInput {
  id: string;
  source: string;
  target: string;
}

export interface Pt {
  x: number;
  y: number;
}

export interface Cubic {
  p0: Pt;
  p1: Pt;
  p2: Pt;
  p3: Pt;
}

export interface LayoutPort {
  id: string;
  role: "source" | "target";
  side: Side;
  /** Centre of the port along the card side, in px from the card's top edge. */
  offset: number;
  /** Absolute graph position of this port, exactly on the card edge. */
  x: number;
  y: number;
}

export interface LayoutCard {
  key: string;
  type: string;
  label: string;
  degree: number;
  column: number;
  row: number;
  /** Centre of the card. */
  x: number;
  y: number;
  width: number;
  height: number;
  ports: LayoutPort[];
}

export type RouteKind =
  | "adjacent"
  | "backward"
  | "same"
  | "skip"
  | "backward-skip";

export interface LayoutRoute {
  edgeId: string;
  source: string;
  target: string;
  kind: RouteKind;
  /** Bezier segments, source port to target port, in order. */
  cubics: Cubic[];
  /** Dense polyline sample of `cubics`, for drawing fallback and geometry. */
  points: Pt[];
  /** Ready-to-draw SVG path. */
  path: string;
  /** Arrow tip (the target port) and its tangent angle in radians. */
  arrow: Pt;
  arrowAngle: number;
  /** Midpoint of the drawn curve, for the focused-edge label. */
  labelAt: Pt;
  sourcePort: string;
  targetPort: string;
  /** Corridor y for skip routes, otherwise null. */
  corridor: number | null;
}

export interface LayoutZone {
  key: string;
  /** Dominant type, used for the lane's tone. */
  type: string;
  label: string;
  types: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  count: number;
}

export interface LayoutColumn {
  index: number;
  left: number;
  width: number;
  types: string[];
  count: number;
}

export interface LayoutBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface KnowledgeLayout {
  cards: LayoutCard[];
  routes: LayoutRoute[];
  zones: LayoutZone[];
  columns: LayoutColumn[];
  bounds: LayoutBounds;
  rowPitch: number;
  maxCardHeight: number;
  columnGap: number;
}

/** Rendered card metrics, mirrored by the node component and the checker.
 * Cards are fixed: sources (every non-agent entity) 170x76, agents 140x44.
 * Cards never grow to fit ports — busy sides overflow past the card instead. */
export const SOURCE_WIDTH = 170;
export const SOURCE_HEIGHT = 76;
export const AGENT_WIDTH = 140;
export const AGENT_HEIGHT = 44;
export const CARD_RADIUS = 8;

/** Port geometry: minimum px between two ports on one card side. */
export const SOURCE_PORT_MIN_GAP = 10;
export const AGENT_PORT_MIN_GAP = 12;
export const PORT_MIN_GAP = 10;
export const PORT_SPACING = 12;
export const PORT_INSET = 12;

/** Shared grid: every card centre sits on a multiple of GRID. */
export const GRID = 30;
/** Agent rows are two grid units apart; source cards need 3 free units. */
export const AGENT_ROW_STEP = 2;
export const MIN_SOURCE_SLOT_SEP = 3;

/** Row grid (kept for the checker/step-1 callers; the grid is fixed now). */
export const MIN_ROW_PITCH = 96;
export const ROW_GAP = 28;

/** Column gap is derived from the data; these are the floors/ceilings. */
export const MIN_COLUMN_GAP = 250;
export const MAX_COLUMN_GAP = 8000;
export const MAX_SLOPE_DEG = 35;
export const MAX_CROSSING_FRACTION = 0.9;

/** Skip-corridor geometry. */
export const CORRIDOR_SPACING = 10;
export const CORRIDOR_CLEARANCE = 24;
export const CORNER_RADIUS = 0;

/** Same-column track spacing and bend radius. Tracks 16px apart with 5px
 * bends keep every two arcs >= 5px apart except where they properly cross. */
export const TRACK_STEP = 16;
export const BEND_R = 5;

/** Column zone padding, mirrored by the lane component. */
export const LANE_PAD_X = 22;
export const LANE_PAD_Y = 26;
export const LANE_TITLE_H = 30;

/** Column 1 holds agents; column 0 holds every non-agent entity. */
export function isAgentType(type: string): boolean {
  return type === "agent";
}

interface PortSpec {
  id: string;
  edgeId: string;
  role: "source" | "target";
  nodeKey: string;
  side: Side;
  otherRow: number;
  otherKey: string;
  offset: number;
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

/** A straight segment expressed as a degenerate cubic with even spacing. */
function straight(a: Pt, b: Pt): Cubic {
  return {
    p0: a,
    p1: { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 },
    p2: { x: a.x + (2 * (b.x - a.x)) / 3, y: a.y + (2 * (b.y - a.y)) / 3 },
    p3: b,
  };
}

/** Quadratic (P0, control, P2) rendered as a cubic. */
function quadToCubic(p0: Pt, c: Pt, p2: Pt): Cubic {
  return {
    p0,
    p1: { x: p0.x + (2 / 3) * (c.x - p0.x), y: p0.y + (2 / 3) * (c.y - p0.y) },
    p2: { x: p2.x + (2 / 3) * (c.x - p2.x), y: p2.y + (2 / 3) * (c.y - p2.y) },
    p3: p2,
  };
}

/** Sample a cubic Bezier into `n + 1` points (inclusive of both ends). */
export function sampleCubic(c: Cubic, n = 40): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    const x =
      mt * mt * mt * c.p0.x +
      3 * mt * mt * t * c.p1.x +
      3 * mt * t * t * c.p2.x +
      t * t * t * c.p3.x;
    const y =
      mt * mt * mt * c.p0.y +
      3 * mt * mt * t * c.p1.y +
      3 * mt * t * t * c.p2.y +
      t * t * t * c.p3.y;
    pts.push({ x, y });
  }
  return pts;
}

/** Concatenate dense samples of every segment into one polyline. */
export function sampleRoute(cubics: Cubic[], per = 40): Pt[] {
  const out: Pt[] = [];
  cubics.forEach((c, i) => {
    const s = sampleCubic(c, per);
    out.push(...(i === 0 ? s : s.slice(1)));
  });
  return out;
}

function pathOf(cubics: Cubic[]): string {
  if (!cubics.length) return "";
  const fmt = (v: number) => Math.round(v * 100) / 100;
  const first = cubics[0];
  let d = `M ${fmt(first.p0.x)} ${fmt(first.p0.y)}`;
  for (const c of cubics) {
    d += ` C ${fmt(c.p1.x)} ${fmt(c.p1.y)} ${fmt(c.p2.x)} ${fmt(c.p2.y)} ${fmt(c.p3.x)} ${fmt(c.p3.y)}`;
  }
  return d;
}

const percentile = (values: number[], p: number): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[idx];
};

/**
 * Lay out a graph and route every edge. Pure and deterministic: identical input
 * produces byte-identical output, which the checker verifies by running twice.
 */
export function layoutKnowledgeGraph(
  nodesInput: LayoutNodeInput[],
  edgesInput: LayoutEdgeInput[]
): KnowledgeLayout {
  const nodes = nodesInput.map((n) => ({ ...n }));
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const edges = edgesInput
    .filter((e) => byKey.has(e.source) && byKey.has(e.target))
    .map((e) => ({ ...e }));

  // ── Adjacency and orphan detection ───────────────────────────────────────
  const neighbours = new Map<string, string[]>();
  for (const n of nodes) neighbours.set(n.key, []);
  for (const e of edges) {
    neighbours.get(e.source)!.push(e.target);
    neighbours.get(e.target)!.push(e.source);
  }
  const isOrphan = (key: string) => (neighbours.get(key)?.length ?? 0) === 0;

  // ── Columns: agents right, every other entity left ────────────────────────
  const columnFor = (n: LayoutNodeInput) => (isAgentType(n.type) ? 1 : 0);
  const colOfKey = new Map(nodes.map((n) => [n.key, columnFor(n)]));

  const activeNodes = nodes.filter((n) => !isOrphan(n.key));
  const byColumn = new Map<number, LayoutNodeInput[]>();
  for (const n of activeNodes) {
    const col = columnFor(n);
    const list = byColumn.get(col) ?? [];
    list.push(n);
    byColumn.set(col, list);
  }

  const ordered = new Map<number, LayoutNodeInput[]>();
  for (const [col, list] of Array.from(byColumn.entries())) {
    ordered.set(
      col,
      [...list].sort(
        (a, b) =>
          b.degree - a.degree ||
          a.label.localeCompare(b.label) ||
          a.key.localeCompare(b.key)
      )
    );
  }
  const colOrder = Array.from(ordered.keys()).sort((a, b) => a - b);
  const C = colOrder.length;

  // ── Barycenter ordering within columns ───────────────────────────────────
  const estimate = new Map<string, number>();
  const seedEstimate = () => {
    for (const [, list] of Array.from(ordered)) {
      list.forEach((n, i) => estimate.set(n.key, i));
    }
  };
  seedEstimate();

  const sweep = (order: number[]) => {
    for (const col of order) {
      const list = ordered.get(col);
      if (!list || list.length <= 1) continue;
      const score = (n: LayoutNodeInput) => {
        const nbrs = (neighbours.get(n.key) ?? []).filter(
          (k) => colOfKey.get(k) !== col && estimate.has(k)
        );
        if (nbrs.length === 0) return estimate.get(n.key) ?? 0;
        return nbrs.reduce((acc, k) => acc + (estimate.get(k) ?? 0), 0) / nbrs.length;
      };
      const withScore = list.map((n) => ({ n, score: score(n) }));
      withScore.sort(
        (a, b) =>
          a.score - b.score ||
          a.n.label.localeCompare(b.n.label) ||
          a.n.key.localeCompare(b.n.key)
      );
      ordered.set(col, withScore.map((x) => x.n));
      seedEstimate();
    }
  };

  for (let i = 0; i < 4; i++) {
    sweep(i % 2 === 0 ? colOrder : [...colOrder].reverse());
  }

  // ── Row grid: integer slots shared by both columns ────────────────────────
  /* Agents take even slots (60px pitch) in sweep order, so each source's agents
   * stay contiguous. Each source takes the free slot nearest the mean slot of
   * its agent neighbours, keeping 3 free slots (90px) between sources. Orphans
   * drop into a fixed block at the bottom of their column. Slots are integers,
   * so y = slot * GRID always lands on the grid. */
  const rows = new Map<string, number>();
  const agents = ordered.get(1) ?? [];
  agents.forEach((n, i) => rows.set(n.key, i * AGENT_ROW_STEP));

  const agentSlotOf = (key: string): number | undefined => {
    const n = byKey.get(key);
    if (!n || !isAgentType(n.type)) return undefined;
    return rows.get(key);
  };
  const sources = ordered.get(0) ?? [];
  const withDesired = sources.map((n) => {
    const rs = (neighbours.get(n.key) ?? [])
      .map(agentSlotOf)
      .filter((r): r is number => r !== undefined);
    return { n, d: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0 };
  });
  withDesired.sort(
    (a, b) => a.d - b.d || a.n.label.localeCompare(b.n.label) || a.n.key.localeCompare(b.n.key)
  );
  const takenSourceSlots = new Set<number>();
  const sourceSlotFree = (s: number) => {
    for (const t of Array.from(takenSourceSlots)) if (Math.abs(t - s) < MIN_SOURCE_SLOT_SEP) return false;
    return true;
  };
  for (const { n, d } of withDesired) {
    let slot = Math.round(d);
    if (!sourceSlotFree(slot)) {
      for (let dist = 1; ; dist++) {
        if (sourceSlotFree(slot - dist)) { slot -= dist; break; }
        if (sourceSlotFree(slot + dist)) { slot += dist; break; }
      }
    }
    rows.set(n.key, slot);
    takenSourceSlots.add(slot);
  }

  const orphans = nodes
    .filter((n) => isOrphan(n.key))
    .sort(
      (a, b) =>
        columnFor(a) - columnFor(b) ||
        a.label.localeCompare(b.label) ||
        a.key.localeCompare(b.key)
    );
  const usedSlots = Array.from(rows.values());
  const orphanBase = (usedSlots.length ? Math.max(...usedSlots) : -1) + 3;
  const orphanNextByCol = new Map<number, number>();
  for (const n of orphans) {
    const col = columnFor(n);
    const s = orphanNextByCol.get(col) ?? orphanBase;
    rows.set(n.key, s);
    orphanNextByCol.set(col, s + (isAgentType(n.type) ? AGENT_ROW_STEP : MIN_SOURCE_SLOT_SEP));
  }

  // ── Ports: side, order and spacing per card side ─────────────────────────
  const portSpecs: PortSpec[] = [];
  const routeKind = new Map<string, RouteKind>();
  for (const e of edges) {
    const cs = colOfKey.get(e.source)!;
    const ct = colOfKey.get(e.target)!;
    let ss: Side;
    let ts: Side;
    let kind: RouteKind;
    if (cs === ct) {
      // Same-column links bulge off the outward side: left column goes left,
      // every other column goes right. They never run along a border or
      // across a card — the bulge lives in empty space past the column.
      const side: Side = cs === 0 && C > 1 ? "left" : "right";
      ss = side;
      ts = side;
      kind = "same";
    } else if (ct > cs) {
      ss = "right";
      ts = "left";
      kind = ct === cs + 1 ? "adjacent" : "skip";
    } else {
      ss = "left";
      ts = "right";
      kind = cs - ct === 1 ? "backward" : "backward-skip";
    }
    routeKind.set(e.id, kind);
    portSpecs.push({
      id: `p-${e.id}-s`,
      edgeId: e.id,
      role: "source",
      nodeKey: e.source,
      side: ss,
      otherRow: rows.get(e.target) ?? 0,
      otherKey: e.target,
      offset: 0,
    });
    portSpecs.push({
      id: `p-${e.id}-t`,
      edgeId: e.id,
      role: "target",
      nodeKey: e.target,
      side: ts,
      otherRow: rows.get(e.source) ?? 0,
      otherKey: e.source,
      offset: 0,
    });
  }

  const groups = new Map<string, PortSpec[]>();
  for (const p of portSpecs) {
    const key = `${p.nodeKey}|${p.side}`;
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  /* Cards are fixed heights; ports are centred and deliberately unclamped, so
   * a busier side overflows past the card top/bottom instead of crowding. */
  const cardHeightOf = (key: string) => {
    const n = byKey.get(key);
    return n && isAgentType(n.type) ? AGENT_HEIGHT : SOURCE_HEIGHT;
  };
  const portGapOf = (key: string) => {
    const n = byKey.get(key);
    return n && isAgentType(n.type) ? AGENT_PORT_MIN_GAP : SOURCE_PORT_MIN_GAP;
  };
  for (const [, list] of Array.from(groups.entries())) {
    list.sort(
      (a, b) =>
        a.otherRow - b.otherRow ||
        a.otherKey.localeCompare(b.otherKey) ||
        a.edgeId.localeCompare(b.edgeId) ||
        a.role.localeCompare(b.role)
    );
  }

  for (const list of Array.from(groups.values())) {
    const h = cardHeightOf(list[0].nodeKey);
    const gap = portGapOf(list[0].nodeKey);
    const span = (list.length - 1) * gap;
    list.forEach((p, i) => {
      p.offset = (h - span) / 2 + i * gap;
    });
  }
  const rowPitch = GRID;
  const maxCardHeight = SOURCE_HEIGHT;

  // ── Column x positions, gap derived from the data ────────────────────────
  const sourcePortOf = (edgeId: string) =>
    portSpecs.find((p) => p.edgeId === edgeId && p.role === "source")!;
  const targetPortOf = (edgeId: string) =>
    portSpecs.find((p) => p.edgeId === edgeId && p.role === "target")!;
  const yAt = (slot: number) => slot * GRID;
  const portY = (p: PortSpec) =>
    yAt(rows.get(p.nodeKey) ?? 0) - cardHeightOf(p.nodeKey) / 2 + p.offset;

  /* Absolute separation per column side. Ports on one column side share an x
   * across cards, so a port that overflows past its card can land exactly on
   * another card's port — and the two unrelated curves then meet at a point no
   * shared-port exemption covers, reading as a false junction. Pack each
   * column side's card-side intervals top-down as rigid units (intra-card
   * spacing and order never change) with the column's port gap. Overflow is
   * unbounded, so packing always succeeds; the canvas simply grows. */
  {
    const stacksBySide = new Map<
      string,
      { ports: PortSpec[]; span: number; gap: number }[]
    >();
    for (const list of Array.from(groups.values())) {
      const key = list[0].nodeKey;
      const col = colOfKey.get(key)!;
      const sideKey = `${col}|${list[0].side}`;
      const arr = stacksBySide.get(sideKey) ?? [];
      arr.push({
        ports: list,
        span: (list.length - 1) * portGapOf(key),
        gap: col === 1 ? AGENT_PORT_MIN_GAP : SOURCE_PORT_MIN_GAP,
      });
      stacksBySide.set(sideKey, arr);
    }
    const absTop = (ports: PortSpec[]) => {
      const p = ports[0];
      return (
        yAt(rows.get(p.nodeKey) ?? 0) - cardHeightOf(p.nodeKey) / 2 + p.offset
      );
    };
    for (const [, stacks] of Array.from(stacksBySide.entries())) {
      if (stacks.length < 2) continue;
      stacks.sort(
        (a, b) =>
          absTop(a.ports) - absTop(b.ports) ||
          a.ports[0].nodeKey.localeCompare(b.ports[0].nodeKey)
      );
      let cursor = -Infinity;
      for (const st of stacks) {
        const nat = absTop(st.ports);
        const start = Math.max(nat, cursor + st.gap);
        const shift = start - nat;
        if (shift !== 0) for (const p of st.ports) p.offset += shift;
        cursor = start + st.span;
      }
    }
  }
  const adjacentDys: number[] = [];
  for (const e of edges) {
    const kind = routeKind.get(e.id)!;
    if (kind !== "adjacent" && kind !== "backward") continue;
    adjacentDys.push(Math.abs(portY(sourcePortOf(e.id)) - portY(targetPortOf(e.id))));
  }
  /* The gap keeps the steepest curve within MAX_SLOPE_DEG of horizontal,
   * rounded up to the grid so every card centre stays on it. */
  const span = adjacentDys.length ? Math.max(...adjacentDys) : 0;
  const slopeNeed = (1.5 * span) / Math.tan((MAX_SLOPE_DEG * Math.PI) / 180);
  const rawGap = Math.max(MIN_COLUMN_GAP, Math.min(MAX_COLUMN_GAP, slopeNeed));
  const columnGap = Math.ceil(rawGap / GRID) * GRID;

  const colWidth = (col: number) => (col === 1 ? AGENT_WIDTH : SOURCE_WIDTH);
  const colCenter = new Map<number, number>();
  colOrder.forEach((col, i) => {
    if (i === 0) {
      colCenter.set(col, 90);
    } else {
      const prev = colOrder[i - 1];
      const need =
        colCenter.get(prev)! + colWidth(prev) / 2 + columnGap + colWidth(col) / 2;
      colCenter.set(col, Math.ceil(need / GRID) * GRID);
    }
  });
  const colLeft = new Map<number, number>();
  for (const col of colOrder) colLeft.set(col, colCenter.get(col)! - colWidth(col) / 2);

  // ── Cards ────────────────────────────────────────────────────────────────
  const cardByKey = new Map<string, LayoutCard>();
  for (const n of nodes) {
    const col = columnFor(n);
    const height = cardHeightOf(n.key);
    cardByKey.set(n.key, {
      key: n.key,
      type: n.type,
      label: n.label,
      degree: n.degree,
      column: col,
      row: rows.get(n.key) ?? 0,
      x: colCenter.get(col)!,
      y: yAt(rows.get(n.key) ?? 0),
      width: colWidth(col),
      height,
      ports: [],
    });
  }
  for (const [, list] of Array.from(groups.entries())) {
    for (const spec of list) {
      const card = cardByKey.get(spec.nodeKey)!;
      const px =
        spec.side === "right"
          ? card.x + card.width / 2
          : spec.side === "left"
            ? card.x - card.width / 2
            : card.x;
      const py = card.y - card.height / 2 + spec.offset;
      card.ports.push({
        id: spec.id,
        role: spec.role,
        side: spec.side,
        offset: spec.offset,
        x: px,
        y: py,
      });
    }
  }
  const portPoint = (edgeId: string, role: "source" | "target"): Pt => {
    const spec = role === "source" ? sourcePortOf(edgeId) : targetPortOf(edgeId);
    const card = cardByKey.get(spec.nodeKey)!;
    return {
      x: spec.side === "right" ? card.x + card.width / 2 : card.x - card.width / 2,
      y: card.y - card.height / 2 + spec.offset,
    };
  };

  // ── Routes: one smooth cubic per edge ──────────────────────────────────
  /* Same-column arcs ride unique staggered tracks so stacked bulges never
   * overlap: each arc on one outward side gets its own vertical track, 16px
   * apart, handed out shortest-span first (contained arcs nest inside their
   * containers) with edge-id tiebreaks. The arc leaves horizontally, bends
   * onto its track with a tangent-continuous corner, travels, bends back and
   * returns horizontally — no corners anywhere. Deterministic, and the canvas
   * grows to hold every track. */
  const trackOf = new Map<string, number>();
  {
    const edgeById = new Map(edges.map((e) => [e.id, e]));
    const spanOf = (id: string) => {
      const sp = portPoint(id, "source");
      const tp = portPoint(id, "target");
      return Math.abs(tp.y - sp.y);
    };
    const counters = new Map<string, number>();
    const sameIds = edges
      .filter((e) => routeKind.get(e.id) === "same")
      .map((e) => e.id)
      .sort((a, b) => spanOf(a) - spanOf(b) || a.localeCompare(b));
    for (const id of sameIds) {
      const e = edgeById.get(id)!;
      const cs = colOfKey.get(e.source)!;
      const side = sourcePortOf(id).side;
      const key = `${cs}|${side}`;
      const edgeX =
        side === "left" ? colLeft.get(cs)! : colLeft.get(cs)! + colWidth(cs)!;
      const dir = side === "left" ? -1 : 1;
      const k = counters.get(key) ?? 0;
      counters.set(key, k + 1);
      trackOf.set(id, edgeX + dir * (48 + k * TRACK_STEP));
    }
  }
  const routes: LayoutRoute[] = [];
  for (const e of edges) {
    const kind = routeKind.get(e.id)!;
    const sp = portPoint(e.id, "source");
    const tp = portPoint(e.id, "target");
    let cubics: Cubic[];
    if (kind === "same") {
      const dir = sourcePortOf(e.id).side === "left" ? -1 : 1;
      const T = trackOf.get(e.id) ?? sp.x + dir * 48;
      const s = tp.y >= sp.y ? 1 : -1;
      const r = Math.min(BEND_R, (Math.abs(tp.y - sp.y) * 45) / 100);
      const A: Pt = { x: T - dir * r, y: sp.y };
      const B: Pt = { x: T, y: sp.y + s * r };
      const Cc: Pt = { x: T, y: tp.y - s * r };
      const D: Pt = { x: T - dir * r, y: tp.y };
      cubics = [
        straight(sp, A),
        quadToCubic(A, { x: T, y: sp.y }, B),
        straight(B, Cc),
        quadToCubic(Cc, { x: T, y: tp.y }, D),
        straight(D, tp),
      ];
    } else {
      const mx = (sp.x + tp.x) / 2;
      cubics = [
        {
          p0: sp,
          p1: { x: mx, y: sp.y },
          p2: { x: mx, y: tp.y },
          p3: tp,
        },
      ];
    }

    /* The drawn curve stops 2px short of the target edge along its (horizontal)
     * approach so the arrowhead sits against the card. The arrow tip itself
     * lands exactly on the port. */
    const last = cubics[cubics.length - 1];
    const ax = last.p3.x - last.p2.x;
    const ay = last.p3.y - last.p2.y;
    const alen = Math.hypot(ax, ay) || 1;
    const tip: Pt = { x: last.p3.x, y: last.p3.y };
    const drawn: Cubic[] = cubics.map((c, i) =>
      i === cubics.length - 1
        ? { ...c, p3: { x: c.p3.x - (ax / alen) * 2, y: c.p3.y - (ay / alen) * 2 } }
        : c
    );
    const points = sampleRoute(drawn, 40);
    const mid = points[Math.floor(points.length / 2)];
    routes.push({
      edgeId: e.id,
      source: e.source,
      target: e.target,
      kind,
      cubics: drawn,
      points,
      path: pathOf(drawn),
      arrow: tip,
      arrowAngle: Math.atan2(ay, ax),
      labelAt: mid,
      sourcePort: sourcePortOf(e.id).id,
      targetPort: targetPortOf(e.id).id,
      corridor: null,
    });
  }

  // ── Column zones ─────────────────────────────────────────────────────────
  const cardsByCol = new Map<number, LayoutCard[]>();
  for (const c of Array.from(cardByKey.values())) {
    const list = cardsByCol.get(c.column) ?? [];
    list.push(c);
    cardsByCol.set(c.column, list);
  }
  const zones: LayoutZone[] = [];
  const columns: LayoutColumn[] = [];
  for (const col of colOrder) {
    const list = cardsByCol.get(col) ?? [];
    if (!list.length) continue;
    const minY = Math.min(...list.map((c) => c.y - c.height / 2));
    const maxY = Math.max(...list.map((c) => c.y + c.height / 2));
    const types = Array.from(new Set(list.map((c) => c.type))).sort();
    zones.push({
      key: `lane:${col}`,
      type: col === 1 ? "agent" : "colony",
      label: col === 1 ? "Agent" : "Colony and mission",
      types,
      x: colLeft.get(col)! - LANE_PAD_X,
      y: minY - LANE_PAD_Y - LANE_TITLE_H,
      width: colWidth(col) + LANE_PAD_X * 2,
      height: maxY - minY + LANE_PAD_Y * 2 + LANE_TITLE_H,
      count: list.length,
    });
    columns.push({
      index: col,
      left: colLeft.get(col)!,
      width: colWidth(col),
      types,
      count: list.length,
    });
  }

  // ── Bounds ───────────────────────────────────────────────────────────────
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const c of Array.from(cardByKey.values())) {
    grow(c.x - c.width / 2, c.y - c.height / 2);
    grow(c.x + c.width / 2, c.y + c.height / 2);
  }
  for (const z of zones) {
    grow(z.x, z.y);
    grow(z.x + z.width, z.y + z.height);
  }
  for (const r of routes) for (const p of r.points) grow(p.x, p.y);
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  return {
    cards: Array.from(cardByKey.values()),
    routes,
    zones,
    columns,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
    rowPitch,
    maxCardHeight,
    columnGap,
  };
}
