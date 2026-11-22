import { Hono, type Context } from "hono";
import { z } from "zod";
import type { Env } from "./env";
import { endSession, hashPassword, ipHash, rateLimit, sessionPastorId, startSession, verifyPassword } from "./auth";
import { churchCode, nowIso, sha256Hex, stableJson, uuid } from "./util";
import { geminiClient, mockClient, type AiClient } from "./ai";
import { draftWeek, starterFor } from "./draft";
import {
  ApproveBody, ChurchCreate, ChurchPatch, JoinBody, LightBody, LoginBody, NightEdit, SignupBody, type ModelNight, type Prose,
} from "../shared/schemas";
import { SEASONS, TRADITIONS, TRANSLATIONS, seasonNights, todayIn, weekOf, ADVENT_SUNDAYS, CHRISTMAS, type ThemeKey, type TraditionKey, type TranslationKey } from "../shared/season";
import { validateNight, numbersMatch, type ValidationResult } from "../shared/validator";
import { useShingleData } from "../shared/scripture";
import shingles from "../../content/bible/shingles.bin";
import { resetDemo } from "./demo";
import { APP_NAME } from "../shared/brand";

useShingleData(shingles);

type C = Context<{ Bindings: Env; Variables: { pastorId: string } }>;
const app = new Hono<{ Bindings: Env; Variables: { pastorId: string } }>();

