/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next 14 keeps the instrumentation hook behind this flag; without it
  // src/instrumentation.ts never runs, so the task scheduler never starts.
  experimental: {
    instrumentationHook: true,
  },
  // M4.3 retired the half-finished route merge. There are no redirects: the
  // Missions domain is real, workflow/automation detail folds into mission
  // triggers, and the merged /work page is gone. A route either exists or is a
  // genuine 404 — no surface hides behind a 308.
}

module.exports = nextConfig