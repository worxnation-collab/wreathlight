-- 0002: replace the scaffold schema (0001, already applied to remote D1 on 2026-11-22 with zero rows)
-- with the app schema. 0001 is never edited because D1 tracks applied migrations by file name.
-- Dropping is safe ONLY because every table was verified empty (0 rows) before this migration
-- was written; SQLite cannot add NOT NULL / CHECK constraints with ALTER TABLE, so a rebuild is
-- the only way to get the exact constraints the app relies on.
DROP INDEX IF EXISTS idx_nights_church_status_date;
DROP INDEX IF EXISTS idx_lights_church_day;
DROP INDEX IF EXISTS idx_ai_runs_created;
DROP TABLE IF EXISTS pastors;
DROP TABLE IF EXISTS churches;
DROP TABLE IF EXISTS church_admins;
DROP TABLE IF EXISTS nights;
DROP TABLE IF EXISTS lights;
DROP TABLE IF EXISTS households;
DROP TABLE IF EXISTS ai_runs;
DROP TABLE IF EXISTS rate;

-- Wreathlight schema. No PII except the pastor's email. No IP addresses anywhere.
CREATE TABLE pastors (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  pw_hash TEXT NOT NULL,
  pw_salt TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE churches (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  city TEXT,
  pastor_display_name TEXT NOT NULL,
  tz TEXT NOT NULL DEFAULT 'America/New_York',
  tradition TEXT NOT NULL,
  translation TEXT NOT NULL,
  season_start TEXT NOT NULL,
  season_end TEXT NOT NULL,
  theme TEXT NOT NULL,
  sermons_json TEXT,
  xmas_eve_times TEXT,
  spanish_on INTEGER NOT NULL DEFAULT 1,
  keep_going_on INTEGER NOT NULL DEFAULT 1,
  keep_going_church_url TEXT,
  ai_on INTEGER NOT NULL DEFAULT 1,
  is_demo INTEGER NOT NULL DEFAULT 0,
  draft_json TEXT,            -- drafting progress for the Studio progress view
  created_at TEXT NOT NULL
);

CREATE TABLE church_admins (
  church_id TEXT NOT NULL,
  pastor_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  PRIMARY KEY (church_id, pastor_id)
);

CREATE TABLE nights (
  id TEXT PRIMARY KEY,
  church_id TEXT NOT NULL,
  night INTEGER NOT NULL,
  date TEXT NOT NULL,
  reference TEXT NOT NULL,
  ref_key TEXT,
  verse_en TEXT,
  verse_es TEXT,
  why TEXT,
  talk_json TEXT,
  pray TEXT,
  do_text TEXT,
  es_json TEXT,               -- Spanish prose {why, talk, pray, do, reference}
  es_approved INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL CHECK (source IN ('ai', 'starter', 'pastor')),
  edited INTEGER NOT NULL DEFAULT 0,
  model TEXT,
  checks_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected')),
  approved_by TEXT,
  approved_name TEXT,
  approved_at TEXT,
  content_hash TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (church_id, night)
);
CREATE INDEX nights_church_status ON nights (church_id, status, date);

-- household = SHA-256(random device UUID + church_id); never reversible to a person
CREATE TABLE lights (
  church_id TEXT NOT NULL,
  night INTEGER NOT NULL,
  household TEXT NOT NULL,
  day TEXT NOT NULL,
  PRIMARY KEY (church_id, night, household)
);
CREATE INDEX lights_church_day ON lights (church_id, day);

CREATE TABLE households (
  church_id TEXT NOT NULL,
  household TEXT NOT NULL,
  joined_day TEXT NOT NULL,
  PRIMARY KEY (church_id, household)
);

CREATE TABLE ai_runs (
  id TEXT PRIMARY KEY,
  church_id TEXT,
  week INTEGER,
  model TEXT,
  ms INTEGER,
  outcome TEXT,
  checks_json TEXT,
  prompt_text TEXT,           -- purged after 7 days by the cron
  created_at TEXT NOT NULL
);
CREATE INDEX ai_runs_church ON ai_runs (church_id, created_at);

-- login, light and AI caps; key uses a daily-salted IP hash, never a raw IP
CREATE TABLE rate (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start TEXT NOT NULL
);
