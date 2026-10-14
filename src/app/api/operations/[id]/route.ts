import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { operationHealth, taskHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

/* A run's detail: its tasks (each with rolled-up health + simulation state),
 * its cost, and the traces recorded for those tasks (Trace has no operationId,
 * so runs join traces through their task ids). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const operation = await prisma.operation.findUnique({
    where: { id: params.id },
    include: {
      mission: { select: { id: true, goal: true, status: true } },
      tasks: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!operation) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const taskIds = operation.tasks.map((t) => t.id);
  const traces = taskIds.length
    ? await prisma.trace.findMany({
        where: { taskId: { in: taskIds } },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  const tasksWithHealth = operation.tasks.map((t) => ({ ...t, health: taskHealth(t) }));

  return NextResponse.json({
    operation: { ...operation, tasks: tasksWithHealth },
    health: operationHealth(operation, operation.tasks),
    traces,
  });
}
