import { useId } from "react";

export interface RingLight { night: number; glow: boolean; label?: string }
interface Props {
  candleColors: string[]; // 4 Sunday candles
  sundaysLit: number; // 0-4
  christLit: boolean;
  ring?: RingLight[]; // nightly lights around the wreath
  title: string;
  className?: string;
  justLit?: number | null; // night number that was just lit (ignite animation)
  lang?: "en" | "es";
}

const CX = 200, CY = 210, RX = 128, RY = 64;

function Flame({ x, y, scale = 1, cls = "", id }: { x: number; y: number; scale?: number; cls?: string; id: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} aria-hidden="true">
      <circle cx="0" cy="-14" r="26" fill={`url(#${id}-halo)`} className="glow" />
      <path className={`flame ${cls}`} d="M0,-30 C9,-17 10,-8 0,0 C-10,-8 -9,-17 0,-30 Z" fill={`url(#${id}-flame)`} />
      <path className={`flame ${cls}`} d="M0,-16 C4,-10 4,-5 0,-1 C-4,-5 -4,-10 0,-16 Z" fill="#fff6d8" opacity="0.9" />
    </g>
  );
}

function Candle({ x, y, color, lit, w = 18, h = 58, id, label, cls }: { x: number; y: number; color: string; lit: boolean; w?: number; h?: number; id: string; label: string; cls?: string }) {
  return (
    <g>
      <title>{label}</title>
      <ellipse cx={x} cy={y} rx={w * 0.75} ry={w * 0.28} fill="#0b1f19" opacity="0.6" />
      <rect x={x - w / 2} y={y - h} width={w} height={h} rx={3} fill={color} />
      <rect x={x - w / 2} y={y - h} width={w * 0.32} height={h} rx={3} fill="#ffffff" opacity="0.18" />
      <ellipse cx={x} cy={y - h} rx={w / 2} ry={w * 0.18} fill="#ffffff" opacity="0.25" />
      <line x1={x} y1={y - h} x2={x} y2={y - h - 6} stroke="#2a211a" strokeWidth="1.6" />
      {lit && <Flame x={x} y={y - h - 4} id={id} cls={cls} />}
    </g>
  );
}

/** Hand-built SVG Advent wreath: 4 Sunday candles, a center Christ candle, and a ring of nightly lights. */
export function Wreath({ candleColors, sundaysLit, christLit, ring = [], title, className, justLit, lang = "en" }: Props) {
  const es = lang === "es";
  const uid = useId().replace(/:/g, "");
  const leaves = [];
  for (let layer = 0; layer < 3; layer++) {
    const n = 34;
    for (let i = 0; i < n; i++) {
      const a = ((i + layer * 0.33) / n) * Math.PI * 2;
      const r = 1 + (layer - 1) * 0.16;
      const x = CX + Math.cos(a) * RX * r;
      const y = CY + Math.sin(a) * RY * r;
      const rot = (a * 180) / Math.PI + 90 + (i % 2 ? 25 : -25);
      const fill = ["#1f5a43", "#2f6b4f", "#245f47"][(i + layer) % 3];
      leaves.push(<ellipse key={`${layer}-${i}`} cx={x} cy={y} rx={layer === 1 ? 20 : 15} ry={6.5} fill={fill} transform={`rotate(${rot} ${x} ${y})`} />);
    }
  }
  const berries = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 + 0.2;
    return <circle key={i} cx={CX + Math.cos(a) * RX * 1.02} cy={CY + Math.sin(a) * RY * 1.02} r={3.2} fill="#b8324a" />;
  });
  const angles = [-140, -40, 40, 140]; // Sunday candle positions
  const candles = angles.map((deg, i) => {
    const a = (deg * Math.PI) / 180;
    return { i, x: CX + Math.cos(a) * RX, y: CY + Math.sin(a) * RY + 6, back: Math.sin(a) < 0 };
  });
  const names = es ? ["primera", "segunda", "tercera", "cuarta"] : ["first", "second", "third", "fourth"];
  const sunday = (i: number, lit: boolean) => es ? `La ${names[i]} vela de domingo, ${lit ? "encendida" : "sin encender"}` : `The ${names[i]} Sunday candle, ${lit ? "lit" : "not lit"}`;
  const n = ring.length;
  const ringEls = ring.map((r, i) => {
    const a = -Math.PI / 2 + (i / Math.max(n, 1)) * Math.PI * 2;
    const x = CX + Math.cos(a) * (RX + 52);
    const y = CY + Math.sin(a) * (RY + 52) - 6;
    const lbl = r.label ?? `Night ${r.night} ${r.glow ? "lit" : "not lit"}`;
    return (
      <g key={r.night}>
        <title>{lbl}</title>
        {r.glow && <circle cx={x} cy={y} r={10} fill={`url(#${uid}-halo)`} className="glow" />}
        <circle cx={x} cy={y} r={r.glow ? 4.6 : 3.2} fill={r.glow ? "#ffd98a" : "none"} stroke={r.glow ? "none" : "#5f7f71"} strokeWidth={1.2}
          className={justLit === r.night ? "lighting" : undefined} />
      </g>
    );
  });
  const litCount = ring.filter((r) => r.glow).length;
  return (
    <svg viewBox="0 0 400 330" role="img" aria-label={es ? `${title}. ${sundaysLit} de 4 velas de domingo encendidas${christLit ? ", vela de Cristo encendida" : ""}${n ? `, ${litCount} de ${n} noches encendidas` : ""}.` : `${title}. ${sundaysLit} of 4 Sunday candles lit${christLit ? ", Christ candle lit" : ""}${n ? `, ${litCount} of ${n} nights lit` : ""}.`} className={className}>
      <defs>
        <radialGradient id={`${uid}-flame`} cx="50%" cy="70%" r="70%">
          <stop offset="0%" stopColor="#fff3c4" />
          <stop offset="45%" stopColor="#ffc94d" />
          <stop offset="100%" stopColor="#e07a1f" />
        </radialGradient>
        <radialGradient id={`${uid}-halo`}>
          <stop offset="0%" stopColor="#ffd98a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {ringEls}
      <ellipse cx={CX} cy={CY + 10} rx={RX + 30} ry={RY + 22} fill="#000" opacity="0.25" />
      {candles.filter((c) => c.back).map((c) => (
        <Candle key={c.i} x={c.x} y={c.y} color={candleColors[c.i]} lit={sundaysLit > c.i} id={uid} cls={["", "b", "c", "b"][c.i]}
          label={sunday(c.i, sundaysLit > c.i)} />
      ))}
      {leaves}
      {berries}
      <Candle x={CX} y={CY + 4} color="#fbf6ea" lit={christLit} w={24} h={84} id={uid} cls="c" label={es ? `La vela de Cristo, ${christLit ? "encendida" : "sin encender"}` : `The Christ candle, ${christLit ? "lit" : "not lit"}`} />
      {candles.filter((c) => !c.back).map((c) => (
        <Candle key={c.i} x={c.x} y={c.y} color={candleColors[c.i]} lit={sundaysLit > c.i} id={uid} cls={["", "b", "c", "b"][c.i]}
          label={sunday(c.i, sundaysLit > c.i)} />
      ))}
    </svg>
  );
}
