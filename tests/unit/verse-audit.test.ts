import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { useShingleData } from "../../src/shared/scripture";
import { auditVerses, type AuditNight } from "../../src/shared/verse-audit";
import { starterDemoNights } from "../../src/worker/demo";

beforeAll(() => useShingleData(readFileSync("content/bible/shingles.bin")));

describe("acceptance #2: published verse text matches the dataset", () => {
  it("all 27 seeded demo nights match BSB and RV1909 character for character", () => {
    const nights = starterDemoNights() as unknown as AuditNight[];
    expect(nights).toHaveLength(27);
    expect(auditVerses(nights, "bsb")).toEqual([]);
  });
  it("catches a single changed character", () => {
    const [n] = starterDemoNights() as unknown as AuditNight[];
    const tampered: AuditNight = { ...n, verse_en: n.verse_en!.replace(/.$/, "!") };
    expect(auditVerses([tampered], "bsb")).toHaveLength(1);
  });
});
