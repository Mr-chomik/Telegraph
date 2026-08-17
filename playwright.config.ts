import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end suite for the Fun digital newspaper.
 *
 * Data is prepared by `e2e/global-setup.ts` (PostgreSQL via docker-compose,
 * migrations, demo seed, then the process + edition jobs are run once). The web
 * server is started for the suite by Playwright's `webServer`.
 *
 * Browser: the installed Microsoft Edge channel is used so no Chromium download
 * is required. Swap to `devices["Desktop Chrome"]` (and `npx playwright install
 * chromium`) if Edge is unavailable.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: process.env.CI ? "chromium" : "msedge",
      use:
        process.env.CI !== undefined
          ? { ...devices["Desktop Chrome"] }
          : { ...devices["Desktop Chrome"], channel: "msedge" },
    },
  ],
  webServer: [
    {
      command: "npm run dev:web",
      url: "http://localhost:3000/login",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});