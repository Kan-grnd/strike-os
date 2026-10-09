"use client";

import { useEffect, useRef } from "react";
import {
  MousePointerClick,
  Square,
  Circle,
  MoveUpRight,
  Minus,
  Pen,
  Highlighter,
  MapPin,
  Type,
  Blend,
  EyeOff,
  Eraser,
  Undo2,
  Copy,
  Trash2,
  SlidersHorizontal,
  BringToFront,
  SendToBack,
} from "lucide-react";
import { useEditMode, type ActiveTool } from "./edit-mode-provider";
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

type ToolId = Exclude<ActiveTool, null>;

/** Primary tools, in the order they are most often reached for. */
const TOOLS: { id: ToolId; title: string; icon: typeof Square }[] = [
  { id: "select", title: "Select / move / resize", icon: MousePointerClick },
  { id: "rectangle", title: "Rectangle", icon: Square },
  { id: "ellipse", title: "Ellipse", icon: Circle },
  { id: "arrow", title: "Arrow", icon: MoveUpRight },
  { id: "line", title: "Line", icon: Minus },
  { id: "pen", title: "Pen", icon: Pen },
  { id: "highlighter", title: "Highlighter", icon: Highlighter },
  { id: "pin", title: "Pin", icon: MapPin },
  { id: "text", title: "Text label", icon: Type },
  { id: "blur", title: "Blur", icon: Blend },
  { id: "redact", title: "Redact", icon: EyeOff },
  { id: "eraser", title: "Eraser — tap a shape to delete it", icon: Eraser },
];

const BTN = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors";
const DIVIDER = "mx-0.5 h-5 w-px bg-border";

/**
 * The toolbar inside the edit panel. Tools sit on the first row, actions on a
 * shorter second row, so the panel stays compact instead of one long bar.
 */
