/** Paths and lighting-state helpers for the painted Advent art in /public/art. */

export type WreathState = "week-1" | "week-2" | "week-3" | "week-4" | "christmas";
export type WeekCardKey = "hope" | "peace" | "joy" | "love" | "christmas";

export const WEEK_CARD_KEYS: WeekCardKey[] = ["hope", "peace", "joy", "love"];

/** Map a church week and Christmas flag to the painted wreath lighting state. */
export function wreathState(week: number, christLit: boolean): WreathState {
  if (christLit) return "christmas";
  const w = Math.min(4, Math.max(1, Math.floor(week) || 1));
  return `week-${w}` as WreathState;
}

/** Family-card illustration. Christmas uses a crop of the all-lit wreath, never a manger. */
export function weekCardKey(week: number, isChristmas: boolean): WeekCardKey {
  if (isChristmas) return "christmas";
  return WEEK_CARD_KEYS[Math.min(4, Math.max(1, Math.floor(week) || 1)) - 1];
}

export const WREATH_SIZES = [800, 1280, 1920] as const;
export const WEEK_SIZES = [480, 800, 1200] as const;

/** Weeks that have a compressed flicker loop in public/art/video. Others use the still. */
export const WREATH_VIDEO: Partial<Record<WreathState, string>> = {
  "week-1": "/art/video/week-1-loop.mp4",
  "week-4": "/art/video/week-4-loop.mp4",
};

export function wreathSrc(state: WreathState, size: (typeof WREATH_SIZES)[number], type: "avif" | "webp"): string {
  return `/art/wreath/${state}-${size}.${type}`;
}

export function wreathSrcSet(state: WreathState, type: "avif" | "webp"): string {
  return WREATH_SIZES.map((s) => `${wreathSrc(state, s, type)} ${s}w`).join(", ");
}

export function weekSrc(key: WeekCardKey, size: (typeof WEEK_SIZES)[number], type: "avif" | "webp"): string {
  return `/art/weeks/${key}-${size}.${type}`;
}

export function weekSrcSet(key: WeekCardKey, type: "avif" | "webp"): string {
  return WEEK_SIZES.map((s) => `${weekSrc(key, s, type)} ${s}w`).join(", ");
}
