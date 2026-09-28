"use client";

import { Fragment, useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useEditMode, type Shape } from "./edit-mode-provider";

const MIN_DRAG = 5;
/** Finger-sized grab radius for the point-like shapes (pin, text). */
const POINT_HIT = 24;

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
    if (s.type === "rectangle") return s;
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
    return s; // line / arrow / pen bbox hit is good enough to select
  }
  return null;
}

const newId = () => `shape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export function ShapeOverlay() {
  const { activeTool, activeColor, strokeWidth, addShape, updateShape, removeShape, shapes, selectedId, setSelectedId } =
    useEditMode();

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
  const isShapeTool = activeTool !== null && !isSelect;
  const drawing = drawingRef.current;
  const start = startRef.current;
  const current = currentRef.current;
  const penPoints = penRef.current;

  const getPos = useCallback((e: PointerEvent) => ({ x: e.clientX, y: e.clientY }), []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !(isShapeTool || isSelect)) return;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      // A pending text label owns the pointer until it is sent or cancelled.
      if (textDraftRef.current) return;
      const pos = getPos(e);
      if (isSelect) {
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
      if (isSelect) {
        const drag = dragRef.current;
        if (drag) {
          const pos = getPos(e);
          updateShape(drag.id, translate(drag.orig, pos.x - drag.ox, pos.y - drag.oy));
        }
        return;
      }
      if (!drawingRef.current) return;
      const pos = getPos(e);
      currentRef.current = pos;
      if (activeTool === "pen") {
        penRef.current = [...penRef.current, pos];
      }
      rerender();
    };

    const onUp = (e: PointerEvent) => {
      if (isSelect) {
        dragRef.current = null;
        rerender();
        return;
      }
      if (!drawingRef.current || !startRef.current) return;
      const begin = startRef.current;
      const end = getPos(e);
      const points = penRef.current;
      const moved = dist(begin.x, begin.y, end.x, end.y) > MIN_DRAG;
      const base = { color: activeColor, strokeWidth };

      drawingRef.current = false;
      startRef.current = null;
      currentRef.current = null;
      penRef.current = [];

      if (activeTool === "rectangle" || activeTool === "ellipse") {
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
      } else if (activeTool === "pen") {
        if (points.length > 1) {
          const xs = points.map((p) => p.x);
          const ys = points.map((p) => p.y);
          addShape({
            ...base,
            id: newId(),
            type: "pen",
            x: Math.min(...xs),
            y: Math.min(...ys),
            x2: end.x,
            y2: end.y,
            points,
          });
        }
      } else if (activeTool === "pin") {
        addShape({ ...base, id: newId(), type: "pin", x: end.x, y: end.y, x2: end.x, y2: end.y });
      } else if (activeTool === "text") {
        setTextDraft({ x: end.x, y: end.y, value: "" });
      }

      rerender();
    };

    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    return () => {
      svg.removeEventListener("pointerdown", onDown);
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
    };
  }, [isSelect, isShapeTool, activeTool, activeColor, strokeWidth, shapes, addShape, updateShape, setSelectedId, getPos]);

  // A pending gesture cannot survive a tool change — drop it so the preview
  // never strands a half-drawn shape on screen.
  useEffect(() => {
    drawingRef.current = false;
    startRef.current = null;
    currentRef.current = null;
    penRef.current = [];
    dragRef.current = null;
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

    const selectedRing = selectedId === s.id ? (
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
    ) : null;

    if (s.type === "rectangle") {
      return <Fragment key={s.id}>
        <rect x={left} y={top} width={w} height={h} fill="none" stroke={s.color} strokeWidth={s.strokeWidth} strokeDasharray="6 3" rx={4} />
        {selectedRing}
      </Fragment>;
    }

    if (s.type === "ellipse") {
      return <Fragment key={s.id}>
        <ellipse cx={left + w / 2} cy={top + h / 2} rx={w / 2} ry={h / 2} fill="none" stroke={s.color} strokeWidth={s.strokeWidth} strokeDasharray="6 3" />
        {selectedRing}
      </Fragment>;
    }

    if (s.type === "arrow") {
      const markerId = `arrow-${s.id}`;
      return <Fragment key={s.id}>
        <defs>
          <marker id={markerId} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={s.color} />
          </marker>
        </defs>
        <line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={s.strokeWidth} markerEnd={`url(#${markerId})`} />
        {selectedRing}
      </Fragment>;
    }

    if (s.type === "line") {
      return <Fragment key={s.id}>
        <line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={s.strokeWidth} strokeLinecap="round" />
        {selectedRing}
      </Fragment>;
    }

    if (s.type === "pen") {
      const points = s.points?.map((p) => `${p.x},${p.y}`).join(" ") ?? "";
      return <Fragment key={s.id}>
        <polyline points={points} fill="none" stroke={s.color} strokeWidth={s.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        {selectedRing}
      </Fragment>;
    }

    if (s.type === "pin") {
      return <Fragment key={s.id}>
        <circle cx={s.x} cy={s.y} r={11} fill={s.color} stroke="rgba(0,0,0,0.55)" strokeWidth={1.5} />
        <text x={s.x} y={s.y + 0.5} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="#fff">
          {index + 1}
        </text>
        {selectedRing}
      </Fragment>;
    }

    if (s.type === "text" && s.label) {
      return <Fragment key={s.id}>
        <text x={s.x} y={s.y} fontSize={14} fontWeight={600} fill={s.color} textAnchor="middle" dominantBaseline="central">
          <tspan style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.6)", strokeWidth: 3, strokeLinejoin: "round" }}>{s.label}</tspan>
        </text>
        {selectedRing}
      </Fragment>;
    }

    return null;
  };

  const renderPreview = () => {
    if (!drawing || !start || !current || !activeTool || activeTool === "select") return null;

    if (activeTool === "rectangle") {
      return <rect x={Math.min(start.x, current.x)} y={Math.min(start.y, current.y)} width={Math.abs(current.x - start.x)} height={Math.abs(current.y - start.y)} fill="none" stroke={activeColor} strokeWidth={strokeWidth} strokeDasharray="6 3" rx={4} opacity={0.6} />;
    }
    if (activeTool === "ellipse") {
      return <ellipse cx={(start.x + current.x) / 2} cy={(start.y + current.y) / 2} rx={Math.abs(current.x - start.x) / 2} ry={Math.abs(current.y - start.y) / 2} fill="none" stroke={activeColor} strokeWidth={strokeWidth} strokeDasharray="6 3" opacity={0.6} />;
    }
    if (activeTool === "arrow") {
      const mid = `prev-arrow`;
      return <>
        <defs>
          <marker id={mid} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={activeColor} />
          </marker>
        </defs>
        <line x1={start.x} y1={start.y} x2={current.x} y2={current.y} stroke={activeColor} strokeWidth={strokeWidth} markerEnd={`url(#${mid})`} opacity={0.7} />
      </>;
    }
    if (activeTool === "line") {
      return <line x1={start.x} y1={start.y} x2={current.x} y2={current.y} stroke={activeColor} strokeWidth={strokeWidth} strokeLinecap="round" opacity={0.7} />;
    }
    if (activeTool === "pen") {
      const pts = penPoints.map((p) => `${p.x},${p.y}`).join(" ");
      return <polyline points={pts} fill="none" stroke={activeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />;
    }
    if (activeTool === "pin" || activeTool === "text") {
      return <circle cx={current.x} cy={current.y} r={6} fill={activeColor} opacity={0.7} />;
    }
    return null;
  };

  return (
    <>
      <svg
        ref={svgRef}
        className="fixed inset-0 z-[80]"
        style={{
          pointerEvents: isShapeTool || isSelect ? "auto" : "none",
          cursor: isSelect ? "default" : "crosshair",
          width: "100vw",
          height: "100vh",
        }}
      >
        {shapes.map(renderShape)}
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
            className="h-9 w-44 rounded-md border border-cyan-400/50 bg-background px-2 text-sm shadow-lg outline-none"
          />
          <button
            type="submit"
            className="h-9 rounded-md bg-cyan-400 px-3 text-xs font-semibold text-black shadow-lg"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setTextDraft(null)}
            className="h-9 rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground shadow-lg"
          >
            Cancel
          </button>
        </form>
      )}
    </>
  );
}
