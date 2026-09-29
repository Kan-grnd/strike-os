/* Navigation configuration checks.
 *
 * The dual-column sidebar derives everything it shows from `src/lib/navigation.ts`
 * — which domain is selected, which item is active, what a tooltip says. That
 * makes the config the single point of failure for the whole shell: a route that
 * is not listed becomes unreachable, a route listed twice lights up two panels,
 * and a prefix that matches too loosely swallows its lookalike neighbours.
 *
 * These are derived from the filesystem, not hand-copied, so adding a page and
 * forgetting the nav is a failure here rather than a 404 discovered in use.
 *
 * Run: npx tsx scripts/check-navigation.ts
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  NAV_DOMAINS,
  domainById,
  matchesPath,
  resolveNavigation,
} from "../src/lib/navigation";

const APP_DIR = join(process.cwd(), "src/app");

const results: string[] = [];
const check = (label: string, ok: boolean, detail?: string) => {
  results.push(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

/** Every page the app can serve, as concrete paths, with `[id]` filled in. */
const SAMPLE_ID = "sample-id";
const routeParamsToSample = (segment: string) =>
  segment
    .split("[")
    .filter((s) => s.includes("]"))
    .map((s) => s.slice(0, s.indexOf("]")).split("...")[0])
    .map(() => SAMPLE_ID)
    .join("/");

/** `(group)` route folders are layout grouping, never part of the URL. */
const isGroupFolder = (name: string) => name.startsWith("(") && name.endsWith(")");

function pageRoutes(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      /* `src/app` itself contains route folders *and* `(shell)` grouping. */
      if (isGroupFolder(entry)) {
        out.push(...pageRoutes(full, prefix));
        continue;
      }
      out.push(...pageRoutes(full, `${prefix}/${entry}`));
      continue;
    }
    if (entry !== "page.tsx") continue;
    const segments = prefix
      .split("/")
      .filter(Boolean)
      .map((s) => (s.startsWith("[") ? routeParamsToSample(s) : s));
    out.push(segments.length ? `/${segments.join("/")}` : "/");
  }
  return out;
}

const appRoutes = Array.from(new Set(pageRoutes(APP_DIR))).sort();

/* ── Coverage ────────────────────────────────────────────────────────────────
 * The check that matters most: a page nobody can navigate to. The shell is the
 * only way into the app, so an unlisted route is a dead end even though the page
 * itself works. */
const unmapped = appRoutes.filter((route) => resolveNavigation(route).domain === null);
check(
  "every app page resolves to a domain",
  unmapped.length === 0,
  unmapped.length ? `unmapped: ${unmapped.join(", ")}` : `${appRoutes.length} routes all mapped`
);

/* "Resolves to *a* domain" is a weak claim: a resolver that sent every path to
   the first domain passes it while the navigation is completely wrong. This is
 * the check that would have caught that. */
const domainOf = (route: string) => resolveNavigation(route).domain?.id ?? "null";
const distinctDomains = new Set(appRoutes.map(domainOf));
check(
  "routes spread across the domains instead of collapsing into one",
  distinctDomains.size >= 6,
  `${distinctDomains.size} distinct domains: ${Array.from(distinctDomains).sort().join(",")}`
);

/* Spot-check the mapping that the whole sidebar is built on, one page per
   domain, so a regression names the domain it broke. */
const EXPECTED: Array<[string, string]> = [
  ["/", "overview"],
  ["/chat", "overview"],
  ["/agents", "workforce"],
  ["/agents/abc", "workforce"],
  ["/colonies", "workforce"],
  ["/architect", "workforce"],
  ["/capabilities", "workforce"],
  ["/missions", "execution"],
  ["/missions/new", "execution"],
  ["/tasks", "execution"],
  ["/workflows", "execution"],
  ["/automations", "automation"],
  ["/memory", "intelligence"],
  ["/knowledge", "intelligence"],
  ["/decisions", "intelligence"],
  ["/models", "model-brain"],
  ["/routing", "model-brain"],
  ["/tools", "tool-fabric"],
  ["/mcp", "tool-fabric"],
  ["/connectors", "tool-fabric"],
  ["/topology", "observatory"],
  ["/observability/events", "observatory"],
  ["/observability/traces", "observatory"],
  ["/observability/traces/abc", "observatory"],
  ["/observability/logs", "observatory"],
  ["/observability/performance", "observatory"],
  ["/observability/costs", "observatory"],
  ["/settings", "system"],
  ["/edit-queue", "system"],
];
const wrongDomain = EXPECTED.filter(([route, want]) => domainOf(route) !== want);
check(
  "each route maps to the domain it belongs to",
  wrongDomain.length === 0,
  wrongDomain.length
    ? wrongDomain.map(([r, w]) => `${r}: want ${w}, got ${domainOf(r)}`).join("; ")
    : `${EXPECTED.length} routes verified`
);

/* Detail routes are the easy ones to forget — the list page is listed, the
 * `[id]` page is not, and it is only reachable by clicking a row. */
const detailRoutes = appRoutes.filter((r) => r.includes(SAMPLE_ID));
const detailUnmapped = detailRoutes.filter((r) => resolveNavigation(r).domain === null);
check(
  "every dynamic page resolves through its parent's prefix",
  detailUnmapped.length === 0,
  detailUnmapped.length ? detailUnmapped.join(", ") : `${detailRoutes.length} dynamic routes mapped`
);

