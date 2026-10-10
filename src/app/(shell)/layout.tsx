"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ModeToggle } from "@/components/layout/mode-toggle";
import { EditModeProvider } from "@/components/edit-mode/edit-mode-provider";
import { EditModeToggle } from "@/components/edit-mode/edit-mode-toggle";
import { CommandBar } from "@/components/shell/command-bar";
import { useSettings } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { ThemeAmbient } from "@/components/dashboard/command-center/theme-ambient";

export default function GlobalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullBleed =
    pathname === "/chat" || pathname === "/topology" || pathname === "/knowledge";

  const { data: settings } = useSettings();
  /* `panelOpen` rather than `collapsed`: the rail is always present, so what
   * this controls is whether Level 2 has a column of its own. Open by default,
   * which is what `workspace.sidebarCollapsed: "false"` means. */
  const [panelOpen, setPanelOpen] = useState(true);
  // Suppress the sidebar's width transition until the saved start state is
  // applied so the initial load never flashes — runtime toggles keep animating.
  const [suppressAnimation, setSuppressAnimation] = useState(true);
  const didInit = useRef(false);

  // On narrow screens a 192px context panel steals the page, so the navigation
  // starts as the rail alone. Session-only — never written back to settings.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const onMatch = () => setPanelOpen((prev) => (mq.matches ? false : prev));
    onMatch();
    mq.addEventListener("change", onMatch);
    return () => mq.removeEventListener("change", onMatch);
  }, []);

  // Saved value is only the start state; the rail toggle is a session override
  // and never writes back. Narrow screens keep the panel closed — the saved
  // "open" preference must not override it.
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
    /* The stored key is `sidebarCollapsed`, so it answers the opposite question
     * from the state it now drives: "not collapsed" means the panel is open.
     * Reading it as `=== "true"` would start every session collapsed, which is
     * the opposite of what the setting says. */
    setPanelOpen(saved !== "true");
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
      <Suspense fallback={null}>
        <AppSidebar
          panelOpen={panelOpen}
          onPanelOpenChange={setPanelOpen}
          suppressAnimation={suppressAnimation}
        />
      </Suspense>
      <main className="flex-1 min-w-0 overflow-auto relative">
        <EditModeProvider>
          <header className="sticky top-0 z-[82] glass-bar border-b h-14 flex items-center justify-between px-6">
            <span className="text-xl font-bold shrink-0">Strike OS</span>
            <CommandBar />
            <div className="flex items-center gap-2 shrink-0">
              <EditModeToggle />
              <ModeToggle />
            </div>
          </header>
          <div className={cn(fullBleed ? "flex h-[calc(100dvh-3.5rem)] flex-col" : "p-6")}>
            <ThemeAmbient />
            {children}
          </div>
        </EditModeProvider>
      </main>
    </div>
  );
}