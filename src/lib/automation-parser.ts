/**
 * Natural Language Automation Parser — Phase 9
 * Converts user intent to automation specification
 */

export interface ParsedAutomation {
  name: string;
  trigger: { type: string; config: Record<string, unknown> };
  conditions: Record<string, unknown>;
  actions: Array<{ type: string; config: Record<string, unknown> }>;
  confidence: number;
}

const schedulePresets: Record<string, string> = {
  "every day": "@daily",
  "daily": "@daily",
  "every hour": "@hourly",
  "hourly": "@hourly",
  "every week": "@weekly",
  "weekly": "@weekly",
  "every month": "@monthly",
  "monthly": "@monthly",
};

const actionKeywords: Record<string, string> = {
  "research": "create_mission",
  "analyze": "create_mission",
  "monitor": "create_mission",
  "scan": "create_mission",
  "alert": "notify_user",
  "notify": "notify_user",
  "email": "send_webhook",
  "webhook": "send_webhook",
  "call api": "call_api",
  "call tool": "call_tool",
  "invoke agent": "invoke_agent",
  "start agent": "invoke_agent",
  "pause agent": "invoke_agent",
  "create task": "create_task",
  "write memory": "write_memory",
  "store": "write_memory",
  "remember": "write_memory",
};

const conditionKeywords: Record<string, { field: string; operator: string; value: any }> = {
  "if error rate": { field: "errorRate", operator: "gt", value: 0.1 },
  "if failure rate": { field: "failureRate", operator: "gt", value: 0.1 },
  "if cost": { field: "totalCost", operator: "gt", value: 10 },
  "if success rate": { field: "successRate", operator: "lt", value: 90 },
  "if agent": { field: "agent.status", operator: "eq", value: "RUNNING" },
  "if mission": { field: "mission.status", operator: "eq", value: "FAILED" },
};

/**
 * Parse natural language into automation spec
 */
export function parseNaturalLanguage(input: string): ParsedAutomation {
  const lower = input.toLowerCase();
  
  // Extract trigger
  let trigger: ParsedAutomation["trigger"] = { type: "manual", config: {} };
  
  for (const [keyword, cron] of Object.entries(schedulePresets)) {
    if (lower.includes(keyword)) {
      trigger = { type: "schedule", config: { cron } };
      break;
    }
  }
  
  // Check for explicit time (e.g., "at 9 AM")
  const timeMatch = lower.match(/at\s+(\d{1,2})\s*(am|pm)/i);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10);
    const isPm = timeMatch[2].toLowerCase() === "pm";
    const cronHour = isPm && hour !== 12 ? hour + 12 : (hour === 12 && !isPm ? 0 : hour);
    if (trigger.type === "schedule") {
      trigger.config = { cron: `0 ${cronHour} * * *` };
    } else {
      trigger = { type: "schedule", config: { cron: `0 ${cronHour} * * *` } };
    }
  }
  
  // Extract actions
  const actions: ParsedAutomation["actions"] = [];
  for (const [keyword, actionType] of Object.entries(actionKeywords)) {
    if (lower.includes(keyword)) {
      const config: Record<string, unknown> = {};
      
      if (actionType === "create_mission") {
        // Extract goal from text after action keyword
        const goalMatch = lower.match(new RegExp(`${keyword}\\s+(.+?)(?:\\s+(?:and|if|then|when)|$)`));
        if (goalMatch) config.goal = goalMatch[1].trim();
        else config.goal = "Automated mission";
      } else if (actionType === "notify_user") {
        config.message = "Automation completed";
        config.severity = "info";
      } else if (actionType === "send_webhook") {
        config.url = "https://webhook.example.com";
        config.method = "POST";
      }
      
      actions.push({ type: actionType, config });
    }
  }
  
  // Default action if none found
  if (actions.length === 0) {
    actions.push({ type: "create_mission", config: { goal: "Automated task" } });
  }
  
  // Extract conditions
  const conditions: ParsedAutomation["conditions"] = {};
  for (const [keyword, cond] of Object.entries(conditionKeywords)) {
    if (lower.includes(keyword)) {
      conditions[cond.field] = { operator: cond.operator, value: cond.value };
    }
  }
  
  // Generate name
  const name = input.slice(0, 50) + (input.length > 50 ? "..." : "");
  
  return {
    name,
    trigger,
    conditions,
    actions,
    confidence: 0.7,
  };
}