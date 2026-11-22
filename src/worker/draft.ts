import type { ModelNight, Prose } from "../shared/schemas";
import { validateNight, type ValidationResult } from "../shared/validator";
import type { TraditionKey, TranslationKey, ThemeKey } from "../shared/season";
import type { AiClient, PromptInput } from "./ai";
import starterEn from "../../content/starter-plan.en.json";
import starterEs from "../../content/starter-plan.es.json";

export interface DraftedNight {
  night: number;
  date: string;
  source: "ai" | "starter";
  model: string | null;
  content: ModelNight;
  result: ValidationResult;
  attempts: string[]; // human-readable log, e.g. "gemini-flash: REF_NOT_FOUND"
}
export interface WeekDeps {
  ai: AiClient | null; // null = AI off / no key → Starter Plan
  primaryModel: string;
  fallbackModel: string;
  canCall: () => Promise<boolean>; // enforces daily caps
  onRun: (r: { model: string; ms: number; outcome: string; checks: unknown; prompt: string }) => Promise<void>;
}
export interface WeekInput {
  theme: ThemeKey;
  tradition: TraditionKey;
  translation: TranslationKey;
  spanish: boolean;
  week: number;
  nights: { night: number; date: string }[];
  sermon?: { title: string; passage: string };
  usedRefKeys: Set<string>; // keys already used this season (mutated as nights are accepted)
  usedRefs: string[]; // display refs to tell the model to avoid
}

/** Starter Plan night for a date (the plan is keyed by date, so a Dec 1 season starts at its 3rd night). */
export function starterFor(date: string, night: number): ModelNight {
  const en = starterEn.nights.find((n) => n.date === date) ?? starterEn.nights[(night - 1) % starterEn.nights.length];
  const es = starterEs.nights.find((n) => n.night === en.night)!;
  return { night, date, reference: en.reference, why: en.why, talk: en.talk, pray: en.pray, do: en.do, es: es as Prose };
}

function hardReasons(r: ValidationResult): string[] {
  return r.issues.filter((i) => i.severity === "hard").map((i) => i.message);
}

/**
 * Drafts one Advent week. Per night: validate → on a hard fail retry once with the reasons ("stricter")
 * → fallback model once → Starter Plan labeled "From the Starter Plan".
 */
export async function draftWeek(deps: WeekDeps, input: WeekInput): Promise<DraftedNight[]> {
  const vctx = (used: Set<string>) => ({ translation: input.translation, spanish: input.spanish, tradition: input.tradition, usedRefKeys: used });
  const base: Omit<PromptInput, "nights"> = {
    theme: input.theme, tradition: input.tradition, translation: input.translation, spanish: input.spanish,
    week: input.week, sermon: input.sermon, avoidReferences: input.usedRefs,
  };

  const call = async (model: string, p: PromptInput, label: string): Promise<ModelNight[] | null> => {
    if (!deps.ai || !(await deps.canCall())) return null;
    const t0 = Date.now();
    try {
      const out = await deps.ai.draft(p, model);
      await deps.onRun({ model, ms: Date.now() - t0, outcome: `${label}:ok`, checks: null, prompt: JSON.stringify(p) });
      return out;
    } catch (e) {
      await deps.onRun({ model, ms: Date.now() - t0, outcome: `${label}:error:${(e as Error).message.slice(0, 80)}`, checks: null, prompt: JSON.stringify(p) });
      return null;
    }
  };

  let week = await call(deps.primaryModel, { ...base, nights: input.nights }, "week");
  let weekModel = deps.primaryModel;
  if (!week && deps.ai) {
    week = await call(deps.fallbackModel, { ...base, nights: input.nights }, "week-fallback");
    weekModel = deps.fallbackModel;
  }

  const out: DraftedNight[] = [];
  for (const n of input.nights) {
    const attempts: string[] = [];
    const tryAccept = (cand: ModelNight | undefined, model: string): DraftedNight | null => {
      if (!cand) { attempts.push(`${model}: no draft returned`); return null; }
      const content = { ...cand, night: n.night, date: n.date };
      const r = validateNight(content, vctx(input.usedRefKeys));
      if (r.ok) return { night: n.night, date: n.date, source: "ai", model, content, result: r, attempts };
      attempts.push(`${model}: ${r.issues.filter((i) => i.severity === "hard").map((i) => i.code).join(", ")}`);
      return null;
    };

    let accepted: DraftedNight | null = null;
    let lastReasons: string[] = [];
    if (week) {
      const cand = week.find((x) => x.night === n.night);
      accepted = tryAccept(cand, weekModel);
      if (!accepted && cand) lastReasons = hardReasons(validateNight({ ...cand }, vctx(input.usedRefKeys)));
    }
    if (!accepted && deps.ai) {
      // 1) retry once with the failure reasons appended
      const avoid = [...input.usedRefs];
      const retry = await call(deps.primaryModel, { ...base, avoidReferences: avoid, nights: [n], stricter: lastReasons.length ? lastReasons : ["Previous draft was missing."] }, `retry-night-${n.night}`);
      accepted = tryAccept(retry?.[0], deps.primaryModel);
      // 2) fallback model once
      if (!accepted) {
        const fb = await call(deps.fallbackModel, { ...base, avoidReferences: avoid, nights: [n], stricter: lastReasons }, `fallback-night-${n.night}`);
        accepted = tryAccept(fb?.[0], deps.fallbackModel);
      }
    }
    if (!accepted) {
      // 3) Starter Plan
      const content = starterFor(n.date, n.night);
      const r = validateNight(content, vctx(input.usedRefKeys));
      if (deps.ai) attempts.push("filled from the Starter Plan");
      accepted = { night: n.night, date: n.date, source: "starter", model: null, content, result: r, attempts };
    }
    if (accepted.result.refKey) {
      input.usedRefKeys.add(accepted.result.refKey);
      if (accepted.result.reference) input.usedRefs.push(accepted.result.reference);
    }
    out.push(accepted);
  }
  return out;
}
