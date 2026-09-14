/**
 * Typography scale and hierarchy.
 * The interface should still be understandable in grayscale,
 * so hierarchy comes from size, weight, spacing — not color.
 */

export const fontFamily = {
  sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: '"JetBrains Mono", "SF Mono", Menlo, Monaco, Consolas, monospace',
} as const;

export const fontSize = {
  micro: ["11px", { lineHeight: "16px", letterSpacing: "0.01em" }],
  xs: ["12px", { lineHeight: "16px", letterSpacing: "0.005em" }],
  sm: ["13px", { lineHeight: "20px" }],
  base: ["14px", { lineHeight: "22px" }],
  lg: ["16px", { lineHeight: "24px" }],
  xl: ["20px", { lineHeight: "28px", letterSpacing: "-0.01em" }],
  "2xl": ["24px", { lineHeight: "32px", letterSpacing: "-0.015em" }],
  "3xl": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em" }],
  "4xl": ["40px", { lineHeight: "48px", letterSpacing: "-0.025em" }],
} as const;

export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
} as const;

/** Typography hierarchy and usage rules */
export const typographyScale = {
  display: {
    fontSize: "3xl",
    fontWeight: "extrabold",
    usage: "Hero titles, major landing sections",
  },
  pageTitle: {
    fontSize: "2xl",
    fontWeight: "bold",
    usage: "Page headings (h1)",
  },
  sectionTitle: {
    fontSize: "xl",
    fontWeight: "semibold",
    usage: "Major section headings (h2)",
  },
  cardTitle: {
    fontSize: "lg",
    fontWeight: "semibold",
    usage: "Card titles, subsection headings (h3)",
  },
  body: {
    fontSize: "base",
    fontWeight: "normal",
    usage: "Main body text, descriptions",
  },
  secondary: {
    fontSize: "sm",
    fontWeight: "normal",
    usage: "Secondary text, supporting info",
  },
  metadata: {
    fontSize: "xs",
    fontWeight: "medium",
    usage: "Timestamps, counts, small labels",
  },
  microLabel: {
    fontSize: "micro",
    fontWeight: "semibold",
    usage: "Badges, tiny labels, uppercase labels",
  },
} as const;
