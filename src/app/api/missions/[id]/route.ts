import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";
import { getMissionEngine } from "@/lib/engine";
import { operationHealth, missionHealthFrom } from "@/lib/health";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function GET(req: Request, { params }: { params: Params }) {
  try {
    const mission = await prisma.mission.findUnique({
      where: { id: params.id },
      include: {
        tasks: {
          orderBy: { createdAt: "asc" },
        },
        operations: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!mission) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }

    const events = await prisma.event.findMany({
      where: { missionId: mission.id },
      orderBy: { timestamp: "asc" },
    });

    // Health rolls up task → operation → mission (M3.3).
    const operations = mission.operations.map((op) => ({
      ...op,
      health: operationHealth(op, mission.tasks.filter((t) => t.parentOperationId === op.id)),
    }));
    const health = missionHealthFrom(mission, mission.operations, mission.tasks);

    return NextResponse.json({ mission: { ...mission, operations }, health, events });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch mission" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Params }) {
  try {
    const body = await req.json();

    const lifecycle = body.action as string | undefined;

    // Lifecycle actions routed through MissionEngine so agent runtime state stays in sync
    if (lifecycle) {
      const engine = await getMissionEngine();
      switch (lifecycle) {
        case "start":
          await engine.startMission(prisma, params.id);
          break;
        case "pause":
          await engine.pauseMission(prisma, params.id);
          break;
        case "resume":
          await engine.resumeMission(prisma, params.id);
          break;
        case "cancel":
          await engine.cancelMission(prisma, params.id);
          break;
        default:
          return NextResponse.json({ error: `Unknown action: ${lifecycle}` }, { status: 400 });
      }
      const mission = await prisma.mission.findUnique({ where: { id: params.id } });
      return NextResponse.json({ mission });
    }

    const statusTypes: Record<string, { type: "mission.started" | "mission.paused" | "mission.completed" | "mission.failed" | "mission.cancelled"; completedAt?: Date }> = {
      RUNNING: { type: "mission.started" },
      PAUSED: { type: "mission.paused" },
      COMPLETED: { type: "mission.completed", completedAt: new Date() },
      FAILED: { type: "mission.failed", completedAt: new Date() },
      CANCELLED: { type: "mission.cancelled", completedAt: new Date() },
    };

    const statusChange = body.status ? statusTypes[body.status] : undefined;

    const mission = await prisma.mission.update({
      where: { id: params.id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.goal ? { goal: body.goal } : {}),
        ...(body.plan ? { plan: JSON.stringify(body.plan) } : {}),
        ...(statusChange?.completedAt ? { completedAt: statusChange.completedAt } : {}),
      },
    });

    if (statusChange) {
      await eventBus.emit({
        type: statusChange.type,
        source: "mission-service",
        subject: "mission",
        subjectId: mission.id,
        missionId: mission.id,
        payload: { goal: mission.goal, status: mission.status },
      });
    }

    return NextResponse.json({ mission });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update mission" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Params }) {
  try {
    await prisma.mission.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete mission" }, { status: 500 });
  }
}
