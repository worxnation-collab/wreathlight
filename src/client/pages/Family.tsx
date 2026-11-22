import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../api";
import { DICTS, fmtDate, type Lang } from "../i18n";
import { Wreath } from "../components/Wreath";
import { Globe, Lock, Share } from "../components/Icons";
import { Link, navigate } from "../router";
import { KEEP_GOING_URL } from "../../shared/brand";

interface PubNight {
  night: number; date: string; week: number; reference: string; verse_en: string; translation: string; why: string;
  talk: { little: string; kids: string; grownups: string }; pray: string; do: string;
  es: null | { reference: string; verse: string; translation: string; why: string; talk: { little: string; kids: string; grownups: string }; pray: string; do: string };
  label: { source: "ai" | "starter" | "pastor"; edited: boolean; approved_name: string; approved_at: string };
}
interface Pub {
  church: { code: string; name: string; pastor_display_name: string; candles: { en: string; es: string; color: string }[]; translation: { name: string; short: string };
    spanish_on: boolean; xmas_eve_times: string; is_demo: boolean; keep_going: null | { church_url: string }; season_start: string; season_end: string; season_length: number };
  today: string; tonight: number | null; preview: boolean; after_christmas: boolean; nights: PubNight[];
}

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
function deviceId(): string {
  let d = ls.get("wl:device");
  if (!d || !/^[a-f0-9-]{36}$/.test(d)) { d = crypto.randomUUID(); ls.set("wl:device", d); }
  return d;
}
function addDays(iso: string, n: number) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

