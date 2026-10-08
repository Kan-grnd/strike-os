/* Node-family contrast gate.
 * Run: npx tsx scripts/check-node-contrast.ts
 * Wired into `npm run build`: prints the lowest text/graphic contrast per
 * theme and exits non-zero under 4.5:1 (text) or 3:1 (graphics).
 *
 * No browser needed: theme tokens are read from globals.css and evaluated
 * with the same pure palette module the node components paint with.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  avatarColors,
  buildNodePalette,
  mix,
  parseCssColorToRgb,
  pickTextOn,
  ratio,
  rgbString,
  statusAccentFor,
  type NodeThemeTokens,
  type Rgb,
} from "../src/components/topology/nodes/node-palette";

const THEMES = ["clean", "calm", "bold", "graphite", "void", "signal"] as const;

const css = readFileSync(join(process.cwd(), "src", "styles", "globals.css"), "utf8");

function themeBlock(cls: string): string {
  const i = css.indexOf(`.${cls}`);
  if (i < 0) throw new Error(`theme .${cls} not found in globals.css`);
  const open = css.indexOf("{", i);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

function token(block: string, name: string): string {
  const m = block.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`token ${name} missing in theme block`);
  return m[1].trim();
}

function themeTokens(cls: string): NodeThemeTokens {
  const block = themeBlock(cls);
  const get = (name: string): Rgb => {
    const c = parseCssColorToRgb(token(block, name));
    if (!c) throw new Error(`unparseable ${name} in .${cls}`);
    return c;
  };
  return { canvas: get("--background"), surface: get("--card"), accent: get("--primary") };
}

interface Row {
  theme: string;
  worstText: string;
  worstTextRatio: number;
  worstGraphic: string;
  worstGraphicRatio: number;
}

const rows: Row[] = [];
const failures: string[] = [];

for (const theme of THEMES) {
  const t = themeTokens(theme);
  const p = buildNodePalette(t);
  const texts: Array<[string, Rgb, Rgb]> = [
    ["surface text", p.surfaceText, p.surface],
    ["secondary text", p.secondaryText, p.surface],
    ["task text", p.taskText, p.taskSurface],
    ["task secondary", p.taskSecondary, p.taskSurface],
  ];
  const graphics: Array<[string, Rgb, Rgb]> = [];
  (Object.keys(p.treatments) as Array<keyof typeof p.treatments>).forEach((k) => {
    texts.push([`${k} word`, p.treatments[k].text, p.surface]);
    texts.push([`task ${k} word`, p.taskTreatments[k].text, p.taskSurface]);
    graphics.push([`${k} graphic`, p.treatments[k].graphic, p.surface]);
    graphics.push([`task ${k} graphic`, p.taskTreatments[k].graphic, p.taskSurface]);
    // Mini-orb eyes: white or near-black, whichever contrasts more.
    const eye = pickTextOn(p.treatments[k].base);
    graphics.push([`${k} orb eye`, eye, p.treatments[k].base]);
  });
  // Colony segmented-bar + ticket tracks clear 1.6:1 (their own floor).
  let worstTrack: [string, number] = ["", Infinity];
  for (const [label, fg, bg] of [["bar track", p.track, p.surface], ["ticket track", p.taskTrack, p.taskSurface]] as Array<[string, Rgb, Rgb]>) {
    const r = ratio(fg, bg);
    if (r < worstTrack[1]) worstTrack = [label, r];
    if (r < 1.6) failures.push(`${theme}: track "${label}" ${r.toFixed(2)}:1 < 1.6:1`);
  }
  // Agent avatars: sphere >= 1.8:1 vs the node surface (guarded), eyes >= 3:1.
  for (const k of ["success", "warning", "danger", "accent", "muted"] as const) {
    const av = avatarColors(p.treatments[k].base, p.surface);
    const rs = ratio(av.sphere, p.surface);
    const re = ratio(av.eye, av.sphere);
    if (rs < 1.8) failures.push(`${theme}: avatar "${k}" sphere ${rs.toFixed(2)}:1 < 1.8:1`);
    if (re < 3) failures.push(`${theme}: avatar "${k}" eye ${re.toFixed(2)}:1 < 3:1`);
  }
  // Task dots: active (accent filled + breathing halo) vs assigned (soft mix,
  // static halo) differ by color; queued is a hollow ring (shape differs).
  // Explicitly required distinguishable in every theme, Abyssal/Ghost first.
  const dotA = p.taskTreatments.accent.graphic;
  const dotB = p.taskTreatments.assigned.graphic;
  const dotQ = p.taskTreatments.muted.graphic;
  const same = (a: Rgb, b: Rgb) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  if (same(dotA, dotB)) failures.push(`${theme}: task dots active == assigned (${rgbString(dotA)})`);
  if (same(dotA, dotQ) || same(dotB, dotQ)) failures.push(`${theme}: task dot color collision with queued`);
  console.log(`  dots active=${rgbString(dotA)} assigned=${rgbString(dotB)} queued=${rgbString(dotQ)}[hollow] | active/assigned ${ratio(dotA, dotB).toFixed(2)}:1 active/queued ${ratio(dotA, dotQ).toFixed(2)}:1`);
  // Accent treatment base is the raw Level 3 accent (no chroma fallback).
  const sa = statusAccentFor(t.accent);
  if (rgbString(p.treatments.accent.base) !== rgbString(sa)) {
    failures.push(`${theme}: accent treatment base ${rgbString(p.treatments.accent.base)} != statusAccent ${rgbString(sa)}`);
  }

  let worstText: [string, number] = ["", Infinity];
  for (const [label, fg, bg] of texts) {
    const r = ratio(fg, bg);
    if (r < worstText[1]) worstText = [label, r];
    if (r < 4.5) failures.push(`${theme}: text "${label}" ${r.toFixed(2)}:1 < 4.5:1`);
  }
  let worstGraphic: [string, number] = ["", Infinity];
  for (const [label, fg, bg] of graphics) {
    const r = ratio(fg, bg);
    if (r < worstGraphic[1]) worstGraphic = [label, r];
    if (r < 3) failures.push(`${theme}: graphic "${label}" ${r.toFixed(2)}:1 < 3:1`);
  }
  if (worstTrack[1] < worstGraphic[1]) worstGraphic = [`${worstTrack[0]} (1.6 floor)`, worstTrack[1]];
  rows.push({
    theme,
    worstText: worstText[0],
    worstTextRatio: worstText[1],
    worstGraphic: worstGraphic[0],
    worstGraphicRatio: worstGraphic[1],
  });
}

console.log("theme      | lowest text (≥4.5)          | lowest graphic (≥3.0)");
console.log("-----------|------------------------------|------------------------------");
for (const r of rows) {
  const t = `${r.worstText} ${r.worstTextRatio.toFixed(2)}:1`.padEnd(28);
  const g = `${r.worstGraphic} ${r.worstGraphicRatio.toFixed(2)}:1`.padEnd(28);
  console.log(`${r.theme.padEnd(11)}| ${t}| ${g}`);
}
if (failures.length > 0) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
console.log(`\n${THEMES.length}/${THEMES.length} themes pass`);
