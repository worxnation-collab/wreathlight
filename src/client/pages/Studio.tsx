import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { api, ApiError } from "../api";
import { Link, navigate, usePath } from "../router";
import { APP_NAME } from "../../shared/brand";
import { SEASONS, TRADITIONS, TRANSLATIONS, seasonLabel } from "../../shared/season";
import { THEMES } from "../../shared/themes";
import { Check, Cross, Lock, Spark, Warn } from "../components/Icons";
import { fmtDate } from "../i18n";

type Church = any;
type Night = any;

export default function Studio() {
  const path = usePath();
  const [me, setMe] = useState<any>(undefined);
  const refresh = useCallback(() => api("/api/me").then(setMe).catch(() => setMe(null)), []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { document.title = `Studio · ${APP_NAME}`; document.documentElement.lang = "en"; }, []);

  if (me === undefined) return <div className="studio" aria-busy="true" />;
  if (me === null) return <Shell><Auth onDone={refresh} /></Shell>;
  const m = path.match(/^\/studio\/c\/([a-f0-9-]{36})/);
  const wantsNew = path === "/studio/new" || me.churches.length === 0;
  const churchId = m?.[1] ?? me.churches[0]?.id;
  return (
    <Shell me={me} onLogout={async () => { await api("/api/auth/logout", { body: {} }); setMe(null); }}>
      {wantsNew ? <CreateChurch me={me} onCreated={(c) => { refresh(); navigate(`/studio/c/${c.id}`); }} />
        : <ChurchStudio key={churchId} id={churchId} churches={me.churches} />}
    </Shell>
  );
}

function Shell({ children, me, onLogout }: { children: React.ReactNode; me?: any; onLogout?: () => void }) {
  return (
    <div className="studio">
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <Link to="/" className="brand"><img src="/favicon.svg" width="28" height="28" alt="" />{APP_NAME} <span className="muted small brand-sub" style={{ fontFamily: "var(--sans)", fontWeight: 400 }}>Studio</span></Link>
        {me && (
          <div className="row topbar-who" style={{ gap: 8 }}>
            <span className="muted small who" title={me.pastor.display_name}>{me.pastor.display_name}</span>
            <button className="btn btn-ghost btn-small" onClick={onLogout}>Sign out</button>
          </div>
        )}
      </header>
      <main id="main" className="wrap">{children}</main>
    </div>
  );
}

// ---------------- auth ----------------
function Auth({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      if (mode === "up") await api("/api/auth/signup", { body: { email, password, display_name: name } });
      else await api("/api/auth/login", { body: { email, password } });
      onDone();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div style={{ maxWidth: 440, margin: "32px auto" }}>
      <h1>{mode === "in" ? "Sign in to the Studio" : "Create your Studio account"}</h1>
      <p className="muted">For pastors and family ministry leaders. Families never need an account.</p>
      <form className="card" onSubmit={submit}>
        {mode === "up" && (
          <div className="field">
            <label htmlFor="dn">Your name as families will see it</label>
            <input id="dn" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pastor Dana" required minLength={2} maxLength={60} />
          </div>
        )}
        <div className="field">
          <label htmlFor="em">Email</label>
          <input id="em" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "up" ? 10 : 1} autoComplete={mode === "up" ? "new-password" : "current-password"} />
          {mode === "up" && <span className="hint">At least 10 characters.</span>}
          {mode === "in" && <span className="hint">Forgot it? Contact your Wreathlight admin. Judging? Use the demo login from the submission.</span>}
        </div>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>{mode === "in" ? "Sign in" : "Create account"}</button>
      </form>
      <p style={{ textAlign: "center" }}>
        <button className="btn btn-ghost btn-small" onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(""); }}>
          {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </p>
    </div>
  );
}

