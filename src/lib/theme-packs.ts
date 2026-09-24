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
  "porcelain",
  "arctic",
  "onyx",
  "high-contrast",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

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
    tagline: "Near-black · default",
    bg: "#0a0a0b",
    surface: "#121214",
    accent: "#f4f4f5",
  },
  {
    id: "ember",
    name: "Ember",
    tagline: "Warm ember dark",
    bg: "#171310",
    surface: "#1d1815",
    accent: "#ea580c",
  },
  {
    id: "ghost",
    name: "Ghost",
    tagline: "Light flagship",
    bg: "#ffffff",
    surface: "#f4f4f5",
    accent: "#141414",
  },
  {
    id: "cobalt",
    name: "Cobalt",
    tagline: "Deep blue dark",
    bg: "#0a1628",
    surface: "#13203a",
    accent: "#38bdf8",
  },
  {
    id: "sandstorm",
    name: "Sandstorm",
    tagline: "Warm paper light",
    bg: "#f5efe6",
    surface: "#faf6ef",
    accent: "#ea580c",
  },
  {
    id: "abyss-teal",
    name: "Abyss Teal",
    tagline: "Deep green dark",
    bg: "#06201d",
    surface: "#0a2a26",
    accent: "#2dd4bf",
  },
  {
    id: "porcelain",
    name: "Porcelain",
    tagline: "Crisp light",
    bg: "#f8fafc",
    surface: "#ffffff",
    accent: "#1d4ed8",
  },
  {
    id: "arctic",
    name: "Arctic",
    tagline: "Icy pale light",
    bg: "#eef4ff",
    surface: "#ffffff",
    accent: "#0284c7",
  },
  {
    id: "onyx",
    name: "Onyx",
    tagline: "Pure black",
    bg: "#000000",
    surface: "#0a0a0a",
    accent: "#22d3ee",
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    tagline: "High contrast",
    bg: "#ffffff",
    surface: "#ffffff",
    accent: "#000000",
  },
];

export const DEFAULT_THEME: ThemeId = "abyssal";