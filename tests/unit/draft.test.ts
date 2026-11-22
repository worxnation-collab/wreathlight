import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { draftWeek, type WeekDeps, type WeekInput } from "../../src/worker/draft";
import { mockClient, type AiClient } from "../../src/worker/ai";
import { useShingleData } from "../../src/shared/scripture";
import { seasonNights, weekOf } from "../../src/shared/season";

beforeAll(() => useShingleData(readFileSync("content/bible/shingles.bin")));

const week1 = seasonNights("2026-11-29", "2026-12-25").filter((n) => weekOf(n.date) === 1);
const input = (): WeekInput => ({
  theme: "prophecy", tradition: "hope", translation: "bsb", spanish: true, week: 1, nights: week1,
  usedRefKeys: new Set(), usedRefs: [],
});
const deps = (ai: AiClient | null, calls: string[] = [], cap = 99): WeekDeps => {
  let n = 0;
  return {
    ai, primaryModel: "primary", fallbackModel: "fallback",
    canCall: async () => n++ < cap,
    onRun: async (r) => { calls.push(`${r.model}:${r.outcome}`); },
  };
};

describe("draft pipeline", () => {
  it("drafts a full week with AI when everything passes", async () => {
    const out = await draftWeek(deps(mockClient()), input());
    expect(out).toHaveLength(7);
    expect(out.every((n) => n.source === "ai" && n.result.ok)).toBe(true);
  });
  it("a forced bad reference is blocked, retried, sent to the fallback model, then filled from the Starter Plan", async () => {
    const calls: string[] = [];
    const out = await draftWeek(deps(mockClient([3]), calls), input());
    const n3 = out.find((n) => n.night === 3)!;
    expect(n3.source).toBe("starter");
    expect(n3.attempts.join(" | ")).toMatch(/primary: REF_PARSE.*primary: REF_PARSE.*fallback: REF_PARSE.*Starter Plan/);
    expect(calls).toEqual(["primary:week:ok", "primary:retry-night-3:ok", "fallback:fallback-night-3:ok"]);
    expect(out.filter((n) => n.night !== 3).every((n) => n.source === "ai")).toBe(true);
  });
  it("AI off (no client) uses the Starter Plan for every night and makes no calls", async () => {
    const calls: string[] = [];
    const out = await draftWeek(deps(null, calls), input());
    expect(out.every((n) => n.source === "starter" && n.result.ok)).toBe(true);
    expect(calls).toEqual([]);
  });
  it("over the daily cap falls back to the Starter Plan", async () => {
    const out = await draftWeek(deps(mockClient(), [], 0), input());
    expect(out.every((n) => n.source === "starter")).toBe(true);
  });
  it("a model error falls back to the fallback model for the week", async () => {
    const calls: string[] = [];
    const flaky: AiClient = { name: "flaky", async draft(p, model) { if (model === "primary") throw new Error("boom"); return mockClient().draft(p, model); } };
    const out = await draftWeek(deps(flaky, calls), input());
    expect(out.every((n) => n.source === "ai" && n.model === "fallback")).toBe(true);
    expect(calls[0]).toMatch(/^primary:week:error/);
  });
  it("never repeats a reference across the season", async () => {
    const inp = input();
    const all = [];
    for (const w of [1, 2, 3, 4]) {
      inp.week = w;
      inp.nights = seasonNights("2026-11-29", "2026-12-25").filter((n) => weekOf(n.date) === w);
      all.push(...(await draftWeek(deps(mockClient()), inp)));
    }
    expect(all).toHaveLength(27);
    const keys = all.map((n) => n.result.refKey);
    expect(new Set(keys).size).toBe(27);
  });
});

describe("draftWeek with nothing to draft", () => {
  it("makes no model call when every night is already approved", async () => {
    const { draftWeek } = await import("../../src/worker/draft");
    let calls = 0;
    const out = await draftWeek(
      {
        ai: { name: "spy", draft: async () => { calls++; return []; } } as never,
        primaryModel: "p", fallbackModel: "f", canCall: async () => true, onRun: async () => {},
      },
      { theme: "light", tradition: "hope", translation: "bsb", spanish: false, week: 1, nights: [], usedRefKeys: new Set(), usedRefs: [] },
    );
    expect(out).toEqual([]);
    expect(calls).toBe(0);
  });
});
