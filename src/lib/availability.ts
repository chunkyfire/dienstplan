import { ROLE_ORDER, codeRank } from "@/lib/shifts";

export interface AvEntry { doctor: string; role: string; date: string; code: string; }
export type AvStatus = "available" | "partial" | "wish" | "blocked";
export interface Availability { doctor: string; role: string; status: AvStatus; reason?: string; }

const ABSENCE: Record<string, string> = {
  U: "Urlaub", K: "Krank", EZ: "Elternzeit", A: "Abwesend", PX: "FTU", Px: "FTU",
  FB: "Fortbildung", ST: "Studientag",
};
/** The medical director never steps in. */
const isChef = (role: string) => role === "Chefarzt";
/** Codes that leave the day free (person could jump in). */
const FREE = new Set(["DF", ""]);
const WISH = new Set(["X", "x"]);

export function roleRank(role: string): number {
  const i = (ROLE_ORDER as readonly string[]).indexOf(role);
  return i === -1 ? ROLE_ORDER.length : i;
}
export function bySeniority<T extends { doctor: string; role: string }>(a: T, b: T) {
  return roleRank(a.role) - roleRank(b.role) || a.doctor.localeCompare(b.doctor, "de");
}
/** Seniority first, then shift code (Z → Z1 → Z2), then name. */
export function bySeniorityThenCode<T extends { doctor: string; role: string; code: string }>(a: T, b: T) {
  return roleRank(a.role) - roleRank(b.role) || codeRank(a.code) - codeRank(b.code) || a.doctor.localeCompare(b.doctor, "de");
}

function prevDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}
function parts(code: string) { return code.split(/[+/]/).map(p => p.trim()).filter(Boolean); }

/** Rest-time check based on the previous day's shift (11 h rule). */
function restFromPrev(code: string | undefined): { status: AvStatus; reason: string } | null {
  if (!code) return null;
  const p = parts(code);
  if (p.includes("N")) return { status: "blocked", reason: "nach Nacht" };
  if (p.some(x => x === "NEF24" || x === "WNEF24")) return { status: "blocked", reason: "nach NEF24" };
  if (p.includes("S")) return { status: "partial", reason: "nur ab Mittag (nach Spät)" };
  return null;
}

/** Availability of everyone who is not on a working shift on `date`. */
export function availabilityFor(date: string, entries: AvEntry[], doctors: Record<string, string>): Availability[] {
  const month = date.slice(0, 7);
  const prev = prevDay(date);
  const today = new Map<string, string>();
  const yesterday = new Map<string, string>();
  const inMonth = new Set<string>();
  for (const e of entries) {
    if (e.date.slice(0, 7) === month) inMonth.add(e.doctor);
    if (e.date === date) today.set(e.doctor, e.code);
    else if (e.date === prev) yesterday.set(e.doctor, e.code);
  }
  const out: Availability[] = [];
  for (const doctor of inMonth) {
    const role = doctors[doctor] ?? "Assistenzarzt";
    if (isChef(role)) continue;
    const code = today.get(doctor) ?? "";
    let res: Availability | null = null;
    if (WISH.has(code)) res = { doctor, role, status: "wish", reason: "Freiwunsch" };
    else if (ABSENCE[code]) res = { doctor, role, status: "blocked", reason: ABSENCE[code] };
    else if (FREE.has(code)) {
      const rest = restFromPrev(yesterday.get(doctor));
      res = rest ? { doctor, role, ...rest } : { doctor, role, status: "available" };
    }
    if (res) out.push(res);
  }
  const order: Record<AvStatus, number> = { available: 0, partial: 1, wish: 2, blocked: 3 };
  return out.sort((a, b) => order[a.status] - order[b.status] || bySeniority(a, b));
}
