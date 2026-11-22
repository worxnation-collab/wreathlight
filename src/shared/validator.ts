import type { ModelNight, Prose } from "./schemas";
import type { TraditionKey } from "./season";
import {
  MAX_VERSES, findScriptureQuote, formatRef, hasText, parseReference, passageText, refExists, refKey, versesOf,
  type BibleId,
} from "./scripture";

export type Severity = "hard" | "soft";
export interface Issue { code: string; severity: Severity; field?: string; message: string }
export interface CheckSummary {
  references: boolean; // reference parses and exists
  verseMatched: boolean; // text filled from dataset
  readingLevel: boolean; // little-ones question at grade 2 or below
  phrases: boolean; // no flagged phrases
  duplicates: boolean; // no repeated reference this season
}
export interface ValidationResult {
  ok: boolean; // no hard fails
  issues: Issue[];
  checks: CheckSummary;
  reference?: string; // canonical display reference (EN)
  reference_es?: string;
  refKey?: string;
  verse_en?: string;
  verse_es?: string;
}
export interface ValidateContext {
  translation: BibleId; // EN translation
  spanish: boolean;
  tradition: TraditionKey;
  usedRefKeys: Set<string>; // other nights' reference keys this season
}

export const CAPS = { talk: 160, pray: 200, do: 220, why: 160 } as const;

const URL_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|org|net|io|app|dev|co|ly|me)\b)/i;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;

