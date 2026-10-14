import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { operationHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

/* Operations = "runs" (M4.4, system-hierarchy §4: "Operation is a run, never a
 * count"). This is the list the Activity domain reads. Health rolls up from the
 * run's tasks on every read (health.ts, D56) so it is always fresh. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const missionId = searchParams.get("missionId");

  const operations = await prisma.operation.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(missionId ? { missionId } : {}),
    },
    include: {
      mission: { select: { id: true, goal: true } },
      tasks: {
        select: {
          id: true,
          status: true,
          retryCount: true,
          maxRetries: true,
          cost: true,
          description: true,
          ownerAgentId: true,
          parentOperationId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const withHealth = operations.map((op) => ({
    ...op,
    health: operationHealth(op, op.tasks),
  }));

  return NextResponse.json({ operations: withHealth });
}
