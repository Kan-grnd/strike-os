"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  buildImplementerPrompt,
  CHANGE_PROPERTIES,
  changeRowsFor,
  CONTROL_REGISTRY,
  parseValueUnit,
  SCOPE_OPTIONS,
  TWEAK_KINDS,
  type ChangeControl,
  type EditChange,
  type EditDataContext,
  type EditTicketInput,
  type TicketPriority,
  type TicketScope,
  type TweakKind,
} from "@/lib/edit-tickets";
import { buildThumbnailDataUrl } from "@/lib/edit-thumbnail";
import { resolveIndexPath, type CaptureResult } from "./capture";
import { useEditMode } from "./edit-mode-provider";

/** One-click starting points that pre-fill kind, a row or two, and the intent. */
const TEMPLATES: {
  id: string;
  label: string;
  kind: TweakKind;
  props: string[];
  intent: (label: string) => string;
}[] = [
  {
    id: "spacing",
    label: "Fix spacing",
    kind: "SPACING",
    props: ["padding", "margin"],
    intent: (label) => `Re-balance the spacing on ${label} so it breathes and aligns with the layout around it.`,
  },
  {
    id: "copy",
    label: "Fix copy",
    kind: "TEXT",
    props: ["fontSize", "fontWeight", "color"],
    intent: (label) => `Tighten the copy on ${label}: keep the meaning, sharpen the wording, match the visual hierarchy.`,
  },
  {
    id: "responsive",
    label: "Make responsive",
    kind: "SIZE",
    props: ["width", "height", "padding"],
    intent: (label) => `Make ${label} behave correctly at mobile widths without breaking the desktop layout.`,
  },
  {
    id: "contrast",
    label: "Fix contrast",
    kind: "COLOR",
    props: ["color", "backgroundColor"],
    intent: (label) => `Raise the contrast on ${label} so text stays readable on every surface (WCAG AA).`,
  },
];

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

const STEPS = ["Target", "Changes", "Words", "Send"] as const;

const draftKey = (route: string) => `strike.edit.draft.${route}`;

interface TicketModalProps {
  capture: CaptureResult;
  onClose: () => void;
}

interface TargetCrumb {
  tag: string;
  label: string;
  selectorPath: string;
  htmlExcerpt: string;
  computed: TicketModalProps["capture"]["computed"];
  nodeIndexPath: number[];
}

/** Resolve the live node for a given index path — the only way this dialog ever
 *  resolves a target, so preview and the filed selector cannot drift apart. */
const resolveByPath = resolveIndexPath;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
      {children}
    </div>
  );
}

