"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Inbox,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { buildImplementerPrompt, type EditTicketRow } from "@/lib/edit-tickets";

const KIND_STYLE: Record<string, { label: string; className: string }> = {
  TEXT: { label: "Text", className: "bg-cyan-400/10 text-cyan-300 border-cyan-400/30" },
  COLOR: { label: "Color", className: "bg-fuchsia-400/10 text-fuchsia-300 border-fuchsia-400/30" },
  SPACING: { label: "Spacing", className: "bg-amber-400/10 text-amber-300 border-amber-400/30" },
  SIZE: { label: "Size", className: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30" },
  HIDE_SHOW: { label: "Hide/Show", className: "bg-slate-400/10 text-slate-300 border-slate-400/30" },
  MOVE: { label: "Move", className: "bg-orange-400/10 text-orange-300 border-orange-400/30" },
  BEHAVIOR: { label: "Behavior", className: "bg-blue-400/10 text-blue-300 border-blue-400/30" },
  OTHER: { label: "Other", className: "bg-muted text-muted-foreground border-border" },
};

const PRIORITY_STYLE: Record<string, { label: string; className: string }> = {
  HIGH: { label: "High", className: "bg-red-400/10 text-red-300 border-red-400/30" },
  MEDIUM: { label: "Medium", className: "bg-amber-400/10 text-amber-300 border-amber-400/30" },
  LOW: { label: "Low", className: "bg-muted text-muted-foreground border-border" },
};

const PRIORITY_ORDER = ["HIGH", "MEDIUM", "LOW"];

function parseStyles(row: EditTicketRow) {
  try {
    const parsed = JSON.parse(row.currentStyles || "{}") as {
      tweak?: Record<string, string>;
      label?: string;
      viewport?: string;
    };
    return parsed;
  } catch {
    return {};
  }
}

function parseChanges(row: EditTicketRow) {
  if (!row.changes) return [];
  try {
    const parsed = JSON.parse(row.changes);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseDataContext(row: EditTicketRow) {
  if (!row.dataContext) return null;
  try {
    const parsed = JSON.parse(row.dataContext);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

export default function EditQueuePage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<EditTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/edit-tickets");
      const json = await res.json();
      setTickets(json.tickets ?? []);
    } catch {
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markDone = async (id: string) => {
    const res = await fetch(`/api/edit-tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DONE" }),
    });
    const json = await res.json();
    if (!res.ok) return toast.error(json?.error ?? "Failed to update");
    setTickets((rows) =>
      rows.map((r) => (r.id === id ? { ...r, status: "DONE" } : r))
    );
    toast.success("Marked done");
  };

  const reopen = async (id: string) => {
    const res = await fetch(`/api/edit-tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "OPEN" }),
    });
    const json = await res.json();
    if (!res.ok) return toast.error(json?.error ?? "Failed to update");
    setTickets((rows) =>
      rows.map((r) => (r.id === id ? { ...r, status: "OPEN" } : r))
    );
    toast.success("Reopened");
  };

  const copy = async (row: EditTicketRow) => {
    try {
      await navigator.clipboard.writeText(buildImplementerPrompt(row));
      setCopiedId(row.id);
      setTimeout(() => setCopiedId(null), 1600);
      toast.success("Implementer prompt copied");
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const filtered = tickets.filter(
    (t) =>
      (!kindFilter || t.tweakKind === kindFilter) &&
      (!priorityFilter || (t.priority || "MEDIUM") === priorityFilter)
  );
  const open = filtered.filter((t) => t.status === "OPEN");
  const done = filtered.filter((t) => t.status === "DONE");

  const TicketRow = ({ t }: { t: EditTicketRow }) => {
    const styles = parseStyles(t);
    const tweakEntries = Object.entries(styles.tweak ?? {});
    const changes = parseChanges(t);
    const dataContext = parseDataContext(t);
    const kindStyle = KIND_STYLE[t.tweakKind] ?? KIND_STYLE.OTHER;
    const priority = t.priority || "MEDIUM";
    const priorityStyle = PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.MEDIUM;
    return (
      <div className="rounded-lg border border-border bg-background p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`border ${kindStyle.className}`}>{kindStyle.label}</Badge>
              <Badge className={`border ${priorityStyle.className}`}>{priorityStyle.label}</Badge>
              <Badge variant="outline">{t.scope}</Badge>
              {styles.label && (
                <span className="text-sm font-medium text-foreground">“{styles.label}”</span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {t.thumbnail ? (
                <>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Thumbnail</span>
                  <img
                    src={t.thumbnail}
                    alt="Ticket target and annotations"
                    className="h-24 w-36 rounded border border-border object-contain bg-background"
                  />
                </>
              ) : (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  No thumbnail
                </span>
              )}
            </div>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {new Date(t.createdAt).toLocaleString()}
          </span>
        </div>

        <div className="mt-2 space-y-1 text-xs">
          <div>
            <span className="text-muted-foreground">Route </span>
            <span className="font-mono text-cyan-400">{t.route}</span>
          </div>
          <div className="truncate">
            <span className="text-muted-foreground">Selector </span>
            <span className="font-mono text-foreground/80">{t.selectorPath}</span>
          </div>
          {tweakEntries.length > 0 && (
            <div>
              <span className="text-muted-foreground">Current </span>
              <span className="font-mono text-foreground/80">
                {tweakEntries.map(([k, v]) => `${k}: ${v}`).join(" · ")}
              </span>
            </div>
          )}
          {styles.viewport && (
            <div>
              <span className="text-muted-foreground">Viewport </span>
              <span className="font-mono text-foreground/60">{styles.viewport}</span>
            </div>
          )}
          {dataContext && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {dataContext.model && (
                <div>
                  <span className="text-muted-foreground">Model </span>
                  <span className="font-mono text-foreground/90">{dataContext.model}</span>
                </div>
              )}
              {dataContext.endpoint && (
                <div>
                  <span className="text-muted-foreground">Endpoint </span>
                  <span className="font-mono text-cyan-400">{dataContext.endpoint}</span>
                </div>
              )}
              {dataContext.recordId && (
                <div>
                  <span className="text-muted-foreground">Record </span>
                  <span className="font-mono text-foreground/90">{dataContext.recordId}</span>
                </div>
              )}
              {dataContext.note && (
                <div>
                  <span className="text-muted-foreground">Data note </span>
                  <span className="text-foreground/70">{dataContext.note}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {changes.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-md border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-1.5 font-medium">Property</th>
                    <th className="px-3 py-1.5 font-medium">Before</th>
                    <th className="px-3 py-1.5 font-medium">After</th>
                    <th className="px-3 py-1.5 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((c, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-1 font-mono text-foreground/80">{c.property}</td>
                      <td className="px-3 py-1 font-mono text-foreground/60">{c.current}</td>
                      <td className="px-3 py-1 font-mono text-cyan-300">{c.desired}</td>
                      <td className="px-3 py-1 text-foreground/70">{c.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        <div className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-foreground/90">
          {t.intent}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => copy(t)}>
            {copiedId === t.id ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copiedId === t.id ? "Copied" : "Copy implementer prompt"}
          </Button>
          {t.status === "OPEN" ? (
            <Button variant="secondary" size="sm" onClick={() => markDone(t.id)}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark done
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => reopen(t.id)}>
              Reopen
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Edit queue</h2>
          <p className="text-sm text-muted-foreground">
            Tickets grabbed directly from the live UI — exact selectors, live styles, verbatim intents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading tickets…
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No tickets yet"
          description="Flip edit mode on in the header, click any element, and file your first ticket."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Kind</span>
            <button
              type="button"
              onClick={() => setKindFilter(null)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs",
                kindFilter === null ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>
            {Object.keys(KIND_STYLE).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKindFilter(kindFilter === k ? null : k)}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-xs",
                  kindFilter === k ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300" : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {KIND_STYLE[k].label}
              </button>
            ))}
            <span className="mr-1 text-[11px] uppercase tracking-wider text-muted-foreground">Priority</span>
            {PRIORITY_ORDER.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriorityFilter(priorityFilter === p ? null : p)}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-xs",
                  priorityFilter === p ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300" : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {PRIORITY_STYLE[p].label}
              </button>
            ))}
          </div>
          {open.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Open ({open.length})
              </h3>
              {open.map((t) => (
                <TicketRow key={t.id} t={t} />
              ))}
            </section>
          )}
          {done.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Done ({done.length})
              </h3>
              {done.map((t) => (
                <TicketRow key={t.id} t={t} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}