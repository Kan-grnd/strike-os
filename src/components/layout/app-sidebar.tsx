"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarRail } from "@/components/layout/sidebar-rail";
import { SidebarPanel, SecondaryNav } from "@/components/layout/sidebar-panel";
import { SidebarDrawer } from "@/components/layout/sidebar-drawer";
import {
  SidebarFooter,
  SidebarRailAttention,
  SidebarRailClosedFooter,
  useSidebarStatus,
} from "@/components/layout/sidebar-footer";
import {
  domainById,
  resolveNavigation,
  type NavigationDomain,
} from "@/lib/navigation";

/** Below this the pane cannot afford 192px of context, so Level 2 becomes an
 *  overlay. This is the same breakpoint the shell has always used to
 *  auto-collapse, so the sidebar never changes mode twice at two widths. */
const NARROW_QUERY = "(max-width: 1024px)";

const DOMAIN_STORAGE_KEY = "strikeos.sidebar-domain";

function loadStoredDomain(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DOMAIN_STORAGE_KEY);
    /* Validated against the config: a stale id from a renamed domain must not
       leave the panel blank. */
    return domainById(raw)?.id ?? null;
  } catch {
    return null;
  }
}

function persistDomain(id: string) {
  try {
    window.localStorage.setItem(DOMAIN_STORAGE_KEY, id);
  } catch {
    /* storage unavailable — the choice just won't survive reload */
  }
}

export interface AppSidebarProps {
  /** Whether Level 2 is open. Controls the panel, never the rail. */
  panelOpen?: boolean;
  onPanelOpenChange?: (open: boolean) => void;
  /** Suppresses the open/close transition on first paint, so restoring a saved
   *  state never animates. Matches the old sidebar's `suppressAnimation`. */
  suppressAnimation?: boolean;
}

/**
 * The two-level navigation.
 *
 * Level 1 is a rail of domain icons that never goes away; Level 2 is a panel
 * showing one domain's routes. Two things make it more than a layout change:
 *
 * - The **selected** domain and the **route's** domain are separate. Picking a
 *   rail icon changes what the panel shows without moving the user, so
 *   "what am I looking at" and "where am I" can legitimately disagree for a
 *   moment. When they do, the panel shows the selected domain with no item
 *   highlighted — never a highlight on a page the user is not on.
 * - A route change re-selects the domain that owns it. Otherwise navigating to
 *   `/settings` from a Workforce panel would leave the panel on Workforce,
 *   hiding the page the user just arrived at.
 */
