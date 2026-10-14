/* Core-sphere contrast gate.
 * Run: npx tsx scripts/check-orb-palette.ts
 * Wired into `npm run build`: evaluates the exact pure palette the brain
 * sphere paints — 6 themes x 5 roles — and exits non-zero on violation.
 *
 * Checks per role: ink vs core stop and ink vs mid stop >= 4.5:1, ring-filled
 * vs canvas >= 3:1, button icon vs composited button fill >= 3:1.
 * Theme colors come from THEME_PACKS (the registry); no browser needed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { THEME_PACKS } from "../src/lib/theme-packs";
import {
  coreShadowFor,
  getCoreOrbPalette,
  glowFor,
  mix,
  NEAR_INK,
  parseCssColorToRgb,
  ratio,
  rgbString,
  ringTrackFor,
  WHITE,
  type CoreOrbRole,
  type Rgb,
} from "../src/components/topology/nodes/node-palette";
import { isFixtureEnabled } from "../src/lib/runtime/fixtures";

const THEMES = ["calm", "bold", "void", "signal"] as const;
const ROLES: CoreOrbRole[] = ["working", "idle", "active", "blocked", "error"];
const BLACK: Rgb = [0, 0, 0];

const failures: string[] = [];
const rows: string[] = [];

/* Dev fixtures (brain states for the sphere crops) are disabled in
 * production: the guard must be present and active outside prod builds. */
const fixtureSrc = readFileSync(join(process.cwd(), "src", "lib", "runtime", "fixtures.ts"), "utf8");
if (!fixtureSrc.includes('process.env.NODE_ENV !== "production"')) {
  failures.push("fixtures: production guard missing from fixtures.ts");
}
if (!isFixtureEnabled()) {
  failures.push("fixtures: isFixtureEnabled() is false outside production");
}
/* Ring segments are explicit arc paths over the full 360 degrees, one per
 * agent, with a real gap at both ends. The earlier dashed-<circle> approach
 * could not express a gap at both ends of a segment whose sweep was not a
 * whole number of pathLength units, and mixing degrees with pathLength crams
 * every segment into one octant. Assert the arc form so neither bug can come
 * back: a <path> with an arc command, a sweep in degrees, and no dash trick. */
const brainSrc = readFileSync(join(process.cwd(), "src", "components", "topology", "nodes", "brain-node.tsx"), "utf8");
if (!brainSrc.includes("arcPath(") || !brainSrc.includes("A ${r} ${r} 0 0 1")) {
  failures.push("ring: segments are not explicit arc paths");
}
if (!brainSrc.includes("360 / n")) {
  failures.push("ring: sweep is not the full 360 degrees divided by the agent count");
}
/* Ignore comments: the file explains why the dash trick was abandoned, and
 * that explanation must not read as its return. */
const brainCode = brainSrc
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
if (/pathLength|strokeDasharray/.test(brainCode)) {
  failures.push("ring: segments still use the pathLength dash trick");
}
if (!brainSrc.includes("RING_GAP_DEG")) {
  failures.push("ring: segments have no end gap");
}

for (const id of THEMES) {
  const pack = THEME_PACKS.find((p) => p.id === id);
  if (!pack) throw new Error(`theme pack ${id} missing from registry`);
  const canvas = parseCssColorToRgb(pack.bg)!;
  const surface = parseCssColorToRgb(pack.surface)!;
  const accent = parseCssColorToRgb(pack.accent)!;
  let worst = Infinity;
  let worstLabel = "";
  for (const role of ROLES) {
    const base =
      role === "working"
        ? accent
        : role === "idle"
          ? mix(accent, canvas, 0.45)
          : parseCssColorToRgb(role === "active" ? "#2a9d5f" : role === "blocked" ? "#e27a2a" : "#e74668")!;
    const pal = getCoreOrbPalette({ role, base, surface, accent, canvas });
    const whiteInk = pal.ink[0] === 255 && pal.ink[1] === 255 && pal.ink[2] === 255;    const coreStop = whiteInk ? mix(pal.m, BLACK, 0.3) : mix(pal.m, WHITE, 0.25);
    const checks: Array<[string, number]> = [
      [`${role} ink/core`, ratio(pal.ink, coreStop)],
      [`${role} ink/mid`, ratio(pal.ink, pal.m)],
      [`${role} ring/canvas`, ratio(pal.ringFilled, canvas)],
    ];
    // Button fill is translucent over the sphere: composite first.
    const fillBase = whiteInk ? mix(pal.m, BLACK, 0.28) : mix(pal.m, WHITE, 0.4);
    checks.push([`${role} button`, ratio(whiteInk ? WHITE : NEAR_INK, fillBase)]);
    // Ring track clears 1.6:1 against the canvas it floats over.
    const track = ringTrackFor(surface, accent, canvas);
    if (rgbString(pal.ringEmpty) !== rgbString(track)) {
      failures.push(`${id}: ${role} ringEmpty ${rgbString(pal.ringEmpty)} != ring track ${rgbString(track)}`);
    }
    if (ratio(pal.ringEmpty, canvas) < 1.6) {
      failures.push(`${id}: ${role} ring/canvas-track ${ratio(pal.ringEmpty, canvas).toFixed(2)}:1 < 1.6:1`);
    }
    // Glow strings follow the reference shape with the aura rescaled to
    // stay inside the ring gap; "none" paints nothing.
    if (pal.shadow !== coreShadowFor(pal.m, canvas)) {
      failures.push(`${id}: ${role} shadow != rescaled reference glow (${pal.shadow})`);
    }
    const quiet = getCoreOrbPalette({ role, base, surface, accent, canvas, glowMode: "none" });
    if (quiet.shadow !== "none") {
      failures.push(`${id}: ${role} glowMode=none still paints (${quiet.shadow})`);
    }
    for (const [label, r] of checks) {
      const floor = label.includes("ring") || label.includes("button") ? 3 : 4.5;
      if (r < worst) {
        worst = r;
        worstLabel = label;
      }
      if (r < floor) failures.push(`${id}: ${label} ${r.toFixed(2)}:1 < ${floor}:1 (ink=${rgbString(pal.ink)} M=${rgbString(pal.m)})`);
    }
  }
  rows.push(`${id.padEnd(11)}| worst ${worstLabel} ${worst.toFixed(2)}:1`);
}

console.log("theme      | worst check (ink >= 4.5, ring/button >= 3.0)");
console.log("-----------|----------------------------------------------");
for (const r of rows) console.log(r);
if (failures.length > 0) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
console.log(`\n${THEMES.length}/${THEMES.length} themes x ${ROLES.length} roles pass`);