function ColorCell({
  i,
  desired,
  onChange,
}: {
  i: number;
  desired: string;
  onChange: (v: string) => void;
}) {
  const hex = toHex(desired);
  return (
    <div className="flex items-center gap-1">
      <input
        type="color"
        value={hex}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Change ${i + 1} colour swatch`}
        className="h-9 w-10 shrink-0 cursor-pointer rounded-xl border border-border bg-background p-0.5"
      />
      <Input
        value={desired}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#0f172a"
        className="h-9 font-mono text-xs"
        aria-label={`Change ${i + 1} colour`}
      />
    </div>
  );
}

function SelectCell({
  i,
  desired,
  options,
  onChange,
}: {
  i: number;
  desired: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={desired}
      onChange={(e) => onChange(e.target.value)}
      aria-label={`Change ${i + 1} value`}
      className="h-9 w-full rounded-xl border border-border bg-background px-1.5 text-xs outline-none focus:border-cyan-400/60"
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function ToggleShowCell({
  i,
  desired,
  onChange,
}: {
  i: number;
  desired: string;
  onChange: (v: string) => void;
}) {
  const showing = desired !== "" ? desired !== "none" : false;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={showing}
      aria-label={`Change ${i + 1} show/hide`}
      onClick={() => onChange(showing ? "none" : "block")}
      className={cn(
        "flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition-colors",
        showing
          ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300"
          : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      <span className={cn("h-4 w-7 rounded-full p-0.5 transition-colors", showing ? "bg-cyan-400/60" : "bg-muted")}>
        <span className={cn("block h-3 w-3 rounded-full bg-background transition-transform", showing ? "translate-x-3" : "translate-x-0")} />
      </span>
      {showing ? "Showing" : "Hidden"}
    </button>
  );
}

/** Which editor control fits a property (display → toggle under HIDE_SHOW). */
function controlFor(property: string, kind: TweakKind): ChangeControl {
  const spec = CONTROL_REGISTRY[property];
  if (!spec) return "text";
  if (kind === "HIDE_SHOW" && property === "display") return "toggle_show";
  return spec.control;
}

/** rgb(r,g,b) / rgba(r,g,b,a) → #rrggbb (best effort for the swatch input). */
function toHex(color: string): string {
  const t = color.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(t)) return t;
  const rgb = t.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!rgb) return "#000000";
  const c = [rgb[1], rgb[2], rgb[3]]
    .map((n) => Math.max(0, Math.min(255, Number(n))))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  return `#${c}`;
}

function NumberCell({
  i,
  property,
  desired,
  onChange,
}: {
  i: number;
  property: string;
  desired: string;
  onChange: (v: string) => void;
}) {
  const spec = CONTROL_REGISTRY[property];
  const units = (spec?.units?.length ? spec.units : ["px"]) as string[];
  const step = spec?.step ?? 1;
  const parsed = parseValueUnit(desired);
  const num = parsed !== null ? (Number.isInteger(parsed.num) ? String(parsed.num) : String(Math.round(parsed.num * 100) / 100)) : "";
  const unit = parsed !== null ? parsed.unit : units[0];

  const commit = (v: string, u?: string) => {
    const nextUnit = u !== undefined ? u : unit;
    if (v === "") return onChange("");
    onChange(`${v}${nextUnit}`);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Change ${i + 1} decrement`}
        onClick={() => commit(String(((parsed?.num ?? 0) - step) * 1))}
        className="h-9 w-8 shrink-0 rounded-xl border border-border text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        −
      </button>
      <Input
        value={num}
        onChange={(e) => commit(e.target.value)}
        inputMode="decimal"
        placeholder={parsed !== null ? "" : "e.g. 24px"}
        className="h-9 min-w-0 flex-1 font-mono text-xs"
        aria-label={`Change ${i + 1} value`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Change ${i + 1} increment`}
        onClick={() => commit(String(((parsed?.num ?? 0) + step) * 1))}
        className="h-9 w-8 shrink-0 rounded-xl border border-border text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        +
      </button>
      <select
        value={unit}
        onChange={(e) => commit(num === "" ? "0" : num, e.target.value)}
        aria-label={`Change ${i + 1} unit`}
        className="h-9 w-14 shrink-0 rounded-xl border border-border bg-background px-1 text-xs outline-none focus:border-cyan-400/60"
      >
        {units.map((u) => (
          <option key={u} value={u}>
            {u === "" ? "auto" : u}
          </option>
        ))}
      </select>
    </div>
  );
}

