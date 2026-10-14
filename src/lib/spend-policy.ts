/**
 * Spend policy — the mission's spending ceiling, as pure data (M3.4).
 *
 * The product contract (permissions.md §6): each mission has a ceiling; the Brain
 * spends freely below it, warns as it approaches, and **gates** (pauses + asks)
 * when a task would cross it. Cost rolls up task → operation → mission.
 *
 * Granularity (Q1) is an **open question**, so nothing is invented here: the caps
 * come entirely from the mission policy. When the policy declares no cap, there
 * is no ceiling and no gate — the operator opts in.
 *
 * Policy shape (`Mission.policy`):
 *   { "spend": { "operationCap": 0.5, "missionCap": 5, "warnRatio": 0.8 } }
 * `spendCeiling` (a bare number) is accepted as an alias for `operationCap`, so
 * the simplest possible declaration still works:
 *   { "spendCeiling": 0.5 }
 */

export interface SpendPolicy {
  /** Ceiling for a single run (Operation), in USD. */
  operationCap?: number;
  /** Ceiling for the mission's lifetime, in USD. */
  missionCap?: number;
  /** Fraction of a cap that counts as "approaching" (0–1). No default. */
  warnRatio?: number;
}

export type SpendDimension = "operation" | "mission";

export type SpendDecision =
  | { action: "allow" }
  | { action: "warn"; dimension: SpendDimension; cap: number; spent: number; ratio: number }
  | { action: "gate"; dimension: SpendDimension; cap: number; spent: number; projected: number };

function positiveNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
}

/** Parse the spend policy out of a mission's policy JSON. `null` = no ceiling. */
export function resolveSpendPolicy(policyJson: string | null | undefined): SpendPolicy | null {
  let parsed: any = {};
  if (policyJson) {
    try {
      parsed = JSON.parse(policyJson);
    } catch {
      return null;
    }
  }
  const spend = parsed?.spend ?? {};
  const operationCap = positiveNumber(spend.operationCap) ?? positiveNumber(parsed?.spendCeiling);
  const missionCap = positiveNumber(spend.missionCap);
  const warnRatio = positiveNumber(spend.warnRatio);

  if (operationCap === undefined && missionCap === undefined) return null;

  return {
    ...(operationCap !== undefined ? { operationCap } : {}),
    ...(missionCap !== undefined ? { missionCap } : {}),
    ...(warnRatio !== undefined && warnRatio <= 1 ? { warnRatio } : {}),
  };
}

export interface SpendInput {
  policy: SpendPolicy | null;
  /** Cost already booked against the current run. */
  operationSpent: number;
  /** Cost already booked against the mission lifetime. */
  missionSpent: number;
  /**
   * Estimated cost of the work about to run (e.g. the next plan step). Optional:
   * when unknown it is 0, and the gate then fires only once a cap is already
   * reached.
   */
  projectedNext?: number;
}

/**
 * Decide whether the next unit of work may run. A cap is crossed when spend has
 * reached it, or when spend plus the projected next cost would exceed it; the
 * tighter dimension (operation before mission) wins.
 */
export function spendDecision(input: SpendInput): SpendDecision {
  const { policy } = input;
  if (!policy) return { action: "allow" };

  const projected = Math.max(0, input.projectedNext ?? 0);

  const breaches: { dimension: SpendDimension; cap: number; spent: number }[] = [];
  if (policy.operationCap !== undefined) {
    const spent = input.operationSpent;
    if (spent >= policy.operationCap || spent + projected > policy.operationCap) {
      breaches.push({ dimension: "operation", cap: policy.operationCap, spent });
    }
  }
  if (policy.missionCap !== undefined) {
    const spent = input.missionSpent;
    if (spent >= policy.missionCap || spent + projected > policy.missionCap) {
      breaches.push({ dimension: "mission", cap: policy.missionCap, spent });
    }
  }
  if (breaches.length > 0) {
    // The operation cap is the tighter, per-run ceiling — prefer it.
    const b = breaches.find((x) => x.dimension === "operation") ?? breaches[0];
    return { action: "gate", dimension: b.dimension, cap: b.cap, spent: b.spent, projected };
  }

  // Approaching a cap (not yet crossing) is a soft warn — only if configured.
  if (policy.warnRatio !== undefined) {
    const ratios: { dimension: SpendDimension; cap: number; spent: number; ratio: number }[] = [];
    if (policy.operationCap !== undefined && policy.operationCap > 0) {
      ratios.push({
        dimension: "operation",
        cap: policy.operationCap,
        spent: input.operationSpent,
        ratio: (input.operationSpent + projected) / policy.operationCap,
      });
    }
    if (policy.missionCap !== undefined && policy.missionCap > 0) {
      ratios.push({
        dimension: "mission",
        cap: policy.missionCap,
        spent: input.missionSpent,
        ratio: (input.missionSpent + projected) / policy.missionCap,
      });
    }
    const hottest = ratios.sort((a, b) => b.ratio - a.ratio)[0];
    if (hottest && hottest.ratio >= policy.warnRatio) {
      return {
        action: "warn",
        dimension: hottest.dimension,
        cap: hottest.cap,
        spent: hottest.spent,
        ratio: hottest.ratio,
      };
    }
  }

  return { action: "allow" };
}
