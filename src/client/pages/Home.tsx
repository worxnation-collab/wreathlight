import { useState } from "react";
import { APP_NAME, TAGLINE } from "../../shared/brand";
import { Wreath } from "../components/Wreath";
import { Link, navigate } from "../router";

export function Home() {
  const [code, setCode] = useState("");
  return (
    <main>
      <a className="skip" href="#main">Skip to content</a>
      <section className="hero">
        <Wreath candleColors={["#7b5ea7", "#7b5ea7", "#d77a9c", "#7b5ea7"]} sundaysLit={1} christLit={false} title={`${APP_NAME} wreath`}
          ring={Array.from({ length: 27 }, (_, i) => ({ night: i + 1, glow: i < 3 }))} className="hero-wreath" />
        <h1>{APP_NAME}</h1>
        <p>{TAGLINE}</p>
        <form className="row" style={{ justifyContent: "center" }} onSubmit={(e) => { e.preventDefault(); if (code.trim()) navigate(`/j/${code.trim().toUpperCase()}`); }}>
          <label htmlFor="code" className="sr-only">Church code</label>
          <input id="code" className="input" style={{ maxWidth: 200, textAlign: "center", letterSpacing: "0.2em", textTransform: "uppercase" }} placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value)} maxLength={8} autoComplete="off" />
          <button className="btn btn-gold" type="submit">Join as a family</button>
        </form>
      </section>
      <section id="main" className="wrap" style={{ display: "grid", gap: 18 }}>
        <div className="grid2">
          <div className="card">
            <h2>For families</h2>
            <p>Each night from the first Sunday of Advent to Christmas, open a five-minute card at the table: Read, Talk, Pray, Do. Light tonight's candle, then put the phone down.</p>
            <p className="muted small">No accounts. No names. English and Spanish.</p>
          </div>
          <div className="card">
            <h2>For pastors</h2>
            <p>Pick a theme, line it up with your four Advent Sundays, and get every night drafted. Scripture comes from a public-domain Bible, filled in by code. You approve each night before any family sees it.</p>
            <Link to="/studio" className="btn btn-primary">Open the Studio</Link>
          </div>
        </div>
        <p className="muted small" style={{ textAlign: "center" }}>
          Free for every church. <Link to="/ai">How we use AI</Link>
        </p>
      </section>
    </main>
  );
}
