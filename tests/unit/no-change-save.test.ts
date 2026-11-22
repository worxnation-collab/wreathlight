import { describe, expect, it } from "vitest";
import { sameNightContent } from "../../src/worker/util";
import type { ModelNight } from "../../src/shared/schemas";

const base = (): ModelNight => ({
  night: 26, date: "2026-12-24", reference: "Luke 2:13–14",
  why: "Heaven sings.", talk: { little: "Who sang?", kids: "Why sing?", grownups: "Where is peace?" }, pray: "Amen.", do: "Sing softly.",
  es: { why: "En esta noche santa, el cielo canta.", talk: { little: "¿Quién cantó?", kids: "¿Por qué cantar?", grownups: "¿Dónde hay paz?" }, pray: "Amén.", do: "Canten bajito." },
});

describe("Save and re-check with no changes", () => {
  it("counts as no change (key order and surrounding spaces don't matter)", () => {
    const b = base();
    const same = { ...b, talk: { grownups: "Where is peace? ", kids: "Why sing?", little: "Who sang?" } } as ModelNight;
    expect(sameNightContent(base(), same)).toBe(true);
  });
  it("any real change in English, Spanish or the reference counts as an edit", () => {
    expect(sameNightContent(base(), { ...base(), pray: "Thank you, God. Amen." })).toBe(false);
    expect(sameNightContent(base(), { ...base(), reference: "Luke 2:15" })).toBe(false);
    const b = base();
    expect(sameNightContent(base(), { ...b, es: { ...b.es!, do: "Canten fuerte." } })).toBe(false);
  });
});
