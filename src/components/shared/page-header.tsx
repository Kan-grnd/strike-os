"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared entrance easing — matches the home command deck. */
export const EASE = [0.16, 1, 0.3, 1] as const;

export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground",
        className
      )}
    >
      {children}
    </h2>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  icon: Icon,
  actions,
  backHref,
  backLabel = "Back",
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={cn("space-y-3", className)}
    >
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <div className="rounded-xl border bg-card p-2.5 shadow-sm">
              <Icon className="h-5 w-5 text-foreground" />
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {eyebrow}
              </p>
            )}
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </motion.header>
  );
}