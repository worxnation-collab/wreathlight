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
// Leaf tones, back to front: shade, body, sunlit top. Each leaf is lit on one edge and shaded on the other.
const TONES = [["#2a6248", "#0f3324"], ["#3f8060", "#1b4e38"], ["#6aa880", "#2e6a4c"]] as const;

function Flame({ x, y, scale = 1, cls = "", id }: { x: number; y: number; scale?: number; cls?: string; id: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} aria-hidden="true">
      <circle cx="0" cy="-14" r="30" fill={`url(#${id}-halo)`} className="glow" />
      <path className={`flame ${cls}`} d="M0,-30 C9,-17 10,-8 0,0 C-10,-8 -9,-17 0,-30 Z" fill={`url(#${id}-flame)`} />
      <path className={`flame ${cls}`} d="M0,-16 C4,-10 4,-5 0,-1 C-4,-5 -4,-10 0,-16 Z" fill="#fff6d8" opacity="0.9" />
    </g>
  );
}

/** A wax cylinder: color body, shared light-to-shade overlay, a wax top ellipse, and a wick. Back candles are smaller and dimmer. */
function Candle({ x, y, color, lit, w = 18, h = 58, id, label, cls, dim = 0 }: { x: number; y: number; color: string; lit: boolean; w?: number; h?: number; id: string; label: string; cls?: string; dim?: number }) {
  const ry = w * 0.24, top = y - h;
  const body = `M${x - w / 2},${top} V${y} A${w / 2},${ry} 0 0 0 ${x + w / 2},${y} V${top} Z`;
  return (
    <g>
      <title>{label}</title>
      <path d={body} fill={color} />
      <path d={body} fill={`url(#${id}-cyl)`} />
      {dim > 0 && <path d={body} fill="#04110b" opacity={dim} />}
      <ellipse cx={x} cy={top} rx={w / 2} ry={ry} fill={color} />
      <ellipse cx={x} cy={top} rx={w / 2} ry={ry} fill="#fff" opacity={lit ? 0.5 : 0.3} />
      <ellipse cx={x} cy={top + ry * 0.15} rx={w * 0.34} ry={ry * 0.62} fill={lit ? "#ffd98a" : "#000"} opacity={lit ? 0.55 : 0.14} />
      <path d={`M${x},${top} q1.2,-3 0,-6`} stroke={lit ? "#2a211a" : "#3a3029"} strokeWidth="1.7" fill="none" strokeLinecap="round" />
      {lit && <Flame x={x} y={top - 4} id={id} cls={cls} scale={w < 18 ? 0.9 : 1} />}
    </g>
  );
}

