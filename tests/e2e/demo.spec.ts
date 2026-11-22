import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

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

test("Keep going card stays hidden before Christmas, even in demo preview", async ({ request }) => {
  const before = await (await request.get("/api/public/HOPE25?preview=1", { headers: { "x-test-now": "2026-12-24T20:00:00-05:00" } })).json();
  expect(before.church.keep_going).toBeNull();
  const xmas = await (await request.get("/api/public/HOPE25", { headers: { "x-test-now": "2026-12-25T20:00:00-05:00" } })).json();
  expect(xmas.church.keep_going).not.toBeNull();
});

test("demo church: whole-season redraft is refused and hidden; Night 27 reads Christmas / Navidad", async ({ page, request, browser }) => {
  // Creates the demo login locally, then re-runs the demo seed so it links that login to HOPE25 (same as the hourly reset).
  const pw = "local e2e demo password";
  const s = await request.post("/api/auth/signup", { data: { email: "demo@wreathlight.app", password: pw, display_name: "Pastor Dana (demo)" } });
  test.skip(s.status() === 409, "demo login already exists in this local DB");
  execSync("npx tsx scripts/seed-demo.ts --local", { stdio: "ignore" });
  await page.setExtraHTTPHeaders({ "x-test-now": BEFORE_ADVENT });
  await page.goto("/studio");
  await page.getByLabel("Email").fill("demo@wreathlight.app");
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("tab", { name: "Nights" })).toBeVisible();
  await expect(page.getByText(/redrafting the whole season is turned off/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Redraft unapproved nights/ })).toHaveCount(0);
  await expect(page.getByText(/^Christmas · /)).toBeVisible(); // Night 27 is in the review queue
  // Dashboard agrees with the family view: Night 1 is tonight's card for the demo before Advent.
  await page.getByRole("tab", { name: "Dashboard", exact: true }).click();
  await expect(page.getByText(/Demo: families see Night 1 early/)).toBeVisible();
  await expect(page.getByText("Demo data", { exact: true })).toHaveCount(1);
  // Print views open for the demo church (its id is not a UUID).
  await page.goto("/print/demo-hope-creek/booklet");
  await expect(page.getByRole("heading", { name: /Night 1 · Sunday, November 29/ })).toBeVisible();
  await page.goto("/print/demo-hope-creek/fridge");
  await expect(page.getByRole("heading", { name: "Our Advent Wreath" })).toBeVisible();
  const me = await (await page.request.get("/api/me")).json();
  const demo = me.churches.find((c: { code: string }) => c.code === "HOPE25");
  const r = await page.request.post(`/api/churches/${demo.id}/draft`, { data: {} });
  expect(r.status()).toBe(403);
  expect((await r.json()).error).toBe("demo_locked");

  // Approve Night 27 (EN + ES), then a family on Dec 25 sees the Christmas label and the Keep going card.
  const d = await (await page.request.get(`/api/churches/${demo.id}`)).json();
  const n27 = d.nights.find((n: { night: number }) => n.night === 27);
  expect((await page.request.post(`/api/nights/${n27.id}/approve`, { data: { include_es: true } })).ok()).toBe(true);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { "x-test-now": "2026-12-25T19:00:00-05:00" } });
  const fam = await ctx.newPage();
  await fam.goto("/j/HOPE25");
  await fam.getByRole("button", { name: "Join" }).click();
  await expect(fam.getByText(/Night 27 · .* · Christmas\b/)).toBeVisible();
  await fam.getByRole("button", { name: "Cambiar a español" }).click();
  await expect(fam.getByText(/Noche 27 · .* · Navidad\b/)).toBeVisible();
  await ctx.close();
});

test("a Spanish-language phone opens the family view in Spanish", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: "es-MX", extraHTTPHeaders: { "x-test-now": BEFORE_ADVENT } });
  const page = await ctx.newPage();
  await page.goto("/j/HOPE25");
  await page.getByRole("button", { name: "Unirme" }).click();
  await expect(page.getByText("Léanlo en voz alta juntos.")).toBeVisible();
  // An explicit choice sticks.
  await page.getByRole("button", { name: "Switch to English" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Cambiar a español" })).toBeVisible();
  await ctx.close();
});
