import type { NextConfig } from "next";

const api = (process.env.SIGNALTRACE_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const staticDemo = process.env.SIGNALTRACE_STATIC_DEMO === "1";

const config: NextConfig = {
  env: { NEXT_PUBLIC_SIGNALTRACE_MODE: staticDemo ? "static-demo" : "full-stack" },
  ...(staticDemo ? {
    output: "export",
    basePath: "/signaltrace",
    trailingSlash: true,
    images: { unoptimized: true },
  } : { async rewrites() {
    return [
      { source: "/api/events", destination: `${api}/events` },
      { source: "/api/sessions/:session_id/events", destination: `${api}/sessions/:session_id/events` },
      { source: "/api/diagnostics/:path*", destination: `${api}/diagnostics/:path*` },
    ];
  } }),
};

export default config;
