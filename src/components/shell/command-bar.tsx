"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle, TriangleAlert } from "lucide-react";
import { NAV_DOMAINS, childIcon, type IconComponent } from "@/lib/navigation";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

const PAGES = (() => {
  const seen = new Map<string, { label: string; href: string; Icon?: IconComponent }>();
  for (const d of NAV_DOMAINS) {
    for (const c of d.children) {
      if (!seen.has(c.href)) {
        seen.set(c.href, { label: c.label, href: c.href, Icon: childIcon(c.href) });
      }
    }
  }
  return [...seen.values()];
})();

/* The chat API reports failures in two shapes: a plain string from the
   conversation routes, and `{ message, code, provider, noKey }` from the
   message route. Prisma wraps its real message in a multi-line dump headed by
   an "Invalid `prisma.…` invocation" line, so drop that header and keep the
   first line a person can act on. */
function errorText(err: unknown, fallback: string): string {
  const raw =
    typeof err === "string"
      ? err
      : err &&
          typeof err === "object" &&
          typeof (err as { message?: unknown }).message === "string"
        ? (err as { message: string }).message
        : "";
  const line = raw
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s && !/^(prisma:|Invalid `prisma\.)/i.test(s))
    .find(Boolean);
  if (!line) return fallback;
  return line.length > 140 ? `${line.slice(0, 140)}…` : line;
}

export function CommandBar() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  /* cmdk reorders items by match score, so the "Ask AI Chat" row is pinned with
     a value equal to the query (an exact match scores 1.0, the highest
     possible). Driving the selection with that same value is what makes Enter
     hit the Ask row instead of whichever page happened to be selected. */
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isMac, setIsMac] = useState(false);

  const q = query.trim();

  // Platform for the shortcut chip, detected after mount (no hydration mismatch).
  useEffect(() => {
    setMounted(true);
    const plat = navigator.platform || navigator.userAgent || "";
    setIsMac(/mac|iphone|ipad|ipod|darwin/i.test(plat));
  }, []);

  const go = (href: string) => {
    setQuery("");
    setSelected("");
    setOpen(false);
    inputRef.current?.blur();
    router.push(href);
  };

  /* Start a chat with the typed goal. Both calls are awaited before navigating:
     /chat reads its thread once through SWR with no polling, so leaving early
     would land the user on an empty conversation. */
  async function askChat() {
    const content = q;
    if (!content || asking) return;
    setAsking(true);
    setAskError(null);
    try {
      const created = (await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: content.length > 48 ? content.slice(0, 48) + "…" : content,
        }),
      }).then((r) => r.json())) as { conversation?: { id?: string }; error?: unknown };
      const id = created?.conversation?.id;
      if (!id) throw new Error(errorText(created?.error, "Chat failed to start"));

      const sent = (await fetch(`/api/chat/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }).then((r) => r.json())) as { error?: unknown };
      if (sent?.error) throw new Error(errorText(sent.error, "Chat failed to start"));

      go(`/chat?c=${id}`);
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "Chat failed to start");
    } finally {
      setAsking(false);
    }
  }

  // Ctrl/Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  // Click outside closes.
  useEffect(() => {
    if (!open) return;
    const out = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", out);
    return () => document.removeEventListener("pointerdown", out);
  }, [open]);

  return (
    <div ref={rootRef} className="relative mx-auto w-full max-w-md">
      <Command
        loop
        value={selected}
        onValueChange={setSelected}
        className="flex h-9 w-full flex-row items-center rounded-full border glass-recessed px-3 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background [&_[cmdk-input-wrapper]]:border-none [&_[cmdk-input-wrapper]]:px-0 [&_[cmdk-input-wrapper]]:flex-1 [&_[cmdk-input-wrapper]_svg]:opacity-60"
      >
        <CommandInput
          ref={inputRef}
          value={query}
          onValueChange={(v) => {
            setQuery(v);
            setSelected(v.trim());
            setAskError(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder="Search pages, or ask AI…"
          aria-label="Search pages or ask AI"
        />
        <CommandShortcut
          aria-hidden
          className="ml-2 hidden shrink-0 items-center rounded-md border glass-control px-1.5 py-0.5 font-mono text-[11px] tracking-normal text-muted-foreground sm:inline-flex"
        >
          {mounted ? (isMac ? "⌘K" : "Ctrl K") : ""}
        </CommandShortcut>
        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-lg border glass-elevated p-1">
            <CommandList className="max-h-[min(20rem,50vh)]">
              {q ? (
                <CommandItem
                  value={q}
                  onSelect={() => askChat()}
                  className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md border glass-control">
                    {asking ? (
                      <Loader2 className="size-3 animate-spin text-muted-foreground" aria-hidden />
                    ) : askError ? (
                      <TriangleAlert className="size-3 text-destructive" aria-hidden />
                    ) : (
                      <MessageCircle className="size-3 text-muted-foreground" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {askError ? (
                      askError
                    ) : (
                      <>
                        Ask AI Chat: <span className="text-muted-foreground">{q}</span>
                      </>
                    )}
                  </span>
                  {asking ? (
                    <CommandShortcut>Asking…</CommandShortcut>
                  ) : askError ? (
                    <CommandShortcut>Try again</CommandShortcut>
                  ) : null}
                </CommandItem>
              ) : null}
              <CommandEmpty>No pages found</CommandEmpty>
              {PAGES.map((p) => (
                <CommandItem
                  key={p.href}
                  value={p.label}
                  onSelect={() => go(p.href)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm"
                >
                  {p.Icon && (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md border glass-control">
                      <p.Icon className="size-3 text-muted-foreground" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{p.label}</span>
                </CommandItem>
              ))}
            </CommandList>
          </div>
        )}
      </Command>
    </div>
  );
}
