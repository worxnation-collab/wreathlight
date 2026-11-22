// Acceptance #2 on real data: every approved night in D1 must match the dataset character for character.
//   npx tsx scripts/check-verses.ts --remote|--local      (read-only)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { useShingleData } from "../src/shared/scripture";
import { auditVerses } from "../src/shared/verse-audit";

const where = process.argv.includes("--remote") ? "--remote" : "--local";
useShingleData(readFileSync(new URL("../content/bible/shingles.bin", import.meta.url)));
const out = execFileSync("npx", ["wrangler", "d1", "execute", "wreathlight-db", where, "--json", "--command",
  "SELECT n.church_id, c.translation, n.night, n.reference, n.verse_en, CASE WHEN n.es_approved = 1 THEN n.verse_es END AS verse_es FROM nights n JOIN churches c ON c.id = n.church_id WHERE n.status = 'approved'"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
const rows = JSON.parse(out)[0].results as { church_id: string; translation: "bsb" | "kjv" | "web"; night: number; reference: string; verse_en: string; verse_es: string | null }[];
const byChurch = new Map<string, typeof rows>();
for (const r of rows) byChurch.set(r.church_id, [...(byChurch.get(r.church_id) ?? []), r]);
let bad = 0;
for (const [, list] of byChurch) for (const m of auditVerses(list, list[0].translation)) { console.log("MISMATCH", m); bad++; }
console.log(`${rows.length} approved nights in ${byChurch.size} churches checked; ${bad} mismatches.`);
process.exit(bad ? 1 : 0);
