import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";
import { seedDemo } from "@/lib/demo-seed";

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

export async function POST() {
  if (!confirm()) {
    return NextResponse.json(
      { error: "Demo reset is only allowed against a local dev database" },
      { status: 403 }
    );
  }

  // seedDemo wipes in FK-safe order and re-seeds the demo dataset,
  // so SIMULATE-mode reset fully restores the topology.
  const counts = await seedDemo(prisma);

  await eventBus.emit({
    type: "database.reset",
    source: "settings",
    subject: "database",
    payload: counts,
  });

  return NextResponse.json({ ok: true, counts });
}