interface PhraseRule { code: string; label: string; patterns: RegExp[]; when?: (ctx: ValidateContext) => boolean }
export const PHRASE_RULES: PhraseRule[] = [
  {
    code: "LEGEND_AS_FACT",
    label: "states a legend as fact",
    patterns: [
      /\bthree (kings|wise men|magi)\b/i, /\btres reyes\b/i,
      /\bdecember 25(th)? was (jesus'?|his) (birthday|birth)/i, /\bjesus was born on december 25/i,
      /\bmary was (1[0-9]|fourteen|fifteen|thirteen)\b/i, /\bmean innkeeper\b/i, /\brode (on )?a donkey\b/i,
    ],
  },
  {
    code: "FEAR_GUILT",
    label: "uses fear or guilt",
    patterns: [
      /\b(burn|go) (in|to) hell\b/i, /\bgod (is|will be) (angry|mad) (at|with) you\b/i, /\bgod will punish\b/i,
      /\bshould be ashamed\b/i, /\bnaughty\b/i, /\bbad (kids|children)\b/i, /\bgod (won'?t|will not) love\b/i,
      /\bafraid of god\b/i, /\bdios (te )?castigar/i,
    ],
  },
  {
    code: "PROSPERITY",
    label: "promises money or success",
    patterns: [
      /\bgod wants you (to be )?rich\b/i, /\bfinancial (blessing|breakthrough)\b/i, /\bsow a seed\b/i,
      /\bmake you (rich|wealthy)\b/i, /\bprosper financially\b/i, /\bblessed with (money|wealth)\b/i,
    ],
  },
  { code: "SANTA", label: "mentions Santa", patterns: [/\bsanta\b/i, /\bpap[aá] noel\b/i, /\bnorth pole\b/i, /\belf on the shelf\b/i] },
  {
    code: "SECRETS_OR_GOING",
    label: "asks kids to keep secrets or go somewhere",
    patterns: [
      /\bkeep (it|this) (a )?secret\b/i, /\bdon'?t tell (your parents|anyone|mom|dad)\b/i, /\bsecret from\b/i,
      /\bgo (out|outside) (alone|by yourself)\b/i, /\bafter dark\b/i, /\bmeet (a stranger|someone new)\b/i,
      /\btalk to strangers\b/i, /\bno se lo digas\b/i,
    ],
  },
  {
    code: "MEDICAL",
    label: "gives medical advice",
    patterns: [/\bmedicine\b/i, /\bmedication\b/i, /\bcure (your|an?) /i, /\bstop taking\b/i, /\bvaccin/i, /\bdiagnos/i, /\bheal your (illness|sickness|disease)\b/i],
  },
  {
    code: "DENOMINATIONAL",
    label: "names a denominational distinctive",
    when: (ctx) => ctx.tradition === "hope",
    patterns: [
      /\btransubstantiation\b/i, /\bspeaking in tongues\b/i, /\binfant baptism\b/i, /\bbeliever'?s baptism\b/i,
      /\brosary\b/i, /\bimmaculate conception\b/i, /\bpurgatory\b/i, /\brapture\b/i, /\bonce saved,? always saved\b/i,
      /\bpredestin/i, /\bthe pope\b/i,
    ],
  },
];
const SPEND_RE = /\b(buy|buying|purchase|store|shop|shopping|order online|gift card|money|spend|compra[rn]?|tienda|dinero)\b|\$/i;
const FLAME_RE = /\b(candles?|match(es)?|lighters?|fire|flames?|velas?|f[oó]sforos?|fuego)\b/i;
const SAFE_FLAME_RE = /\b(adult|grown-?up|parent|battery|led|electric|flashlight|paper|adulto|mayor|bater[ií]a|linterna|papel)\b/i;

// ---- reading level (Flesch-Kincaid grade with a simple syllable heuristic) ----
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}
export function gradeLevel(text: string): number {
  const ws = text.split(/\s+/).map((w) => w.replace(/[^A-Za-z']/g, "")).filter(Boolean);
  if (ws.length === 0) return 0;
  const sentences = Math.max(1, (text.match(/[.!?]+(\s|$)/g) || []).length);
  const syl = ws.reduce((n, w) => n + syllables(w), 0);
  return 0.39 * (ws.length / sentences) + 11.8 * (syl / ws.length) - 15.59;
}
export const LITTLE_MAX_GRADE = 2;

function proseFields(p: Prose, prefix = ""): [string, string, number][] {
  return [
    [prefix + "why", p.why, CAPS.why],
    [prefix + "talk.little", p.talk.little, CAPS.talk],
    [prefix + "talk.kids", p.talk.kids, CAPS.talk],
    [prefix + "talk.grownups", p.talk.grownups, CAPS.talk],
    [prefix + "pray", p.pray, CAPS.pray],
    [prefix + "do", p.do, CAPS.do],
  ];
}

const FIELD_NAMES: Record<string, string> = {
  why: "Why this passage", "talk.little": "Little ones question", "talk.kids": "Kids question",
  "talk.grownups": "Grown-ups question", pray: "Pray line", do: "Do activity",
};
const fieldName = (f: string) => (f.startsWith("es.") ? "Spanish " + FIELD_NAMES[f.slice(3)] : FIELD_NAMES[f] ?? f);

export function validateNight(n: Pick<ModelNight, "reference" | "why" | "talk" | "pray" | "do" | "es">, ctx: ValidateContext): ValidationResult {
  const issues: Issue[] = [];
  const hard = (code: string, message: string, field?: string) => issues.push({ code, severity: "hard", message, field });
  const soft = (code: string, message: string, field?: string) => issues.push({ code, severity: "soft", message, field });
  const res: ValidationResult = {
    ok: false, issues,
    checks: { references: true, verseMatched: true, readingLevel: true, phrases: true, duplicates: true },
  };

  // ---- reference ----
  const p = parseReference(n.reference ?? "");
  if (!p) {
    hard("REF_PARSE", `"${n.reference}" is not a Bible reference we can read.`, "reference");
    res.checks.references = false;
    res.checks.verseMatched = false;
  } else if (!refExists(p)) {
    hard("REF_NOT_FOUND", `${n.reference} does not exist in the Bible.`, "reference");
    res.checks.references = false;
    res.checks.verseMatched = false;
  } else {
    const count = versesOf(p).length;
    res.reference = formatRef(p, "en");
    res.reference_es = formatRef(p, "es");
    res.refKey = refKey(p);
    if (count > MAX_VERSES) hard("REF_TOO_LONG", `${res.reference} is ${count} verses; nights use ${MAX_VERSES} or fewer.`, "reference");
    if (!hasText(p.book)) {
      hard("REF_NO_TEXT", `${res.reference} is outside the books we ship verse text for.`, "reference");
      res.checks.verseMatched = false;
    } else {
      const en = passageText(p, ctx.translation);
      if (!en) { hard("VERSE_MISSING", `Verse text for ${res.reference} is missing from the dataset.`, "reference"); res.checks.verseMatched = false; }
      else res.verse_en = en;
      if (ctx.spanish) {
        const es = passageText(p, "rv1909");
        if (es) res.verse_es = es;
        else soft("ES_VERSE_MISSING", `Reina-Valera 1909 numbers ${res.reference} differently, so Spanish stays hidden for this night.`, "reference");
      }
    }
    if (ctx.usedRefKeys.has(res.refKey)) {
      hard("DUP_REF", `${res.reference} is already used on another night this season.`, "reference");
      res.checks.duplicates = false;
    }
  }

  // ---- prose (EN, and ES when Spanish is on) ----
  const sets: [Prose, string][] = [[{ why: n.why, talk: n.talk, pray: n.pray, do: n.do }, ""]];
  if (ctx.spanish && n.es) sets.push([n.es, "es."]);
  else if (ctx.spanish && !n.es) soft("ES_MISSING", "No Spanish draft for this night, so Spanish stays hidden.", "es");

  for (const [prose, prefix] of sets) {
    for (const [field, value, cap] of proseFields(prose, prefix)) {
      const v = (value ?? "").trim();
      if (!v) { hard("EMPTY_FIELD", `${fieldName(field)} is empty.`, field); continue; }
      if (v.length > cap) hard("TOO_LONG", `${fieldName(field)} is ${v.length} characters; the limit is ${cap}.`, field);
      if (URL_RE.test(v) || EMAIL_RE.test(v)) hard("URL_OR_EMAIL", `${fieldName(field)} contains a link or email address.`, field);
      const q = findScriptureQuote(v);
      if (q) hard("SCRIPTURE_QUOTE", `${fieldName(field)} quotes Scripture word for word ("${q}…"). Scripture must come from the dataset, not the model.`, field);
      for (const rule of PHRASE_RULES) {
        if (rule.when && !rule.when(ctx)) continue;
        if (rule.patterns.some((re) => re.test(v))) {
          soft(rule.code, `${fieldName(field)} ${rule.label}.`, field);
          res.checks.phrases = false;
        }
      }
    }
    const doText = (prose.do ?? "").trim();
    if (SPEND_RE.test(doText)) { soft("DO_SPENDING", `${fieldName(prefix + "do")} may require spending money.`, prefix + "do"); res.checks.phrases = false; }
    if (FLAME_RE.test(doText) && !SAFE_FLAME_RE.test(doText)) {
      soft("DO_FLAME", `${fieldName(prefix + "do")} mentions a flame without an adult or a candle-free option.`, prefix + "do");
      res.checks.phrases = false;
    }
  }

  // ---- reading level for little ones (English only; heuristic) ----
  const little = (n.talk?.little ?? "").trim();
  if (little) {
    const g = gradeLevel(little);
    if (g > LITTLE_MAX_GRADE) {
      soft("READING_LEVEL", `Little ones question reads at about grade ${Math.round(g)}; aim for grade ${LITTLE_MAX_GRADE} or below.`, "talk.little");
      res.checks.readingLevel = false;
    }
  }

  res.ok = !issues.some((i) => i.severity === "hard");
  return res;
}

/** Sunday announcement: every number in the AI text must be one of the computed inputs. */
export function numbersMatch(text: string, allowed: number[]): { ok: boolean; extra: string[] } {
  const found = text.match(/\d[\d,]*/g) ?? [];
  const allow = new Set(allowed.map(String));
  const extra = found.map((s) => s.replace(/,/g, "")).filter((s) => !allow.has(s));
  return { ok: extra.length === 0, extra };
}
