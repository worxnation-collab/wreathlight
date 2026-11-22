export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SESSION_SECRET?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GEMINI_FALLBACK_MODEL?: string;
  AI_ENABLED?: string;
  AI_MOCK?: string; // "1" = deterministic local drafter (dev only)
  MOCK_BAD_NIGHTS?: string; // dev only: comma list of nights the mock answers with a bad reference
  ALLOW_TEST_CLOCK?: string; // "1" = honor X-Test-Now header (dev/CI only)
  DEMO_RESET_PAUSED?: string; // "1" = skip the hourly demo-church reset (also a D1 flag, see demo.ts)
  MAX_AI_CALLS_PER_CHURCH_PER_DAY?: string;
  MAX_AI_CALLS_GLOBAL_PER_DAY?: string;
}
