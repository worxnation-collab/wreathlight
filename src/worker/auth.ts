import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "./env";
import { b64url, fromB64url, hmac, sha256Hex, timingSafeEqual, toHex } from "./util";

// Cloudflare Workers caps PBKDF2 at 100,000 iterations (higher counts throw), so we use the maximum allowed.
export const PBKDF2_ITERATIONS = 100_000;
const SESSION_COOKIE = "wl_session";
const SESSION_DAYS = 14;

export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? Uint8Array.from(saltHex.match(/../g)!.map((h) => parseInt(h, 16))) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return { hash: toHex(bits), salt: toHex(salt.buffer as ArrayBuffer) };
}
export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const h = await hashPassword(password, salt);
  return timingSafeEqual(h.hash, hash);
}

function secret(env: Env): string {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 16) throw new Error("SESSION_SECRET is not configured");
  return env.SESSION_SECRET;
}
export async function startSession(c: Context<{ Bindings: Env }>, pastorId: string) {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ pid: pastorId, exp: Date.now() + SESSION_DAYS * 86400000 })));
  const sig = await hmac(secret(c.env), payload);
  const secure = new URL(c.req.url).protocol === "https:";
  setCookie(c, SESSION_COOKIE, `${payload}.${sig}`, {
    httpOnly: true, secure, sameSite: "Lax", path: "/", maxAge: SESSION_DAYS * 86400,
  });
}
export function endSession(c: Context<{ Bindings: Env }>) {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}
export async function sessionPastorId(c: Context<{ Bindings: Env }>): Promise<string | null> {
  const raw = getCookie(c, SESSION_COOKIE);
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expect = await hmac(secret(c.env), payload);
  if (!timingSafeEqual(expect, sig)) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (typeof p.pid !== "string" || p.exp < Date.now()) return null;
    return p.pid;
  } catch {
    return null;
  }
}

/** Daily-salted IP hash: SHA-256(ip + DAILY_SALT), DAILY_SALT derived from SESSION_SECRET + date. Raw IPs are never stored. */
export async function ipHash(c: Context<{ Bindings: Env }>): Promise<string> {
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
