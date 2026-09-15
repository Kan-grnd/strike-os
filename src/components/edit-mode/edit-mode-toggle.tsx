"use client";

import { MousePointerClick } from "lucide-react";
import { useEditMode } from "./edit-mode-provider";

/**
 * Floating toggle mounted next to the theme switcher in the shell header.
 * Esc is handled inside EditModeProvider and only while edit mode is active
 * or the ticket modal is open; otherwise it stays owned by hosting pages.
 */
export function EditModeToggle() {
  const { active, setActive } = useEditMode();

  return (
    <button
      type="button"
      onClick={() => setActive(!active)}
      title={active ? "Leave edit mode" : "EDIT MODE — tickets only"}
      aria-pressed={active}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
        active
          ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300"
          : "border-border bg-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <MousePointerClick className="h-4 w-4" />
    </button>
  );
}