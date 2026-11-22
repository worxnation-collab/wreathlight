import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { validateNight, gradeLevel, numbersMatch, type ValidateContext } from "../../src/shared/validator";
import { useShingleData, parseReference, passageText } from "../../src/shared/scripture";

beforeAll(() => useShingleData(readFileSync("content/bible/shingles.bin")));

const ctx = (over: Partial<ValidateContext> = {}): ValidateContext => ({
  translation: "bsb", spanish: false, tradition: "hope", usedRefKeys: new Set(), ...over,
});
const good = () => ({
  reference: "Isaiah 9:2",
  why: "Advent begins in the dark, and this promise says light is coming.",
  talk: {
    little: "What do you see when the lights go off?",
    kids: "When have you felt like you were waiting in the dark?",
    grownups: "Where do you most need light this season, and what helps you keep hoping?",
  },
  pray: "God of light, thank you that the dark does not win. Help us wait for Jesus with hope. Amen.",
  do: "Turn off the lights for one minute and sit together. Then switch on one lamp and say: light is coming.",
});
const es = () => ({
  why: "El Adviento empieza en la oscuridad, y esta promesa dice que la luz viene.",
  talk: { little: "¿Qué ves cuando se apagan las luces?", kids: "¿Cuándo has esperado algo en la oscuridad?", grownups: "¿Dónde necesitas más luz en esta temporada?" },
  pray: "Dios de luz, gracias porque la oscuridad no gana. Amén.",
  do: "Apaguen las luces un minuto y siéntense juntos. Luego enciendan una lámpara.",
});
const codes = (r: ReturnType<typeof validateNight>) => r.issues.map((i) => i.code);

describe("passes", () => {
  it("a clean night passes with no issues", () => {
    const r = validateNight(good(), ctx());
    expect(r.issues).toEqual([]);
    expect(r.ok).toBe(true);
  });
  it("fills verse text from the dataset character for character", () => {
    const r = validateNight(good(), ctx());
    expect(r.verse_en).toBe(passageText(parseReference("Isaiah 9:2")!, "bsb"));
    expect(r.reference).toBe("Isaiah 9:2");
  });
  it("uses the chosen translation", () => {
    const r = validateNight(good(), ctx({ translation: "kjv" }));
    expect(r.verse_en).toMatch(/^The people that walked in darkness/);
  });
  it("fills Spanish from RV1909 when Spanish is on", () => {
    const r = validateNight({ ...good(), es: es() }, ctx({ spanish: true }));
    expect(r.ok).toBe(true);
    expect(r.verse_es).toMatch(/^El pueblo que andaba en tinieblas/);
    expect(r.reference_es).toBe("Isaías 9:2");
  });
  it("accepts verse ranges up to 6 verses and en dashes", () => {
    expect(validateNight({ ...good(), reference: "Luke 2:8–13" }, ctx()).ok).toBe(true);
  });
  it("accepts a cross-chapter range within the limit", () => {
    const r = validateNight({ ...good(), reference: "Isaiah 8:22-9:2" }, ctx());
    expect(r.ok).toBe(true);
    expect(r.reference).toBe("Isaiah 8:22–9:2");
  });
});

