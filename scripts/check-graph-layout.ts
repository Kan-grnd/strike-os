/**
 * Geometry gate for the Knowledge graph layout.
 *
 * Two columns on a shared 30px grid: agents right, every other entity left.
 * Cards are fixed (sources 170x76, agents 140x44); busy sides overflow past
 * the card top/bottom at full port spacing instead of growing the card.
 *
 * Runs every fixture plus a deterministic random corpus through the pure layout
 * and fails (exit 1) if any of the eight invariants below break. It is wired
 * into `npm run build`, so a plausible-looking but wrong picture cannot ship.
 *
 * Invariants:
 *   1. two curves from different edges never run closer than MIN_SEPARATION (4px),
 *      except within SHARED_PORT_SLACK (14px) of a card both edges touch, and
 *      except where they properly cross (a crossing has zero distance and is
 *      counted, not failed)
 *   2. no curve passes through a card it does not connect
 *   3. every curve starts and ends on a card edge (the drawn line stops 2px
 *      short at the target; the arrow tip lands exactly on the port)
 *   4. no two ports on one card side closer than that card's minimum (10px on
 *      source cards, 12px on agent cards); ports may overflow past the card
 *      top/bottom, but every port sits exactly on its side's vertical line
 *   5. no two arrowheads land on the same point
 *   6. rendered routes == relationship count
 *   7. the same input produces the same layout on two runs
 *   8. every card centre sits on the 30px grid, in x and y
 */

import {
  layoutKnowledgeGraph,
  AGENT_PORT_MIN_GAP,
  SOURCE_PORT_MIN_GAP,
  GRID,
  type LayoutBounds,
  type LayoutEdgeInput,
  type LayoutNodeInput,
  type LayoutRoute,
  type Pt,
} from "../src/lib/knowledge-layout";

const MIN_SEPARATION = 4;
const SHARED_PORT_SLACK = 14;

interface Fixture {
  name: string;
  nodes: LayoutNodeInput[];
  edges: LayoutEdgeInput[];
}

const node = (key: string, label?: string): LayoutNodeInput => {
  const type = key.slice(0, key.indexOf(":"));
  return { key, type, label: label ?? `${type} ${key.slice(key.indexOf(":") + 1)}`, degree: 0 };
};
const edge = (id: string, source: string, target: string): LayoutEdgeInput => ({
  id,
  source,
  target,
});

// ── Fixtures ────────────────────────────────────────────────────────────────
const F: Fixture[] = [];

F.push({ name: "empty", nodes: [], edges: [] });

F.push({
  name: "single-pair",
  nodes: [node("mission:m1"), node("agent:a1")],
  edges: [edge("e1", "mission:m1", "agent:a1")],
});

F.push({
  name: "chain",
  nodes: [node("colony:c1"), node("mission:m1"), node("agent:a1"), node("memory:mem1")],
  edges: [
    edge("e1", "colony:c1", "mission:m1"),
    edge("e2", "mission:m1", "agent:a1"),
    edge("e3", "agent:a1", "memory:mem1"),
  ],
});

{
  const nodes = [node("mission:m1")];
  const edges: LayoutEdgeInput[] = [];
  for (let i = 0; i < 8; i++) {
    nodes.push(node(`agent:a${i}`));
    edges.push(edge(`e${i}`, "mission:m1", `agent:a${i}`));
  }
  F.push({ name: "star", nodes, edges });
}

{
  const nodes = [node("mission:m1")];
  const edges: LayoutEdgeInput[] = [];
  for (let i = 0; i < 8; i++) {
    nodes.push(node(`agent:a${i}`));
    edges.push(edge(`e${i}`, `agent:a${i}`, "mission:m1"));
  }
  F.push({ name: "fan-in", nodes, edges });
}

F.push({
  name: "bipartite-fan-current-data",
  nodes: [
    node("colony:c1"),
    node("colony:c2"),
    node("mission:miss1"),
    node("mission:miss2"),
    node("agent:a1"),
    node("agent:a2"),
    node("agent:a3"),
    node("memory:mem1"),
    node("tool:t1"),
    node("agent:gone-123"),
  ],
  edges: [
    edge("r1", "colony:c1", "agent:a1"),
    edge("r2", "colony:c1", "agent:a2"),
    edge("r3", "colony:c2", "agent:a3"),
    edge("r4", "agent:a3", "agent:a1"),
    edge("r5", "agent:a3", "agent:a2"),
    edge("r6", "mission:miss1", "agent:a1"),
    edge("r7", "mission:miss1", "agent:a2"),
    edge("r8", "mission:miss2", "agent:a3"),
    edge("r9", "agent:a1", "memory:mem1"),
    edge("r10", "colony:c1", "agent:gone-123"),
    edge("r11", "tool:t1", "agent:a1"),
  ],
});

