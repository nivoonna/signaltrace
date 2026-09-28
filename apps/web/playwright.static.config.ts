import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-static",
  outputDir: "./test-results/static",
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173/signaltrace/",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    headless: true,
    viewport: { width: 1440, height: 1100 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve-static.mjs",
    url: "http://127.0.0.1:4173/signaltrace/",
    reuseExistingServer: false,
  },
});
