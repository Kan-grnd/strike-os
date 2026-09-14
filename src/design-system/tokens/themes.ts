/**
 * Strike OS — Theme Definitions
 *
 * Ten real theme packs (see @/lib/theme-packs for the single source of truth
 * of ids/names/swatches): abyssal (refined near-black dark, default), ember
 * (warm ember dark), ghost (light flagship), cobalt (deep blue dark/sky),
 * sandstorm (warm paper light/burnt-orange), abyss-teal (deep green dark/teal),
 * porcelain (crisp light/cobalt), arctic (icy pale blue/deep-sky), onyx (pure
 * black/cyan), high-contrast (pure white/black, strong borders). Applied by
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
  /** Refined near-black cool dark. Default. */
  abyssal: {
    background: "240 5% 4%",
    surface: "240 4% 6%",
    card: "240 4% 7%",
    elevated: "240 4% 10%",
    popover: "240 4% 9%",
    border: "240 4% 14%",
    borderStrong: "240 4% 22%",
    foreground: "0 0% 96%",
    muted: "240 4% 12%",
    mutedForeground: "0 0% 63%",
    faint: "0 0% 40%",
    disabled: "0 0% 26%",
    primary: "0 0% 96%",
    primaryForeground: "0 0% 4%",
    accent: "240 4% 14%",
    accentForeground: "0 0% 96%",
    secondary: "240 4% 14%",
    secondaryForeground: "0 0% 96%",
    success: "158 64% 52%",
    successForeground: "0 0% 6%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 6%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 6%",
    info: "205 82% 55%",
    infoForeground: "0 0% 8%",
    input: "240 3% 9%",
    ring: "0 0% 96%",
  },
  /** Warm ember dark — burnt-orange accent, distinct from blocked amber. */
  ember: {
    background: "22 22% 6%",
    surface: "22 18% 8%",
    card: "22 18% 9%",
    elevated: "22 16% 12%",
    popover: "22 18% 11%",
    border: "22 16% 14%",
    borderStrong: "22 14% 22%",
    foreground: "24 28% 96%",
    muted: "22 14% 12%",
    mutedForeground: "24 12% 62%",
    faint: "25 10% 40%",
    disabled: "25 10% 26%",
    primary: "21 90% 48%",
    primaryForeground: "0 0% 100%",
    accent: "22 16% 15%",
    accentForeground: "24 28% 96%",
    secondary: "22 16% 14%",
    secondaryForeground: "24 28% 96%",
    success: "158 64% 52%",
    successForeground: "0 0% 6%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 6%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 6%",
    info: "197 85% 55%",
    infoForeground: "0 0% 8%",
    input: "22 14% 10%",
    ring: "21 90% 48%",
  },
  /** Light flagship — clean, paper-like, professional. */
  ghost: {
    background: "0 0% 100%",
    surface: "0 0% 98%",
    card: "0 0% 100%",
    elevated: "0 0% 95%",
    popover: "0 0% 100%",
    border: "0 0% 90%",
    borderStrong: "0 0% 78%",
    foreground: "0 0% 8%",
    muted: "0 0% 96%",
    mutedForeground: "0 0% 42%",
    faint: "0 0% 60%",
    disabled: "0 0% 72%",
    primary: "0 0% 8%",
    primaryForeground: "0 0% 100%",
    accent: "0 0% 95%",
    accentForeground: "0 0% 12%",
    secondary: "0 0% 96%",
    secondaryForeground: "0 0% 12%",
    success: "158 64% 52%",
    successForeground: "0 0% 10%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 10%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 10%",
    info: "210 80% 45%",
    infoForeground: "0 0% 100%",
    input: "0 0% 96%",
    ring: "0 0% 8%",
  },
  /** Deep blue dark — sky accent. */
  cobalt: {
    background: "216 60% 10%",
    surface: "215 50% 12%",
    card: "215 55% 12%",
    elevated: "215 42% 17%",
    popover: "215 55% 14%",
    border: "215 42% 18%",
    borderStrong: "215 40% 28%",
    foreground: "204 30% 96%",
    muted: "215 38% 14%",
    mutedForeground: "205 20% 64%",
    faint: "210 15% 40%",
    disabled: "210 15% 26%",
    primary: "199 84% 60%",
    primaryForeground: "215 50% 9%",
    accent: "215 40% 17%",
    accentForeground: "204 30% 96%",
    secondary: "215 40% 16%",
    secondaryForeground: "204 30% 96%",
    success: "158 64% 52%",
    successForeground: "0 0% 6%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 6%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 6%",
    info: "205 82% 55%",
    infoForeground: "0 0% 8%",
    input: "215 45% 12%",
    ring: "199 84% 60%",
  },
  /** Warm paper light — burnt-orange accent. */
  sandstorm: {
    background: "36 43% 93%",
    surface: "36 45% 95%",
    card: "36 50% 96%",
    elevated: "34 30% 86%",
    popover: "36 45% 96%",
    border: "34 20% 80%",
    borderStrong: "30 15% 62%",
    foreground: "25 20% 16%",
    muted: "34 24% 87%",
    mutedForeground: "28 12% 42%",
    faint: "28 10% 58%",
    disabled: "30 8% 72%",
    primary: "21 90% 48%",
    primaryForeground: "0 0% 100%",
    accent: "34 26% 84%",
    accentForeground: "26 18% 20%",
    secondary: "34 25% 85%",
    secondaryForeground: "26 18% 20%",
    success: "158 64% 52%",
    successForeground: "0 0% 10%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 10%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 10%",
    info: "21 80% 45%",
    infoForeground: "0 0% 100%",
    input: "36 40% 90%",
    ring: "21 90% 48%",
  },
  /** Deep green dark — teal accent. */
  "abyss-teal": {
    background: "173 68% 7%",
    surface: "172 58% 9%",
    card: "172 60% 9%",
    elevated: "172 42% 14%",
    popover: "172 55% 11%",
    border: "172 38% 16%",
    borderStrong: "172 36% 26%",
    foreground: "172 40% 94%",
    muted: "172 35% 12%",
    mutedForeground: "174 25% 64%",
    faint: "174 18% 40%",
    disabled: "174 18% 26%",
    primary: "172 66% 50%",
    primaryForeground: "173 60% 8%",
    accent: "172 42% 15%",
    accentForeground: "172 40% 94%",
    secondary: "172 40% 14%",
    secondaryForeground: "172 40% 94%",
    success: "158 64% 52%",
    successForeground: "0 0% 6%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 6%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 6%",
    info: "197 85% 55%",
    infoForeground: "0 0% 8%",
    input: "172 40% 10%",
    ring: "172 66% 50%",
  },
  /** Crisp light — cobalt accent. */
  porcelain: {
    background: "213 41% 98%",
    surface: "0 0% 100%",
    card: "0 0% 100%",
    elevated: "220 15% 92%",
    popover: "0 0% 100%",
    border: "220 20% 88%",
    borderStrong: "222 15% 68%",
    foreground: "222 30% 14%",
    muted: "215 28% 95%",
    mutedForeground: "220 10% 44%",
    faint: "220 8% 60%",
    disabled: "220 6% 74%",
    primary: "224 76% 48%",
    primaryForeground: "0 0% 100%",
    accent: "215 30% 93%",
    accentForeground: "222 25% 20%",
    secondary: "215 30% 94%",
    secondaryForeground: "222 25% 20%",
    success: "158 64% 52%",
    successForeground: "0 0% 10%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 10%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 10%",
    info: "224 80% 50%",
    infoForeground: "0 0% 100%",
    input: "220 25% 92%",
    ring: "224 76% 48%",
  },
  /** Icy pale blue — deep-sky accent. */
  arctic: {
    background: "218 100% 97%",
    surface: "0 0% 100%",
    card: "0 0% 100%",
    elevated: "216 45% 91%",
    popover: "0 0% 100%",
    border: "218 40% 85%",
    borderStrong: "217 30% 65%",
    foreground: "220 45% 16%",
    muted: "216 55% 94%",
    mutedForeground: "217 20% 46%",
    faint: "217 12% 60%",
    disabled: "217 8% 74%",
    primary: "200 98% 39%",
    primaryForeground: "0 0% 100%",
    accent: "216 60% 92%",
    accentForeground: "218 40% 22%",
    secondary: "216 60% 93%",
    secondaryForeground: "218 40% 22%",
    success: "158 64% 52%",
    successForeground: "0 0% 10%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 10%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 10%",
    info: "200 98% 40%",
    infoForeground: "0 0% 100%",
    input: "218 50% 90%",
    ring: "200 98% 39%",
  },
  /** Pure black — cyan accent. */
  onyx: {
    background: "0 0% 0%",
    surface: "190 20% 3%",
    card: "190 20% 4%",
    elevated: "190 20% 9%",
    popover: "190 20% 6%",
    border: "190 16% 12%",
    borderStrong: "190 14% 22%",
    foreground: "186 40% 95%",
    muted: "190 16% 8%",
    mutedForeground: "187 20% 62%",
    faint: "187 12% 40%",
    disabled: "187 12% 26%",
    primary: "188 86% 53%",
    primaryForeground: "190 60% 6%",
    accent: "190 20% 11%",
    accentForeground: "186 40% 95%",
    secondary: "190 18% 10%",
    secondaryForeground: "186 40% 95%",
    success: "158 64% 52%",
    successForeground: "0 0% 6%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 6%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 6%",
    info: "197 85% 55%",
    infoForeground: "0 0% 8%",
    input: "190 18% 5%",
    ring: "188 86% 53%",
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
    description: "Refined near-black dark — precision default",
  },
  ember: {
    name: "Ember",
    description: "Warm ember dark — burnt-orange accent",
  },
  ghost: {
    name: "Ghost",
    description: "Light flagship — clean and professional",
  },
  cobalt: {
    name: "Cobalt",
    description: "Deep blue dark — sky accent",
  },
  sandstorm: {
    name: "Sandstorm",
    description: "Warm paper light — burnt-orange accent",
  },
  "abyss-teal": {
    name: "Abyss Teal",
    description: "Deep green dark — teal accent",
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