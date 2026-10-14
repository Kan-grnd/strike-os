import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";
import { missionHealthFrom } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const missions = await prisma.mission.findMany({
    where: status ? { status: status as never } : undefined,
    include: {
      tasks: {
        select: {
          id: true,
          status: true,
          description: true,
          ownerAgentId: true,
          retryCount: true,
          maxRetries: true,
          parentOperationId: true,
        },
      },
      operations: {
        select: { id: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Health rolls up task → operation → mission (M3.3) on every read, so it is
  // always fresh and never flashes a within-tick recovery (health.ts).
  const withHealth = missions.map((m) => ({
    ...m,
    health: missionHealthFrom(m, m.operations, m.tasks),
  }));

  return NextResponse.json({ missions: withHealth });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const mission = await prisma.mission.create({
      data: {
        goal: body.goal,
        plan: JSON.stringify(body.plan || {}),
        agentIds: JSON.stringify(body.agentIds || []),
        priority: body.priority || 0,
      },
    });

    await eventBus.emit({
      type: "mission.created",
      source: "mission-service",
      subject: "mission",
      subjectId: mission.id,
      missionId: mission.id,
      payload: { goal: mission.goal },
    });

    return NextResponse.json({ mission }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create mission" }, { status: 500 });
  }
}
