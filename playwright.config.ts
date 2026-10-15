import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5174",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
  },
  webServer: [
    {
      command: "npx tsx server/e2e.ts",
      url: "http://127.0.0.1:3002/api/health",
      reuseExistingServer: false,
    },
    {
      command: "TROVE_API_PORT=3002 npx vite --port 5174",
      url: "http://localhost:5174",
      reuseExistingServer: false,
    },
  ],
});
