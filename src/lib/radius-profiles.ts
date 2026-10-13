/**
 * Strike OS — Corner-radius profiles. Single source of truth for the profile
 * list, used by Settings → Appearance and by the app-wide applier. The chosen
 * profile sets `data-radius` on <html>; the `[data-radius="…"]` blocks in
 * styles/globals.css carry the actual `--radius-*` values that every
 * `rounded-*` utility reads. Keep the `xl` numbers here in sync with those
 * blocks (same convention as the theme-pack swatches).
 */
export const RADIUS_PROFILE_IDS = ["sharp", "soft", "rounded", "pill"] as const;

export type RadiusProfileId = (typeof RADIUS_PROFILE_IDS)[number];

export interface RadiusProfile {
  id: RadiusProfileId;
  label: string;
  tagline: string;
  /** Primary corner size (--radius-xl), in px. Drives the preview swatch. */
  xl: number;
}

export const RADIUS_PROFILES: RadiusProfile[] = [
  { id: "sharp", label: "Sharp", tagline: "Square corners, engineered", xl: 0 },
  { id: "soft", label: "Soft", tagline: "Subtle rounding", xl: 8 },
  { id: "rounded", label: "Rounded", tagline: "Balanced, the current look", xl: 12 },
  { id: "pill", label: "Pill", tagline: "Fully rounded corners", xl: 9999 },
];

export const DEFAULT_RADIUS_PROFILE: RadiusProfileId = "rounded";

/** Narrowing guard for values that arrive from storage or the settings API. */
export function isRadiusProfileId(value: unknown): value is RadiusProfileId {
  return (
    typeof value === "string" &&
    (RADIUS_PROFILE_IDS as readonly string[]).includes(value)
  );
}

/**
 * Coerces any stored or legacy value to a live profile id. Earlier builds
 * stored a raw length ("0", "0.5rem", "1rem") and never defined `--radius`,
 * so nothing rendered; map those onto the nearest profile so an upgrade
 * always lands on a valid profile instead of leaving the radius unset.
 */
export function normalizeRadiusProfileId(value: unknown): RadiusProfileId {
  if (isRadiusProfileId(value)) return value;
  switch (value) {
    case "0":
    case "0px":
    case "0rem":
      return "sharp";
    case "0.5rem":
    case "8px":
      return "soft";
    case "1rem":
    case "16px":
      return "rounded";
    default:
      return DEFAULT_RADIUS_PROFILE;
  }
}
