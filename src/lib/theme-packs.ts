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
    id: "porcelain",
    name: "Porcelain",
    tagline: "Crisp light",
    bg: "#f8fafc",
    surface: "#eff2f5",
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
];

export const DEFAULT_THEME: ThemeId = "abyssal";