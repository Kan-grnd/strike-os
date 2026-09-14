/**
 * Specialist Forge — versioned specialist bundle definitions.
 *
 * Each bundle is a one-click deployable specialist: capabilities, tool names
 * (resolved to Tool IDs FAIL-CLOSED at deploy time), a model policy per the
 * Agent schema, a target colony, a memory scope, and a benchmark task used for
 * the trial-run proof. Tokens resolve against the seeded catalog, so a bundle
 * whose requirements cannot be satisfied is denied — never partially deployed.
 */

export const SPECIALIST_BUNDLE_VERSION = 1;

export type SpecialistBundleId =
  | "intel-researcher"
  | "pipeline-coder"
  | "source-qa"
  | "web-monitor";

export interface SpecialistModelPolicy {
  primary: string;
  fallbacks: string[];
}

export interface SpecialistBenchmark {
  goal: string;
  task: string;
  estimatedDurationMs: number;
  passCriteria: string;
}

export interface SpecialistBundle {
  id: SpecialistBundleId;
  version: number;
  label: string;
  tagline: string;
  description: string;
  agentType: string;
  colonyName: string;
  capabilities: string[];
  toolNames: string[];
  memoryScope: string;
  modelPolicy: SpecialistModelPolicy;
  benchmark: SpecialistBenchmark;
}

export interface SpecialistInstallRecord {
  id: string;
  bundleId: string;
  agentId: string;
  status: string;
  permissions: string;
  trialHistory: string;
  trialMissionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpecialistTrialRecord {
  verdict: "PASS" | "FAIL";
  reason: string;
  durationMs: number;
  cost: number;
  missionId: string;
  taskId: string;
  passCriteria: string;
  finishedAt: string;
  trace: unknown[];
}

export const SPECIALIST_BUNDLES: SpecialistBundle[] = [
  {
    id: "intel-researcher",
    version: 1,
    label: "Intel Researcher",
    tagline: "Source discovery → authority rating",
    description:
      "Discovers primary sources, verifies publisher authority, and synthesizes intelligence briefs on demand.",
    agentType: "SPECIALIST",
    colonyName: "Research Colony",
    capabilities: ["intel.deep_research", "authority.verification", "intel.synthesis"],
    toolNames: ["search", "browser", "github"],
    memoryScope: "MISSION",
    modelPolicy: { primary: "claude-sonnet-4", fallbacks: ["claude-haiku-4"] },
    benchmark: {
      goal: "Benchmark: discover authoritative sources on a competitive topic",
      task: "Locate 3+ distinct primary sources for the target, verify publisher authority, and tag each with a relevance score",
      estimatedDurationMs: 15000,
      passCriteria: "task completes with structured output containing source findings",
    },
  },
  {
    id: "pipeline-coder",
    version: 1,
    label: "Pipeline Coder",
    tagline: "Bootstrap → modularize → orchestrate",
    description:
      "Bootstraps ingestion pipelines, modularizes code, and wires scheduling for report generation workflows.",
    agentType: "SPECIALIST",
    colonyName: "Engineering Colony",
    capabilities: ["pipeline.bootstrap", "code.modularization", "schedule.orchestration"],
    toolNames: ["terminal", "github", "database"],
    memoryScope: "MISSION",
    modelPolicy: { primary: "auto/best-coding", fallbacks: ["claude-sonnet-4"] },
    benchmark: {
      goal: "Benchmark: bootstrap a report ingestion pipeline",
      task: "Stand up the ingestion pipeline skeleton (source → normalize → store), list modules produced, and note the scheduled run cadence",
      estimatedDurationMs: 18000,
      passCriteria: "task completes with structured output listing pipeline modules",
    },
  },
  {
    id: "source-qa",
    version: 1,
    label: "Source QA",
    tagline: "Provenance → precision → audit trail",
    description:
      "Audits source provenance, measures precision against ground truth, and keeps a reviewable audit trail.",
    agentType: "SPECIALIST",
    colonyName: "Engineering Colony",
    capabilities: ["source.provenance", "precision.measurement", "audit.trail"],
    toolNames: ["database", "search"],
    memoryScope: "AGENT",
    modelPolicy: { primary: "auto/fast", fallbacks: ["claude-haiku-4"] },
    benchmark: {
      goal: "Benchmark: validate report accuracy against source findings",
      task: "Cross-check three report claims against their cited sources, score each by precision, and append an audit-trail entry",
      estimatedDurationMs: 12000,
      passCriteria: "task completes with structured output scoring claim precision",
    },
  },
  {
    id: "web-monitor",
    version: 1,
    label: "Web Monitor",
    tagline: "Cadence tracking → delta signals",
    description:
      "Watches competitor web presence, detects publishing-cadence deltas, and flags threshold changes continuously.",
    agentType: "SPECIALIST",
    colonyName: "Research Colony",
    capabilities: ["cadence.monitoring", "delta.signal", "notify.thresholds"],
    toolNames: ["search", "browser"],
    memoryScope: "AGENT",
    modelPolicy: { primary: "auto/fast", fallbacks: ["auto/best-coding"] },
    benchmark: {
      goal: "Benchmark: detect publishing-cadence deltas",
      task: "Check tracked competitor pages for freshness deltas over the window, classify each change, and emit threshold signals for changed pages",
      estimatedDurationMs: 12000,
      passCriteria: "task completes with structured output classifying page deltas",
    },
  },
];

const BUNDLE_MAP = new Map<SpecialistBundleId, SpecialistBundle>(
  SPECIALIST_BUNDLES.map((b) => [b.id, b])
);

export function getSpecialistBundle(id: string): SpecialistBundle | undefined {
  return BUNDLE_MAP.get(id as SpecialistBundleId);
}

/**
 * Dev-only guard, mirroring the reset-demo / edit-tickets pattern. The Forge
 * deploys real agents and runs live trials — mutations are denied outside dev.
 */
export function specialistsAllowed(): boolean {
  const dbUrl = process.env.DATABASE_URL || "";
  if (!dbUrl.includes("dev.db")) return false;
  return process.env.NODE_ENV === "development";
}