describe("hard fails", () => {
  it("unparseable reference", () => expect(codes(validateNight({ ...good(), reference: "the Christmas story" }, ctx()))).toContain("REF_PARSE"));
  it("whole chapter reference is not accepted", () => expect(codes(validateNight({ ...good(), reference: "Luke 2" }, ctx()))).toContain("REF_PARSE"));
  it("unknown book", () => expect(codes(validateNight({ ...good(), reference: "Hezekiah 3:16" }, ctx()))).toContain("REF_PARSE"));
  it("chapter that does not exist", () => expect(codes(validateNight({ ...good(), reference: "Micah 9:2" }, ctx()))).toContain("REF_NOT_FOUND"));
  it("verse that does not exist", () => expect(codes(validateNight({ ...good(), reference: "Luke 2:99" }, ctx()))).toContain("REF_NOT_FOUND"));
  it("passage longer than 6 verses", () => expect(codes(validateNight({ ...good(), reference: "Luke 2:1-20" }, ctx()))).toContain("REF_TOO_LONG"));
  it("book outside the shipped text", () => expect(codes(validateNight({ ...good(), reference: "Genesis 1:3" }, ctx()))).toContain("REF_NO_TEXT"));
  it("duplicate reference in the season", () => {
    const key = validateNight(good(), ctx()).refKey!;
    expect(codes(validateNight(good(), ctx({ usedRefKeys: new Set([key]) })))).toContain("DUP_REF");
  });
  for (const f of ["why", "pray", "do"] as const) {
    it(`empty ${f}`, () => expect(codes(validateNight({ ...good(), [f]: "  " }, ctx()))).toContain("EMPTY_FIELD"));
  }
  it("empty talk band", () => expect(codes(validateNight({ ...good(), talk: { ...good().talk, kids: "" } }, ctx()))).toContain("EMPTY_FIELD"));
  it("talk over 160 chars", () => expect(codes(validateNight({ ...good(), talk: { ...good().talk, grownups: "a ".repeat(90) } }, ctx()))).toContain("TOO_LONG"));
  it("pray over 200 chars", () => expect(codes(validateNight({ ...good(), pray: "x".repeat(201) }, ctx()))).toContain("TOO_LONG"));
  it("do over 220 chars", () => expect(codes(validateNight({ ...good(), do: "y".repeat(221) }, ctx()))).toContain("TOO_LONG"));
  it("why over 160 chars", () => expect(codes(validateNight({ ...good(), why: "z".repeat(161) }, ctx()))).toContain("TOO_LONG"));
  it("URL present", () => expect(codes(validateNight({ ...good(), do: "Watch the video at https://example.com together." }, ctx()))).toContain("URL_OR_EMAIL"));
  it("bare domain present", () => expect(codes(validateNight({ ...good(), why: "Find more at example.org tonight." }, ctx()))).toContain("URL_OR_EMAIL"));
  it("email present", () => expect(codes(validateNight({ ...good(), pray: "Write to pastor@example.com and pray. Amen." }, ctx()))).toContain("URL_OR_EMAIL"));
  it("model-written Scripture quotation (10+ words) is blocked", () => {
    const r = validateNight({ ...good(), why: "Remember that the people walking in darkness have seen a great light tonight." }, ctx());
    expect(codes(r)).toContain("SCRIPTURE_QUOTE");
    expect(r.ok).toBe(false);
  });
  it("Scripture quotation in another translation is blocked too", () => {
    expect(codes(validateNight({ ...good(), pray: "For unto us a child is born, unto us a son is given. Amen." }, ctx()))).toContain("SCRIPTURE_QUOTE");
  });
  it("Spanish quotation from RV1909 is blocked", () => {
    const e = { ...es(), pray: "El pueblo que andaba en tinieblas vió gran luz, los que moraban. Amén." };
    expect(codes(validateNight({ ...good(), es: e }, ctx({ spanish: true })))).toContain("SCRIPTURE_QUOTE");
  });
  it("Spanish fields obey the same caps", () => {
    const e = { ...es(), do: "y".repeat(221) };
    expect(codes(validateNight({ ...good(), es: e }, ctx({ spanish: true })))).toContain("TOO_LONG");
  });
  it("short shared phrases are not treated as quotations", () => {
    expect(codes(validateNight({ ...good(), why: "Jesus is the light of the world, and we can carry it." }, ctx()))).not.toContain("SCRIPTURE_QUOTE");
  });
});

