import type { NextConfig } from "next";

const api = (process.env.SIGNALTRACE_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const config: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/events", destination: `${api}/events` },
      { source: "/api/sessions/:session_id/events", destination: `${api}/sessions/:session_id/events` },
    ];
  },
};

export default config;
