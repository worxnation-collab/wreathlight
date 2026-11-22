import { parseReference, passageText, type BibleId } from "./scripture";

export interface AuditNight { night: number; reference: string; verse_en: string | null; verse_es?: string | null }

/** Acceptance #2: every published verse must equal the dataset text character for character. Returns mismatches. */
export function auditVerses(nights: AuditNight[], translation: Exclude<BibleId, "rv1909">): string[] {
  const bad: string[] = [];
  for (const n of nights) {
    const p = parseReference(n.reference);
    if (!p) { bad.push(`night ${n.night}: unparseable reference "${n.reference}"`); continue; }
    if (n.verse_en !== passageText(p, translation)) bad.push(`night ${n.night}: ${translation} text differs for ${n.reference}`);
    if (n.verse_es != null && n.verse_es !== passageText(p, "rv1909")) bad.push(`night ${n.night}: RV1909 text differs for ${n.reference}`);
  }
  return bad;
}
