/**
 * Strike OS — Theme packs. Single source of truth for the pack list, used by
 * the header ModeToggle, the Settings → Appearance swatch grid, and the
 * next-themes `themes` prop. Keep the swatch hex values in sync with the
 * `--background` / `--card` / `--primary` / `--secondary` tokens in
 * styles/globals.css. Every pack ships four colors (bg-surface-accent-secondary),
 * monochrome-first, one dark color anchor (`signal`).
 */
export const THEME_IDS = [
  "clean",
  "calm",
  "bold",
  "graphite",
  "void",
  "signal",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

/** Narrowing guard for values that arrive from storage or the settings API. */
export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

/** Coerces any unknown/retired theme id to a live pack, defaulting to Graphite. */
export function normalizeThemeId(value: unknown, fallback: ThemeId = DEFAULT_THEME): ThemeId {
  return isThemeId(value) ? value : fallback;
}

export interface ThemePack {
  id: ThemeId;
  name: string;
  tagline: string;
  bg: string;
  surface: string;
  accent: string;
  secondary: string;
}

export const THEME_PACKS: ThemePack[] = [
  {
    id: "clean",
    name: "Clean",
    tagline: "Minimal light monochrome",
    bg: "#ffffff",
    surface: "#fafafa",
    accent: "#171717",
    secondary: "#e5e5e5",
  },
  {
    id: "calm",
    name: "Calm",
    tagline: "Soft low-contrast light",
    bg: "#f5f4f1",
    surface: "#eeede8",
    accent: "#4a4a45",
    secondary: "#dfddd6",
  },
  {
    id: "bold",
    name: "Bold",
    tagline: "High-contrast black & white",
    bg: "#ffffff",
    surface: "#ffffff",
    accent: "#000000",
    secondary: "#dedede",
  },
  {
    id: "graphite",
    name: "Graphite",
    tagline: "Dark neutral monochrome · default",
    bg: "#171717",
    surface: "#212121",
    accent: "#e8e8e8",
    secondary: "#2e2e2e",
  },
  {
    id: "void",
    name: "Void",
    tagline: "Pure black monochrome",
    bg: "#000000",
    surface: "#141414",
    accent: "#f2f2f2",
    secondary: "#262626",
  },
  {
    id: "signal",
    name: "Signal",
    tagline: "Dark slate · vivid orange",
    bg: "#0f0f12",
    surface: "#1b1b20",
    accent: "#f97316",
    secondary: "#292930",
  },
];

export const DEFAULT_THEME: ThemeId = "graphite";