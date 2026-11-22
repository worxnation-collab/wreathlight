-- 0004: small ops switches, flipped by Forge with `wrangler d1 execute` (see README "Demo church").
-- demo_reset_paused = '1' skips the hourly demo-church reset (purges still run).
CREATE TABLE IF NOT EXISTS app_flags (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
