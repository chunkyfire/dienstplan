/** All data lives behind one endpoint in the Supabase project; the browser only holds a signed session token. */
const API: string = import.meta.env.VITE_API_URL ?? "https://tpbrtxzmxosgxerptkef.supabase.co/functions/v1/dienstplan";
const KEY = "dienstplan-session";

export class LockedError extends Error {}

function readToken(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function storeToken(token: string) {
  try { if (token) localStorage.setItem(KEY, token); else localStorage.removeItem(KEY); } catch { /* private mode: the session then lasts until the tab closes */ }
  memory = token || null;
}
let memory: string | null = readToken();

let locked = false;
const lockListeners = new Set<() => void>();
export const isLocked = () => locked;
export function setLocked(value: boolean) {
  if (locked === value) return;
  locked = value;
  lockListeners.forEach(l => l());
}
export function onLockChange(listener: () => void) {
  lockListeners.add(listener);
  return () => { lockListeners.delete(listener); };
}

export async function call<T>(action: string, data?: unknown): Promise<T> {
  let reply: { ok: boolean; result?: T; error?: string; code?: string; token?: string };
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(memory ? { "x-dp-session": memory } : {}) },
      body: JSON.stringify({ action, data }),
    });
    reply = await res.json();
  } catch {
    throw new Error("Keine Verbindung zum Server");
  }
  if (reply.token !== undefined) storeToken(reply.token);
  if (!reply.ok) {
    if (reply.code === "locked") { setLocked(true); throw new LockedError(reply.error); }
    throw new Error(reply.error ?? "Das hat nicht geklappt");
  }
  return reply.result as T;
}
