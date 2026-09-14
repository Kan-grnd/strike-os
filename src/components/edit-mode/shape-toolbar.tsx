"use client";

import { MousePointer2, Square, Circle, MoveUpRight, Undo2, Trash2 } from "lucide-react";
import { useEditMode } from "./edit-mode-provider";

const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"];

export function ShapeToolbar() {
  const { activeTool, setActiveTool, activeColor, setActiveColor, undoShape, clearShapes, shapes } = useEditMode();

  return (
    <div className="pointer-events-auto fixed left-1/2 top-14 z-[96] flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-cyan-400/40 bg-background/95 px-3 py-1.5 shadow-lg backdrop-blur">
      <button
        type="button"
        onClick={() => setActiveTool(null)}
        title="Pick element for ticket"
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
          activeTool === null
            ? "bg-cyan-400/20 text-cyan-300"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <MousePointer2 className="h-3.5 w-3.5" />
      </button>

      <div className="mx-0.5 h-4 w-px bg-border" />

      <button
        type="button"
        onClick={() => setActiveTool(activeTool === "rectangle" ? null : "rectangle")}
        title="Draw rectangle"
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
          activeTool === "rectangle"
            ? "bg-cyan-400/20 text-cyan-300"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Square className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={() => setActiveTool(activeTool === "ellipse" ? null : "ellipse")}
        title="Draw ellipse"
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
          activeTool === "ellipse"
            ? "bg-cyan-400/20 text-cyan-300"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Circle className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={() => setActiveTool(activeTool === "arrow" ? null : "arrow")}
        title="Draw arrow"
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
          activeTool === "arrow"
            ? "bg-cyan-400/20 text-cyan-300"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <MoveUpRight className="h-3.5 w-3.5" />
      </button>

      <div className="mx-0.5 h-4 w-px bg-border" />

      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setActiveColor(c)}
          title={`Color ${c}`}
          className={`h-4 w-4 rounded-full border transition-transform ${
            activeColor === c ? "scale-125 border-white" : "border-border hover:scale-110"
          }`}
          style={{ backgroundColor: c }}
        />
      ))}

      <div className="mx-0.5 h-4 w-px bg-border" />

      <button
        type="button"
        onClick={undoShape}
        disabled={shapes.length === 0}
        title="Undo last shape"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={clearShapes}
        disabled={shapes.length === 0}
        title="Clear all shapes"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {shapes.length > 0 && (
        <span className="ml-1 text-[10px] text-muted-foreground">{shapes.length}</span>
      )}
    </div>
  );
}
