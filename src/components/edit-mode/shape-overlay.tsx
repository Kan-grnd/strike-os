"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditMode, type Shape } from "./edit-mode-provider";

export function ShapeOverlay() {
  const { activeTool, activeColor, addShape, shapes } = useEditMode();
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);

  const isActive = activeTool !== null;

  const getPos = useCallback((e: PointerEvent) => {
    return { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    if (!isActive) return;
    const svg = svgRef.current;
    if (!svg) return;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const pos = getPos(e);
      setDrawing(true);
      setStart(pos);
      setCurrent(pos);
    };

    const onMove = (e: PointerEvent) => {
      if (!drawing) return;
      setCurrent(getPos(e));
    };

    const onUp = (e: PointerEvent) => {
      if (!drawing || !start) return;
      const end = getPos(e);
      const dx = Math.abs(end.x - start.x);
      const dy = Math.abs(end.y - start.y);

      if (dx > 5 || dy > 5) {
        addShape({
          id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: activeTool!,
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          x2: end.x,
          y2: end.y,
          color: activeColor,
        });
      }

      setDrawing(false);
      setStart(null);
      setCurrent(null);
    };

    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);

    return () => {
      svg.removeEventListener("pointerdown", onDown);
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
    };
  }, [isActive, drawing, start, activeTool, activeColor, addShape, getPos]);

  const renderShape = (s: Shape) => {
    const w = Math.abs(s.x2 - s.x);
    const h = Math.abs(s.y2 - s.y);
    const left = Math.min(s.x, s.x2);
    const top = Math.min(s.y, s.y2);

    if (s.type === "rectangle") {
      return (
        <rect
          key={s.id}
          x={left}
          y={top}
          width={w}
          height={h}
          fill="none"
          stroke={s.color}
          strokeWidth={2}
          strokeDasharray="6 3"
          rx={4}
        />
      );
    }

    if (s.type === "ellipse") {
      return (
        <ellipse
          key={s.id}
          cx={left + w / 2}
          cy={top + h / 2}
          rx={w / 2}
          ry={h / 2}
          fill="none"
          stroke={s.color}
          strokeWidth={2}
          strokeDasharray="6 3"
        />
      );
    }

    if (s.type === "arrow") {
      const markerId = `arrow-${s.id}`;
      return (
        <g key={s.id}>
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
            strokeWidth={2}
            markerEnd={`url(#${markerId})`}
          />
        </g>
      );
    }

    return null;
  };

  const renderPreview = () => {
    if (!drawing || !start || !current || !activeTool) return null;
    const preview: Shape = {
      id: "preview",
      type: activeTool,
      x: start.x,
      y: start.y,
      x2: current.x,
      y2: current.y,
      color: activeColor,
    };
    return (
      <g opacity={0.6}>
        {renderShape(preview)}
      </g>
    );
  };

  return (
    <svg
      ref={svgRef}
      className="fixed inset-0 z-[80]"
      style={{
        pointerEvents: isActive ? "auto" : "none",
        cursor: isActive ? "crosshair" : "default",
        width: "100vw",
        height: "100vh",
      }}
    >
      {shapes.map(renderShape)}
      {renderPreview()}
    </svg>
  );
}
