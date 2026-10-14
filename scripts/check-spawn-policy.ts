/* Spawn-policy checks (M2.3).
 *
 * Two rules guard the fleet and are cheap enough to test in isolation:
 *   - the per-mission spawn ceiling, resolvable from mission policy;
 *   - scoped inheritance — a sub-agent may never hold more than its parent.
 *
 * These are pure functions, so this runs without a database and every edge is
 * asserted directly rather than inferred from an integration run.
 *
 * Run: npx tsx scripts/check-spawn-policy.ts
 */
import {
  DEFAULT_MISSION_SPAWN_CEILING,
  resolveSpawnCeiling,
  intersectGrants,
} from "../src/lib/spawn-policy";

const results: string[] = [];
const check = (label: string, ok: boolean, detail?: string) => {
  results.push(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

/* ── Ceiling resolution ────────────────────────────────────────────────────── */
check(
  "no policy falls back to the default",
  resolveSpawnCeiling(null) === DEFAULT_MISSION_SPAWN_CEILING &&
    resolveSpawnCeiling(undefined) === DEFAULT_MISSION_SPAWN_CEILING &&
    resolveSpawnCeiling("") === DEFAULT_MISSION_SPAWN_CEILING,
  `default ${DEFAULT_MISSION_SPAWN_CEILING}`,
);

check(
  "policy override wins",
  resolveSpawnCeiling(JSON.stringify({ spawnCeiling: 2 })) === 2,
  "spawnCeiling: 2",
);

check(
  "zero is a valid, honoured ceiling",
  resolveSpawnCeiling(JSON.stringify({ spawnCeiling: 0 })) === 0,
  "no spawns allowed",
);

check(
  "fractional and negative values are rejected to the default",
  resolveSpawnCeiling(JSON.stringify({ spawnCeiling: 3.9 })) === 3 &&
    resolveSpawnCeiling(JSON.stringify({ spawnCeiling: -1 })) === DEFAULT_MISSION_SPAWN_CEILING,
  "3.9 -> 3, -1 -> default",
);

check(
  "malformed policy never throws",
  resolveSpawnCeiling("{not json") === DEFAULT_MISSION_SPAWN_CEILING &&
    resolveSpawnCeiling(JSON.stringify({ spawnCeiling: "lots" })) === DEFAULT_MISSION_SPAWN_CEILING,
  "bad JSON and bad type -> default",
);

/* ── Scoped inheritance ────────────────────────────────────────────────────── */
const sub = intersectGrants(["tool-a", "tool-b"], ["tool-a", "tool-c"]);
check(
  "child keeps only what the parent holds",
  sub.allowed.length === 1 && sub.allowed[0] === "tool-a",
  "tool-a allowed",
);
check(
  "requested grants the parent lacks are denied",
  sub.denied.length === 1 && sub.denied[0] === "tool-b",
  "tool-b denied",
);

const inherit = intersectGrants(["tool-a", "tool-c"], ["tool-a", "tool-c", "tool-d"]);
check(
  "subset request passes through whole",
  inherit.allowed.join(",") === "tool-a,tool-c" && inherit.denied.length === 0,
  "no denials when the parent is a superset",
);

const duped = intersectGrants(["tool-a", "tool-a"], ["tool-a"]);
check(
  "duplicates collapse",
  duped.allowed.length === 1 && duped.denied.length === 0,
  "tool-a once",
);

const emptyParent = intersectGrants(["tool-a"], []);
check(
  "a parent with no grants yields a child with none",
  emptyParent.allowed.length === 0 && emptyParent.denied[0] === "tool-a",
  "nothing inheritable",
);

check(
  "nothing requested yields nothing granted or denied",
  intersectGrants([], ["tool-a"]).allowed.length === 0 &&
    intersectGrants([], ["tool-a"]).denied.length === 0,
  "empty in, empty out",
);

const failed = results.filter((r) => r.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
