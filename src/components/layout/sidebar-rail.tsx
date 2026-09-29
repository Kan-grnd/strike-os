"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { StrikeMark } from "@/components/ui/logo";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_DOMAINS, type NavigationDomain } from "@/lib/navigation";

/**
 * One Level-1 domain, as an icon.
 *
 * `aria-pressed` rather than `aria-current`: pressing a rail icon does not move
 * the user anywhere, it only changes which panel is showing, so calling it the
 * current page would tell a screen reader the user is somewhere they are not.
 * The active fill and the left indicator are both present so the state does not
 * rest on colour alone, and the tooltip carries the label the icon omits.
 */
function PrimaryNavItem({
  domain,
  selected,
  isRoute,
  onSelect,
  buttonRef,
}: {
  domain: NavigationDomain;
  selected: boolean;
  /** This domain owns the current route — a quieter, second signal. */
  isRoute: boolean;
  onSelect: (id: string) => void;
  buttonRef?: (el: HTMLButtonElement | null) => void;
}) {
  const Icon = domain.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => onSelect(domain.id)}
          aria-pressed={selected}
          aria-label={domain.label}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-md transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            selected
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          {/* A solid bar rather than a ring or a glow: the packs whose accent
              sits close to the sidebar fill lose a subtle indicator, and this is
              the one mark that survives every pack. */}
          {selected && (
            <span
              aria-hidden="true"
              className="absolute -left-1.5 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary"
            />
          )}
          <Icon className="h-[18px] w-[18px]" />
          {/* The selected domain is not always the domain of the current route —
              you can be reading Observatory while browsing the Model Brain
              panel. A second, quieter dot says "this is where you are" without
              competing with the selection. */}
          {isRoute && !selected && (
            <span
              aria-hidden="true"
              className="absolute bottom-1 right-1 h-1 w-1 rounded-full bg-muted-foreground"
            />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{domain.label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Level 1: the product domains, as icons.
 *
 * The rail never disappears. Collapsing the navigation only removes Level 2, so
 * the domains stay reachable and the rail is the whole navigation on a narrow
 * pane. That is also why it carries its own branding and status dot — they have
 * nowhere else to live when the panel is closed.
 */
export function SidebarRail({
  selectedId,
  routeId,
  onSelect,
  registerRef,
  onTogglePanel,
  panelOpen,
  footer,
  className,
}: {
  selectedId: string | null;
  routeId: string | null;
  onSelect: (id: string) => void;
  registerRef: (id: string, el: HTMLButtonElement | null) => void;
  onTogglePanel: () => void;
  panelOpen: boolean;
  footer: React.ReactNode;
  className?: string;
}) {
  return (
    <nav
      aria-label="Product domains"
      /* The navigation drawer's dismissal layer checks for this to tell a tap on
         the rail apart from a tap outside the panel. */
      data-nav-rail=""
      className={cn(
        "flex h-full w-16 shrink-0 flex-col items-center gap-1 border-r border-border glass-bar",
        className
      )}
    >
      <div className="flex h-14 w-full shrink-0 items-center justify-center">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-md text-foreground"
          title="Strike OS"
        >
          <StrikeMark className="h-5 w-5" />
        </span>
      </div>
      <Separator className="mx-auto w-8" />

      <div className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto py-3">
        {NAV_DOMAINS.map((domain) => (
          <PrimaryNavItem
            key={domain.id}
            domain={domain}
            selected={domain.id === selectedId}
            isRoute={domain.id === routeId}
            onSelect={onSelect}
            buttonRef={(el) => registerRef(domain.id, el)}
          />
        ))}
      </div>

      <div className="flex w-full shrink-0 flex-col items-center gap-1 border-t border-border py-2">
        {footer}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onTogglePanel}
              aria-label={panelOpen ? "Collapse navigation panel" : "Expand navigation panel"}
              aria-expanded={panelOpen}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              {/* Points left when open (collapse) and right when closed (expand),
                  so the icon says which way the panel will move. */}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                  "h-4 w-4 transition-transform duration-200 motion-reduce:transition-none",
                  panelOpen ? "" : "rotate-180"
                )}
                aria-hidden="true"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {panelOpen ? "Collapse panel" : "Expand panel"}
          </TooltipContent>
        </Tooltip>
      </div>
    </nav>
  );
}
