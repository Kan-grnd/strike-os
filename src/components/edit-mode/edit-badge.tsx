"use client";

import * as React from "react";
import { GripVertical, X } from "lucide-react";
import { ShapeToolbar } from "./shape-toolbar";
import { useEditMode, type ActiveTool } from "./edit-mode-provider";

const TOOL_LABEL: Record<Exclude<ActiveTool, null>, string> = {
  select: "Move",
  rectangle: "Box",
  ellipse: "Circle",
  arrow: "Arrow",
  line: "Line",
  pen: "Pen",
  highlighter: "Highlight",
  pin: "Pin",
  text: "Text",
  blur: "Blur",
  redact: "Redact",
  eraser: "Eraser",
};

/** Panel position is kept between sessions; null means the default top-center. */
const POS_KEY = "strike.edit.badgePos.v1";
/** Never let the panel drift under the 56px header. */
const TOP_CLEARANCE = 64;
const MARGIN = 8;

interface Pos {
  x: number;
  y: number;
}

/** Keeps the panel fully on screen, preserving the header clearance. */
function clamp(pos: Pos, w: number, h: number): Pos {
  const maxX = Math.max(MARGIN, window.innerWidth - w - MARGIN);
  const maxY = Math.max(TOP_CLEARANCE, window.innerHeight - h - MARGIN);
  return {
    x: Math.min(Math.max(MARGIN, pos.x), maxX),
    y: Math.min(Math.max(TOP_CLEARANCE, pos.y), maxY),
  };
}

/**
 * The one floating edit-mode surface: a status row (mode, current tool, exit)
 * stacked on the tool row. The status row is a drag handle so the panel can be
 * moved out of the way of whatever is being annotated. Position is persisted
 * and always clamped inside the viewport; double-click or Home restores the
 * default top-center spot.
 */
export function EditBadge() {
  const { activeTool, setActive } = useEditMode();
  const picking = activeTool === null;

  const panelRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<Pos | null>(null);
  const posRef = React.useRef<Pos | null>(null);
  posRef.current = pos;
  const dragRef = React.useRef<{ dx: number; dy: number } | null>(null);

  const persist = React.useCallback((p: Pos | null) => {
    try {
      if (p) window.localStorage.setItem(POS_KEY, JSON.stringify(p));
      else window.localStorage.removeItem(POS_KEY);
    } catch {
      /* storage unavailable — the drag still applies for this session */
    }
  }, []);

  // Restore any persisted position once, on mount.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(POS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as Pos;
      if (typeof p?.x === "number" && typeof p?.y === "number") setPos(p);
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  // Keep the panel on screen when the window shrinks.
  React.useEffect(() => {
    if (!pos) return;
    const onResize = () => {
      const el = panelRef.current;
      if (!el) return;
      const next = clamp(posRef.current ?? { x: 0, y: 0 }, el.offsetWidth, el.offsetHeight);
      setPos(next);
      persist(next);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos, persist]);

  const startDrag = (e: React.PointerEvent) => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onDragStart = (e: React.PointerEvent) => {
    // Controls keep their own clicks; only bare panel chrome starts a drag.
    if ((e.target as HTMLElement).closest("button, a, input, label, select")) return;
    startDrag(e);
  };

  const onDragMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const el = panelRef.current;
    if (!drag || !el) return;
    setPos(clamp({ x: e.clientX - drag.dx, y: e.clientY - drag.dy }, el.offsetWidth, el.offsetHeight));
  };

  const onDragEnd = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }
    if (posRef.current) persist(posRef.current);
  };

  // Arrow keys nudge, Shift nudges further, Home resets. Anchored to the
  // panel's current on-screen box so the first nudge never jumps.
  const onHandleKeyDown = (e: React.KeyboardEvent) => {
    const el = panelRef.current;
    if (!el) return;
    if (e.key === "Home") {
      e.preventDefault();
      setPos(null);
      persist(null);
      return;
    }
    const step = e.shiftKey ? 64 : 16;
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else if (e.key === "ArrowUp") dy = -step;
    else if (e.key === "ArrowDown") dy = step;
    else return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    const base = posRef.current ?? { x: r.left, y: r.top };
    const next = clamp({ x: base.x + dx, y: base.y + dy }, el.offsetWidth, el.offsetHeight);
    setPos(next);
    persist(next);
  };

  const resetPos = () => {
    setPos(null);
    persist(null);
  };

  return (
    <div
      ref={panelRef}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      className={`pointer-events-auto fixed z-[95] flex max-h-[calc(100vh-5.5rem)] w-max max-w-[calc(100vw-1rem)] flex-col gap-1.5 rounded-xl border border-cyan-400/40 glass-elevated p-1.5 ${
        pos ? "" : "top-16 left-1/2 -translate-x-1/2"
      }`}
    >
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        onDoubleClick={(e) => {
          if (!(e.target as HTMLElement).closest("button")) resetPos();
        }}
        style={{ touchAction: "none" }}
        className="flex cursor-grab items-center gap-2 active:cursor-grabbing"
      >
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            startDrag(e);
          }}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          onKeyDown={onHandleKeyDown}
          onDoubleClick={resetPos}
          title="Drag to move · arrows nudge · Home resets"
          aria-label="Move edit panel — arrow keys to nudge, Home to reset"
          className="-ml-0.5 inline-flex h-6 w-4 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-cyan-400 motion-reduce:animate-none" />
        <span className="text-[11px] leading-none font-semibold tracking-wide text-cyan-300 uppercase">
          Edit mode
        </span>
        <span className="truncate text-[11px] leading-none text-muted-foreground">
          {picking ? "Click any element" : `${TOOL_LABEL[activeTool]} tool on`}
        </span>
        <button
          type="button"
          onClick={() => setActive(false)}
          className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Leave edit mode"
          aria-label="Leave edit mode"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ShapeToolbar />
    </div>
  );
}
