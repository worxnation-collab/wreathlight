import { bookCode, bookByCode, TEXT_BOOKS } from "./books";
import indexData from "../../content/bible/index.json";
import bsb from "../../content/bible/bsb.json";
import kjv from "../../content/bible/kjv.json";
import web from "../../content/bible/web.json";
import rv1909 from "../../content/bible/rv1909.json";

export type BibleId = "bsb" | "kjv" | "web" | "rv1909";
type BookText = Record<string, string[][]>;
export const BIBLES: Record<BibleId, BookText> = {
  bsb: bsb as BookText,
  kjv: kjv as BookText,
  web: web as BookText,
  rv1909: rv1909 as BookText,
};
const INDEX = indexData as Record<string, number[]>;

export interface ParsedRef {
  book: string; // code
  startCh: number;
  startV: number;
  endCh: number;
  endV: number;
}
export const MAX_VERSES = 6;

/** Parses "Isaiah 9:2", "Isaiah 9:2-7", "Isaiah 9:6–10:1", "1 John 1:5". Whole chapters are not accepted. */
export function parseReference(ref: string): ParsedRef | null {
  const s = ref.trim().replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ");
  const m = s.match(/^((?:[1-3] ?)?[A-Za-zÀ-ÿ. ]+?) (\d{1,3}):(\d{1,3})(?:-(?:(\d{1,3}):)?(\d{1,3}))?$/);
  if (!m) return null;
  const code = bookCode(m[1].replace(/^([1-3])(?=[A-Za-z])/, "$1 "));
  if (!code) return null;
  const startCh = +m[2], startV = +m[3];
  const endCh = m[4] ? +m[4] : startCh;
  const endV = m[5] ? +m[5] : startV;
  if (endCh < startCh || (endCh === startCh && endV < startV)) return null;
  return { book: code, startCh, startV, endCh, endV };
}

export function refExists(p: ParsedRef): boolean {
  const chs = INDEX[p.book];
  if (!chs) return false;
  const ok = (c: number, v: number) => c >= 1 && c <= chs.length && v >= 1 && v <= (chs[c - 1] ?? 0);
  return ok(p.startCh, p.startV) && ok(p.endCh, p.endV);
}

/** List of [chapter, verse] pairs covered by the reference (requires refExists). */
export function versesOf(p: ParsedRef): [number, number][] {
  const out: [number, number][] = [];
  const chs = INDEX[p.book];
  for (let c = p.startCh; c <= p.endCh; c++) {
    const from = c === p.startCh ? p.startV : 1;
    const to = c === p.endCh ? p.endV : chs[c - 1];
    for (let v = from; v <= to; v++) {
      out.push([c, v]);
      if (out.length > 200) return out;
    }
  }
  return out;
}

export function hasText(book: string): boolean {
  return (TEXT_BOOKS as readonly string[]).includes(book);
}

/** Verse text from the dataset, joined with spaces. null if any verse is missing. */
export function passageText(p: ParsedRef, bible: BibleId): string | null {
  const b = BIBLES[bible][p.book];
  if (!b) return null;
  const parts: string[] = [];
  for (const [c, v] of versesOf(p)) {
    const t = b[c - 1]?.[v - 1];
    if (!t) return null;
    parts.push(t);
  }
  return parts.join(" ");
}

export function formatRef(p: ParsedRef, lang: "en" | "es" = "en"): string {
  const bk = bookByCode(p.book)!;
  const name = lang === "es" ? bk.es : bk.en;
  let s = `${name} ${p.startCh}:${p.startV}`;
  if (p.endCh !== p.startCh) s += `–${p.endCh}:${p.endV}`;
  else if (p.endV !== p.startV) s += `–${p.endV}`;
  return s;
}

/** Canonical key used for duplicate detection. */
export function refKey(p: ParsedRef): string {
  return `${p.book} ${p.startCh}:${p.startV}-${p.endCh}:${p.endV}`;
}

// ---------- quotation detection (no model-written Scripture) ----------
export const QUOTE_WORDS = 10;
export function words(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}
// FNV-1a over a window of words
function hashWindow(ws: string[], i: number, n: number): number {
  let h = 0x811c9dc5;
  for (let k = i; k < i + n; k++) {
    const w = ws[k];
    for (let j = 0; j < w.length; j++) {
      h ^= w.charCodeAt(j);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 32;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
let SHINGLES: Uint32Array | null = null;

/** Every 10-word window in every shipped verse (all four translations), hashed, sorted, unique. */
export function buildShingleHashes(): Uint32Array {
  const set = new Set<number>();
  for (const bible of Object.values(BIBLES))
    for (const chs of Object.values(bible))
      for (const vs of chs)
        for (const t of vs) {
          if (!t) continue;
          const ws = words(t);
          for (let i = 0; i + QUOTE_WORDS <= ws.length; i++) set.add(hashWindow(ws, i, QUOTE_WORDS));
        }
  return Uint32Array.from(set).sort();
}
/** Delta + LEB128 varint encoding, used to ship the precomputed set with the Worker (content/bible/shingles.bin). */
export function encodeShingles(sorted: Uint32Array): Uint8Array {
  const out: number[] = [];
  let prev = 0;
  for (const h of sorted) {
    let d = h - prev;
    prev = h;
    while (d >= 0x80) { out.push((d & 0x7f) | 0x80); d = Math.floor(d / 128); }
    out.push(d);
  }
  return Uint8Array.from(out);
}
export function decodeShingles(buf: ArrayBuffer | Uint8Array): Uint32Array {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const out = new Uint32Array(b.length);
  let prev = 0, i = 0, n = 0;
  while (i < b.length) {
    let d = 0, mul = 1, x: number;
    do { x = b[i++]; d += (x & 0x7f) * mul; mul *= 128; } while (x & 0x80);
    prev += d;
    out[n++] = prev;
  }
  return out.slice(0, n);
}
/** The Worker calls this with the precomputed file so it never builds the set at request time. */
export function useShingleData(buf: ArrayBuffer | Uint8Array) {
  SHINGLES = decodeShingles(buf);
}
function hasShingle(h: number): boolean {
  if (!SHINGLES) SHINGLES = buildShingleHashes();
  let lo = 0, hi = SHINGLES.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const v = SHINGLES[mid];
    if (v === h) return true;
    if (v < h) lo = mid + 1; else hi = mid - 1;
  }
  return false;
}
/** Returns the first 10+ word run in `prose` that matches a Bible verse, or null. */
export function findScriptureQuote(prose: string): string | null {
  const ws = words(prose);
  for (let i = 0; i + QUOTE_WORDS <= ws.length; i++) {
    if (hasShingle(hashWindow(ws, i, QUOTE_WORDS))) return ws.slice(i, i + QUOTE_WORDS).join(" ");
  }
  return null;
}
