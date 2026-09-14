import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  ctaHref,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  cta?: string;
  ctaHref?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-dashed px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-3 rounded-md bg-muted p-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      {cta && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {cta}
        </Link>
      )}
    </div>
  );
}