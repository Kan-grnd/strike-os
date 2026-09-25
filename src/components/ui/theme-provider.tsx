"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { type ThemeProviderProps } from "next-themes/dist/types";
import { DEFAULT_THEME, THEME_IDS } from "@/lib/theme-packs";

const ALLOWED = new Set<string>([...THEME_IDS, "system", "light", "dark"]);

function RetiredThemeGuard() {
  const { setTheme } = useTheme();
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem("theme");
    } catch {
      return;
    }
    if (stored && !ALLOWED.has(stored)) {
      try {
        window.localStorage.removeItem("theme");
      } catch {
        /* storage unavailable — nothing to clear */
      }
      setTheme(DEFAULT_THEME);
      const strip = () => {
        Array.from(document.documentElement.classList).forEach((c) => {
          if (!ALLOWED.has(c)) document.documentElement.classList.remove(c);
        });
      };
      strip();
      // next-themes re-applies the retired class from its hydration state for
      // a beat — strip again until it settles.
      const t1 = window.setTimeout(strip, 150);
      const t2 = window.setTimeout(strip, 600);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }
  }, [setTheme]);
  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <RetiredThemeGuard />
      {children}
    </NextThemesProvider>
  );
}