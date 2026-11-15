import type { ParsedSchedule, ScheduleEntry } from "@/lib/parseSchedulePdf";

export interface ScheduleData {
  entries: ScheduleEntry[];
  doctors: Record<string, string>;
  imports: ImportInfo[];
  /** Position in the stand-in list per name; lower steps in first. */
  standby: Record<string, number>;
}

export interface StaffInfo { name: string; role: string; active: boolean; standbyPos: number; }

export interface ImportInfo {
  key: string; // "2026-11"
  monthLabel: string;
  importedAt: string;
  count: number;
}

export interface StoredImport {
  key: string;
  monthLabel: string;
  importedAt: string;
  entries: ScheduleEntry[];
  doctors: Record<string, string>;
}

export interface BaseSchedule {
  entries: ScheduleEntry[];
  doctors: Record<string, string>;
  imports?: StoredImport[];
  /** Central staff list: its levels win over whatever a printed plan says. */
  staff?: StaffInfo[];
  me?: { id: string; name: string; role: string; isPlanner: boolean } | null;
  draftKeys?: string[];
}

export function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Uploaded months replace the same month of the built-in plan. */
export function mergeSchedule(base: BaseSchedule): ScheduleData {
  const stored = base.imports ?? [];
  const replaced = new Set(stored.map(s => s.key));
  const entries = base.entries.filter(e => !replaced.has(e.date.slice(0, 7))).map(e => ({ ...e }));
  const doctors = { ...base.doctors };
  for (const imp of stored) {
    Object.assign(doctors, imp.doctors);
    entries.push(...imp.entries.map(e => ({ ...e })));
  }
  const standby: Record<string, number> = {};
  for (const s of base.staff ?? []) {
    doctors[s.name] = s.role;
    if (s.active) standby[s.name] = s.standbyPos;
  }
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.doctor.localeCompare(b.doctor));
  for (const e of entries) e.role = doctors[e.doctor] ?? e.role;
  return {
    entries,
    doctors,
    standby,
    imports: stored
      .map(s => ({ key: s.key, monthLabel: s.monthLabel, importedAt: s.importedAt, count: s.entries.length }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  };
}

export function toStoredImport(parsed: ParsedSchedule): StoredImport {
  return {
    key: monthKey(parsed.year, parsed.month),
    monthLabel: parsed.monthLabel,
    importedAt: new Date().toISOString(),
    entries: parsed.entries,
    doctors: parsed.doctors,
  };
}
