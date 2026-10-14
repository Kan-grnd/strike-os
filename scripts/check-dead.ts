/* M4.6 guard — the nine dead UI promises (ui-spec §7).
 *
 * A control the operator can see must do what it says, or not be there. This
 * check asserts the two resolutions that are structural facts:
 *   • the wiring that was made to work still points at a real route
 *   • the controls that were removed do not creep back
 *
 * Run: npx tsx scripts/check-dead-controls.ts
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
let pass = 0;
let fail = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (cond) { pass++; console.log(`PASS ${label}`); }
  else { fail++; console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
};
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const has = (rel: string) => existsSync(join(ROOT, rel));

/* ── Promise 1: /routing "Run test" hits a real endpoint ──────────────────── */
const selectRoute = "src/app/api/models/select/route.ts";
ok("the routing test endpoint exists", has(selectRoute));
if (has(selectRoute)) {
  const src = read(selectRoute);
  ok("it handles POST", /export async function POST/.test(src));
  ok("it resolves the real model policy", src.includes("resolveModelPolicy"));
}
const routingPage = read("src/app/routing/page.tsx");
ok("the routing page targets /api/models/select", routingPage.includes("/api/models/select"));
ok("it no longer targets a nonexistent endpoint", !routingPage.includes("/api/models/test"));

/* ── Promise 6: "Mark Complete" URL matches its behaviour ─────────────────── */
ok("an automations complete route exists", has("src/app/api/automations/[id]/complete/route.ts"));
ok("the misleading cancel route is gone", !has("src/app/api/automations/[id]/cancel/route.ts"));
const workflowsDetail = read("src/app/workflows/[id]/page.tsx");
ok("Mark Complete calls /complete", workflowsDetail.includes("/api/automations/${id}/complete"));
ok("Mark Complete no longer calls /cancel", !/api\/automations\/\$\{id\}\/cancel/.test(workflowsDetail));

/* ── Promise 5: the removed dead controls do not return ───────────────────── */
/* Each entry was real markup before the fix and must stay absent: these are
   literal fragments from the removed JSX, not invented strings. */
const removed: Array<[string, string, string]> = [
  ["src/app/tools/page.tsx", "Add tool", "tools create"],
  ["src/app/tools/page.tsx", "/> Test", "tools per-item test"],
  ["src/app/tools/page.tsx", "/> Schema", "tools per-item schema"],
  ["src/app/mcp/page.tsx", "Add connection", "mcp create"],
  ["src/app/mcp/page.tsx", "Sync tools", "mcp sync"],
  ["src/app/mcp/page.tsx", "/> Test", "mcp per-item test"],
  ["src/app/connectors/page.tsx", "Add connection", "connectors create"],
  ["src/app/connectors/page.tsx", "Import schema", "connectors import"],
  ["src/app/connectors/page.tsx", "Convert to tool", "connectors convert"],
  ["src/app/connectors/page.tsx", "/> Test", "connectors per-item test"],
  ["src/app/decisions/page.tsx", "Log decision", "decisions create"],
];
for (const [file, needle, label] of removed) {
  ok(`the dead control is gone: ${label}`, !read(file).includes(needle));
}
/* The dead per-item Test/Sync/Import buttons were the only users of these icons,
   so a surviving import means the control is back. */
for (const file of ["src/app/tools/page.tsx", "src/app/mcp/page.tsx", "src/app/connectors/page.tsx"]) {
  const src = read(file);
  ok(`no orphaned action icon in ${file.split("/")[2]}`, !/\bPlay\b|\bRefreshCw\b|\bCpu\b/.test(src));
}

/* ── Promises 2/3/4/7/8/9 were resolved in earlier milestones ─────────────── */
/* 8: /workflows/new and /context are no longer referenced anywhere. */
let danglingRefs: string[] = [];
const walk = (dir: string) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walk(full);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      const src = readFileSync(full, "utf8");
      if (/["'`]\/workflows\/new["'`]/.test(src) || /["'`]\/context["'`]/.test(src)) {
        danglingRefs.push(full);
      }
    }
  }
};
walk(join(ROOT, "src"));
ok("no dangling /workflows/new or /context references", danglingRefs.length === 0, danglingRefs.join(", "));

console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);
