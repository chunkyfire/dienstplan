export function dateFromISO(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
export function isoFromDateUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(iso: string, n: number): string {
  const d = dateFromISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return isoFromDateUTC(d);
}
export function localTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoFromDateUTC(new Date(Date.UTC(year, month - 1, day)));
}
export function nrwHolidayName(iso: string): string | null {
  const year = Number(iso.slice(0, 4));
  const easter = easterSunday(year);
  const holidays: Record<string, string> = {
    [`${year}-01-01`]: "Neujahr",
    [`${year}-05-01`]: "Tag der Arbeit",
    [`${year}-10-03`]: "Tag der Deutschen Einheit",
    [`${year}-11-01`]: "Allerheiligen",
    [`${year}-12-25`]: "1. Weihnachtstag",
    [`${year}-12-26`]: "2. Weihnachtstag",
    [addDays(easter, -2)]: "Karfreitag",
    [addDays(easter, 1)]: "Ostermontag",
    [addDays(easter, 39)]: "Christi Himmelfahrt",
    [addDays(easter, 50)]: "Pfingstmontag",
    [addDays(easter, 60)]: "Fronleichnam",
  };
  return holidays[iso] ?? null;
}
export function dayFlags(iso: string) {
  const day = dateFromISO(iso).getUTCDay();
  return { isWeekend: day === 0 || day === 6, holidayName: nrwHolidayName(iso) };
}
