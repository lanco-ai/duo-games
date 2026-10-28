import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const data = mkdtempSync(join(tmpdir(), "duo-e2e-"));
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120000,
  expect: { timeout: 12000 },
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8791",
    viewport: { width: 390, height: 844 },
    headless: true,
    launchOptions: { args: ["--disable-dev-shm-usage", "--no-sandbox"] },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "node --disable-warning=ExperimentalWarning tests/e2e/clock-server.mjs",
    env: { PORT: "8791", DATA_DIR: data },
    url: "http://127.0.0.1:8791/api/health",
    reuseExistingServer: false,
    timeout: 15000,
  },
});