// ---------------- create church ----------------
function Radio<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: [T, string, string?][]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" className="grid2" style={{ gap: 8 }}>
      {options.map(([v, label, sub]) => (
        <label key={v} className="card" style={{ padding: 12, cursor: "pointer", borderColor: value === v ? "var(--gold)" : undefined, boxShadow: value === v ? "0 0 0 2px var(--gold)" : undefined }}>
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} style={{ marginRight: 8 }} />
          <b>{label}</b>{sub && <div className="small muted">{sub}</div>}
        </label>
      ))}
    </div>
  );
}
function ChurchForm({ initial, submitLabel, onSubmit }: { initial: any; submitLabel: string; onSubmit: (v: any) => Promise<void> }) {
  const [v, setV] = useState(initial);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, x: unknown) => setV((o: any) => ({ ...o, [k]: x }));
  const sermons = v.sermons?.length ? v.sermons : [0, 1, 2, 3].map(() => ({ title: "", passage: "" }));
  return (
    <form onSubmit={async (e) => {
      e.preventDefault(); setErr(""); setBusy(true);
      try { await onSubmit({ ...v, sermons: sermons.filter((s: any) => s.title || s.passage).length ? sermons : [] }); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
    }}>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Your church</h2>
        <div className="grid2">
          <div className="field"><label htmlFor="cn">Church name</label><input id="cn" className="input" required minLength={2} maxLength={80} value={v.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="field"><label htmlFor="cc">City (optional)</label><input id="cc" className="input" maxLength={60} value={v.city} onChange={(e) => set("city", e.target.value)} /></div>
          <div className="field"><label htmlFor="pd">Pastor display name</label><input id="pd" className="input" required minLength={2} maxLength={60} value={v.pastor_display_name} onChange={(e) => set("pastor_display_name", e.target.value)} /><span className="hint">Shown on every approved card, e.g. "Pastor Dana".</span></div>
        </div>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Theme</h2>
        <Radio name="theme" value={v.theme} onChange={(x) => set("theme", x)} options={Object.entries(THEMES).map(([k, th]) => [k, th.en, th.guide.split(". ")[0] + "."]) as any} />
        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Line it up with your four Advent Sunday sermons (optional)</summary>
          <p className="small muted">Each week's nights will point back to Sunday.</p>
          {sermons.map((s: any, i: number) => (
            <div className="grid2" key={i}>
              <div className="field"><label htmlFor={`st${i}`}>Week {i + 1} sermon title</label><input id={`st${i}`} className="input" maxLength={120} value={s.title} onChange={(e) => { const n = [...sermons]; n[i] = { ...s, title: e.target.value }; set("sermons", n); }} /></div>
              <div className="field"><label htmlFor={`sp${i}`}>Passage</label><input id={`sp${i}`} className="input" maxLength={60} placeholder="e.g. Isaiah 40:1-11" value={s.passage} onChange={(e) => { const n = [...sermons]; n[i] = { ...s, passage: e.target.value }; set("sermons", n); }} /></div>
            </div>
          ))}
        </details>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Season and tradition</h2>
        <div className="field"><span className="label">Candles</span>
          <Radio name="tradition" value={v.tradition} onChange={(x) => set("tradition", x)} options={Object.entries(TRADITIONS).map(([k, tr]) => [k, tr.label]) as any} /></div>
        <div className="grid2">
          <div className="field"><span className="label">Season</span>
            <Radio name="season" value={v.season} onChange={(x) => set("season", x)} options={Object.entries(SEASONS).map(([k, s]) => [k, s.label]) as any} /></div>
          <div className="field"><label htmlFor="tr">Bible translation</label>
            <select id="tr" className="input" value={v.translation} onChange={(e) => set("translation", e.target.value)}>
              {(["bsb", "kjv", "web"] as const).map((k) => <option key={k} value={k}>{TRANSLATIONS[k].name} ({TRANSLATIONS[k].short})</option>)}
            </select>
            <span className="hint">Public domain. Spanish uses Reina-Valera 1909.</span></div>
        </div>
        <div className="field"><label htmlFor="xe">Christmas Eve service times (optional)</label>
          <textarea id="xe" className="input" maxLength={200} value={v.xmas_eve_times} onChange={(e) => set("xmas_eve_times", e.target.value)} placeholder="e.g. 4:00 and 6:00 PM, candlelight" />
          <span className="hint">Shown on the Dec 24 card.</span></div>
        <div className="row" style={{ gap: 24 }}>
          <label className="switch"><input type="checkbox" checked={v.spanish_on} onChange={(e) => set("spanish_on", e.target.checked)} /> Spanish</label>
          <label className="switch"><input type="checkbox" checked={v.keep_going_on} onChange={(e) => set("keep_going_on", e.target.checked)} /> "Keep going after Christmas" card</label>
        </div>
        {v.keep_going_on && (
          <div className="field" style={{ marginTop: 12 }}><label htmlFor="ku">Your church's link for the new year (optional)</label>
            <input id="ku" type="url" className="input" maxLength={200} value={v.keep_going_church_url} onChange={(e) => set("keep_going_church_url", e.target.value)} placeholder="https://" />
            <span className="hint">The card also lists Verse Arcade, a separate Bible game by the same builder, made before this hackathon. Turn the card off to hide it.</span></div>
        )}
      </section>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn btn-primary" disabled={busy}>{submitLabel}</button>
    </form>
  );
}
function CreateChurch({ me, onCreated }: { me: any; onCreated: (c: Church) => void }) {
  return (
    <div>
      <h1>Set up your church's Advent</h1>
      <p className="muted">About two minutes. You can change any of this later.</p>
      <ChurchForm submitLabel="Create church" initial={{
        name: "", city: "", pastor_display_name: me.pastor.display_name, tradition: "hope", translation: "bsb", season: "nov29", theme: "light",
        sermons: [], xmas_eve_times: "", spanish_on: true, keep_going_on: true, keep_going_church_url: "",
      }} onSubmit={async (v) => onCreated(await api("/api/churches", { body: v }))} />
    </div>
  );
}

// ---------------- church studio ----------------
const TABS = ["Nights", "Dashboard", "Share", "AI settings", "Settings", "Print"] as const;
function ChurchStudio({ id, churches }: { id: string; churches: Church[] }) {
  const [d, setD] = useState<any>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Nights");
  const [err, setErr] = useState("");
  const load = useCallback(() => api(`/api/churches/${id}`).then(setD).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  if (err) return <p className="error">{err}</p>;
  if (!d) return <p aria-busy="true" className="muted">Loading…</p>;
  const ch = d.church;
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{ch.name}</h1>
          <div className="row" style={{ gap: 8 }}>
            <span className="pill">Code {ch.code}</span>
            <span className="pill">{THEMES[ch.theme as keyof typeof THEMES].en}</span>
            <span className={`pill ${ch.ai_on ? "ok" : "warn"}`}>AI {ch.ai_on ? "on" : "off"}</span>
            {ch.is_demo && <span className="pill demo">Demo data</span>}
          </div>
        </div>
        <div className="row">
          {churches.length > 1 && (
            <select className="input" style={{ width: "auto" }} value={id} onChange={(e) => navigate(`/studio/c/${e.target.value}`)} aria-label="Switch church">
              {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <Link to="/studio/new" className="btn btn-ghost btn-small">New church</Link>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map((t) => <button key={t} role="tab" className="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      <div role="tabpanel" aria-label={tab}>
        {tab === "Nights" && <NightsTab d={d} reload={load} setD={setD} />}
        {tab === "Dashboard" && <DashboardTab ch={ch} nights={d.nights} today={d.today} />}
        {tab === "Share" && <ShareTab ch={ch} />}
        {tab === "AI settings" && <AiTab ch={ch} note={d.ai_note} reload={load} />}
        {tab === "Settings" && (
          <ChurchForm submitLabel="Save settings" initial={ch} onSubmit={async (v) => {
            const { id: _i, code: _c, is_demo: _d, season_start: _s, season_end: _e, ai_on: _a, ...rest } = v;
            await api(`/api/churches/${ch.id}`, { method: "PATCH", body: rest }); await load(); setTab("Nights");
          }} />
        )}
        {tab === "Print" && (
          <div className="card">
            <h2>Print</h2>
            <p>Approved nights only. Letter paper.</p>
            <div className="row">
              <a className="btn btn-primary" href={`/print/${ch.id}/booklet`} target="_blank" rel="noopener">Family booklet</a>
              <a className="btn btn-ghost" href={`/print/${ch.id}/fridge`} target="_blank" rel="noopener">Fridge wreath coloring sheet</a>
              <a className="btn btn-ghost" href={`/print/${ch.id}/insert`} target="_blank" rel="noopener">Bulletin insert</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- nights: draft + approval queue ----------------
const CHECK_LABELS: [string, (tr: string) => string][] = [
  ["references", () => "References exist"],
  ["verseMatched", (tr) => `Verse text matched (${tr})`],
  ["readingLevel", () => "Reading level OK for little ones"],
  ["phrases", () => "No flagged phrases"],
  ["duplicates", () => "No duplicates"],
];
function DraftProgress({ state, translation }: { state: any; translation: string }) {
  const [shown, setShown] = useState<Record<number, number>>({});
  useEffect(() => {
    const timers: number[] = [];
    for (const w of state.weeks) {
      if (w.status !== "done" || shown[w.week] !== undefined) continue;
      for (let i = 1; i <= CHECK_LABELS.length; i++) timers.push(window.setTimeout(() => setShown((s) => ({ ...s, [w.week]: i })), i * 260));
      setShown((s) => ({ ...s, [w.week]: 0 }));
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <div className="progress" aria-live="polite">
      {state.weeks.map((w: any) => {
        const nights = w.nights ?? [];
        return (
          <div className="pweek" key={w.week}>
            <div><b>Week {w.week}</b><div className="small muted">{w.status === "done" ? `${nights.length} nights` : state.weeks.find((x: any) => x.status === "pending")?.week === w.week ? "Drafting…" : "Waiting"}</div></div>
            <div>
              {w.status === "done" && CHECK_LABELS.map(([k, label], i) => {
                const pass = nights.filter((n: any) => n.checks?.[k]).length;
                const on = (shown[w.week] ?? 0) > i;
                const all = pass === nights.length;
                return <span key={k} className={`tick ${on ? "on" : ""}`} style={{ color: on ? (all ? "var(--ok)" : "var(--warn)") : undefined }}>{all ? <Check /> : <Warn />} {label(translation)} {pass}/{nights.length}</span>;
              })}
              {w.status === "done" && nights.some((n: any) => n.source === "starter") && (
                <div className="small muted" style={{ marginTop: 6 }}>{nights.filter((n: any) => n.source === "starter").length} from the Starter Plan</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
function NightsTab({ d, reload, setD }: { d: any; reload: () => Promise<void>; setD: (x: any) => void }) {
  const ch = d.church;
  const [drafting, setDrafting] = useState(false);
  const [state, setState] = useState<any>(d.draft);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<"review" | "approved" | "all">("review");
  const [elapsed, setElapsed] = useState<number | null>(null);
  const started = useRef(0);
  const draftAll = async (restart: boolean) => {
    setErr(""); setDrafting(true); started.current = Date.now(); setElapsed(null);
    try {
      let s = await api(`/api/churches/${ch.id}/draft`, { body: { restart } });
      setState(s);
      while (s.status !== "done") { s = await api(`/api/churches/${ch.id}/draft`, { body: {} }); setState(s); }
      setElapsed(Date.now() - started.current);
      await reload();
    } catch (e: any) { setErr(e.message); } finally { setDrafting(false); }
  };
  const nights: Night[] = d.nights;
  const approved = nights.filter((n) => n.status === "approved").length;
  const shown = nights.filter((n) => filter === "all" || (filter === "approved" ? n.status === "approved" : n.status !== "approved"));
  const replace = (n: Night) => setD({ ...d, nights: d.nights.map((x: Night) => (x.id === n.id ? n : x)) });
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>{nights.length ? `${approved} of ${nights.length} nights approved` : "Draft your Advent"}</h2>
            <p className="muted" style={{ margin: 0 }}>{ch.ai_on ? "AI drafts a week at a time. Code fills in Scripture and checks every line. You approve each night." : "AI is off: every night comes from the Starter Plan. You still approve each night."}</p>
          </div>
          {!ch.is_demo && (
            <button className="btn btn-gold" onClick={() => draftAll(nights.length > 0)} disabled={drafting}>
              <Spark /> {drafting ? "Drafting…" : nights.length ? "Redraft unapproved nights" : "Draft all nights"}
            </button>
          )}
        </div>
        {ch.is_demo && <p className="note" style={{ marginTop: 12 }}>This is the shared demo church, so redrafting the whole season is turned off. Open any night to edit, approve, or try “Regenerate this night”. Everything resets every hour.</p>}
        {d.ai_note && <p className="note" style={{ marginTop: 12 }}>{d.ai_note}</p>}
        {state && state.weeks?.length > 0 && (drafting || elapsed !== null) && <div style={{ marginTop: 12 }}><DraftProgress state={state} translation={TRANSLATIONS[ch.translation as "bsb"].short} /></div>}
        {elapsed !== null && <p className="small muted" style={{ marginTop: 8 }}>Drafted and checked in {(elapsed / 1000).toFixed(1)} seconds.</p>}
        {err && <p className="error" role="alert">{err}</p>}
      </section>
      {nights.length > 0 && (
        <>
          <div className="row" role="group" aria-label="Filter nights">
            {(["review", "approved", "all"] as const).map((f) => (
              <button key={f} className={`btn btn-small ${filter === f ? "btn-primary" : "btn-ghost"}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === "review" ? `Needs review (${nights.length - approved})` : f === "approved" ? `Approved (${approved})` : "All"}
              </button>
            ))}
            <span className="small muted">Each night needs its own approval. There is no "approve all".</span>
          </div>
          {shown.length === 0 && <p className="muted">{filter === "review" ? "Every night is approved. Families will see each one on its date." : "Nothing here yet."}</p>}
          {shown.map((n) => <NightReview key={n.id} n={n} ch={ch} onChange={replace} />)}
        </>
      )}
    </div>
  );
}

function Issues({ n }: { n: Night }) {
  const issues = n.checks?.issues ?? [];
  const hard = issues.filter((i: any) => i.severity === "hard");
  const soft = issues.filter((i: any) => i.severity === "soft");
  return (
    <ul className="checks" aria-label="Checks">
      {hard.length === 0 && soft.length === 0 && <li style={{ color: "var(--ok)" }}><Check /> All checks passed</li>}
      {hard.map((i: any, k: number) => <li key={"h" + k} style={{ color: "var(--bad)" }}><Cross /> <span><b>Must fix:</b> {i.message}</span></li>)}
      {soft.map((i: any, k: number) => <li key={"s" + k} style={{ color: "var(--warn)" }}><Warn /> <span>{i.message}</span></li>)}
      {(n.checks?.attempts ?? []).length > 0 && n.source === "starter" && <li className="small muted">AI attempts: {(n.checks.attempts as string[]).join(" → ")}</li>}
    </ul>
  );
}
function ProseView({ p, verse, reference, translation }: { p: any; verse: string | null; reference: string | null; translation: string }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="scripture">
        <div className="ref"><Lock /> {reference ?? "—"} · {translation} <span className="muted small" style={{ fontWeight: 400 }}>from the dataset</span></div>
        {verse ?? <span className="muted">No verse text</span>}
      </div>
      <div className="bands">
        <div className="band"><b>Little ones</b><span>{p.talk.little}</span></div>
        <div className="band"><b>Kids</b><span>{p.talk.kids}</span></div>
        <div className="band"><b>Grown-ups</b><span>{p.talk.grownups}</span></div>
        <div className="band"><b>Pray</b><span>{p.pray}</span></div>
        <div className="band"><b>Do</b><span>{p.do}</span></div>
        <div className="band"><b>Why this passage</b><span className="muted">{p.why}</span></div>
      </div>
    </div>
  );
}
function NightReview({ n, ch, onChange }: { n: Night; ch: Church; onChange: (n: Night) => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [includeEs, setIncludeEs] = useState(true);
  const act = async (what: string, fn: () => Promise<Night>) => {
    setBusy(what); setErr("");
    try { onChange(await fn()); } catch (e: any) { setErr(e instanceof ApiError ? e.message : "Something went wrong."); } finally { setBusy(""); }
  };
  const tr = TRANSLATIONS[ch.translation as "bsb"].short;
  const weekLabel = seasonLabel(n.date, ch.tradition as "hope", "en");
  const status = n.status === "approved" ? <span className="pill ok"><Check /> Approved</span> : n.status === "rejected" ? <span className="pill bad">Rejected</span>
    : n.checks?.ok ? <span className="pill">Draft</span> : <span className="pill bad"><Warn /> Needs a fix</span>;
  const sourceLabel = n.source === "starter" ? "From the Starter Plan" : n.source === "pastor" ? "Written by the pastor" : `AI-drafted${n.model ? ` (${n.model})` : ""}`;
  return (
    <article className="card night-card" aria-labelledby={`n${n.night}`}>
      <div className="night-head">
        <div>
          <h3 id={`n${n.night}`} style={{ margin: 0 }}>Night {n.night} · {fmtDate(n.date, "en", { weekday: "short", month: "short", day: "numeric" })}</h3>
          <div className="small muted">{weekLabel} · {sourceLabel}{n.edited ? ", edited" : ""}</div>
        </div>
        {status}
      </div>
      {editing ? <EditNight n={n} ch={ch} onCancel={() => setEditing(false)} onSaved={(x) => { onChange(x); setEditing(false); }} /> : (
        ch.spanish_on && n.es ? (
          <div className="side">
            <ProseView p={n} verse={n.verse_en} reference={n.reference} translation={tr} />
            <div>
              <div className="small" style={{ fontWeight: 600, color: "var(--gold-deep)", marginBottom: 6 }}>Español · Spanish drafted with AI{n.source === "starter" ? " help, reviewed" : ""}</div>
              <ProseView p={n.es} verse={n.verse_es} reference={n.reference_es} translation="RV1909" />
            </div>
          </div>
        ) : <ProseView p={n} verse={n.verse_en} reference={n.reference} translation={tr} />
      )}
      <Issues n={n} />
      {n.status === "approved" && <p className="small muted" style={{ margin: 0 }}>Approved by {n.approved_name} on {fmtDate(n.approved_at, "en")}{n.es_approved ? " (English and Spanish)" : " (English only)"} · hash {n.content_hash?.slice(0, 10)}</p>}
      {err && <p className="error" role="alert">{err}</p>}
      {!editing && (
        <div className="actions">
          {n.status !== "approved" && (
            <>
              <button className="btn btn-primary btn-small" disabled={!!busy || !n.checks?.ok} title={n.checks?.ok ? "" : "Fix the checks first"}
                onClick={() => act("approve", () => api(`/api/nights/${n.id}/approve`, { body: { include_es: includeEs } }))}><Check /> Approve</button>
              {ch.spanish_on && n.es && n.verse_es && (
                <label className="switch small"><input type="checkbox" checked={includeEs} onChange={(e) => setIncludeEs(e.target.checked)} /> Include Spanish</label>
              )}
            </>
          )}
          <button className="btn btn-ghost btn-small" disabled={!!busy} onClick={() => setEditing(true)}>Edit</button>
          {ch.ai_on && <button className="btn btn-ghost btn-small" disabled={!!busy} onClick={() => act("regen", () => api(`/api/nights/${n.id}/regenerate`, { body: {} }))}>{busy === "regen" ? "Regenerating…" : "Regenerate this night"}</button>}
          <button className="btn btn-ghost btn-small" disabled={!!busy} onClick={() => act("starter", () => api(`/api/nights/${n.id}/use-starter`, { body: {} }))}>Use Starter Plan</button>
          {n.status !== "rejected" && <button className="btn btn-danger btn-small" disabled={!!busy} onClick={() => act("reject", () => api(`/api/nights/${n.id}/reject`, { body: {} }))}>Reject</button>}
        </div>
      )}
    </article>
  );
}
function EditNight({ n, ch, onCancel, onSaved }: { n: Night; ch: Church; onCancel: () => void; onSaved: (n: Night) => void }) {
  const [v, setV] = useState({ reference: n.reference, why: n.why, talk: { ...n.talk }, pray: n.pray, do: n.do });
  const [es, setEs] = useState(n.es ? { ...n.es, talk: { ...n.es.talk } } : null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const F = ({ id, label, value, onChange, max, area }: { id: string; label: string; value: string; onChange: (x: string) => void; max: number; area?: boolean }) => (
    <div className="field">
      <label htmlFor={id}>{label} <span className="muted small">({value.length}/{max})</span></label>
      {area ? <textarea id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} /> : <input id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
  return (
    <form onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr("");
      try { onSaved(await api(`/api/nights/${n.id}`, { method: "PATCH", body: { ...v, ...(es ? { es } : {}) } })); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
    }}>
      <p className="note small">Saving re-runs every check. If this night was approved, it goes back to draft until you approve it again.</p>
      <div className={es ? "side" : ""}>
        <div>
          {F({ id: `r${n.id}`, label: "Reference (Scripture text is filled in by code)", value: v.reference, onChange: (x) => setV({ ...v, reference: x }), max: 60 })}
          {F({ id: `l${n.id}`, label: "Little ones", value: v.talk.little, onChange: (x) => setV({ ...v, talk: { ...v.talk, little: x } }), max: 160 })}
          {F({ id: `k${n.id}`, label: "Kids", value: v.talk.kids, onChange: (x) => setV({ ...v, talk: { ...v.talk, kids: x } }), max: 160 })}
          {F({ id: `g${n.id}`, label: "Grown-ups", value: v.talk.grownups, onChange: (x) => setV({ ...v, talk: { ...v.talk, grownups: x } }), max: 160 })}
          {F({ id: `p${n.id}`, label: "Pray", value: v.pray, onChange: (x) => setV({ ...v, pray: x }), max: 200, area: true })}
          {F({ id: `d${n.id}`, label: "Do", value: v.do, onChange: (x) => setV({ ...v, do: x }), max: 220, area: true })}
          {F({ id: `w${n.id}`, label: "Why this passage", value: v.why, onChange: (x) => setV({ ...v, why: x }), max: 160 })}
        </div>
        {es && ch.spanish_on && (
          <div>
            <div className="small" style={{ fontWeight: 600, marginBottom: 8 }}>Español</div>
            {F({ id: `el${n.id}`, label: "Pequeñitos", value: es.talk.little, onChange: (x) => setEs({ ...es, talk: { ...es.talk, little: x } }), max: 160 })}
            {F({ id: `ek${n.id}`, label: "Niños", value: es.talk.kids, onChange: (x) => setEs({ ...es, talk: { ...es.talk, kids: x } }), max: 160 })}
            {F({ id: `eg${n.id}`, label: "Adultos", value: es.talk.grownups, onChange: (x) => setEs({ ...es, talk: { ...es.talk, grownups: x } }), max: 160 })}
            {F({ id: `ep${n.id}`, label: "Orar", value: es.pray, onChange: (x) => setEs({ ...es, pray: x }), max: 200, area: true })}
            {F({ id: `ed${n.id}`, label: "Hacer", value: es.do, onChange: (x) => setEs({ ...es, do: x }), max: 220, area: true })}
            {F({ id: `ew${n.id}`, label: "Por qué este pasaje", value: es.why, onChange: (x) => setEs({ ...es, why: x }), max: 160 })}
          </div>
        )}
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="actions"><button className="btn btn-primary btn-small" disabled={busy}>Save and re-check</button><button type="button" className="btn btn-ghost btn-small" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

// ---------------- dashboard ----------------
function DashboardTab({ ch, nights, today }: { ch: Church; nights: Night[]; today: string }) {
  const [d, setD] = useState<any>(null);
  const [ann, setAnn] = useState<any>(null);
  const [annBusy, setAnnBusy] = useState(false);
  const [annErr, setAnnErr] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { api(`/api/churches/${ch.id}/dashboard`).then(setD).catch(() => {}); }, [ch.id]);
  if (!d) return <p className="muted" aria-busy="true">Loading…</p>;
  // The server's dashboard date (the demo church opens Night 1 early, like the family view).
  const day: string = d.today ?? today;
  const demoEarly = !!d.is_demo && day !== today;
  const tonight = nights.find((n) => n.date === day && n.status === "approved");
  const max = Math.max(5, ...d.nights.map((n: any) => n.lit.value ?? 0));
  const slide = () => {
    const c = document.createElement("canvas");
    c.width = 1920; c.height = 1080;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(960, 420, 50, 960, 540, 1100);
    grad.addColorStop(0, "#1d4a3a"); grad.addColorStop(1, "#07140f");
    g.fillStyle = grad; g.fillRect(0, 0, 1920, 1080);
    g.fillStyle = "#f2b84b"; g.beginPath(); g.ellipse(960, 330, 34, 70, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff7e6"; g.textAlign = "center";
    g.font = "600 84px Fraunces, Georgia, serif"; g.fillText(ch.name, 960, 560);
    g.font = "600 64px Fraunces, Georgia, serif";
    g.fillText(`This week, ${d.this_week.households.label} households lit ${d.this_week.candles.label} candles.`, 960, 700);
    g.fillStyle = "#c9c1ac"; g.font = "40px Inter, system-ui, sans-serif"; g.fillText(`Join tonight: ${location.host}/j/${ch.code}`, 960, 820);
    if (ch.is_demo) { g.fillStyle = "#d77a9c"; g.font = "600 32px Inter, sans-serif"; g.fillText("Demo data", 960, 1000); }
    const a = document.createElement("a"); a.download = `${ch.code}-advent-slide.png`; a.href = c.toDataURL("image/png"); a.click();
  };
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="grid2">
        <div className="card"><div className="muted small">Households joined</div><div className="stat">{d.households.label}</div></div>
        <div className="card"><div className="muted small">This week (week {d.this_week.week})</div><div className="stat">{d.this_week.candles.label}</div><div className="muted small">candles lit by {d.this_week.households.label} households</div></div>
      </div>
      <section className="card">
        <h2>Candles lit per night</h2>
        <div className="bars" role="img" aria-label="Candles lit per night. Counts under 5 show as fewer than 5.">
          {d.nights.map((n: any) => (
            <div key={n.night} className={`bar ${n.lit.value === null ? "low" : ""}`} style={n.lit.value !== null ? { height: `${(n.lit.value / max) * 100}%` } : undefined} title={`Night ${n.night}: ${n.lit.label}`} />
          ))}
        </div>
        <div className="row small muted" style={{ justifyContent: "space-between" }}><span>Night 1</span><span>Hatched bars mean fewer than 5. We never show smaller counts.</span><span>Night {d.nights.length}</span></div>
      </section>
      <section className="card">
        <h2>Sunday announcement</h2>
        <p className="muted small">Code computes the numbers. {ch.ai_on ? "AI may only reword them, and every number is checked." : "AI is off, so this uses a plain template."}</p>
        {ann ? <>
          <p className="scripture" style={{ fontFamily: "var(--sans)" }}>{ann.text}</p>
          {ann.note && <p className="note small">{ann.note}</p>}
          <p className="small muted">{ann.source === "ai" ? "AI-worded · numbers checked" : "Plain template"}</p>
          <div className="row">
            <button className="btn btn-primary btn-small" onClick={async () => { await navigator.clipboard.writeText(ann.text); setCopied(true); }}>{copied ? "Copied" : "Approve and copy"}</button>
            <button className="btn btn-ghost btn-small" onClick={slide}>Download slide (PNG)</button>
          </div>
        </> : <>
          <button className="btn btn-ghost" disabled={annBusy} aria-busy={annBusy} onClick={async () => {
            setAnnBusy(true); setAnnErr("");
            try { setAnn(await api(`/api/churches/${ch.id}/announcement`, { body: {} })); }
            catch (e: any) { setAnnErr(e?.message || "Something went wrong. Please try again."); }
            finally { setAnnBusy(false); }
          }}>{annBusy ? "Drafting… (about 15 seconds)" : "Draft this Sunday's announcement"}</button>
          {annErr && <p className="error" role="alert">{annErr}</p>}
        </>}
      </section>
      <section className="card">
        <h2>Tonight's card</h2>
        {demoEarly && tonight && <p className="small muted">Demo: families see Night 1 early, before Advent begins on {fmtDate(ch.season_start, "en")}.</p>}
        {tonight ? <ProseView p={tonight} verse={tonight.verse_en} reference={tonight.reference} translation={TRANSLATIONS[ch.translation as "bsb"].short} />
          : <p className="muted">No approved night is scheduled for today ({fmtDate(day, "en")}). The season runs {fmtDate(ch.season_start, "en")} to {fmtDate(ch.season_end, "en")}.</p>}
      </section>
      <section className="card">
        <h2>AI activity log</h2>
        <p className="small muted">Time, model, outcome and check results. No personal data.</p>
        <AiLog runs={d.ai_runs} />
      </section>
    </div>
  );
}
/** Plain-English outcome for the AI activity log (raw code kept in the tooltip). */
export function outcomeLabel(o: string): string {
  const [kind, status, ...rest] = String(o ?? "").split(":");
  const n = kind.match(/night-(\d+)$/)?.[1];
  const what = kind.startsWith("regenerate") ? "Regenerated one night" : kind === "announcement" ? "Worded the announcement"
    : kind === "starter-plan" ? "Used the Starter Plan" : kind.startsWith("retry-night") ? `Retried night ${n} after a failed check`
    : kind.startsWith("fallback-night") ? `Backup model redrafted night ${n}` : kind.endsWith("fallback") ? "Backup model drafted the week" : "Drafted the week";
  if (kind === "starter-plan") return what;
  if (status === "ok") return `${what} ✓`;
  const why = rest.join(":");
  return /timeout|aborted/i.test(why) ? `${what}: timed out, so the backup model took over` : `${what}: failed (${status || "error"}), handled by the fallback`;
}
function AiLog({ runs }: { runs: any[] }) {
  if (!runs?.length) return <p className="muted">No AI activity yet.</p>;
  const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="small ailog" style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
        <thead><tr style={{ textAlign: "left" }}><th>When</th><th>Week</th><th>Model</th><th>What happened</th><th>Time</th></tr></thead>
        <tbody>{runs.map((r, i) => <tr key={i} style={{ borderTop: "1px solid var(--line)" }}><td>{when(r.created_at)}</td><td>{r.week}</td><td>{r.model}</td><td title={r.outcome}>{outcomeLabel(r.outcome)}</td><td>{(r.ms / 1000).toFixed(1)} s</td></tr>)}</tbody>
      </table>
    </div>
  );
}

// ---------------- share kit ----------------
function ShareTab({ ch }: { ch: Church }) {
  const link = `${location.origin}/j/${ch.code}`;
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState("");
  useEffect(() => { QRCode.toDataURL(link, { width: 640, margin: 2, color: { dark: "#0f2a22", light: "#ffffff" } }).then(setQr); }, [link]);
  const invite = `This Advent, ${ch.name} is lighting candles at home together. Five minutes a night at the table: read, talk, pray, do. Then phones down. Join with code ${ch.code} at ${link}`;
  const copy = async (k: string, text: string) => { await navigator.clipboard.writeText(text); setCopied(k); setTimeout(() => setCopied(""), 2000); };
  return (
    <div className="grid2">
      <section className="card">
        <h2>Church code</h2>
        <div className="stat" style={{ letterSpacing: "0.2em" }}>{ch.code}</div>
        <p><a href={link}>{link}</a></p>
        <button className="btn btn-ghost btn-small" onClick={() => copy("link", link)}>{copied === "link" ? "Copied" : "Copy link"}</button>
        <h3 style={{ marginTop: 20 }}>Invite text</h3>
        <p className="note">{invite}</p>
        <button className="btn btn-ghost btn-small" onClick={() => copy("inv", invite)}>{copied === "inv" ? "Copied" : "Copy invite text"}</button>
        <p className="small muted" style={{ marginTop: 16 }}>You send it yourself. {APP_NAME} never sends email or texts.</p>
      </section>
      <section className="card" style={{ textAlign: "center" }}>
        <h2>QR code</h2>
        {qr && <img src={qr} alt={`QR code that opens ${link}`} width={240} height={240} />}
        <div className="row" style={{ justifyContent: "center" }}>
          {qr && <a className="btn btn-primary btn-small" href={qr} download={`${ch.code}-qr.png`}>Download QR (PNG)</a>}
          <a className="btn btn-ghost btn-small" href={`/print/${ch.id}/insert`} target="_blank" rel="noopener">Bulletin insert</a>
          <a className="btn btn-ghost btn-small" href={`/c/${ch.code}/wreath`} target="_blank" rel="noopener">Projector wreath</a>
        </div>
      </section>
    </div>
  );
}

// ---------------- AI settings ----------------
function AiTab({ ch, note, reload }: { ch: Church; note: string; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section className="card">
        <h2>AI drafting</h2>
        <label className="switch" style={{ fontSize: "1.1rem" }}>
          <input type="checkbox" checked={ch.ai_on} disabled={busy} onChange={async (e) => { setBusy(true); await api(`/api/churches/${ch.id}`, { method: "PATCH", body: { ai_on: e.target.checked } }); await reload(); setBusy(false); }} />
          AI is {ch.ai_on ? "on" : "off"} for {ch.name}
        </label>
        <p className="muted" style={{ marginTop: 12 }}>When AI is off, drafting uses the Starter Plan (written with AI help and reviewed by a person), and AI-only tools such as Regenerate and the AI-worded announcement are hidden. Nights you already approved stay as they are, with their labels.</p>
        {note && <p className="note">{note}</p>}
      </section>
      <section className="card">
        <h2>What the AI sees</h2>
        <p>Only: theme, tradition, translation name, season dates, your optional sermon titles and passages, language, and the age-band rules. Never anything about families: no counts, nicknames or IP addresses.</p>
        <p className="small muted">Prompt text is deleted after 7 days. Caps: 20 AI calls per church per day.</p>
        <Link to={`/ai?c=${ch.code}`}>See the family-facing "How we use AI" page</Link>
      </section>
    </div>
  );
}
