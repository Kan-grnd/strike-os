/**
 * Mission completion settlement.
 *
 * Deliberately dependency-light (db + events + runtime-state only) so the task
 * engine can settle a mission after its last task ends without importing the
 * MissionEngine — which would create an import cycle (mission-engine → task-engine).
 *
 * A mission settles only when it is RUNNING and every task has reached a
 * terminal state. It then rolls the verdict and cost up to the mission and its
 * open run (Operation) and emits the closing event.
 */

import { PrismaClient } from "@prisma/client";
import { eventBus } from "./events";
import { setAgentState } from "./runtime-state";
import { setBrainState } from "./brain";

const TERMINAL_TASK_STATUS = ["COMPLETED", "FAILED", "CANCELLED"];

export async function settleMissionIfComplete(
  db: PrismaClient,
  missionId: string,
): Promise<boolean> {
  const mission = await db.mission.findUnique({ where: { id: missionId } });
  if (!mission || mission.status !== "RUNNING") return false;

  const tasks = await db.task.findMany({ where: { missionId } });
  if (tasks.length === 0) return false;
  if (!tasks.every((t) => TERMINAL_TASK_STATUS.includes(t.status))) return false;

  const anyFailed = tasks.some((t) => t.status === "FAILED");
  const allCancelled = tasks.every((t) => t.status === "CANCELLED");
  const status = anyFailed ? "FAILED" : allCancelled ? "CANCELLED" : "COMPLETED";
  const totalCost = tasks.reduce((sum, t) => sum + t.cost, 0);
  const completedAt = new Date();

  await db.mission.update({
    where: { id: missionId },
    data: { status, completedAt, totalCost },
  });

  // Close out the run (Operation) with the same verdict and cost roll-up.
  await db.operation.updateMany({
    where: { missionId, status: { in: ["PLANNING", "RUNNING"] } },
    data: { status, completedAt, cost: totalCost },
  });

  // Reflect completion in agent lifecycle (only for the executors).
  const executors = await db.task.findMany({
    where: { missionId, ownerAgentId: { not: null } },
    select: { ownerAgentId: true },
    distinct: ["ownerAgentId"],
  });
  for (const t of executors) {
    if (!t.ownerAgentId) continue;
    if (status === "COMPLETED") {
      await setAgentState(t.ownerAgentId, "completed", {
        reason: "mission completed",
        missionId,
        source: "mission-engine",
      }).catch(() => undefined);
    } else {
      await setAgentState(t.ownerAgentId, "failed", {
        reason: "mission ended with failures",
        missionId,
        source: "mission-engine",
      }).catch(() => undefined);
    }
  }

  await eventBus.emit({
    type: status === "COMPLETED" ? "mission.completed" : status === "CANCELLED" ? "mission.cancelled" : "mission.failed",
    source: "mission-engine",
    subject: "mission",
    subjectId: mission.id,
    missionId: mission.id,
    payload: { goal: mission.goal, totalCost, taskCount: tasks.length },
  });

  await setBrainState("idle", {
    missionId: mission.id,
    detail: mission.goal,
    decision:
      status === "COMPLETED"
        ? "Mission completed"
        : status === "CANCELLED"
          ? "Mission cancelled"
          : "Mission ended with failures",
  }).catch(() => undefined);

  return true;
}
