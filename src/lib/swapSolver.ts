import { checkAround, isWorking, UNAVAILABLE } from "@/lib/arbzg";
import { roleRank } from "@/lib/availability";

export interface SEntry { doctor: string; role: string; date: string; code: string; }
export interface Outage { date: string; code: string; doctor?: string; }
export interface Move { doctor: string; role: string; date: string; from: string; to: string; }
export type SolutionType = "direct" | "sameDay" | "twoDay" | "ring";
export interface Solution { type: SolutionType; moves: Move[]; warnings: string[]; score: number; call: string[]; }

/** The medical director never steps in. */
const isChef = (doctors: Record<string, string>, doc: string) => doctors[doc] === "Chefarzt";
const FREE = new Set(["", "DF"]);
const SLOT_CODES = new Set(["F", "Z", "Z1", "Z2", "S", "N", "NEF1", "NEF3", "NEF24", "WNEF24", "F+NEF24", "TNA"]);
export const TYPE_LABEL: Record<SolutionType, string> = {
  direct: "Direkter Ersatz", sameDay: "Tausch am selben Tag", twoDay: "Tausch zwischen zwei Tagen", ring: "Ringtausch",
};
const BASE: Record<SolutionType, number> = { direct: 0, sameDay: 100, twoDay: 200, ring: 300 };
const PER_TYPE = 5;

export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
const isNef = (c: string) => /NEF|TNA/.test(c);

