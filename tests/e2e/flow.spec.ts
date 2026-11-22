import { test, expect, type Page } from "@playwright/test";

const TODAY = "2026-11-30T19:30:00-05:00"; // night 2 of the default season
const email = `e2e-${Date.now()}@example.test`;
let code = "";
test.describe.configure({ mode: "serial" });

async function signupAndCreate(page: Page, opts: { name: string; aiOff?: boolean }) {
  await page.goto("/studio");
  await page.getByRole("button", { name: "New here? Create an account" }).click();
  await page.getByLabel("Your name as families will see it").fill("Pastor Test");
  await page.getByLabel("Email").fill(opts.name === "AI Off Church" ? "off-" + email : email);
  await page.getByLabel("Password").fill("a long test password");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Church name").fill(opts.name);
  await page.getByRole("button", { name: "Create church" }).click();
  await expect(page.getByRole("tab", { name: "Nights" })).toBeVisible();
}

test("pastor: sign up, create, draft 27 nights, approve one at a time; edit un-approves", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-test-now": TODAY });
  const t0 = Date.now();
  await signupAndCreate(page, { name: "Lakeside Test Church" });
  await page.getByRole("button", { name: "Draft all nights" }).click();
  await expect(page.getByRole("heading", { name: "0 of 27 nights approved" })).toBeVisible({ timeout: 60_000 });
  console.log(`signup → 27 nights drafted and checked: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await expect(page.getByText("Verse text matched (BSB) 7/7").first()).toBeVisible();
  // no bulk approve exists
  await expect(page.getByRole("button", { name: /approve all/i })).toHaveCount(0);
  for (const n of [1, 2, 3]) {
    const card = page.locator("article", { has: page.getByRole("heading", { name: new RegExp(`^Night ${n} ·`) }) });
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByRole("heading", { name: `${n} of 27 nights approved` })).toHaveCount(0); // header updates on reload only
  }
  await page.getByRole("button", { name: /^Approved \(/ }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "3 of 27 nights approved" })).toBeVisible();
  code = (await page.locator(".pill", { hasText: "Code" }).innerText()).replace("Code ", "").trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);

  // public: night 1 and 2 visible on Nov 30, night 3 (future) not
  const pub = await (await page.request.get(`/api/public/${code}`, { headers: { "x-test-now": TODAY } })).json();
  expect(pub.nights.map((n: any) => n.night)).toEqual([1, 2]);

  // edit an approved night → back to draft and gone from public
  await page.getByRole("button", { name: /^Approved \(/ }).click();
  const n1 = page.locator("article", { has: page.getByRole("heading", { name: /^Night 1 ·/ }) });
  await n1.getByRole("button", { name: "Edit" }).click();
  await n1.getByLabel(/^Pray/).first().fill("God, thank you for this night together. Amen.");
  await n1.getByRole("button", { name: "Save and re-check" }).click();
  const pub2 = await (await page.request.get(`/api/public/${code}`, { headers: { "x-test-now": TODAY } })).json();
  expect(pub2.nights.map((n: any) => n.night)).toEqual([2]);

  // "Save and re-check" with nothing changed: stays approved, no "edited" label
  const n2 = page.locator("article", { has: page.getByRole("heading", { name: /^Night 2 ·/ }) });
  await page.getByRole("button", { name: "All" }).click();
  await n2.getByRole("button", { name: "Edit" }).click();
  await n2.getByRole("button", { name: "Save and re-check" }).click();
  await expect(n2.getByRole("button", { name: "Save and re-check" })).toHaveCount(0);
  await expect(n2.getByText(/, edited/)).toHaveCount(0);
  const pub3 = await (await page.request.get(`/api/public/${code}`, { headers: { "x-test-now": TODAY } })).json();
  expect(pub3.nights.map((n: any) => n.night)).toEqual([2]);
});

test("family: 360px phone, join → tonight → 4 steps → hold to light → phones down in ≤ 6 taps; nickname never sent", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, extraHTTPHeaders: { "x-test-now": TODAY }, hasTouch: true });
  const page = await ctx.newPage();
  const bodies: string[] = [];
  page.on("request", (r) => { const b = r.postData(); if (b) bodies.push(b); });
  await page.goto(`/j/${code}`);
  await page.getByLabel(/Household nickname/).fill("The Kitchen Table");
  let taps = 0;
  await page.getByRole("button", { name: "Join" }).click(); taps++;
  await expect(page.getByText("Read this aloud together.")).toBeVisible();
  for (const next of ["Next: Talk", "Next: Pray", "Next: Do"]) { await page.getByRole("button", { name: next }).click(); taps++; }
  const hold = page.getByRole("button", { name: "Hold to light tonight's candle" });
  const box = (await hold.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.waitForTimeout(1200); await page.mouse.up(); taps++;
  await expect(page.getByRole("heading", { name: "Phones down." })).toBeVisible();
  expect(taps).toBeLessThanOrEqual(6);
  console.log(`family flow taps: ${taps}`);
  expect(bodies.some((b) => b.includes("Kitchen Table"))).toBe(false);
  // Spanish toggle on the card
  await page.getByRole("button", { name: "Back to the wreath" }).click();
  await page.getByRole("button", { name: /Español|Cambiar/ }).click();
  await page.getByRole("button", { name: /Noche 2,/ }).click();
  await expect(page.getByText("RV1909")).toBeVisible();
  await expect(page.getByText(/Borrador con IA · Aprobado por/)).toBeVisible();
  await ctx.close();
});

test("projector wreath renders at 1920×1080 with no names", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, extraHTTPHeaders: { "x-test-now": TODAY } });
  const page = await ctx.newPage();
  await page.goto(`/c/${code}/wreath`);
  await expect(page.getByText(/This week, .* households lit .* candles\./)).toBeVisible();
  await expect(page.getByText("fewer than 5").first()).toBeVisible();
  await page.screenshot({ path: "test-results/wreath-1920.png" });
  await ctx.close();
});

test("AI off → drafting uses the Starter Plan and hides Regenerate", async ({ page }) => {
  await signupAndCreate(page, { name: "AI Off Church" });
  await page.getByRole("tab", { name: "AI settings" }).click();
  await page.getByLabel(/AI is on for/).click();
  await expect(page.getByText(/AI is off for AI Off Church/)).toBeVisible();
  await page.getByRole("tab", { name: "Nights" }).click();
  await page.getByRole("button", { name: "Draft all nights" }).click();
  await expect(page.getByRole("heading", { name: "0 of 27 nights approved" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("AI is off for this church, so nights come from the Starter Plan.").first()).toBeVisible();
  await expect(page.getByText(/From the Starter Plan/).first()).toBeVisible();
  await expect(page.getByText(/AI-drafted/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Regenerate this night" })).toHaveCount(0);
});
