"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { EditModeProvider } from "@/components/edit-mode/edit-mode-provider";
import { EditModeToggle } from "@/components/edit-mode/edit-mode-toggle";
import { CommandBar } from "@/components/shell/command-bar";
import { useSettings } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

export default function GlobalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullBleed = pathname === "/chat";
  const { data: settings } = useSettings();
  const [collapsed, setCollapsed] = useState(false);
  // Suppress the sidebar's width transition until the saved start state is
  // applied so the initial load never flashes — runtime chevron toggles keep
  // animating.
  const [suppressAnimation, setSuppressAnimation] = useState(true);
  const didInit = useRef(false);

  // On narrow screens the full sidebar steals the whole page, so collapse it
  // to icons automatically. Session-only — never written back to settings.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const onMatch = () => setCollapsed((prev) => (mq.matches ? true : prev));
    onMatch();
    mq.addEventListener("change", onMatch);
    return () => mq.removeEventListener("change", onMatch);
  }, []);

  // Saved value is only the start state; the header chevron is a session
  // override and never writes back. Narrow screens keep the auto-collapsed
  // state — the saved "open" preference must not override it.
  useEffect(() => {
    if (didInit.current) return;
    if (window.matchMedia("(max-width: 1024px)").matches) {
      didInit.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => setSuppressAnimation(false)));
      return;
    }
    const saved = settings?.settings?.["workspace.sidebarCollapsed"];
    if (saved === undefined) return;
    didInit.current = true;
    setCollapsed(saved === "true");
    requestAnimationFrame(() => requestAnimationFrame(() => setSuppressAnimation(false)));
  }, [settings]);

  // Safety net: if settings never resolve, re-enable animations so the toggle
  // still animates.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!didInit.current) {
        didInit.current = true;
        setSuppressAnimation(false);
      }
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex h-screen bg-background app-grid text-foreground font-sans antialiased">
      <Sidebar collapsed={collapsed} onCollapsedChange={setCollapsed} suppressAnimation={suppressAnimation} />
      <main className="flex-1 min-w-0 overflow-auto relative">
        <EditModeProvider>
          <header className="sticky top-0 z-[82] bg-background border-b h-14 flex items-center justify-between px-6">
            <span className="text-xl font-bold shrink-0">Strike OS</span>
            <CommandBar />
            <div className="flex items-center gap-2 shrink-0">
              <EditModeToggle />
              <ThemeSwitcher />
            </div>
          </header>
          <div className={cn(fullBleed ? "flex h-[calc(100dvh-3.5rem)] flex-col" : "p-6")}>
            {children}
          </div>
        </EditModeProvider>
      </main>
    </div>
  );
}