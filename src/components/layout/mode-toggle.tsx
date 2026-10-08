"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeSelection } from "@/components/ui/theme-provider";

/**
 * Header dark/light toggle. Resolves the current appearance from the live
 * document (every theme pack sets `color-scheme` explicitly), so it stays
 * correct even while `theme` is a future/"system" value. Clicking toggles
 * between the two flagship packs: dark → clean, light → graphite. Picking one
 * pins it as this browser's own theme, so the workspace default stops applying.
 */
export function ModeToggle() {
  const { theme, chooseTheme } = useThemeSelection();
  const [mounted, setMounted] = React.useState(false);
  const [isDark, setIsDark] = React.useState(true);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const watch = () =>
      setIsDark(
        getComputedStyle(document.documentElement).colorScheme === "dark"
      );
    watch();
    const t = setTimeout(watch, 50);
    return () => clearTimeout(t);
  }, [theme]);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9" type="button">
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      type="button"
      onClick={() => chooseTheme(isDark ? "clean" : "graphite")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}