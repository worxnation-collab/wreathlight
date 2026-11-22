/**
 * Downloads public-domain Bible texts from their original sources and normalizes them to
 * { book, chapter, verse, text }. Writes:
 *   content/bible/index.json        verse counts per chapter for all 66 books (existence checks)
 *   content/bible/<id>.json         verse text for the Advent books only (see TEXT_BOOKS)
 * Sources and licenses are listed in DATA-SOURCES.md.
 * Usage: npx tsx scripts/import-bible.ts
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { BOOKS, TEXT_BOOKS, bookCode } from "../src/shared/books";

const CACHE = ".cache/bible";
const OUT = "content/bible";
mkdirSync(CACHE, { recursive: true });
mkdirSync(OUT, { recursive: true });

const SOURCES = {
  bsb: { url: "https://bereanbible.com/bsb.txt", kind: "bsb-tsv" },
  kjv: { url: "https://ebible.org/Scriptures/eng-kjv2006_vpl.zip", kind: "vpl", file: "eng-kjv2006_vpl.txt" },
  web: { url: "https://ebible.org/Scriptures/engwebp_vpl.zip", kind: "vpl", file: "engwebp_vpl.txt" },
  rv1909: { url: "https://ebible.org/Scriptures/spaRV1909_vpl.zip", kind: "vpl", file: "spaRV1909_vpl.txt" },
} as const;

type Verse = { book: string; chapter: number; verse: number; text: string };

function download(url: string, dest: string) {
  if (existsSync(dest)) return;
  console.log("download", url);
  execFileSync("curl", ["-sSfL", "-o", dest, url]);
}

export function normalizeText(t: string, id: string): string {
  let s = t.replace(/\s+/g, " ").trim();
  if (id === "kjv") s = s.replace(/[[\]]/g, ""); // KJV italics markers for supplied words
  return s;
}

function parse(id: keyof typeof SOURCES): Verse[] {
  const src = SOURCES[id];
  const out: Verse[] = [];
  if (src.kind === "bsb-tsv") {
    const p = join(CACHE, "bsb.txt");
    download(src.url, p);
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^(.+?) (\d+):(\d+)\t(.*)$/);
      if (!m) continue;
      const code = bookCode(m[1]);
      if (!code) continue;
      out.push({ book: code, chapter: +m[2], verse: +m[3], text: normalizeText(m[4], id) });
    }
  } else {
    const zip = join(CACHE, `${id}.zip`);
    download(src.url, zip);
    const dir = join(CACHE, id);
    if (!existsSync(join(dir, src.file))) execFileSync("unzip", ["-o", "-q", zip, "-d", dir]);
    for (const line of readFileSync(join(dir, src.file), "utf8").split(/\r?\n/)) {
      const m = line.match(/^([1-3]?[A-Z]{2,3}) (\d+):(\d+) (.*)$/);
      if (!m) continue;
      if (!BOOKS.some((b) => b.code === m[1])) continue;
      const text = normalizeText(m[4], id);
      if (!text) continue;
      out.push({ book: m[1], chapter: +m[2], verse: +m[3], text });
    }
  }
  if (out.length < 20000) throw new Error(`${id}: only ${out.length} verses parsed`);
  return out;
}

function main() {
  const index: Record<string, number[]> = {};
  for (const id of Object.keys(SOURCES) as (keyof typeof SOURCES)[]) {
    const verses = parse(id);
    const text: Record<string, string[][]> = {};
    for (const v of verses) {
      if (id === "bsb") {
        const chs = (index[v.book] ??= []);
        chs[v.chapter - 1] = Math.max(chs[v.chapter - 1] ?? 0, v.verse);
      }
      if (!(TEXT_BOOKS as readonly string[]).includes(v.book)) continue;
      const chs = (text[v.book] ??= []);
      const vs = (chs[v.chapter - 1] ??= []);
      vs[v.verse - 1] = v.text;
    }
    // fill holes (verses absent in a translation) with "" so indexes stay aligned
    for (const chs of Object.values(text)) for (let c = 0; c < chs.length; c++) {
      chs[c] ??= [];
      for (let v = 0; v < chs[c].length; v++) chs[c][v] ??= "";
    }
    writeFileSync(join(OUT, `${id}.json`), JSON.stringify(text));
    console.log(id, verses.length, "verses parsed");
  }
  writeFileSync(join(OUT, "index.json"), JSON.stringify(index));
}

main();
