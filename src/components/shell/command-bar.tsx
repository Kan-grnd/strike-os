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
} from "lucide-react";

const navItems = [
  {
    group: "Overview",
    items: [
      { title: "Home", icon: Brain, href: "/" },
      { title: "Dashboard", icon: Activity, href: "/" },
      { title: "Observatory", icon: Sparkles, href: "/observatory" },
    ],
  },
  {
    group: "Workforce",
    items: [
      { title: "Agents", icon: Users, href: "/agents" },
      { title: "Missions", icon: ListTodo, href: "/missions" },
      { title: "Tasks", icon: Zap, href: "/tasks" },
      { title: "Automations", icon: Activity, href: "/automations" },
    ],
  },
  {
    group: "Intelligence",
    items: [
      { title: "Topology", icon: Layers, href: "/topology" },
      { title: "Knowledge", icon: BookOpen, href: "/knowledge" },
      { title: "Memory", icon: Brain, href: "/memory" },
      { title: "Workflows", icon: Network, href: "/workflows" },
      { title: "Context", icon: Bot, href: "/context" },
      { title: "Decisions", icon: Sparkles, href: "/decisions" },
    ],
  },
  {
    group: "System",
    items: [
      { title: "Settings", icon: Settings, href: "/settings" },
      { title: "Performance", icon: Activity, href: "/performance" },
      { title: "Routing", icon: Network, href: "/routing" },
      { title: "Models", icon: Bot, href: "/models" },
    ],
  },
];

export function CommandBar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
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
            <span>What would you like Strike OS to do?…</span>
            <div className="flex items-center gap-1.5 rounded-full border bg-muted/60 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider">
              <span>⌘</span>
              <span>K</span>
            </div>
          </button>
          <div className="pointer-events-none absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-transparent">
            <StrikeMark className="h-4 w-4" />
          </div>
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
          <CommandSeparator />
        </CommandList>
      </CommandDialog>
    </>
  );
}