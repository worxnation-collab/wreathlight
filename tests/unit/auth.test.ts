import { describe, expect, it } from "vitest";
import { hashPassword, PBKDF2_ITERATIONS, verifyPassword } from "../../src/worker/auth";

describe("password hashing", () => {
  it("stores the round count with the hash and verifies it", async () => {
    const { hash, salt } = await hashPassword("correct horse battery");
    expect(hash).toMatch(new RegExp(`^pbkdf2-sha256\\$${PBKDF2_ITERATIONS}\\$[0-9a-f]{64}$`));
    expect(await verifyPassword("correct horse battery", hash, salt)).toBe(true);
    expect(await verifyPassword("wrong password here", hash, salt)).toBe(false);
  });

  it("stays within the Workers PBKDF2 cap and the free-plan CPU budget", () => {
    expect(PBKDF2_ITERATIONS).toBeLessThanOrEqual(50_000);
  });

  it("rejects round counts above the Workers cap instead of throwing", async () => {
    const { salt } = await hashPassword("x".repeat(12));
    expect(await verifyPassword("x".repeat(12), `pbkdf2-sha256$400000$${"0".repeat(64)}`, salt)).toBe(false);
  });
});
