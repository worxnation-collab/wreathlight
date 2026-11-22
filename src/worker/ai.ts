import { ModelWeek, type ModelNight } from "../shared/schemas";
import { THEMES, ALLOWED_BOOKS_TEXT } from "../shared/themes";
import { TRADITIONS, TRANSLATIONS, type ThemeKey, type TraditionKey, type TranslationKey } from "../shared/season";
import { CAPS } from "../shared/validator";
import starterEn from "../../content/starter-plan.en.json";

/** Everything the model is allowed to see. Never family data, counts, nicknames or IPs. */
export interface PromptInput {
  theme: ThemeKey;
  tradition: TraditionKey;
  translation: TranslationKey;
  spanish: boolean;
  week: number;
  nights: { night: number; date: string }[];
  sermon?: { title: string; passage: string };
  avoidReferences: string[];
  stricter?: string[]; // validator reasons from a failed attempt
}

export interface AiClient {
  name: string;
  draft(input: PromptInput, model: string): Promise<ModelNight[]>;
}

export const SYSTEM_PROMPT = `You help a church pastor draft a nightly family Advent devotional. A pastor reviews and approves every night before any family sees it.

Return JSON only, matching the schema. For each night requested:
- reference: ONE Bible passage of 1 to 6 verses, written as "Book Chapter:Verse" or "Book Chapter:Verse-Verse", chosen only from these books: ${ALLOWED_BOOKS_TEXT}. Never repeat a reference listed in avoidReferences or used on another night.
- Never write, quote or paraphrase Scripture text word for word in any field. Code fills in the verse text from a public-domain Bible.
- why: one plain sentence on why this passage fits tonight (max ${CAPS.why} characters).
- talk.little: one very short, simple question for little ones (tiny words, under 12 words). talk.kids: one question for school-age kids. talk.grownups: one question for adults. Each max ${CAPS.talk} characters. Never mention ages or numbers of years.
- pray: a one-line prayer a family can pray together (max ${CAPS.pray} characters).
- do: one simple, free activity at home (max ${CAPS.do} characters). No buying anything, no going out after dark, nothing unsafe. If a candle is involved, a grown-up lights it or the family uses a battery candle.
- No links, emails, or names of real people other than people in the Bible.
- Content must show care for people and respect for Scripture: no fear or guilt, no prosperity promises, no Santa, no secrets, no medical advice, no legends stated as fact (for example "three kings", "December 25 was Jesus' birthday", Mary's age), and no denominational distinctives.
- Warm, plain words. No exclamation spam.`;

export function userPrompt(p: PromptInput): string {
  const tradition = TRADITIONS[p.tradition];
  const candle = tradition.candles[p.week - 1];
  const lines = [
    `Theme: ${THEMES[p.theme].en}. ${THEMES[p.theme].guide}`,
    `Advent week ${p.week}. This week's candle: ${candle.en}.`,
    `Bible translation used for display: ${TRANSLATIONS[p.translation].name}.`,
    p.sermon?.title ? `This Sunday's sermon: "${p.sermon.title}"${p.sermon.passage ? ` (${p.sermon.passage})` : ""}. Let the nights point back to it.` : "",
    `Nights to draft: ${p.nights.map((n) => `night ${n.night} (${n.date}${n.date === "2026-12-24" ? ", Christmas Eve" : n.date === "2026-12-25" ? ", Christmas Day" : ""})`).join("; ")}.`,
    `avoidReferences: ${p.avoidReferences.length ? p.avoidReferences.join("; ") : "none"}.`,
    p.spanish ? `Also include "es": natural Latin American Spanish versions of why, talk, pray and do (same limits). Do not translate the reference.` : `Do not include "es".`,
    p.stricter?.length ? `A previous draft failed these checks. Fix every one:\n- ${p.stricter.join("\n- ")}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

const S = { type: "STRING" };
const TALK = { type: "OBJECT", properties: { little: S, kids: S, grownups: S }, required: ["little", "kids", "grownups"] };
const PROSE = { type: "OBJECT", properties: { why: S, talk: TALK, pray: S, do: S }, required: ["why", "talk", "pray", "do"] };
export function responseSchema(spanish: boolean) {
  const night: any = {
    type: "OBJECT",
    properties: { night: { type: "INTEGER" }, date: S, reference: S, why: S, talk: TALK, pray: S, do: S, flags: { type: "ARRAY", items: S } },
    required: ["night", "reference", "why", "talk", "pray", "do"],
  };
  if (spanish) {
    night.properties.es = PROSE;
    night.required.push("es");
  }
  return { type: "OBJECT", properties: { nights: { type: "ARRAY", items: night } }, required: ["nights"] };
}

/** Gemini REST generateContent. The key stays in the Worker; it is never logged or sent to the browser. */
export function geminiClient(apiKey: string): AiClient {
  return {
    name: "gemini",
    async draft(input, model) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userPrompt(input) }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: responseSchema(input.spanish), temperature: 0.7 },
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) throw new Error(`Gemini ${res.status}`); // body not logged: may echo request details
      const data: any = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
      const parsed = ModelWeek.safeParse(JSON.parse(text));
      if (!parsed.success) throw new Error("Gemini returned JSON that does not match the schema");
      return parsed.data.nights;
    },
  };
}

/** Deterministic local drafter for development without a key. Never used in production. */
export function mockClient(badNights: number[] = []): AiClient {
  const refs = starterEn.nights.map((n) => n.reference);
  return {
    name: "mock",
    async draft(input) {
      return input.nights.map((n) => {
        const idx = (n.night - 1 + (input.stricter?.length ? 13 : 0)) % refs.length;
        let reference = refs[idx];
        let k = idx;
        while (input.avoidReferences.includes(reference)) reference = refs[++k % refs.length];
        if (badNights.includes(n.night)) reference = "Hezekiah 3:16";
        const prose = {
          why: `Night ${n.night}: a short passage for the ${THEMES[input.theme].en} theme (local sample draft).`,
          talk: {
            little: "What do you see in this story?",
            kids: "What is one thing this reading tells us about God?",
            grownups: "Where does this passage meet you this week?",
          },
          pray: "God, thank you for this night together. Help us wait for Jesus with open hearts. Amen.",
          do: "Sit together for one quiet minute, then each person shares one thing they are thankful for.",
        };
        const es = {
          why: `Noche ${n.night}: un pasaje corto para el tema (borrador local de muestra).`,
          talk: { little: "¿Qué ves en esta historia?", kids: "¿Qué nos dice esta lectura de Dios?", grownups: "¿Dónde te encuentra este pasaje esta semana?" },
          pray: "Dios, gracias por esta noche juntos. Ayúdanos a esperar a Jesús. Amén.",
          do: "Siéntense juntos un minuto en silencio y cada uno comparta algo por lo que da gracias.",
        };
        return { night: n.night, date: n.date, reference, ...prose, ...(input.spanish ? { es } : {}), flags: [] };
      });
    },
  };
}
