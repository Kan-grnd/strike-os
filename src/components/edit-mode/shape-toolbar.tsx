"use client";

import {
  MousePointer2,
  MousePointerClick,
  Square,
  Circle,
  MoveUpRight,
  Minus,
  Pen,
  MapPin,
  Type,
  Undo2,
  Trash2,
  Palette,
} from "lucide-react";
import { useEditMode } from "./edit-mode-provider";
import { cn } from "@/lib/utils";

const COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
];

const WIDTHS = [1, 2, 4, 6];

const TOOLS: { id: "select" | "rectangle" | "ellipse" | "arrow" | "line" | "pen" | "pin" | "text"; title: string; icon: typeof Square }[] = [
  { id: "select", title: "Select / move", icon: MousePointerClick },
  { id: "rectangle", title: "Rectangle", icon: Square },
  { id: "ellipse", title: "Ellipse", icon: Circle },
  { id: "arrow", title: "Arrow", icon: MoveUpRight },
  { id: "line", title: "Line", icon: Minus },
  { id: "pen", title: "Pen", icon: Pen },
  { id: "pin", title: "Pin", icon: MapPin },
  { id: "text", title: "Text label", icon: Type },
];

export function ShapeToolbar() {
  const {
    activeTool,
    setActiveTool,
    activeColor,
    setActiveColor,
    strokeWidth,
    setStrokeWidth,
    undoShape,
    clearShapes,
    shapes,
    selectedId,
    setSelectedId,
  } = useEditMode();

  const setTool = (id: (typeof TOOLS)[number]["id"]) => {
    setSelectedId(null);
    setActiveTool(activeTool === id ? null : id);
  };

  return (
    <div className="pointer-events-auto fixed left-1/2 top-14 z-[96] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-full border border-cyan-400/40 bg-background/95 px-3 py-1.5 shadow-lg backdrop-blur">
      {TOOLS.map((t) => {
        const active = activeTool === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTool(t.id)}
            title={t.title}
            aria-pressed={active}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
              active ? "bg-cyan-400/20 text-cyan-300" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
          </button>
        );
      })}

      <div className="mx-0.5 h-4 w-px bg-border" />

      {WIDTHS.map((w) => (
        <button
          key={w}
          type="button"
          title={`Stroke ${w}px`}
          aria-label={`Stroke ${w}px`}
          aria-pressed={strokeWidth === w}
          onClick={() => setStrokeWidth(w)}
          className={`inline-flex h-6 w-5 items-center justify-center rounded-md transition-colors ${
            strokeWidth === w ? "bg-cyan-400/20 text-cyan-300" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="block rounded-full" style={{ width: 8, height: Math.max(2, w), backgroundColor: "currentColor" }} />
        </button>
      ))}

      <div className="mx-0.5 h-4 w-px bg-border" />

      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setActiveColor(c)}
          title={`Color ${c}`}
          aria-label={`Color ${c}`}
          className={cn(
            "h-4 w-4 rounded-full border transition-transform",
            activeColor === c ? "scale-125 border-white" : "border-border hover:scale-110"
          )}
          style={{ backgroundColor: c }}
        />
      ))}

      <label
        className="relative inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-md text-muted-foreground transition-colors hover:text-foreground"
        title="Custom color"
      >
        <MousePointer2 className="h-3.5 w-3.5" />
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(activeColor) ? activeColor : "#ef4444"}
          onChange={(e) => setActiveColor(e.target.value)}
          aria-label="Custom color"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>

      <div className="mx-0.5 h-4 w-px bg-border" />

      <button
        type="button"
        onClick={undoShape}
        disabled={shapes.length === 0}
        title="Undo last"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={clearShapes}
        disabled={shapes.length === 0}
        title="Clear page"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {shapes.length > 0 && (
        <span className="ml-1 text-[10px] text-muted-foreground">
          {shapes.length}{selectedId ? " · sel" : ""}
        </span>
      )}
    </div>
  );
}