import process from "node:process";

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  forbidOnly: process.env.CI === "true",
  fullyParallel: false,
  reporter: "list",
  retries: process.env.CI === "true" ? 1 : 0,
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      name: "NetScry web",
      command: "bun scripts/alchemy-dev.ts dev",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      name: "NetScry docs",
      command: "bun tests/e2e/serve-docs.ts",
      url: "http://127.0.0.1:4321/api/v1/",
      reuseExistingServer: false,
      timeout: 10_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
