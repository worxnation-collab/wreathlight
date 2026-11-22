import { describe, expect, it } from "vitest";
import { seasonLabel } from "../../src/shared/season";
import { demoResetPaused } from "../../src/worker/demo";

describe("season labels", () => {
  it("Dec 25 is Christmas / Navidad, not the fourth candle's week", () => {
    expect(seasonLabel("2026-12-25", "hope", "en")).toBe("Christmas");
    expect(seasonLabel("2026-12-25", "hope", "es")).toBe("Navidad");
    expect(seasonLabel("2026-12-24", "hope", "en")).toBe("Love week");
    expect(seasonLabel("2026-11-29", "hope", "es")).toBe("Semana de Esperanza");
  });
});

function fakeDb(value: string | null, throws = false) {
  return {
    prepare: () => ({
      first: async () => {
        if (throws) throw new Error("no such table: app_flags");
        return value === null ? null : { value };
      },
    }),
  } as unknown as D1Database;
}

describe("demo reset pause switch", () => {
  it("runs by default, including before the flags table exists", async () => {
    expect(await demoResetPaused(fakeDb(null))).toBe(false);
    expect(await demoResetPaused(fakeDb(null, true))).toBe(false);
    expect(await demoResetPaused(fakeDb("0"))).toBe(false);
  });
  it("pauses on the D1 flag or the DEMO_RESET_PAUSED var", async () => {
    expect(await demoResetPaused(fakeDb("1"))).toBe(true);
    expect(await demoResetPaused(fakeDb(null), "1")).toBe(true);
    expect(await demoResetPaused(fakeDb(null), "true")).toBe(true);
  });
});

import { demoRedraftUnlocked } from "../../src/worker/demo";
describe("demo redraft unlock (ops-only, off by default)", () => {
  const NOW = new Date("2026-11-22T17:00:00Z");
  it("is locked with no flag, a bad value, a past time, or a window over 2 hours", async () => {
    expect(await demoRedraftUnlocked(fakeDb(null), NOW)).toBe(false);
    expect(await demoRedraftUnlocked(fakeDb(null, true), NOW)).toBe(false);
    expect(await demoRedraftUnlocked(fakeDb("1"), NOW)).toBe(false);
    expect(await demoRedraftUnlocked(fakeDb("2026-11-22T16:59:00Z"), NOW)).toBe(false);
    expect(await demoRedraftUnlocked(fakeDb("2026-11-22T19:01:00Z"), NOW)).toBe(false);
  });
  it("is unlocked only inside a short future window", async () => {
    expect(await demoRedraftUnlocked(fakeDb("2026-11-22T17:30:00Z"), NOW)).toBe(true);
    expect(await demoRedraftUnlocked(fakeDb("2026-11-22T19:00:00Z"), NOW)).toBe(true);
  });
});
