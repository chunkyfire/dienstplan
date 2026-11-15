export type WishKind = "frei" | "abwesend" | "dienst" | "kein";
export interface WishCode { code: string; label: string; kind: WishKind; }

/** "!S" means "not this shift"; everything else is a positive wish or an absence. */
export const WISH_CODES: WishCode[] = [
  { code: "X", label: "Wunschfrei", kind: "frei" },
  { code: "U", label: "Urlaub", kind: "abwesend" },
  { code: "FB", label: "Fortbildung", kind: "abwesend" },
  { code: "F", label: "Früh", kind: "dienst" },
  { code: "Z", label: "Zwischen", kind: "dienst" },
  { code: "S", label: "Spät", kind: "dienst" },
  { code: "N", label: "Nacht", kind: "dienst" },
  { code: "!S", label: "kein Spät", kind: "kein" },
  { code: "!N", label: "keine Nacht", kind: "kein" },
];
const BY_CODE = new Map(WISH_CODES.map(w => [w.code, w]));
export const isWishCode = (code: string) => BY_CODE.has(code);
export const wishMeta = (code: string) => BY_CODE.get(code);

export interface WishRow { staffId: string; date: string; code: string; note?: string | null; }
export interface DayHint { frei: number; abwesend: number; dienst: Record<string, number>; }
export interface Person { id: string; name: string; role: string; }

/** Below this many colleagues on the same level a count would point at a person, so no hint is given. */
export const MIN_GROUP_FOR_HINTS = 3;

/**
 * What the others on my level asked for, as counts only. Names never leave the server:
 * this runs there and only its result is sent to the browser.
 */
export function hintsFor(wishes: WishRow[], people: Person[], me: Person): { hints: Record<string, DayHint>; group: number } {
  const peers = new Set(people.filter(p => p.role === me.role && p.id !== me.id).map(p => p.id));
  if (peers.size < MIN_GROUP_FOR_HINTS) return { hints: {}, group: peers.size };
  const hints: Record<string, DayHint> = {};
  for (const w of wishes) {
    if (!peers.has(w.staffId)) continue;
    const kind = BY_CODE.get(w.code)?.kind;
    if (!kind || kind === "kein") continue;
    const h = (hints[w.date] ??= { frei: 0, abwesend: 0, dienst: {} });
    if (kind === "frei") h.frei++;
    else if (kind === "abwesend") h.abwesend++;
    else h.dienst[w.code] = (h.dienst[w.code] ?? 0) + 1;
  }
  return { hints, group: peers.size };
}

export type HintLevel = "none" | "some" | "tight";
/** "tight" once a third of the level (at least two people) is already off that day. */
export function hintLevel(h: DayHint | undefined, group: number): HintLevel {
  const off = h ? h.frei + h.abwesend : 0;
  if (!off) return "none";
  return off >= Math.max(2, Math.ceil(group / 3)) ? "tight" : "some";
}
export function hintText(h: DayHint | undefined, myCode?: string): string[] {
  if (!h) return [];
  const out: string[] = [];
  if (h.abwesend) out.push(h.abwesend === 1 ? "1 Urlaub/Fortbildung" : `${h.abwesend}× Urlaub/Fortbildung`);
  if (h.frei) out.push(h.frei === 1 ? "1 weiterer Freiwunsch" : `${h.frei} weitere Freiwünsche`);
  const same = myCode ? h.dienst[myCode] : 0;
  if (same) out.push(same === 1 ? `1 weiterer Wunsch ${myCode}` : `${same} weitere Wünsche ${myCode}`);
  return out;
}

type SkillWish =
  | { typ: "urlaub" | "frei" | "fortbildung"; tage: number[] }
  | { typ: "vorbelegung" | "kein"; tag: number; code: string };

/** Wishes of one month in the format the roster generator reads (`wuensche-<monat>.json`). */
export function buildWuensche(wishes: WishRow[], people: Person[], month: string): Record<string, SkillWish[]> {
  const name = new Map(people.map(p => [p.id, p.name]));
  const out: Record<string, SkillWish[]> = {};
  const ranges = new Map<string, number[]>();
  const sorted = wishes.filter(w => w.date.startsWith(month) && name.has(w.staffId)).sort((a, b) => a.date.localeCompare(b.date));
  for (const w of sorted) {
    const who = name.get(w.staffId)!;
    const day = Number(w.date.slice(8, 10));
    const list = (out[who] ??= []);
    const typ = w.code === "U" ? "urlaub" : w.code === "X" ? "frei" : w.code === "FB" ? "fortbildung" : null;
    if (typ) {
      const key = `${who}|${typ}`;
      let tage = ranges.get(key);
      if (!tage) { tage = []; ranges.set(key, tage); list.push({ typ, tage }); }
      tage.push(day);
    } else if (w.code.startsWith("!")) list.push({ typ: "kein", tag: day, code: w.code.slice(1) });
    else list.push({ typ: "vorbelegung", tag: day, code: w.code });
  }
  return out;
}

export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Last seven days of the previous month per person, oldest first (month hand-over for the generator). */
export function buildUebergabe(entries: { doctor: string; date: string; code: string }[], month: string) {
  const source = prevMonth(month);
  const n = daysInMonth(source);
  const tailDates = Array.from({ length: 7 }, (_, i) => `${source}-${String(n - 6 + i).padStart(2, "0")}`);
  const index = new Map(tailDates.map((d, i) => [d, i]));
  const tail: Record<string, string[]> = {};
  for (const e of entries) {
    const i = index.get(e.date);
    if (i === undefined) continue;
    (tail[e.doctor] ??= Array(7).fill(""))[i] = e.code === "DF" ? "" : e.code;
  }
  return { for_month: month, source_month: source, tail_dates: tailDates, tail, complete: Object.keys(tail).length > 0 };
}
