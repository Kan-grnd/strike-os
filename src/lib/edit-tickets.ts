/**
 * Edit-on-the-spot shared vocabulary: ticket kinds, scopes, the dev guard,
 * and the paste-ready implementer prompt builder used by the picker modal
 * and the /edit-queue page. Kept dependency-free so both client and API
 * can share it.
 */

export const TWEAK_KINDS = [
  "TEXT",
  "COLOR",
  "SPACING",
  "SIZE",
  "HIDE_SHOW",
  "MOVE",
  "BEHAVIOR",
  "OTHER",
] as const;

export type TweakKind = (typeof TWEAK_KINDS)[number];

export const SCOPE_OPTIONS = [
  { id: "THIS_ELEMENT", label: "This element" },
  { id: "THIS_SECTION", label: "This section" },
  { id: "THIS_PAGE", label: "This page" },
  { id: "WHOLE_APP", label: "Whole app" },
  { id: "BACKEND_DATA", label: "Backend-or-data" },
] as const;

export type TicketScope = (typeof SCOPE_OPTIONS)[number]["id"];

export interface ComputeStyleSnapshot {
  fontSize: string;
  fontFamily: string;
  fontWeight: string;
  color: string;
  backgroundColor: string;
  padding: string;
  margin: string;
  borderRadius: string;
  borderWidth: string;
  borderColor: string;
  display: string;
  width: string;
  height: string;
}

export interface EditTicketInput {
  scope: TicketScope;
  tweakKind: TweakKind;
  route: string;
  selectorPath: string;
  htmlExcerpt: string;
  computed: ComputeStyleSnapshot;
  tweakValues: Record<string, string>;
  intent: string;
  applyToSiblings?: boolean;
  changes?: EditChange[];
  dataContext?: EditDataContext;
  shapes?: Array<{
    type: "rectangle" | "ellipse" | "arrow";
    x: number;
    y: number;
    x2: number;
    y2: number;
    color: string;
  }>;
  /** Optional human-readable label for the target (falls back to scope). */
  label?: string;
  /** Whether an annotation thumbnail is attached to the ticket. */
  hasThumbnail?: boolean;
}

export interface EditChange {
  property: string;
  current: string;
  desired: string;
  note: string;
}

/** Optional data-context scoping for a ticket (E2 Data section). */
export interface EditDataContext {
  model?: string;
  endpoint?: string;
  recordId?: string;
  note?: string;
}

/** Snapshot keys + extras the Changes builder and E3 registry operate on. */
export const CHANGE_PROPERTIES = [
  "fontSize",
  "fontFamily",
  "fontWeight",
  "color",
  "backgroundColor",
  "padding",
  "margin",
  "borderRadius",
  "borderWidth",
  "borderColor",
  "borderStyle",
  "display",
  "width",
  "height",
  "boxShadow",
  "opacity",
  "gap",
  "zIndex",
] as const;

export type ChangeProperty = (typeof CHANGE_PROPERTIES)[number];

/** Is the property one of the base snapshot keys (vs a compute-at-runtime extra)? */
export function isSnapshotKey(property: string): boolean {
  return [
    "fontSize",
    "fontFamily",
    "fontWeight",
    "color",
    "backgroundColor",
    "padding",
    "margin",
    "borderRadius",
    "borderWidth",
    "borderColor",
    "display",
    "width",
    "height",
  ].includes(property);
}

const LENGTH_UNITS = ["px", "rem", "em", "%"];
const UNITLESS = ["", "px"];

/**
 * How the Changes builder should render a value for a given property.
 * - color       → native swatch synced with a hex text field
 * - number      → stepper (− number +) that preserves the unit
 * - select      → value dropdown (fontWeight / display / borderStyle)
 * - toggle_show → show/hide switch (HIDE_SHOW preset → display none/block)
 * - text        → plain input (fontFamily, boxShadow)
 */
export type ChangeControl =
  | "color"
  | "number"
  | "select"
  | "toggle_show"
  | "text";

