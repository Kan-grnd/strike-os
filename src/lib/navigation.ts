import type * as React from "react";
import {
  Activity,
  BookOpen,
  Boxes,
  Brain,
  Cpu,
  Database,
  FileText,
  Gauge,
  Globe,
  Layers,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Network,
  Plug,
  Route,
  Settings,
  Sparkles,
  Target,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * The navigation configuration, in one place.
 *
 * The shell used to keep a flat list of sections inline in the sidebar
 * component, which meant the sidebar was both the *layout* and the *data*. With
 * two levels the mapping between a URL and a highlighted item stops being a
 * rendering detail and becomes the thing the whole sidebar is built on, so it
 * lives here instead and the components only draw it.
 *
 * Two invariants matter more than the shape:
 *
 * 1. Every route the app can reach appears exactly once. `scripts/check-navigation.ts`
 *    fails the build's test run if a page is unreachable, duplicated, or claims
 *    two domains, because a nav entry that silently points at nothing is worse
 *    than a missing one — it looks like the feature exists.
 * 2. A Level-1 domain is a *grouping* for navigation. Its first child is the
 *    section's entry point: the rail icon navigates to `children[0].href`. */


export type IconComponent = React.ComponentType<{ className?: string }>;

export interface NavigationChild {
  /** Level-2 label as shown in the panel. */
  label: string;
  /** Canonical destination. */
  href: string;
  /**
   * Extra path prefixes that belong to this item, e.g. `/agents/[id]` mounts at
   * `/agents/:id`. Matched as a path-prefix boundary so `/agentsfoo` does not
   * match `/agents`.
   */
  matches?: string[];
  /**
   * A Level-2 item that owns a region of the panel rather than a single link —
   * today only AI Chat, which keeps its history list open underneath the link.
   */
  kind?: "link" | "section";
}

export interface NavigationDomain {
  id: string;
  /** Level-1 label, used for the tooltip and the panel header. */
  label: string;
  icon: IconComponent;
  children: NavigationChild[];
}

export const NAV_DOMAINS: NavigationDomain[] = [
  {
    id: "control-center",
    label: "Control Center",
    icon: LayoutDashboard,
    children: [
      { label: "Control Center", href: "/" },
      { label: "AI Chat", href: "/chat", kind: "section" },
    ],
  },
  {
    id: "missions",
    label: "Missions",
    icon: Target,
    children: [
      /* Missions is the directing surface (M4.2). The legacy workflow/automation
       * detail (folded into mission triggers) still resolves here via `matches`
       * so an old bookmark or a workflow URL lights up the same item. */
      { label: "Missions", href: "/missions", matches: ["/missions", "/workflows"] },
      { label: "Tasks", href: "/tasks", matches: ["/tasks"] },
    ],
  },
  {
    id: "workforce",
    label: "Workforce",
    icon: Users,
    children: [
      { label: "Brain", href: "/workforce/brain" },
      { label: "Specialists", href: "/workforce/specialists" },
      { label: "Agents", href: "/workforce/agents", matches: ["/workforce/agents"] },
      { label: "Live", href: "/workforce/live" },
      /* Colony is demoted from a top-level domain (D21) to a Workforce item. */
      { label: "Colonies", href: "/colonies" },
      { label: "Capabilities", href: "/capabilities" },
    ],
  },
  {
    id: "activity",
    label: "Activity",
    icon: Activity,
    children: [
      { label: "Events", href: "/observability/events" },
      { label: "Traces", href: "/observability/traces", matches: ["/observability/traces"] },
      { label: "Logs", href: "/observability/logs" },
      /* Labelled Metrics, not Performance: this is the request's name for the
       * destination. Costs stays a separate item below rather than being folded
       * in here, so neither page loses its own entry. */
      { label: "Metrics", href: "/observability/performance" },
      { label: "Costs", href: "/observability/costs" },
      { label: "Decisions", href: "/decisions" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    children: [
      { label: "Settings", href: "/settings" },
      { label: "Models", href: "/models" },
      { label: "Routing", href: "/routing" },
      { label: "Tools", href: "/tools" },
      { label: "MCP", href: "/mcp" },
      { label: "Connectors", href: "/connectors" },
      { label: "Memory", href: "/memory" },
      { label: "Knowledge", href: "/knowledge" },
      { label: "Edit Queue", href: "/edit-queue" },
    ],
  },
];

/** Icons that Level 2 may show next to a route. Not every child has one. */
const CHILD_ICONS: Record<string, IconComponent> = {
  "/": LayoutDashboard,
  "/chat": MessageSquare,
  "/missions": Target,
  "/tasks": ListTodo,
  "/workforce/brain": Brain,
  "/workforce/specialists": Sparkles,
  "/workforce/agents": Users,
  "/workforce/live": Layers,
  "/colonies": Boxes,
  "/capabilities": Target,
  "/observability/events": Activity,
  "/observability/traces": FileText,
  "/observability/logs": FileText,
  "/observability/performance": Gauge,
  "/observability/costs": Gauge,
  "/decisions": BookOpen,
  "/settings": Settings,
  "/models": Cpu,
  "/routing": Route,
  "/tools": Wrench,
  "/mcp": Plug,
  "/connectors": Globe,
  "/memory": Database,
  "/knowledge": Network,
  "/edit-queue": ListTodo,
};

export function childIcon(href: string): IconComponent | undefined {
  return CHILD_ICONS[href];
}

/**
 * Whether `pathname` is `prefix` or something mounted under it.
 *
 * Naive `startsWith` is wrong here: `/tasks` would swallow `/tasksomething`, and
 * a domain whose child list grew a lookalike route would quietly render the
 * wrong panel. The boundary check is what makes "one route, one item" true.
 */
export function matchesPath(pathname: string, prefix: string): boolean {
  if (pathname === prefix) return true;
  if (!pathname.startsWith(prefix)) return false;
  /* The root is `/`, whose only child path is the empty string. */
  if (prefix === "/") return true;
  return pathname[prefix.length] === "/";
}

export interface ResolvedNavigation {
  /** The domain the *current route* belongs to, or null for an unknown route. */
  domain: NavigationDomain | null;
  /** The child the current route belongs to, or null. */
  child: NavigationChild | null;
}

/**
 * Which domain and item a pathname belongs to.
 *
 * Two passes, and the order is the whole point. The root href `/` is a prefix
 * of every path, so a single pass that walks the config in order lets Overview's
 * "Command Center" claim `/settings`, `/topology` and everything else — the
 * panel would then follow the user to any page and highlight the wrong item.
 * So exact hits are settled first, and prefix matching only ever runs over
 * routes the first pass did not already claim.
 *
 * Unknown routes resolve to nulls rather than guessing: a page that is not in
 * the config must not light up a nav item, and the panel should keep showing
 * whatever the user last chose instead of snapping back to Overview.
 */
export function resolveNavigation(pathname: string): ResolvedNavigation {
  const fallback: Array<{ domain: NavigationDomain; child: NavigationChild; prefix: string }> = [];

  for (const domain of NAV_DOMAINS) {
    for (const child of domain.children) {
      for (const prefix of [child.href, ...(child.matches ?? [])]) {
        if (pathname === prefix) return { domain, child };
        /* The root is a prefix of everything, so it can only ever be a
         * fallback — it is what an unknown path would otherwise match. */
        if (prefix !== "/" && matchesPath(pathname, prefix)) {
          fallback.push({ domain, child, prefix });
        }
      }
    }
  }

  if (fallback.length > 0) {
    /* Longest prefix wins, so `/observability/traces` beats `/observability`
     * if the config ever grows a nested one. */
    const best = fallback.reduce((a, b) => (b.prefix.length > a.prefix.length ? b : a));
    return { domain: best.domain, child: best.child };
  }

  return { domain: null, child: null };
}

export function domainById(id: string | null): NavigationDomain | null {
  if (!id) return null;
  return NAV_DOMAINS.find((d) => d.id === id) ?? null;
}