export default function Family({ code: initialCode }: { code: string }) {
  const preview = new URLSearchParams(location.search).get("preview") === "1";
  const [lang, setLang] = useState<Lang>(() => (ls.get("wl:lang") === "es" ? "es" : "en"));
  const t = DICTS[lang];
  const [code, setCode] = useState(initialCode);
  const [data, setData] = useState<Pub | null>(null);
  const [wreath, setWreath] = useState<any>(null);
  const [err, setErr] = useState("");
  const [joined, setJoined] = useState(() => !!initialCode && ls.get(`wl:joined:${initialCode}`) === "1");
  const [nick, setNick] = useState(() => (initialCode ? ls.get(`wl:nick:${initialCode}`) ?? "" : ""));
  const [lit, setLit] = useState<number[]>(() => { try { return JSON.parse(ls.get(`wl:lit:${initialCode}`) ?? "[]"); } catch { return []; } });
  const [view, setView] = useState<{ kind: "home" } | { kind: "card"; night: number } | { kind: "phones" }>({ kind: "home" });
  const [justLit, setJustLit] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => { document.documentElement.lang = lang; ls.set("wl:lang", lang); }, [lang]);

  const load = useCallback(async (c: string) => {
    const q = preview ? "?preview=1" : "";
    const [d, w] = await Promise.all([api<Pub>(`/api/public/${c}${q}`), api(`/api/public/${c}/wreath`)]);
    setData(d); setWreath(w);
    return d;
  }, [preview]);

  useEffect(() => {
    if (!initialCode) return;
    load(initialCode).then((d) => {
      if (ls.get(`wl:joined:${initialCode}`) === "1") {
        const tonight = d.nights.find((n) => n.night === d.tonight);
        if (tonight && !lit.includes(tonight.night)) setView({ kind: "card", night: tonight.night });
      }
    }).catch((e) => setErr(e instanceof ApiError && e.status === 404 ? t.not_found : e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const c = code.trim().toUpperCase();
    try {
      const d = data && data.church.code === c ? data : await load(c);
      // The nickname is stored on this device only. It is never sent to the server.
      ls.set(`wl:nick:${c}`, nick.trim());
      await api(`/api/public/${c}/join`, { body: { device: deviceId() } });
      ls.set(`wl:joined:${c}`, "1");
      setJoined(true);
      if (c !== initialCode) history.replaceState(null, "", `/j/${c}${preview ? "?preview=1" : ""}`);
      const tonight = d.nights.find((n) => n.night === d.tonight);
      setView(tonight && !lit.includes(tonight.night) ? { kind: "card", night: tonight.night } : { kind: "home" });
    } catch (e: any) {
      setErr(e instanceof ApiError && e.status === 404 ? t.not_found : e.message);
    }
  };

  const light = async (night: number) => {
    const c = data!.church.code;
    try { await api(`/api/public/${c}/light`, { body: { night, device: deviceId() } }); } catch { /* still lit locally; the count may miss this one */ }
    const next = [...new Set([...lit, night])];
    setLit(next);
    ls.set(`wl:lit:${c}`, JSON.stringify(next));
    setJustLit(night);
    setView({ kind: "phones" });
    api(`/api/public/${c}/wreath`).then(setWreath).catch(() => {});
  };

  const invite = async () => {
    const url = `${location.origin}/j/${data!.church.code}`;
    const text = t.invite_text(data!.church.name);
    try {
      if (navigator.share) await navigator.share({ title: data!.church.name, text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); setToast(t.copied); setTimeout(() => setToast(""), 2500); }
    } catch { /* cancelled */ }
  };

  const LangBtn = (
    <button className="btn btn-ghost btn-small" onClick={() => setLang(lang === "en" ? "es" : "en")} aria-label={lang === "en" ? "Cambiar a español" : "Switch to English"}>
      <Globe /> {t.lang}
    </button>
  );

  // ---------- join ----------
  if (!joined || !data) {
    return (
      <main className="family">
        <div className="wrap">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
            <Link to="/" className="brand" style={{ color: "#fff7e6" }}>Wreathlight</Link>
            {LangBtn}
          </div>
          <Wreath candleColors={["#7b5ea7", "#7b5ea7", "#d77a9c", "#7b5ea7"]} sundaysLit={0} christLit={false} title="Advent wreath" />
          <h1 style={{ fontSize: "1.8rem" }}>{data ? data.church.name : t.join_title}</h1>
          {data?.church.is_demo && <p><span className="pill demo">{t.demo}</span></p>}
          <form onSubmit={join} className="fcard" style={{ display: "grid", gap: 4 }}>
            {!initialCode && (
              <div className="field">
                <label htmlFor="code">{t.join_code}</label>
                <input id="code" className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} autoCapitalize="characters" autoComplete="off" required style={{ letterSpacing: "0.2em" }} />
              </div>
            )}
            <div className="field">
              <label htmlFor="nick">{t.join_nick}</label>
              <input id="nick" className="input" value={nick} onChange={(e) => setNick(e.target.value)} placeholder={t.join_nick_ph} maxLength={40} autoComplete="off" />
              <span className="hint" style={{ color: "#c9c1ac" }}>{t.join_nick_hint}</span>
            </div>
            {err && <p className="error" role="alert" style={{ color: "#ffb4a8" }}>{err}</p>}
            <button className="btn btn-gold" type="submit" style={{ minHeight: 56, fontSize: "1.1rem" }}>{t.join_btn}</button>
          </form>
          <Footer t={t} code={data?.church.code ?? code} />
        </div>
      </main>
    );
  }

  const ch = data.church;
  const nightsBy = new Map(data.nights.map((n) => [n.night, n]));
  const tonight = data.tonight ? nightsBy.get(data.tonight) : undefined;
  const candleName = (w: number) => (lang === "es" ? ch.candles[w - 1]?.es : ch.candles[w - 1]?.en) ?? "";

  if (view.kind === "phones") {
    return (
      <main className="phones" aria-live="polite">
        <div>
          <Wreath candleColors={ch.candles.map((c) => c.color)} sundaysLit={wreath?.sundays_lit ?? 0} christLit={!!wreath?.christ_candle} title={t.our_wreath}
            ring={Array.from({ length: ch.season_length }, (_, i) => ({ night: i + 1, glow: lit.includes(i + 1) }))} justLit={justLit} />
          <h2>{t.phones_title}</h2>
          <p style={{ fontSize: "1.2rem" }}>{t.phones_body}</p>
          <button className="btn btn-ghost" style={{ marginTop: 24, color: "#c9c1ac", borderColor: "#2d5446" }} onClick={() => setView({ kind: "home" })}>{t.phones_back}</button>
        </div>
      </main>
    );
  }

  if (view.kind === "card") {
    const n = nightsBy.get(view.night);
    if (n) return <NightCard n={n} lang={lang} t={t} LangBtn={LangBtn} candle={candleName(n.week)} xmas={ch.xmas_eve_times} alreadyLit={lit.includes(n.night)}
      onBack={() => setView({ kind: "home" })} onLight={() => light(n.night)} demo={ch.is_demo} />;
  }

  // ---------- home: our wreath ----------
  const seasonDates = Array.from({ length: ch.season_length }, (_, i) => ({ night: i + 1, date: addDays(ch.season_start, i) }));
  return (
    <main className="family">
      <div className="wrap">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "var(--serif)", fontSize: "1.25rem", color: "#fff7e6" }}>{ch.name}</div>
            {nick && <div className="muted small">{nick}</div>}
          </div>
          {LangBtn}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 6 }}>
          {ch.is_demo && <span className="pill demo">{t.demo}</span>}
          {data.preview && <span className="pill">{t.preview}</span>}
        </div>
        <Wreath candleColors={ch.candles.map((c) => c.color)} sundaysLit={wreath?.sundays_lit ?? 0} christLit={!!wreath?.christ_candle} title={t.our_wreath}
          ring={seasonDates.map((d) => ({ night: d.night, glow: lit.includes(d.night), label: `${t.night} ${d.night} ${lit.includes(d.night) ? t.lit : t.missed}` }))} justLit={justLit} />
        <section className="fcard" aria-labelledby="tonight-h" style={{ marginBottom: 16 }}>
          <h2 id="tonight-h" style={{ fontSize: "1.4rem" }}>{t.tonight}{data.tonight ? ` · ${t.night} ${data.tonight}` : ""}</h2>
          {data.today < ch.season_start && !data.preview ? <p>{t.before(fmtDate(ch.season_start, lang, { weekday: "long", month: "long", day: "numeric" }))}</p>
            : tonight ? (lit.includes(tonight.night) ? <p>{t.lit_already} {t.phones_title}</p>
              : <button className="btn btn-gold" style={{ width: "100%", minHeight: 56 }} onClick={() => setView({ kind: "card", night: tonight.night })}>{t.read} · {t.talk} · {t.pray} · {t.do}</button>)
              : <p>{t.no_tonight}</p>}
        </section>
        <section className="fcard" aria-labelledby="wreath-h">
          <h2 id="wreath-h" style={{ fontSize: "1.3rem" }}>{t.our_wreath}</h2>
          <p>{t.household_streak(lit.length)}</p>
          {wreath && <p className="muted">{t.church_glow(wreath.this_week.households.label, wreath.this_week.candles.label)}</p>}
          <p className="small muted" style={{ marginBottom: 8 }}>{t.catch_up}</p>
          <div className="nightgrid" role="list">
            {seasonDates.map((d) => {
              const avail = nightsBy.get(d.night);
              const isLit = lit.includes(d.night);
              const label = `${t.night} ${d.night}, ${fmtDate(d.date, lang)}: ${isLit ? t.lit : avail ? t.missed : t.locked}`;
              return (
                <div role="listitem" key={d.night}>
                  <button className={`nightdot ${isLit ? "lit" : ""} ${avail ? "" : "locked"} ${d.night === data.tonight ? "today" : ""}`} style={{ width: "100%" }}
                    disabled={!avail} aria-label={label} title={label} onClick={() => avail && setView({ kind: "card", night: d.night })}>
                    {avail ? d.night : <Lock />}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
        {ch.keep_going && (data.after_christmas || data.preview) && (
          <section className="fcard" style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: "1.3rem" }}>{t.keep_title}</h2>
            <ul style={{ paddingLeft: 18, display: "grid", gap: 10 }}>
              {ch.keep_going.church_url && <li><a href={ch.keep_going.church_url} rel="noopener">{t.keep_church}</a></li>}
              <li><a href={KEEP_GOING_URL} rel="noopener noreferrer">{t.keep_va}</a><div className="small muted">{t.keep_va_note}</div></li>
            </ul>
          </section>
        )}
        <div className="row" style={{ justifyContent: "center", marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={invite}><Share /> {t.invite}</button>
        </div>
        {toast && <p role="status" style={{ textAlign: "center" }}>{toast}</p>}
        <Footer t={t} code={ch.code} />
      </div>
    </main>
  );
}

function Footer({ t, code }: { t: (typeof DICTS)["en"]; code: string }) {
  return (
    <footer className="footer">
      <Link to={`/ai${code ? `?c=${code}` : ""}`}>{t.how_ai}</Link>
    </footer>
  );
}

function NightCard({ n, lang, t, LangBtn, candle, xmas, alreadyLit, onBack, onLight, demo }: {
  n: PubNight; lang: Lang; t: (typeof DICTS)["en"]; LangBtn: React.ReactNode; candle: string; xmas: string; alreadyLit: boolean;
  onBack: () => void; onLight: () => void; demo: boolean;
}) {
  const [step, setStep] = useState(0);
  const es = lang === "es" && n.es ? n.es : null;
  const steps = [t.read, t.talk, t.pray, t.do];
  const headRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headRef.current?.focus(); }, [step]);
  const who = n.label.approved_name;
  const when = fmtDate(n.label.approved_at, lang);
  const label = n.label.source === "starter" ? t.label_starter(who, when) : n.label.source === "pastor" ? t.label_pastor(who, when) : t.label_ai(who, when);
  const talk = es ? es.talk : n.talk;
  return (
    <main className="family">
      <div className="wrap">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <button className="btn btn-ghost btn-small" onClick={onBack}>← {t.our_wreath}</button>
          {LangBtn}
        </div>
        <p className="muted small" style={{ margin: "0 0 6px" }}>
          {t.night} {n.night} · {fmtDate(n.date, lang, { weekday: "long", month: "long", day: "numeric" })} · {t.week_candle(candle)}
          {demo && <> · <span className="pill demo">{t.demo}</span></>}
        </p>
        <article className="fcard" aria-live="polite">
          <nav className="steps" aria-label="Steps">
            {steps.map((s, i) => (
              <button key={s} aria-current={i === step ? "step" : undefined} onClick={() => setStep(i)}>{s}</button>
            ))}
          </nav>
          <h1 ref={headRef} tabIndex={-1} className="sr-only">{steps[step]}</h1>
          {step === 0 && (
            <div>
              <p className="muted small" style={{ marginTop: 0 }}>{t.read_hint}</p>
              <blockquote className="verse" style={{ margin: 0 }}>{es ? es.verse : n.verse_en}</blockquote>
              <div className="vref">{es ? `${es.reference} · ${es.translation}` : `${n.reference} · ${n.translation}`}</div>
              <p className="muted" style={{ marginTop: 14, fontSize: "1rem" }}>{es ? es.why : n.why}</p>
            </div>
          )}
          {step === 1 && (
            <div>
              <div className="qlabel">{t.little}</div><p className="big">{talk.little}</p>
              <div className="qlabel">{t.kids}</div><p className="big">{talk.kids}</p>
              <div className="qlabel">{t.grownups}</div><p className="big">{talk.grownups}</p>
            </div>
          )}
          {step === 2 && <p className="big" style={{ fontFamily: "var(--serif)", fontSize: "1.4rem" }}>{es ? es.pray : n.pray}</p>}
          {step === 3 && (
            <div>
              <p className="big">{es ? es.do : n.do}</p>
              {n.date.endsWith("-12-24") && xmas && (
                <div style={{ borderTop: "1px solid #2d5446", marginTop: 14, paddingTop: 10 }}>
                  <div className="qlabel">{t.xmas_eve}</div><p style={{ whiteSpace: "pre-line" }}>{xmas}</p>
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: 20 }}>
            {step < 3 ? (
              <button className="btn btn-gold" style={{ width: "100%", minHeight: 56, fontSize: "1.1rem" }} onClick={() => setStep(step + 1)}>{t.next}: {steps[step + 1]}</button>
            ) : alreadyLit ? (
              <p style={{ textAlign: "center" }}>{t.lit_already}</p>
            ) : (
              <HoldToLight label={t.hold} holding={t.holding} onDone={onLight} />
            )}
          </div>
          <div className="label-ai">{label}{n.label.edited ? ` (${t.edited})` : ""}</div>
          {lang === "es" && !n.es && <div className="label-ai">Esta noche está disponible solo en inglés.</div>}
        </article>
        <footer className="footer"><Link to={`/ai?c=${location.pathname.split("/")[2] ?? ""}`}>{t.how_ai}</Link></footer>
      </div>
    </main>
  );
}

function HoldToLight({ label, holding, onDone }: { label: string; holding: string; onDone: () => void }) {
  const [active, setActive] = useState(false);
  const timer = useRef<number | null>(null);
  const reduced = useMemo(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);
  const start = () => {
    if (timer.current) return;
    setActive(true);
    timer.current = window.setTimeout(() => { timer.current = null; setActive(false); onDone(); }, 1000);
  };
  const cancel = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } setActive(false); };
  useEffect(() => cancel, []);
  return (
    <button className="hold" onPointerDown={(e) => { e.preventDefault(); start(); }} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
      onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); start(); } }}
      onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") cancel(); }} onContextMenu={(e) => e.preventDefault()}
      aria-label={label}>
      <div className="fill" style={{ transform: `scaleX(${active ? 1 : 0})`, transition: active && !reduced ? "transform 1s linear" : "none" }} />
      <span>{active ? holding : label}</span>
    </button>
  );
}

export { navigate };
