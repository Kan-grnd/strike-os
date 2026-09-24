"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Activity,
  Users,
  Boxes,
  Sparkles,
  Target,
  ListTodo,
  GitBranch,
  Zap,
  Database,
  Network,
  BookOpen,
  Cpu,
  Route,
  Cloud,
  Gauge,
  Wrench,
  Globe,
  Plug,
  FileText,
  BarChart3,
  DollarSign,
  Layers,
  Settings,
  ChevronDown,
} from "lucide-react";
import { StrikeMark } from "@/components/ui/logo";
import { ChatHistoryNav } from "@/components/layout/chat-history-nav";

type SectionItem =
  | { title: string; href: string; icon: React.ComponentType<{ className?: string }> }
  | { title: string; component: typeof ChatHistoryNav };

const navigationSections: { title: string; items: SectionItem[] }[] = [
  {
    title: "OVERVIEW",
    items: [
      { title: "Command Center", href: "/", icon: LayoutDashboard },
      { title: "AI Chat", component: ChatHistoryNav },
    ],
  },
  {
    title: "WORKFORCE",
    items: [
      { title: "Agents", href: "/agents", icon: Users },
      { title: "Colonies", href: "/colonies", icon: Boxes },
      { title: "Agent Architect", href: "/architect", icon: Sparkles },
      { title: "Capabilities", href: "/capabilities", icon: Target },
    ],
  },
  {
    title: "EXECUTION",
    items: [
      { title: "Missions", href: "/missions", icon: Target },
      { title: "Tasks", href: "/tasks", icon: ListTodo },
      { title: "Workflows", href: "/workflows", icon: GitBranch },
    ],
  },
  {
    title: "AUTOMATION",
    items: [
      { title: "Automations", href: "/automations", icon: Zap },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      { title: "Memory", href: "/memory", icon: Database },
      { title: "Knowledge Graph", href: "/knowledge", icon: Network },
      { title: "Decisions", href: "/decisions", icon: BookOpen },
    ],
  },
  {
    title: "MODEL BRAIN",
    items: [
      { title: "Models", href: "/models", icon: Cpu },
      { title: "Routing", href: "/routing", icon: Route },
      { title: "Performance", href: "/observability/performance", icon: Gauge },
    ],
  },
  {
    title: "TOOL FABRIC",
    items: [
      { title: "Tools", href: "/tools", icon: Wrench },
      { title: "MCP Servers", href: "/mcp", icon: Plug },
      { title: "API Connections", href: "/connectors", icon: Globe },
    ],
  },
  {
    title: "OBSERVATORY",
    items: [
      { title: "Live Topology", href: "/topology", icon: Layers },
      { title: "Events", href: "/observability/events", icon: Activity },
      { title: "Traces", href: "/observability/traces", icon: FileText },
      { title: "Logs", href: "/observability/logs", icon: FileText },
      { title: "Costs", href: "/observability/costs", icon: DollarSign },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  suppressAnimation?: boolean;
}

/** Static fallback shown if the live count is unavailable. */
const AGENT_COUNT_FALLBACK = 8;

const SECTIONS_STORAGE_KEY = "strikeos.sidebar-sections";

/** All sections default to open; only collapsed titles are persisted. */
function loadClosedSections(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SECTIONS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function Sidebar({ collapsed = false, onCollapsedChange, suppressAnimation = false }: SidebarProps) {
  const pathname = usePathname();
  const [agentCount, setAgentCount] = useState<number | null>(null);
  // Persist open/closed map only when the user toggles a section — never on
  // mount, otherwise the restore below is wiped before it can read.
  const [closedSections, setClosedSections] = useState<Set<string>>(() => new Set());

  // Restore persisted collapsed map after mount so SSR and hydration stay in sync.
  useEffect(() => {
    setClosedSections(loadClosedSections());
  }, []);

  const toggleSection = (title: string) => {
    setClosedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      try {
        window.localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        /* storage unavailable — section state just won't survive reload */
      }
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (Array.isArray(d?.agents)) setAgentCount(d.agents.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className={cn(
        "relative flex h-screen flex-col border-r bg-card",
        collapsed ? "w-16" : "w-60",
        suppressAnimation ? "transition-none" : "transition-all duration-200"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex h-14 items-center border-b",
          collapsed ? "justify-center px-0" : "justify-between px-4"
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onCollapsedChange?.(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <StrikeMark className="h-5 w-5" />
            </button>
            <div className="flex flex-col">
              <span className="text-sm font-bold">STRIKE OS</span>
              <span className="text-micro text-muted-foreground">v0.1.0</span>
            </div>
          </div>
        )}
        {collapsed && (
          <button
            type="button"
            onClick={() => onCollapsedChange?.(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <StrikeMark className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="sidebar-nav space-y-6">
          {navigationSections.map((section) => {
            const isOpen = collapsed || !closedSections.has(section.title);
            return (
              <div key={section.title} className="space-y-1">
                {collapsed ? (
                  <Separator className="my-2" />
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    aria-expanded={isOpen}
                    className="group flex w-full items-center justify-between px-3 py-1 text-left"
                  >
                    <span className="text-primary text-[10px] font-bold uppercase tracking-[0.12em]">
                      {section.title}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>
                )}
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="min-h-0 overflow-hidden" aria-hidden={!isOpen}>
                    <div
                      className={cn(
                        "space-y-0.5 transition-opacity duration-200 motion-reduce:transition-none",
                        isOpen ? "opacity-100" : "pointer-events-none opacity-0"
                      )}
                    >
                      {section.items.map((item) => {
                        if ("component" in item) {
                          return (
                            <item.component key={item.title} collapsed={collapsed} />
                          );
                        }
                        const isActive = pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                              isActive
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                            )}
                            title={collapsed ? item.title : undefined}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            {!collapsed && <span>{item.title}</span>}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-3">
        {!collapsed && (
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                Online
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Agents</span>
              <span className="font-medium text-foreground">
                {agentCount ?? AGENT_COUNT_FALLBACK}
              </span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}
