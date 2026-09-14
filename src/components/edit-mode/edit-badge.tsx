"use client";

import { X } from "lucide-react";

interface EditBadgeProps {
  onExit: () => void;
}

/**
 * The floating badge shown during edit mode (always visible).
 * Extracted from PickerOverlay so it renders even when a shape tool is active.
 */
export function EditBadge({ onExit }: EditBadgeProps) {
  return (
    <div className="pointer-events-auto fixed left-1/2 top-3 z-[95] flex -translate-x-1/2 cursor-default items-center gap-2.5 rounded-full border border-cyan-400/40 bg-background/95 px-3.5 py-1.5 shadow-lg backdrop-blur">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
      <span className="text-xs font-semibold tracking-wide text-cyan-300 uppercase">
        Edit mode — tickets only
      </span>
      <button
        type="button"
        onClick={onExit}
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
        title="Leave edit mode"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
