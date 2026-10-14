/**
 * Brain — the orchestrator's persisted activity state.
 *
 * `computeBrainRuntime` (runtime/mappers.ts) is the *health* aggregate derived
 * from agents/colonies/missions/tasks. This module is the complementary
 * *activity* signal: a single persisted row that says what the Brain is
 * currently doing, and an emission helper that records every transition as a
 * `brain.state.changed` event so the state is observable and auditable.
 */

import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";
import type { PrismaClient } from "@prisma/client";

/** What the Brain is doing right now (distinct from its health). */
export type BrainActivity =
  | "idle"
  | "planning"
  | "delegating"
  | "supervising"
  | "recovering";

export const BRAIN_ID = "brain";

export const BRAIN_ACTIVITIES: BrainActivity[] = [
  "idle",
  "planning",
  "delegating",
  "supervising",
  "recovering",
];

export interface BrainStateContext {
  /** Human-readable "why" for this transition. */
  detail?: string;
  /** Short decision label, e.g. "Planned 3 steps". */
  decision?: string;
  missionId?: string;
  taskId?: string;
}

export interface BrainStateRecord {
  state: BrainActivity;
  detail: string | null;
  decision: string | null;
  missionId: string | null;
  taskId: string | null;
  updatedAt: string;
}

/**
 * Persist the Brain's activity state and emit a `brain.state.changed` event.
 * Upserts a singleton row (id = "brain"); safe to call from any subsystem.
 */
export async function setBrainState(
  state: BrainActivity,
  ctx: BrainStateContext = {},
  db: PrismaClient = prisma
): Promise<void> {
  const detail = ctx.detail ?? null;
  const missionId = ctx.missionId ?? null;
  const taskId = ctx.taskId ?? null;

  await db.brainState.upsert({
    where: { id: BRAIN_ID },
    create: { id: BRAIN_ID, state, detail, missionId, taskId },
    update: { state, detail, missionId, taskId },
  });

  await eventBus.emit({
    type: "brain.state.changed",
    source: "brain",
    subject: "brain",
    subjectId: BRAIN_ID,
    missionId: ctx.missionId,
    taskId: ctx.taskId,
    payload: {
      state,
      detail,
      decision: ctx.decision ?? null,
    },
  });
}

/**
 * Read the current Brain activity state, falling back to a synthetic `idle`
 * record when the row has never been written (fresh database).
 */
export async function getBrainState(
  db: PrismaClient = prisma
): Promise<BrainStateRecord> {
  const row = await db.brainState.findUnique({ where: { id: BRAIN_ID } });
  if (!row) {
    return {
      state: "idle",
      detail: null,
      decision: null,
      missionId: null,
      taskId: null,
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    state: row.state as BrainActivity,
    detail: row.detail,
    decision: null,
    missionId: row.missionId,
    taskId: row.taskId,
    updatedAt: row.updatedAt.toISOString(),
  };
}
