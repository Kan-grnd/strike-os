import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";
import { setAgentState } from "@/lib/runtime-state";

type Params = { id: string };

export async function GET(req: Request, { params }: { params: Params }) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: params.id },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Params }) {
  try {
    const body = await req.json();

    const statusTypes: Record<string, { type: "task.started" | "task.completed" | "task.failed" | "task.waiting" | "task.cancelled"; completedAt?: Date }> = {
      RUNNING: { type: "task.started" },
      WAITING: { type: "task.waiting" },
      COMPLETED: { type: "task.completed", completedAt: new Date() },
      FAILED: { type: "task.failed", completedAt: new Date() },
      CANCELLED: { type: "task.cancelled", completedAt: new Date() },
    };

    const statusChange = body.status ? statusTypes[body.status] : undefined;

    const task = await prisma.task.update({
      where: { id: params.id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.output ? { output: JSON.stringify(body.output) } : {}),
        ...(body.trace ? { trace: JSON.stringify(body.trace) } : {}),
        ...(body.ownerAgentId ? { ownerAgentId: body.ownerAgentId } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(statusChange?.completedAt ? { completedAt: statusChange.completedAt } : {}),
      },
    });

    if (statusChange) {
      await eventBus.emit({
        type: statusChange.type,
        source: "task-engine",
        subject: "task",
        subjectId: task.id,
        taskId: task.id,
        missionId: task.missionId,
        agentId: task.ownerAgentId || undefined,
        payload: { description: task.description, status: task.status },
      });

      // Keep agent lifecycle in lockstep with its current task (DB source of truth)
      if (task.ownerAgentId) {
        const reason = `task ${body.status.toLowerCase()}: ${task.description.slice(0, 64)}`;
        const stateForStatus: Record<string, "executing" | "waiting" | "completed" | "failed" | "cancelled"> = {
          RUNNING: "executing",
          WAITING: "waiting",
          COMPLETED: "completed",
          FAILED: "failed",
          CANCELLED: "cancelled",
        };
        const agentState = stateForStatus[body.status];
        if (agentState) {
          await setAgentState(task.ownerAgentId, agentState, {
            reason,
            taskId: task.id,
            missionId: task.missionId,
            source: "task.api",
          });
        }
        if (body.status === "COMPLETED" || body.status === "CANCELLED" || body.status === "FAILED") {
          const ownerId = task.ownerAgentId;
          const open = await prisma.task.count({
            where: { ownerAgentId: ownerId, status: { in: ["QUEUED", "ASSIGNED", "RUNNING", "WAITING"] } },
          });
          if (open === 0) {
            setTimeout(() => {
              setAgentState(ownerId, "idle", { reason: "no queued work", source: "task.api" }).catch(() => undefined);
            }, 600);
          }
        }
      }
    }

// Update owner agent stats on completion
    if (body.status === "COMPLETED" && task.ownerAgentId) {
      const ownerId = task.ownerAgentId;
      const agent = await prisma.agent.findUnique({
        where: { id: ownerId },
      });
      if (agent) {
        await prisma.agent.update({
          where: { id: ownerId },
          data: {
            tasksCompleted: { increment: 1 },
            lastActiveAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Params }) {
  try {
    await prisma.task.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}