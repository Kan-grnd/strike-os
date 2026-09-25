/**
 * Strike OS — Theme Definitions
 *
 * Ten real theme packs (see @/lib/theme-packs for the single source of truth
 * of ids/names/swatches): abyssal (refined near-black neutral dark, default),
 * ember (warm charcoal dark/orange), ghost (light flagship), cobalt (deep
 * slate-blue dark/sky), sandstorm (warm paper light/burnt-orange), abyss-teal
 * (earthy green dark/sage), porcelain (crisp light/cobalt), arctic (icy pale
 * blue/deep-sky), onyx (pure black/cyan), high-contrast (pure white/black,
 * strong borders). Applied by
 * next-themes as class names on <html>; values are the HSL token blocks from
 * globals.css. State colors are IMMUTABLE across packs and match the signal
 * layer's stateHex: failed red (0 91% 71%), blocked amber (43 96% 56%), ok
 * emerald (158 64% 52%), approval violet (255 92% 76%).
 */

export type ThemeId =
  | "abyssal"
  | "ember"
  | "ghost"
  | "cobalt"
  | "sandstorm"
  | "abyss-teal"
  | "porcelain"
  | "arctic"
  | "onyx"
  | "high-contrast";

export interface ThemeTokens {
  /** Base surface */
  background: string;
  /** Slightly elevated surface */
  surface: string;
  /** Cards, panels, drawers */
  card: string;
  /** Hover, active state */
  elevated: string;
  /** Tooltip, menu, popover surface */
  popover: string;
  /** All borders */
  border: string;
  /** Strong borders, dividers */
  borderStrong: string;
  /** Primary text */
  foreground: string;
  /** Secondary text */
  muted: string;
  /** Muted foreground text */
  mutedForeground: string;
  /** Tertiary text (less important) */
  faint: string;
  /** Disabled state */
  disabled: string;
  /** Accent color (single primary) */
  primary: string;
  /** Accent foreground (text on accent) */
  primaryForeground: string;
  /** Muted accent for backgrounds */
  accent: string;
  /** Accent foreground */
  accentForeground: string;
  /** Secondary action background */
  secondary: string;
  /** Secondary action foreground */
  secondaryForeground: string;
  /** Success state */
  success: string;
  /** Success foreground */
  successForeground: string;
  /** Warning state */
  warning: string;
  /** Warning foreground */
  warningForeground: string;
  /** Destructive state */
  destructive: string;
  /** Destructive foreground */
  destructiveForeground: string;
  /** Info state */
  info: string;
  /** Info foreground */
  infoForeground: string;
  /** Input background */
  input: string;
  /** Focus ring */
  ring: string;
}