function ChangeRow({
  row,
  i,
  kind,
  onUpdate,
  onPropertyChange,
  onRemove,
}: {
  row: EditChange;
  i: number;
  kind: TweakKind;
  onUpdate: (patch: Partial<EditChange>) => void;
  onPropertyChange: (property: string) => void;
  onRemove: () => void;
}) {
  const control = controlFor(row.property, kind);

  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-2.5">
      <div className="flex items-center gap-1.5">
        <select
          value={row.property}
          onChange={(e) => onPropertyChange(e.target.value)}
          aria-label={`Change ${i + 1} property`}
          className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-background px-1.5 font-mono text-xs outline-none focus:border-cyan-400/60"
        >
          {CHANGE_PROPERTIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <span className="text-[11px] tabular-nums text-muted-foreground/70">{i + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove change ${i + 1}`}
          title={`Remove change ${i + 1}`}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <FieldLabel>Current</FieldLabel>
          <div
            className="flex h-9 items-center truncate rounded-xl border border-border bg-background/60 px-2 font-mono text-xs text-foreground/70"
            title={row.current}
          >
            {row.current || "—"}
          </div>
        </div>
        <div className="space-y-1">
          <FieldLabel>Desired</FieldLabel>
          {control === "color" ? (
            <ColorCell i={i} desired={row.desired} onChange={(v) => onUpdate({ desired: v })} />
          ) : control === "number" ? (
            <NumberCell i={i} property={row.property} desired={row.desired} onChange={(v) => onUpdate({ desired: v })} />
          ) : control === "select" ? (
            <SelectCell
              i={i}
              desired={row.desired}
              options={CONTROL_REGISTRY[row.property]?.options ?? []}
              onChange={(v) => onUpdate({ desired: v })}
            />
          ) : control === "toggle_show" ? (
            <ToggleShowCell i={i} desired={row.desired} onChange={(v) => onUpdate({ desired: v })} />
          ) : (
            <Input
              value={row.desired}
              onChange={(e) => onUpdate({ desired: e.target.value })}
              placeholder="e.g. 24px"
              className="h-9 font-mono text-xs"
              aria-label={`Change ${i + 1} desired`}
            />
          )}
        </div>
      </div>

      <div className="space-y-1">
        <FieldLabel>Note</FieldLabel>
        <Input
          value={row.note}
          onChange={(e) => onUpdate({ note: e.target.value })}
          placeholder="why / what it should look like"
          className="h-9 text-xs"
          aria-label={`Change ${i + 1} note`}
        />
      </div>
    </div>
  );
}

export function TicketModal({ capture, onClose }: TicketModalProps) {
  const router = useRouter();
  const { shapes, clearShapes } = useEditMode();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<TweakKind>("TEXT");
  const [scope, setScope] = useState<TicketScope>("THIS_ELEMENT");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [applyToSiblings, setApplyToSiblings] = useState(false);
  const [target, setTarget] = useState<TargetCrumb>(() => ({
    tag: "node",
    label: capture.label,
    selectorPath: capture.selectorPath,
    htmlExcerpt: capture.htmlExcerpt,
    computed: capture.computed,
    nodeIndexPath: capture.nodeIndexPath,
  }));
  const [changes, setChanges] = useState<EditChange[]>(() =>
    changeRowsFor("TEXT", capture.computed)
  );
  const [intent, setIntent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filedId, setFiledId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const previewSnapshot = useRef<{ el: HTMLElement; cssText: string } | null>(null);
  const [metaModels, setMetaModels] = useState<string[]>([]);
  const [metaRoutes, setMetaRoutes] = useState<string[]>([]);
  const [dataContext, setDataContext] = useState<Required<EditDataContext>>({
    model: "",
    endpoint: "",
    recordId: "",
    note: "",
  });
  const [customEndpoint, setCustomEndpoint] = useState(false);

  const crumbs: TargetCrumb[] = useMemo(() => {
    const ancestors = capture.ancestors?.map<TargetCrumb>((a) => ({
      tag: a.tag,
      label: a.label,
      selectorPath: a.selectorPath,
      htmlExcerpt: a.htmlExcerpt,
      computed: a.computed,
      nodeIndexPath: a.nodeIndexPath,
    }));
    return [
      ...(ancestors ?? []),
      {
        tag: "node",
        label: capture.label,
        selectorPath: capture.selectorPath,
        htmlExcerpt: capture.htmlExcerpt,
        computed: capture.computed,
        nodeIndexPath: capture.nodeIndexPath,
      },
    ];
  }, [capture]);

  const retarget = (crumb: TargetCrumb) => {
    // A different target means the live preview no longer applies.
    setPreviewActive(false);
    setTarget(crumb);
    // Re-derive Change rows against the new snapshot so `current` stays live,
    // preserving any desired/note the user already typed by property.
    setChanges((rows) =>
      rows.map((row) => {
        const current = currentFor(row.property, crumb);
        return { ...row, current };
      })
    );
  };

  const targetIndex = useMemo(
    () => crumbs.findIndex((c) => c.selectorPath === target.selectorPath),
    [crumbs, target.selectorPath]
  );

  // Move focus into the dialog on open and hand it back to whatever opened it
  // when it unmounts. Escape itself is handled by EditModeProvider.
  useEffect(() => {
    prevFocus.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      prevFocus.current?.focus?.();
    };
  }, []);

  // Load the dev-gated metadata for the Data section (models + API routes).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/edit-meta")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        setMetaModels(Array.isArray(json.models) ? json.models : []);
        setMetaRoutes(Array.isArray(json.routes) ? json.routes : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Trap Tab inside the dialog so keyboard users can't reach the page behind it.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || document.activeElement === root) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, []);

  // A half-finished ticket survives reloads: each route keeps one draft in
  // localStorage. It is only ever written back to the server when filed.
  useEffect(() => {
    let cancelled = false;
    try {
      const raw = window.localStorage.getItem(draftKey(capture.route));
      if (!raw) return;
      const d = JSON.parse(raw) as {
        kind?: TweakKind;
        scope?: TicketScope;
        priority?: TicketPriority;
        applyToSiblings?: boolean;
        changes?: EditChange[];
        intent?: string;
        dataContext?: Partial<EditDataContext>;
        targetPath?: string;
      };
      if (cancelled) return;
      if (d.kind) setKind(d.kind as TweakKind);
      if (d.scope) setScope(d.scope as TicketScope);
      if (d.priority) setPriority(d.priority as TicketPriority);
      if (typeof d.applyToSiblings === "boolean") setApplyToSiblings(d.applyToSiblings);
      if (typeof d.intent === "string") setIntent(d.intent);
      if (d.dataContext) {
        setDataContext({
          model: d.dataContext.model ?? "",
          endpoint: d.dataContext.endpoint ?? "",
          recordId: d.dataContext.recordId ?? "",
          note: d.dataContext.note ?? "",
        });
        if (d.dataContext.model || d.dataContext.endpoint || d.dataContext.recordId || d.dataContext.note) {
          setDataOpen(true);
        }
      }

      // Typed desired values belong to the target they were typed against.
      // Re-using them for a different node would file a wrong "before".
      const sameTarget = !d.targetPath || d.targetPath === capture.selectorPath;
      if (sameTarget && Array.isArray(d.changes)) {
        setChanges(
          changeRowsFor(d.kind ?? "TEXT", target.computed).map((row) => {
            const saved = d.changes!.find((c) => c.property === row.property);
            return saved ? { ...row, desired: saved.desired, note: saved.note } : row;
          })
        );
      } else if (Array.isArray(d.changes) && d.changes.some((c) => c.desired.trim())) {
        setChanges(changeRowsFor(d.kind ?? "TEXT", target.computed));
        toast.info("Saved draft was for a different element — change values not reused");
      }
    } catch {
      /* corrupt draft — ignore */
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced draft save whenever a field changes.
  useEffect(() => {
    if (filedId) return;
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(
          draftKey(capture.route),
          JSON.stringify({
            kind,
            scope,
            priority,
            applyToSiblings,
            changes,
            intent,
            dataContext,
            targetPath: target.selectorPath,
          })
        );
      } catch {
        /* storage unavailable */
      }
    }, 350);
    return () => clearTimeout(t);
  }, [kind, scope, priority, applyToSiblings, changes, intent, dataContext, target.selectorPath, filedId, capture.route]);

  const discardDraft = () => {
    try {
      window.localStorage.removeItem(draftKey(capture.route));
    } catch {
      /* ignore */
    }
    setKind("TEXT");
    setScope("THIS_ELEMENT");
    setPriority("MEDIUM");
    setApplyToSiblings(false);
    setChanges(changeRowsFor("TEXT", target.computed));
    setIntent("");
    setCustomEndpoint(false);
    setDataOpen(false);
    setDataContext({ model: "", endpoint: "", recordId: "", note: "" });
    setPreviewActive(false);
    toast.success("Draft cleared");
  };

  const pickKind = (k: TweakKind) => {
    setKind(k);
    setChanges(changeRowsFor(k, target.computed));
  };

  const applyTemplate = (tpl: (typeof TEMPLATES)[number]) => {
    setKind(tpl.kind);
    setChanges(
      tpl.props.map((property) => ({
        property,
        current: currentFor(property, target),
        desired: "",
        note: "",
      }))
    );
    const label = target.label ? `“${target.label.slice(0, 40)}”` : "this element";
    setIntent(tpl.intent(label));
    setStep(1);
  };

  const draftIntent = () => {
    const rows = changes.filter((c) => c.desired.trim() || c.note.trim());
    if (rows.length === 0) {
      toast.info("Add at least one desired value first");
      return;
    }
    const label = target.label ? `“${target.label.slice(0, 40)}”` : "this element";
    const lines = rows.map((c) => {
      const from = c.current.trim() ? ` from ${c.current}` : "";
      const to = c.desired.trim() ? ` to ${c.desired}` : "";
      const note = c.note.trim() ? ` — ${c.note}` : "";
      return `  - ${c.property}${from}${to}${note}`;
    });
    setIntent(`Change ${label} on ${capture.route}:\n${lines.join("\n")}`);
  };

  function currentFor(property: string, crumb: TargetCrumb): string {
    const c = crumb.computed as unknown as Record<string, string>;
    if (property in c && c[property] !== undefined) return c[property];
    // Extras (boxShadow, opacity, gap, zIndex, borderStyle) have no snapshot entry — read live.
    if (["boxShadow", "opacity", "gap", "zIndex", "borderStyle"].includes(property)) {
      const el = resolveByPath(crumb.nodeIndexPath);
      if (!el) return "";
      try {
        const cs = getComputedStyle(el);
        const value = (cs as unknown as Record<string, string>)[property];
        return value ?? "";
      } catch {
        return "";
      }
    }
    return "";
  }

  const updateChange = (i: number, patch: Partial<EditChange>) => {
    setChanges((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const addChange = () => {
    setChanges((rows) => [
      ...rows,
      { property: "padding", current: currentFor("padding", target), desired: "", note: "" },
    ]);
  };

  const removeChange = (i: number) => {
    setChanges((rows) => rows.filter((_, idx) => idx !== i));
  };

  // One thumbnail, built once, shared by the copied prompt and the filed ticket
  // so the two can never disagree. The drawing surface is closed while this
  // dialog is up, so the shapes cannot change underneath it.
  const thumbnail = useMemo(
    () =>
      buildThumbnailDataUrl({
        viewport: capture.viewport,
        nodeIndexPath: target.nodeIndexPath,
        targetLabel: target.label,
        shapes,
      }),
    [capture.viewport, target.nodeIndexPath, target.label, shapes]
  );

  const hasData = Object.values(dataContext).some((v) => v.trim().length > 0);
  const cleanData = hasData
    ? {
        model: dataContext.model.trim(),
        endpoint: dataContext.endpoint.trim(),
        recordId: dataContext.recordId.trim(),
        note: dataContext.note.trim(),
      }
    : null;

  const input: EditTicketInput = useMemo(
    () => ({
      scope,
      tweakKind: kind,
      route: capture.route,
      selectorPath: target.selectorPath,
      htmlExcerpt: target.htmlExcerpt,
      computed: target.computed,
      tweakValues: Object.fromEntries(
        changes.map((c) => [c.property, c.current])
      ),
      intent,
      applyToSiblings,
      changes,
      priority,
      dataContext: cleanData ?? undefined,
      shapes: shapes.length > 0 ? shapes : undefined,
      label: target.label,
      hasThumbnail: thumbnail !== null,
    }),
    [scope, kind, capture, target, changes, intent, applyToSiblings, priority, cleanData, shapes, thumbnail]
  );

  // Live preview: mirror each desired Change onto the exact captured element,
  // resolved by its index path only — never a "close enough" selector match, so
  // a moved element reports a miss instead of restyling the wrong node. Reverts
  // on toggle-off, retarget, and unmount. Preview never writes to the ticket.
  useEffect(() => {
    if (!previewActive) return;
    const el = resolveByPath(target.nodeIndexPath);
    if (!(el instanceof HTMLElement)) {
      toast.error("Target moved — preview unavailable");
      setPreviewActive(false);
      return;
    }
    const apply = () => {
      const snapshot = previewSnapshot.current;
      if (!snapshot || snapshot.el !== el) {
        previewSnapshot.current = { el, cssText: el.getAttribute("style") ?? "" };
      }
      for (const c of changes) {
        const prop = c.property.trim();
        const val = c.desired.trim();
        if (!prop || !val) continue;
        try {
          el.style.setProperty(
            prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
            val
          );
        } catch {
          // ignore individual style failures — preview must never throw
        }
      }
    };
    apply();
    return () => {
      const snapshot = previewSnapshot.current;
      if (snapshot && snapshot.el === el) {
        if (snapshot.cssText === "") el.removeAttribute("style");
        else el.setAttribute("style", snapshot.cssText);
        previewSnapshot.current = null;
      }
    };
  }, [previewActive, target, changes]);

  const desiredRows = changes.filter((c) => c.desired.trim().length > 0);
  const canPreview = desiredRows.length > 0;
  const missing = useMemo(() => {
    const out: string[] = [];
    if (!target.selectorPath.trim()) out.push("pick a target");
    if (desiredRows.length === 0) out.push("add a desired value");
    if (!intent.trim()) out.push("describe the change");
    return out;
  }, [target.selectorPath, desiredRows.length, intent]);

  const readyToFile = missing.length === 0 && !submitting;

  const copyPrompt = async () => {
    if (missing.length > 0) {
      toast.info(`Still needed: ${missing.join(", ")}`);
      return;
    }
    try {
      await navigator.clipboard.writeText(buildImplementerPrompt(input));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast.success("Implementer prompt copied");
    } catch {
      toast.error("Clipboard unavailable in this browser");
    }
  };

  const fileTicket = async () => {
    if (!readyToFile) {
      if (missing.length > 0) toast.info(`Still needed: ${missing.join(", ")}`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/edit-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          tweakKind: kind,
          route: capture.route,
          selectorPath: target.selectorPath,
          htmlExcerpt: target.htmlExcerpt,
          currentStyles: JSON.stringify({
            computed: target.computed,
            tweak: Object.fromEntries(changes.map((c) => [c.property, c.current])),
            label: target.label,
            viewport: capture.viewport,
            targetPath: target.nodeIndexPath,
            applyToSiblings,
            shapes,
          }),
          changes,
          dataContext: cleanData,
          priority,
          thumbnail,
          intent,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to file ticket");
      try {
        window.localStorage.removeItem(draftKey(capture.route));
      } catch {
        /* storage unavailable */
      }
      setFiledId(json.ticket.id);
      setPreviewActive(false);
      // The drawings travelled with the ticket — leave the page clean so the
      // next pick cannot sweep them into a second ticket.
      clearShapes();
      toast.success("Ticket filed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to file ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={rootRef} className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
      <button
        type="button"
        aria-label="Close ticket modal"
        onClick={onClose}
        className="absolute inset-0 glass-scrim"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="File edit ticket"
        tabIndex={-1}
        className="relative flex max-h-[calc(100dvh-1rem)] w-[640px] max-w-full flex-col overflow-hidden rounded-xl border glass-elevated outline-none"
      >
        {filedId ? (
          <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
              <Check className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-semibold">Ticket filed</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {kind} · {scope} · on {capture.route}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                onClick={() => {
                  onClose();
                  router.push("/edit-queue");
                }}
              >
                <ExternalLink className="h-4 w-4" />
                Open edit queue
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">File edit ticket</h2>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {target.label ? `“${target.label}” · ` : ""}
                  <span className="font-mono text-cyan-400">{target.selectorPath}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Close"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ol className="flex items-center gap-1 border-b border-border px-4 py-2">
              {STEPS.map((label, i) => (
                <li key={label} className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setStep(i)}
                    aria-current={i === step}
                    className={cn(
                      "flex h-8 w-full items-center justify-center gap-1.5 rounded-xl text-[11px] font-medium transition-colors",
                      i === step
                        ? "bg-cyan-400/15 text-cyan-300"
                        : i < step
                          ? "text-foreground/70 hover:bg-accent"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[11px] tabular-nums",
                        i === step
                          ? "bg-cyan-400/30 text-cyan-200"
                          : i < step
                            ? "bg-success/20 text-success"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {i < step ? <Check className="h-2.5 w-2.5" /> : i + 1}
                    </span>
                    <span className="truncate">{label}</span>
                  </button>
                </li>
              ))}
            </ol>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {step === 0 && (
                <>
                  <section className="space-y-2">
                    <FieldLabel>Target</FieldLabel>
                    <div className="flex flex-wrap items-center gap-1">
                      {crumbs.map((c, i) => (
                        <div key={i} className="flex items-center gap-1">
                          {i > 0 && <span className="text-muted-foreground/50">›</span>}
                          <button
                            type="button"
                            onClick={() => retarget(c)}
                            aria-current={i === targetIndex}
                            title={c.selectorPath}
                            className={cn(
                              "max-w-[180px] truncate rounded border px-1.5 py-1 font-mono transition-colors sm:max-w-[220px]",
                              i === targetIndex
                                ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300"
                                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                            )}
                          >
                            {c.tag}
                            {c.label ? (
                              <span className="ml-1 normal-case text-[11px] text-muted-foreground">
                                “{c.label.slice(0, 14)}”
                              </span>
                            ) : null}
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Pick a crumb to retarget. Preview and filed values follow this choice.
                    </p>
                  </section>

                  <section className="space-y-2">
                    <FieldLabel>Start from</FieldLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => applyTemplate(tpl)}
                          title="Fills the kind, a change row or two, and a draft intent"
                          className="rounded-xl border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {tpl.label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-2">
                    <FieldLabel>Kind</FieldLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {TWEAK_KINDS.map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => pickKind(k)}
                          aria-pressed={kind === k}
                          className={cn(
                            "rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors",
                            kind === k
                              ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300"
                              : "border-border text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {k === "HIDE_SHOW" ? "Hide/Show" : k.toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-2">
                    <FieldLabel>Scope</FieldLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {SCOPE_OPTIONS.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setScope(s.id)}
                          aria-pressed={scope === s.id}
                          className={cn(
                            "rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors",
                            scope === s.id
                              ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300"
                              : "border-border text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={applyToSiblings}
                        onChange={(e) => setApplyToSiblings(e.target.checked)}
                        className="h-4 w-4 accent-cyan-400"
                        aria-label="Also apply to siblings matching this selector"
                      />
                      Also apply to siblings matching this selector
                    </label>
                  </section>
                </>
              )}

              {step === 1 && (
                <section className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel>Changes</FieldLabel>
                    <Button variant="ghost" size="sm" onClick={addChange} type="button">
                      <Plus className="h-3.5 w-3.5" />
                      Add row
                    </Button>
                  </div>
                  {changes.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                      No rows yet. Add one, or go back and pick a template.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {changes.map((row, i) => (
                        <ChangeRow
                          key={i}
                          row={row}
                          i={i}
                          kind={kind}
                          onUpdate={(patch) => updateChange(i, patch)}
                          onPropertyChange={(property) =>
                            updateChange(i, {
                              property,
                              current: currentFor(property, target),
                            })
                          }
                          onRemove={() => removeChange(i)}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {desiredRows.length === 0
                      ? "No desired values yet — a ticket needs at least one."
                      : `${desiredRows.length} desired value${desiredRows.length > 1 ? "s" : ""} will be filed.`}
                  </p>
                </section>
              )}

              {step === 2 && (
                <>
                  <section className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <FieldLabel>Intent</FieldLabel>
                      <div className="flex items-center gap-1.5">
                        <label htmlFor="ticket-priority" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Priority
                        </label>
                        <select
                          id="ticket-priority"
                          value={priority}
                          onChange={(e) => setPriority(e.target.value as TicketPriority)}
                          aria-label="Ticket priority"
                          className="h-8 w-24 rounded-xl border border-border bg-background px-1.5 text-xs outline-none focus:border-cyan-400/60"
                        >
                          {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <Textarea
                      value={intent}
                      onChange={(e) => setIntent(e.target.value)}
                      placeholder="Describe the exact change in plain words — the ticket carries everything above verbatim. Broad scopes are first-class: say what should happen beyond this element."
                      className="min-h-[104px] resize-y text-sm"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      <Button variant="ghost" size="sm" type="button" onClick={draftIntent}>
                        <Sparkles className="h-3.5 w-3.5" />
                        Draft from changes
                      </Button>
                      <Button variant="ghost" size="sm" type="button" onClick={discardDraft}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Discard draft
                      </Button>
                    </div>
                  </section>

                  <section className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setDataOpen((v) => !v)}
                      aria-expanded={dataOpen}
                      className="flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", dataOpen && "rotate-90")} />
                      Data
                      <span className="font-normal text-muted-foreground/70">
                        — optional{hasData ? " · set" : ""}
                      </span>
                    </button>
                    {dataOpen && (
                      <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-2.5">
                        <p className="text-[11px] text-muted-foreground">
                          If this change is scoped to a record, point the implementer at it.
                        </p>
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          <div className="space-y-1">
                            <FieldLabel>Model</FieldLabel>
                            <select
                              value={dataContext.model}
                              onChange={(e) => setDataContext((d) => ({ ...d, model: e.target.value }))}
                              aria-label="Data model"
                              className="h-9 w-full rounded-xl border border-border bg-background px-1.5 text-xs outline-none focus:border-cyan-400/60"
                            >
                              <option value="">— none —</option>
                              {metaModels.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <FieldLabel>Endpoint</FieldLabel>
                            <select
                              value={customEndpoint ? "__custom__" : dataContext.endpoint}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "__custom__") {
                                  setCustomEndpoint(true);
                                } else {
                                  setCustomEndpoint(false);
                                  setDataContext((d) => ({ ...d, endpoint: v }));
                                }
                              }}
                              aria-label="Data endpoint"
                              className="h-9 w-full rounded-xl border border-border bg-background px-1.5 text-xs outline-none focus:border-cyan-400/60"
                            >
                              <option value="">— none —</option>
                              {metaRoutes.slice(0, 120).map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                              <option value="__custom__">Custom…</option>
                            </select>
                            {customEndpoint && (
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-muted-foreground">/api/</span>
                                <Input
                                  value={dataContext.endpoint.startsWith("/api/") ? dataContext.endpoint.slice(5) : dataContext.endpoint}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setDataContext((d) => ({
                                      ...d,
                                      endpoint: v ? `/api/${v.replace(/^\/api\//, "")}` : "",
                                    }));
                                  }}
                                  placeholder="e.g. agents/123"
                                  aria-label="Custom data endpoint"
                                  className="h-9 font-mono text-xs"
                                />
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <FieldLabel>Record id</FieldLabel>
                            <Input
                              value={dataContext.recordId}
                              onChange={(e) => setDataContext((d) => ({ ...d, recordId: e.target.value }))}
                              placeholder="e.g. cmt... or agent slug"
                              aria-label="Data record id"
                              className="h-9 font-mono text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <FieldLabel>Data note</FieldLabel>
                            <Input
                              value={dataContext.note}
                              onChange={(e) => setDataContext((d) => ({ ...d, note: e.target.value }))}
                              placeholder="which row this targets, in plain words"
                              aria-label="Data note"
                              className="h-9 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  {shapes.length > 0 && (
                    <section className="space-y-2">
                      <FieldLabel>Annotations</FieldLabel>
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: shapes[shapes.length - 1].color }}
                          />
                          {shapes.length} shape{shapes.length > 1 ? "s" : ""} travel with this ticket
                        </span>
                        <span className="text-[11px] uppercase tracking-wider">
                          {shapes.map((s) => s.type).join(" · ")}
                        </span>
                      </div>
                    </section>
                  )}
                </>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <section className="space-y-1.5 rounded-xl border border-border p-3">
                    <FieldLabel>Target</FieldLabel>
                    <div className="text-xs">
                      {target.label ? <div className="font-medium">“{target.label}”</div> : null}
                      <div className="font-mono break-all text-cyan-400">{target.selectorPath}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{capture.route}</div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] uppercase tracking-wider">
                      <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">{kind}</span>
                      <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">{scope}</span>
                      <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">{priority}</span>
                      {applyToSiblings && (
                        <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">+ siblings</span>
                      )}
                    </div>
                  </section>

                  <section className="space-y-1.5 rounded-xl border border-border p-3">
                    <FieldLabel>Changes ({desiredRows.length})</FieldLabel>
                    {desiredRows.length === 0 ? (
                      <p className="text-xs text-muted-foreground">None yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {desiredRows.map((c) => (
                          <li key={c.property} className="font-mono text-[11px] break-words">
                            <span className="text-foreground/80">{c.property}</span>
                            <span className="text-muted-foreground"> {c.current || "—"}</span>
                            <span className="text-muted-foreground"> → </span>
                            <span className="text-cyan-300">{c.desired}</span>
                            {c.note ? <span className="font-sans text-muted-foreground"> · {c.note}</span> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="space-y-1.5 rounded-xl border border-border p-3">
                    <FieldLabel>Intent</FieldLabel>
                    <p className="text-xs whitespace-pre-wrap text-foreground/90">
                      {intent || <span className="text-muted-foreground">Not written yet.</span>}
                    </p>
                  </section>

                  {cleanData && (
                    <section className="space-y-1.5 rounded-xl border border-border p-3">
                      <FieldLabel>Data</FieldLabel>
                      <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                        {cleanData.model && <li>model: <span className="font-mono">{cleanData.model}</span></li>}
                        {cleanData.endpoint && <li>endpoint: <span className="font-mono text-cyan-400">{cleanData.endpoint}</span></li>}
                        {cleanData.recordId && <li>record: <span className="font-mono">{cleanData.recordId}</span></li>}
                        {cleanData.note && <li>{cleanData.note}</li>}
                      </ul>
                    </section>
                  )}

                  <section className="space-y-1.5 rounded-xl border border-border p-3">
                    <FieldLabel>Picture</FieldLabel>
                    <p className="text-xs text-muted-foreground">
                      {thumbnail ? (
                        <span className="flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5 text-success" />
                          {shapes.length} annotation{shapes.length === 1 ? "" : "s"} attached
                        </span>
                      ) : (
                        "No picture — nothing was drawn or the target could not be located."
                      )}
                    </p>
                    {thumbnail && (
                      <img
                        src={thumbnail}
                        alt="Target and annotation preview"
                        className="mt-1 h-24 w-36 rounded border border-border bg-background object-contain"
                      />
                    )}
                  </section>

                  {missing.length > 0 && (
                    <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      Still needed: {missing.join(", ")}.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-border px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    disabled={step === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                  {step < STEPS.length - 1 && (
                    <Button variant="outline" size="sm" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    variant={previewActive ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setPreviewActive((v) => !v)}
                    disabled={!canPreview && !previewActive}
                    aria-pressed={previewActive}
                    title={
                      canPreview
                        ? "Apply the desired Changes to the live element so you can see the result before filing"
                        : "Add a desired value first"
                    }
                  >
                    {previewActive ? <Check className="h-4 w-4 text-success" /> : <Eye className="h-4 w-4" />}
                    {previewActive ? "Previewing" : "Preview"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={copyPrompt}>
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy prompt"}
                  </Button>
                  <Button size="sm" onClick={fileTicket} disabled={!readyToFile}>
                    {submitting ? "Filing…" : "File ticket"}
                  </Button>
                </div>
              </div>
              {missing.length > 0 && step < STEPS.length - 1 && (
                <p className="text-[11px] text-muted-foreground">
                  To file: {missing.join(", ")}.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
