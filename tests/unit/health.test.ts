import { describe, expect, it } from "vitest";
import { APP_NAME } from "../../src/shared/brand";
import { health } from "../../src/worker/health";

describe("health", () => {
  it("reports the app name and AI switch", () => {
    expect(health("true")).toEqual({ ok: true, app: APP_NAME, aiEnabled: true });
    expect(health("false").aiEnabled).toBe(false);
    expect(health(undefined).aiEnabled).toBe(false);
  });
});