export type Exclude = (doc: string, date: string, code: string) => boolean;
export function solveOutage(entries: SEntry[], doctors: Record<string, string>, outage: Outage, exclude?: Exclude): Solution[] {
  const { date: D } = outage;
  const C = outage.code;
  const plan = new Map<string, Map<string, string>>();
  const nefDocs = new Set<string>();
  const month = D.slice(0, 7);
  const pool = new Set<string>();
  for (const e of entries) {
    if (!plan.has(e.doctor)) plan.set(e.doctor, new Map());
    plan.get(e.doctor)!.set(e.date, e.code);
    if (isNef(e.code)) nefDocs.add(e.doctor);
    if (e.date.slice(0, 7) === month && !isChef(doctors, e.doctor)) pool.add(e.doctor);
  }
  if (outage.doctor) { pool.delete(outage.doctor); plan.get(outage.doctor)?.set(D, ""); }

  const role = (d: string) => doctors[d] ?? "Assistenzarzt";
  const code = (doc: string, d: string) => plan.get(doc)?.get(d) ?? "";
  const neededRole = outage.doctor ? role(outage.doctor) : "Assistenzarzt";

  const eligible = (doc: string, slotCode: string, slotRole: string) =>
    !isChef(doctors, doc) && roleRank(role(doc)) <= roleRank(slotRole) && (!isNef(slotCode) || nefDocs.has(doc));
  const isFree = (doc: string, d: string) => FREE.has(code(doc, d));
  const unavailable = (doc: string, d: string) => UNAVAILABLE[code(doc, d)];

  const tryPlan = (doc: string, changes: Record<string, string>) =>
    checkAround(d => (d in changes ? changes[d] : code(doc, d)), Object.keys(changes), addDays);

  const rd = (doc: string, slotRole: string) => roleRank(slotRole) - roleRank(role(doc));
  const mv = (doc: string, d: string, to: string): Move => ({ doctor: doc, role: role(doc), date: d, from: code(doc, d) || "frei", to: to || "frei" });

  /** Best free stand-in for `slot` on `d`, excluding `skip`. */
  const freeStandIn = (d: string, slot: string, slotRole: string, skip: Set<string>) => {
    let best: { doc: string; warnings: string[]; s: number } | null = null;
    for (const f of pool) {
      if (skip.has(f) || !isFree(f, d) || !eligible(f, slot, slotRole)) continue;
      const r = tryPlan(f, { [d]: slot });
      if (!r.ok) continue;
      const s = rd(f, slotRole) * 3 + r.warnings.length;
      if (!best || s < best.s) best = { doc: f, warnings: r.warnings, s };
    }
    return best;
  };

  const out: Solution[] = [];
  const push = (type: SolutionType, moves: Move[], warnings: string[], extra: number) => {
    if (exclude && moves.some(m => m.to !== "frei" && exclude(m.doctor, m.date, m.to))) return;
    out.push({ type, moves, warnings: [...new Set(warnings)], score: BASE[type] + extra, call: [...new Set(moves.map(m => m.doctor))] });
  };

  const sorted = [...pool].sort((a, b) => rd(a, neededRole) - rd(b, neededRole) || a.localeCompare(b, "de"));
  const neighbours = [addDays(D, -1), addDays(D, 1)];

  for (const a of sorted) {
    if (!eligible(a, C, neededRole) || unavailable(a, D)) continue;
    const aCode = code(a, D);
    // 1) direct
    if (isFree(a, D)) {
      const r = tryPlan(a, { [D]: C });
      if (r.ok) { push("direct", [mv(a, D, C)], r.warnings, rd(a, neededRole) * 3 + r.warnings.length); continue; }
      // 3) two-day swap / 4) ring: free a is blocked by a neighbouring shift
      for (const d2 of neighbours) {
        const x = code(a, d2);
        if (!SLOT_CODES.has(x)) continue;
        const ra = tryPlan(a, { [D]: C, [d2]: "" });
        if (!ra.ok) continue;
        const b = freeStandIn(d2, x, role(a), new Set([a]));
        if (b) {
          push("twoDay", [mv(a, D, C), { ...mv(a, d2, ""), from: x }, mv(b.doc, d2, x)], [...ra.warnings, ...b.warnings], rd(a, neededRole) * 3 + b.s);
          continue;
        }
        for (const bDoc of pool) {
          if (bDoc === a || !isFree(bDoc, d2) || !eligible(bDoc, x, role(a))) continue;
          for (const d3 of [addDays(d2, -1), addDays(d2, 1)]) {
            if (d3 === D) continue;
            const y = code(bDoc, d3);
            if (!SLOT_CODES.has(y)) continue;
            const rb = tryPlan(bDoc, { [d2]: x, [d3]: "" });
            if (!rb.ok) continue;
            const c = freeStandIn(d3, y, role(bDoc), new Set([a, bDoc]));
            if (!c) continue;
            push("ring", [mv(a, D, C), { ...mv(a, d2, ""), from: x }, mv(bDoc, d2, x), { ...mv(bDoc, d3, ""), from: y }, mv(c.doc, d3, y)],
              [...ra.warnings, ...rb.warnings, ...c.warnings], rd(a, neededRole) * 3 + c.s);
          }
        }
      }
    } else if (SLOT_CODES.has(aCode) && aCode !== C && isWorking(aCode)) {
      // 2) same-day: a moves from aCode to C, a free person fills aCode
      const r = tryPlan(a, { [D]: C });
      if (!r.ok) continue;
      const f = freeStandIn(D, aCode, role(a), new Set([a]));
      if (f) push("sameDay", [{ ...mv(a, D, C), from: aCode }, mv(f.doc, D, aCode)], [...r.warnings, ...f.warnings], rd(a, neededRole) * 3 + f.s);
    }
  }

  const res: Solution[] = [];
  for (const t of ["direct", "sameDay", "twoDay", "ring"] as SolutionType[]) {
    res.push(...out.filter(s => s.type === t).sort((a, b) => a.score - b.score).slice(0, PER_TYPE));
  }
  return res;
}

export function describeSolution(s: Solution): string {
  return `${TYPE_LABEL[s.type]}: ` + s.moves.map(m => `${m.doctor} (${m.role}) ${m.date}: ${m.from} → ${m.to}`).join("; ")
    + (s.warnings.length ? ` [${s.warnings.join(", ")}]` : "");
}
