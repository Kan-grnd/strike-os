"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatHistoryNav } from "@/components/layout/chat-history-nav";
import { SIDEBAR_FOOTER_ZONE } from "@/components/layout/sidebar-footer";
import { childIcon, type NavigationChild, type NavigationDomain } from "@/lib/navigation";

/**
 * The contextual title: which domain is open, above the Strike OS mark.
 *
 * `tabIndex={-1}` because the panel is a focus target after a rail click, and
 * a heading that cannot receive focus would send focus to the first link
 * instead — skipping the thing the user just asked to see.
 */
export function ContextHeader({
  domain,
  headingRef,
  brandLine,
}: {
  domain: NavigationDomain;
  headingRef?: React.Ref<HTMLHeadingElement>;
  brandLine?: React.ReactNode;
}) {
  const Icon = domain.icon;
  return (
    <div className="shrink-0 border-b border-border px-4 pb-3 pt-4">
      {brandLine}
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="truncate text-sm font-semibold focus-visible:outline-none"
        >
          {domain.label}
        </h2>
      </div>
    </div>
  );
}

/**
 * One Level-2 destination.
 *
 * `aria-current="page"` marks the real route and nothing else. When the panel is
 * showing a domain the user picked but the current route lives elsewhere, no
 * item carries it — an active state that points at a page you are not on is a
 * lie the user has to notice and dismiss.
 */
function SecondaryNavItem({
  child,
  active,
  onNavigate,
}: {
  child: NavigationChild;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = childIcon(child.href);
  return (
    <Link
      href={child.href}
      aria-current={active ? "page" : undefined}
      /* The inline panel stays open when you navigate inside it, so this is
         only ever supplied by the overlay drawer, which has to get out of the
         way or it leaves the user staring at a modal over the page they just
         asked for. */
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary"
        />
      )}
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{child.label}</span>
    </Link>
  );
}

/** The routes of one domain, and nothing from any other domain. */
export function SecondaryNav({
  domain,
  activeHref,
  onNavigate,
}: {
  domain: NavigationDomain;
  /** The href the resolver matched for the current route, or null. */
  activeHref: string | null;
  /** Called when a destination is chosen. See `SecondaryNavItem`. */
  onNavigate?: () => void;
}) {
  return (
    /* Matches the old sidebar-nav hook, which keeps the focus ring inside the
       row instead of striping across the panel. */
    <nav aria-label={`${domain.label} pages`} className="sidebar-nav space-y-0.5">
      {domain.children.map((child) => (
        <div key={child.href}>
          {child.kind === "section" ? (
            /* AI Chat owns its own history list, so it manages its own active
               state against the query string rather than the bare path. */
            <ChatHistoryNav onNavigate={onNavigate} />
          ) : (
            <SecondaryNavItem child={child} active={child.href === activeHref} onNavigate={onNavigate} />
          )}
        </div>
      ))}
    </nav>
  );
}

/**
 * Level 2: the routes of the selected domain.
 *
 * There is no third level. A panel either shows its domain's routes or it shows
 * one route's own list (chat history), never a domain inside a domain.
 */
export function SidebarPanel({
  domain,
  activeHref,
  footer,
  headingRef,
  onNavigate,
  className,
}: {
  domain: NavigationDomain;
  activeHref: string | null;
  footer: React.ReactNode;
  headingRef?: React.Ref<HTMLHeadingElement>;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <div
      style={{
        /* Thinner than the rail's `glass-bar`, and built from the same tokens
           rather than a new class: the panel is chrome that content sits beside,
           and the one place a real elevation would be wrong. `glass-elevated` is
           reserved for things floating *above* the working surface. */
        background: `hsl(var(--background) / calc(var(--glass-alpha-bar) * 0.82))`,
        backdropFilter: "blur(var(--glass-blur-md)) saturate(var(--glass-saturate))",
        WebkitBackdropFilter: "blur(var(--glass-blur-md)) saturate(var(--glass-saturate))",
      }}
      className={cn(
        "flex h-full w-48 shrink-0 flex-col border-r border-border",
        className
      )}
    >
      <ContextHeader domain={domain} headingRef={headingRef} />
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-3 py-3">
          <SecondaryNav domain={domain} activeHref={activeHref} onNavigate={onNavigate} />
        </div>
      </ScrollArea>
      <div className={cn(SIDEBAR_FOOTER_ZONE, "px-3")}>{footer}</div>
    </div>
  );
}
