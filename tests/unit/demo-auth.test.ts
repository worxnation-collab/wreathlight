import { describe, expect, it } from "vitest";
import { DEMO_CHURCH_ID, DEMO_EMAIL, DEMO_PASTOR, churchAllowedInDemoScope, ensureDemoPastor, pastorIsDemo } from "../../src/worker/demo";

describe("demo session church scope", () => {
  it("allows only churches flagged is_demo", () => {
    expect(churchAllowedInDemoScope(true)).toBe(true);
    expect(churchAllowedInDemoScope(false)).toBe(false);
    expect(churchAllowedInDemoScope(0 as unknown as boolean)).toBe(false);
  });
});

function memoryDb() {
  const pastors = new Map<string, { id: string; email: string; pw_hash: string; pw_salt: string; display_name: string }>();
  const admins: { church_id: string; pastor_id: string; role: string }[] = [];
  const churches = [{ id: DEMO_CHURCH_ID, is_demo: 1 }];
  const api = {
    prepare(sql: string) {
      const binds: unknown[] = [];
      const stmt = {
        bind(...params: unknown[]) { binds.push(...params); return stmt; },
        async first<T>(): Promise<T | null> {
          if (sql.includes("FROM pastors WHERE email")) {
            return ([...pastors.values()].find((p) => p.email === binds[0]) as T) ?? null;
          }
          if (sql.includes("FROM pastors WHERE id")) {
            return (pastors.get(String(binds[0])) as T) ?? null;
          }
          return null;
        },
        async run() {
          if (sql.startsWith("INSERT INTO pastors")) {
            const [id, email, pw_hash, pw_salt, display_name] = binds as string[];
            pastors.set(id, { id, email, pw_hash, pw_salt, display_name });
          }
          if (sql.startsWith("INSERT OR IGNORE INTO church_admins")) {
            const [churchId, pastorId] = binds as string[];
            const church = churches.find((c) => c.id === churchId && c.id === binds[2] && c.is_demo === 1);
            if (church && !admins.some((a) => a.church_id === churchId && a.pastor_id === pastorId)) {
              admins.push({ church_id: churchId, pastor_id: pastorId, role: "owner" });
            }
          }
          return { success: true };
        },
      };
      return stmt;
    },
  };
  return { api: api as unknown as D1Database, pastors, admins };
}

describe("ensureDemoPastor", () => {
  it("creates the demo pastor once, with a stored hash, and links only the demo church", async () => {
    const db = memoryDb();
    const id = await ensureDemoPastor(db.api);
    const again = await ensureDemoPastor(db.api);
    expect(again).toBe(id);
    expect(db.pastors.size).toBe(1);
    const p = [...db.pastors.values()][0]!;
    expect(p.email).toBe(DEMO_EMAIL);
    expect(p.display_name).toBe(DEMO_PASTOR);
    expect(p.pw_hash).toMatch(/^pbkdf2-sha256\$/);
    expect(p.pw_salt).toMatch(/^[0-9a-f]+$/);
    expect(db.admins).toEqual([{ church_id: DEMO_CHURCH_ID, pastor_id: id, role: "owner" }]);
    expect(await pastorIsDemo(db.api, id)).toBe(true);
    expect(await pastorIsDemo(db.api, "someone-else")).toBe(false);
  });

  it("does not replace an existing demo password hash", async () => {
    const db = memoryDb();
    const first = await ensureDemoPastor(db.api);
    const hash = db.pastors.get(first)!.pw_hash;
    const salt = db.pastors.get(first)!.pw_salt;
    await ensureDemoPastor(db.api);
    expect(db.pastors.get(first)!.pw_hash).toBe(hash);
    expect(db.pastors.get(first)!.pw_salt).toBe(salt);
  });
});