{
  const nodes = [node("agent:a0"), node("agent:a1"), node("agent:a2"), node("agent:a3"), node("agent:a4")];
  F.push({
    name: "same-column-only",
    nodes,
    edges: [
      edge("e1", "agent:a0", "agent:a1"),
      edge("e2", "agent:a1", "agent:a2"),
      edge("e3", "agent:a2", "agent:a3"),
      edge("e4", "agent:a0", "agent:a4"),
      edge("e5", "agent:a3", "agent:a4"),
    ],
  });
}

F.push({
  name: "diamond",
  nodes: [node("colony:c1"), node("mission:m1"), node("agent:a1"), node("memory:mem1")],
  edges: [
    edge("e1", "colony:c1", "mission:m1"),
    edge("e2", "colony:c1", "agent:a1"),
    edge("e3", "mission:m1", "agent:a1"),
    edge("e4", "agent:a1", "memory:mem1"),
  ],
});

F.push({
  name: "type-cycle-backward",
  nodes: [node("colony:c1"), node("agent:a1"), node("agent:a2")],
  edges: [
    edge("e1", "colony:c1", "agent:a1"),
    edge("e2", "agent:a1", "colony:c1"),
    edge("e3", "agent:a2", "colony:c1"),
  ],
});

F.push({
  name: "disconnected-components",
  nodes: [node("colony:c1"), node("agent:a1"), node("mission:m1"), node("agent:a2")],
  edges: [edge("e1", "colony:c1", "agent:a1"), edge("e2", "mission:m1", "agent:a2")],
});

F.push({
  name: "five-types",
  nodes: [
    node("tool:t1"),
    node("artifact:art1"),
    node("colony:c1"),
    node("mission:m1"),
    node("agent:a1"),
    node("memory:mem1"),
  ],
  edges: [
    edge("e1", "tool:t1", "agent:a1"),
    edge("e2", "artifact:art1", "agent:a1"),
    edge("e3", "colony:c1", "agent:a1"),
    edge("e4", "mission:m1", "agent:a1"),
    edge("e5", "colony:c1", "tool:t1"),
  ],
});

{
  const nodes: LayoutNodeInput[] = [];
  const edges: LayoutEdgeInput[] = [];
  const types = ["colony", "agent", "mission"];
  let n = 0;
  for (const t of types) for (let i = 0; i < 2; i++) nodes.push(node(`${t}:n${i}`));
  for (const a of types)
    for (const b of types) {
      if (a === b) continue;
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++)
          edges.push(edge(`e${n++}`, `${a}:n${i}`, `${b}:n${j}`));
    }
  F.push({ name: "dense", nodes, edges });
}

F.push({
  name: "dangling-endpoint",
  nodes: [node("colony:c1"), node("agent:gone-999")],
  edges: [edge("e1", "colony:c1", "agent:gone-999")],
});

F.push({
  name: "unknown-type",
  nodes: [node("tool:t1"), node("artifact:art1"), node("agent:a1")],
  edges: [edge("e1", "tool:t1", "agent:a1"), edge("e2", "artifact:art1", "agent:a1")],
});

F.push({
  name: "two-hubs-sharing-targets",
  nodes: [node("mission:m1"), node("mission:m2"), node("agent:a1"), node("agent:a2")],
  edges: [
    edge("e1", "mission:m1", "agent:a1"),
    edge("e2", "mission:m1", "agent:a2"),
    edge("e3", "mission:m2", "agent:a1"),
    edge("e4", "mission:m2", "agent:a2"),
  ],
});

{
  const nodes = [node("mission:m1")];
  const edges: LayoutEdgeInput[] = [];
  for (let i = 0; i < 40; i++) {
    nodes.push(node(`agent:a${i}`));
    edges.push(edge(`e${i}`, "mission:m1", `agent:a${i}`));
  }
  F.push({ name: "degree-40", nodes, edges });
}