describe("soft flags (never block)", () => {
  const soft = (over: object, c = ctx()) => {
    const r = validateNight({ ...good(), ...over }, c);
    expect(r.ok).toBe(true);
    return codes(r);
  };
  it("three kings stated as fact", () => expect(soft({ why: "The three kings followed the star to find Jesus." })).toContain("LEGEND_AS_FACT"));
  it("December 25 as Jesus' birthday", () => expect(soft({ talk: { ...good().talk, kids: "Why was December 25 Jesus' birthday?" }, why: "Jesus was born on December 25 in Bethlehem." })).toContain("LEGEND_AS_FACT"));
  it("Mary's age stated", () => expect(soft({ why: "Mary was 14 when the angel came." })).toContain("LEGEND_AS_FACT"));
  it("fear or guilt language", () => expect(soft({ pray: "Help us not be naughty this week. Amen." })).toContain("FEAR_GUILT"));
  it("prosperity promise", () => expect(soft({ why: "God wants you rich when you give." })).toContain("PROSPERITY"));
  it("Santa claims", () => expect(soft({ talk: { ...good().talk, little: "What will Santa bring?" } })).toContain("SANTA"));
  it("keeping secrets", () => expect(soft({ do: "Make a card and keep it a secret from everyone." })).toContain("SECRETS_OR_GOING"));
  it("going somewhere after dark", () => expect(soft({ do: "Take a walk after dark to look at lights." })).toContain("SECRETS_OR_GOING"));
  it("medical advice", () => expect(soft({ pray: "Help us remember our medicine each day. Amen." })).toContain("MEDICAL"));
  it("denominational distinctive in default tradition", () => expect(soft({ why: "Advent points us to the rapture." })).toContain("DENOMINATIONAL"));
  it("denominational rule is off for other traditions", () => expect(soft({ why: "Advent points us to the rapture." }, ctx({ tradition: "liturgical" }))).not.toContain("DENOMINATIONAL"));
  it("Do activity that costs money", () => expect(soft({ do: "Go to the store and buy a small gift for a neighbor." })).toContain("DO_SPENDING"));
  it("Do activity with flame and no adult", () => expect(soft({ do: "Light a candle and watch it glow." })).toContain("DO_FLAME"));
  it("flame with an adult is fine", () => expect(soft({ do: "A grown-up lights a candle, or use a battery candle, and watch it glow." })).not.toContain("DO_FLAME"));
  it("hard little-ones question flags reading level", () =>
    expect(soft({ talk: { ...good().talk, little: "Consider how prophetic anticipation illuminates contemporary expectation." } })).toContain("READING_LEVEL"));
  it("missing Spanish is a soft flag", () => expect(soft({}, ctx({ spanish: true }))).toContain("ES_MISSING"));
});

describe("helpers", () => {
  it("grade level of a simple question is low", () => expect(gradeLevel("What do you see?")).toBeLessThanOrEqual(2));
  it("announcement numbers must match inputs", () => {
    expect(numbersMatch("This week 63 households lit 241 candles.", [63, 241]).ok).toBe(true);
    expect(numbersMatch("This week 70 households lit 241 candles.", [63, 241]).ok).toBe(false);
  });
});

describe("Spanish 'santa' means holy", () => {
  it("does not flag 'noche santa' or 'la Santa Biblia' in Spanish", () => {
    const e = { ...es(), why: "En esta noche santa, leemos la Santa Biblia y recordamos que la luz viene." };
    const r = validateNight({ ...good(), es: e } as never, ctx({ spanish: true }));
    expect(codes(r)).not.toContain("SANTA");
  });
  it("still flags Santa Claus / Papá Noel in Spanish and Santa in English", () => {
    const e = { ...es(), why: "Papá Noel no es el centro; la luz viene." };
    expect(codes(validateNight({ ...good(), es: e } as never, ctx({ spanish: true })))).toContain("SANTA");
    expect(codes(validateNight({ ...good(), why: "Santa is coming, but light is coming first." }, ctx()))).toContain("SANTA");
  });
});
