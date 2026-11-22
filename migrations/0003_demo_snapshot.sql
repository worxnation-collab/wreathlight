-- 0003: snapshot of the demo church's nights, restored by the hourly demo reset.
-- Filled by `npm run seed:demo:remote -- --capture` after the demo church is drafted by the real pipeline.
CREATE TABLE IF NOT EXISTS demo_snapshot (
  church_id TEXT PRIMARY KEY,
  nights_json TEXT NOT NULL,
  captured_at TEXT NOT NULL
);
