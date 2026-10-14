/**
 * Model policy resolution.
 *
 * A task's model policy resolves in order:
 *   task → operation → mission → agent default
 *
 * `memoryScope` is never consulted for model choice. Each layer stores an
 * optional JSON policy string shaped `{ "primary": "<model>", "fallback": ["<model>", …] }`.
 */

const DEFAULT_PRIMARY = "auto/best-coding";

export interface ParsedPolicy {
  primary?: string;
  fallback: string[];
}

/** Parse one layer's policy JSON tolerantly. */
export function parsePolicyJson(raw: string | null | undefined): ParsedPolicy {
  if (!raw) return { fallback: [] };
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return { fallback: [] };
  }
  if (!obj || typeof obj !== "object") return { fallback: [] };

  const record = obj as Record<string, unknown>;
  const primary =
    typeof record.primary === "string" && record.primary.trim() ? record.primary.trim() : undefined;

  let fallback: string[] = [];
  const fb = record.fallback ?? record.fallbackModelIds;
  if (Array.isArray(fb)) fallback = fb.map(String);

  return { primary, fallback };
}

export interface PolicySources {
  task?: { policy?: string | null } | null;
  operation?: { policy?: string | null } | null;
  mission?: { policy?: string | null } | null;
  agent?: { modelPolicy?: string | null; fallbackModelIds?: string | null } | null;
}

export interface ResolvedModelPolicy {
  primary: string;
  fallback: string[];
  source: "task" | "operation" | "mission" | "agent" | "default";
}

export function resolveModelPolicy(sources: PolicySources): ResolvedModelPolicy {
  const task = parsePolicyJson(sources.task?.policy);
  if (task.primary) return { primary: task.primary, fallback: task.fallback, source: "task" };

  const operation = parsePolicyJson(sources.operation?.policy);
  if (operation.primary) return { primary: operation.primary, fallback: operation.fallback, source: "operation" };

  const mission = parsePolicyJson(sources.mission?.policy);
  if (mission.primary) return { primary: mission.primary, fallback: mission.fallback, source: "mission" };

  const agentPolicy = parsePolicyJson(sources.agent?.modelPolicy);
  let agentFallback = agentPolicy.fallback;
  if (agentFallback.length === 0 && sources.agent?.fallbackModelIds) {
    try {
      const arr = JSON.parse(sources.agent.fallbackModelIds);
      if (Array.isArray(arr)) agentFallback = arr.map(String);
    } catch {
      /* ignore */
    }
  }
  if (agentPolicy.primary || agentFallback.length) {
    return { primary: agentPolicy.primary || DEFAULT_PRIMARY, fallback: agentFallback, source: "agent" };
  }

  // No layer named a primary: keep any fallbacks the upper layers offered.
  const carriedFallback = [...task.fallback, ...operation.fallback, ...mission.fallback, ...agentFallback];
  return { primary: DEFAULT_PRIMARY, fallback: carriedFallback, source: "default" };
}