export function AppSidebar({
  panelOpen = false,
  onPanelOpenChange,
  suppressAnimation = false,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { domain: routeDomain, child: routeChild } = React.useMemo(
    () => resolveNavigation(pathname),
    [pathname]
  );

  const [selectedId, setSelectedId] = React.useState<string | null>(routeDomain?.id ?? null);
  const [narrow, setNarrow] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const railRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const panelHeadingRef = React.useRef<HTMLSpanElement>(null);
  const status = useSidebarStatus();

  // Restore after mount so SSR and the first client render agree; the saved
  // domain is only a starting point, never an override of the route.
  React.useEffect(() => {
    setSelectedId(loadStoredDomain() ?? routeDomain?.id ?? null);
    setHydrated(true);
    // Intentionally mount-only: re-running on a route change would undo the
    // sync effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const onMatch = () => setNarrow(mq.matches);
    onMatch();
    mq.addEventListener("change", onMatch);
    return () => mq.removeEventListener("change", onMatch);
  }, []);

  // A route the config knows about re-points the panel at its own domain. A
  // route it does not know about is left alone, so an unlisted page does not
  // yank the user back to Overview — that is the case the stored domain exists
  // to cover.
  //
  // Deliberately NOT persisted. The stored value is the domain the user chose,
  // not the domain the last route happened to imply: overwriting it on every
  // navigation would leave nothing but the current route behind, and a route
  // the config does not know would then have nothing to fall back to.
  React.useEffect(() => {
    if (!routeDomain) return;
    setSelectedId(routeDomain.id);
  }, [routeDomain?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected: NavigationDomain | null = domainById(selectedId) ?? routeDomain;

  /* Whether Level 2 is on screen right now, in whichever form it takes. The
     panel and the drawer are the same thing to the user; only the container
     differs. */
  const level2Open = narrow ? drawerOpen : panelOpen;

  const selectDomain = (id: string) => {
    /* Pressing the icon of the domain already showing is a close. This is why
       the rail no longer carries a separate collapse button: the control that
       opened the panel is the one that puts it away, which is both fewer
       controls and the one a user reaches for. */
    if (selected?.id === id && level2Open) {
      if (narrow) {
        setDrawerOpen(false);
      } else {
        onPanelOpenChange?.(false);
      }
      /* Selection is deliberately left alone. Closing hides the panel, it does
         not forget the domain, so the same icon reopens it — and the stored
         value is untouched, because nothing about the user changed. Focus stays
         on the icon they just pressed rather than being dumped on the body by
         the panel unmounting. */
      return;
    }
    setSelectedId(id);
    persistDomain(id);
    if (narrow) {
      setDrawerOpen(true);
      return;
    }
    onPanelOpenChange?.(true);
    /* Move focus to the panel title so a keyboard or screen-reader user lands
       on the thing that just changed. Deferred a frame so the heading exists
       by the time it is focused. */
    requestAnimationFrame(() => panelHeadingRef.current?.focus());
  };

  const registerRef = React.useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) railRefs.current.set(id, el);
    else railRefs.current.delete(id);
  }, []);

  /* Escape inside the panel returns to the rail item that opened it, so focus
     never falls back to the document body. */
  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (selectedId) railRefs.current.get(selectedId)?.focus();
  };

  const activeHref = routeDomain?.id === selected?.id ? routeChild?.href ?? null : null;

  const showInlinePanel = panelOpen && !narrow && !!selected;
  /* The rail shows which domain is on screen, which is not the same as which
     domain is selected: closing the panel leaves the selection intact so the
     same icon reopens it, and an icon for a panel nobody can see must not look
     active. */
  const openDomainId = level2Open ? selected?.id ?? null : null;
  /* With Level 2 open, the panel's Status row already says whether the platform
     is online — a second dot for it in the rail is two controls telling the same
     story. The rail instead shows what the panel does not: work sitting on the
     user. Closed, the rail has no panel to lean on and carries both readings —
     the attention bell stacked above the status dot. */
  const railFooter =
    level2Open ? (
      <SidebarRailAttention />
    ) : (
      <SidebarRailClosedFooter status={status} />
    );
  const panelFooter = <SidebarFooter status={status} />;

  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={400}>
      <nav
        aria-label="Primary"
        className={cn("relative flex h-screen shrink-0", suppressAnimation ? "transition-none" : "")}
      >
        <div
          className={cn(
            /* The panel mounts the instant the width starts animating, so
               without clipping it paints at full size over the page for the
               duration of the transition — a flash of panel over content that
               reads as breakage. Clipping to the growing box turns the opening
               into a clean left-to-right reveal instead. */
            "flex h-full overflow-hidden",
            !suppressAnimation &&
              "transition-[width] duration-200 motion-reduce:transition-none"
          )}
          style={{ width: showInlinePanel ? "16rem" : "4rem" }}
        >
          <SidebarRail
            openDomainId={openDomainId}
            routeId={routeDomain?.id ?? null}
            onSelect={selectDomain}
            registerRef={registerRef}
            footer={railFooter}
          />
          {/* Persistent push layout: the panel is a sibling that takes its own
              192px, never a squeezed child of the animating row. `shrink-0`
              guards the one opening where the row is the flex parent deciding
              how its children share the 200ms of shrinking width. */}
          {showInlinePanel && selected && (
            <div className="shrink-0" onKeyDown={onPanelKeyDown}>
              <SidebarPanel
                domain={selected}
                activeHref={activeHref}
                footer={panelFooter}
                headingRef={panelHeadingRef}
              />
            </div>
          )}
        </div>

        {/* Hydration guard: before the stored domain is read, `selected` is
            whatever the route said on the server. Rendering the panel early
            would flash the wrong context on a reload. */}
        {hydrated && narrow && selected && (
          <SidebarDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            domain={selected}
            activeHref={activeHref}
            status={status}
            nav={
              <SecondaryNav
                domain={selected}
                activeHref={activeHref}
                onNavigate={() => setDrawerOpen(false)}
              />
            }
          />
        )}
      </nav>
    </TooltipProvider>
  );
}
