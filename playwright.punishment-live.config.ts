import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PUNISHMENT_LIVE_URL;
if (!baseURL) throw new Error("Set PUNISHMENT_LIVE_URL to the deployed site URL");

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["punishment.spec.ts", "punishment-production.spec.ts"],
  timeout: 30000,
  retries: 0,
  reporter: "list",
  use: { baseURL, serviceWorkers: "allow", trace: "retain-on-failure" },
  projects: [{ name: "live-mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } }],
});
