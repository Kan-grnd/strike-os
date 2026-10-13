"use client";

import { Fragment, useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useEditMode, type Shape } from "./edit-mode-provider";

const MIN_DRAG = 5;
/** Finger-sized grab radius for the point-like shapes (pin, text). */
const POINT_HIT = 24;
/** Click radius for the resize handles on a selected shape. */
const CORNER_HIT = 9;
/** Smallest allowed box when resizing. */
const MIN_SIZE = 8;

type Corner = "nw" | "ne" | "sw" | "se";

/** Shape kinds that expose resize handles when selected. */
const RESIZABLE: Shape["type"][] = [
  "rectangle",
  "ellipse",
  "arrow",
  "line",
  "pen",
  "highlighter",
  "blur",
  "redact",
];

const isResizable = (t: Shape["type"]) => RESIZABLE.includes(t);

interface Point {
  x: number;
  y: number;
}

function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function bbox(s: Shape) {
  const xs = [s.x, s.x2];
  const ys = [s.y, s.y2];
  if (s.points) {
    xs.push(...s.points.map((p) => p.x));
    ys.push(...s.points.map((p) => p.y));
  }
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    x2: Math.max(...xs),
    y2: Math.max(...ys),
  };
}

function translate(s: Shape, dx: number, dy: number): Partial<Shape> {
  const patch: Partial<Shape> = {
    x: s.x + dx,
    y: s.y + dy,
    x2: s.x2 + dx,
    y2: s.y2 + dy,
  };
  if (s.points) patch.points = s.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  return patch;
}

/**
 * Drags one corner of a shape's bounding box, keeping the opposite corner
 * fixed. Box shapes snap to the new box; line/arrow/pen/highlighter have their
 * geometry scaled from the old box into the new one, so any orientation works.
 */
function resizeFromCorner(s: Shape, corner: Corner, px: number, py: number): Partial<Shape> {
  const b = bbox(s);
  let nx1 = b.x;
  let ny1 = b.y;
  let nx2 = b.x2;
  let ny2 = b.y2;
  if (corner === "nw") {
    nx1 = px;
    ny1 = py;
  } else if (corner === "ne") {
    nx2 = px;
    ny1 = py;
  } else if (corner === "sw") {
    nx1 = px;
    ny2 = py;
  } else {
    nx2 = px;
    ny2 = py;
  }
  let left = Math.min(nx1, nx2);
  let right = Math.max(nx1, nx2);
  let top = Math.min(ny1, ny2);
  let bottom = Math.max(ny1, ny2);
  if (right - left < MIN_SIZE) right = left + MIN_SIZE;
  if (bottom - top < MIN_SIZE) bottom = top + MIN_SIZE;

  if (s.type === "rectangle" || s.type === "ellipse" || s.type === "blur" || s.type === "redact") {
    return { x: left, y: top, x2: right, y2: bottom };
  }

  const ow = Math.max(1, b.x2 - b.x);
  const oh = Math.max(1, b.y2 - b.y);
  const sx = (right - left) / ow;
  const sy = (bottom - top) / oh;
  const mx = (x: number) => left + (x - b.x) * sx;
  const my = (y: number) => top + (y - b.y) * sy;
  const patch: Partial<Shape> = {
    x: mx(s.x),
    y: my(s.y),
    x2: mx(s.x2),
    y2: my(s.y2),
  };
  if (s.points) patch.points = s.points.map((p) => ({ x: mx(p.x), y: my(p.y) }));
  return patch;
}

function cornersOf(b: { x: number; y: number; x2: number; y2: number }): { corner: Corner; x: number; y: number }[] {
  return [
    { corner: "nw", x: b.x, y: b.y },
    { corner: "ne", x: b.x2, y: b.y },
    { corner: "sw", x: b.x, y: b.y2 },
    { corner: "se", x: b.x2, y: b.y2 },
  ];
}

