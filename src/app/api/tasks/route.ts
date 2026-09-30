import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const missionId = searchParams.get("missionId");
  const agentId = searchParams.get("agentId");

  const tasks = await prisma.task.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(missionId ? { missionId } : {}),
      ...(agentId ? { ownerAgentId: agentId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { mission: { select: { goal: true } } },
  });

  const agentIds = Array.from(new Set(tasks.map((t) => t.ownerAgentId).filter((id): id is string => Boolean(id))));
  const agents = agentIds.length
    ? await prisma.agent.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } })
    : [];
  const names = new Map(agents.map((a) => [a.id, a.name]));

  return NextResponse.json({
    tasks: tasks.map((t) => ({ ...t, agentName: t.ownerAgentId ? (names.get(t.ownerAgentId) ?? null) : null })),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const task = await prisma.task.create({
      data: {
        missionId: body.missionId,
        description: body.description,
        status: body.status || "QUEUED",
        input: JSON.stringify(body.input || {}),
        ownerAgentId: body.ownerAgentId,
        dependencies: JSON.stringify(body.dependencies || []),
        priority: body.priority || 0,
        timeout: body.timeout || 60000,
      },
    });

    await eventBus.emit({
      type: "task.created",
      source: "task-engine",
      subject: "task",
      subjectId: task.id,
      taskId: task.id,
      missionId: task.missionId,
      agentId: task.ownerAgentId || undefined,
      payload: { description: task.description },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