export const CONTROL_REGISTRY: Record<string, { control: ChangeControl; units?: string[]; options?: string[]; step?: number }> = {
  color: { control: "color" },
  backgroundColor: { control: "color" },
  borderColor: { control: "color" },
  fontSize: { control: "number", units: LENGTH_UNITS, step: 1 },
  padding: { control: "number", units: LENGTH_UNITS, step: 1 },
  margin: { control: "number", units: LENGTH_UNITS, step: 1 },
  width: { control: "number", units: LENGTH_UNITS, step: 1 },
  height: { control: "number", units: LENGTH_UNITS, step: 1 },
  borderRadius: { control: "number", units: LENGTH_UNITS, step: 1 },
  borderWidth: { control: "number", units: ["px", "rem", "em"], step: 1 },
  gap: { control: "number", units: LENGTH_UNITS, step: 1 },
  opacity: { control: "number", units: UNITLESS, step: 0.05 },
  zIndex: { control: "number", units: UNITLESS, step: 1 },
  fontWeight: {
    control: "select",
    options: ["normal", "500", "600", "700", "bold", "100", "200", "300", "400"],
  },
  display: {
    control: "select",
    options: ["block", "flex", "grid", "inline", "inline-block", "none", "contents"],
  },
  borderStyle: {
    control: "select",
    options: ["solid", "dashed", "dotted", "double", "none", "groove", "ridge"],
  },
  // Everything else falls back to text.
};

/** Split "16px" → { num: 16, unit: "px" }; null when not a numeric-with-unit value. */
export function parseValueUnit(
  value: string
): { num: number; unit: string } | null {
  const m = value.trim().match(/^(-?\d*\.?\d+)(px|rem|em|%|fr)?$/);
  if (!m) return null;
  return { num: parseFloat(m[1]), unit: m[2] ?? "" };
}

export interface EditTicketRow {
  id: string;
  scope: string;
  tweakKind: string;
  route: string;
  selectorPath: string;
  htmlExcerpt: string;
  currentStyles: string; // JSON — { computed, tweak, label, viewport }
  intent: string;
  status: string;
  createdAt: string;
  changes?: string | null; // JSON array of EditChange
  dataContext?: string | null; // JSON of EditDataContext
  thumbnail?: string | null; // viewport-sized SVG data URL
}

const KIND_LABEL: Record<string, string> = {
  TEXT: "Text",
  COLOR: "Color",
  SPACING: "Spacing",
  SIZE: "Size",
  HIDE_SHOW: "Hide/Show",
  MOVE: "Move",
  BEHAVIOR: "Behavior",
  OTHER: "Other",
};

/** Dev-only guard, mirroring the reset-demo confirm() pattern. */
export function editTicketsAllowed(): boolean {
  const dbUrl = process.env.DATABASE_URL || "";
  if (!dbUrl.includes("dev.db")) return false;
  if (process.env.ALLOW_EDIT_TICKETS === "true") return true;
  return process.env.NODE_ENV === "development";
}

/** Per-tweak editable "current values" derived from the computed snapshot. */
export function kindValuesFor(
  kind: TweakKind,
  c: ComputeStyleSnapshot
): Record<string, string> {
  switch (kind) {
    case "TEXT":
      return {
        "font family": c.fontFamily,
        "font size": c.fontSize,
        "font weight": c.fontWeight,
        "text color": c.color,
      };
    case "COLOR":
      return { "text color": c.color, background: c.backgroundColor, border: c.borderColor };
    case "SPACING":
      return { padding: c.padding, margin: c.margin };
    case "SIZE":
      return { width: c.width != null ? c.width : "", "border radius": c.borderRadius, "font size": c.fontSize };
    case "HIDE_SHOW":
      return { display: c.display };
    case "MOVE":
      return { margin: c.margin, display: c.display };
    case "BEHAVIOR":
      return { display: c.display, "font size": c.fontSize };
    default:
      return { display: c.display, padding: c.padding };
  }
}

/** Maps kindValuesFor's friendly labels to real property names for the builder. */
const FRIENDLY_TO_PROPERTY: Record<string, string> = {
  "font family": "fontFamily",
  "font size": "fontSize",
  "font weight": "fontWeight",
  "text color": "color",
  background: "backgroundColor",
  border: "borderColor",
  padding: "padding",
  margin: "margin",
  width: "width",
  "border radius": "borderRadius",
  display: "display",
};

/** The quick-preset → builder rows: one structural Change row per snapshot key. */
export function changeRowsFor(
  kind: TweakKind,
  c: ComputeStyleSnapshot
): EditChange[] {
  return Object.entries(kindValuesFor(kind, c)).map(([label, current]) => ({
    property: FRIENDLY_TO_PROPERTY[label] ?? label,
    current,
    desired: "",
    note: "",
  }));
}

