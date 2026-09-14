import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";

export const dynamic = "force-dynamic";

const dbUrl = process.env.DATABASE_URL || "";

function confirm() {
  if (!dbUrl.includes("dev.db")) {
    return false;
  }
  if (process.env.ALLOW_DEMO_RESET === "true") {
    return true;
  }
  return process.env.NODE_ENV === "development";
}

// Wiped tables — demo/user content only, in FK-safe order
// (children before parents; onDelete: Cascade relations still wiped
// explicitly so the audit event reports honest per-table counts).
const WIPE_ORDER = [
  "approval",
  "specialistInstall",
  "automationRun",
  "automation",
  "memory",
  "memoryRelation",
  "relationship",
  "trace",
  "event",
  "task",
  "mission",
  "agent",
  "colony",
  "chatMessage",
  "conversation",
  "editTicket",
  "log",
  "observabilityMetric",
  "mCPConnection",
] as const;

export async function POST() {
  if (!confirm()) {
    return NextResponse.json(
      { error: "Content wipe is only allowed against a local dev database" },
      { status: 403 }
    );
  }

  const counts: Record<string, number> = {};
  for (const key of WIPE_ORDER) {
    // deleteMany is FK-safe here by ordering; cascade back-references are
    // handled by Prisma's onDelete rules for the child-first order above.
    const model = (prisma as unknown as Record<string, { deleteMany: () => Promise<{ count: number }> }>)[key];
    counts[key] = (await model.deleteMany()).count;
  }

  await eventBus.emit({
    type: "database.reset",
    source: "settings",
    subject: "database",
    payload: { action: "clean-content", counts },
  });

  return NextResponse.json({ ok: true, counts });
}
