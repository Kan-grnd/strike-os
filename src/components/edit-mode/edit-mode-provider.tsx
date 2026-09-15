"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { PickerOverlay } from "./picker-overlay";
import { ShapeOverlay } from "./shape-overlay";
import { ShapeToolbar } from "./shape-toolbar";
import { EditBadge } from "./edit-badge";
import { TicketModal } from "./ticket-modal";
import type { CaptureResult } from "./capture";

export interface Shape {
  id: string;
  type: "rectangle" | "ellipse" | "arrow";
  x: number;
  y: number;
  x2: number;
  y2: number;
  color: string;
}

interface EditModeContextValue {
  active: boolean;
  setActive: (value: boolean) => void;
  shapes: Shape[];
  addShape: (shape: Shape) => void;
  undoShape: () => void;
  clearShapes: () => void;
  activeTool: "rectangle" | "ellipse" | "arrow" | null;
  setActiveTool: (tool: "rectangle" | "ellipse" | "arrow" | null) => void;
  activeColor: string;
  setActiveColor: (color: string) => void;
}

const EditModeContext = createContext<EditModeContextValue>({
  active: false,
  setActive: () => {},
  shapes: [],
  addShape: () => {},
  undoShape: () => {},
  clearShapes: () => {},
  activeTool: null,
  setActiveTool: () => {},
  activeColor: "#ef4444",
  setActiveColor: () => {},
});

export function useEditMode() {
  return useContext(EditModeContext);
}

export function EditModeProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [pending, setPending] = useState<CaptureResult | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [activeTool, setActiveTool] = useState<"rectangle" | "ellipse" | "arrow" | null>(null);
  const [activeColor, setActiveColor] = useState("#ef4444");
  const pathname = usePathname();
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (prevPath.current !== pathname) {
      setPending(null);
      setShapes([]);
      setActiveTool(null);
    }
    prevPath.current = pathname;
  }, [pathname]);

  const handleCapture = useCallback((capture: CaptureResult) => {
    setPending(capture);
    setActive(false);
    setActiveTool(null);
  }, []);

  const clearPending = useCallback(() => setPending(null), []);

  // Escape is scoped to the edit-mode surfaces only: close the ticket modal
  // first, then drop a shape tool, then leave edit mode. When neither is
  // mounted the key is left untouched so hosting pages keep ownership of it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (pending) {
        clearPending();
      } else if (active) {
        if (activeTool !== null) setActiveTool(null);
        else {
          setActive(false);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending, active, activeTool, clearPending]);

  const addShape = useCallback((shape: Shape) => {
    setShapes((prev) => [...prev, shape]);
  }, []);

  const undoShape = useCallback(() => {
    setShapes((prev) => prev.slice(0, -1));
  }, []);

  const clearShapes = useCallback(() => {
    setShapes([]);
  }, []);

  return (
    <EditModeContext.Provider
      value={{
        active,
        setActive,
        shapes,
        addShape,
        undoShape,
        clearShapes,
        activeTool,
        setActiveTool,
        activeColor,
        setActiveColor,
      }}
    >
      {children}
      {active && (
        <>
          <EditBadge onExit={() => { setActive(false); setActiveTool(null); }} />
          <ShapeToolbar />
          <ShapeOverlay />
          {activeTool === null && (
            <PickerOverlay onCapture={handleCapture} />
          )}
        </>
      )}
      {pending && <TicketModal capture={pending} onClose={clearPending} />}
    </EditModeContext.Provider>
  );
}