/** Structural input for the prompt builder — either a fresh modal input or a saved row. */
export interface PromptSource {
  tweakKind: string;
  scope: string;
  route: string;
  selectorPath: string;
  currentStyles?: string;
  tweakValues?: Record<string, string>;
  intent: string;
  applyToSiblings?: boolean;
  changes?: EditChange[] | string | null;
  dataContext?: EditDataContext | string | null;
  thumbnail?: string | null;
  shapes?: Array<{
    type: "rectangle" | "ellipse" | "arrow";
    x: number;
    y: number;
    x2: number;
    y2: number;
    color: string;
  }>;
  /** Optional human-readable label for the target (falls back to scope). */
  label?: string;
  /** Whether an annotation thumbnail is attached to the ticket. */
  hasThumbnail?: boolean;
}

function parseChanges(changes?: EditChange[] | string | null): EditChange[] {
  if (!changes) return [];
  if (Array.isArray(changes)) return changes;
  try {
    const parsed = JSON.parse(changes);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseDataContext(ctx?: EditDataContext | string | null): EditDataContext | null {
  if (!ctx) return null;
  if (typeof ctx !== "string") return ctx;
  try {
    return JSON.parse(ctx) as EditDataContext;
  } catch {
    return null;
  }
}

/**
 * Builds the one-click implementer prompt. Everything is plain text so it
 * survives paste into any tool untouched — verbatim, no markdown wrapping.
 */
export function buildImplementerPrompt(t: PromptSource): string {
  const changes = parseChanges(t.changes);
  const dataContext = parseDataContext(t.dataContext);

  const dataBlock = (() => {
    if (!dataContext) return "";
    const parts = [
      dataContext.model ? `  model: ${dataContext.model}` : "",
      dataContext.endpoint ? `  endpoint: ${dataContext.endpoint}` : "",
      dataContext.recordId ? `  record id: ${dataContext.recordId}` : "",
      dataContext.note ? `  note: ${dataContext.note}` : "",
    ].filter((l) => l !== "");
    if (parts.length === 0) return "";
    return `Data:\n${parts.join("\n")}`;
  })();

  const targetLabel = t.label || t.scope;
  const targetBlock = [
    "Target:",
    `  label: ${targetLabel}`,
    `  route: ${t.route}`,
    `  selector: ${t.selectorPath}`,
    `  also apply to siblings: ${t.applyToSiblings ? "yes" : "no"}`,
  ].join("\n");

  const changesBlock = (() => {
    if (changes.length > 0) {
      const rows = changes.map(
        ({ property, current, desired, note }) =>
          `  ${property} | ${current || "—"} | ${desired || "—"}${note ? ` | ${note}` : ""}`
      );
      return `Changes (property | before | after | note):\n${rows.join("\n")}`;
    }
    const lines: string[] = [];
    if (t.currentStyles) {
      const parsed = JSON.parse(t.currentStyles || "{}") as { tweak?: Record<string, string> };
      lines.push(
        ...Object.entries(parsed.tweak ?? {}).map(([k, v]) => `  ${k}: ${v}`)
      );
    } else {
      lines.push(...Object.entries(t.tweakValues ?? {}).map(([k, v]) => `  ${k}: ${v}`));
    }
    return lines.length > 0 ? `Current values:\n${lines.join("\n")}` : "";
  })();

  const annotationsBlock = (() => {
    const lines: string[] = [];
    if (t.shapes && t.shapes.length > 0) {
      lines.push(
        ...t.shapes.map(
          (s, i) =>
            `  ${i + 1}. ${s.type} at (${Math.round(s.x)},${Math.round(s.y)}) → (${Math.round(s.x2)},${Math.round(s.y2)}) color=${s.color}`
        )
      );
    }
    if (t.hasThumbnail || t.thumbnail) {
      lines.push("  thumbnail: attached (view the ticket's thumbnail field)");
    }
    return lines.length > 0 ? `Annotations (${lines.length}):\n${lines.join("\n")}` : "";
  })();

  const acceptanceBlock = (() => {
    const checks = changes.map(
      ({ property, current, desired }) =>
        `  - [ ] ${property} updated from ${current || "—"} to ${desired || "—"}`
    );
    if (checks.length === 0) {
      checks.push(`  - [ ] ${KIND_LABEL[t.tweakKind] ?? t.tweakKind} applied at ${t.route}`);
    }
    checks.push("  - [ ] no other visual regressions at 1440 × 900");
    checks.push("  - [ ] no other visual regressions at 375 × 812");
    return `Acceptance:\n${checks.join("\n")}`;
  })();

  return [
    "Strike OS edit ticket",
    `Tweak: ${KIND_LABEL[t.tweakKind] ?? t.tweakKind}`,
    `Intent: ${t.intent}`,
    targetBlock,
    dataBlock,
    changesBlock,
    annotationsBlock,
    acceptanceBlock,
  ]
    .filter((l) => l !== "")
    .join("\n");
}