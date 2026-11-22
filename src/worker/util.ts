const enc = new TextEncoder();

export function uuid(): string {
  return crypto.randomUUID();
}
export function nowIso(): string {
  return new Date().toISOString();
}
export function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function sha256Hex(s: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}
export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
export async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
// 6-char church code, no ambiguous letters (no 0/O, 1/I/L)
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function churchCode(): string {
  const r = crypto.getRandomValues(new Uint8Array(6));
  return [...r].map((x) => CODE_ALPHABET[x % CODE_ALPHABET.length]).join("");
}
/** Stable JSON (sorted keys) for content hashing. */
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(stableJson).join(",") + "]";
  if (v && typeof v === "object")
    return "{" + Object.keys(v as object).sort().map((k) => JSON.stringify(k) + ":" + stableJson((v as any)[k])).join(",") + "}";
  return JSON.stringify(v ?? null);
}
