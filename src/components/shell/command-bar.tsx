"use client";

import { Zap } from "lucide-react";
import { Input } from "@/components/ui/input";

export function CommandBar() {
  return (
    <div className="mx-auto max-w-xl flex-1 px-4">
      <div className="relative hidden md:block">
        <Input
          placeholder="What would you like Strike OS to do?"
          className="h-10 pr-10 text-sm"
        />
        <button className="absolute right-1 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          <Zap className="h-4 w-4" />
        </button>
      </div>
      <button className="md:hidden flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mx-auto">
        <Zap className="h-4 w-4" />
      </button>
    </div>
  );
}
