import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import en from "../../content/starter-plan.en.json";
import es from "../../content/starter-plan.es.json";
import { validateNight } from "../../src/shared/validator";
import { useShingleData } from "../../src/shared/scripture";

beforeAll(() => useShingleData(readFileSync("content/bible/shingles.bin")));

describe("Starter Plan", () => {
  it("has 27 nights in EN and ES, Nov 29 to Dec 25", () => {
    expect(en.nights).toHaveLength(27);
    expect(es.nights).toHaveLength(27);
    expect(en.nights[0].date).toBe("2026-11-29");
    expect(en.nights[26].date).toBe("2026-12-25");
  });
  it("every night passes all hard checks, with no duplicate references, in all translations", () => {
    for (const translation of ["bsb", "kjv", "web"] as const) {
      const used = new Set<string>();
      for (const n of en.nights) {
        const e = es.nights.find((x) => x.night === n.night)!;
        const r = validateNight({ ...n, es: e }, { translation, spanish: true, tradition: "hope", usedRefKeys: used });
        expect(r.issues.filter((i) => i.severity === "hard"), `night ${n.night}`).toEqual([]);
        used.add(r.refKey!);
      }
    }
  });
  it("lists soft flags for the reviewer (report only)", () => {
    const used = new Set<string>();
    const flagged: string[] = [];
    for (const n of en.nights) {
      const e = es.nights.find((x) => x.night === n.night)!;
      const r = validateNight({ ...n, es: e }, { translation: "bsb", spanish: true, tradition: "hope", usedRefKeys: used });
      used.add(r.refKey!);
      for (const i of r.issues) flagged.push(`night ${n.night}: ${i.code} ${i.message}`);
    }
    console.log(flagged.join("\n") || "no soft flags");
    expect(true).toBe(true);
  });
});