export const themes: Record<ThemeId, ThemeTokens> = {
  /** Refined near-black neutral dark. Default. */
  abyssal: {
    background: "0 0% 9%",
    surface: "0 0% 12%",
    card: "0 0% 16%",
    elevated: "0 0% 21%",
    popover: "0 0% 18%",
    border: "0 0% 28%",
    borderStrong: "0 0% 40%",
    foreground: "0 0% 90%",
    muted: "0 0% 13%",
    mutedForeground: "0 0% 64%",
    faint: "0 0% 40%",
    disabled: "0 0% 30%",
    primary: "0 0% 90%",
    primaryForeground: "0 0% 6%",
    accent: "0 0% 17%",
    accentForeground: "0 0% 90%",
    secondary: "0 0% 17%",
    secondaryForeground: "0 0% 90%",
    success: "158 64% 52%",
    successForeground: "0 0% 6%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 6%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 6%",
    info: "205 82% 55%",
    infoForeground: "0 0% 8%",
    input: "0 0% 21%",
    ring: "0 0% 90%",
  },
  /** Warm charcoal dark — orange accent, distinct from blocked amber. */
  ember: {
    background: "24 10% 10%",
    surface: "30 8% 14%",
    card: "12 6% 17%",
    elevated: "30 6% 22%",
    popover: "12 6% 19%",
    border: "30 6% 27%",
    borderStrong: "30 5% 38%",
    foreground: "60 5% 96%",
    muted: "30 10% 12%",
    mutedForeground: "24 5% 64%",
    faint: "24 5% 40%",
    disabled: "24 5% 28%",
    primary: "25 95% 53%",
    primaryForeground: "24 12% 9%",
    accent: "198 46% 24%",
    accentForeground: "20 6% 90%",
    secondary: "33 5% 33%",
    secondaryForeground: "60 5% 96%",
    success: "158 64% 52%",
    successForeground: "0 0% 6%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 6%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 6%",
    info: "197 85% 55%",
    infoForeground: "0 0% 8%",
    input: "30 8% 19%",
    ring: "25 95% 53%",
  },
  /** Light flagship — clean, paper-like, professional. */
  ghost: {
    background: "0 0% 100%",
    surface: "0 0% 98.5%",
    card: "0 0% 97.5%",
    elevated: "0 0% 94%",
    popover: "0 0% 100%",
    border: "220 14% 87%",
    borderStrong: "220 9% 74%",
    foreground: "0 0% 20%",
    muted: "0 0% 97%",
    mutedForeground: "220 9% 42%",
    faint: "0 0% 58%",
    disabled: "0 0% 72%",
    primary: "0 0% 10%",
    primaryForeground: "0 0% 100%",
    accent: "0 0% 92%",
    accentForeground: "0 0% 20%",
    secondary: "220 14% 94%",
    secondaryForeground: "0 0% 33%",
    success: "158 64% 52%",
    successForeground: "0 0% 10%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 10%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 10%",
    info: "210 80% 45%",
    infoForeground: "0 0% 100%",
    input: "220 13% 84%",
    ring: "220 9% 20%",
  },
  /** Deep slate-blue dark — sky accent. */
  cobalt: {
    background: "222 47% 11%",
    surface: "217 36% 15%",
    card: "217 33% 19%",
    elevated: "217 28% 24%",
    popover: "217 33% 21%",
    border: "215 14% 37%",
    borderStrong: "215 12% 48%",
    foreground: "214 32% 91%",
    muted: "217 41% 15%",
    mutedForeground: "218 11% 65%",
    faint: "217 10% 42%",
    disabled: "217 10% 30%",
    primary: "199 89% 60%",
    primaryForeground: "215 50% 9%",
    accent: "217 19% 29%",
    accentForeground: "216 12% 84%",
    secondary: "216 23% 25%",
    secondaryForeground: "216 12% 84%",
    success: "158 64% 52%",
    successForeground: "0 0% 6%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 6%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 6%",
    info: "205 82% 55%",
    infoForeground: "0 0% 8%",
    input: "217 33% 19%",
    ring: "199 89% 60%",
  },
  /** Warm paper light — burnt-orange accent. */
  sandstorm: {
    background: "40 47% 97%",
    surface: "39 40% 94%",
    card: "36 45% 93%",
    elevated: "38 35% 86%",
    popover: "36 45% 96%",
    border: "36 36% 76%",
    borderStrong: "36 25% 64%",
    foreground: "21 18% 25%",
    muted: "39 45% 90%",
    mutedForeground: "25 6% 38%",
    faint: "30 6% 58%",
    disabled: "30 5% 72%",
    primary: "26 90% 37%",
    primaryForeground: "0 0% 100%",
    accent: "36 35% 85%",
    accentForeground: "33 5% 32%",
    secondary: "43 43% 80%",
    secondaryForeground: "33 5% 32%",
    success: "158 64% 52%",
    successForeground: "0 0% 10%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 10%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 10%",
    info: "21 80% 45%",
    infoForeground: "0 0% 100%",
    input: "35 30% 90%",
    ring: "26 90% 37%",
  },
  /** Earthy green dark — sage accent. */
  "abyss-teal": {
    background: "42 17% 19%",
    surface: "41 14% 22%",
    card: "39 12% 25%",
    elevated: "39 11% 30%",
    popover: "39 12% 27%",
    border: "40 13% 34%",
    borderStrong: "40 10% 46%",
    foreground: "38 41% 88%",
    muted: "39 13% 27%",
    mutedForeground: "33 9% 71%",
    faint: "39 8% 40%",
    disabled: "39 7% 28%",
    primary: "95 16% 55%",
    primaryForeground: "27 12% 15%",
    accent: "44 27% 52%",
    accentForeground: "27 12% 15%",
    secondary: "40 13% 33%",
    secondaryForeground: "38 41% 88%",
    success: "158 64% 52%",
    successForeground: "0 0% 6%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 6%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 6%",
    info: "44 22% 42%",
    infoForeground: "0 0% 100%",
    input: "40 10% 24%",
    ring: "95 16% 55%",
  },
  /** Crisp light — cobalt accent. */
  porcelain: {
    background: "210 40% 98%",
    surface: "210 30% 96%",
    card: "210 24% 95%",
    elevated: "215 18% 91%",
    popover: "0 0% 100%",
    border: "216 12% 80%",
    borderStrong: "218 10% 62%",
    foreground: "217 33% 17%",
    muted: "220 14% 95%",
    mutedForeground: "220 9% 44%",
    faint: "220 8% 58%",
    disabled: "220 6% 72%",
    primary: "224 76% 48%",
    primaryForeground: "0 0% 100%",
    accent: "223 30% 93%",
    accentForeground: "217 19% 27%",
    secondary: "220 13% 91%",
    secondaryForeground: "217 19% 27%",
    success: "158 64% 52%",
    successForeground: "0 0% 10%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 10%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 10%",
    info: "224 80% 50%",
    infoForeground: "0 0% 100%",
    input: "220 13% 88%",
    ring: "224 76% 48%",
  },
  /** Icy pale blue — deep-sky accent. */
  arctic: {
    background: "218 30% 96%",
    surface: "0 0% 100%",
    card: "0 0% 97.5%",
    elevated: "216 18% 90%",
    popover: "0 0% 100%",
    border: "218 20% 81%",
    borderStrong: "217 15% 62%",
    foreground: "220 45% 16%",
    muted: "216 18% 93%",
    mutedForeground: "217 12% 43%",
    faint: "217 10% 58%",
    disabled: "217 8% 72%",
    primary: "202 70% 40%",
    primaryForeground: "0 0% 100%",
    accent: "216 22% 89%",
    accentForeground: "218 28% 24%",
    secondary: "216 18% 92%",
    secondaryForeground: "218 28% 24%",
    success: "158 64% 52%",
    successForeground: "0 0% 10%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 10%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 10%",
    info: "202 65% 42%",
    infoForeground: "0 0% 100%",
    input: "218 22% 87%",
    ring: "202 70% 40%",
  },
  /** Pure black — cyan accent. */
  onyx: {
    background: "0 0% 0%",
    surface: "190 12% 5%",
    card: "190 13% 8%",
    elevated: "190 10% 13%",
    popover: "190 13% 11%",
    border: "190 12% 21%",
    borderStrong: "190 6% 30%",
    foreground: "186 40% 95%",
    muted: "190 10% 9%",
    mutedForeground: "187 12% 62%",
    faint: "187 8% 40%",
    disabled: "187 8% 28%",
    primary: "188 60% 50%",
    primaryForeground: "190 60% 6%",
    accent: "190 12% 13%",
    accentForeground: "186 40% 95%",
    secondary: "190 10% 14%",
    secondaryForeground: "186 40% 95%",
    success: "158 64% 52%",
    successForeground: "0 0% 6%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 6%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 6%",
    info: "187 55% 55%",
    infoForeground: "0 0% 8%",
    input: "190 10% 12%",
    ring: "188 60% 50%",
  },
  /** Pure white light — black, strong borders. */
  "high-contrast": {
    background: "0 0% 100%",
    surface: "0 0% 96%",
    card: "0 0% 100%",
    elevated: "0 0% 90%",
    popover: "0 0% 100%",
    border: "0 0% 40%",
    borderStrong: "0 0% 0%",
    foreground: "0 0% 0%",
    muted: "0 0% 93%",
    mutedForeground: "0 0% 25%",
    faint: "0 0% 40%",
    disabled: "0 0% 60%",
    primary: "0 0% 0%",
    primaryForeground: "0 0% 100%",
    accent: "0 0% 88%",
    accentForeground: "0 0% 0%",
    secondary: "0 0% 93%",
    secondaryForeground: "0 0% 0%",
    success: "158 64% 52%",
    successForeground: "0 0% 10%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 10%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 10%",
    info: "0 0% 0%",
    infoForeground: "0 0% 100%",
    input: "0 0% 85%",
    ring: "0 0% 0%",
  },
};

export const defaultTheme: ThemeId = "abyssal";

export const themeLabels: Record<ThemeId, { name: string; description: string }> = {
  abyssal: {
    name: "Abyssal",
    description: "Refined near-black neutral — precision default",
  },
  ember: {
    name: "Ember",
    description: "Warm charcoal dark — orange accent",
  },
  ghost: {
    name: "Ghost",
    description: "Light flagship — clean and professional",
  },
  cobalt: {
    name: "Cobalt",
    description: "Deep slate-dark — sky accent",
  },
  sandstorm: {
    name: "Sandstorm",
    description: "Warm paper light — burnt-orange accent",
  },
  "abyss-teal": {
    name: "Abyss Teal",
    description: "Earthy green dark — sage accent",
  },
  porcelain: {
    name: "Porcelain",
    description: "Crisp light — cobalt accent",
  },
  arctic: {
    name: "Arctic",
    description: "Icy pale blue light — deep-sky accent",
  },
  onyx: {
    name: "Onyx",
    description: "Pure black dark — cyan accent",
  },
  "high-contrast": {
    name: "High Contrast",
    description: "Pure white light — black, strong borders",
  },
};