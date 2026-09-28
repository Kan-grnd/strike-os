"use client";

import { useEffect, useRef } from "react";
import {
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
  SlidersHorizontal,
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

/** Primary tools, in the order they are most often reached for. */
const TOOLS: { id: "select" | "rectangle" | "ellipse" | "arrow" | "pen" | "pin" | "text"; title: string; icon: typeof Square }[] = [
  { id: "select", title: "Select / move", icon: MousePointerClick },
  { id: "rectangle", title: "Rectangle", icon: Square },
  { id: "ellipse", title: "Ellipse", icon: Circle },
  { id: "arrow", title: "Arrow", icon: MoveUpRight },
  { id: "pen", title: "Pen", icon: Pen },
  { id: "pin", title: "Pin", icon: MapPin },
  { id: "text", title: "Text label", icon: Type },
];

const BTN = "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors";

/**
 * Renders the tool row inside EditBadge's panel — it is intentionally not
 * `fixed` itself, so the status row and the tools can never drift apart or
 * wrap over each other. Size and colour live behind a single "More" popover so
 * the primary row stays one tap wide.
 */
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
    moreOpen,
    setMoreOpen,
  } = useEditMode();

  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [moreOpen, setMoreOpen]);

  const setTool = (id: (typeof TOOLS)[number]["id"]) => {
    setSelectedId(null);
    setMoreOpen(false);
    setActiveTool(activeTool === id ? null : id);
  };

  return (
    <div className="relative flex flex-wrap items-center justify-center gap-1">
      {TOOLS.map((t) => {
        const active = activeTool === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTool(t.id)}
            title={t.title}
            aria-label={t.title}
            aria-pressed={active}
            className={cn(
              BTN,
              active
                ? "bg-cyan-400/20 text-cyan-300"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <t.icon className="h-4 w-4" />
          </button>
        );
      })}

      <div className="mx-0.5 h-5 w-px bg-border" />

      <div className="relative" ref={moreRef}>
        <button
          type="button"
          onClick={() => setMoreOpen(!moreOpen)}
          title="Line, stroke and colour"
          aria-label="Line, stroke and colour"
          aria-expanded={moreOpen}
          aria-pressed={moreOpen}
          className={cn(
            BTN,
            moreOpen || activeTool === "line"
              ? "bg-cyan-400/20 text-cyan-300"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>

        {moreOpen && (
          <div className="absolute top-full right-0 z-10 mt-1.5 w-[168px] space-y-2.5 rounded-lg border border-border bg-background p-2 shadow-xl">
            <div>
              <div className="mb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Line
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setMoreOpen(false);
                  setActiveTool(activeTool === "line" ? null : "line");
                }}
                title="Line"
                aria-label="Line"
                aria-pressed={activeTool === "line"}
                className={cn(
                  "flex h-9 w-full items-center justify-center gap-2 rounded-md border text-xs transition-colors",
                  activeTool === "line"
                    ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <Minus className="h-4 w-4" />
                Line
              </button>
            </div>

            <div>
              <div className="mb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Stroke
              </div>
              <div className="grid grid-cols-4 gap-1">
                {WIDTHS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    title={`Stroke ${w}px`}
                    aria-label={`Stroke ${w}px`}
                    aria-pressed={strokeWidth === w}
                    onClick={() => setStrokeWidth(w)}
                    className={cn(
                      "flex h-9 items-center justify-center rounded-md border transition-colors",
                      strokeWidth === w
                        ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span
                      className="block rounded-full"
                      style={{ width: 12, height: Math.max(2, w), backgroundColor: "currentColor" }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Colour
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setActiveColor(c)}
                    title={c}
                    aria-label={`Colour ${c}`}
                    aria-pressed={activeColor === c}
                    className={cn(
                      "h-6 w-6 rounded-full border transition-transform",
                      activeColor === c
                        ? "scale-110 border-white"
                        : "border-border hover:scale-110"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <label className="relative flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border text-muted-foreground">
                  <span
                    className="block h-4 w-4 rounded-full border border-white/30"
                    style={{ backgroundColor: activeColor }}
                  />
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(activeColor) ? activeColor : "#ef4444"}
                    onChange={(e) => setActiveColor(e.target.value)}
                    aria-label="Custom colour"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mx-0.5 h-5 w-px bg-border" />

      <button
        type="button"
        onClick={undoShape}
        disabled={shapes.length === 0}
        title={shapes.length === 0 ? "Nothing to undo" : "Undo last"}
        aria-label="Undo last"
        className={cn(BTN, "text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30")}
      >
        <Undo2 className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={clearShapes}
        disabled={shapes.length === 0}
        title={shapes.length === 0 ? "No drawings on this page" : "Clear page"}
        aria-label="Clear page"
        className={cn(BTN, "text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30")}
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {shapes.length > 0 && (
        <span className="flex items-center gap-1 pl-0.5 text-[10px] whitespace-nowrap text-muted-foreground">
          {shapes.length}
          {selectedId ? " · 1 selected" : ""}
        </span>
      )}
    </div>
  );
}
