import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "../api";
import { fmtDate } from "../i18n";
import { TRANSLATIONS } from "../../shared/season";
import { APP_NAME } from "../../shared/brand";

export default function Print({ churchId, kind }: { churchId: string; kind: "booklet" | "fridge" | "insert" }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const [qr, setQr] = useState("");
  useEffect(() => { api(`/api/churches/${churchId}`).then(setD).catch((e) => setErr(e.message)); }, [churchId]);
  useEffect(() => { if (d) QRCode.toDataURL(`${location.origin}/j/${d.church.code}`, { width: 400, margin: 1 }).then(setQr); }, [d]);
  if (err) return <p className="wrap error">{err} <a href="/studio">Sign in</a></p>;
  if (!d) return <p className="wrap muted">Loading…</p>;
  const ch = d.church;
  const approved = d.nights.filter((n: any) => n.status === "approved");
  const tr = TRANSLATIONS[ch.translation as "bsb"];
  const bar = (
    <div className="no-print row" style={{ padding: 16, background: "var(--paper)", borderBottom: "1px solid var(--line)" }}>
      <button className="btn btn-primary btn-small" onClick={() => window.print()}>Print</button>
      <span className="small muted">Letter paper. Turn off headers and footers in the print dialog for the cleanest result.</span>
    </div>
  );
  const page: React.CSSProperties = { background: "white", color: "#1a1a1a", maxWidth: "8.5in", margin: "0 auto", padding: "0.5in" };

  if (kind === "fridge") {
    const n = ch.season === "dec1" ? 25 : 27;
    const flames = Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const x = 300 + Math.cos(a) * 230, y = 330 + Math.sin(a) * 230;
      return (
        <g key={i} transform={`translate(${x} ${y})`}>
          <path d="M0,-22 C8,-11 9,-4 0,4 C-9,-4 -8,-11 0,-22 Z" fill="none" stroke="#222" strokeWidth="1.6" />
          <text y="22" textAnchor="middle" fontSize="11" fontFamily="Inter, sans-serif">{i + 1}</text>
        </g>
      );
    });
    const leaves = Array.from({ length: 40 }, (_, i) => {
      const a = (i / 40) * Math.PI * 2;
      const x = 300 + Math.cos(a) * 140, y = 330 + Math.sin(a) * 140;
      return <ellipse key={i} cx={x} cy={y} rx={24} ry={9} fill="none" stroke="#222" strokeWidth="1.4" transform={`rotate(${(a * 180) / Math.PI + 90 + (i % 2 ? 30 : -30)} ${x} ${y})`} />;
    });
    const cand = [[-140], [-40], [40], [140]].map(([deg], i) => {
      const a = (deg * Math.PI) / 180, x = 300 + Math.cos(a) * 140, y = 330 + Math.sin(a) * 140;
      return <g key={i}><rect x={x - 12} y={y - 70} width={24} height={70} rx={3} fill="white" stroke="#222" strokeWidth="1.6" /><path transform={`translate(${x} ${y - 74})`} d="M0,-22 C8,-11 9,-4 0,4 C-9,-4 -8,-11 0,-22 Z" fill="white" stroke="#222" strokeWidth="1.6" /></g>;
    });
    return (
      <div>{bar}
        <div style={page} className="print-page">
          <h1 style={{ textAlign: "center", fontSize: 30 }}>Our Advent Wreath</h1>
          <p style={{ textAlign: "center", margin: 0 }}>Color one flame each night after your table time.</p>
          <svg viewBox="0 0 600 640" width="100%" role="img" aria-label={`Coloring sheet: wreath with 4 Sunday candles, a center Christ candle and ${n} numbered flames`}>
            {leaves}
            {cand}
            <rect x={286} y={240} width={28} height={92} rx={3} fill="white" stroke="#222" strokeWidth="1.6" />
            <path transform="translate(300 236)" d="M0,-26 C9,-13 10,-5 0,4 C-10,-5 -9,-13 0,-26 Z" fill="white" stroke="#222" strokeWidth="1.6" />
            {flames}
          </svg>
          <p style={{ textAlign: "center", fontSize: 12 }}>{ch.name} · {APP_NAME}</p>
        </div>
      </div>
    );
  }
  if (kind === "insert") {
    return (
      <div>{bar}
        <div style={{ ...page, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4in" }}>
          {[0, 1].map((k) => (
            <div key={k} style={{ border: "1px dashed #999", padding: 18, textAlign: "center" }}>
              <h2 style={{ fontSize: 22 }}>Advent at home with {ch.name}</h2>
              <p>Five minutes a night at the table: Read, Talk, Pray, Do. Then light tonight's candle and put the phone down.</p>
              <p style={{ fontSize: 13 }}>{fmtDate(ch.season_start, "en", { month: "long", day: "numeric" })} – {fmtDate(ch.season_end, "en", { month: "long", day: "numeric" })}{ch.spanish_on ? " · English y español" : ""}</p>
              {qr && <img src={qr} alt="" width={150} height={150} />}
              <p style={{ fontSize: 13 }}>Scan, or go to <b>{location.host}/j/{ch.code}</b></p>
              <p style={{ fontSize: 22, letterSpacing: "0.2em", fontWeight: 700 }}>{ch.code}</p>
              <p style={{ fontSize: 11 }}>No accounts. No names collected. Free.</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>{bar}
      <div style={page}>
        <div className="print-page" style={{ textAlign: "center", paddingTop: "2in" }}>
          <h1 style={{ fontSize: 40 }}>{ch.name}</h1>
          <p style={{ fontSize: 20 }}>Advent at the table, {fmtDate(ch.season_start, "en", { month: "long", day: "numeric" })} – {fmtDate(ch.season_end, "en", { month: "long", day: "numeric" })}</p>
          <p>Each night: Read the verse aloud. Talk about the questions. Pray together. Do the activity.</p>
          <p style={{ fontSize: 12, marginTop: "2in" }}>Scripture: {tr.name} (public domain). Nights drafted with AI help and approved one by one by {ch.pastor_display_name}.</p>
        </div>
        {approved.length === 0 && <p className="no-print">No approved nights yet.</p>}
        {approved.map((n: any) => (
          <section key={n.id} className="print-night">
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>Night {n.night} · {fmtDate(n.date, "en", { weekday: "long", month: "long", day: "numeric" })}</h2>
            <p style={{ fontFamily: "var(--serif)", margin: "4px 0" }}>{n.verse_en} <b style={{ fontFamily: "var(--sans)", fontSize: 12 }}>{n.reference} ({tr.short})</b></p>
            <p style={{ margin: "4px 0", fontSize: 14 }}><b>Talk.</b> Little ones: {n.talk.little} Kids: {n.talk.kids} Grown-ups: {n.talk.grownups}</p>
            <p style={{ margin: "4px 0", fontSize: 14 }}><b>Pray.</b> {n.pray}</p>
            <p style={{ margin: "4px 0", fontSize: 14 }}><b>Do.</b> {n.do}</p>
            <p style={{ margin: "4px 0", fontSize: 11, color: "#555" }}>{n.source === "starter" ? "From the Starter Plan" : "AI-drafted"} · Approved by {n.approved_name} on {fmtDate(n.approved_at, "en")}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
