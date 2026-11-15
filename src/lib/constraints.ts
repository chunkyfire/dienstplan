import { addDays, solveOutage, describeSolution, type SEntry } from "@/lib/swapSolver";
import { isWorking } from "@/lib/arbzg";

const norm = (s: string) => s.toLowerCase()
  .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
/** phonetic-ish: treat oe/ue/u/i/ie/y alike, drop trailing s/h, collapse doubles */
const sound = (s: string) => norm(s).replace(/oe|ue|ü|u|y/g, "u").replace(/ie|i/g, "i").replace(/ch|g|k/g, "k").replace(/ng/g, "k").replace(/(.)\1+/g, "$1").replace(/[sh]+$/, "");

function lev(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Best matching doctor names for a spoken/typed name (closest first). */
export function resolveDoctor(input: string, names: string[]): string[] {
  const q = sound(input), qn = norm(input);
  const scored = names.map(n => {
    const first = n.split(" ")[0];
    if (norm(first) === qn || norm(n) === qn) return { n, s: -1 };
    return { n, s: Math.min(lev(sound(first), q), lev(norm(first), qn)) };
  }).filter(x => x.s <= Math.max(2, Math.floor(q.length / 3))).sort((a, b) => a.s - b.s);
  if (!scored.length) return [];
  return scored.filter(x => x.s === scored[0].s).map(x => x.n);
}

export interface Rule { doctor: string; noCodes?: string[]; noWeekend?: boolean; noDates?: string[]; }

const isWeekend = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return w === 0 || w === 6; };
const codeMatches = (code: string, list: string[]) => code.split(/[+/]/).some(p => list.some(c => p.trim().toUpperCase() === c.toUpperCase()));

export function breaks(rule: Rule, date: string, code: string) {
  if (!isWorking(code)) return false;
  if (rule.noCodes?.length && codeMatches(code, rule.noCodes)) return true;
  if (rule.noWeekend && isWeekend(date)) return true;
  if (rule.noDates?.includes(date)) return true;
  return false;
}

/** Find shifts in [start,end] that violate rules and solve each with the rules applied to stand-ins too. */
export function checkConstraints(entries: SEntry[], doctors: Record<string, string>, start: string, end: string, rules: Rule[]) {
  const exclude = (doc: string, date: string, code: string) => rules.some(r => r.doctor === doc && breaks(r, date, code));
  const conflicts = entries.filter(e => e.date >= start && e.date <= end && rules.some(r => r.doctor === e.doctor && breaks(r, e.date, e.code)))
    .sort((a, b) => a.date.localeCompare(b.date));
  return conflicts.map(c => ({ conflict: c, solutions: solveOutage(entries, doctors, { date: c.date, code: c.code, doctor: c.doctor }, exclude) }));
}

export function weekTable(entries: SEntry[], start: string) {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const list = entries.filter(e => e.date === d && e.code).map(e => `${e.doctor}(${e.role[0]}):${e.code}`);
    out.push(`${d}${isWeekend(d) ? " WE" : ""}: ${list.join(", ") || "-"}`);
  }
  return out.join("\n");
}

export function describeConstraints(res: ReturnType<typeof checkConstraints>) {
  if (!res.length) return "Keine Dienste in diesem Zeitraum verstoßen gegen die Vorgaben.";
  return res.map(r => `KONFLIKT ${r.conflict.date} ${r.conflict.doctor} ${r.conflict.code}:\n` +
    (r.solutions.length ? r.solutions.slice(0, 6).map(s => "  - " + describeSolution(s)).join("\n") : "  keine regelkonforme Lösung")).join("\n");
}
