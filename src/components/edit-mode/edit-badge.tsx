"use client";

import { X } from "lucide-react";
import { ShapeToolbar } from "./shape-toolbar";
import { useEditMode, type ActiveTool } from "./edit-mode-provider";

const TOOL_LABEL: Record<Exclude<ActiveTool, null>, string> = {
  select: "Move",
  rectangle: "Box",
  ellipse: "Circle",
  arrow: "Arrow",
  line: "Line",
  pen: "Pen",
  pin: "Pin",
  text: "Text",
};

/**
 * The one floating edit-mode surface: a status row (mode, current tool, exit)
 * stacked on the tool row. Status and tools used to be two separately fixed
 * bars that overlapped each other and the page; as one panel they can only
 * ever occupy one corner, and the whole thing collapses to a single column.
 */
export function EditBadge() {
  const { activeTool, setActive } = useEditMode();
  const picking = activeTool === null;

  return (
    // Sits below the 56px header, never on top of it: anchored at the top of
    // the viewport this panel buried the command bar on desktop and all three
    // header buttons on mobile, turning them into dead clicks.
    <div className="pointer-events-auto fixed top-16 left-1/2 z-[95] flex max-h-[calc(100vh-5.5rem)] w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-col gap-1.5 rounded-lg border border-cyan-400/40 bg-background/95 p-1.5 shadow-lg backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-cyan-400" />
        <span className="text-[11px] leading-none font-semibold tracking-wide text-cyan-300 uppercase">
          Edit mode
        </span>
        <span className="truncate text-[11px] leading-none text-muted-foreground">
          {picking ? "Click any element" : `${TOOL_LABEL[activeTool]} tool on`}
        </span>
        <button
          type="button"
          onClick={() => setActive(false)}
          className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
