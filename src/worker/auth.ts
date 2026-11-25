import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "./env";
import { b64url, fromB64url, hmac, sha256Hex, timingSafeEqual, toHex } from "./util";

// PBKDF2-SHA256 via Web Crypto (native code, but it still counts toward the Worker's CPU time).
// Workers caps iterations at 100,000 (higher counts throw). Measured 2026-11-22: 100,000 rounds cost about
// 12-13 ms of CPU, above the free plan's 10 ms per-request budget, so logins risked error 1102 under load.
// 50,000 rounds is about 6 ms, leaving headroom for the rest of the request. Pastor logins are also
// rate-limited (5 tries per 15 minutes per email + IP hash). The round count is stored with each hash
// ("pbkdf2-sha256$<rounds>$<hex>"), so it can be raised later (e.g. on a paid plan) without breaking logins.
export const PBKDF2_ITERATIONS = 50_000;
const LEGACY_ITERATIONS = 100_000; // bare-hex hashes written before the round count was stored
const SESSION_COOKIE = "wl_session";
const SESSION_DAYS = 14;

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return toHex(bits);
}
export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? Uint8Array.from(saltHex.match(/../g)!.map((h) => parseInt(h, 16))) : crypto.getRandomValues(new Uint8Array(16));
  const hex = await derive(password, salt, PBKDF2_ITERATIONS);
  return { hash: `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${hex}`, salt: toHex(salt.buffer as ArrayBuffer) };
}
export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const m = /^pbkdf2-sha256\$(\d+)\$([0-9a-f]+)$/.exec(hash);
  const rounds = m ? parseInt(m[1]!, 10) : LEGACY_ITERATIONS;
  const expected = m ? m[2]! : hash;
  if (!(rounds > 0 && rounds <= 100_000)) return false;
  const saltBytes = Uint8Array.from(salt.match(/../g)!.map((h) => parseInt(h, 16)));
  return timingSafeEqual(await derive(password, saltBytes, rounds), expected);
}

function secret(env: Env): string {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 16) throw new Error("SESSION_SECRET is not configured");
  return env.SESSION_SECRET;
}
export async function startSession(c: Context<{ Bindings: Env; Variables: any }>, pastorId: string, opts?: { demo?: boolean }) {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({
    pid: pastorId, exp: Date.now() + SESSION_DAYS * 86400000, ...(opts?.demo ? { demo: true } : {}),
  })));
  const sig = await hmac(secret(c.env), payload);
  const secure = new URL(c.req.url).protocol === "https:";
  setCookie(c, SESSION_COOKIE, `${payload}.${sig}`, {
    httpOnly: true, secure, sameSite: "Lax", path: "/", maxAge: SESSION_DAYS * 86400,
  });
}
export function endSession(c: Context<{ Bindings: Env; Variables: any }>) {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}
export async function sessionInfo(c: Context<{ Bindings: Env; Variables: any }>): Promise<{ pastorId: string; demo: boolean } | null> {
  const raw = getCookie(c, SESSION_COOKIE);
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expect = await hmac(secret(c.env), payload);
  if (!timingSafeEqual(expect, sig)) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (typeof p.pid !== "string" || p.exp < Date.now()) return null;
    return { pastorId: p.pid, demo: p.demo === true };
  } catch {
    return null;
  }
}
export async function sessionPastorId(c: Context<{ Bindings: Env; Variables: any }>): Promise<string | null> {
  return (await sessionInfo(c))?.pastorId ?? null;
}

/** Daily-salted IP hash: SHA-256(ip + DAILY_SALT), DAILY_SALT derived from SESSION_SECRET + date. Raw IPs are never stored. */
export async function ipHash(c: Context<{ Bindings: Env; Variables: any }>): Promise<string> {
  const ip = c.req.header("cf-connecting-ip") ?? "local";
  const day = new Date().toISOString().slice(0, 10);
  const dailySalt = await sha256Hex(secret(c.env) + day);
  return sha256Hex(ip + dailySalt);
}

/** Fixed-window counter in D1. Returns false when the limit is exceeded. */
export async function rateLimit(db: D1Database, key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const row = await db.prepare("SELECT count, window_start FROM rate WHERE key = ?").bind(key).first<{ count: number; window_start: string }>();
  if (!row || now - Date.parse(row.window_start) > windowMs) {
    await db.prepare("INSERT INTO rate (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start")
      .bind(key, new Date(now).toISOString()).run();
    return true;
  }
  if (row.count >= limit) return false;
  await db.prepare("UPDATE rate SET count = count + 1 WHERE key = ?").bind(key).run();
  return true;
}
