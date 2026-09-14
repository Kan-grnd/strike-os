import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const automations = await prisma.automation.findMany({
    where: status ? { status } : undefined,
    include: {
      runs: { orderBy: { startedAt: "desc" }, take: 3 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ automations });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const automation = await prisma.automation.create({
      data: {
        name: body.name,
        description: body.description,
        trigger: JSON.stringify(body.trigger || {}),
        conditions: JSON.stringify(body.conditions || {}),
        actions: JSON.stringify(body.actions || []),
        status: body.status || "DRAFT",
        nextRun: body.nextRun ? new Date(body.nextRun) : undefined,
      },
    });

    await eventBus.emit({
      type: "automation.created",
      source: "automation-engine",
      subject: "automation",
      subjectId: automation.id,
      payload: { name: automation.name, status: automation.status },
    });

    return NextResponse.json({ automation }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create automation" }, { status: 500 });
  }
}