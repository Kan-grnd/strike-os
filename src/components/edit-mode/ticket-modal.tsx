"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Eye, Plus, Sparkles, Trash2, X } from "lucide-react";
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
import type { CaptureResult } from "./capture";
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

/** Resolve the live node for a given index path, else null. */
function resolveByPath(path: number[]): Element | null {
  let node: Element = document.body;
  for (const i of path) {
    const child = node.children[i];
    if (!child) return null;
    node = child;
  }
  return node;
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
        className="h-8 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-background p-0.5"
      />
      <Input
        value={desired}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#0f172a"
        className="h-8 font-mono text-xs"
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
      className="h-8 w-full rounded-md border border-border bg-background px-1.5 text-xs outline-none focus:border-cyan-400/60"
    >
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
        "flex h-8 w-full items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors",
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
        className="h-8 w-7 shrink-0 rounded-md border border-border text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        −
      </button>
      <Input
        value={num}
        onChange={(e) => commit(e.target.value)}
        inputMode="decimal"
        placeholder={parsed !== null ? "" : "e.g. 24px"}
        className="h-8 min-w-0 flex-1 font-mono text-xs"
        aria-label={`Change ${i + 1} value`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Change ${i + 1} increment`}
        onClick={() => commit(String(((parsed?.num ?? 0) + step) * 1))}
        className="h-8 w-7 shrink-0 rounded-md border border-border text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        +
      </button>
      <select
        value={unit}
        onChange={(e) => commit(num === "" ? "0" : num, e.target.value)}
        aria-label={`Change ${i + 1} unit`}
        className="h-8 w-14 shrink-0 rounded-md border border-border bg-background px-1 text-xs outline-none focus:border-cyan-400/60"
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

export function TicketModal({ capture, onClose }: TicketModalProps) {
  const router = useRouter();
  const { shapes } = useEditMode();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
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
      const d = JSON.parse(raw) as Partial<TicketModalProps> & {
        kind?: TweakKind;
        scope?: TicketScope;
        priority?: TicketPriority;
        applyToSiblings?: boolean;
        changes?: EditChange[];
        intent?: string;
        dataContext?: Partial<EditDataContext>;
      };
      if (cancelled) return;
      if (d.kind) setKind(d.kind as TweakKind);
      if (d.scope) setScope(d.scope as TicketScope);
      if (d.priority) setPriority(d.priority as TicketPriority);
      if (typeof d.applyToSiblings === "boolean") setApplyToSiblings(d.applyToSiblings);
      if (Array.isArray(d.changes)) {
        setChanges(
          changeRowsFor(d.kind ?? "TEXT", target.computed).map((row) => {
            const saved = d.changes!.find((c) => c.property === row.property);
            return saved ? { ...row, desired: saved.desired, note: saved.note } : row;
          })
        );
      }
      if (typeof d.intent === "string") setIntent(d.intent);
      if (d.dataContext) {
        setDataContext({
          model: d.dataContext.model ?? "",
          endpoint: d.dataContext.endpoint ?? "",
          recordId: d.dataContext.recordId ?? "",
          note: d.dataContext.note ?? "",
        });
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
          })
        );
      } catch {
        /* storage unavailable */
      }
    }, 350);
    return () => clearTimeout(t);
  }, [kind, scope, priority, applyToSiblings, changes, intent, dataContext, filedId, capture.route]);

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
    setDataContext({ model: "", endpoint: "", recordId: "", note: "" });
  };

  const pickKind = (k: TweakKind) => {
    setKind(k);
    setChanges(changeRowsFor(k, target.computed));
  };

  const applyTemplate = (tpl: typeof TEMPLATES[number]) => {
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

  const currentFor = (property: string, crumb: TargetCrumb): string => {
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
  };

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
      dataContext: {
        model: dataContext.model.trim(),
        endpoint: dataContext.endpoint.trim(),
        recordId: dataContext.recordId.trim(),
        note: dataContext.note.trim(),
      },
      shapes: shapes.length > 0 ? shapes : undefined,
      label: target.label,
      hasThumbnail: shapes.length > 0,
    }),
    [scope, kind, capture, target, changes, intent, applyToSiblings, priority, dataContext, shapes]
  );

  // Live preview: when toggled on, mirror each desired Change onto the live
  // element (resolved from the index path, falling back to the last selector
  // segment). Never throws — a stale target surfaces as a toast and the preview
  // is skipped. Reverts on toggle-off, retarget, or close. Preview never writes
  // to the ticket.
  useEffect(() => {
    if (!previewActive) return;
    const resolveLive = (): HTMLElement | null => {
      const byPath = resolveByPath(target.nodeIndexPath);
      if (byPath && byPath instanceof HTMLElement) return byPath;
      const segs = target.selectorPath
        .split(">")
        .map((s) => s.trim())
        .filter(Boolean);
      const last = segs[segs.length - 1];
      if (!last) return null;
      try {
        const el = document.querySelector(last);
        return el instanceof HTMLElement ? el : null;
      } catch {
        return null;
      }
    };
    const el = resolveLive();
    if (!el) {
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

  const togglePreview = () => {
    setPreviewActive((v) => !v);
  };

  const copyPrompt = async () => {
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
    if (!intent.trim() || submitting) return;
    const withDesired = changes.some((c) => c.desired.trim().length > 0);
    if (!withDesired) {
      toast.info("Add at least one desired value before filing");
      return;
    }
    setSubmitting(true);
    try {
      const thumbnail = buildThumbnailDataUrl({
        viewport: capture.viewport,
        nodeIndexPath: target.nodeIndexPath,
        targetLabel: target.label,
        shapes,
      });
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
          dataContext,
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
      toast.success("Ticket filed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to file ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const readyToFile =
    intent.trim().length > 0 &&
    changes.some((c) => c.desired.trim().length > 0) &&
    !submitting;

  return (
    <div ref={rootRef} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close ticket modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="File edit ticket"
        tabIndex={-1}
        className="relative flex max-h-[88vh] w-[680px] max-w-[94vw] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl outline-none"
      >
        {filedId ? (
          <div className="flex flex-col items-center gap-4 px-8 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
              <Check className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-semibold">Ticket filed</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {kind} · {scope} · on {capture.route}
              </div>
            </div>
            <div className="flex items-center gap-2">
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
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold">File edit ticket</h2>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {target.label ? `“${target.label}” · ` : ""}
                  <span className="font-mono text-cyan-400">{target.selectorPath}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <section>
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Target
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                  {crumbs.map((c, i) => (
                    <div key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-muted-foreground/50">›</span>}
                      <button
                        type="button"
                        onClick={() => retarget(c)}
                        aria-current={i === targetIndex}
                        title={c.selectorPath}
                        className={cn(
                          "max-w-[220px] truncate rounded border px-1.5 py-0.5 font-mono transition-colors",
                          i === targetIndex
                            ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300"
                            : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                        )}
                      >
                        {c.tag}
                        {c.label ? (
                          <span className="ml-1 normal-case text-[10px] text-muted-foreground">
                            “{c.label.slice(0, 14)}”
                          </span>
                        ) : null}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Click a crumb to retarget — the snapshot and excerpt below swap to that node.
                </div>
              </section>

              <section>
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Preset
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TWEAK_KINDS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => pickKind(k)}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-xs font-medium capitalize transition-colors",
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

              <section>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Changes
                    <span className="normal-case text-foreground/60"> — every row carries its own note</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={addChange} type="button">
                    <Plus className="h-3.5 w-3.5" />
                    Add row
                  </Button>
                </div>
                <div className="mt-2 space-y-2.5">
                  {changes.map((row, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[110px_1fr_1fr_1fr_auto] items-end gap-2 rounded-lg border border-border bg-muted/20 p-2"
                    >
                      <div className="min-w-0 space-y-1">
                        <button
                          type="button"
                          onClick={() => removeChange(i)}
                          className="ml-auto flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </button>
                        <select
                          value={row.property}
                          onChange={(e) =>
                            setChanges((rows) =>
                              rows.map((r, idx) =>
                                idx === i
                                  ? {
                                      ...r,
                                      property: e.target.value,
                                      current: currentFor(e.target.value, target),
                                    }
                                  : r
                              )
                            )
                          }
                          aria-label={`Change ${i + 1} property`}
                          className="h-8 w-full rounded-md border border-border bg-background px-1.5 font-mono text-xs outline-none focus:border-cyan-400/60"
                        >
                          {CHANGE_PROPERTIES.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current</div>
                        <Input
                          value={row.current}
                          readOnly
                          tabIndex={-1}
                          className="h-8 bg-transparent font-mono text-xs text-foreground/70"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Desired</div>
                        {(() => {
                          const control = controlFor(row.property, kind);
                          if (control === "color")
                            return (
                              <ColorCell
                                i={i}
                                desired={row.desired}
                                onChange={(v) => updateChange(i, { desired: v })}
                              />
                            );
                          if (control === "number")
                            return (
                              <NumberCell
                                i={i}
                                property={row.property}
                                desired={row.desired}
                                onChange={(v) => updateChange(i, { desired: v })}
                              />
                            );
                          if (control === "select")
                            return (
                              <SelectCell
                                i={i}
                                desired={row.desired}
                                options={CONTROL_REGISTRY[row.property]?.options ?? []}
                                onChange={(v) => updateChange(i, { desired: v })}
                              />
                            );
                          if (control === "toggle_show")
                            return (
                              <ToggleShowCell
                                i={i}
                                desired={row.desired}
                                onChange={(v) => updateChange(i, { desired: v })}
                              />
                            );
                          return (
                            <Input
                              value={row.desired}
                              onChange={(e) => updateChange(i, { desired: e.target.value })}
                              placeholder="e.g. 24px"
                              className="h-8 font-mono text-xs"
                              aria-label={`Change ${i + 1} desired`}
                            />
                          );
                        })()}
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Note</div>
                        <Input
                          value={row.note}
                          onChange={(e) => updateChange(i, { note: e.target.value })}
                          placeholder="why / what it should look like"
                          className="h-8 text-xs"
                          aria-label={`Change ${i + 1} note`}
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground/70">{i + 1}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Data <span className="normal-case">— optional</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground/80">
                  If this change is scoped to a record, point the implementer at it.
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Model</div>
                    <select
                      value={dataContext.model}
                      onChange={(e) => setDataContext((d) => ({ ...d, model: e.target.value }))}
                      aria-label="Data model"
                      className="h-8 w-full rounded-md border border-border bg-background px-1.5 text-xs outline-none focus:border-cyan-400/60"
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
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Endpoint</div>
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
                      className="h-8 w-full rounded-md border border-border bg-background px-1.5 text-xs outline-none focus:border-cyan-400/60"
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
                        <span className="text-[10px] text-muted-foreground">/api/</span>
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
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Record id</div>
                    <Input
                      value={dataContext.recordId}
                      onChange={(e) => setDataContext((d) => ({ ...d, recordId: e.target.value }))}
                      placeholder="e.g. cmt... or agent slug"
                      className="h-8 font-mono text-xs"
                      aria-label="Data record id"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Data note</div>
                    <Input
                      value={dataContext.note}
                      onChange={(e) => setDataContext((d) => ({ ...d, note: e.target.value }))}
                      placeholder="which row this targets, in plain words"
                      className="h-8 text-xs"
                      aria-label="Data note"
                    />
                  </div>
                </div>
              </section>

              <section>
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Scope
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SCOPE_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setScope(s.id)}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        scope === s.id
                          ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={applyToSiblings}
                    onChange={(e) => setApplyToSiblings(e.target.checked)}
                    className="h-3.5 w-3.5 accent-cyan-400"
                    aria-label="Also apply to siblings matching this selector"
                  />
                  Also apply to siblings matching this selector
                </label>
              </section>

              <section>
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Templates
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      title={`Start from “${t.label}” — fills kind, change rows and intent`}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground/80">
                  One click fills the kind, a change row or two and a draft intent — edit anything afterwards.
                </p>
              </section>

              <section>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Intent
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="ticket-priority" className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Priority
                    </label>
                    <select
                      id="ticket-priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as TicketPriority)}
                      aria-label="Ticket priority"
                      className="h-8 w-24 rounded-md border border-border bg-background px-1.5 text-xs outline-none focus:border-cyan-400/60"
                    >
                      {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <Button variant="ghost" size="sm" type="button" onClick={draftIntent} title="Compose the intent from the change rows above">
                      <Sparkles className="h-3.5 w-3.5" />
                      Draft from changes
                    </Button>
                    <Button variant="ghost" size="sm" type="button" onClick={discardDraft} title="Clear the saved draft for this page">
                      <Trash2 className="h-3.5 w-3.5" />
                      Discard draft
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  placeholder="Describe the exact change in plain words — the ticket carries everything above verbatim. Broad scopes are first-class: say what should happen beyond this element."
                  className="mt-2 min-h-[104px] resize-y text-sm"
                />
              </section>

              {shapes.length > 0 && (
                <section>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Annotations
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: shapes[shapes.length - 1].color }} />
                      {shapes.length} shape{shapes.length > 1 ? "s" : ""} attached to this ticket
                    </span>
                    <span className="text-[10px] uppercase tracking-wider">
                      {shapes.map((s) => s.type).join(" · ")}
                    </span>
                  </div>
                </section>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant={previewActive ? "secondary" : "outline"}
                  size="sm"
                  onClick={togglePreview}
                  aria-pressed={previewActive}
                  title="Apply the desired Changes to the live element so you can see the result before filing"
                >
                  {previewActive ? <Check className="h-4 w-4 text-success" /> : <Eye className="h-4 w-4" />}
                  {previewActive ? "Previewing" : "Preview"}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={copyPrompt}>
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy implementer prompt"}
                </Button>
                <Button size="sm" onClick={fileTicket} disabled={!readyToFile}>
                  {submitting ? "Filing…" : "File ticket"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}