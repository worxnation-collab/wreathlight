/**
 * Hope Creek Community Church (demo): a fictional church for judges, reset to its seed every hour.
 *
 * One source of truth for both the hourly reset in scheduled() and scripts/seed-demo.ts.
 * - Church settings, the 27 nights and the synthetic activity are restored on every reset.
 * - Nights come from `demo_snapshot` (captured from a real pipeline run with `seed-demo --capture`);
 *   until a snapshot exists they come from the Starter Plan, honestly labeled source='starter'.
 * - The judge login (DEMO_EMAIL) is never created here: its password is set separately and never
 *   stored in the repo. If that pastor exists, reset re-links it and removes any extra churches it made.
 * - Households are random-looking hashes of fixed seeds. No names, nicknames or people, ever.
 */
import { seasonNights, SEASONS, todayIn, addDays } from "../shared/season";
import { validateNight } from "../shared/validator";
import { hashPassword } from "./auth";
import { starterFor } from "./draft";
import { nowIso, uuid } from "./util";

export const DEMO_CHURCH_ID = "demo-hope-creek";
export const DEMO_CODE = "HOPE25";
export const DEMO_EMAIL = "demo@wreathlight.app";
export const DEMO_PASTOR = "Pastor Dana (demo)";
export const DEMO_HOUSEHOLDS = 63;
/** Nights left in draft so judges can see the approval queue. */
export const DEMO_DRAFT_NIGHTS = [26, 27];
const TZ = "America/New_York";
const SEED_CREATED_AT = "2026-11-22T12:00:00.000Z";

export interface Stmt { sql: string; params: (string | number | null)[] }

/** Column list shared by the snapshot capture and the restore. */
export const NIGHT_COLS = [
  "night", "date", "reference", "ref_key", "verse_en", "verse_es", "why", "talk_json", "pray", "do_text", "es_json",
  "es_approved", "source", "edited", "model", "checks_json", "status", "approved_name", "approved_at", "content_hash",
] as const;
export type SnapshotNight = Record<(typeof NIGHT_COLS)[number], string | number | null>;

const SERMONS = [
  { title: "Waiting in the Dark (demo sermon)", passage: "Isaiah 9:2-7" },
  { title: "Little Bethlehem (demo sermon)", passage: "Micah 5:2-5" },
  { title: "Good News for Shepherds (demo sermon)", passage: "Luke 2:8-20" },
  { title: "Glory and Peace (demo sermon)", passage: "Luke 2:13-14" },
];

