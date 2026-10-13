"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { SidebarFooter, SIDEBAR_FOOTER_ZONE } from "@/components/layout/sidebar-footer";
import type { NavigationDomain } from "@/lib/navigation";

/**
 * Level 2 as a drawer, for panes too narrow to spend 192px on it.
 *
 * The rail stays put and stays usable. That requires a *non-modal* drawer: a
 * modal one sets `pointer-events: none` on the body to hold the page still, and
 * nothing inside that body — whatever its z-index — can be clicked, so a modal
 * drawer would make the visible rail icons dead to the pointer. It would also
 * trap keyboard focus away from the rail.
 *
 * A navigation panel that the user is meant to keep working alongside is a
 * disclosure, not a modal dialog, so that is what this is: no scrim (nothing is
 * being blocked, and drawing one would say otherwise), no focus trap, and no
 * body scroll lock. Two things Radix only does for modal dialogs are therefore
 * supplied here by hand: Escape to dismiss, and outside-click dismissal, which
 * the dismissable layer still handles.
 */
export function SidebarDrawer({
  open,
  onOpenChange,
  domain,
  activeHref,
  nav,
  status,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: NavigationDomain;
  activeHref: string | null;
  nav: React.ReactNode;
  status: Parameters<typeof SidebarFooter>[0]["status"];
}) {
  // Radix only wires Escape up for modal dialogs.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  /* Tapping a domain in the rail is not "clicking outside". Left to the default
   * behaviour, the dismissal layer fires on pointerdown, the rail's own handler
   * re-opens the drawer, and then focus landing back on the rail icon trips
   * `onFocusOutside` and closes it again — so switching domain just shuts the
   * panel. The rail is part of the same control, so those two events are not
   * dismissed and the panel simply re-renders with the new domain. */
  const keepOpenFor = (e: Event) => {
    if ((e.target as Element | null)?.closest?.("[data-nav-rail]")) e.preventDefault();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} modal={false}>
      <DrawerContent
        side="left"
        modal={false}
        onInteractOutside={keepOpenFor}
        onFocusOutside={keepOpenFor}
        /* The rail button that opened this is still focused, and that is where it
           should stay: pulling focus into the panel would move it away from the
           control the user is actually working with. Escape and the close button
           get them back out. */
        onOpenAutoFocus={(e) => e.preventDefault()}
        /* Clears the 64px rail so the two columns read as one navigation rather
           than as a dialog floating over an unrelated strip. */
        className={cn(
          "left-16 w-56 max-w-[calc(100vw-4rem)] gap-0 border-r border-l-0 p-0",
          "glass-bar"
        )}
      >
        <DrawerTitle
          /* Matches the rail's 56px brand zone (h-14) + its 1px rule, so now
             that the drawer runs full-height its title stops exactly where the
             rail's turns into the icon list. */
          className="flex h-14 shrink-0 items-center border-b border-border px-4 text-sm font-semibold"
          asChild
        >
          <h2 tabIndex={-1}>{domain.label}</h2>
        </DrawerTitle>
        <div className="sidebar-nav min-h-0 flex-1 overflow-y-auto px-3 py-3">{nav}</div>
        <div className={cn(SIDEBAR_FOOTER_ZONE, "px-3")}>
          <SidebarFooter status={status} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
