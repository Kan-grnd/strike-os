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
  MessageSquare,
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
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navigationSections = [
  {
    title: "OVERVIEW",
    items: [
      { title: "Command Center", href: "/", icon: LayoutDashboard },
      { title: "AI Chat", href: "/chat", icon: MessageSquare },
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
      <div className="flex h-14 items-center justify-between border-b px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <svg
                viewBox="34.027344 41.152344 431.945312 417.695312"
                className="h-5 w-5 text-primary-foreground"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="nonzero"
                  d="M 352.796875 314.324219 L 352.796875 350.554688 L 137.839844 187.710938 L 137.839844 151.480469 Z M 333.660156 142.929688 L 292.542969 179.570312 L 321.855469 205.21875 L 465.972656 41.152344 L 377.628906 100.996094 L 96.316406 99.777344 L 96.316406 208.472656 L 296.207031 358.292969 L 160.230469 358.699219 L 203.386719 321.246094 L 170.410156 296.410156 L 34.027344 458.847656 L 114.636719 402.667969 L 395.949219 402.667969 L 395.949219 292.746094 L 196.464844 142.929688 Z M 333.660156 142.929688"
                />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold">STRIKE OS</span>
              <span className="text-micro text-muted-foreground">v0.1.0</span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <svg
              viewBox="34.027344 41.152344 431.945312 417.695312"
              className="h-5 w-5 text-primary-foreground"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="nonzero"
                d="M 352.796875 314.324219 L 352.796875 350.554688 L 137.839844 187.710938 L 137.839844 151.480469 Z M 333.660156 142.929688 L 292.542969 179.570312 L 321.855469 205.21875 L 465.972656 41.152344 L 377.628906 100.996094 L 96.316406 99.777344 L 96.316406 208.472656 L 296.207031 358.292969 L 160.230469 358.699219 L 203.386719 321.246094 L 170.410156 296.410156 L 34.027344 458.847656 L 114.636719 402.667969 L 395.949219 402.667969 L 395.949219 292.746094 L 196.464844 142.929688 Z M 333.660156 142.929688"
              />
            </svg>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onCollapsedChange?.(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
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
