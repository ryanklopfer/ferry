import type { NextConfig } from "next";

// Signed-in areas and the API must never be kept by a browser, proxy or the service worker.
const NO_STORE = ["/app", "/c", "/i", "/api"].map((prefix) => ({
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
