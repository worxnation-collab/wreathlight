import { describe, expect, it } from "vitest";
import { weekCardKey, wreathState } from "../../src/shared/art";

describe("wreathState", () => {
  it("lights the correct Sunday candles, and all five on Christmas", () => {
    expect(wreathState(1, false)).toBe("week-1");
    expect(wreathState(2, false)).toBe("week-2");
    expect(wreathState(3, false)).toBe("week-3");
    expect(wreathState(4, false)).toBe("week-4");
    expect(wreathState(4, true)).toBe("christmas");
    expect(wreathState(1, true)).toBe("christmas");
  });
  it("clamps a bad week to 1–4", () => {
    expect(wreathState(0, false)).toBe("week-1");
    expect(wreathState(9, false)).toBe("week-4");
  });
});

describe("weekCardKey", () => {
  it("uses the four week illustrations and the all-lit wreath for Christmas, never a manger key", () => {
    expect(weekCardKey(1, false)).toBe("hope");
    expect(weekCardKey(2, false)).toBe("peace");
    expect(weekCardKey(3, false)).toBe("joy");
    expect(weekCardKey(4, false)).toBe("love");
    expect(weekCardKey(4, true)).toBe("christmas");
    expect(weekCardKey(1, true)).toBe("christmas");
  });
});
