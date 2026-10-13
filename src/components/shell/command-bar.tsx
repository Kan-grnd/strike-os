"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NAV_DOMAINS, childIcon, type IconComponent } from "@/lib/navigation";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

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

export function CommandBar() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMac, setIsMac] = useState(false);

  // Platform for the shortcut chip, detected after mount (no hydration mismatch).
  useEffect(() => {
    setMounted(true);
    const plat = navigator.platform || navigator.userAgent || "";
    setIsMac(/mac|iphone|ipad|ipod|darwin/i.test(plat));
  }, []);

  const go = (href: string) => {
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    router.push(href);
  };

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
        className="flex h-9 w-full flex-row items-center rounded-full border glass-recessed px-3 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background [&_[cmdk-input-wrapper]]:border-none [&_[cmdk-input-wrapper]]:px-0 [&_[cmdk-input-wrapper]]:flex-1 [&_[cmdk-input-wrapper]_svg]:opacity-60"
      >
        <CommandInput
          ref={inputRef}
          value={query}
          onValueChange={setQuery}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder="Search pages…"
          aria-label="Search pages"
        />
        <span
          aria-hidden
          className="ml-2 hidden shrink-0 items-center rounded-md border glass-control px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground sm:inline-flex"
        >
          {mounted ? (isMac ? "⌘K" : "Ctrl K") : ""}
        </span>
        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-lg border glass-elevated p-1">
            <CommandList className="max-h-[min(20rem,50vh)]">
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
