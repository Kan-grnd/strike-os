"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, right, className }: SectionHeaderProps) {
  return (
    <header className={cn("mb-5 flex flex-wrap items-center justify-between gap-3", className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {right}
    </header>
  );
}