// ---------- helpers ----------
const THRESHOLD = 5;
/** Counts under 5 are never sent to any client as numbers. */
function thresh(n: number): { value: number | null; label: string } {
  return n < THRESHOLD ? { value: null, label: "fewer than 5" } : { value: n, label: String(n) };
}
function now(c: C): Date {
  const t = c.req.header("x-test-now");
  if (t && c.env.ALLOW_TEST_CLOCK === "1") {
    const d = new Date(t);
    if (!isNaN(+d)) return d;
  }
  return new Date();
}
async function body<T extends z.ZodType>(c: C, schema: T): Promise<z.infer<T> | Response> {
  let raw: unknown;
  try { raw = await c.req.json(); } catch { raw = {}; }
  const r = schema.safeParse(raw);
  if (!r.success) return c.json({ error: "invalid_body", details: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, 400);
  return r.data;
}
const isResp = (x: unknown): x is Response => x instanceof Response;

interface ChurchRow {
  id: string; code: string; name: string; city: string | null; pastor_display_name: string; tz: string;
  tradition: TraditionKey; translation: TranslationKey; season_start: string; season_end: string; theme: ThemeKey;
  sermons_json: string | null; xmas_eve_times: string | null; spanish_on: number; keep_going_on: number;
  keep_going_church_url: string | null; ai_on: number; is_demo: number; draft_json: string | null; created_at: string;
}
interface NightRow {
  id: string; church_id: string; night: number; date: string; reference: string; ref_key: string | null;
  verse_en: string | null; verse_es: string | null; why: string | null; talk_json: string | null; pray: string | null;
  do_text: string | null; es_json: string | null; es_approved: number; source: "ai" | "starter" | "pastor"; edited: number;
  model: string | null; checks_json: string | null; status: "draft" | "approved" | "rejected"; approved_by: string | null;
  approved_name: string | null; approved_at: string | null; content_hash: string | null; updated_at: string;
}

function churchOut(ch: ChurchRow) {
  return {
    id: ch.id, code: ch.code, name: ch.name, city: ch.city ?? "", pastor_display_name: ch.pastor_display_name, tz: ch.tz,
    tradition: ch.tradition, translation: ch.translation, season_start: ch.season_start, season_end: ch.season_end,
    season: ch.season_start === SEASONS.dec1.start ? "dec1" : "nov29", theme: ch.theme,
    sermons: ch.sermons_json ? JSON.parse(ch.sermons_json) : [], xmas_eve_times: ch.xmas_eve_times ?? "",
    spanish_on: !!ch.spanish_on, keep_going_on: !!ch.keep_going_on, keep_going_church_url: ch.keep_going_church_url ?? "",
    ai_on: !!ch.ai_on, is_demo: !!ch.is_demo,
  };
}
function nightOut(n: NightRow) {
  const es = n.es_json ? JSON.parse(n.es_json) : null;
  return {
    id: n.id, night: n.night, date: n.date, week: weekOf(n.date), reference: n.reference, reference_es: es?.reference ?? null,
    verse_en: n.verse_en, verse_es: n.verse_es, why: n.why ?? "", talk: n.talk_json ? JSON.parse(n.talk_json) : { little: "", kids: "", grownups: "" },
    pray: n.pray ?? "", do: n.do_text ?? "", es: es ? { why: es.why, talk: es.talk, pray: es.pray, do: es.do } : null,
    es_approved: !!n.es_approved, source: n.source, edited: !!n.edited, model: n.model,
    checks: n.checks_json ? JSON.parse(n.checks_json) : null, status: n.status,
    approved_name: n.approved_name, approved_at: n.approved_at, content_hash: n.content_hash,
  };
}
function aiFor(env: Env, ch: Pick<ChurchRow, "ai_on">): { ai: AiClient | null; reason: string } {
  if (env.AI_ENABLED === "false") return { ai: null, reason: "AI drafting is turned off for this server, so nights come from the Starter Plan." };
  if (!ch.ai_on) return { ai: null, reason: "AI is off for this church, so nights come from the Starter Plan." };
  if (env.GEMINI_API_KEY) return { ai: geminiClient(env.GEMINI_API_KEY), reason: "" };
  if (env.AI_MOCK === "1") {
    const bad = (env.MOCK_BAD_NIGHTS ?? "").split(",").map((s) => parseInt(s, 10)).filter((n) => n > 0);
    return { ai: mockClient(bad), reason: "" };
  }
  return { ai: null, reason: "AI drafting is not configured on this server yet, so nights come from the Starter Plan." };
}
function modelNames(env: Env, ai: AiClient | null) {
  if (ai?.name === "mock") return { primary: "mock-local", fallback: "mock-local-fallback" };
  return { primary: env.GEMINI_MODEL || "gemini-flash-latest", fallback: env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest" };
}
async function capCheck(env: Env, churchId: string): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const perChurch = parseInt(env.MAX_AI_CALLS_PER_CHURCH_PER_DAY ?? "20", 10);
  const global = parseInt(env.MAX_AI_CALLS_GLOBAL_PER_DAY ?? "300", 10);
  if (!(await rateLimit(env.DB, `ai:church:${churchId}:${day}`, perChurch, 86400000))) return false;
  return rateLimit(env.DB, `ai:global:${day}`, global, 86400000);
}

async function contentHash(n: NightRow, includeEs: boolean): Promise<string> {
  const es = n.es_json ? JSON.parse(n.es_json) : null;
  return sha256Hex(stableJson({
    reference: n.reference, verse_en: n.verse_en, why: n.why, talk: n.talk_json ? JSON.parse(n.talk_json) : null,
    pray: n.pray, do: n.do_text, es: includeEs ? es : null, verse_es: includeEs ? n.verse_es : null,
  }));
}

async function writeNight(db: D1Database, churchId: string, n: { night: number; date: string; source: "ai" | "starter" | "pastor"; model: string | null; content: ModelNight; result: ValidationResult; attempts?: string[]; edited?: boolean }) {
  const r = n.result;
  const es = n.content.es ? { ...n.content.es, reference: r.reference_es ?? null } : null;
  const checks = { ok: r.ok, issues: r.issues, checks: r.checks, attempts: n.attempts ?? [] };
  await db.prepare(
    `INSERT INTO nights (id, church_id, night, date, reference, ref_key, verse_en, verse_es, why, talk_json, pray, do_text, es_json, es_approved,
      source, edited, model, checks_json, status, approved_by, approved_name, approved_at, content_hash, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'draft', NULL, NULL, NULL, NULL, ?)
     ON CONFLICT(church_id, night) DO UPDATE SET date=excluded.date, reference=excluded.reference, ref_key=excluded.ref_key,
      verse_en=excluded.verse_en, verse_es=excluded.verse_es, why=excluded.why, talk_json=excluded.talk_json, pray=excluded.pray,
      do_text=excluded.do_text, es_json=excluded.es_json, es_approved=0, source=excluded.source, edited=excluded.edited,
      model=excluded.model, checks_json=excluded.checks_json, status='draft', approved_by=NULL, approved_name=NULL,
      approved_at=NULL, content_hash=NULL, updated_at=excluded.updated_at`,
  ).bind(
    uuid(), churchId, n.night, n.date, r.reference ?? n.content.reference, r.refKey ?? null, r.verse_en ?? null, r.verse_es ?? null,
    n.content.why, JSON.stringify(n.content.talk), n.content.pray, n.content.do, es ? JSON.stringify(es) : null,
    n.source, n.edited ? 1 : 0, n.model, JSON.stringify(checks), nowIso(),
  ).run();
}

// ---------- auth middleware ----------
const requirePastor = async (c: C, next: () => Promise<void>) => {
  const pid = await sessionPastorId(c);
  if (!pid) return c.json({ error: "signed_out" }, 401);
  c.set("pastorId", pid);
  await next();
};
async function ownedChurch(c: C, id: string): Promise<ChurchRow | null> {
  return c.env.DB.prepare(
    "SELECT ch.* FROM churches ch JOIN church_admins a ON a.church_id = ch.id WHERE ch.id = ? AND a.pastor_id = ?",
  ).bind(id, c.get("pastorId")).first<ChurchRow>();
}
async function ownedNight(c: C, id: string): Promise<{ n: NightRow; ch: ChurchRow } | null> {
  const n = await c.env.DB.prepare("SELECT * FROM nights WHERE id = ?").bind(id).first<NightRow>();
  if (!n) return null;
  const ch = await ownedChurch(c, n.church_id);
  return ch ? { n, ch } : null;
}

// ---------- auth ----------
app.post("/api/auth/signup", async (c) => {
  const b = await body(c, SignupBody);
  if (isResp(b)) return b;
  if (!(await rateLimit(c.env.DB, `signup:${await ipHash(c)}`, 10, 3600000))) return c.json({ error: "too_many_tries" }, 429);
  const exists = await c.env.DB.prepare("SELECT id FROM pastors WHERE email = ?").bind(b.email).first();
  if (exists) return c.json({ error: "email_taken" }, 409);
  const { hash, salt } = await hashPassword(b.password);
  const id = uuid();
  await c.env.DB.prepare("INSERT INTO pastors (id, email, pw_hash, pw_salt, display_name, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, b.email, hash, salt, b.display_name, nowIso()).run();
  await startSession(c, id);
  return c.json({ id, email: b.email, display_name: b.display_name });
});
app.post("/api/auth/login", async (c) => {
  const b = await body(c, LoginBody);
  if (isResp(b)) return b;
  const key = `login:${await sha256Hex(b.email)}:${await ipHash(c)}`;
  if (!(await rateLimit(c.env.DB, key, 5, 15 * 60000))) return c.json({ error: "too_many_tries", message: "Too many tries. Wait 15 minutes and try again." }, 429);
  const p = await c.env.DB.prepare("SELECT id, pw_hash, pw_salt, display_name FROM pastors WHERE email = ?").bind(b.email)
    .first<{ id: string; pw_hash: string; pw_salt: string; display_name: string }>();
  if (!p || !(await verifyPassword(b.password, p.pw_hash, p.pw_salt))) return c.json({ error: "bad_login", message: "That email and password don't match." }, 401);
  await startSession(c, p.id);
  return c.json({ id: p.id, email: b.email, display_name: p.display_name });
});
app.post("/api/auth/logout", (c) => { endSession(c); return c.json({ ok: true }); });
app.get("/api/me", requirePastor, async (c) => {
  const p = await c.env.DB.prepare("SELECT id, email, display_name FROM pastors WHERE id = ?").bind(c.get("pastorId")).first();
  if (!p) return c.json({ error: "signed_out" }, 401);
  const { results } = await c.env.DB.prepare(
    "SELECT ch.* FROM churches ch JOIN church_admins a ON a.church_id = ch.id WHERE a.pastor_id = ? ORDER BY ch.created_at",
  ).bind(c.get("pastorId")).all<ChurchRow>();
  return c.json({ pastor: p, churches: results.map(churchOut), ai_server_enabled: c.env.AI_ENABLED !== "false" });
});

// ---------- churches ----------
app.post("/api/churches", requirePastor, async (c) => {
  const b = await body(c, ChurchCreate);
  if (isResp(b)) return b;
  const id = uuid();
  const season = SEASONS[b.season];
  let code = churchCode();
  for (let i = 0; i < 5 && (await c.env.DB.prepare("SELECT 1 FROM churches WHERE code = ?").bind(code).first()); i++) code = churchCode();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO churches (id, code, name, city, pastor_display_name, tz, tradition, translation, season_start, season_end, theme,
        sermons_json, xmas_eve_times, spanish_on, keep_going_on, keep_going_church_url, ai_on, is_demo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
    ).bind(id, code, b.name, b.city, b.pastor_display_name, b.tz, b.tradition, b.translation, season.start, season.end, b.theme,
      JSON.stringify(b.sermons), b.xmas_eve_times, b.spanish_on ? 1 : 0, b.keep_going_on ? 1 : 0, b.keep_going_church_url, nowIso()),
    c.env.DB.prepare("INSERT INTO church_admins (church_id, pastor_id, role) VALUES (?, ?, 'owner')").bind(id, c.get("pastorId")),
  ]);
  const ch = await ownedChurch(c, id);
  return c.json(churchOut(ch!));
});
app.get("/api/churches/:id", requirePastor, async (c) => {
  const ch = await ownedChurch(c, c.req.param("id")!);
  if (!ch) return c.json({ error: "not_found" }, 404);
  const { results } = await c.env.DB.prepare("SELECT * FROM nights WHERE church_id = ? ORDER BY night").bind(ch.id).all<NightRow>();
  const { reason } = aiFor(c.env, ch);
  return c.json({ church: churchOut(ch), nights: results.map(nightOut), draft: ch.draft_json ? JSON.parse(ch.draft_json) : null, ai_note: reason, today: todayIn(ch.tz, now(c)) });
});
app.patch("/api/churches/:id", requirePastor, async (c) => {
  const ch = await ownedChurch(c, c.req.param("id")!);
  if (!ch) return c.json({ error: "not_found" }, 404);
  const b = await body(c, ChurchPatch);
  if (isResp(b)) return b;
  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, v: unknown) => { sets.push(`${col} = ?`); vals.push(v); };
  if (b.name !== undefined) set("name", b.name);
  if (b.city !== undefined) set("city", b.city);
  if (b.pastor_display_name !== undefined) set("pastor_display_name", b.pastor_display_name);
  if (b.tradition !== undefined) set("tradition", b.tradition);
  if (b.translation !== undefined) set("translation", b.translation);
  if (b.theme !== undefined) set("theme", b.theme);
  if (b.season !== undefined) { set("season_start", SEASONS[b.season].start); set("season_end", SEASONS[b.season].end); }
  if (b.sermons !== undefined) set("sermons_json", JSON.stringify(b.sermons));
  if (b.xmas_eve_times !== undefined) set("xmas_eve_times", b.xmas_eve_times);
  if (b.spanish_on !== undefined) set("spanish_on", b.spanish_on ? 1 : 0);
  if (b.keep_going_on !== undefined) set("keep_going_on", b.keep_going_on ? 1 : 0);
  if (b.keep_going_church_url !== undefined) set("keep_going_church_url", b.keep_going_church_url);
  if (b.ai_on !== undefined) set("ai_on", b.ai_on ? 1 : 0);
  if (b.tz !== undefined) set("tz", b.tz);
  if (sets.length) await c.env.DB.prepare(`UPDATE churches SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, ch.id).run();
  return c.json(churchOut((await ownedChurch(c, ch.id))!));
});

// ---------- drafting (one week per request; the Studio polls until done) ----------
interface DraftState {
  status: "running" | "done";
  started_at: string;
  finished_at?: string;
  note?: string;
  weeks: { week: number; status: "pending" | "done"; nights: { night: number; source: string; ok: boolean; soft: number; checks: unknown }[] }[];
}
async function runDraftStep(c: C, ch: ChurchRow, state: DraftState): Promise<DraftState> {
  const next = state.weeks.find((w) => w.status === "pending");
  if (!next) return { ...state, status: "done", finished_at: state.finished_at ?? nowIso() };
  const all = seasonNights(ch.season_start, ch.season_end);
  const { results: existing } = await c.env.DB.prepare("SELECT night, ref_key, reference, status FROM nights WHERE church_id = ?").bind(ch.id)
    .all<{ night: number; ref_key: string | null; reference: string; status: string }>();
  const approved = new Set(existing.filter((e) => e.status === "approved").map((e) => e.night));
  const weekNights = all.filter((n) => weekOf(n.date) === next.week && !approved.has(n.night));
  const thisWeek = new Set(weekNights.map((n) => n.night));
  const keep = existing.filter((e) => !thisWeek.has(e.night) && e.ref_key);
  const { ai, reason } = aiFor(c.env, ch);
  const models = modelNames(c.env, ai);
  const runs: { model: string; ms: number; outcome: string; prompt: string }[] = [];
  const sermons = ch.sermons_json ? JSON.parse(ch.sermons_json) : [];
  const drafted = await draftWeek(
    { ai, primaryModel: models.primary, fallbackModel: models.fallback, canCall: () => capCheck(c.env, ch.id), onRun: async (r) => { runs.push(r); } },
    {
      theme: ch.theme, tradition: ch.tradition, translation: ch.translation, spanish: !!ch.spanish_on, week: next.week, nights: weekNights,
      sermon: sermons[next.week - 1]?.title ? sermons[next.week - 1] : undefined,
      usedRefKeys: new Set(keep.map((e) => e.ref_key!)), usedRefs: keep.map((e) => e.reference),
    },
  );
  for (const d of drafted) await writeNight(c.env.DB, ch.id, d);
  const summary = drafted.map((d) => ({ night: d.night, source: d.source, ok: d.result.ok, soft: d.result.issues.filter((i) => i.severity === "soft").length, checks: d.result.checks }));
  const stmts = runs.map((r, i) => c.env.DB.prepare("INSERT INTO ai_runs (id, church_id, week, model, ms, outcome, checks_json, prompt_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(uuid(), ch.id, next.week, r.model, r.ms, r.outcome, i === 0 ? JSON.stringify(summary) : null, r.prompt, nowIso()));
  if (!ai) stmts.push(c.env.DB.prepare("INSERT INTO ai_runs (id, church_id, week, model, ms, outcome, checks_json, prompt_text, created_at) VALUES (?, ?, ?, 'none', 0, 'starter-plan', ?, NULL, ?)")
    .bind(uuid(), ch.id, next.week, JSON.stringify(summary), nowIso()));
  if (stmts.length) await c.env.DB.batch(stmts);
  next.status = "done";
  (next as any).nights = summary;
  if (reason) state.note = reason;
  if (state.weeks.every((w) => w.status === "done")) { state.status = "done"; state.finished_at = nowIso(); }
  return state;
}
app.post("/api/churches/:id/draft", requirePastor, async (c) => {
  const ch = await ownedChurch(c, c.req.param("id")!);
  if (!ch) return c.json({ error: "not_found" }, 404);
  const b = await body(c, z.object({ restart: z.boolean().default(false) }));
  if (isResp(b)) return b;
  let state: DraftState | null = ch.draft_json ? JSON.parse(ch.draft_json) : null;
  if (!state || b.restart || state.status === "done") {
    const weeks = [...new Set(seasonNights(ch.season_start, ch.season_end).map((n) => weekOf(n.date)))];
    state = { status: "running", started_at: nowIso(), weeks: weeks.map((w) => ({ week: w, status: "pending", nights: [] })) };
    // drop nights outside the current season length (e.g. switched to Dec 1)
    await c.env.DB.prepare("DELETE FROM nights WHERE church_id = ? AND night > ? AND status != 'approved'").bind(ch.id, seasonNights(ch.season_start, ch.season_end).length).run();
  }
  state = await runDraftStep(c, ch, state);
  await c.env.DB.prepare("UPDATE churches SET draft_json = ? WHERE id = ?").bind(JSON.stringify(state), ch.id).run();
  return c.json(state);
});
app.get("/api/churches/:id/draft-status", requirePastor, async (c) => {
  const ch = await ownedChurch(c, c.req.param("id")!);
  if (!ch) return c.json({ error: "not_found" }, 404);
  return c.json(ch.draft_json ? JSON.parse(ch.draft_json) : { status: "idle", weeks: [] });
});

// ---------- night actions ----------
async function revalidate(c: C, ch: ChurchRow, nightNo: number, content: ModelNight) {
  const { results } = await c.env.DB.prepare("SELECT ref_key FROM nights WHERE church_id = ? AND night != ? AND ref_key IS NOT NULL").bind(ch.id, nightNo).all<{ ref_key: string }>();
  return validateNight(content, { translation: ch.translation, spanish: !!ch.spanish_on, tradition: ch.tradition, usedRefKeys: new Set(results.map((r) => r.ref_key)) });
}
function rowContent(n: NightRow): ModelNight {
  const es = n.es_json ? JSON.parse(n.es_json) : null;
  return {
    night: n.night, date: n.date, reference: n.reference, why: n.why ?? "", talk: n.talk_json ? JSON.parse(n.talk_json) : { little: "", kids: "", grownups: "" },
    pray: n.pray ?? "", do: n.do_text ?? "", es: es ? { why: es.why, talk: es.talk, pray: es.pray, do: es.do } : undefined,
  };
}
async function reload(c: C, id: string) {
  return nightOut((await c.env.DB.prepare("SELECT * FROM nights WHERE id = ?").bind(id).first<NightRow>())!);
}
app.post("/api/nights/:id/approve", requirePastor, async (c) => {
  const o = await ownedNight(c, c.req.param("id")!);
  if (!o) return c.json({ error: "not_found" }, 404);
  const b = await body(c, ApproveBody);
  if (isResp(b)) return b;
  const checks = o.n.checks_json ? JSON.parse(o.n.checks_json) : null;
  if (!checks?.ok) return c.json({ error: "failed_checks", message: "This night has a check that must be fixed before it can be approved." }, 409);
  const includeEs = b.include_es && !!o.ch.spanish_on && !!o.n.es_json && !!o.n.verse_es;
  const hash = await contentHash(o.n, includeEs);
  await c.env.DB.prepare("UPDATE nights SET status = 'approved', approved_by = ?, approved_name = ?, approved_at = ?, content_hash = ?, es_approved = ?, updated_at = ? WHERE id = ?")
    .bind(c.get("pastorId"), o.ch.pastor_display_name, nowIso(), hash, includeEs ? 1 : 0, nowIso(), o.n.id).run();
  return c.json(await reload(c, o.n.id));
});
app.post("/api/nights/:id/reject", requirePastor, async (c) => {
  const o = await ownedNight(c, c.req.param("id")!);
  if (!o) return c.json({ error: "not_found" }, 404);
  await c.env.DB.prepare("UPDATE nights SET status = 'rejected', approved_by = NULL, approved_name = NULL, approved_at = NULL, content_hash = NULL, es_approved = 0, updated_at = ? WHERE id = ?")
    .bind(nowIso(), o.n.id).run();
  return c.json(await reload(c, o.n.id));
});
app.patch("/api/nights/:id", requirePastor, async (c) => {
  const o = await ownedNight(c, c.req.param("id")!);
  if (!o) return c.json({ error: "not_found" }, 404);
  const b = await body(c, NightEdit);
  if (isResp(b)) return b;
  const cur = rowContent(o.n);
  const next: ModelNight = {
    ...cur, reference: b.reference ?? cur.reference, why: b.why ?? cur.why, talk: b.talk ?? cur.talk, pray: b.pray ?? cur.pray, do: b.do ?? cur.do,
    es: (b.es as Prose | undefined) ?? cur.es,
  };
  const r = await revalidate(c, o.ch, o.n.night, next);
  // any edit re-runs checks and un-approves the night
  await writeNight(c.env.DB, o.ch.id, { night: o.n.night, date: o.n.date, source: o.n.source, model: o.n.model, content: next, result: r, edited: true });
  return c.json(await reload(c, o.n.id));
});
app.post("/api/nights/:id/use-starter", requirePastor, async (c) => {
  const o = await ownedNight(c, c.req.param("id")!);
  if (!o) return c.json({ error: "not_found" }, 404);
  const content = starterFor(o.n.date, o.n.night);
  const r = await revalidate(c, o.ch, o.n.night, content);
  await writeNight(c.env.DB, o.ch.id, { night: o.n.night, date: o.n.date, source: "starter", model: null, content, result: r, attempts: ["pastor chose the Starter Plan"] });
  return c.json(await reload(c, o.n.id));
});
app.post("/api/nights/:id/regenerate", requirePastor, async (c) => {
  const o = await ownedNight(c, c.req.param("id")!);
  if (!o) return c.json({ error: "not_found" }, 404);
  const { ai, reason } = aiFor(c.env, o.ch);
  if (!ai) return c.json({ error: "ai_off", message: reason }, 409);
  const { results } = await c.env.DB.prepare("SELECT ref_key, reference FROM nights WHERE church_id = ? AND night != ? AND ref_key IS NOT NULL").bind(o.ch.id, o.n.night).all<{ ref_key: string; reference: string }>();
  const models = modelNames(c.env, ai);
  const runs: { model: string; ms: number; outcome: string; prompt: string }[] = [];
  const sermons = o.ch.sermons_json ? JSON.parse(o.ch.sermons_json) : [];
  const week = weekOf(o.n.date);
  const [d] = await draftWeek(
    { ai, primaryModel: models.primary, fallbackModel: models.fallback, canCall: () => capCheck(c.env, o.ch.id), onRun: async (r) => { runs.push(r); } },
    {
      theme: o.ch.theme, tradition: o.ch.tradition, translation: o.ch.translation, spanish: !!o.ch.spanish_on, week,
      nights: [{ night: o.n.night, date: o.n.date }], sermon: sermons[week - 1]?.title ? sermons[week - 1] : undefined,
      usedRefKeys: new Set(results.map((r) => r.ref_key)), usedRefs: [...results.map((r) => r.reference), o.n.reference],
    },
  );
  await writeNight(c.env.DB, o.ch.id, d);
  if (runs.length) await c.env.DB.batch(runs.map((r) => c.env.DB.prepare("INSERT INTO ai_runs (id, church_id, week, model, ms, outcome, checks_json, prompt_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(uuid(), o.ch.id, week, r.model, r.ms, `regenerate-${r.outcome}`, JSON.stringify({ ok: d.result.ok, source: d.source }), r.prompt, nowIso())));
  return c.json(await reload(c, o.n.id));
});

// ---------- dashboard ----------
async function weekStats(db: D1Database, ch: ChurchRow, today: string) {
  const week = weekOf(today);
  const weekNights = seasonNights(ch.season_start, ch.season_end).filter((n) => weekOf(n.date) === week).map((n) => n.night);
  const ph = weekNights.map(() => "?").join(",") || "NULL";
  const row = await db.prepare(`SELECT COUNT(DISTINCT household) AS h, COUNT(*) AS m FROM lights WHERE church_id = ? AND night IN (${ph})`)
    .bind(ch.id, ...weekNights).first<{ h: number; m: number }>();
  return { week, households: row?.h ?? 0, candles: row?.m ?? 0 };
}
app.get("/api/churches/:id/dashboard", requirePastor, async (c) => {
  const ch = await ownedChurch(c, c.req.param("id")!);
  if (!ch) return c.json({ error: "not_found" }, 404);
  const today = todayIn(ch.tz, now(c));
  const joined = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM households WHERE church_id = ?").bind(ch.id).first<{ n: number }>();
  const { results } = await c.env.DB.prepare("SELECT night, COUNT(*) AS n FROM lights WHERE church_id = ? GROUP BY night").bind(ch.id).all<{ night: number; n: number }>();
  const per = new Map(results.map((r) => [r.night, r.n]));
  const nights = seasonNights(ch.season_start, ch.season_end).map((n) => ({ ...n, lit: thresh(per.get(n.night) ?? 0) }));
  const ws = await weekStats(c.env.DB, ch, today);
  const { results: runs } = await c.env.DB.prepare("SELECT week, model, ms, outcome, checks_json, created_at FROM ai_runs WHERE church_id = ? ORDER BY created_at DESC LIMIT 50").bind(ch.id).all();
  return c.json({
    today, is_demo: !!ch.is_demo, households: thresh(joined?.n ?? 0), nights,
    this_week: { week: ws.week, households: thresh(ws.households), candles: thresh(ws.candles) }, ai_runs: runs,
  });
});
app.post("/api/churches/:id/announcement", requirePastor, async (c) => {
  const ch = await ownedChurch(c, c.req.param("id")!);
  if (!ch) return c.json({ error: "not_found" }, 404);
  const ws = await weekStats(c.env.DB, ch, todayIn(ch.tz, now(c)));
  const h = thresh(ws.households), m = thresh(ws.candles);
  const candle = TRADITIONS[ch.tradition].candles[ws.week - 1].en;
  const template = h.value === null
    ? `Families at ${ch.name} have started lighting their Advent wreaths at home. Join them tonight: five minutes at the table, then phones down.`
    : `This week, ${h.label} households at ${ch.name} lit ${m.label} candles at home. As we light the ${candle} candle together, join them tonight: five minutes at the table, then phones down.`;
  // Code computes the numbers. AI may only rephrase them; every number in its output must match the inputs.
  const { ai } = aiFor(c.env, ch);
  if (!ai || ai.name === "mock" || h.value === null) return c.json({ text: template, source: "template", numbers: { households: h.label, candles: m.label } });
  // Gemini phrasing of fixed numbers
  try {
    if (!(await capCheck(c.env, ch.id))) throw new Error("cap");
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelNames(c.env, ai).primary)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": c.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `Write a warm two-sentence Sunday announcement for a church about its family Advent practice. Use exactly these numbers and no others: ${h.value} households, ${m.value} candles, this week. Mention the ${candle} candle. No guilt, no exclamation marks, no links. Plain text only.` }] }],
        generationConfig: { temperature: 0.6 },
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data: any = await res.json();
    const text = String(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
    const check = numbersMatch(text, [h.value!, m.value!]);
    if (!text || !check.ok || text.length > 400) return c.json({ text: template, source: "template", note: "The AI wording changed a number, so we used the plain version.", numbers: { households: h.label, candles: m.label } });
    return c.json({ text, source: "ai", numbers: { households: h.label, candles: m.label } });
  } catch {
    return c.json({ text: template, source: "template", numbers: { households: h.label, candles: m.label } });
  }
});

// ---------- public (families, projector) ----------
async function publicChurch(c: C): Promise<ChurchRow | null> {
  const code = c.req.param("code")?.toUpperCase() ?? "";
  if (!/^[A-Z0-9]{4,8}$/.test(code)) return null;
  return c.env.DB.prepare("SELECT * FROM churches WHERE code = ?").bind(code).first<ChurchRow>();
}
function publicNight(n: NightRow, ch: ChurchRow) {
  const es = n.es_approved && ch.spanish_on && n.es_json ? JSON.parse(n.es_json) : null;
  return {
    night: n.night, date: n.date, week: weekOf(n.date), reference: n.reference, verse_en: n.verse_en, translation: TRANSLATIONS[ch.translation].short,
    why: n.why, talk: JSON.parse(n.talk_json ?? "{}"), pray: n.pray, do: n.do_text,
    es: es ? { reference: es.reference, verse: n.verse_es, translation: "RV1909", why: es.why, talk: es.talk, pray: es.pray, do: es.do } : null,
    label: { source: n.source, edited: !!n.edited, approved_name: n.approved_name, approved_at: n.approved_at },
  };
}
app.get("/api/public/:code", async (c) => {
  const ch = await publicChurch(c);
  if (!ch) return c.json({ error: "not_found" }, 404);
  const today = todayIn(ch.tz, now(c));
  const preview = !!ch.is_demo && c.req.query("preview") === "1";
  // Approved only. Future nights never leave the server unless this is the demo church in preview mode.
  const { results } = await c.env.DB.prepare(
    preview ? "SELECT * FROM nights WHERE church_id = ? AND status = 'approved' ORDER BY night" : "SELECT * FROM nights WHERE church_id = ? AND status = 'approved' AND date <= ? ORDER BY night",
  ).bind(...(preview ? [ch.id] : [ch.id, today])).all<NightRow>();
  const season = seasonNights(ch.season_start, ch.season_end);
  const tonight = season.find((n) => n.date === today)?.night ?? null;
  return c.json({
    church: {
      code: ch.code, name: ch.name, city: ch.city ?? "", pastor_display_name: ch.pastor_display_name, tradition: ch.tradition,
      candles: TRADITIONS[ch.tradition].candles, translation: TRANSLATIONS[ch.translation], spanish_on: !!ch.spanish_on, ai_on: !!ch.ai_on && c.env.AI_ENABLED !== "false",
      xmas_eve_times: ch.xmas_eve_times ?? "", is_demo: !!ch.is_demo,
      keep_going: ch.keep_going_on ? { church_url: ch.keep_going_church_url ?? "" } : null,
      season_start: ch.season_start, season_end: ch.season_end, season_length: season.length,
    },
    today, tonight, preview, after_christmas: today > CHRISTMAS,
    nights: results.map((n) => publicNight(n, ch)),
  });
});
async function householdHash(device: string, churchId: string) { return sha256Hex(device + churchId); }
app.post("/api/public/:code/join", async (c) => {
  const ch = await publicChurch(c);
  if (!ch) return c.json({ error: "not_found" }, 404);
  const b = await body(c, JoinBody);
  if (isResp(b)) return b;
  if (!(await rateLimit(c.env.DB, `join:${await ipHash(c)}`, 30, 3600000))) return c.json({ error: "too_many_tries" }, 429);
  const h = await householdHash(b.device, ch.id);
  await c.env.DB.prepare("INSERT OR IGNORE INTO households (church_id, household, joined_day) VALUES (?, ?, ?)").bind(ch.id, h, todayIn(ch.tz, now(c))).run();
  return c.json({ ok: true });
});
app.post("/api/public/:code/light", async (c) => {
  const ch = await publicChurch(c);
  if (!ch) return c.json({ error: "not_found" }, 404);
  const b = await body(c, LightBody);
  if (isResp(b)) return b;
  if (!(await rateLimit(c.env.DB, `light:${await ipHash(c)}`, 60, 3600000))) return c.json({ error: "too_many_tries" }, 429);
  const today = todayIn(ch.tz, now(c));
  const n = await c.env.DB.prepare("SELECT date FROM nights WHERE church_id = ? AND night = ? AND status = 'approved'").bind(ch.id, b.night).first<{ date: string }>();
  if (!n) return c.json({ error: "not_found" }, 404);
  if (n.date > today && !ch.is_demo) return c.json({ error: "not_yet", message: "This night opens on its date." }, 409);
  const h = await householdHash(b.device, ch.id);
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT OR IGNORE INTO households (church_id, household, joined_day) VALUES (?, ?, ?)").bind(ch.id, h, today),
    c.env.DB.prepare("INSERT OR IGNORE INTO lights (church_id, night, household, day) VALUES (?, ?, ?, ?)").bind(ch.id, b.night, h, today),
  ]);
  return c.json({ ok: true });
});
app.get("/api/public/:code/wreath", async (c) => {
  const ch = await publicChurch(c);
  if (!ch) return c.json({ error: "not_found" }, 404);
  const today = todayIn(ch.tz, now(c));
  const ws = await weekStats(c.env.DB, ch, today);
  const { results } = await c.env.DB.prepare("SELECT night, COUNT(*) AS n FROM lights WHERE church_id = ? GROUP BY night").bind(ch.id).all<{ night: number; n: number }>();
  const per = new Map(results.map((r) => [r.night, r.n]));
  const season = seasonNights(ch.season_start, ch.season_end);
  return c.json({
    name: ch.name, is_demo: !!ch.is_demo, today, week: ws.week, candles: TRADITIONS[ch.tradition].candles,
    sundays_lit: ADVENT_SUNDAYS.filter((d) => d <= today).length, christ_candle: today >= CHRISTMAS,
    this_week: { households: thresh(ws.households), candles: thresh(ws.candles) },
    ring: season.map((n) => ({ night: n.night, date: n.date, glow: (per.get(n.night) ?? 0) >= THRESHOLD })),
  });
});

app.get("/api/health", (c) => c.json({ ok: true, app: APP_NAME, aiEnabled: c.env.AI_ENABLED !== "false" }));
app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));
app.onError((err, c) => {
  console.error("error", err.message); // never log bodies or secrets
  return c.json({ error: "server_error" }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env) {
    // Nightly-safe purge: prompt text (may contain sermon titles) is deleted after 7 days.
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
    await env.DB.prepare("UPDATE ai_runs SET prompt_text = NULL WHERE created_at < ? AND prompt_text IS NOT NULL").bind(cutoff).run();
    await env.DB.prepare("DELETE FROM rate WHERE window_start < ?").bind(new Date(Date.now() - 2 * 86400000).toISOString()).run();
    // Hourly demo-church reset to its seed (same statements as scripts/seed-demo.ts).
    await resetDemo(env.DB);
  },
};
