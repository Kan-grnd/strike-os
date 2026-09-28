"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PickerOverlay } from "./picker-overlay";
import { ShapeOverlay } from "./shape-overlay";
import { EditBadge } from "./edit-badge";
import { TicketModal } from "./ticket-modal";
import type { CaptureResult } from "./capture";

export type ShapeTool =
  | "rectangle"
  | "ellipse"
  | "arrow"
  | "pen"
  | "line"
  | "pin"
  | "text";
export type ActiveTool = ShapeTool | "select" | null;

export interface Shape {
  id: string;
  type: ShapeTool;
  x: number;
  y: number;
  x2: number;
  y2: number;
  color: string;
  strokeWidth: number;
  points?: { x: number; y: number }[];
  label?: string;
}

interface EditModeContextValue {
  active: boolean;
  /** Enter/leave edit mode. Both directions reset the transient tool state. */
  setActive: (value: boolean) => void;
  shapes: Shape[];
  addShape: (shape: Shape) => void;
  updateShape: (id: string, patch: Partial<Shape>) => void;
  removeShape: (id: string) => void;
  undoShape: () => void;
  clearShapes: () => void;
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  activeColor: string;
  setActiveColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  /** The toolbar's "More" popover. Owned here so Escape has one owner. */
  moreOpen: boolean;
  setMoreOpen: (open: boolean) => void;
}

const EditModeContext = createContext<EditModeContextValue>({
  active: false,
  setActive: () => {},
  shapes: [],
  addShape: () => {},
  updateShape: () => {},
  removeShape: () => {},
  undoShape: () => {},
  clearShapes: () => {},
  activeTool: null,
  setActiveTool: () => {},
  activeColor: "#ef4444",
  setActiveColor: () => {},
  strokeWidth: 2,
  setStrokeWidth: () => {},
  selectedId: null,
  setSelectedId: () => {},
  moreOpen: false,
  setMoreOpen: () => {},
});

export function useEditMode() {
  return useContext(EditModeContext);
}

const shapesKey = (route: string) => `strike.edit.shapes.${route}`;

const DEFAULT_COLOR = "#ef4444";
const DEFAULT_WIDTH = 2;

export function EditModeProvider({ children }: { children: React.ReactNode }) {
  const [active, setActiveState] = useState(false);
  const [pending, setPending] = useState<CaptureResult | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [activeColor, setActiveColor] = useState(DEFAULT_COLOR);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_WIDTH);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();

  // Shapes are per-route: load what was saved for this page on mount and on
  // every route change, and forget the transient editing state when moving on.
  // Nothing is written back to the server — annotations are local until a
  // ticket carries them. Loading runs before the persist effect below, and
  // that effect's debounce cleanup means the initial [] is never persisted.
  useEffect(() => {
    setSelectedId(null);
    setActiveTool(null);
    setPending(null);
    setMoreOpen(false);
    try {
      const raw = window.localStorage.getItem(shapesKey(pathname));
      setShapes(raw ? (JSON.parse(raw) as Shape[]) : []);
    } catch {
      setShapes([]);
    }
  }, [pathname]);

  // Debounced persist whenever the drawing sheet for this route changes.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(shapesKey(pathname), JSON.stringify(shapes));
      } catch {
        /* storage unavailable — drawings just won't survive reload */
      }
    }, 200);
    return () => clearTimeout(t);
  }, [shapes, pathname]);

  // Entering and leaving both drop the transient tool state. Drawings are kept
  // for the page on purpose — they are annotations, not a mode.
  const setActive = useCallback((value: boolean) => {
    setActiveState(value);
    setActiveTool(null);
    setSelectedId(null);
    setMoreOpen(false);
    if (!value) setPending(null);
  }, []);

  const handleCapture = useCallback((capture: CaptureResult) => {
    // Edit mode stays on: closing the ticket box returns to a clean pick state
    // instead of dumping the user back on the host page.
    setPending(capture);
    setActiveTool(null);
    setSelectedId(null);
    setMoreOpen(false);
  }, []);

  const clearPending = useCallback(() => setPending(null), []);

  // One owner for Escape, one step per press: close the ticket box, then the
  // More popover, then drop the active tool, then leave edit mode. The only
  // surface that keeps Escape for itself is the text-label draft, which stops
  // the event before it reaches here.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (pending) clearPending();
      else if (active) {
        if (moreOpen) setMoreOpen(false);
        else if (activeTool !== null) setActiveTool(null);
        else setActive(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending, active, moreOpen, activeTool, clearPending]);

  const addShape = useCallback((shape: Shape) => {
    setShapes((prev) => [...prev, shape]);
  }, []);

  const updateShape = useCallback((id: string, patch: Partial<Shape>) => {
    setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const removeShape = useCallback((id: string) => {
    setSelectedId((sel) => (sel === id ? null : sel));
    setShapes((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const undoShape = useCallback(() => {
    // Selection is cleared in its own update — never inside another updater.
    setSelectedId(null);
    setShapes((prev) => prev.slice(0, -1));
  }, []);

  const clearShapes = useCallback(() => {
    setShapes([]);
    setSelectedId(null);
  }, []);

  // The ticket box owns the screen while it is open: no chrome, no drawing
  // surface, no picker underneath it.
  const overlaysLive = active && pending === null;

  return (
    <EditModeContext.Provider
      value={{
        active,
        setActive,
        shapes,
        addShape,
        updateShape,
        removeShape,
        undoShape,
        clearShapes,
        activeTool,
        setActiveTool,
        activeColor,
        setActiveColor,
        strokeWidth,
        setStrokeWidth,
        selectedId,
        setSelectedId,
        moreOpen,
        setMoreOpen,
      }}
    >
      {children}
      {overlaysLive && (
        <>
          <EditBadge />
          <ShapeOverlay />
          {activeTool === null && <PickerOverlay onCapture={handleCapture} />}
        </>
      )}
      {pending && <TicketModal capture={pending} onClose={clearPending} />}
    </EditModeContext.Provider>
  );
}
