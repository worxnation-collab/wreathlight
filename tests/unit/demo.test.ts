import { describe, expect, it } from "vitest";
import { DEMO_CODE, DEMO_DRAFT_NIGHTS, DEMO_HOUSEHOLDS, demoHousehold, demoResetStatements, starterDemoNights } from "../../src/worker/demo";

const NOW = new Date("2026-11-30T23:00:00Z"); // night 2 in New York

describe("demo church seed", () => {
  it("has 27 nights, two left in draft, verse text filled by code", () => {
    const nights = starterDemoNights();
    expect(nights).toHaveLength(27);
    expect(nights.filter((n) => n.status === "draft").map((n) => n.night)).toEqual(DEMO_DRAFT_NIGHTS);
    for (const n of nights) expect(n.verse_en).toBeTruthy();
    for (const n of nights.filter((x) => x.status === "approved")) expect(n.approved_name).toBe("Pastor Dana (demo)");
  });

  it("is deterministic (same statements every reset) and every statement binds all params", () => {
    const a = demoResetStatements(NOW, null);
    const b = demoResetStatements(NOW, null);
    expect(a).toEqual(b);
    for (const s of a) expect((s.sql.match(/\?/g) ?? []).length).toBe(s.params.length);
    expect(a.some((s) => s.params.includes(DEMO_CODE))).toBe(true);
  });

  it("creates 63 anonymous households and lights only up to today", () => {
    const hh = new Set(Array.from({ length: DEMO_HOUSEHOLDS }, (_, i) => demoHousehold(i)));
    expect(hh.size).toBe(63);
    for (const h of hh) expect(h).toMatch(/^[0-9a-f]{64}$/);
    const lightRows = demoResetStatements(NOW, null).filter((s) => s.sql.startsWith("INSERT OR IGNORE INTO lights"));
    const days = new Set(lightRows.flatMap((s) => s.params.filter((_, i) => i % 4 === 3)));
    expect([...days].sort()).toEqual(["2026-11-29", "2026-11-30"]);
  });
});