export function ShapeToolbar() {
  const {
    activeTool,
    setActiveTool,
    activeColor,
    setActiveColor,
    strokeWidth,
    setStrokeWidth,
    activeOpacity,
    setActiveOpacity,
    activeFill,
    setActiveFill,
    updateShape,
    undoShape,
    clearShapes,
    duplicateShape,
    removeShape,
    bringForward,
    sendBackward,
    shapes,
    selectedId,
    setSelectedId,
    moreOpen,
    setMoreOpen,
    clearArmed,
    setClearArmed,
  } = useEditMode();

  const moreRef = useRef<HTMLDivElement>(null);
  const selected = shapes.find((s) => s.id === selectedId) ?? null;

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [moreOpen, setMoreOpen]);

  // Clear-page stays armed for a few seconds only, then quietly disarms.
  useEffect(() => {
    if (!clearArmed) return;
    const t = setTimeout(() => setClearArmed(false), 3000);
    return () => clearTimeout(t);
  }, [clearArmed, setClearArmed]);

  const setTool = (id: ToolId) => {
    setSelectedId(null);
    setMoreOpen(false);
    setClearArmed(false);
    setActiveTool(activeTool === id ? null : id);
  };

  const opacity = selected ? (selected.opacity ?? 1) : activeOpacity;
  const fill = selected ? (selected.fill ?? false) : activeFill;

  const applyOpacity = (v: number) => {
    if (selectedId) updateShape(selectedId, { opacity: v });
    else setActiveOpacity(v);
  };

  const applyFill = (v: boolean) => {
    if (selectedId) updateShape(selectedId, { fill: v });
    else setActiveFill(v);
  };

  const onClear = () => {
    if (clearArmed) clearShapes();
    else setClearArmed(true);
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-wrap items-center justify-center gap-1">
        {TOOLS.map((t, i) => {
          const active = activeTool === t.id;
          const dividerBefore = i === 1;
          return (
            <span key={t.id} className="flex items-center">
              {dividerBefore && <span className={DIVIDER} />}
              <button
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
            </span>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1">
        <button
          type="button"
          onClick={undoShape}
          title="Undo last"
          aria-label="Undo last"
          className={cn(BTN, "text-muted-foreground hover:bg-accent hover:text-foreground")}
        >
          <Undo2 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => selectedId && duplicateShape(selectedId)}
          disabled={!selectedId}
          title="Duplicate selected"
          aria-label="Duplicate selected"
          className={cn(
            BTN,
            "text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
          )}
        >
          <Copy className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => selectedId && removeShape(selectedId)}
          disabled={!selectedId}
          title="Delete selected"
          aria-label="Delete selected"
          className={cn(
            BTN,
            "text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
          )}
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <span className={DIVIDER} />

        <div className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            title="Stroke, opacity, fill and arrange"
            aria-label="Stroke, opacity, fill and arrange"
            aria-expanded={moreOpen}
            aria-pressed={moreOpen}
            className={cn(
              BTN,
              moreOpen
                ? "bg-cyan-400/20 text-cyan-300"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>

          {moreOpen && (
            <div className="absolute top-full right-0 z-10 mt-1.5 w-[184px] space-y-2.5 rounded-lg border border-border bg-background p-2 shadow-xl">
              <div>
                <div className="mb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
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
                        "flex h-8 items-center justify-center rounded-md border transition-colors",
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
                <div className="mb-1 flex items-center justify-between text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                  <span>Opacity</span>
                  <span className="tabular-nums">{Math.round(opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={Math.round(opacity * 100)}
                  onChange={(e) => applyOpacity(Number(e.target.value) / 100)}
                  aria-label="Opacity"
                  className="h-1.5 w-full cursor-pointer accent-cyan-400"
                />
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                  Fill
                </div>
                <button
                  type="button"
                  onClick={() => applyFill(!fill)}
                  aria-pressed={fill}
                  title="Fill interior (rectangle / ellipse)"
                  className={cn(
                    "flex h-8 w-full items-center justify-center gap-2 rounded-md border text-xs transition-colors",
                    fill
                      ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Square className={cn("h-4 w-4", fill && "fill-current")} />
                  {fill ? "Filled" : "Outline"}
                </button>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                  Arrange
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => selectedId && bringForward(selectedId)}
                    disabled={!selectedId}
                    title="Bring forward"
                    aria-label="Bring forward"
                    className={cn(
                      "flex h-8 items-center justify-center gap-1.5 rounded-md border text-xs transition-colors",
                      "border-border text-muted-foreground hover:text-foreground disabled:opacity-30"
                    )}
                  >
                    <BringToFront className="h-4 w-4" />
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => selectedId && sendBackward(selectedId)}
                    disabled={!selectedId}
                    title="Send backward"
                    aria-label="Send backward"
                    className={cn(
                      "flex h-8 items-center justify-center gap-1.5 rounded-md border text-xs transition-colors",
                      "border-border text-muted-foreground hover:text-foreground disabled:opacity-30"
                    )}
                  >
                    <SendToBack className="h-4 w-4" />
                    Down
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                  Colour
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        if (selectedId) updateShape(selectedId, { color: c });
                        else setActiveColor(c);
                      }}
                      title={c}
                      aria-label={`Colour ${c}`}
                      aria-pressed={activeColor === c}
                      className={cn(
                        "h-6 w-6 rounded-full border transition-transform",
                        activeColor === c ? "scale-110 border-white" : "border-border hover:scale-110"
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
                      value={activeColor}
                      onChange={(e) => {
                        if (selectedId) updateShape(selectedId, { color: e.target.value });
                        else setActiveColor(e.target.value);
                      }}
                      aria-label="Custom colour"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
              </div>

              <div className="border-t border-border pt-2.5">
                <button
                  type="button"
                  onClick={onClear}
                  disabled={shapes.length === 0}
                  title={
                    shapes.length === 0
                      ? "No drawings on this page"
                      : clearArmed
                        ? "Tap again to clear the whole page"
                        : "Clear all drawings on this page (tap twice)"
                  }
                  aria-label={clearArmed ? "Confirm clear page" : "Clear page"}
                  className={cn(
                    "flex h-8 w-full items-center justify-center gap-2 rounded-md border text-xs transition-colors",
                    clearArmed
                      ? "border-destructive/50 bg-destructive/15 text-destructive"
                      : "border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive disabled:opacity-30"
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {clearArmed ? "Tap again to clear" : "Clear page"}
                </button>
              </div>
            </div>
          )}
        </div>

        {shapes.length > 0 && (
          <span className="flex items-center gap-1 pl-0.5 text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">
            {shapes.length}
            {selectedId ? " · 1 selected" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
