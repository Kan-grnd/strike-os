/* Universal-state coverage checks (M4.5).
 *
 * M4.5's promise is "no surface renders blank or a bare spinner". The
 * framework-level half of that is structural and can be asserted from the
 * filesystem: the app must define an error boundary, a 404, a root loading
 * skeleton and a global-error fallback, and every dynamic detail route must
 * ship a loading skeleton so navigating to it never flashes empty.
 *
 * The other half — each surface's *inline* loading/empty/error branches — is a
 * per-page concern checked in review and e2e, not statically here.
 *
 * Run: npx tsx scripts/check-states.ts
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const APP = join(process.cwd(), "src/app");
const results: string[] = [];
const check = (label: string, ok: boolean, detail?: string) => {
  results.push(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

/* ── App-level states exist ─────────────────────────────────────────────────── */
for (const file of ["loading.tsx", "error.tsx", "not-found.tsx", "global-error.tsx"]) {
  check(`app-level ${file} exists`, existsSync(join(APP, file)));
}

/* ── The error boundary is a client component (Next requires it) ─────────────── */
const errorSrc = existsSync(join(APP, "error.tsx"))
  ? readFileSync(join(APP, "error.tsx"), "utf8")
  : "";
const globalErrorSrc = existsSync(join(APP, "global-error.tsx"))
  ? readFileSync(join(APP, "global-error.tsx"), "utf8")
  : "";
check("error.tsx is a client boundary with reset()", /"use client"/.test(errorSrc) && /\breset\b/.test(errorSrc));
check(
  "global-error.tsx renders its own html/body",
  /"use client"/.test(globalErrorSrc) && /<html/.test(globalErrorSrc) && /<body/.test(globalErrorSrc)
);

/* ── Every dynamic detail route ships a loading skeleton ────────────────────── */
function findDirs(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    /* API route handlers do not render UI, so they need no loading skeleton. */
    if (entry === "api") continue;
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    if (entry.startsWith("[") && !entry.includes("...")) out.push(full);
    findDirs(full, out);
  }
  return out;
}
const dynamicDirs = findDirs(APP);
const missingLoading = dynamicDirs.filter((d) => !existsSync(join(d, "loading.tsx")));
check(
  "every dynamic detail route has a loading.tsx",
  missingLoading.length === 0,
  missingLoading.length
    ? missingLoading.map((d) => d.replace(APP + "/", "")).join(", ")
    : `${dynamicDirs.length} dynamic routes covered`
);

const failed = results.filter((r) => r.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
