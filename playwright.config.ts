import { defineConfig, devices } from "@playwright/test";

/**
 * E2E 端口唯一真源：PLAYWRIGHT_BASE_URL。
 * - 未设置时保持历史默认 http://127.0.0.1:3000（行为不变）。
 * - 设置后 use.baseURL、webServer.url、dev server 端口三者全部由它派生，
 *   消灭「config 写死 3000 / spec 写死 3000」的双真源问题：
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:3210 npx playwright test  即可在非 3000 端口跑，零改源码。
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const parsedPort = new URL(baseURL).port;
if (!parsedPort) {
  throw new Error(`PLAYWRIGHT_BASE_URL 必须带显式端口，收到：${baseURL}`);
}
const port = parsedPort;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    serviceWorkers: "allow",
  },
  webServer: {
    // next dev 支持 -p <port>（默认 3000，env PORT）；这里显式传端口，保证与 url 同源。
    command: `pnpm dev --hostname 127.0.0.1 -p ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], browserName: "chromium", viewport: { width: 390, height: 844 } } },
  ],
});
