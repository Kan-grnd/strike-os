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
      /* Missions, Workflows and the duplicate Automations surface all live
       * under the merged /work page now, where the canonical type facet is
       * `automations`. Automation detail keeps the /workflows route (a
       * workflow is its step flow). 308 so a POST to any legacy list route
       * keeps its method and payload. */
      { source: "/missions", destination: "/work", statusCode: 308 },
      { source: "/workflows", destination: "/work", statusCode: 308 },
      { source: "/automations", destination: "/work?type=automations", statusCode: 308 },
      { source: "/automations/:path*", destination: "/workflows/:path*", statusCode: 308 },
    ];
  },
}

module.exports = nextConfig