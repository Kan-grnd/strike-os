"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { StrikeMark } from "@/components/ui/logo";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_DOMAINS, type NavigationDomain } from "@/lib/navigation";
import { SIDEBAR_FOOTER_ZONE } from "@/components/layout/sidebar-footer";

/**
 * One Level-1 domain, as an icon.
 *
 * `aria-expanded` rather than `aria-current`, because pressing a rail icon does
 * not move the user anywhere — it opens or closes the panel beside it, so
 * claiming it is the current page would tell a screen reader the user is
 * somewhere they are not. It is also literally a disclosure now, so this is the
 * state assistive technology expects. `aria-current="page"` belongs to the
 * Level-2 links, which really are destinations.
 *
 * The active fill and the left indicator are both present so the open state does
 * not rest on colour alone, and the tooltip carries the label the icon omits.
 */
function PrimaryNavItem({
  domain,
  open,
  isRoute,
  onSelect,
  buttonRef,
}: {
  domain: NavigationDomain;
  /** This domain's panel is the one on screen. */
  open: boolean;
  /** This domain owns the current route — a quieter, second signal. */
  isRoute: boolean;
  onSelect: (id: string) => void;
  buttonRef?: (el: HTMLButtonElement | null) => void;
}) {
  const Icon = domain.icon;
  const router = useRouter();
  const firstHref = domain.children[0]?.href;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => onSelect(domain.id)}
          onPointerEnter={() => {
            if (firstHref) router.prefetch(firstHref);
          }}
          onFocus={() => {
            if (firstHref) router.prefetch(firstHref);
          }}
          aria-expanded={open}
          aria-label={domain.label}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
            "focus-visible:outline-none focus-visible:outline-offset-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60",
            open
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          {/* A solid bar rather than a ring or a glow: the packs whose accent
              sits close to the sidebar fill lose a subtle indicator, and this is
              the one mark that survives every pack. */}
          {open && (
            <span
              aria-hidden="true"
              className="absolute -left-1.5 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary"
            />
          )}
          <Icon className="h-[18px] w-[18px]" />
          {/* The open domain is not always the domain of the current route —
              you can be reading Observatory while browsing the Model Brain
              panel. A second, quieter dot says "this is where you are" without
              competing with the panel that is open. */}
          {isRoute && !open && (
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
 * The rail never disappears, and it carries its own branding and status dot
 * because they have nowhere else to live when the panel is closed. There is no
 * separate collapse button: each domain icon opens and closes its own panel, so
 * one control does both jobs and there is nothing here that only closes things.
 */
export function SidebarRail({
  openDomainId,
  routeId,
  onSelect,
  registerRef,
  footer,
  className,
}: {
  openDomainId: string | null;
  routeId: string | null;
  onSelect: (id: string) => void;
  registerRef: (id: string, el: HTMLButtonElement | null) => void;
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
          className="flex h-8 w-8 items-center justify-center rounded-xl text-foreground"
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
            open={domain.id === openDomainId}
            isRoute={domain.id === routeId}
            onSelect={onSelect}
            buttonRef={(el) => registerRef(domain.id, el)}
          />
        ))}
      </div>

      <div className={cn(SIDEBAR_FOOTER_ZONE, "w-full justify-center")}>{footer}</div>
    </nav>
  );
}
