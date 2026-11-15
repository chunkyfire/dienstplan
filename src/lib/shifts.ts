export type ShiftKind =
  | "frueh" | "zwischen" | "spaet" | "nacht"
  | "nef" | "tna" | "off" | "other";

export interface ShiftMeta {
  code: string;
  label: string;
  time?: string;
  kind: ShiftKind;
  working: boolean;
}

export const SHIFTS: Record<string, ShiftMeta> = {
  F:        { code: "F",       label: "Frühdienst",        time: "07:45 – 16:15", kind: "frueh",    working: true },
  Z:        { code: "Z",       label: "Zwischendienst",    time: "10:00 – 18:30", kind: "zwischen", working: true },
  Z1:       { code: "Z1",      label: "Zwischendienst 1",  time: "09:00 – 17:30", kind: "zwischen", working: true },
  Z2:       { code: "Z2",      label: "Zwischendienst 2",  time: "12:00 – 20:30", kind: "zwischen", working: true },
  S:        { code: "S",       label: "Spätdienst",        time: "15:30 – 00:00", kind: "spaet",    working: true },
  N:        { code: "N",       label: "Nachtdienst",       time: "21:00 – 09:00", kind: "nacht",    working: true },
  NEF1:     { code: "NEF1",    label: "Notarzt NEF 1",     time: "07:45 – 18:30", kind: "nef",      working: true },
  NEF3:     { code: "NEF3",    label: "Notarzt NEF 3",     time: "07:45 – 16:15", kind: "nef",      working: true },
  NEF24:    { code: "NEF24",   label: "Notarzt NEF 24h",   time: "07:45 – 07:45", kind: "nef",      working: true },
  WNEF24:   { code: "WNEF24",  label: "Wochenend-NEF24",   time: "24 h",          kind: "nef",      working: true },
  "F+NEF24":{ code: "F+NEF24", label: "Früh + NEF24",      time: "Früh + 24h",    kind: "nef",      working: true },
  TNA:      { code: "TNA",     label: "Telenotarzt",       kind: "tna",      working: true },
  "NEF-E":  { code: "NEF-E",   label: "NEF-Einarbeitung",  kind: "nef",      working: true },
  E:        { code: "E",       label: "Einarbeitung",      kind: "other",    working: true },
  O:        { code: "O",       label: "Rotation (O)",      kind: "frueh",    working: true },
  UC:       { code: "UC",      label: "Rotation",          kind: "other",    working: true },
  FB:       { code: "FB",      label: "Fortbildung",       kind: "off",      working: false },
  ST:       { code: "ST",      label: "Studientag",        kind: "off",      working: false },
  PX:       { code: "PX",      label: "FTU",               kind: "off",      working: false },
  Px:       { code: "PX",      label: "FTU",               kind: "off",      working: false },
  DF:       { code: "DF",      label: "Dienstfrei",        kind: "off",      working: false },
  U:        { code: "U",       label: "Urlaub",            kind: "off",      working: false },
  X:        { code: "X",       label: "Frei / Ausschluss", kind: "off",      working: false },
  x:        { code: "x",       label: "Frei / Ausschluss", kind: "off",      working: false },
  K:        { code: "K",       label: "Krank",             kind: "off",      working: false },
  A:        { code: "A",       label: "Abwesend",          kind: "off",      working: false },
  EZ:       { code: "EZ",      label: "Elternzeit",        kind: "off",      working: false },
};

export function metaFor(code: string): ShiftMeta {
  if (SHIFTS[code]) return SHIFTS[code];
  // composite e.g. UC+NEF24, NEF24+NEF1
  const parts = code.split(/[+/]/);
  for (const p of parts) if (SHIFTS[p]) return { ...SHIFTS[p], code, label: code };
  return { code, label: code, kind: "other", working: true };
}

/**
 * All groups a code belongs to. "F+NEF24" = Frühdienst followed by a 24 h NEF shift,
 * so it must appear in both the Früh row and the Notarzt row.
 */