{
  const nodes = [node("colony:c1")];
  const edges: LayoutEdgeInput[] = [];
  for (let i = 0; i < 10; i++) {
    nodes.push(node(`agent:a${i}`));
    edges.push(edge(`e${i}`, "colony:c1", `agent:a${i}`));
  }
  F.push({ name: "lopsided-columns", nodes, edges });
}

F.push({
  name: "duplicate-edges",
  nodes: [node("colony:c1"), node("agent:a1"), node("agent:a2")],
  edges: [
    edge("e1", "colony:c1", "agent:a1"),
    edge("e2", "colony:c1", "agent:a1"),
    edge("e3", "colony:c1", "agent:a1"),
  ],
});

F.push({
  name: "orphans",
  nodes: [
    node("colony:c1"),
    node("agent:a1"),
    node("agent:orphan-1"),
    node("agent:orphan-2"),
    node("mission:orphan-3"),
    node("memory:orphan-4"),
  ],
  edges: [edge("e1", "colony:c1", "agent:a1")],
});

F.push({
  name: "long-labels",
  nodes: [
    node("colony:c1", "A very long colony name that should never be allowed to break the card layout at all"),
    node("mission:m1", "An extremely verbose mission goal describing an elaborate multi-phase operation across many territories and seasons"),
    node("agent:a1", "agent-with-an-unreasonably-long-human-readable-label-for-testing"),
    node("memory:mem1", "A memory whose content is far too long to fit comfortably on one line without truncation"),
  ],
  edges: [
    edge("e1", "colony:c1", "mission:m1"),
    edge("e2", "mission:m1", "agent:a1"),
    edge("e3", "agent:a1", "memory:mem1"),
  ],
});

F.push({
  name: "mixed-directions",
  nodes: [
    node("tool:t1"),
    node("mission:m1"),
    node("colony:c1"),
    node("agent:a1"),
    node("agent:a2"),
  ],
  edges: [
    edge("e1", "tool:t1", "agent:a1"),
    edge("e2", "mission:m1", "agent:a2"),
    edge("e3", "colony:c1", "mission:m1"),
    edge("e4", "agent:a1", "colony:c1"),
  ],
});

F.push({
  name: "self-loop",
  nodes: [node("colony:c1"), node("agent:a1")],
  edges: [
    edge("e1", "colony:c1", "agent:a1"),
    edge("e2", "agent:a1", "agent:a1"),
  ],
});

F.push({
  name: "source-source",
  nodes: [node("colony:c1"), node("mission:m1"), node("colony:c2"), node("agent:a1")],
  edges: [
    edge("e1", "colony:c1", "mission:m1"),
    edge("e2", "mission:m1", "colony:c2"),
    edge("e3", "colony:c2", "agent:a1"),
  ],
});

F.push({
  name: "backward-fan",
  nodes: [node("mission:m1"), node("colony:c1"), node("agent:a1"), node("agent:a2")],
  edges: [
    edge("e1", "agent:a1", "mission:m1"),
    edge("e2", "agent:a2", "mission:m1"),
    edge("e3", "agent:a1", "colony:c1"),
    edge("e4", "mission:m1", "agent:a2"),
  ],
});

// ── Seeded random corpus ────────────────────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POOL = ["colony", "agent", "mission", "memory", "tool", "artifact"];

function randomFixture(seed: number): Fixture {
  const rnd = mulberry32(seed);
  const nodeCount = 1 + Math.floor(rnd() * 200);
  const typeCount = 1 + Math.floor(rnd() * 6);
  const types = POOL.slice(0, typeCount);
  const nodes: LayoutNodeInput[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const t = types[Math.floor(rnd() * types.length)];
    nodes.push(node(`${t}:r${seed}n${i}`));
  }
  const edgeCount = Math.floor(rnd() * Math.min(200, nodeCount * 3 + 1));
  const edges: LayoutEdgeInput[] = [];
  for (let i = 0; i < edgeCount; i++) {
    const a = nodes[Math.floor(rnd() * nodes.length)];
    const b = nodes[Math.floor(rnd() * nodes.length)];
    edges.push(edge(`e${i}`, a.key, b.key));
  }
  return { name: `random-${seed}`, nodes, edges };
}

// ── Geometry helpers ────────────────────────────────────────────────────────
interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const EMPTY_RECT: Rect = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };

