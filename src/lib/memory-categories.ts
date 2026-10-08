/**
 * Memory categories are free-form, so the same slug can be typed many ways
 * ("API Keys", "api keys", "API-Keys"). Normalizing in one place — on the
 * client before sending and on the server before writing — is what makes
 * grouping and filtering by category actually work instead of fragmenting
 * into near-duplicates.
 */

/** Offered as one-tap suggestions in the create dialog. Editable in one place. */
export const MEMORY_CATEGORY_SUGGESTIONS = [
  "runbook",
  "decision",
  "preference",
  "fact",
  "procedure",
  "contact",
  "pricing",
  "hours",
  "policy",
  "troubleshooting",
] as const;

/** Assigned to existing memories that matched no inference rule. */
export const UNCATEGORIZED = "uncategorized";

export const MAX_CATEGORIES = 5;
export const MAX_CATEGORY_LENGTH = 32;

/**
 * trim → lowercase → inner whitespace to "-" → strip unsupported characters
 * → cap length → drop empties. Returns the normalized slug, or "" when
 * nothing usable survives.
 */
export function normalizeCategory(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_CATEGORY_LENGTH);
}

/**
 * Normalizes a list and removes duplicates while preserving the order the
 * user chose them in — the first three chips on a card reflect their actual
 * first choices, not alphabetical noise.
 */
export function normalizeCategories(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    const slug = normalizeCategory(entry);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

export type CategoryValidation =
  | { ok: true; categories: string[] }
  | { ok: false; error: string };

/**
 * A memory must land somewhere: an empty category list is rejected rather
 * than silently stored as uncategorized, because the create form promises a
 * required field and quietly ignoring it would hide the problem.
 */
export function validateCategories(
  raw: unknown,
  { required = true }: { required?: boolean } = {}
): CategoryValidation {
  const normalized = normalizeCategories(raw);

  if (normalized.length === 0) {
    return {
      ok: false,
      error: required
        ? "Pick at least one category."
        : "No valid categories were supplied.",
    };
  }

  if (normalized.length > MAX_CATEGORIES) {
    return {
      ok: false,
      error: `Use at most ${MAX_CATEGORIES} categories.`,
    };
  }

  return { ok: true, categories: normalized };
}

/**
 * Reads the stored JSON column. Anything unparseable or of the wrong shape
 * degrades to a single `uncategorized` entry rather than crashing or rendering
 * a memory that appears to belong to nothing.
 */
export function parseCategories(raw: unknown): string[] {
  if (Array.isArray(raw)) return normalizeCategories(raw);
  if (typeof raw !== "string") return [UNCATEGORIZED];

  const trimmed = raw.trim();
  if (!trimmed) return [UNCATEGORIZED];

  try {
    const parsed = JSON.parse(trimmed);
    const normalized = normalizeCategories(parsed);
    return normalized.length ? normalized : [UNCATEGORIZED];
  } catch {
    /* Tolerate a bare slug written by hand or by an older writer. */
    const single = normalizeCategory(trimmed);
    return single ? [single] : [UNCATEGORIZED];
  }
}

/** Writes the column. Always valid JSON so readers never have to guess. */
export function serializeCategories(categories: string[]): string {
  return JSON.stringify(normalizeCategories(categories));
}

/** Human-readable form for chips and filter options. */
export function categoryLabel(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}