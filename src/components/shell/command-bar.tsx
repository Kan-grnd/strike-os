"use client";

import { Input } from "@/components/ui/input";
import { StrikeMark } from "@/components/ui/logo";

export function CommandBar() {
  return (
    <div className="mx-auto max-w-xl flex-1 px-4">
      <div className="relative hidden md:block">
        <Input
          placeholder="What would you like Strike OS to do?…"
          className="h-10 rounded-full pl-5 pr-11 text-sm shadow-[0_0_2px_hsl(var(--foreground)/0.12),0_0_20px_-8px_hsl(var(--foreground)/0.18)] transition-shadow focus-within:shadow-[0_0_3px_hsl(var(--foreground)/0.2),0_0_26px_-6px_hsl(var(--foreground)/0.28)]"
        />
        <button
          type="button"
          aria-label="Run command"
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-transparent text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <StrikeMark className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        aria-label="Run command"
        className="md:hidden mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <StrikeMark className="h-4 w-4" />
      </button>
    </div>
  );
}