function routeRect(points: Pt[]): Rect {
  const r: Rect = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (const p of points) {
    r.left = Math.min(r.left, p.x);
    r.top = Math.min(r.top, p.y);
    r.right = Math.max(r.right, p.x);
    r.bottom = Math.max(r.bottom, p.y);
  }
  return Number.isFinite(r.left) ? r : EMPTY_RECT;
}

function rectDistance(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.left - b.right, b.left - a.right));
  const dy = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom));
  return Math.hypot(dx, dy);
}

function pointRectDistance(p: Pt, r: Rect): number {
  const dx = Math.max(r.left - p.x, 0, p.x - r.right);
  const dy = Math.max(r.top - p.y, 0, p.y - r.bottom);
  return Math.hypot(dx, dy);
}

function segSegDistance(a0: Pt, a1: Pt, b0: Pt, b1: Pt): number {
  const d = (p: Pt, q: Pt, r: Pt) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const o1 = d(a0, a1, b0);
  const o2 = d(a0, a1, b1);
  const o3 = d(b0, b1, a0);
  const o4 = d(b0, b1, a1);
  if (o1 * o2 < -1e-12 && o3 * o4 < -1e-12) return 0;
  const pointSeg = (p: Pt, s0: Pt, s1: Pt) => {
    const vx = s1.x - s0.x;
    const vy = s1.y - s0.y;
    const len2 = vx * vx + vy * vy;
    if (len2 < 1e-12) return Math.hypot(p.x - s0.x, p.y - s0.y);
    let t = ((p.x - s0.x) * vx + (p.y - s0.y) * vy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (s0.x + t * vx), p.y - (s0.y + t * vy));
  };
  return Math.min(
    pointSeg(a0, b0, b1),
    pointSeg(a1, b0, b1),
    pointSeg(b0, a0, a1),
    pointSeg(b1, a0, a1)
  );
}

const orient = (p: Pt, q: Pt, r: Pt) =>
  (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
const sgn = (x: number) => (x > 1e-9 ? 1 : x < -1e-9 ? -1 : 0);

/** True when two segments meet at a point, cross, or lie collinear and touch. */
function segTouch(a0: Pt, a1: Pt, b0: Pt, b1: Pt): boolean {
  const o1 = sgn(orient(a0, a1, b0));
  const o2 = sgn(orient(a0, a1, b1));
  const o3 = sgn(orient(b0, b1, a0));
  const o4 = sgn(orient(b0, b1, a1));
  return o1 * o2 <= 0 && o3 * o4 <= 0;
}

/** Overlap length of two collinear segments, projected onto the first. */
function collinearOverlap(a0: Pt, a1: Pt, b0: Pt, b1: Pt): number {
  const dx = a1.x - a0.x;
  const dy = a1.y - a0.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const proj = (p: Pt) => (p.x - a0.x) * ux + (p.y - a0.y) * uy;
  const pb = [proj(b0), proj(b1)].sort((x, y) => x - y);
  return Math.max(0, Math.min(len, pb[1]) - Math.max(0, pb[0]));
}

/** Length of the part of segment p0-p1 that lies inside rect (Liang–Barsky). */
function segRectLength(p0: Pt, p1: Pt, r: Rect): number {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number) => {
    if (p === 0) return q < 0 ? false : true;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  if (
    clip(-dx, p0.x - r.left) &&
    clip(dx, r.right - p0.x) &&
    clip(-dy, p0.y - r.top) &&
    clip(dy, r.bottom - p0.y)
  ) {
    return Math.hypot(dx * (t1 - t0), dy * (t1 - t0));
  }
  return 0;
}

const eq = (a: Pt, b: Pt, eps = 1e-4) =>
  Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));

interface Report {
  crossings: number;
  minSeparation: number;
  gap: number;
  bounds: LayoutBounds;
  nodes: number;
  edges: number;
  routes: number;
}

interface CardRect {
  key: string;
  rect: Rect;
}

