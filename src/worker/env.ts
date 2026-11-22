export interface Env {
  DB: D1Database;
  GEMINI_MODEL: string;
  GEMINI_FALLBACK_MODEL: string;
  AI_ENABLED: string;
  /** Secrets, set with `wrangler secret put` (never in wrangler.toml). */
  GEMINI_API_KEY?: string;
  SESSION_SECRET?: string;
}
