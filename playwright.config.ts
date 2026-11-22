import { defineConfig } from "@playwright/test";
// Runs against `wrangler dev` on port 8787 with .dev.vars (AI_MOCK=1, ALLOW_TEST_CLOCK=1; copy .dev.vars.example).
// Set BASE_URL to test an already-running server (or a preview URL) instead.
const external = !!process.env.BASE_URL;
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: process.env.BASE_URL ?? "http://127.0.0.1:8787", channel: process.env.PW_CHANNEL || undefined },
  workers: 1,
  webServer: external
    ? undefined
    : {
        command: "npm run build:client && npx wrangler dev --local --port 8787 --ip 127.0.0.1",
        url: "http://127.0.0.1:8787/api/health",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