/* ── Uniqueness ───────────────────────────────────────────────────────────── */
const allHrefs = NAV_DOMAINS.flatMap((d) => d.children.map((c) => ({ href: c.href, domain: d.label })));
const seen = new Map<string, string[]>();
for (const { href, domain } of allHrefs) {
  seen.set(href, [...(seen.get(href) ?? []), domain]);
}
const duplicates = Array.from(seen.entries()).filter(([, domains]) => domains.length > 1);
check(
  "no destination is listed twice",
  duplicates.length === 0,
  duplicates.length ? duplicates.map(([h, d]) => `${h} in ${d.join(" + ")}`).join("; ") : `${seen.size} unique hrefs`
);

const domainIds = NAV_DOMAINS.map((d) => d.id);
check(
  "domain ids are unique",
  new Set(domainIds).size === domainIds.length,
  domainIds.join(",")
);

/* ── Boundary matching ───────────────────────────────────────────────────────
 * `startsWith` without a boundary would make `/agents` claim `/agentsfoo`. The
 * negative cases below are the actual hazard; the positive ones are the promise. */
check(
  "a prefix does not swallow a lookalike path",
  !matchesPath("/tasksomething", "/task") && !matchesPath("/agentsfoo", "/agents"),
  "/task vs /tasksomething, /agents vs /agentsfoo"
);
check(
  "a prefix does claim its own descendants",
  matchesPath("/agents/abc", "/agents") && matchesPath("/observability/traces/abc", "/observability/traces"),
  "detail routes match their parent"
);
check("an exact path matches exactly", matchesPath("/missions", "/missions") && matchesPath("/mission", "/missions") === false);

/* The root is the trap: `matchesPath(anything, "/")` is true, so a resolver that
   walked the config in one pass would let Overview's "Command Center" claim
   every route. */
check(
  "the root does not shadow every other route",
  resolveNavigation("/").domain?.id === "overview" &&
    resolveNavigation("/settings").domain?.id === "system" &&
    resolveNavigation("/topology").domain?.id === "observatory" &&
    resolveNavigation("/edit-queue").domain?.id === "system",
  "/ -> overview, /settings -> system, /topology -> observatory, /edit-queue -> system"
);

/* ── Shape ─────────────────────────────────────────────────────────────────── */
check(
  "every domain has an icon and at least one child",
  NAV_DOMAINS.every((d) => !!d.icon && d.children.length > 0),
  NAV_DOMAINS.map((d) => `${d.id}:${d.children.length}`).join(" ")
);
check(
  "every child has a label and an absolute href",
  allHrefs.every(() => true) &&
    NAV_DOMAINS.every((d) => d.children.every((c) => !!c.label && c.href.startsWith("/"))),
  "labels present, hrefs root-relative"
);

/* Every listed href has to exist as a real page, or the nav links to a 404. */
const missingPages = allHrefs
  .map((h) => h.href)
  .filter((href) => !appRoutes.includes(href));
check(
  "every listed href is a page that exists",
  missingPages.length === 0,
  missingPages.length ? missingPages.join(", ") : `${allHrefs.length} hrefs exist`
);

/* ── Requested IA ──────────────────────────────────────────────────────────── */
const labelFor = (href: string) =>
  NAV_DOMAINS.flatMap((d) => d.children).find((c) => c.href === href)?.label;

/* The three renames decided in review. Each maps an existing route onto the
 * requested label; getting one wrong silently drops the page out of the panel. */
check(
  "renamed routes still point at the original href",
  labelFor("/knowledge") === "Knowledge" &&
    labelFor("/mcp") === "MCP" &&
    labelFor("/connectors") === "Connectors",
  "Knowledge, MCP, Connectors"
);
check(
  "Metrics is a label on the performance route",
  labelFor("/observability/performance") === "Metrics",
  `/observability/performance -> ${labelFor("/observability/performance")}`
);
/* Nothing lost in the move: Live Topology and Costs stayed reachable. */
check(
  "topology and costs remain in navigation",
  labelFor("/topology") === "Live Topology" && labelFor("/observability/costs") === "Costs",
  "Live Topology, Costs"
);
check(
  "Edit Queue is reachable from System",
  resolveNavigation("/edit-queue").domain?.id === "system" && labelFor("/edit-queue") === "Edit Queue",
  "/edit-queue -> system"
);

/* A domain must never carry a third level of grouping. `kind: "section"` is the
 * one escape hatch (AI Chat's history) and it is opt-in per child. */
check(
  "no domain nests another domain",
  !NAV_DOMAINS.some((d) => d.children.some((c) => "children" in (c as object))),
  "flat children only"
);

/* ── Persistence round-trip ────────────────────────────────────────────────── */
const allResolvable = NAV_DOMAINS.every((d) => domainById(d.id)?.id === d.id);
check(
  "every domain id resolves back to its domain",
  allResolvable && domainById("not-a-domain") === null && domainById(null) === null,
  "valid ids resolve, unknown and null do not"
);

const failed = results.filter((r) => r.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
