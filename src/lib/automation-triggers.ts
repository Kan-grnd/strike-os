/**
 * Automation Triggers Engine — Phase 9
 * Handles schedule, webhook, event, data-change triggers
 */

import { eventBus, EventType } from "./events";
import prisma from "@/lib/db";

export interface TriggerConfig {
  type: "schedule" | "webhook" | "event" | "data_change" | "condition" | "manual";
  config: Record<string, unknown>;
}

export interface TriggerMatch {
  automationId: string;
  trigger: TriggerConfig;
  context: Record<string, unknown>;
}

export class TriggerEngine {
  private scheduledTriggers: Map<string, { cron: string; automationId: string }> = new Map();
  private webhookEndpoints: Map<string, { path: string; automationId: string }> = new Map();
  private eventSubscriptions: Map<string, Set<string>> = new Map(); // eventType -> automationIds
  private dataChangeWatchers: Map<string, { field: string; automationId: string }> = new Map();

  /**
   * Register all triggers for an automation
   */
  async register(automationId: string, triggers: TriggerConfig[]): Promise<void> {
    for (const trigger of triggers) {
      switch (trigger.type) {
        case "schedule":
          this.registerSchedule(automationId, trigger.config);
          break;
        case "webhook":
          this.registerWebhook(automationId, trigger.config);
          break;
        case "event":
          this.registerEvent(automationId, trigger.config);
          break;
        case "data_change":
          this.registerDataChange(automationId, trigger.config);
          break;
        case "condition":
          // Conditions evaluated on each tick
          break;
        case "manual":
          // Manual triggers don't need registration
          break;
      }
    }
  }

  /**
   * Unregister all triggers for an automation
   */
  async unregister(automationId: string): Promise<void> {
    // Remove from all maps
    for (const [id, data] of Array.from(this.scheduledTriggers.entries())) {
      if (data.automationId === automationId) this.scheduledTriggers.delete(id);
    }
    for (const [path, data] of Array.from(this.webhookEndpoints.entries())) {
      if (data.automationId === automationId) this.webhookEndpoints.delete(path);
    }
    for (const [eventType, ids] of Array.from(this.eventSubscriptions.entries())) {
      if (ids.has(automationId)) ids.delete(automationId);
    }
    for (const [id, data] of Array.from(this.dataChangeWatchers.entries())) {
      if (data.automationId === automationId) this.dataChangeWatchers.delete(id);
    }
  }

  // --- Schedule Triggers ---

  private registerSchedule(automationId: string, config: Record<string, unknown>): void {
    const cron = config.cron as string;
    if (!cron) return;
    const id = `${automationId}:schedule`;
    this.scheduledTriggers.set(id, { cron, automationId });
  }

  /**
   * Check all scheduled triggers - call this from a scheduler loop
   */
  async checkScheduledTriggers(): Promise<TriggerMatch[]> {
    const now = new Date();
    const matches: TriggerMatch[] = [];

    for (const [id, data] of Array.from(this.scheduledTriggers.entries())) {
      if (this.matchesCron(data.cron, now)) {
        matches.push({
          automationId: data.automationId,
          trigger: { type: "schedule", config: { cron: data.cron } },
          context: { triggeredAt: now.toISOString() },
        });
      }
    }

    return matches;
  }

  private matchesCron(cron: string, date: Date): boolean {
    // Simple cron matcher: supports "minute hour day month dayOfWeek" or "@daily", "@hourly", etc.
    // For production, use a proper cron library like 'croner'
    if (cron.startsWith("@")) {
      return this.matchesPreset(cron, date);
    }
    const parts = cron.split(" ");
    if (parts.length !== 5) return false;
    const [minute, hour, day, month, dayOfWeek] = parts;
    return this.matchesField(minute, date.getMinutes()) &&
           this.matchesField(hour, date.getHours()) &&
           this.matchesField(day, date.getDate()) &&
           this.matchesField(month, date.getMonth() + 1) &&
           this.matchesField(dayOfWeek, date.getDay());
  }

  private matchesPreset(preset: string, date: Date): boolean {
    switch (preset) {
      case "@yearly": case "@annually": return date.getMonth() === 0 && date.getDate() === 1 && date.getHours() === 0 && date.getMinutes() === 0;
      case "@monthly": return date.getDate() === 1 && date.getHours() === 0 && date.getMinutes() === 0;
      case "@weekly": return date.getDay() === 0 && date.getHours() === 0 && date.getMinutes() === 0;
      case "@daily": return date.getHours() === 0 && date.getMinutes() === 0;
      case "@hourly": return date.getMinutes() === 0;
      default: return false;
    }
  }

  private matchesField(pattern: string, value: number): boolean {
    if (pattern === "*") return true;
    if (pattern.includes(",")) return pattern.split(",").map(Number).includes(value);
    if (pattern.includes("/")) {
      const [, step] = pattern.split("/");
      return value % Number(step) === 0;
    }
    return parseInt(pattern, 10) === value;
  }

  // --- Webhook Triggers ---

  private registerWebhook(automationId: string, config: Record<string, unknown>): void {
    const path = config.path as string;
    if (!path) return;
    this.webhookEndpoints.set(path, { path, automationId });
  }

  /**
   * Call when webhook endpoint receives a request
   */
  async handleWebhook(path: string, payload: unknown): Promise<TriggerMatch[]> {
    const data = this.webhookEndpoints.get(path);
    if (!data) return [];
    return [{
      automationId: data.automationId,
      trigger: { type: "webhook", config: { path } },
      context: { payload },
    }];
  }

  // --- Event Triggers ---

  private registerEvent(automationId: string, config: Record<string, unknown>): void {
    const eventType = config.eventType as string;
    if (!eventType) return;
    if (!this.eventSubscriptions.has(eventType)) {
      this.eventSubscriptions.set(eventType, new Set());
    }
    this.eventSubscriptions.get(eventType)!.add(automationId);
  }

  /**
   * Call when an event is emitted
   */
  async handleEvent(eventType: string, eventPayload: unknown): Promise<TriggerMatch[]> {
    const automationIds = this.eventSubscriptions.get(eventType);
    if (!automationIds || automationIds.size === 0) return [];
    
    return Array.from(automationIds).map((automationId) => ({
      automationId,
      trigger: { type: "event", config: { eventType } },
      context: { eventPayload },
    }));
  }

  // --- Data Change Triggers ---

  private registerDataChange(automationId: string, config: Record<string, unknown>): void {
    const field = config.field as string;
    if (!field) return;
    const id = `${automationId}:${field}`;
    this.dataChangeWatchers.set(id, { field, automationId });
  }

  /**
   * Check data change triggers - call from scheduler
   */
  async checkDataChangeTriggers(): Promise<TriggerMatch[]> {
    const matches: TriggerMatch[] = [];
    
    for (const [id, data] of Array.from(this.dataChangeWatchers.entries())) {
      matches.push({
        automationId: data.automationId,
        trigger: { type: "data_change", config: { field: data.field } },
        context: { field: data.field },
      });
    }
    
    return matches;
  }
}

// Singleton instance
export const triggerEngine = new TriggerEngine();