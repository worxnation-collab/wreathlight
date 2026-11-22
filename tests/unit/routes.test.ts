import { describe, expect, it } from "vitest";
import { isAppRoute } from "../../src/shared/routes";

describe("app routes (real 404 for everything else)", () => {
  it("knows every SPA route", () => {
    for (const p of ["/", "/j", "/j/HOPE25", "/j/hope25/", "/c/HOPE25/wreath", "/studio", "/studio/new", "/studio/c/abc", "/ai", "/print/demo-hope-creek/booklet"])
      expect(isAppRoute(p), p).toBe(true);
  });
  it("rejects unknown paths", () => {
    for (const p of ["/nope", "/j/HOPE25/extra", "/c/HOPE25", "/print/x/poster", "/wp-admin", "/index.php", "/aix"])
      expect(isAppRoute(p), p).toBe(false);
  });
});
