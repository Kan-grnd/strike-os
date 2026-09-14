import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  setColonyState,
  stopAgent,
  pauseColonyWithScope,
  resumeColony,
  deleteColonyWithMode,
  inspectColonyPause,
  inspectColonyImpact,
  type ColonyPauseScope,
  type DeleteColonyMode,
} from "@/lib/runtime-state";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function GET(req: Request, { params }: { params: Params }) {
  try {
    const colony = await prisma.colony.findUnique({
      where: { id: params.id },
      include: {
        agents: {
          orderBy: { name: "asc" },
        },
      },
    });
    if (!colony) return NextResponse.json({ error: "Colony not found" }, { status: 404 });

    const events = await prisma.event.findMany({
      where: { subjectId: colony.id },
      orderBy: { timestamp: "desc" },
      take: 30,
    });

    const impact = await inspectColonyPause(colony.id);
    const deleteImpact = await inspectColonyImpact(colony.id);
    return NextResponse.json({ colony, events, impact, deleteImpact });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch colony" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Params }) {
  try {
    const body = await req.json();
    const action = body.action as string | undefined;
    const reason = (body.reason as string) ?? undefined;

    if (action === "pause") {
      const scope: ColonyPauseScope = body.scope ?? "PAUSE_ALL";
      const impact = await inspectColonyPause(params.id);
      await pauseColonyWithScope(params.id, scope, reason);
      return NextResponse.json({ success: true, action: "pause", scope, impact });
    }

    if (action === "resume") {
      await resumeColony(params.id, reason);
      return NextResponse.json({ success: true, action: "resume" });
    }

    if (action === "stop") {
      const agents = await prisma.agent.findMany({ where: { colonyId: params.id }, select: { id: true } });
      await setColonyState(params.id, "stopped", { reason: reason ?? "stopped by operator", source: "topology" });
      for (const a of agents) await stopAgent(a.id, reason ?? "colony stopped");
      await prisma.task.updateMany({
        where: { ownerAgentId: { in: agents.map((a) => a.id) }, status: { in: ["QUEUED", "ASSIGNED", "RUNNING", "WAITING"] } },
        data: { status: "CANCELLED" },
      });
      return NextResponse.json({ success: true, action: "stop" });
    }

    if (body.status) {
      await setColonyState(params.id, (body.status as string).toLowerCase() as never, { reason, source: "topology" });
      const colony = await prisma.colony.findUnique({ where: { id: params.id } });
      return NextResponse.json({ colony });
    }

    const colony = await prisma.colony.update({
      where: { id: params.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
      },
    });
    return NextResponse.json({ colony });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update colony" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Params }) {
  try {
    const url = new URL(req.url);
    const mode = (url.searchParams.get("mode") ?? "ARCHIVE_COLONY") as DeleteColonyMode;
    const targetColonyId = url.searchParams.get("targetColonyId") ?? undefined;
    const result = await deleteColonyWithMode(params.id, mode, { targetColonyId });
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete colony" }, { status: 500 });
  }
}