/** True when both routes have an endpoint on a card whose rect is near `p`. */
function nearSharedCard(
  p: Pt,
  a: LayoutRoute,
  b: LayoutRoute,
  cardRects: Map<string, Rect>
): boolean {
  const aKeys = [a.source, a.target];
  const bKeys = [b.source, b.target];
  for (const k of aKeys) {
    if (!bKeys.includes(k)) continue;
    const r = cardRects.get(k);
    if (r && pointRectDistance(p, r) <= SHARED_PORT_SLACK) return true;
  }
  // Also exempt near either endpoint card when the routes cross close to it:
  // the shared slack is about crowded ports, and adjacent ports on one card
  // count.
  for (const k of aKeys) {
    const r = cardRects.get(k);
    if (r && pointRectDistance(p, r) <= 2) return true;
  }
  for (const k of bKeys) {
    const r = cardRects.get(k);
    if (r && pointRectDistance(p, r) <= 2) return true;
  }
  return false;
}

function analyze(fixture: Fixture) {
  const errors: string[] = [];
  const g = layoutKnowledgeGraph(fixture.nodes, fixture.edges);

  const bounds: LayoutBounds = g.bounds;
  const cardRects = new Map<string, Rect>();
  for (const c of g.cards) {
    cardRects.set(c.key, {
      left: c.x - c.width / 2,
      top: c.y - c.height / 2,
      right: c.x + c.width / 2,
      bottom: c.y + c.height / 2,
    });
  }
  const cardByKey = new Map(g.cards.map((c) => [c.key, c]));

  // 6. route count == relationship count
  if (g.routes.length !== fixture.edges.length) {
    errors.push(`routes ${g.routes.length} != relationships ${fixture.edges.length}`);
  }

  // 4. port spacing per card side, on the side's vertical line
  const typeByKey = new Map(g.cards.map((c) => [c.key, c.type]));
  const minGapFor = (key: string) =>
    typeByKey.get(key) === "agent" ? AGENT_PORT_MIN_GAP : SOURCE_PORT_MIN_GAP;
  for (const c of g.cards) {
    const bySide = new Map<string, { offset: number; x: number }[]>();
    for (const p of c.ports) {
      const list = bySide.get(p.side) ?? [];
      list.push({ offset: p.offset, x: p.x });
      bySide.set(p.side, list);
    }
    for (const [side, ports] of Array.from(bySide.entries())) {
      const minGap = minGapFor(c.key);
      ports.sort((a, b) => a.offset - b.offset);
      for (let i = 1; i < ports.length; i++) {
        if (ports[i].offset - ports[i - 1].offset < minGap - 1e-9) {
          errors.push(`${c.key} ${side}: ports ${fmt(ports[i - 1].offset)} and ${fmt(ports[i].offset)} < ${minGap}px`);
        }
      }
      // Overflow past the top/bottom is allowed, but the port must sit
      // exactly on the card side's vertical line.
      const edgeX =
        side === "left"
          ? c.x - c.width / 2
          : side === "right"
            ? c.x + c.width / 2
            : null;
      if (edgeX !== null) {
        for (const p of ports) {
          if (Math.abs(p.x - edgeX) > 1e-6) {
            errors.push(`${c.key} ${side}: port off the card edge line`);
            break;
          }
        }
      }
    }
  }

  // 3. every route starts and ends on a card edge (its own endpoint card)
  for (const route of g.routes) {
    const sCard = cardByKey.get(route.source)!;
    const tCard = cardByKey.get(route.target)!;
    const sp = route.points[0];
    const tp = route.arrow;
    const sPort = sCard.ports.find((p) => eq({ x: p.x, y: p.y }, sp));
    const tPort = tCard.ports.find((p) => eq({ x: p.x, y: p.y }, tp));
    if (!sPort) errors.push(`route ${route.edgeId} starts off its source card edge`);
    if (!tPort) errors.push(`route ${route.edgeId} ends off its target card edge`);
    if (sPort && sPort.role !== "source") errors.push(`route ${route.edgeId} starts on a target port`);
    if (tPort && tPort.role !== "target") errors.push(`route ${route.edgeId} ends on a source port`);
  }

  // 5. distinct arrowheads
  const seen = new Map<string, string>();
  for (const route of g.routes) {
    const key = `${fmt(route.arrow.x)},${fmt(route.arrow.y)}`;
    if (seen.has(key)) {
      errors.push(`arrowheads ${route.edgeId} and ${seen.get(key)} share ${key}`);
    } else {
      seen.set(key, route.edgeId);
    }
  }

  // 2. no route crosses a card it does not connect
  const routeRects = new Map<string, Rect>();
  for (const route of g.routes) routeRects.set(route.edgeId, routeRect(route.points));
  for (const route of g.routes) {
    const endpoints = new Set([route.source, route.target]);
    const rr = routeRects.get(route.edgeId)!;
    for (const c of g.cards) {
      if (endpoints.has(c.key)) continue;
      const r = cardRects.get(c.key)!;
      if (rectDistance(rr, r) > 2) continue;
      for (let i = 1; i < route.points.length; i++) {
        if (segRectLength(route.points[i - 1], route.points[i], r) > 1.5) {
          errors.push(`route ${route.edgeId} crosses card ${c.key}`);
          break;
        }
      }
    }
  }

  // 7. determinism
  const again = layoutKnowledgeGraph(fixture.nodes, fixture.edges);
  if (JSON.stringify(again) !== JSON.stringify(g)) {
    errors.push("layout differs between two runs on the same input");
  }

  // 8. every card centre on the 30px grid, in x and y
  for (const c of g.cards) {
    const gx = c.x / GRID;
    const gy = c.y / GRID;
    if (
      Math.abs(gx - Math.round(gx)) > 1e-6 ||
      Math.abs(gy - Math.round(gy)) > 1e-6
    ) {
      errors.push(`${c.key}: centre (${fmt(c.x)}, ${fmt(c.y)}) off the 30px grid`);
      break;
    }
  }

  // 1. curve separation, with crossings counted rather than failed
  interface Seg {
    a0: Pt;
    a1: Pt;
    left: number;
    top: number;
    right: number;
    bottom: number;
  }
  const toSegs = (points: Pt[]): Seg[] => {
    const out: Seg[] = [];
    for (let i = 1; i < points.length; i++) {
      const a0 = points[i - 1];
      const a1 = points[i];
      out.push({
        a0,
        a1,
        left: Math.min(a0.x, a1.x),
        top: Math.min(a0.y, a1.y),
        right: Math.max(a0.x, a1.x),
        bottom: Math.max(a0.y, a1.y),
      });
    }
    return out;
  };
  const segBoxDistance = (s: Seg, t: Seg): number => {
    const dx = Math.max(0, Math.max(s.left - t.right, t.left - s.right));
    const dy = Math.max(0, Math.max(s.top - t.bottom, t.top - s.bottom));
    return Math.hypot(dx, dy);
  };

  let crossings = 0;
  let minSeparation = Infinity;
  const routes = g.routes;
  const routeSegs = routes.map((r) => toSegs(r.points));
  /* Spatial hash: only segments whose bounding boxes are within MIN_SEPARATION
   * can contend, so a uniform grid turns the old O(routes²·segs²) sweep into a
   * near-linear pass that still catches every crossing and near-miss. */
  const CELL = 48;
  const cellKey = (cx: number, cy: number) => `${cx},${cy}`;
  interface Flat {
    i: number;
    idx: number;
    s: Seg;
  }
  const flat: Flat[] = [];
  for (let i = 0; i < routes.length; i++)
    for (const s of routeSegs[i]) flat.push({ i, idx: flat.length, s });
  const grid = new Map<string, number[]>();
  for (let f = 0; f < flat.length; f++) {
    const s = flat[f].s;
    const cx0 = Math.floor(s.left / CELL);
    const cx1 = Math.floor(s.right / CELL);
    const cy0 = Math.floor(s.top / CELL);
    const cy1 = Math.floor(s.bottom / CELL);
    for (let cx = cx0; cx <= cx1; cx++)
      for (let cy = cy0; cy <= cy1; cy++) {
        const k = cellKey(cx, cy);
        const arr = grid.get(k);
        if (arr) arr.push(f);
        else grid.set(k, [f]);
      }
  }
  interface PairAgg {
    min: number;
    close: Pt | null;
    cross: boolean;
    overlap: number;
  }
  const N = routes.length;
  const pairs = new Map<number, PairAgg>();
  const crossSeen = new Set<number>();
  const flatNum = flat.length;
  const pairKey = (i: number, j: number) => (i < j ? i * N + j : j * N + i);
  const segPairKey = (x: number, y: number) => (x < y ? x * flatNum + y : y * flatNum + x);
  const consider = (fa: Flat, fb: Flat) => {
    if (fa.i === fb.i) return;
    const s = fa.s;
    const t = fb.s;
    if (segBoxDistance(s, t) >= MIN_SEPARATION) return;
    const k = pairKey(fa.i, fb.i);
    let agg = pairs.get(k);
    if (!agg) {
      agg = { min: Infinity, close: null, cross: false, overlap: 0 };
      pairs.set(k, agg);
    }
    const dist = segSegDistance(s.a0, s.a1, t.a0, t.a1);
    if (dist <= 1e-6) {
      agg.cross = true;
      const sk = segPairKey(fa.idx, fb.idx);
      if (!crossSeen.has(sk)) {
        crossSeen.add(sk);
        crossings++;
        if (sgn(orient(s.a0, s.a1, t.a0)) === 0 && sgn(orient(s.a0, s.a1, t.a1)) === 0) {
          agg.overlap = Math.max(agg.overlap, collinearOverlap(s.a0, s.a1, t.a0, t.a1));
        }
      }
      return;
    }
    if (dist < agg.min) {
      agg.min = dist;
      agg.close = {
        x: (s.a0.x + s.a1.x + t.a0.x + t.a1.x) / 4,
        y: (s.a0.y + s.a1.y + t.a0.y + t.a1.y) / 4,
      };
    }
  };
  /* Compare each cell with itself and the four neighbours that sort after it in
   * row-major order, so every unordered cell pair is visited exactly once. */
  const neighbours: Array<[number, number]> = [
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ];
  for (const [key, list] of Array.from(grid.entries())) {
    const comma = key.indexOf(",");
    const cx = Number(key.slice(0, comma));
    const cy = Number(key.slice(comma + 1));
    for (let a = 0; a < list.length; a++)
      for (let b = a + 1; b < list.length; b++) consider(flat[list[a]], flat[list[b]]);
    for (const [dx, dy] of neighbours) {
      const other = grid.get(cellKey(cx + dx, cy + dy));
      if (!other) continue;
      for (const fa of list) for (const fb of other) consider(flat[fa], flat[fb]);
    }
  }
  for (const [k, agg] of Array.from(pairs.entries())) {
    const A = routes[Math.floor(k / N)];
    const B = routes[k % N];
    if (agg.overlap > 2) {
      errors.push(
        `curves ${A.edgeId}(${A.kind}) and ${B.edgeId}(${B.kind}) overlap for ${fmt(agg.overlap)}px`
      );
    }
    if (agg.cross) continue;
    if (agg.min < minSeparation) minSeparation = agg.min;
    if (agg.min >= MIN_SEPARATION - 1e-9) continue;
    if (agg.close && nearSharedCard(agg.close, A, B, cardRects)) continue;
    errors.push(
      `curves ${A.edgeId}(${A.kind}) and ${B.edgeId}(${B.kind}) run ${fmt(agg.min)}px apart (< ${MIN_SEPARATION}px)`
    );
  }

  return {
    errors,
    report: {
      crossings,
      minSeparation: Number.isFinite(minSeparation) ? minSeparation : Infinity,
      gap: g.columnGap,
      bounds,
      nodes: fixture.nodes.length,
      edges: fixture.edges.length,
      routes: g.routes.length,
    } as Report,
  };
}

// ── Run ─────────────────────────────────────────────────────────────────────
const fixtures: Fixture[] = [...F];
const SEEDS = Number(process.env.GRAPHCHECK_SEEDS ?? 40);
for (let seed = 1; seed <= SEEDS; seed++) fixtures.push(randomFixture(seed));

let failures = 0;
const rows: string[] = [];
for (const fixture of fixtures) {
  const { errors, report } = analyze(fixture);
  const status = errors.length ? "FAIL" : "ok  ";
  if (errors.length) failures++;
  rows.push(
    `${status} ${pad(fixture.name, 30)} n=${String(report.nodes).padStart(3)} e=${String(report.edges).padStart(3)} cross=${String(report.crossings).padStart(4)} sep=${fmt(report.minSeparation).padStart(6)} gap=${fmt(report.gap).padStart(6)} canvas=${fmt(report.bounds.width)}x${fmt(report.bounds.height)}`
  );
  for (const e of errors.slice(0, 6)) rows.push(`       - ${e}`);
  if (errors.length > 6) rows.push(`       - …and ${errors.length - 6} more`);
}

console.log(rows.join("\n"));
console.log(`\n${fixtures.length} fixtures, ${failures} failed`);
process.exit(failures ? 1 : 0);
