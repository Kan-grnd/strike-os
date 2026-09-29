/**
 * Strike OS — Theme packs. Single source of truth for the pack list, used by
 * the header ModeToggle, the Settings → Appearance swatch grid, and the
 * next-themes `themes` prop. Keep the swatch hex values in sync with the
 * `--background` / `--card` / `--primary` tokens in styles/globals.css.
 */
export const THEME_IDS = [
  "abyssal",
  "ember",
  "ghost",
  "cobalt",
  "sandstorm",
  "abyss-teal",
  "onyx",
  "high-contrast",
  "strike",
  "mist",
  "forest",
  "vercel",
  "vercel-light",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

/** Narrowing guard for values that arrive from storage or the settings API. */
export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

/** Coerces any unknown/retired theme id to a live pack, defaulting to Abyssal. */
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
}

export const THEME_PACKS: ThemePack[] = [
  {
    id: "abyssal",
    name: "Abyssal",
    tagline: "Grey near-black · default",
    bg: "#171717",
    surface: "#292929",
    accent: "#e6e6e6",
  },
  {
    id: "ember",
    name: "Ember",
    tagline: "Warm charcoal dark",
    bg: "#1c1917",
    surface: "#2e2a29",
    accent: "#f97415",
  },
  {
    id: "ghost",
    name: "Ghost",
    tagline: "Light flagship",
    bg: "#ffffff",
    surface: "#f9f9f9",
    accent: "#1a1a1a",
  },
  {
    id: "cobalt",
    name: "Cobalt",
    tagline: "Deep slate-dark",
    bg: "#0f172a",
    surface: "#202d40",
    accent: "#38bdf8",
  },
  {
    id: "sandstorm",
    name: "Sandstorm",
    tagline: "Warm paper light",
    bg: "#fbf9f4",
    surface: "#f5efe5",
    accent: "#b45309",
  },
  {
    id: "abyss-teal",
    name: "Abyss Teal",
    tagline: "Earthy green dark",
    bg: "#3a3529",
    surface: "#474238",
    accent: "#899f7a",
  },
  {
    id: "onyx",
    name: "Onyx",
    tagline: "Pure black",
    bg: "#000000",
    surface: "#121617",
    accent: "#33b8cc",
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    tagline: "High contrast",
    bg: "#ffffff",
    surface: "#ffffff",
    accent: "#000000",
  },
  {
    id: "strike",
    name: "Strike",
    tagline: "Brand navy dark",
    bg: "#11172c",
    surface: "#1d233a",
    accent: "#f97a1f",
  },
  {
    id: "mist",
    name: "Mist",
    tagline: "Cool pale light",
    bg: "#f5f8fa",
    surface: "#e9eef1",
    accent: "#1b6fa7",
  },
  {
    id: "forest",
    name: "Forest",
    tagline: "Deep green dark",
    bg: "#13251d",
    surface: "#203229",
    accent: "#7eae5b",
  },
  {
    id: "vercel",
    name: "Vercel",
    tagline: "Pure black dark · Vercel blue",
    bg: "#000000",
    surface: "#111111",
    accent: "#006be6",
  },
  {
    id: "vercel-light",
    name: "Vercel Light",
    tagline: "Pure white light · Vercel blue",
    bg: "#ffffff",
    surface: "#fafafa",
    accent: "#006be6",
  },
];

export const DEFAULT_THEME: ThemeId = "abyssal";