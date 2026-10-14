/**
 * Task Engine — Phase 5
 *
 * Schedules QUEUED → ASSIGNED → RUNNING → COMPLETED/FAILED.
 * Handles dependency resolution, retries, timeouts.
 */

import { eventBus } from "./events";
import { setAgentState } from "./runtime-state";
import { settleMissionIfComplete } from "./completion";
import { setBrainState, BRAIN_ID } from "./brain";
import { recoverTask } from "./recovery";
import { checkSpendGate, sweepDrift } from "./gates";
import { PrismaClient } from "@prisma/client";

export interface TaskResult {
  output: unknown;
  cost: number;
  duration: number; // ms
}

export interface TaskRunner {
  execute(taskId: string): Promise<TaskResult>;
}

export class MockTaskRunner implements TaskRunner {
  async execute(taskId: string): Promise<TaskResult> {
    // Simulate realistic AI work: 1-5s delay, small cost, structured output
    const delay = 1000 + Math.random() * 4000;
    await new Promise((r) => setTimeout(r, delay));

    const cost = 0.001 + Math.random() * 0.049; // $0.001 - $0.05

    return {
      output: { result: "completed", simulated: true, taskId },
      cost,
      duration: Math.round(delay),
    };
  }
}

export class TaskEngine {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private runner: TaskRunner;
  private db: PrismaClient;
  private loopMs = 2000; // 2 second scheduling loop for demo (fast enough to show progress)

