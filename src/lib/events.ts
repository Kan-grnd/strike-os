/**
 * Event Bus — canonical event system.
 * All API mutations call eventBus.emit().
 * Polling endpoint reads from DB.
 */

import prisma from "@/lib/db";
import { Event as PrismaEvent } from "@prisma/client";

export type EventType =
  // Agent
  | "agent.created"
  | "agent.updated"
  | "agent.started"
  | "agent.initializing"
  | "agent.thinking"
  | "agent.planning"
  | "agent.executing"
  | "agent.idle"
  | "agent.failed"
  | "agent.stopped"
  | "agent.delegating"
  | "agent.delegated"
  | "agent.spawned"
  | "agent.waiting"
  | "agent.waiting_approval"
  | "agent.retrying"
  | "agent.blocked"
  | "agent.unblocked"
  | "agent.completed"
  | "agent.cancelled"
  | "agent.paused"
  | "agent.resumed"
  // Colony
  | "colony.created"
  | "colony.started"
  | "colony.paused"
  | "colony.resumed"
  | "colony.stopped"
  | "colony.failed"
  | "colony.archived"
  // Mission
  | "mission.created"
  | "mission.started"
  | "mission.paused"
  | "mission.resumed"
  | "mission.completed"
  | "mission.failed"
  | "mission.cancelled"
  // Task
  | "task.created"
  | "task.assigned"
  | "task.started"
  | "task.waiting"
  | "task.completed"
  | "task.failed"
  | "task.retried"
  | "task.recovered"
  | "task.escalated"
  | "task.cancelled"
  // Automation
  | "automation.created"
  | "automation.triggered"
  | "automation.running"
  | "automation.completed"
  | "automation.failed"
  // Tool
  | "tool.called"
  | "tool.completed"
  | "tool.failed"
  // MCP
  | "mcp.connected"
  | "mcp.disconnected"
  | "mcp.error"
  // API
  | "api.called"
  | "api.failed"
  | "api.rate_limited"
  | "api.connected"
  // Memory
  | "memory.created"
  | "memory.updated"
  | "memory.forgotten"
  | "relationship.created"
  | "relationship.updated"
  | "relationship.deleted"
  // Model
  | "model.selected"
  | "model.fallback"
  | "model.failed"
  | "model.timeout"
  // Topology control plane — transient runtime relationships.
  // These describe ephemeral, event-shaped behavior (never persistent structure).
  | "brain.state.changed"
  | "delegation.started"
  | "delegation.completed"
  | "spawn.denied"
  | "permission.denied"
  | "communication.started"
  | "communication.completed"
  | "verification.started"
  | "verification.passed"
  | "verification.revise"
  | "verification.failed"
  | "verification.escalated"
  | "recovery.started"
  | "recovery.succeeded"
  | "recovery.failed"
  // Approval — the intervention contract. A gate is a hard pause, not a notice.
  | "approval.requested"
  | "approval.approved"
  | "approval.denied"
  // Cost & drift — the signals that feed the attention queue (M3.4)
  | "spend.warning"
  | "spend.gated"
  | "drift.detected"
  // System
  | "system.started"
  | "system.error"
  | "system.recovered"
  | "user.notification"
  // Settings / platform
  | "settings.updated"
  | "secret.created"
  | "secret.deleted"
  | "automations.paused"
  | "automations.resumed"
  | "database.reset";

export interface EmitEventInput {
  type: EventType;
  source: string;
  subject?: string;
  subjectId?: string;
  missionId?: string;
  taskId?: string;
  agentId?: string;
  payload?: Record<string, unknown>;
  traceId?: string;
}

export class EventBus {
  async emit(input: EmitEventInput): Promise<PrismaEvent> {
    return prisma.event.create({
      data: {
        type: input.type,
        source: input.source,
        subject: input.subject,
        subjectId: input.subjectId,
        missionId: input.missionId,
        taskId: input.taskId,
        agentId: input.agentId,
        payload: input.payload ? JSON.stringify(input.payload) : "{}",
        traceId: input.traceId,
      },
    });
  }

  async getRecent(limit = 50, since?: Date): Promise<PrismaEvent[]> {
    return prisma.event.findMany({
      where: since ? { timestamp: { gt: since } } : undefined,
      orderBy: { timestamp: "desc" },
      take: limit,
    });
  }

  async getByType(type: EventType, limit = 50): Promise<PrismaEvent[]> {
    return prisma.event.findMany({
      where: { type },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
  }

  async getByMission(missionId: string): Promise<PrismaEvent[]> {
    return prisma.event.findMany({
      where: { missionId },
      orderBy: { timestamp: "asc" },
    });
  }

  async getByAgent(agentId: string, limit = 50): Promise<PrismaEvent[]> {
    return prisma.event.findMany({
      where: { agentId },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
  }
}

export const eventBus = new EventBus();
