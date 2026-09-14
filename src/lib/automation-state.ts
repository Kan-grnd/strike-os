/**
 * Automation State Machine — Phase 9
 * DRAFT → ACTIVE → PAUSED → COMPLETED → FAILED
 */

import { eventBus } from "./events";
import prisma from "@/lib/db";

export type AutomationState = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "FAILED";

const validTransitions: Record<AutomationState, AutomationState[]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["PAUSED", "COMPLETED", "FAILED"],
  PAUSED: ["ACTIVE", "COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: [],
};

export class AutomationStateMachine {
  /**
   * Validate and perform a state transition
   */
  async transition(automationId: string, newState: AutomationState): Promise<void> {
    const automation = await prisma.automation.findUnique({ where: { id: automationId } });
    if (!automation) throw new Error("Automation not found");

    const currentState = automation.status as AutomationState;
    const allowed = validTransitions[currentState] || [];

    if (!allowed.includes(newState)) {
      throw new Error(`Invalid transition: ${currentState} → ${newState}`);
    }

    await prisma.automation.update({
      where: { id: automationId },
      data: { status: newState },
    });

    await eventBus.emit({
      type: "automation.created",
      source: "automation-engine",
      subject: "automation",
      subjectId: automationId,
      payload: { name: automation.name, status: newState, previous: currentState },
    });
  }

  /**
   * Start an automation
   */
  async start(automationId: string): Promise<void> {
    await this.transition(automationId, "ACTIVE");
  }

  /**
   * Pause an automation
   */
  async pause(automationId: string): Promise<void> {
    await this.transition(automationId, "PAUSED");
  }

  /**
   * Resume an automation
   */
  async resume(automationId: string): Promise<void> {
    await this.transition(automationId, "ACTIVE");
  }

  /**
   * Mark automation as completed
   */
  async complete(automationId: string): Promise<void> {
    await this.transition(automationId, "COMPLETED");
  }

  /**
   * Mark automation as failed
   */
  async fail(automationId: string, reason?: string): Promise<void> {
    await this.transition(automationId, "FAILED");
    await eventBus.emit({
      type: "automation.failed",
      source: "automation-engine",
      subject: "automation",
      subjectId: automationId,
      payload: { reason },
    });
  }
}

export const automationState = new AutomationStateMachine();