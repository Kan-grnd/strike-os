"use client";

import { Input } from "@/components/ui/input";
import { StrikeMark } from "@/components/ui/logo";

export function CommandBar() {
  return (
    <div className="mx-auto max-w-xl flex-1 px-4">
      <div className="relative hidden md:block">
        <Input
          placeholder="What would you like Strike OS to do?"
          className="h-10 rounded-full pr-10 text-sm shadow-[0_10px_24px_-10px_hsl(var(--foreground)/0.22)] transition-shadow focus-within:shadow-[0_12px_28px_-8px_hsl(var(--foreground)/0.4)]"
        />
        <button className="absolute right-1 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-primary text-primary-foreground shadow-[0_6px_16px_-8px_hsl(var(--foreground)/0.2)] hover:bg-primary/90 transition-colors">
          <StrikeMark className="h-3.5 w-3.5" />
        </button>
      </div>
      <button className="md:hidden flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-primary text-primary-foreground shadow-[0_6px_16px_-8px_hsl(var(--foreground)/0.2)] hover:bg-primary/90 transition-colors mx-auto">
        <StrikeMark className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}