"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/observability/performance", label: "Performance" },
  { href: "/observability/costs", label: "Costs" },
  { href: "/observability/traces", label: "Traces" },
  { href: "/observability/events", label: "Events" },
  { href: "/observability/logs", label: "Logs" },
];

export function ObservabilityNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Observability sections"
      className="flex flex-wrap items-center gap-1 rounded-xl border bg-card p-1"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId="observability-tab"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                className="absolute inset-0 rounded-lg bg-muted"
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}