/** Hand-built SVG Advent wreath: 4 Sunday candles, a center Christ candle, and a ring of nightly lights. */
export function Wreath({ candleColors, sundaysLit, christLit, ring = [], title, className, justLit, lang = "en" }: Props) {
  const es = lang === "es";
  const uid = useId().replace(/:/g, "");
  // Leaves: inner shade layer, outer body layer, then a smaller sunlit crown riding on top of the ring.
  const LAYERS = [
    { r: 0.84, dy: 2, n: 30, len: 15, tone: 0 },
    { r: 1.16, dy: 4, n: 38, len: 16, tone: 0 },
    { r: 1.0, dy: 0, n: 36, len: 19, tone: 1 },
    { r: 0.99, dy: -6, n: 30, len: 13, tone: 2 },
  ];
  const leaves = LAYERS.flatMap((L, layer) => Array.from({ length: L.n }, (_, i) => {
    const a = ((i + layer * 0.37) / L.n) * Math.PI * 2;
    const x = CX + Math.cos(a) * RX * L.r;
    const y = CY + Math.sin(a) * RY * L.r + L.dy;
    const rot = Math.round((a * 180) / Math.PI + 90 + (i % 2 ? 28 : -28));
    // The front of the ring catches less light than the top of the far side.
    const tone = L.tone === 1 && Math.sin(a) > 0.55 && i % 3 === 0 ? 0 : L.tone;
    const s = (L.len / 19).toFixed(2);
    return <use key={`${layer}-${i}`} href={`#${uid}-leaf`} fill={`url(#${uid}-t${tone})`} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot}) scale(${s})`} />;
  }));
  const berries = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 + 0.55;
    const x = CX + Math.cos(a) * RX * 1.04, y = CY + Math.sin(a) * RY * 1.04 - 3;
    return (
      <g key={i} fill={`url(#${uid}-berry)`}>
        <circle cx={x - 3} cy={y} r={3} /><circle cx={x + 3} cy={y + 0.5} r={3} /><circle cx={x} cy={y - 3.6} r={3} />
      </g>
    );
  });
  const angles = [-140, -40, 40, 140]; // Sunday candle positions
  const candles = angles.map((deg, i) => {
    const a = (deg * Math.PI) / 180;
    return { i, x: CX + Math.cos(a) * RX, y: CY + Math.sin(a) * RY + 6, back: Math.sin(a) < 0 };
  });
  const names = es ? ["primera", "segunda", "tercera", "cuarta"] : ["first", "second", "third", "fourth"];
  const sunday = (i: number, lit: boolean) => es ? `La ${names[i]} vela de domingo, ${lit ? "encendida" : "sin encender"}` : `The ${names[i]} Sunday candle, ${lit ? "lit" : "not lit"}`;
  const sundayCandle = (c: (typeof candles)[number]) => (
    <Candle key={c.i} x={c.x} y={c.y} color={candleColors[c.i]} lit={sundaysLit > c.i} id={uid} cls={["", "b", "c", "b"][c.i]}
      w={c.back ? 16 : 19} h={c.back ? 50 : 60} dim={c.back ? 0.16 : 0} label={sunday(c.i, sundaysLit > c.i)} />
  );
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
        <circle cx={x} cy={y} r={r.glow ? 4.6 : 3.2} fill={r.glow ? "#ffd98a" : "none"} stroke={r.glow ? "none" : "#6f9282"} strokeWidth={1.2}
          className={justLit === r.night ? "lighting" : undefined} />
      </g>
    );
  });
  // Warm light that each lit candle throws onto the greenery around its base.
  const lights = [
    ...candles.filter((c) => sundaysLit > c.i).map((c) => ({ x: c.x, y: c.y - 6, r: 46 })),
    ...(christLit ? [{ x: CX, y: CY - 4, r: 62 }] : []),
  ];
  const litCount = ring.filter((r) => r.glow).length;
  const tableGlow = Math.min(0.08 + lights.length * 0.05, 0.3);
  const ringPath = `M${CX - RX * 1.24},${CY + 3} a${RX * 1.24},${RY * 1.26} 0 1 0 ${RX * 2.48},0 a${RX * 1.24},${RY * 1.26} 0 1 0 ${-RX * 2.48},0 Z M${CX - RX * 0.76},${CY} a${RX * 0.76},${RY * 0.7} 0 1 0 ${RX * 1.52},0 a${RX * 0.76},${RY * 0.7} 0 1 0 ${-RX * 1.52},0 Z`;
  // A few front leaves tuck over the base of each front candle so it sits in the greenery.
  const tuft = (x: number, y: number, k: string) => [-34, 8, 46].map((r, j) => (
    <use key={`${k}-${j}`} href={`#${uid}-leaf`} fill={`url(#${uid}-t${j === 1 ? 2 : 1})`} transform={`translate(${(x + (j - 1) * 9).toFixed(1)} ${(y + 3 - (j === 1 ? 2 : 0)).toFixed(1)}) rotate(${r}) scale(0.62)`} />
  ));
  return (
    <svg viewBox="0 0 400 330" role="img" aria-label={es ? `${title}. ${sundaysLit} de 4 velas de domingo encendidas${christLit ? ", vela de Cristo encendida" : ""}${n ? `, ${litCount} de ${n} noches encendidas` : ""}.` : `${title}. ${sundaysLit} of 4 Sunday candles lit${christLit ? ", Christ candle lit" : ""}${n ? `, ${litCount} of ${n} nights lit` : ""}.`} className={className}>
      <defs>
        <radialGradient id={`${uid}-flame`} cx="50%" cy="70%" r="70%">
          <stop offset="0%" stopColor="#fff3c4" />
          <stop offset="45%" stopColor="#ffc94d" />
          <stop offset="100%" stopColor="#e07a1f" />
        </radialGradient>
        <radialGradient id={`${uid}-halo`}>
          <stop offset="0%" stopColor="#ffd98a" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-warm`}>
          <stop offset="0%" stopColor="#ffcf7a" stopOpacity="0.42" />
          <stop offset="60%" stopColor="#ffcf7a" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#ffcf7a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-shadow`}>
          <stop offset="0%" stopColor="#020806" stopOpacity="0.3" />
          <stop offset="62%" stopColor="#020806" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#020806" stopOpacity="0" />
        </radialGradient>
        {/* Torus shading: dark at the inner and outer edges, light along the crown of the ring. */}
        <radialGradient id={`${uid}-torus`} gradientUnits="userSpaceOnUse" cx={CX} cy={CY} r={RX * 1.3} gradientTransform={`translate(0 ${CY}) scale(1 ${RY / RX}) translate(0 ${-CY})`}>
          <stop offset="0.6" stopColor="#06180f" />
          <stop offset="0.77" stopColor="#1f5a40" />
          <stop offset="0.9" stopColor="#0d2a1d" />
          <stop offset="1" stopColor="#051209" />
        </radialGradient>
        <linearGradient id={`${uid}-cyl`}>
          <stop offset="0" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="0.24" stopColor="#fff" stopOpacity="0.34" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.75" stopColor="#000" stopOpacity="0.12" />
          <stop offset="1" stopColor="#000" stopOpacity="0.42" />
        </linearGradient>
        {TONES.map(([lightC, shadeC], t) => (
          <linearGradient key={t} id={`${uid}-t${t}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.3" stopColor={lightC} />
            <stop offset="0.62" stopColor={shadeC} />
          </linearGradient>
        ))}
        <radialGradient id={`${uid}-berry`} cx="35%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#ff8a96" />
          <stop offset="40%" stopColor="#c43a52" />
          <stop offset="100%" stopColor="#6e1424" />
        </radialGradient>
        <clipPath id={`${uid}-clip`}><path fillRule="evenodd" clipRule="evenodd" d={ringPath} /></clipPath>
        <path id={`${uid}-leaf`} d="M-19,0 C-9,-8.5 9,-8.5 19,0 C9,8.5 -9,8.5 -19,0 Z" />
      </defs>
      {ringEls}
      <ellipse cx={CX} cy={CY + 30} rx={RX + 62} ry={RY + 34} fill={`url(#${uid}-shadow)`} />
      {lights.length > 0 && <ellipse cx={CX} cy={CY + 8} rx={RX + 40} ry={RY + 26} fill={`url(#${uid}-warm)`} opacity={tableGlow} />}
      <path fillRule="evenodd" fill={`url(#${uid}-torus)`} d={ringPath} />
      {candles.filter((c) => c.back).map(sundayCandle)}
      <g aria-hidden="true">{leaves}{berries}</g>
      {lights.length > 0 && (
        <g clipPath={`url(#${uid}-clip)`} aria-hidden="true">
          {lights.map((l, i) => <ellipse key={i} cx={l.x} cy={l.y} rx={l.r} ry={l.r * 0.62} fill={`url(#${uid}-warm)`} />)}
        </g>
      )}
      <ellipse cx={CX} cy={CY + 5} rx={17} ry={5} fill="#020806" opacity="0.55" />
      <Candle x={CX} y={CY + 4} color="#fbf6ea" lit={christLit} w={24} h={84} id={uid} cls="c" label={es ? `La vela de Cristo, ${christLit ? "encendida" : "sin encender"}` : `The Christ candle, ${christLit ? "lit" : "not lit"}`} />
      {candles.filter((c) => !c.back).map(sundayCandle)}
      <g aria-hidden="true">{candles.filter((c) => !c.back).flatMap((c) => tuft(c.x, c.y, `f${c.i}`))}</g>
    </svg>
  );
}
