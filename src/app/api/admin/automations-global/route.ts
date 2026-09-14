import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const paused = Boolean(body.paused);

    const result = paused
      ? await prisma.automation.updateMany({
          where: { status: { in: ["ACTIVE", "SCHEDULED"] } },
          data: { status: "PAUSED" },
        })
      : await prisma.automation.updateMany({
          where: { status: "PAUSED" },
          data: { status: "ACTIVE" },
        });

    await eventBus.emit({
      type: paused ? "automations.paused" : "automations.resumed",
      source: "settings",
      subject: "automations",
      payload: { count: result.count },
    });

    return NextResponse.json({ ok: true, paused, updated: result.count });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update automations" }, { status: 500 });
  }
}
