import type { NextConfig } from "next";
import { SIGNED_IN_PREFIXES } from "./src/core/pwa/cache-policy";

// Signed-in areas and the API must never be kept by a browser, proxy or the service worker. Next keeps a
// Cache-Control set here on app-router pages, prerendered ones included (checked against next start on 16.3.4).
const NO_STORE = SIGNED_IN_PREFIXES.map((prefix) => ({
  source: `${prefix}/:path*`,
  headers: [{ key: "Cache-Control", value: "no-store" }],
}));

const nextConfig: NextConfig = {
  async headers() {
    return [
      ...NO_STORE,
      // Checked on every navigation so a new worker (and its cache version) is picked up straight away.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default nextConfig;
