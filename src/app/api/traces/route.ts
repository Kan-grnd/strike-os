import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const missionId = searchParams.get("missionId");
  const taskId = searchParams.get("taskId");
  const agentId = searchParams.get("agentId");

  const traces = await prisma.trace.findMany({
    where: {
      ...(missionId ? { missionId } : {}),
      ...(taskId ? { taskId } : {}),
      ...(agentId ? { agentId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ traces });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const trace = await prisma.trace.create({
      data: {
        missionId: body.missionId,
        taskId: body.taskId,
        agentId: body.agentId,
        events: JSON.stringify(body.events || []),
        cost: body.cost,
        duration: body.duration,
      },
    });

    return NextResponse.json({ trace }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create trace" }, { status: 500 });
  }
}