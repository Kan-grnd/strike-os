"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditMode, type Shape } from "./edit-mode-provider";

const MIN_DRAG = 5;

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
    const t = Math.max(8, s.strokeWidth + 5);
    if (s.type === "pin" || s.type === "text") {
      if (dist(s.x, s.y, x, y) <= 16) return s;
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

export function ShapeOverlay() {
  const { activeTool, activeColor, strokeWidth, addShape, updateShape, removeShape, shapes, selectedId, setSelectedId } =
    useEditMode();
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);
  const [penPoints, setPenPoints] = useState<{ x: number; y: number }[]>([]);
  const [drag, setDrag] = useState<{ id: string; ox: number; oy: number; orig: Shape } | null>(null);

  const isSelect = activeTool === "select";
  const isShapeTool = activeTool !== null && !isSelect;

  const getPos = useCallback((e: PointerEvent) => ({ x: e.clientX, y: e.clientY }), []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !(isShapeTool || isSelect)) return;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const pos = getPos(e);
      if (isSelect) {
        const hit = hitTest(shapes, pos.x, pos.y);
        if (hit) {
          setSelectedId(hit.id);
          setDrag({ id: hit.id, ox: pos.x, oy: pos.y, orig: hit });
        } else {
          setSelectedId(null);
          setDrag(null);
        }
        return;
      }
      setDrawing(true);
      setStart(pos);
      setCurrent(pos);
      setPenPoints([pos]);
      if (activeTool === "text") setSelectedId(null);
    };

    const onMove = (e: PointerEvent) => {
      const pos = getPos(e);
      if (isSelect) {
        if (drag) {
          updateShape(drag.id, translate(drag.orig, pos.x - drag.ox, pos.y - drag.oy));
        }
        return;
      }
      if (!drawing) return;
      setCurrent(pos);
      if (activeTool === "pen") setPenPoints((prev) => [...prev, pos]);
    };

    const onUp = (e: PointerEvent) => {
      if (isSelect) {
        setDrag(null);
        return;
      }
      if (!drawing || !start) return;
      const end = getPos(e);
      const moved = dist(start.x, start.y, end.x, end.y) > MIN_DRAG;
      const base = {
        color: activeColor,
        strokeWidth,
      };

      if (activeTool === "rectangle" || activeTool === "ellipse") {
        if (moved) {
          addShape({
            ...base,
            id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: activeTool!,
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
            x2: end.x,
            y2: end.y,
          });
        }
      } else if (activeTool === "arrow" || activeTool === "line" || activeTool === "pen") {
        if (activeTool === "pen") {
          if (penPoints.length > 1) {
            const xs = penPoints.map((p) => p.x);
            const ys = penPoints.map((p) => p.y);
            addShape({
              ...base,
              id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: "pen",
              x: Math.min(...xs),
              y: Math.min(...ys),
              x2: end.x,
              y2: end.y,
              points: penPoints,
            });
          }
        } else if (moved) {
          addShape({
            ...base,
            id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: activeTool!,
            x: start.x,
            y: start.y,
            x2: end.x,
            y2: end.y,
          });
        }
      } else if (activeTool === "pin") {
        addShape({
          ...base,
          id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: "pin",
          x: end.x,
          y: end.y,
          x2: end.x,
          y2: end.y,
        });
      } else if (activeTool === "text") {
        let label: string | null = null;
        try {
          label = window.prompt("Text label", "");
        } catch {
          label = null;
        }
        if (label && label.trim()) {
          addShape({
            ...base,
            id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: "text",
            x: end.x,
            y: end.y,
            x2: end.x + 40,
            y2: end.y,
            label: label.trim().slice(0, 60),
          });
        }
      }

      setDrawing(false);
      setStart(null);
      setCurrent(null);
      setPenPoints([]);
    };

    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    return () => {
      svg.removeEventListener("pointerdown", onDown);
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
    };
  }, [isSelect, isShapeTool, drawing, start, activeTool, activeColor, strokeWidth, drag, penPoints, addShape, updateShape, shapes]);

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

  const renderShape = (s: Shape, index: number) => {
    const w = Math.abs(s.x2 - s.x);
    const h = Math.abs(s.y2 - s.y);
    const left = Math.min(s.x, s.x2);
    const top = Math.min(s.y, s.y2);
    const key = `sel-${s.id}`;

    const selectedRing = selectedId === s.id ? (
      <rect
        key={key}
        x={bbox(s).x - 4}
        y={bbox(s).y - 4}
        width={bbox(s).x2 - bbox(s).x + 8}
        height={bbox(s).y2 - bbox(s).y + 8}
        fill="none"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth={1}
        strokeDasharray="3 2"
        rx={6}
      />
    ) : null;

    if (s.type === "rectangle") {
      return <>
        <rect key={s.id} x={left} y={top} width={w} height={h} fill="none" stroke={s.color} strokeWidth={s.strokeWidth} strokeDasharray="6 3" rx={4} />
        {selectedRing}
      </>;
    }

    if (s.type === "ellipse") {
      return <>
        <ellipse key={s.id} cx={left + w / 2} cy={top + h / 2} rx={w / 2} ry={h / 2} fill="none" stroke={s.color} strokeWidth={s.strokeWidth} strokeDasharray="6 3" />
        {selectedRing}
      </>;
    }

    if (s.type === "arrow") {
      const markerId = `arrow-${s.id}`;
      return <>
        <defs>
          <marker id={markerId} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={s.color} />
          </marker>
        </defs>
        <line key={s.id} x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={s.strokeWidth} markerEnd={`url(#${markerId})`} />
        {selectedRing}
      </>;
    }

    if (s.type === "line") {
      return <>
        <line key={s.id} x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={s.strokeWidth} strokeLinecap="round" />
        {selectedRing}
      </>;
    }

    if (s.type === "pen") {
      const points = s.points?.map((p) => `${p.x},${p.y}`).join(" ") ?? "";
      return <>
        <polyline key={s.id} points={points} fill="none" stroke={s.color} strokeWidth={s.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        {selectedRing}
      </>;
    }

    if (s.type === "pin") {
      return <>
        <circle key={s.id} cx={s.x} cy={s.y} r={9} fill={s.color} stroke="rgba(0,0,0,0.5)" strokeWidth={1} />
        <text x={s.x} y={s.y + 0.5} textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={700} fill="#fff">
          {index + 1}
        </text>
        {selectedRing}
      </>;
    }

    if (s.type === "text" && s.label) {
      return <>
        <text key={s.id} x={s.x} y={s.y} fontSize={14} fontWeight={600} fill={s.color} textAnchor="middle" dominantBaseline="central">
          <tspan style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.6)", strokeWidth: 3, strokeLinejoin: "round" }}>{s.label}</tspan>
        </text>
        {selectedRing}
      </>;
    }

    return null;
  };

  const renderPreview = () => {
    if (!drawing || !start || !current || !activeTool || activeTool === "select") return null;
    const base = { color: activeColor, strokeWidth };

    if (activeTool === "rectangle") {
      return <rect x={Math.min(start.x, current.x)} y={Math.min(start.y, current.y)} width={Math.abs(current.x - start.x)} height={Math.abs(current.y - start.y)} fill="none" stroke={activeColor} strokeWidth={strokeWidth} strokeDasharray="6 3" rx={4} opacity={0.6} />;
    }
    if (activeTool === "ellipse") {
      return <ellipse cx={(start.x + current.x) / 2} cy={(start.y + current.y) / 2} rx={Math.abs(current.x - start.x) / 2} ry={Math.abs(current.y - start.y) / 2} fill="none" stroke={activeColor} strokeWidth={strokeWidth} strokeDasharray="6 3" opacity={0.6} />;
    }
    if (activeTool === "arrow") {
      const mid = `prev-${Date.now()}`;
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
      return <circle cx={current.x} cy={current.y} r={5} fill={activeColor} stroke={activeColor} strokeWidth={1} opacity={0.7} />;
    }
    return null;
  };

  return (
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
  );
}