"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { StrikeMark } from "@/components/ui/logo";
import {
  Brain,
  Zap,
  Users,
  ListTodo,
  Activity,
  Layers,
  Settings,
  BookOpen,
  Network,
  Bot,
  Sparkles,
  Rocket,
  Compass,
  BarChart3,
} from "lucide-react";

const navItems = [
  {
    group: "Actions",
    items: [
      { title: "Start a mission", icon: Rocket, href: "/missions/new" },
      { title: "Observatory", icon: BarChart3, href: "/observability/events" },
      { title: "Work", icon: Compass, href: "/work" },
    ],
  },
  {
    group: "Workforce",
    items: [
      { title: "Agents", icon: Users, href: "/agents" },
      { title: "Missions", icon: ListTodo, href: "/missions" },
      { title: "Tasks", icon: Zap, href: "/tasks" },
    ],
  },
  {
    group: "Intelligence",
    items: [
      { title: "Topology", icon: Layers, href: "/topology" },
      { title: "Knowledge", icon: BookOpen, href: "/knowledge" },
      { title: "Memory", icon: Brain, href: "/memory" },
      { title: "Workflows", icon: Network, href: "/workflows" },
      { title: "Decisions", icon: Sparkles, href: "/decisions" },
    ],
  },
  {
    group: "System",
    items: [
      { title: "Settings", icon: Settings, href: "/settings" },
      { title: "Performance", icon: Activity, href: "/observability/performance" },
      { title: "Routing", icon: Network, href: "/routing" },
      { title: "Models", icon: Bot, href: "/models" },
    ],
  },
];

/** Display title for a stored recent slug; falls back to the slug itself. */
function titleFor(slug: string) {
  if (slug === "Home") return "Home";
  for (const g of navItems) {
    const hit = g.items.find((i) => i.href === `/${slug}`);
    if (hit) return hit.title;
  }
  return slug.replace(/-/g, " ");
}

export function CommandBar() {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cc:recents");
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        setRecent(
          Array.isArray(parsed)
            ? parsed.filter((x): x is string => typeof x === "string").slice(0, 6)
            : [],
        );
      }
    } catch {}
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (href: string) => {
    const name = href === "/" ? "Home" : href.slice(1).replace(/-/g, " ");
    try {
      const next = [name, ...recent.filter((r)=>r!==name)].slice(0,6);
      localStorage.setItem("cc:recents", JSON.stringify(next));
      setRecent(next);
    } catch {}
    router.push(href);
    setOpen(false);
  };

  return (
    <>
      <div className="mx-auto max-w-xl flex-1 px-4">
        <div className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-10 w-full items-center justify-between rounded-full bg-background/80 pl-5 pr-3 text-sm text-muted-foreground shadow-[0_0_2px_hsl(var(--foreground)/0.12),0_0_20px_-8px_hsl(var(--foreground)/0.18)] transition-shadow hover:shadow-[0_0_3px_hsl(var(--foreground)/0.2),0_0_26px_-6px_hsl(var(--foreground)/0.28)]"
          >
            <span>What would you like Strike OS to do?</span>
            <div className="flex items-center gap-1.5 rounded-full border bg-muted/60 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider">
              <span>⌘</span>
              <span>K</span>
            </div>
          </button>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Run command"
          className="md:hidden mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <StrikeMark className="h-4 w-4" />
        </button>
      </div>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {navItems.map((group) => (
            <CommandGroup key={group.group} heading={group.group}>
              {group.items.map((item) => (
                <CommandItem
                  key={item.href + item.title}
                  value={item.title}
                  onSelect={() => runCommand(item.href)}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.title}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          {recent.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Recents">
                {recent.map((r) => (
                  <CommandItem
                    key={r}
                    value={`recent:${r}`}
                    onSelect={() => runCommand(r === "Home" ? "/" : `/${r.toLowerCase().replace(/\s+/g, "-")}`)}
                  >
                    <Activity className="mr-2 h-4 w-4" />
                    {titleFor(r)}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
        <div className="flex items-center gap-4 border-t px-4 py-2.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border bg-muted px-1 font-mono">↑↓</kbd> to navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border bg-muted px-1 font-mono">esc</kbd> to close
          </span>
        </div>
      </CommandDialog>
    </>
  );
}