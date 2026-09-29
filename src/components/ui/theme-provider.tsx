"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { type ThemeProviderProps } from "next-themes/dist/types";
import {
  DEFAULT_THEME,
  THEME_IDS,
  isThemeId,
  normalizeThemeId,
  type ThemeId,
} from "@/lib/theme-packs";

const ALLOWED = new Set<string>([...THEME_IDS, "system", "light", "dark"]);

/** next-themes' own storage key for the active theme. */
const THEME_KEY = "theme";

/**
 * Records *why* a pack is stored. "explicit" means a human picked one in this
 * browser, so it must survive workspace-default changes. "workspace" means the
 * value is inherited and should keep tracking the workspace default. A missing
 * marker is read as explicit, so choices made before this key existed keep
 * winning.
 */
const THEME_SOURCE_KEY = "strike:theme-source";

/** SystemSetting key holding the workspace-wide default pack. */
export const WORKSPACE_DEFAULT_THEME_KEY = "appearance.defaultThemeId";

export type ThemeSource = "explicit" | "workspace";

function readStoredTheme(): string | null {
  try {
    return window.localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function readThemeSource(): ThemeSource | null {
  try {
    const raw = window.localStorage.getItem(THEME_SOURCE_KEY);
    return raw === "explicit" || raw === "workspace" ? raw : null;
  } catch {
    return null;
  }
}

function writeThemeSource(source: ThemeSource) {
  try {
    window.localStorage.setItem(THEME_SOURCE_KEY, source);
  } catch {
    /* storage unavailable — the value still applies for this session */
  }
}

/** True when this browser holds a pack a human picked, which outranks the default. */
export function hasExplicitThemeChoice(): boolean {
  return readStoredTheme() !== null && readThemeSource() !== "workspace";
}

/**
 * Applies the workspace default to browsers that have not chosen a pack, and
 * keeps following it while they stay on it. Resolves once per mount; an
 * explicit browser choice short-circuits the whole thing.
 */
function WorkspaceDefaultTheme() {
  const { setTheme } = useTheme();
  const settled = React.useRef(false);

  React.useEffect(() => {
    // StrictMode runs effects twice; only the first pass starts the fetch.
    if (settled.current) return;
    settled.current = true;

    if (hasExplicitThemeChoice()) return;

    // Deliberately not cancelled on cleanup: the first StrictMode pass is
    // torn down before its fetch lands, and aborting there would strand the
    // resolution. setTheme on a remounted provider is harmless.
    const apply = (next: ThemeId) => {
      writeThemeSource("workspace");
      setTheme(next);
    };

    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const stored = data?.settings?.[WORKSPACE_DEFAULT_THEME_KEY];
        apply(isThemeId(stored) ? stored : DEFAULT_THEME);
      })
      .catch(() => {
        // Settings unreachable: keep whatever valid pack is already active,
        // otherwise the code default.
        const stored = readStoredTheme();
        apply(isThemeId(stored) ? stored : DEFAULT_THEME);
      });
  }, [setTheme]);

  return null;
}

/** Drops any theme class that is no longer a live pack (renamed or removed). */
function stripRetiredClasses() {
  Array.from(document.documentElement.classList).forEach((c) => {
    if (!ALLOWED.has(c)) document.documentElement.classList.remove(c);
  });
}

function RetiredThemeGuard() {
  const { setTheme } = useTheme();
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = readStoredTheme();
    if (stored && !ALLOWED.has(stored)) {
      try {
        window.localStorage.removeItem(THEME_KEY);
      } catch {
        /* storage unavailable — nothing to clear */
      }
      setTheme(DEFAULT_THEME);
    }

    // next-themes re-applies a retired class from its hydration state, and the
    // timing relative to the workspace-default fetch above is not fixed — watch
    // the attribute so the strip lands whenever the class reappears, instead of
    // racing it with fixed timeouts.
    const observer = new MutationObserver(stripRetiredClasses);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [setTheme]);
  return null;
}

export interface ThemeSelection {
  /** Active pack id, or undefined while next-themes is still hydrating. */
  theme: string | undefined;
  /** Applies a pack and pins it as this browser's explicit override. */
  chooseTheme: (id: ThemeId) => void;
  /** Re-derives the theme from the workspace default and stops pinning it. */
  followWorkspaceDefault: (workspaceDefault?: ThemeId) => void;
}

/**
 * Theme controls go through this so a manual pick is recorded as an explicit
 * override instead of being clobbered by the workspace default.
 */
export function useThemeSelection(): ThemeSelection {
  const { theme, setTheme } = useTheme();

  const chooseTheme = React.useCallback(
    (id: ThemeId) => {
      writeThemeSource("explicit");
      setTheme(id);
    },
    [setTheme]
  );

  const followWorkspaceDefault = React.useCallback(
    (workspaceDefault?: ThemeId) => {
      writeThemeSource("workspace");
      setTheme(normalizeThemeId(workspaceDefault, DEFAULT_THEME));
    },
    [setTheme]
  );

  return { theme, chooseTheme, followWorkspaceDefault };
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <WorkspaceDefaultTheme />
      <RetiredThemeGuard />
      {children}
    </NextThemesProvider>
  );
}
