"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/* One word: Activity (D23). The old Observatory/Observability split is retired;
 * cost and log/metric views fold into the run and event surfaces rather than
 * living as separate destinations. */
const TABS = [
  { href: "/activity", label: "Runs" },
  { href: "/activity/events", label: "Events" },
  { href: "/activity/traces", label: "Traces" },
];

export function ActivityNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Activity sections"
      className="flex flex-wrap items-center gap-1 rounded-xl border bg-card p-1"
    >
      {TABS.map((tab) => {
        /* Runs is the index: match it exactly so it is not active on every child. */
        const active =
          tab.href === "/activity"
            ? pathname === "/activity"
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-xl px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId="activity-tab"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                className="absolute inset-0 rounded-xl bg-muted"
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