  constructor(db: PrismaClient, runner?: TaskRunner) {
    this.db = db;
    this.runner = runner || new MockTaskRunner();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => this.tick(), this.loopMs);
    console.log("[TaskEngine] Started scheduling loop");
  }

  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    console.log("[TaskEngine] Stopped");
  }

  private async tick() {
    try {
      // Work gated by an outstanding approval is not schedulable until the
      // operator decides. Derive the gated scopes from PENDING approvals so a
      // gate that fired before a run's status settled still holds the work.
      const pending = await this.db.approval.findMany({
        where: { status: "PENDING" },
        select: { missionId: true, operationId: true },
      });
      const gatedOperations = new Set(pending.map((a) => a.operationId).filter(Boolean) as string[]);
      const gatedMissions = new Set(pending.map((a) => a.missionId).filter(Boolean) as string[]);
      const isGated = (task: { parentOperationId: string | null; missionId: string }) =>
        (task.parentOperationId ? gatedOperations.has(task.parentOperationId) : false) ||
        gatedMissions.has(task.missionId);

      // 1. Find QUEUED tasks whose dependencies are all COMPLETED
      const queued = await this.db.task.findMany({
        where: { status: "QUEUED" },
      });

      for (const task of queued) {
        if (isGated(task)) continue;

        const deps = JSON.parse(task.dependencies || "[]") as string[];
        const allDone = deps.length === 0 ? true : await this.dependenciesComplete(deps);

        if (allDone) {
          // Respect agent lifecycle: never assign work to a paused/stopped/blocked/failed agent
          const blockedOwnerState = task.ownerAgentId
            ? await this.agentBlockedFromWork(task.ownerAgentId)
            : false;
          if (blockedOwnerState) {
            // A gated agent is already in the right state — don't downgrade it.
            if (blockedOwnerState !== "waiting_for_approval") {
              await setAgentState(task.ownerAgentId!, blockedOwnerState === "blocked" ? "blocked" : "waiting", {
                reason: `waiting for agent capacity (state ${blockedOwnerState})`,
                taskId: task.id,
                missionId: task.missionId,
                source: "task-engine",
              }).catch(() => undefined);
            }
            continue;
          }
          await this.assignTask(task);
        } else {
          // Dependency not met yet — surface the agent as WAITING so the topology
          // can show "what is this agent blocked on?"
          if (task.ownerAgentId) {
            await setAgentState(task.ownerAgentId, "waiting", {
              reason: "waiting on dependencies",
              taskId: task.id,
              missionId: task.missionId,
              source: "task-engine",
            }).catch(() => undefined);
          }
        }
      }

      // 2. Find ASSIGNED tasks → transition to RUNNING
      const assigned = await this.db.task.findMany({
        where: { status: "ASSIGNED" },
      });

      for (const task of assigned) {
        if (isGated(task)) continue;
        // M3.4: crossing the mission's spending ceiling pauses the run and asks.
        if (await checkSpendGate(this.db, task)) continue;
        await this.runTask(task);
      }

      // 3. Check timeouts for RUNNING tasks
      const now = Date.now();
      const running = await this.db.task.findMany({
        where: {
          status: "RUNNING",
        },
      });

      for (const task of running) {
        const started = task.updatedAt ? task.updatedAt.getTime() : now;
        if (now - started > task.timeout) {
          await this.failTask(task, "timeout");
        }
      }

      // 4. Handle retries for FAILED tasks that haven't exceeded maxRetries
      const failed = await this.db.task.findMany({
        where: { status: "FAILED" },
      });

      for (const task of failed) {
        if (task.retryCount < task.maxRetries) {
          const backoffMs = Math.pow(2, task.retryCount) * 1000;
          const lastAttempt = task.updatedAt ? task.updatedAt.getTime() : now;
          if (now - lastAttempt > backoffMs) {
            await this.retryTask(task);
          }
        } else {
          // Retries exhausted — run the recovery ladder (M3.2):
          // reassign → fallback → replacement → escalate. A task that cannot be
          // recovered is escalated to the operator, never left as a silent FAILED.
          await recoverTask(this.db, task.id, "retries exhausted").catch((err) => {
            console.error("[TaskEngine] recovery failed:", err);
          });
        }
      }

      // 5. Sweep RUNNING missions for drift → raise DRIFT gates (M3.4, E16).
      await sweepDrift(this.db).catch((err) => console.error("[TaskEngine] drift sweep failed:", err));
    } catch (err) {
      console.error("[TaskEngine] Tick error:", err);
    }
  }

  private async dependenciesComplete(ids: string[]): Promise<boolean> {
    for (const id of ids) {
      const dep = await this.db.task.findUnique({ where: { id } });
      if (!dep || dep.status !== "COMPLETED") return false;
    }
    return true;
  }

  /** true if the agent must not accept new work right now. */
  private async agentBlockedFromWork(agentId: string): Promise<string | null> {
    const agent = await this.db.agent.findUnique({ where: { id: agentId }, select: { runtimeState: true } });
    if (!agent) return null;
    if (
      ["paused", "stopped", "cancelled", "failed", "blocked", "waiting_for_approval"].includes(
        agent.runtimeState,
      )
    ) {
      return agent.runtimeState;
    }
    return null;
  }

  private async assignTask(task: any) {
    await this.db.task.update({
      where: { id: task.id },
      data: { status: "ASSIGNED" },
    });
    await eventBus.emit({
      type: "task.assigned",
      source: "task-engine",
      subject: "task",
      subjectId: task.id,
      taskId: task.id,
      missionId: task.missionId,
      agentId: task.ownerAgentId || undefined,
      payload: { description: task.description },
    });
    if (task.ownerAgentId) {
      await setAgentState(task.ownerAgentId, "planning", {
        reason: `assigned "${task.description.slice(0, 64)}"`,
        taskId: task.id,
        missionId: task.missionId,
        source: "task-engine",
      }).catch(() => undefined);

      // The Brain handing a task to an agent is a delegation — the live flow
      // draws a real edge from the Brain to the owner while it runs.
      await eventBus.emit({
        type: "delegation.started",
        source: "task-engine",
        subject: "delegation",
        subjectId: task.ownerAgentId,
        taskId: task.id,
        missionId: task.missionId,
        agentId: task.ownerAgentId,
        payload: {
          from: BRAIN_ID,
          to: task.ownerAgentId,
          label: "Delegated",
          description: task.description,
        },
      }).catch(() => undefined);

      await setBrainState("delegating", {
        missionId: task.missionId,
        taskId: task.id,
        detail: task.description,
        decision: `Delegating "${task.description.slice(0, 48)}"`,
      }).catch(() => undefined);
    }
  }

  /** Close the delegation edge opened when the task was assigned. */
  private async emitDelegationCompleted(task: any) {
    if (!task.ownerAgentId) return;
    await eventBus.emit({
      type: "delegation.completed",
      source: "task-engine",
      subject: "delegation",
      subjectId: task.ownerAgentId,
      taskId: task.id,
      missionId: task.missionId,
      agentId: task.ownerAgentId,
      payload: { from: BRAIN_ID, to: task.ownerAgentId },
    }).catch(() => undefined);
  }

  private async runTask(task: any) {
    await this.db.task.update({
      where: { id: task.id },
      data: { status: "RUNNING" },
    });

    await eventBus.emit({
      type: "task.started",
      source: "task-engine",
      subject: "task",
      subjectId: task.id,
      taskId: task.id,
      missionId: task.missionId,
      agentId: task.ownerAgentId || undefined,
      payload: { description: task.description },
    });

    if (task.ownerAgentId) {
      await setAgentState(task.ownerAgentId, "executing", {
        reason: `running "${task.description.slice(0, 64)}"`,
        taskId: task.id,
        missionId: task.missionId,
        source: "task-engine",
      }).catch(() => undefined);
    }

    await setBrainState("supervising", {
      missionId: task.missionId,
      taskId: task.id,
      detail: task.description,
      decision: `Supervising "${task.description.slice(0, 48)}"`,
    }).catch(() => undefined);

    try {
      const result = await this.runner.execute(task.id);

      const simulated =
        !!result.output &&
        typeof result.output === "object" &&
        (result.output as Record<string, unknown>).simulated === true;

      await this.db.task.update({
        where: { id: task.id },
        data: {
          status: "COMPLETED",
          output: JSON.stringify(result.output || {}),
          simulated,
          completedAt: new Date(),
          cost: {
            increment: result.cost,
          },
        },
      });

      await eventBus.emit({
        type: "task.completed",
        source: "task-engine",
        subject: "task",
        subjectId: task.id,
        taskId: task.id,
        missionId: task.missionId,
        agentId: task.ownerAgentId || undefined,
        payload: {
          description: task.description,
          cost: result.cost,
          duration: result.duration,
        },
      });

      await this.emitDelegationCompleted(task);

      // Update agent stats + runtime state
      if (task.ownerAgentId) {
        const agent = await this.db.agent.findUnique({ where: { id: task.ownerAgentId } });
        if (agent) {
          await this.db.agent.update({
            where: { id: agent.id },
            data: {
              tasksCompleted: { increment: 1 },
              totalCost: { increment: result.cost },
              lastActiveAt: new Date(),
            },
          });
        }
        await setAgentState(task.ownerAgentId, "completed", {
          reason: `task completed: ${task.description.slice(0, 48)}`,
          taskId: task.id,
          missionId: task.missionId,
          source: "task-engine",
        }).catch(() => undefined);

        // If the agent has no more queued work, settle back to idle
        const open = await this.db.task.count({
          where: { ownerAgentId: task.ownerAgentId, status: { in: ["QUEUED", "ASSIGNED", "RUNNING", "WAITING"] } },
        });
        if (open === 0) {
          setTimeout(() => {
            setAgentState(task.ownerAgentId, "idle", { reason: "no queued work", source: "task-engine" }).catch(() => undefined);
          }, 400);
        }
      }

      // Roll the verdict up to the mission/operation once its last task settles.
      await settleMissionIfComplete(this.db, task.missionId).catch(() => undefined);
    } catch (err) {
      await this.db.task.update({
        where: { id: task.id },
        data: { status: "FAILED", retryCount: { increment: 1 } },
      });

      await eventBus.emit({
        type: "task.failed",
        source: "task-engine",
        subject: "task",
        subjectId: task.id,
        taskId: task.id,
        missionId: task.missionId,
        agentId: task.ownerAgentId || undefined,
        payload: { description: task.description, error: (err as Error).message },
      });

      await this.emitDelegationCompleted(task);

      if (task.ownerAgentId) {
        await setAgentState(task.ownerAgentId, "failed", {
          reason: `task failed: ${(err as Error).message || "execution error"}`,
          taskId: task.id,
          missionId: task.missionId,
          source: "task-engine",
        }).catch(() => undefined);
      }

      await setBrainState("recovering", {
        missionId: task.missionId,
        taskId: task.id,
        detail: task.description,
        decision: `Task failed — ${(err as Error).message || "execution error"}`,
      }).catch(() => undefined);

      await settleMissionIfComplete(this.db, task.missionId).catch(() => undefined);
    }
  }

  private async failTask(task: any, reason: string) {
    await this.db.task.update({
      where: { id: task.id },
      data: { status: "FAILED", retryCount: { increment: 1 } },
    });
    await eventBus.emit({
      type: "task.failed",
      source: "task-engine",
      subject: "task",
      subjectId: task.id,
      taskId: task.id,
      missionId: task.missionId,
      agentId: task.ownerAgentId || undefined,
      payload: { description: task.description, reason },
    });

    await this.emitDelegationCompleted(task);

    if (task.ownerAgentId) {
      await setAgentState(task.ownerAgentId, "failed", {
        reason: `task failed: ${reason}`,
        taskId: task.id,
        missionId: task.missionId,
        source: "task-engine",
      }).catch(() => undefined);
    }

    await setBrainState("recovering", {
      missionId: task.missionId,
      taskId: task.id,
      detail: task.description,
      decision: `Task failed — ${reason}`,
    }).catch(() => undefined);

    await settleMissionIfComplete(this.db, task.missionId).catch(() => undefined);
  }

  private async retryTask(task: any) {
    await this.db.task.update({
      where: { id: task.id },
      data: { status: "QUEUED" },
    });

    await setBrainState("recovering", {
      missionId: task.missionId,
      taskId: task.id,
      detail: task.description,
      decision: `Retrying task — attempt ${task.retryCount + 1}/${task.maxRetries}`,
    }).catch(() => undefined);
    await eventBus.emit({
      type: "task.retried",
      source: "task-engine",
      subject: "task",
      subjectId: task.id,
      taskId: task.id,
      missionId: task.missionId,
      agentId: task.ownerAgentId || undefined,
      payload: { retryCount: task.retryCount + 1, maxRetries: task.maxRetries },
    });
    if (task.ownerAgentId) {
      // engine picks it up again on the next tick → planning/executing
      await setAgentState(task.ownerAgentId, "retrying", {
        reason: `retry ${task.retryCount + 1}/${task.maxRetries}`,
        taskId: task.id,
        missionId: task.missionId,
        source: "task-engine",
      }).catch(() => undefined);
      setTimeout(() => {
        setAgentState(task.ownerAgentId, "idle", { reason: "retry queued", source: "task-engine" }).catch(() => undefined);
      }, 300);
    }
  }
}
