"use client";

import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, SectionLabel, EASE } from "@/components/shared/page-header";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  Bot,
  Check,
  Database,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Target,
  Timer,
  X,
} from "lucide-react";
import {
  cn,
  formatDate,
  formatRelativeTime,
  pluralize,
} from "@/lib/utils";
import {
  categoryLabel,
  MAX_CATEGORIES,
  MEMORY_CATEGORY_SUGGESTIONS,
  normalizeCategory,
  parseCategories,
} from "@/lib/memory-categories";

/**
 * Deliberately strict: a bare `res.json()` fulfils on a 500 and hands SWR a body
 * it happily treats as data, so a failed request would render as an empty list
 * and the error state would be unreachable. Throwing is what makes the failure
 * real enough to show — and to retry.
 */
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(
      detail?.error ? `${detail.error} (${res.status})` : `Request failed (${res.status})`
    );
  }
  return res.json();
};

/** Mirrors the scopes the API and schema accept. */
const SCOPES = ["GLOBAL", "USER", "MISSION", "AGENT", "TOOL", "TEMP"];

interface MemoryRow {
  id: string;
  content?: string | null;
  source?: string | null;
  scope?: string | null;
  /** JSON text from the database; older rows may arrive as an array or null. */
  categories?: string | string[] | null;
  importance?: number | null;
  confidence?: number | null;
  expiresAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  agentId?: string | null;
  missionId?: string | null;
  colonyId?: string | null;
}

const scopeLabel = (scope?: string | null) =>
  !scope ? "Unscoped" : scope.charAt(0) + scope.slice(1).toLowerCase();

/** Keeps a long memory from pushing the row's metadata out of view, while the
 *  drawer still shows all of it. */
const previewOf = (content: string, limit = 140) =>
  content.length > limit ? `${content.slice(0, limit).trimEnd()}…` : content;

/** Always yields at least one slug, so a card never renders as untagged. */
const categoriesOf = (m: MemoryRow) => parseCategories(m.categories);

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <div className="bg-background p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

