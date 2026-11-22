-- Wreathlight initial schema (spec section 4).
-- Privacy: the only PII column is pastors.email. No IP addresses are stored anywhere.

CREATE TABLE IF NOT EXISTS pastors (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  pw_hash TEXT NOT NULL,
  pw_salt TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS churches (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  city TEXT,
  tz TEXT DEFAULT 'America/New_York',
  tradition TEXT,
  translation TEXT,
  season_start TEXT,
  season_end TEXT,
  theme TEXT,
  sermons_json TEXT,
  xmas_eve_times TEXT,
  spanish_on INTEGER DEFAULT 0,
  keep_going_on INTEGER DEFAULT 0,
  keep_going_church_url TEXT,
  ai_on INTEGER DEFAULT 1,
  is_demo INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS church_admins (
  church_id TEXT NOT NULL,
  pastor_id TEXT NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (church_id, pastor_id)
);

CREATE TABLE IF NOT EXISTS nights (
  id TEXT PRIMARY KEY,
  church_id TEXT NOT NULL,
  night INTEGER NOT NULL,
  date TEXT NOT NULL,
  reference TEXT,
  verse_en TEXT,
  verse_es TEXT,
  why TEXT,
  talk_json TEXT,
  pray TEXT,
  do_text TEXT,
  es_json TEXT,
  source TEXT CHECK (source IN ('ai', 'starter', 'pastor')),
  checks_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected')),
  approved_by TEXT,
  approved_at TEXT,
  content_hash TEXT,
  updated_at TEXT,
  UNIQUE (church_id, night)
);

-- household = SHA-256(random device UUID + church_id); never reversible to a person.
CREATE TABLE IF NOT EXISTS lights (
  church_id TEXT NOT NULL,
  night INTEGER NOT NULL,
  household TEXT NOT NULL,
  day TEXT NOT NULL,
  PRIMARY KEY (church_id, night, household)
);

CREATE TABLE IF NOT EXISTS households (
  church_id TEXT NOT NULL,
  household TEXT NOT NULL,
  joined_day TEXT NOT NULL,
  PRIMARY KEY (church_id, household)
);

CREATE TABLE IF NOT EXISTS ai_runs (
  id TEXT PRIMARY KEY,
  church_id TEXT,
  week INTEGER,
  model TEXT,
  ms INTEGER,
  outcome TEXT,
  checks_json TEXT,
  created_at TEXT NOT NULL
);

-- Rate limits and AI caps. key = SHA-256(ip + DAILY_SALT); raw IPs are never stored.
CREATE TABLE IF NOT EXISTS rate (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nights_church_status_date ON nights (church_id, status, date);
CREATE INDEX IF NOT EXISTS idx_lights_church_day ON lights (church_id, day);
CREATE INDEX IF NOT EXISTS idx_ai_runs_created ON ai_runs (created_at);
