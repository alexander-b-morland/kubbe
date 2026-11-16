import { defineConfig } from "@playwright/test";

// End-to-end tests run against the dev server in a phone-sized window.
// They use the Edge that ships with Windows, so no browser download is needed.
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 120_000,
  // The database is far from a developer machine, so a save can take a few seconds locally.
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3000",
    channel: "msedge",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
