/** Signed session token (HMAC-SHA256). It lives in the browser and is sent with every request. */
export interface Session { unlocked: boolean; staffId?: string; exp: number; }

const enc = new TextEncoder();
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
export const SESSION_DAYS = 30;

async function mac(secret: string, text: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
}
export async function signSession(secret: string, s: Omit<Session, "exp">, now = Date.now()): Promise<string> {
  const body = b64(enc.encode(JSON.stringify({ ...s, exp: now + SESSION_DAYS * 86_400_000 })));
  return `${body}.${b64(await mac(secret, body))}`;
}
export async function readSession(secret: string, token: string | null | undefined, now = Date.now()): Promise<Session | null> {
  const [body, sig] = (token ?? "").split(".");
  if (!body || !sig) return null;
  try {
    const want = await mac(secret, body);
    const got = unb64(sig);
    if (got.length !== want.length) return null;
    let diff = 0;
    for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
    if (diff) return null;
    const s = JSON.parse(new TextDecoder().decode(unb64(body))) as Session;
    return s.unlocked && s.exp > now ? s : null;
  } catch {
    return null;
  }
}
