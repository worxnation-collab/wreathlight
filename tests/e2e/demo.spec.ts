import { test, expect } from "@playwright/test";

// Needs the demo church seeded locally (npx tsx scripts/seed-demo.ts --local; CI does this).
const BEFORE_ADVENT = "2026-11-22T20:00:00-05:00";

test("demo church: before Advent, Night 1 opens early so visitors can try it", async ({ request }) => {
  const r = await request.get("/api/public/HOPE25", { headers: { "x-test-now": BEFORE_ADVENT } });
  const d = await r.json();
  expect(d.tonight).toBe(1);
  expect(d.demo_early).toBe(true);
  expect(d.nights.map((n: { night: number }) => n.night)).toEqual([1]);
});

test("home shows the three demo entry points", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Try the live demo" })).toBeVisible();
  for (const name of [/Be a family/, /Be the pastor/, /Sunday projector/]) await expect(page.getByRole("link", { name })).toBeVisible();
});

test("family on a phone before Advent lands on Night 1 of the demo", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { "x-test-now": BEFORE_ADVENT }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("/j/HOPE25");
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page.getByText("Read this aloud together.")).toBeVisible();
  await ctx.close();
});

test("demo wreath before Advent shows the first Sunday's Hope candle lit", async ({ request }) => {
  const d = await (await request.get("/api/public/HOPE25/wreath", { headers: { "x-test-now": BEFORE_ADVENT } })).json();
  expect(d.sundays_lit).toBe(1);
  expect(d.week).toBe(1);
});

test("signed-out Studio load is a 200 (no console errors for judges)", async ({ request }) => {
  const r = await request.get("/api/me");
  expect(r.status()).toBe(200);
  expect(await r.json()).toBeNull();
});