/** Deterministic 0..1 value from integers (no Math.random so every reset looks the same). */
function unit(a: number, b: number): number {
  let x = (a * 374761393 + b * 668265263) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
/** Synthetic household id: 64 hex chars derived from a fixed seed; not linked to any device or person. */
export function demoHousehold(i: number): string {
  let out = "";
  for (let k = 0; out.length < 64; k++) out += Math.floor(unit(i + 1, k + 7919) * 0xffffffff).toString(16).padStart(8, "0");
  return out.slice(0, 64);
}

/** Starter Plan placeholder nights for the demo season (used until a real-pipeline snapshot is captured). */
export function starterDemoNights(): SnapshotNight[] {
  const used = new Set<string>();
  const approvedAt = SEED_CREATED_AT;
  return seasonNights(SEASONS.nov29.start, SEASONS.nov29.end).map(({ night, date }) => {
    const content = starterFor(date, night);
    const r = validateNight(content, { translation: "bsb", spanish: true, tradition: "hope", usedRefKeys: used });
    if (r.refKey) used.add(r.refKey);
    const draft = DEMO_DRAFT_NIGHTS.includes(night);
    const es = content.es ? { ...content.es, reference: r.reference_es ?? null } : null;
    return {
      night, date, reference: r.reference ?? content.reference, ref_key: r.refKey ?? null,
      verse_en: r.verse_en ?? null, verse_es: r.verse_es ?? null, why: content.why, talk_json: JSON.stringify(content.talk),
      pray: content.pray, do_text: content.do, es_json: es ? JSON.stringify(es) : null, es_approved: draft ? 0 : 1,
      source: "starter", edited: 0, model: null,
      checks_json: JSON.stringify({ ok: r.ok, issues: r.issues, checks: r.checks, attempts: [] }),
      status: draft ? "draft" : "approved", approved_name: draft ? null : DEMO_PASTOR,
      approved_at: draft ? null : approvedAt, content_hash: null,
    };
  });
}

/**
 * Statements that reset the demo church. Idempotent: running it twice leaves the same state.
 * `now` decides which nights have synthetic lights (the current Advent week up to today).
 */
export function demoResetStatements(now: Date, snapshot: SnapshotNight[] | null): Stmt[] {
  const s: Stmt[] = [];
  const nights = snapshot && snapshot.length ? snapshot : starterDemoNights();
  const id = DEMO_CHURCH_ID;

  // Remove anything judges created under the demo login, except the demo church itself.
  const extra = `SELECT a.church_id FROM church_admins a JOIN pastors p ON p.id = a.pastor_id WHERE p.email = ? AND a.church_id <> ?`;
  for (const t of ["nights", "lights", "households", "ai_runs"]) {
    s.push({ sql: `DELETE FROM ${t} WHERE church_id IN (${extra})`, params: [DEMO_EMAIL, id] });
  }
  s.push({ sql: `DELETE FROM churches WHERE id IN (${extra})`, params: [DEMO_EMAIL, id] });
  s.push({ sql: `DELETE FROM church_admins WHERE church_id IN (${extra})`, params: [DEMO_EMAIL, id] });

  s.push({
    sql: `INSERT INTO churches (id, code, name, city, pastor_display_name, tz, tradition, translation, season_start, season_end, theme,
            sermons_json, xmas_eve_times, spanish_on, keep_going_on, keep_going_church_url, ai_on, is_demo, draft_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'hope', 'bsb', ?, ?, 'prophecy', ?, ?, 1, 1, NULL, 1, 1, NULL, ?)
          ON CONFLICT(id) DO UPDATE SET code=excluded.code, name=excluded.name, city=excluded.city,
            pastor_display_name=excluded.pastor_display_name, tz=excluded.tz, tradition=excluded.tradition,
            translation=excluded.translation, season_start=excluded.season_start, season_end=excluded.season_end,
            theme=excluded.theme, sermons_json=excluded.sermons_json, xmas_eve_times=excluded.xmas_eve_times,
            spanish_on=1, keep_going_on=1, keep_going_church_url=NULL, ai_on=1, is_demo=1, draft_json=NULL`,
    params: [id, DEMO_CODE, "Hope Creek Community Church (demo)", "Lakeside", DEMO_PASTOR, TZ, SEASONS.nov29.start,
      SEASONS.nov29.end, JSON.stringify(SERMONS), "Dec 24 · 5:00 PM family service · 9:00 PM candlelight (demo)", SEED_CREATED_AT],
  });
  // Re-link the judge login if it exists (its password is set outside the repo).
  s.push({ sql: `DELETE FROM church_admins WHERE church_id = ?`, params: [id] });
  s.push({ sql: `INSERT OR IGNORE INTO church_admins (church_id, pastor_id, role) SELECT ?, id, 'owner' FROM pastors WHERE email = ?`, params: [id, DEMO_EMAIL] });

  // Nights.
  s.push({ sql: `DELETE FROM nights WHERE church_id = ?`, params: [id] });
  const cols = ["id", "church_id", ...NIGHT_COLS, "approved_by", "updated_at"];
  for (const n of nights) {
    s.push({
      sql: `INSERT INTO nights (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      params: [`${id}-n${n.night}`, id, ...NIGHT_COLS.map((c) => n[c] ?? null), null, SEED_CREATED_AT],
    });
  }

  // Synthetic activity: 63 households, lights for the current Advent week up to today.
  s.push({ sql: `DELETE FROM lights WHERE church_id = ?`, params: [id] });
  s.push({ sql: `DELETE FROM households WHERE church_id = ?`, params: [id] });
  const today = todayIn(TZ, now);
  const dates = new Map(nights.map((n) => [String(n.date), Number(n.night)]));
  const first = String(nights[0]?.date ?? SEASONS.nov29.start);
  // Before Advent starts, show the first week as if it were in progress (demo preview).
  const anchor = today < first ? addDays(first, 6) : today;
  const window: { night: number; date: string }[] = [];
  for (let d = 0; d < 7; d++) {
    const date = addDays(anchor, -d);
    const night = dates.get(date);
    if (night && date >= first) window.push({ night, date });
  }
  const hh: string[] = [];
  const lights: [number, string, string][] = [];
  for (let i = 0; i < DEMO_HOUSEHOLDS; i++) {
    const h = demoHousehold(i);
    hh.push(h);
    for (const w of window) if (unit(i, w.night) < 0.55) lights.push([w.night, h, w.date]);
  }
  const joined = addDays(first, -3);
  for (let i = 0; i < hh.length; i += 20) {
    const chunk = hh.slice(i, i + 20);
    s.push({
      sql: `INSERT OR IGNORE INTO households (church_id, household, joined_day) VALUES ${chunk.map(() => "(?, ?, ?)").join(", ")}`,
      params: chunk.flatMap((h) => [id, h, joined]),
    });
  }
  for (let i = 0; i < lights.length; i += 25) {
    const chunk = lights.slice(i, i + 25);
    s.push({
      sql: `INSERT OR IGNORE INTO lights (church_id, night, household, day) VALUES ${chunk.map(() => "(?, ?, ?, ?)").join(", ")}`,
      params: chunk.flatMap(([n, h, d]) => [id, n, h, d]),
    });
  }
  return s;
}

/** SQL that copies the demo church's current nights into demo_snapshot (run after a real pipeline run). */
export const CAPTURE_SQL = `INSERT OR REPLACE INTO demo_snapshot (church_id, nights_json, captured_at)
  SELECT '${DEMO_CHURCH_ID}', json_group_array(json_object(${NIGHT_COLS.map((c) => `'${c}', ${c}`).join(", ")})), strftime('%Y-%m-%dT%H:%M:%fZ','now')
  FROM (SELECT * FROM nights WHERE church_id = '${DEMO_CHURCH_ID}' ORDER BY night)`;

export async function loadSnapshot(db: D1Database): Promise<SnapshotNight[] | null> {
  const row = await db.prepare("SELECT nights_json FROM demo_snapshot WHERE church_id = ?").bind(DEMO_CHURCH_ID).first<{ nights_json: string }>();
  if (!row) return null;
  const parsed = JSON.parse(row.nights_json) as SnapshotNight[];
  return parsed.length ? parsed : null;
}

export async function resetDemo(db: D1Database, now = new Date()): Promise<number> {
  const stmts = demoResetStatements(now, await loadSnapshot(db));
  await db.batch(stmts.map((x) => db.prepare(x.sql).bind(...x.params)));
  return stmts.length;
}

/**
 * Ops switch for the hourly demo reset. Paused when the DEMO_RESET_PAUSED var is "1"/"true",
 * or when D1 has app_flags.demo_reset_paused = '1' (flip with `wrangler d1 execute`, no deploy needed).
 */
export async function demoResetPaused(db: D1Database, envFlag?: string): Promise<boolean> {
  if (envFlag === "1" || envFlag?.toLowerCase() === "true") return true;
  try {
    const row = await db.prepare("SELECT value FROM app_flags WHERE key = 'demo_reset_paused'").first<{ value: string }>();
    return row?.value === "1";
  } catch {
    return false; // table not migrated yet: behave as before (reset runs)
  }
}

/** Longest window the demo redraft unlock may be set for. */
export const DEMO_REDRAFT_MAX_MS = 2 * 60 * 60 * 1000;
/**
 * Ops-only switch: whole-season redraft of the demo church is allowed only while
 * app_flags.demo_redraft_until holds an ISO time that is in the future and at most 2 hours away.
 * Off by default (no row); expires on its own, so judges can't trigger it outside an ops window.
 */
export async function demoRedraftUnlocked(db: D1Database, now = new Date()): Promise<boolean> {
  try {
    const row = await db.prepare("SELECT value FROM app_flags WHERE key = 'demo_redraft_until'").first<{ value: string }>();
    const until = row ? Date.parse(row.value) : NaN;
    if (!Number.isFinite(until)) return false;
    const left = until - now.getTime();
    return left > 0 && left <= DEMO_REDRAFT_MAX_MS;
  } catch {
    return false;
  }
}

/** A demo-scoped session may only see churches flagged is_demo. */
export function churchAllowedInDemoScope(isDemoChurch: boolean): boolean {
  return !!isDemoChurch;
}

/** True when this pastor is the shared demo login (DEMO_EMAIL). */
export async function pastorIsDemo(db: D1Database, pastorId: string): Promise<boolean> {
  const row = await db.prepare("SELECT email FROM pastors WHERE id = ?").bind(pastorId).first<{ email: string }>();
  return row?.email === DEMO_EMAIL;
}

/**
 * Ensure the demo pastor exists and is linked as owner of the demo church.
 * If the row is missing, create it with a random unguessable password that is never returned or logged.
 * An existing password (set outside the repo for the judge login) is left untouched.
 */
export async function ensureDemoPastor(db: D1Database): Promise<string> {
  const existing = await db.prepare("SELECT id FROM pastors WHERE email = ?").bind(DEMO_EMAIL).first<{ id: string }>();
  let id = existing?.id;
  if (!id) {
    id = uuid();
    const secret = crypto.getRandomValues(new Uint8Array(32));
    let pw = "";
    for (const b of secret) pw += b.toString(16).padStart(2, "0");
    const { hash, salt } = await hashPassword(pw);
    await db.prepare("INSERT INTO pastors (id, email, pw_hash, pw_salt, display_name, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, DEMO_EMAIL, hash, salt, DEMO_PASTOR, nowIso()).run();
  }
  await db.prepare(
    "INSERT OR IGNORE INTO church_admins (church_id, pastor_id, role) SELECT ?, ?, 'owner' FROM churches WHERE id = ? AND is_demo = 1",
  ).bind(DEMO_CHURCH_ID, id, DEMO_CHURCH_ID).run();
  return id;
}
