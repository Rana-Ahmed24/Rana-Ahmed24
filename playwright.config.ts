import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "phone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "safari", use: { ...devices["iPhone 13"], browserName: "webkit" } },
  ],
  webServer: {
    command: "node scripts/local-preview.mjs --test",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