function hitTest(shapes: Shape[], x: number, y: number): Shape | null {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    const t = Math.max(10, s.strokeWidth + 6);
    if (s.type === "pin" || s.type === "text") {
      if (dist(s.x, s.y, x, y) <= POINT_HIT) return s;
      continue;
    }
    const b = bbox(s);
    if (x < b.x - t || x > b.x2 + t || y < b.y - t || y > b.y2 + t) continue;
    if (s.type === "rectangle" || s.type === "blur" || s.type === "redact") return s;
    if (s.type === "ellipse") {
      const rx = (b.x2 - b.x) / 2 + t;
      const ry = (b.y2 - b.y) / 2 + t;
      const cx = (b.x + b.x2) / 2;
      const cy = (b.y + b.y2) / 2;
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) return s;
      continue;
    }
    return s; // line / arrow / pen / highlighter bbox hit is good enough to select
  }
  return null;
}

const newId = () => `shape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export function ShapeOverlay() {
  const {
    activeTool,
    activeColor,
    strokeWidth,
    activeOpacity,
    activeFill,
    addShape,
    updateShape,
    removeShape,
    shapes,
    selectedId,
    setSelectedId,
  } = useEditMode();

  const svgRef = useRef<SVGSVGElement>(null);

  // Transient gesture state lives in refs, not state: the pointer listeners are
  // registered once per tool instead of being torn down on every move, so a
  // gesture can no longer lose its pointerup mid-drag.
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const drawingRef = useRef(false);
  const startRef = useRef<Point | null>(null);
  const currentRef = useRef<Point | null>(null);
  const penRef = useRef<Point[]>([]);
  const dragRef = useRef<{ id: string; ox: number; oy: number; orig: Shape } | null>(null);
  const resizeRef = useRef<{ id: string; corner: Corner; orig: Shape } | null>(null);
  const hoverHandleRef = useRef<Corner | null>(null);
  const eraserHoverRef = useRef<string | null>(null);

  // Inline text entry replaces the old window.prompt popup.
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string } | null>(null);
  const textDraftRef = useRef(textDraft);
  textDraftRef.current = textDraft;
  const textRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textDraft && textRef.current) {
      textRef.current.focus();
      textRef.current.select();
    }
  }, [textDraft]);

  const isSelect = activeTool === "select";
  const isEraser = activeTool === "eraser";
  const isShapeTool = activeTool !== null && !isSelect && !isEraser;
  const drawing = drawingRef.current;
  const start = startRef.current;
  const current = currentRef.current;
  const penPoints = penRef.current;

  const getPos = useCallback((e: PointerEvent) => ({ x: e.clientX, y: e.clientY }), []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !(isShapeTool || isSelect || isEraser)) return;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      // A pending text label owns the pointer until it is sent or cancelled.
      if (textDraftRef.current) return;
      // Capture the pointer so every move/up of this gesture comes back to the
      // SVG even when it ends over the panel, the header or off the window —
      // without this a stroke released over UI is silently dropped.
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {
        /* capture unsupported — fall back to plain listeners */
      }
      const pos = getPos(e);

      if (isEraser) {
        const hit = hitTest(shapes, pos.x, pos.y);
        if (hit) removeShape(hit.id);
        rerender();
        return;
      }

      if (isSelect) {
        // A resize handle takes precedence over a move drag.
        const sel = shapes.find((s) => s.id === selectedId);
        if (sel && isResizable(sel.type)) {
          const b = bbox(sel);
          for (const c of cornersOf(b)) {
            if (dist(c.x, c.y, pos.x, pos.y) <= CORNER_HIT) {
              resizeRef.current = { id: sel.id, corner: c.corner, orig: sel };
              rerender();
              return;
            }
          }
        }
        const hit = hitTest(shapes, pos.x, pos.y);
        if (hit) {
          setSelectedId(hit.id);
          dragRef.current = { id: hit.id, ox: pos.x, oy: pos.y, orig: hit };
        } else {
          setSelectedId(null);
          dragRef.current = null;
        }
        rerender();
        return;
      }

      drawingRef.current = true;
      startRef.current = pos;
      currentRef.current = pos;
      penRef.current = [pos];
      if (activeTool === "text") setSelectedId(null);
      rerender();
    };

    const onMove = (e: PointerEvent) => {
      if (isEraser) {
        const pos = getPos(e);
        const hit = hitTest(shapes, pos.x, pos.y);
        const next = hit ? hit.id : null;
        if (next !== eraserHoverRef.current) {
          eraserHoverRef.current = next;
          rerender();
        }
        return;
      }

      if (isSelect) {
        const pos = getPos(e);
        const resize = resizeRef.current;
        if (resize) {
          updateShape(resize.id, resizeFromCorner(resize.orig, resize.corner, pos.x, pos.y));
          return;
        }
        const drag = dragRef.current;
        if (drag) {
          updateShape(drag.id, translate(drag.orig, pos.x - drag.ox, pos.y - drag.oy));
          return;
        }
        // Idle hover: highlight the handle under the pointer so the cursor
        // hints at resizing.
        const sel = shapes.find((s) => s.id === selectedId);
        let hover: Corner | null = null;
        if (sel && isResizable(sel.type)) {
          const b = bbox(sel);
          for (const c of cornersOf(b)) {
            if (dist(c.x, c.y, pos.x, pos.y) <= CORNER_HIT) hover = c.corner;
          }
        }
        if (hover !== hoverHandleRef.current) {
          hoverHandleRef.current = hover;
          rerender();
        }
        return;
      }

      if (!drawingRef.current) return;
      const pos = getPos(e);
      currentRef.current = pos;
      if (activeTool === "pen" || activeTool === "highlighter") {
        penRef.current = [...penRef.current, pos];
      }
      rerender();
    };

    const onUp = (e: PointerEvent) => {
      try {
        svg.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
      if (isEraser) return;
      if (isSelect) {
        dragRef.current = null;
        resizeRef.current = null;
        rerender();
        return;
      }
      if (!drawingRef.current || !startRef.current) return;
      const begin = startRef.current;
      const end = getPos(e);
      const points = penRef.current;
      const moved = dist(begin.x, begin.y, end.x, end.y) > MIN_DRAG;
      const base = { color: activeColor, strokeWidth, opacity: activeOpacity };

      drawingRef.current = false;
      startRef.current = null;
      currentRef.current = null;
      penRef.current = [];

      if (activeTool === "rectangle" || activeTool === "ellipse") {
        if (moved) {
          addShape({
            ...base,
            fill: activeFill || undefined,
            id: newId(),
            type: activeTool,
            x: Math.min(begin.x, end.x),
            y: Math.min(begin.y, end.y),
            x2: end.x,
            y2: end.y,
          });
        }
      } else if (activeTool === "blur" || activeTool === "redact") {
        if (moved) {
          addShape({
            ...base,
            id: newId(),
            type: activeTool,
            x: Math.min(begin.x, end.x),
            y: Math.min(begin.y, end.y),
            x2: end.x,
            y2: end.y,
          });
        }
      } else if (activeTool === "arrow" || activeTool === "line") {
        if (moved) {
          addShape({ ...base, id: newId(), type: activeTool, x: begin.x, y: begin.y, x2: end.x, y2: end.y });
        }
      } else if (activeTool === "pen" || activeTool === "highlighter") {
        if (points.length > 1) {
          const xs = points.map((p) => p.x);
          const ys = points.map((p) => p.y);
          addShape({
            ...base,
            id: newId(),
            type: activeTool,
            x: Math.min(...xs),
            y: Math.min(...ys),
            x2: end.x,
            y2: end.y,
            points,
            // Highlighter is a fat, translucent marker regardless of defaults.
            ...(activeTool === "highlighter" ? { strokeWidth: Math.max(strokeWidth, 8), opacity: 0.35 } : {}),
          });
        }
      } else if (activeTool === "pin") {
        addShape({ ...base, id: newId(), type: "pin", x: end.x, y: end.y, x2: end.x, y2: end.y });
      } else if (activeTool === "text") {
        setTextDraft({ x: end.x, y: end.y, value: "" });
      }

      rerender();
    };

    // A cancelled or lost pointer must drop the in-progress gesture instead of
    // leaving a stranded stroke that never commits.
    const onCancel = (e: PointerEvent) => {
      try {
        svg.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
      drawingRef.current = false;
      startRef.current = null;
      currentRef.current = null;
      penRef.current = [];
      dragRef.current = null;
      resizeRef.current = null;
      rerender();
    };

    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onCancel);
    return () => {
      svg.removeEventListener("pointerdown", onDown);
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
      svg.removeEventListener("pointercancel", onCancel);
    };
  }, [
    isSelect,
    isShapeTool,
    isEraser,
    activeTool,
    activeColor,
    strokeWidth,
    activeOpacity,
    activeFill,
    shapes,
    selectedId,
    addShape,
    updateShape,
    removeShape,
    setSelectedId,
    getPos,
  ]);

  // A pending gesture cannot survive a tool change — drop it so the preview
  // never strands a half-drawn shape on screen.
  useEffect(() => {
    drawingRef.current = false;
    startRef.current = null;
    currentRef.current = null;
    penRef.current = [];
    dragRef.current = null;
    resizeRef.current = null;
    hoverHandleRef.current = null;
    eraserHoverRef.current = null;
    rerender();
  }, [activeTool]);

  // Delete removes the selected shape while the select tool is active.
  useEffect(() => {
    if (!isSelect) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
      if (typing) return;
      if (selectedId) {
        e.preventDefault();
        removeShape(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSelect, selectedId, removeShape]);

  const commitText = () => {
    const draft = textDraftRef.current;
    if (!draft) return;
    const label = draft.value.trim().slice(0, 60);
    if (label) {
      addShape({
        id: newId(),
        type: "text",
        x: draft.x,
        y: draft.y,
        x2: draft.x + 40,
        y2: draft.y,
        color: activeColor,
        strokeWidth,
        opacity: activeOpacity,
        label,
      });
    }
    setTextDraft(null);
  };

  const renderShape = (s: Shape, index: number) => {
    const w = Math.abs(s.x2 - s.x);
    const h = Math.abs(s.y2 - s.y);
    const left = Math.min(s.x, s.x2);
    const top = Math.min(s.y, s.y2);
    const b = bbox(s);
    const op = s.opacity ?? 1;
    // A deliberate but tiny drag must still leave a visible mark — never a
    // sub-pixel box the user reads as "nothing happened".
    const rw = Math.max(w, 6);
    const rh = Math.max(h, 6);
    const rleft = w >= 6 ? left : left - (6 - w) / 2;
    const rtop = h >= 6 ? top : top - (6 - h) / 2;

    const selectedRing = selectedId === s.id ? (
      <>
        <rect
          x={b.x - 4}
          y={b.y - 4}
          width={b.x2 - b.x + 8}
          height={b.y2 - b.y + 8}
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={1}
          strokeDasharray="3 2"
          rx={6}
        />
        {isResizable(s.type) &&
          cornersOf(b).map((c) => (
            <rect
              key={c.corner}
              x={c.x - 4}
              y={c.y - 4}
              width={8}
              height={8}
              rx={1.5}
              fill="#0b0b0d"
              stroke="rgba(255,255,255,0.95)"
              strokeWidth={1.25}
            />
          ))}
      </>
    ) : null;

    if (s.type === "rectangle") {
      return (
        <Fragment key={s.id}>
          <rect
            x={rleft}
            y={rtop}
            width={rw}
            height={rh}
            fill={s.fill ? s.color : "none"}
            fillOpacity={s.fill ? 0.2 : undefined}
            stroke={s.color}
            strokeWidth={s.strokeWidth}
            strokeDasharray="6 3"
            rx={4}
            opacity={op}
          />
          {selectedRing}
        </Fragment>
      );
    }

    if (s.type === "ellipse") {
      return (
        <Fragment key={s.id}>
          <ellipse
            cx={rleft + rw / 2}
            cy={rtop + rh / 2}
            rx={rw / 2}
            ry={rh / 2}
            fill={s.fill ? s.color : "none"}
            fillOpacity={s.fill ? 0.2 : undefined}
            stroke={s.color}
            strokeWidth={s.strokeWidth}
            strokeDasharray="6 3"
            opacity={op}
          />
          {selectedRing}
        </Fragment>
      );
    }

    if (s.type === "arrow") {
      const markerId = `arrow-${s.id}`;
      return (
        <Fragment key={s.id}>
          <defs>
            <marker id={markerId} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill={s.color} />
            </marker>
          </defs>
          <line
            x1={s.x}
            y1={s.y}
            x2={s.x2}
            y2={s.y2}
            stroke={s.color}
            strokeWidth={s.strokeWidth}
            markerEnd={`url(#${markerId})`}
            opacity={op}
          />
          {selectedRing}
        </Fragment>
      );
    }

    if (s.type === "line") {
      return (
        <Fragment key={s.id}>
          <line
            x1={s.x}
            y1={s.y}
            x2={s.x2}
            y2={s.y2}
            stroke={s.color}
            strokeWidth={s.strokeWidth}
            strokeLinecap="round"
            opacity={op}
          />
          {selectedRing}
        </Fragment>
      );
    }

    if (s.type === "pen" || s.type === "highlighter") {
      const points = s.points?.map((p) => `${p.x},${p.y}`).join(" ") ?? "";
      return (
        <Fragment key={s.id}>
          <polyline
            points={points}
            fill="none"
            stroke={s.color}
            strokeWidth={s.strokeWidth}
            strokeLinecap={s.type === "highlighter" ? "square" : "round"}
            strokeLinejoin="round"
            opacity={op}
          />
          {selectedRing}
        </Fragment>
      );
    }

    if (s.type === "redact") {
      return (
        <Fragment key={s.id}>
          <rect x={rleft} y={rtop} width={rw} height={rh} fill={s.color} rx={3} opacity={op} />
          {selectedRing}
        </Fragment>
      );
    }

    if (s.type === "blur") {
      // The blur itself is painted by the HTML backdrop layer. A faint outline
      // lives in the SVG so the region is discoverable even on a flat surface
      // where backdrop-filter has nothing to blur.
      return (
        <Fragment key={s.id}>
          <rect
            x={rleft}
            y={rtop}
            width={rw}
            height={rh}
            rx={4}
            fill="none"
            stroke="rgba(148,163,184,0.55)"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={op}
          />
          {selectedRing}
        </Fragment>
      );
    }

    if (s.type === "pin") {
      return (
        <Fragment key={s.id}>
          <circle cx={s.x} cy={s.y} r={11} fill={s.color} stroke="rgba(0,0,0,0.55)" strokeWidth={1.5} opacity={op} />
          <text
            x={s.x}
            y={s.y + 0.5}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight={700}
            fill="#fff"
            opacity={op}
          >
            {index + 1}
          </text>
          {selectedRing}
        </Fragment>
      );
    }

    if (s.type === "text" && s.label) {
      return (
        <Fragment key={s.id}>
          <text
            x={s.x}
            y={s.y}
            fontSize={14}
            fontWeight={600}
            fill={s.color}
            textAnchor="middle"
            dominantBaseline="central"
            opacity={op}
          >
            <tspan style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.6)", strokeWidth: 3, strokeLinejoin: "round" }}>
              {s.label}
            </tspan>
          </text>
          {selectedRing}
        </Fragment>
      );
    }

    return null;
  };

  const renderPreview = () => {
    if (!drawing || !start || !current || !activeTool || activeTool === "select" || activeTool === "eraser")
      return null;

    if (activeTool === "rectangle") {
      return (
        <rect
          x={Math.min(start.x, current.x)}
          y={Math.min(start.y, current.y)}
          width={Math.abs(current.x - start.x)}
          height={Math.abs(current.y - start.y)}
          fill={activeFill ? activeColor : "none"}
          fillOpacity={activeFill ? 0.2 : undefined}
          stroke={activeColor}
          strokeWidth={strokeWidth}
          strokeDasharray="6 3"
          rx={4}
          opacity={0.6}
        />
      );
    }
    if (activeTool === "ellipse") {
      return (
        <ellipse
          cx={(start.x + current.x) / 2}
          cy={(start.y + current.y) / 2}
          rx={Math.abs(current.x - start.x) / 2}
          ry={Math.abs(current.y - start.y) / 2}
          fill={activeFill ? activeColor : "none"}
          fillOpacity={activeFill ? 0.2 : undefined}
          stroke={activeColor}
          strokeWidth={strokeWidth}
          strokeDasharray="6 3"
          opacity={0.6}
        />
      );
    }
    if (activeTool === "blur" || activeTool === "redact") {
      return (
        <rect
          x={Math.min(start.x, current.x)}
          y={Math.min(start.y, current.y)}
          width={Math.abs(current.x - start.x)}
          height={Math.abs(current.y - start.y)}
          fill={activeTool === "redact" ? activeColor : "rgba(120,120,130,0.25)"}
          stroke={activeColor}
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.75}
        />
      );
    }
    if (activeTool === "arrow") {
      const mid = `prev-arrow`;
      return (
        <>
          <defs>
            <marker id={mid} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill={activeColor} />
            </marker>
          </defs>
          <line
            x1={start.x}
            y1={start.y}
            x2={current.x}
            y2={current.y}
            stroke={activeColor}
            strokeWidth={strokeWidth}
            markerEnd={`url(#${mid})`}
            opacity={0.7}
          />
        </>
      );
    }
    if (activeTool === "line") {
      return (
        <line
          x1={start.x}
          y1={start.y}
          x2={current.x}
          y2={current.y}
          stroke={activeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.7}
        />
      );
    }
    if (activeTool === "pen" || activeTool === "highlighter") {
      const pts = penPoints.map((p) => `${p.x},${p.y}`).join(" ");
      return (
        <polyline
          points={pts}
          fill="none"
          stroke={activeColor}
          strokeWidth={activeTool === "highlighter" ? Math.max(strokeWidth, 8) : strokeWidth}
          strokeLinecap={activeTool === "highlighter" ? "square" : "round"}
          strokeLinejoin="round"
          opacity={activeTool === "highlighter" ? 0.35 : 0.7}
        />
      );
    }
    if (activeTool === "pin" || activeTool === "text") {
      return <circle cx={current.x} cy={current.y} r={6} fill={activeColor} opacity={0.7} />;
    }
    return null;
  };

  const eraserHover = eraserHoverRef.current
    ? shapes.find((s) => s.id === eraserHoverRef.current)
    : null;
  const hoverHandle = hoverHandleRef.current;
  const cursor = isSelect
    ? hoverHandle === "nw" || hoverHandle === "se"
      ? "nwse-resize"
      : hoverHandle === "ne" || hoverHandle === "sw"
        ? "nesw-resize"
        : "default"
    : isEraser
      ? "cell"
      : "crosshair";

  const blurShapes = shapes.filter((s) => s.type === "blur");

  return (
    <>
      {/* Backdrop blur lives in HTML: SVG cannot blur what is behind it. Sits
          under the annotation SVG so rings and strokes stay on top. */}
      {blurShapes.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-[80]">
          {blurShapes.map((s) => (
            <div
              key={s.id}
              style={{
                position: "absolute",
                left: Math.min(s.x, s.x2),
                top: Math.min(s.y, s.y2),
                width: Math.max(6, Math.abs(s.x2 - s.x)),
                height: Math.max(6, Math.abs(s.y2 - s.y)),
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                background: "rgba(148,163,184,0.10)",
                opacity: s.opacity ?? 1,
              }}
            />
          ))}
        </div>
      )}

      <svg
        ref={svgRef}
        className="fixed inset-0 z-[80]"
        style={{
          pointerEvents: isShapeTool || isSelect || isEraser ? "auto" : "none",
          cursor,
          touchAction: "none",
          userSelect: "none",
          width: "100vw",
          height: "100vh",
        }}
      >
        {shapes.map(renderShape)}
        {eraserHover &&
          (() => {
            const b = bbox(eraserHover);
            return (
              <rect
                x={b.x - 4}
                y={b.y - 4}
                width={b.x2 - b.x + 8}
                height={b.y2 - b.y + 8}
                fill="none"
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                rx={6}
                opacity={0.9}
              />
            );
          })()}
        {renderPreview()}
      </svg>

      {textDraft && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            commitText();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setTextDraft(null);
            }
          }}
          className="fixed z-[97] flex items-center gap-1.5"
          style={{
            left: Math.max(8, Math.min(textDraft.x, typeof window === "undefined" ? 8 : window.innerWidth - 240)),
            top: Math.max(8, Math.min(textDraft.y - 16, typeof window === "undefined" ? 8 : window.innerHeight - 48)),
          }}
        >
          <input
            ref={textRef}
            value={textDraft.value}
            onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
            placeholder="Label"
            maxLength={60}
            aria-label="Text label"
            className="h-9 w-44 rounded-xl border border-cyan-400/50 bg-background px-2 text-sm shadow-lg outline-none"
          />
          <button
            type="submit"
            className="h-9 rounded-xl bg-cyan-400 px-3 text-xs font-semibold text-black shadow-lg"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setTextDraft(null)}
            className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium text-muted-foreground shadow-lg"
          >
            Cancel
          </button>
        </form>
      )}
    </>
  );
}
