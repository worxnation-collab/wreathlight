import { useEffect, useState } from "react";
import { api } from "../api";
import { Wreath } from "../components/Wreath";
import { PaintedWreath } from "../components/PaintedWreath";
import { wreathState } from "../../shared/art";

export default function WreathView({ code }: { code: string }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const load = () => api(`/api/public/${code}/wreath`).then((x) => { setD(x); setErr(""); }).catch(() => setErr("We couldn't load this wreath."));
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [code]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else document.documentElement.requestFullscreen?.().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { document.title = d ? `${d.name} · Church Wreath` : "Church Wreath"; }, [d]);
  if (err) return <main className="projector"><p className="sub" role="alert">{err}</p></main>;
  if (!d) return <main className="projector" aria-busy="true" />;
  const candle = d.candles[d.week - 1]?.en ?? "";
  const h = d.this_week.households, m = d.this_week.candles;
  return (
    <main className="projector">
      <header>
        <h1>{d.name}</h1>
        <div className="sub">{d.christ_candle ? "Christ has come. Merry Christmas." : `Advent week ${d.week} · the ${candle} candle`}</div>
      </header>
      <div className="projector-stage">
        <PaintedWreath state={wreathState(d.week, !!d.christ_candle)} enableVideo />
        <Wreath candleColors={d.candles.map((c: any) => c.color)} sundaysLit={d.sundays_lit} christLit={d.christ_candle} ring={d.ring}
          title="Church Wreath" className="projector-wreath" />
      </div>
      <footer>
        <div className="stat-line" aria-live="polite">This week, {h.label} households lit {m.label} candles.</div>
        <div className="sub" style={{ marginTop: 8 }}>Counts only. No names, ever.{d.is_demo ? " " : ""}{d.is_demo && <span className="pill demo" style={{ marginLeft: 8 }}>Demo data</span>}</div>
      </footer>
    </main>
  );
}