export function kindsFor(code: string): ShiftKind[] {
  const parts = code.split(/[+/]/).map(p => p.trim()).filter(Boolean);
  const kinds: ShiftKind[] = [];
  for (const p of parts) {
    const k = EARLY_EXTRA.has(p) ? "frueh" : p === "TNA" ? "nef" : SHIFTS[p]?.kind;
    if (k && !kinds.includes(k)) kinds.push(k);
  }
  return kinds.length ? kinds : [metaFor(code).kind];
}

/** Einarbeitung (E) and rotations (UC, Echo) take place at Frühdienst times. */
const ROTATIONS = new Set(["UC", "Echo"]);
const EARLY_EXTRA = new Set(["E", "O", ...ROTATIONS]);
/** Order inside the Früh block: operative F first, then E, then rotations. */
export function earlyRank(code: string): number {
  const p = code.split(/[+/]/).map(x => x.trim());
  if (p.includes("O")) return 3;
  if (p.some(x => ROTATIONS.has(x))) return 2;
  if (p.includes("E")) return 1;
  return 0;
}

/** Display-only subdivision; FTU remains unavailable to the replacement solver. */
export function earlyArea(code: string): "zna" | "other-area" | null {
  const parts = code.split(/[+/]/).map(p => p.trim());
  if (parts.some(p => p.toUpperCase() === "PX")) return "other-area";
  if (!kindsFor(code).includes("frueh")) return null;
  return earlyRank(code) >= 2 ? "other-area" : "zna";
}

/** Display order inside a shift row: Z, then Z1, then Z2. All other codes tie. */
const CODE_RANK: Record<string, number> = { Z: 0, Z1: 1, Z2: 2 };
const CODE_RANK_LAST = 99;
export function codeRank(code: string): number {
  const first = code.split(/[+/]/)[0]?.trim() ?? "";
  return CODE_RANK[first] ?? CODE_RANK_LAST;
}

export const ROLE_ORDER = ["Chefarzt","Oberarzt","Facharzt","Assistenzarzt","PJ"] as const;
export type Role = typeof ROLE_ORDER[number];

export const ROLE_COLOR: Record<string,string> = {
  Chefarzt: "var(--role-ca)",
  Oberarzt: "var(--role-oa)",
  Facharzt: "var(--role-fa)",
  Assistenzarzt: "var(--role-aa)",
  PJ: "var(--role-pj)",
};

/* Shift display groups for daily/weekly grouping */
export const SHIFT_GROUPS: { id: ShiftKind; label: string; times?: string[] }[] = [
  { id: "nef",      label: "Notarzt", times: ["NEF1 –18:30 · NEF3 –16:15 · NEF24 24h · TNA"] },
  { id: "frueh",    label: "Frühdienst", times: ["07:45–16:15"] },
  { id: "zwischen", label: "Zwischendienst", times: ["Z 10–18:30 · Z1 9–17:30 · Z2 12–20:30"] },
  { id: "spaet",    label: "Spätdienst", times: ["15:30–00:00"] },
  { id: "nacht",    label: "Nachtdienst", times: ["21:00–09:00"] },
  { id: "other",    label: "Sonstige Einsätze" },
];
const NEF_PARTS = new Set(["NEF1", "NEF3", "NEF24", "WNEF24", "TNA", "NEF-E"]);
/** Label shown in a block: only the part of a combined code that belongs there. */
export function displayCode(code: string, group: ShiftKind): { code: string; note?: string } {
  const p = code.split(/[+/]/).map(x => x.trim()).filter(Boolean);
  if (p.length < 2) return { code };
  const nef = p.filter(x => NEF_PARTS.has(x));
  const rest = p.filter(x => !NEF_PARTS.has(x));
  if (!nef.length || !rest.length) return { code };
  if (group === "nef") return { code: nef.join("+"), note: "ab 16:15" };
  return { code: rest.join("+") };
}
/** Order inside the Notarzt block: NEF24 variants, NEF1, NEF3, TNA. */
export function nefRank(code: string): number {
  const p = code.split(/[+/]/).map(x => x.trim());
  if (p.some(x => x === "NEF24" || x === "WNEF24")) return 0;
  if (p.includes("NEF1")) return 1;
  if (p.includes("NEF3")) return 2;
  if (p.includes("TNA")) return 4;
  return 3;
}
