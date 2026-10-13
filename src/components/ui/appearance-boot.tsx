"use client";

import { useEffect } from "react";
import { useSettings } from "@/hooks/useApi";
import {
  DEFAULT_RADIUS_PROFILE,
  normalizeRadiusProfileId,
} from "@/lib/radius-profiles";

/**
 * Applies the workspace appearance settings to <html> as data-* attributes so
 * they take effect on every route, not only while the Settings page is open.
 * The corner-radius value is the profile id (see radius-profiles.ts); density
 * and accent ride along on the same fetch. SSR paints the Rounded default
 * straight from :root, so this only has to set the attribute once the shared
 * SWR settings cache resolves — and it re-applies whenever any route saves.
 */
export function AppearanceBoot() {
  const { data } = useSettings();
  const appearance = data?.settings;

  useEffect(() => {
    const el = document.documentElement;
    el.dataset.radius = normalizeRadiusProfileId(
      appearance?.["appearance.radius"] ?? DEFAULT_RADIUS_PROFILE
    );
    el.dataset.density = appearance?.["appearance.density"] || "comfortable";
    el.dataset.accent = appearance?.["appearance.accent"] || "none";
  }, [appearance]);

  return null;
}
