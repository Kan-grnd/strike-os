/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next 14 keeps the instrumentation hook behind this flag; without it
  // src/instrumentation.ts never runs, so the task scheduler never starts.
  experimental: {
    instrumentationHook: true,
  },
  async redirects() {
    return [
      /* Workflows and the duplicate Automations surface still live under the
       * merged /work page for now; M4.3 retires them when the five-domain IA
       * lands. Missions is a real page again as of M4.2 (the redirect had to go
       * or the page could never serve — redirects run before routing. 308 so a
       * POST to a legacy list route keeps its method and payload. */
      { source: "/workflows", destination: "/work", statusCode: 308 },
      { source: "/automations", destination: "/work?type=automations", statusCode: 308 },
      { source: "/automations/:path*", destination: "/workflows/:path*", statusCode: 308 },
    ];
  },
}

module.exports = nextConfig