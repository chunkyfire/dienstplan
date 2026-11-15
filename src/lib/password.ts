/** PBKDF2 via WebCrypto so the same code runs in Node and on the edge runtime. */
const ITERATIONS = 100_000;
const enc = new TextEncoder();
const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) => new Uint8Array((s.match(/../g) ?? []).map(x => parseInt(x, 16)));

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
}
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${hex(salt)}$${hex(await derive(password, salt, ITERATIONS))}`;
}
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const [scheme, iter, salt, hash] = (stored ?? "").split("$");
  if (scheme !== "pbkdf2" || !salt || !hash) return false;
  const got = await derive(password, unhex(salt), Number(iter));
  const want = unhex(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}
/** Readable one-time code without look-alike characters. */
export function newInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), b => alphabet[b % alphabet.length]).join("");
}
export const MIN_PASSWORD = 8;
