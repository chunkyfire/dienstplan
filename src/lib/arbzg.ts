/** Working-time rules (Arbeitszeitgesetz) for shift swaps. Times in minutes from 00:00 of the shift day. */
export interface Interval { start: number; end: number; }

const T = (h: number, m = 0) => h * 60 + m;
const TIMES: Record<string, Interval> = {
  F: { start: T(7, 45), end: T(16, 15) },
  Z: { start: T(10), end: T(18, 30) },
  Z1: { start: T(9), end: T(17, 30) },
  Z2: { start: T(12), end: T(20, 30) },
  S: { start: T(15, 30), end: T(24) },
  N: { start: T(21), end: T(33) },
  NEF1: { start: T(7, 45), end: T(18, 30) },
  NEF3: { start: T(7, 45), end: T(16, 15) },
  NEF24: { start: T(7, 45), end: T(31, 45) },
  WNEF24: { start: T(7, 45), end: T(31, 45) },
  TNA: { start: T(8), end: T(16, 30) },
};
const DAYWORK = new Set(["E", "O", "UC", "FB", "ST", "NEF-E"]);
const NOT_WORK = new Set(["", "DF", "U", "X", "x", "K", "A", "EZ", "PX", "Px"]);
export const UNAVAILABLE: Record<string, string> = {
  U: "Urlaub", K: "Krank", EZ: "Elternzeit", A: "Abwesend", PX: "FTU", Px: "FTU", X: "Freiwunsch", x: "Freiwunsch",
};
export const MIN_REST = 11 * 60;
export const MAX_SHIFT = 24 * 60;

/** Merged working interval for a code, or null when the code is not work. */
export function intervalFor(code: string | undefined): Interval | null {
  if (!code || NOT_WORK.has(code)) return null;
  const parts = code.split(/[+/]/).map(p => p.trim()).filter(Boolean);
  let start = Infinity, end = -Infinity;
  for (const p of parts) {
    const t = TIMES[p] ?? (DAYWORK.has(p) ? { start: T(8), end: T(16, 30) } : null);
    if (!t) continue;
    start = Math.min(start, t.start); end = Math.max(end, t.end);
  }
  return start === Infinity ? null : { start, end };
}
export function isWorking(code: string | undefined) { return intervalFor(code) !== null; }
export function hoursOf(code: string | undefined) {
  const i = intervalFor(code); return i ? (i.end - i.start) / 60 : 0;
}

export interface RuleCheck { ok: boolean; reason?: string; warnings: string[]; }

/**
 * Check a doctor's plan around `dates` (each changed day) for rest-time and max-duration.
 * `codeAt(offset)` returns the code `offset` days relative to the given date.
 */
export function checkAround(codeAt: (date: string) => string | undefined, dates: string[], addDays: (d: string, n: number) => string): RuleCheck {
  const warnings: string[] = [];
  for (const d of dates) {
    const seq: Interval[] = [];
    for (let k = -1; k <= 1; k++) {
      const i = intervalFor(codeAt(addDays(d, k)));
      if (i) seq.push({ start: i.start + k * 1440, end: i.end + k * 1440 });
    }
    for (const i of seq) if (i.end - i.start > MAX_SHIFT) return { ok: false, reason: "über 24 h am Stück", warnings };
    for (let j = 1; j < seq.length; j++) {
      const gap = seq[j].start - seq[j - 1].end;
      if (gap < MIN_REST) return { ok: false, reason: `nur ${Math.max(0, Math.round(gap / 6) / 10)} h Ruhezeit`, warnings };
      if (gap < 12 * 60) warnings.push(`knapp: ${Math.round(gap / 6) / 10} h Ruhe`);
    }
  }
  return { ok: true, warnings: [...new Set(warnings)] };
}
