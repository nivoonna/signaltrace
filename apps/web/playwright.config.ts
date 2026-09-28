import { defineConfig } from "@playwright/test";

// Run both local services first. Each test creates its own UUID session; no
// existing records are updated or deleted. Override the URL for another port.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    headless: true,
    viewport: { width: 1440, height: 1160 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
