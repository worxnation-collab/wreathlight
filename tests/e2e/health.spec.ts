import { expect, test } from "@playwright/test";

test("worker health route responds", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.app).toBe("Wreathlight");
});
