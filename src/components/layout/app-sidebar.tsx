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
  SidebarStatusDot,
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
  const panelHeadingRef = React.useRef<HTMLHeadingElement>(null);
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

  const selectDomain = (id: string) => {
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

  const togglePanel = () => {
    if (narrow) {
      setDrawerOpen((v) => !v);
      return;
    }
    onPanelOpenChange?.(!panelOpen);
  };

  /* Escape inside the panel returns to the rail item that opened it, so focus
     never falls back to the document body. */
  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (selectedId) railRefs.current.get(selectedId)?.focus();
  };

  const activeHref = routeDomain?.id === selected?.id ? routeChild?.href ?? null : null;

  const showInlinePanel = panelOpen && !narrow && !!selected;
  const railFooter = <SidebarStatusDot status={status} />;
  const panelFooter = <SidebarFooter status={status} />;

  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={400}>
      <div className={cn("relative flex h-screen shrink-0", suppressAnimation ? "transition-none" : "")}>
        <div
          className={cn(
            "flex h-full",
            !suppressAnimation &&
              "transition-[width] duration-200 motion-reduce:transition-none"
          )}
          style={{ width: showInlinePanel ? "16rem" : "4rem" }}
        >
          <SidebarRail
            selectedId={selected?.id ?? null}
            routeId={routeDomain?.id ?? null}
            onSelect={selectDomain}
            registerRef={registerRef}
            onTogglePanel={togglePanel}
            panelOpen={narrow ? drawerOpen : panelOpen}
            footer={railFooter}
          />
          {showInlinePanel && selected && (
            <div onKeyDown={onPanelKeyDown}>
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
      </div>
    </TooltipProvider>
  );
}
