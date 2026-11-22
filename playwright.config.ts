import { defineConfig } from "@playwright/test";
// Runs against `wrangler dev` (npm run dev) on port 8787 with .dev.vars (AI_MOCK=1, ALLOW_TEST_CLOCK=1).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  use: { baseURL: process.env.BASE_URL ?? "http://127.0.0.1:8787", channel: process.env.PW_CHANNEL || undefined },
  workers: 1,
});
