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
    tagline: "Grey near-black · default",
    bg: "#171717",
    surface: "#262626",
    accent: "#e6e6e6",
  },
  {
    id: "ember",
    name: "Ember",
    tagline: "Warm charcoal dark",
    bg: "#1c1917",
    surface: "#292524",
    accent: "#f97415",
  },
  {
    id: "ghost",
    name: "Ghost",
    tagline: "Light flagship",
    bg: "#ffffff",
    surface: "#f4f4f5",
    accent: "#1a1a1a",
  },
  {
    id: "cobalt",
    name: "Cobalt",
    tagline: "Deep slate-dark",
    bg: "#0f172a",
    surface: "#1e293b",
    accent: "#38bdf8",
  },
  {
    id: "sandstorm",
    name: "Sandstorm",
    tagline: "Warm paper light",
    bg: "#fdfbf7",
    surface: "#f8f4ee",
    accent: "#b45309",
  },
  {
    id: "abyss-teal",
    name: "Abyss Teal",
    tagline: "Earthy green dark",
    bg: "#3a3529",
    surface: "#413c33",
    accent: "#899f7a",
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
    bg: "#f2f4f8",
    surface: "#ffffff",
    accent: "#1f79ad",
  },
  {
    id: "onyx",
    name: "Onyx",
    tagline: "Pure black",
    bg: "#000000",
    surface: "#0a0a0a",
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
];

export const DEFAULT_THEME: ThemeId = "abyssal";