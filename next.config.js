/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      /* Missions, Workflows and the duplicate Automations surface all live
       * under the merged /work page now. Workflow detail stays at its own
       * route; automation detail was never its own page. 308 so a POST to any
       * legacy list route keeps its method and payload. */
      { source: "/missions", destination: "/work", statusCode: 308 },
      { source: "/workflows", destination: "/work", statusCode: 308 },
      { source: "/automations", destination: "/work?type=workflows", statusCode: 308 },
      { source: "/automations/:path*", destination: "/workflows/:path*", statusCode: 308 },
    ];
  },
}

module.exports = nextConfig