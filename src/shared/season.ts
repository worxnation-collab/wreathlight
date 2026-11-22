export type SeasonKey = "nov29" | "dec1";
export type TraditionKey = "hope" | "prophecy" | "liturgical";
export type ThemeKey = "names" | "prophecy" | "luke" | "light";
export type TranslationKey = "bsb" | "kjv" | "web";

export const SEASONS: Record<SeasonKey, { start: string; end: string; label: string }> = {
  nov29: { start: "2026-11-29", end: "2026-12-25", label: "Nov 29 – Dec 25 (27 nights)" },
  dec1: { start: "2026-12-01", end: "2026-12-25", label: "Dec 1 – Dec 25 (25 nights)" },
};

// Advent Sundays 2026. Week n starts on ADVENT_SUNDAYS[n-1].
export const ADVENT_SUNDAYS = ["2026-11-29", "2026-12-06", "2026-12-13", "2026-12-20"];
export const CHRISTMAS = "2026-12-25";

export interface Candle { en: string; es: string; color: string }
export const TRADITIONS: Record<TraditionKey, { label: string; candles: Candle[] }> = {
  hope: {
    label: "Hope · Peace · Joy · Love",
    candles: [
      { en: "Hope", es: "Esperanza", color: "#7b5ea7" },
      { en: "Peace", es: "Paz", color: "#7b5ea7" },
      { en: "Joy", es: "Gozo", color: "#d77a9c" },
      { en: "Love", es: "Amor", color: "#7b5ea7" },
    ],
  },
  prophecy: {
    label: "Prophecy · Bethlehem · Shepherds · Angels",
    candles: [
      { en: "Prophecy", es: "Profecía", color: "#7b5ea7" },
      { en: "Bethlehem", es: "Belén", color: "#7b5ea7" },
      { en: "Shepherds", es: "Pastores", color: "#d77a9c" },
      { en: "Angels", es: "Ángeles", color: "#7b5ea7" },
    ],
  },
  liturgical: {
    label: "Liturgical (purple and rose)",
    candles: [
      { en: "First Sunday", es: "Primer domingo", color: "#5b3f8c" },
      { en: "Second Sunday", es: "Segundo domingo", color: "#5b3f8c" },
      { en: "Third Sunday (rose)", es: "Tercer domingo (rosa)", color: "#d77a9c" },
      { en: "Fourth Sunday", es: "Cuarto domingo", color: "#5b3f8c" },
    ],
  },
};

export const TRANSLATIONS: Record<TranslationKey | "rv1909", { name: string; short: string }> = {
  bsb: { name: "Berean Standard Bible", short: "BSB" },
  kjv: { name: "King James Version", short: "KJV" },
  web: { name: "World English Bible", short: "WEB" },
  rv1909: { name: "Reina-Valera 1909", short: "RV1909" },
};

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
}
export function seasonNights(start: string, end: string): { night: number; date: string }[] {
  const n = daysBetween(start, end) + 1;
  return Array.from({ length: n }, (_, i) => ({ night: i + 1, date: addDays(start, i) }));
}
/** Advent week (1-4) for a date; dates before the first Sunday count as week 1. */
export function weekOf(date: string): number {
  let w = 1;
  for (let i = 0; i < ADVENT_SUNDAYS.length; i++) if (date >= ADVENT_SUNDAYS[i]) w = i + 1;
  return w;
}
/** Calendar date (YYYY-MM-DD) in a time zone. */
export function todayIn(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
/** Label for a night's place in the season: the Advent candle week, or Christmas on Dec 25. */
export function seasonLabel(date: string, tradition: TraditionKey, lang: "en" | "es"): string {
  if (date === CHRISTMAS) return lang === "es" ? "Navidad" : "Christmas";
  const c = TRADITIONS[tradition].candles[weekOf(date) - 1];
  return lang === "es" ? `Semana de ${c.es}` : `${c.en} week`;
}
