/**
 * Border radius scale
 */

export const borderRadius = {
  none: "0",
  sm: "4px",
  DEFAULT: "8px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  "2xl": "24px",
  full: "9999px",
} as const;

export type RadiusToken = keyof typeof borderRadius;
