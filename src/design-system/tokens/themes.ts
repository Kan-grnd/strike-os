/**
 * Strike OS — Theme Definitions
 *
 * Six real theme packs (see @/lib/theme-packs for the single source of
 * truth of ids/names/swatches): clean (minimal light monochrome), calm
 * (soft low-contrast light), bold (high-contrast black & white), graphite
 * (dark neutral monochrome, default), void (pure black monochrome) and
 * signal (dark slate/vivid orange). Applied by next-themes as class names on
 * <html>; values are the HSL token blocks from globals.css. State colors are
 * IMMUTABLE across packs and match the signal layer's stateHex: failed red
 * (0 91% 71%), blocked amber (43 96% 56%), ok emerald (158 64% 52%),
 * approval violet (255 92% 76%).
 */

export type ThemeId =
  | "clean"
  | "calm"
  | "bold"
  | "graphite"
  | "void"
  | "signal";

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
  /** Minimal light monochrome. Flagship light. */
  clean: {
    background: "0 0% 100%",
    surface: "0 0% 98%",
    card: "0 0% 98.0392156862745%",
    elevated: "0 0% 94%",
    popover: "0 0% 100%",
    border: "0 0% 88%",
    borderStrong: "0 0% 72%",
    foreground: "0 0% 12%",
    muted: "0 0% 96%",
    mutedForeground: "0 0% 42%",
    faint: "0 0% 58%",
    disabled: "0 0% 72%",
    primary: "0 0% 9.019607843137255%",
    primaryForeground: "0 0% 100%",
    accent: "0 0% 92%",
    accentForeground: "0 0% 12%",
    secondary: "0 0% 89.80392156862746%",
    secondaryForeground: "0 0% 20%",
    success: "158 64% 52%",
    successForeground: "0 0% 10%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 10%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 10%",
    info: "210 80% 42%",
    infoForeground: "0 0% 100%",
    input: "0 0% 90%",
    ring: "0 0% 9%",
  },
  /** Soft low-contrast light. Muted warm surfaces. */
  calm: {
    background: "45 16.666666666666703% 95.29411764705881%",
    surface: "45 14% 92%",
    card: "50 15% 92.15686274509804%",
    elevated: "45 12% 87%",
    popover: "45 14% 94%",
    border: "45 12% 80%",
    borderStrong: "45 8% 64%",
    foreground: "45 8% 18%",
    muted: "45 13% 91%",
    mutedForeground: "45 6% 45%",
    faint: "45 6% 60%",
    disabled: "45 4% 70%",
    primary: "60 3.496503496503504% 28.03921568627451%",
    primaryForeground: "0 0% 100%",
    accent: "45 12% 87%",
    accentForeground: "45 8% 18%",
    secondary: "46.66666666666671 12.328767123287673% 85.68627450980392%",
    secondaryForeground: "45 6% 28%",
    success: "158 64% 52%",
    successForeground: "0 0% 10%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 10%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 10%",
    info: "45 40% 40%",
    infoForeground: "0 0% 100%",
    input: "45 12% 90%",
    ring: "60 3.5% 28%",
  },
  /** High-contrast black & white. Strong borders, pure extremes. */
  bold: {
    background: "0 0% 100%",
    surface: "0 0% 100%",
    card: "0 0% 100%",
    elevated: "0 0% 92%",
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
    secondary: "0 0% 87.05882352941177%",
    secondaryForeground: "0 0% 0%",
    success: "158 64% 52%",
    successForeground: "0 0% 10%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 10%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 10%",
    info: "0 0% 0%",
    infoForeground: "0 0% 100%",
    input: "0 0% 90%",
    ring: "0 0% 0%",
  },
  /** Dark neutral monochrome. Default. */
  graphite: {
    background: "0 0% 9.019607843137255%",
    surface: "0 0% 12%",
    card: "0 0% 12.941176470588237%",
    elevated: "0 0% 20%",
    popover: "0 0% 15%",
    border: "0 0% 26%",
    borderStrong: "0 0% 38%",
    foreground: "0 0% 90%",
    muted: "0 0% 13%",
    mutedForeground: "0 0% 64%",
    faint: "0 0% 42%",
    disabled: "0 0% 28%",
    primary: "0 0% 90.98039215686275%",
    primaryForeground: "0 0% 7%",
    accent: "0 0% 17%",
    accentForeground: "0 0% 90%",
    secondary: "0 0% 18.03921568627451%",
    secondaryForeground: "0 0% 90%",
    success: "158 64% 52%",
    successForeground: "0 0% 6%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 6%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 6%",
    info: "210 70% 60%",
    infoForeground: "0 0% 8%",
    input: "0 0% 18%",
    ring: "0 0% 91%",
  },
  /** Pure black monochrome. */
  void: {
    background: "0 0% 0%",
    surface: "0 0% 5%",
    card: "0 0% 7.8431372549019605%",
    elevated: "0 0% 13%",
    popover: "0 0% 9%",
    border: "0 0% 21%",
    borderStrong: "0 0% 34%",
    foreground: "0 0% 95%",
    muted: "0 0% 6%",
    mutedForeground: "0 0% 60%",
    faint: "0 0% 42%",
    disabled: "0 0% 28%",
    primary: "0 0% 94.90196078431372%",
    primaryForeground: "0 0% 4%",
    accent: "0 0% 13%",
    accentForeground: "0 0% 95%",
    secondary: "0 0% 14.901960784313726%",
    secondaryForeground: "0 0% 95%",
    success: "158 64% 52%",
    successForeground: "0 0% 6%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 6%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 6%",
    info: "210 60% 62%",
    infoForeground: "0 0% 6%",
    input: "0 0% 12%",
    ring: "0 0% 95%",
  },
  /** Dark slate with vivid orange accent. The one color pack. */
  signal: {
    background: "240 9.090909090909092% 6.470588235294117%",
    surface: "240 8% 10%",
    card: "240 8.474576271186438% 11.568627450980392%",
    elevated: "240 7% 18%",
    popover: "240 8% 13%",
    border: "240 6% 24%",
    borderStrong: "240 5% 36%",
    foreground: "220 20% 92%",
    muted: "240 7% 9%",
    mutedForeground: "220 8% 62%",
    faint: "220 6% 40%",
    disabled: "230 5% 28%",
    primary: "24.581497797356832 94.97907949790795% 53.13725490196079%",
    primaryForeground: "24 50% 8%",
    accent: "240 7% 17%",
    accentForeground: "220 20% 92%",
    secondary: "240 7.86516853932584% 17.45098039215686%",
    secondaryForeground: "220 20% 92%",
    success: "158 64% 52%",
    successForeground: "0 0% 6%",
    warning: "43 96% 56%",
    warningForeground: "0 0% 6%",
    destructive: "0 91% 71%",
    destructiveForeground: "0 0% 6%",
    info: "215 60% 62%",
    infoForeground: "0 0% 6%",
    input: "240 7% 10%",
    ring: "24.6 95% 53.14%",
  },
};

export const defaultTheme: ThemeId = "graphite";

export const themeLabels: Record<ThemeId, { name: string; description: string }> = {
  clean: {
    name: "Clean",
    description: "Minimal light monochrome",
  },
  calm: {
    name: "Calm",
    description: "Soft low-contrast light",
  },
  bold: {
    name: "Bold",
    description: "High-contrast black & white",
  },
  graphite: {
    name: "Graphite",
    description: "Dark neutral monochrome — default",
  },
  void: {
    name: "Void",
    description: "Pure black monochrome",
  },
  signal: {
    name: "Signal",
    description: "Dark slate — vivid orange accent",
  },
};