export default function MemoryPage() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("");
  const [category, setCategory] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/memory${scope ? `?scope=${scope}` : ""}`,
    fetcher
  );

  const all = useMemo(
    () => ((data?.memories ?? []) as MemoryRow[]),
    [data]
  );

  /* Text search stays client-side on purpose: it matches content *and* source,
     which the API's `q` does not, and it keeps a keystroke from becoming a
     request while the user is still typing. Categories are matched here too so
     typing a category name finds it without a round trip. */
  const term = query.trim().toLowerCase();
  const wantedCategory = category.trim().toLowerCase();
  const visible = useMemo(() => {
    return all.filter((m) => {
      if (wantedCategory && !categoriesOf(m).includes(wantedCategory)) return false;
      if (!term) return true;
      return (
        (m.content ?? "").toLowerCase().includes(term) ||
        (m.source ?? "").toLowerCase().includes(term) ||
        categoriesOf(m).some((c) => c.includes(term))
      );
    });
  }, [all, term, wantedCategory]);

  /* Offered options come from the loaded data as well as the seed list, so a
     custom category typed by hand becomes selectable without a reload. */
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const m of all) for (const c of categoriesOf(m)) set.add(c);
    return Array.from(set).sort();
  }, [all]);

  const selected = openId ? all.find((m) => m.id === openId) ?? null : null;
  const hasFilters = term.length > 0 || scope.length > 0 || wantedCategory.length > 0;

  const resetFilters = () => {
    setQuery("");
    setScope("");
    setCategory("");
  };

  const clearScope = () => setScope("");
  const clearQuery = () => setQuery("");
  const clearCategory = () => setCategory("");

  const firstLoad = isLoading && all.length === 0 && !error;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        backHref="/"
        icon={Database}
        eyebrow="Intelligence"
        title="Memory"
        description="Shared context the workforce can reuse later."
        actions={
          <Button className="shrink-0 gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Add memory
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
        <Stat icon={Database} label="Total" value={all.length} />
        <Stat
          icon={Bot}
          label="Scopes in use"
          value={new Set(all.map((m) => m.scope || "Unscoped")).size}
        />
        <Stat icon={Tag} label="Categories" value={categoryOptions.length} />
        <Stat
          icon={Timer}
          label="Expiring"
          value={all.filter((m) => m.expiresAt).length}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Label htmlFor="memory-search" className="sr-only">
            Search memories
          </Label>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input
            id="memory-search"
            placeholder="Search content or source…"
            className="pl-9 pr-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={clearQuery}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={scope || "all"}
            onValueChange={(v) => setScope(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[150px]" aria-label="Filter by scope">
              <SelectValue placeholder="Scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All scopes</SelectItem>
              {SCOPES.map((s) => (
                <SelectItem key={s} value={s}>
                  {scopeLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={category || "all"}
            onValueChange={(v) => setCategory(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[190px]" aria-label="Filter by category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categoryOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5">
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>

        <p
          aria-live="polite"
          className="text-xs text-muted-foreground sm:ml-auto"
        >
          {firstLoad
            ? "Loading…"
            : term || wantedCategory
            ? `${visible.length} of ${all.length} ${pluralize(all.length, "memory", "memories")}`
            : `${all.length} ${pluralize(all.length, "memory", "memories")}${scope ? ` · ${scopeLabel(scope)}` : ""}${wantedCategory ? ` · ${categoryLabel(wantedCategory)}` : ""}`}
        </p>
      </div>

      {firstLoad ? (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <li key={i}>
              <Card className="animate-pulse p-5">
                <div className="mb-3 h-9 w-9 rounded-xl bg-muted" />
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="mt-3 h-3 w-1/3 rounded bg-muted" />
              </Card>
            </li>
          ))}
        </ul>
      ) : error ? (
        <EmptyState
          icon={AlertCircle}
          title="Could not load memories"
          description={`${
            error instanceof Error && error.message
              ? error.message
              : "The memory service did not respond"
          }. Nothing was changed — retry when you are ready.`}
          action={
            <Button variant="outline" className="gap-2" onClick={() => mutate()}>
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          }
        />
      ) : all.length === 0 ? (
        <EmptyState
          icon={Database}
          title={scope ? `No ${scopeLabel(scope).toLowerCase()} memories` : "No memories yet"}
          description={
            scope
              ? "Nothing has been written to this scope. Clear the scope filter to see everything that has been."
              : "Memories written by agents, automations, or you will collect here."
          }
          action={
            scope ? (
              <Button variant="outline" onClick={clearScope}>
                Show all scopes
              </Button>
            ) : (
              <Button className="gap-2" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" /> Add Memory
              </Button>
            )
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description={
            term
              ? `Nothing matches "${previewOf(query, 60)}" in ${
                  scope ? `${scopeLabel(scope).toLowerCase()} ` : ""
                }${wantedCategory ? `${categoryLabel(wantedCategory).toLowerCase()} ` : ""}memories.`
              : `No ${categoryLabel(wantedCategory).toLowerCase()} memories in ${
                  scope ? `${scopeLabel(scope).toLowerCase()} ` : ""
                }memories.`
          }
          action={
            <Button variant="outline" onClick={resetFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          <SectionLabel>Memories · {visible.length}</SectionLabel>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((m, i) => {
              const content = m.content ?? "";
              const cats = categoriesOf(m);
              /* The accessible name is bounded so a long memory does not become
                 a screen-reader paragraph, and falls back to the same degradation
                 the card shows rather than an empty name. */
              const spoken = content.trim() || "no content recorded";
              return (
                <motion.li
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.4), ease: EASE }}
                >
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-label={`Open memory: ${previewOf(spoken, 80)}`}
                    onClick={() => setOpenId(m.id)}
                    className="group block h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Card className="flex h-full flex-col p-5 transition-colors group-hover:border-ring/40">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="rounded-xl bg-muted p-2">
                          <Database className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {scopeLabel(m.scope)}
                        </Badge>
                      </div>

                      <p
                        className={cn(
                          "mb-2 line-clamp-3 text-sm font-medium leading-relaxed text-foreground",
                          !content.trim() && "text-muted-foreground"
                        )}
                      >
                        {previewOf(content.trim()) || "No content recorded"}
                      </p>

                      <ul className="mb-3 flex flex-wrap gap-1.5">
                        {cats.slice(0, 3).map((c) => (
                          <li key={c}>
                            <CategoryChip slug={c} />
                          </li>
                        ))}
                        {/* The full list stays reachable in the drawer, so the
                            overflow marker is a summary rather than the only way
                            to see the rest. */}
                        {cats.length > 3 && (
                          <li>
                            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                              +{cats.length - 3}
                            </span>
                          </li>
                        )}
                      </ul>

                      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="truncate">
                          {m.source ? `From ${m.source}` : "No source recorded"}
                        </span>
                        {m.createdAt && (
                          <time dateTime={m.createdAt}>
                            {formatRelativeTime(m.createdAt)}
                          </time>
                        )}
                      </div>
                    </Card>
                  </button>
                </motion.li>
              );
            })}
          </ul>
        </div>
      )}

      <MemoryDetail memory={selected} onClose={() => setOpenId(null)} />

      <CreateMemoryDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={async () => {
          /* A new memory has to be visible to count as saved, so drop any
             filter that would hide it rather than reporting a success the
             user cannot see. */
          resetFilters();
          await mutate();
          toast.success("Memory added");
        }}
      />
    </div>
  );
}

function CategoryChip({ slug }: { slug: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      <Tag className="h-3 w-3" aria-hidden="true" />
      {categoryLabel(slug)}
    </span>
  );
}

function MemoryDetail({
  memory,
  onClose,
}: {
  memory: MemoryRow | null;
  onClose: () => void;
}) {
  const expired =
    !!memory?.expiresAt && new Date(memory.expiresAt).getTime() < Date.now();

  return (
    <Drawer open={!!memory} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="w-full max-w-md sm:max-w-md">
        <DrawerHeader className="gap-1.5">
          <DrawerTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" /> Memory
          </DrawerTitle>
          {memory && (
            <DrawerDescription>
              {scopeLabel(memory.scope)}
              {memory.source ? ` · ${memory.source}` : ""}
              {memory.createdAt ? ` · ${formatDate(memory.createdAt)}` : ""}
            </DrawerDescription>
          )}
        </DrawerHeader>

        {memory && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 pb-6">
            <ScrollArea className="min-h-0 flex-1">
              <p
                className={cn(
                  "whitespace-pre-wrap break-words pr-3 text-sm leading-relaxed",
                  !(memory.content ?? "").trim() && "text-muted-foreground"
                )}
              >
                {memory.content?.trim() || "No content recorded"}
              </p>
            </ScrollArea>

            <dl className="grid gap-3 border-t pt-4 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Scope</dt>
                <dd>
                  <Badge variant="outline">{scopeLabel(memory.scope)}</Badge>
                </dd>
              </div>

              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Tag className="h-3.5 w-3.5" /> Categories
                </dt>
                <dd className="flex min-w-0 flex-wrap justify-end gap-1.5">
                  {categoriesOf(memory).map((c) => (
                    <CategoryChip key={c} slug={c} />
                  ))}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Source</dt>
                <dd className="min-w-0 truncate font-mono">
                  {memory.source || "—"}
                </dd>
              </div>

              {memory.createdAt && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Recorded</dt>
                  <dd>
                    <time dateTime={memory.createdAt}>
                      {formatDate(memory.createdAt)}
                    </time>
                  </dd>
                </div>
              )}

              {memory.expiresAt && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <Timer className="h-3.5 w-3.5" /> Expires
                  </dt>
                  <dd>
                    {expired ? (
                      <Badge variant="warning">
                        Expired {formatDate(memory.expiresAt)}
                      </Badge>
                    ) : (
                      <time dateTime={memory.expiresAt}>
                        {formatDate(memory.expiresAt)}
                      </time>
                    )}
                  </dd>
                </div>
              )}

              {memory.agentId && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <Bot className="h-3.5 w-3.5" /> Agent
                  </dt>
                  <dd className="min-w-0 truncate">
                    <Link
                      href={`/agents/${memory.agentId}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      View agent
                    </Link>
                  </dd>
                </div>
              )}

              {memory.missionId && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <Target className="h-3.5 w-3.5" /> Mission
                  </dt>
                  <dd className="min-w-0 truncate">
                    <Link
                      href={`/missions/${memory.missionId}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      View mission
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function CreateMemoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void | Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [scope, setScope] = useState("GLOBAL");
  const [source, setSource] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldError, setFieldError] = useState("");

  /* Categories are the one required field the user can quietly skip, so the
     error is tracked per-field: content and categories must both be
     satisfied before the save button is worth pressing. */
  const [categoryError, setCategoryError] = useState("");

  const toggleCategory = (slug: string) => {
    if (categories.includes(slug)) {
      setCategories(categories.filter((c) => c !== slug));
      if (categoryError) setCategoryError("");
      return;
    }
    /* The cap has to hold for suggestions as well as typed entries, or a
       handful of taps quietly exceeds what the API will accept. */
    if (categories.length >= MAX_CATEGORIES) {
      setCategoryError(`Use at most ${MAX_CATEGORIES} categories.`);
      return;
    }
    setCategories([...categories, slug]);
    if (categoryError) setCategoryError("");
  };

  const addCustomCategory = () => {
    const slug = normalizeCategory(custom);
    if (!slug) {
      setCategoryError("Use letters, numbers, or dashes.");
      return;
    }
    if (categories.includes(slug)) {
      setCustom("");
      return;
    }
    if (categories.length >= MAX_CATEGORIES) {
      setCategoryError(`Use at most ${MAX_CATEGORIES} categories.`);
      return;
    }
    setCategories((prev) => [...prev, slug]);
    setCustom("");
    setCategoryError("");
  };

  /* `saving` state is not enough to stop a second save: it is only read at
     render time, so two submits dispatched before React re-renders both see
     `false` and both post. The ref is written synchronously, so it is the
     authoritative in-flight guard; `saving` stays for rendering. */
  const inFlight = useRef(false);

  const close = (next: boolean) => {
    if (inFlight.current) return;
    onOpenChange(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) {
      setFieldError("Write something before saving.");
      return;
    }
    if (categories.length === 0) {
      setCategoryError("Pick at least one category.");
      return;
    }
    if (inFlight.current) return;

    inFlight.current = true;
    setFieldError("");
    setCategoryError("");
    setFormError("");
    setSaving(true);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed,
          scope,
          source: source.trim() || "manual",
          categories,
        }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      await onCreated();
      setContent("");
      setSource("");
      setScope("GLOBAL");
      setCategories([]);
      setCustom("");
      onOpenChange(false);
    } catch (err) {
      /* Keep the dialog open with the draft intact: closing here would throw
         away what the user typed for a request that never landed. */
      setFormError(
        err instanceof Error && err.message
          ? `${err.message}. Your memory was not saved.`
          : "Your memory was not saved. Check the connection and try again."
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Memory</DialogTitle>
          <DialogDescription>
            Store context the workforce can reuse later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} aria-busy={saving} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="memory-content">Memory</Label>
            <Textarea
              id="memory-content"
              autoFocus
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (fieldError) setFieldError("");
              }}
              aria-invalid={!!fieldError}
              aria-describedby={fieldError ? "memory-content-error" : undefined}
              placeholder="What should be remembered?"
            />
            {fieldError && (
              <p
                id="memory-content-error"
                className="flex items-center gap-1.5 text-xs text-destructive"
              >
                <AlertCircle className="h-3.5 w-3.5" /> {fieldError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="memory-new-categories">Categories</Label>

            {/* Suggestion chips are the fast path; the text field is the escape
                hatch for anything not on the list. */}
            <div className="flex flex-wrap gap-1.5">
              {MEMORY_CATEGORY_SUGGESTIONS.map((s) => {
                const on = categories.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleCategory(s)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {on && <Check className="h-3 w-3" aria-hidden="true" />}
                    {categoryLabel(s)}
                  </button>
                );
              })}
            </div>

            {categories.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <li key={c}>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
                      {categoryLabel(c)}
                      <button
                        type="button"
                        aria-label={`Remove category ${categoryLabel(c)}`}
                        onClick={() => toggleCategory(c)}
                        className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <Input
                id="memory-new-categories"
                value={custom}
                onChange={(e) => {
                  setCustom(e.target.value);
                  if (categoryError) setCategoryError("");
                }}
                onKeyDown={(e) => {
                  /* Enter and comma both commit, so the field behaves like the
                     tag inputs people already know from elsewhere. Comma is
                     swallowed rather than inserted to avoid a stray character. */
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addCustomCategory();
                  }
                }}
                onBlur={addCustomCategory}
                placeholder="Add your own..."
                aria-invalid={!!categoryError}
                aria-describedby={
                  categoryError ? "memory-new-categories-error" : undefined
                }
              />
              <Button
                type="button"
                variant="outline"
                onClick={addCustomCategory}
                disabled={!custom.trim()}
              >
                Add
              </Button>
            </div>

            {categoryError && (
              <p
                id="memory-new-categories-error"
                className="flex items-center gap-1.5 text-xs text-destructive"
              >
                <AlertCircle className="h-3.5 w-3.5" /> {categoryError}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="memory-new-scope">Scope</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger id="memory-new-scope" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {scopeLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="memory-source">Source</Label>
              <Input
                id="memory-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="manual"
              />
            </div>
          </div>

          {formError && (
            <p
              role="alert"
              className="flex items-start gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive"
            >
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" /> {formError}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save memory"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}