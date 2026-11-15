import type { Availability } from "@/lib/availability";
import type { AvEntry } from "@/lib/availability";
import { assignSlots } from "./weekSlots";

/** FTU is shown in its own schedule row, not as a replacement option. */
export function ftuEntriesFor(date: string, entries: AvEntry[], roleFilter: string | null) {
  return entries.filter(e => e.date === date && (e.code === "PX" || e.code === "Px") && (!roleFilter || e.role === roleFilter));
}

const roles = ["Assistenzarzt", "Facharzt", "Oberarzt"];
/** Bands that follow the stand-in list (one per level). */
export const isRoleBand = (key: string) => roles.includes(key);

function rank(role: string) {
  const index = roles.indexOf(role);
  return index < 0 ? roles.length : index;
}

/** Display-only bands; availability and rest-time decisions stay unchanged. */
export function freeRowGroups(days: Availability[][], standby: Record<string, number> = {}) {
  // People missing from the stand-in list come last, alphabetically.
  const pos = (a: Availability) => standby[a.doctor] ?? Number.MAX_SAFE_INTEGER;
  const bands = [
    ...roles.map(role => ({ key: role, matches: (a: Availability) => a.status === "available" && a.role === role })),
    { key: "other-roles", matches: (a: Availability) => a.status === "available" && !roles.includes(a.role) },
    { key: "partial", matches: (a: Availability) => a.status === "partial" },
    { key: "wish", matches: (a: Availability) => a.status === "wish" },
    { key: "blocked", matches: (a: Availability) => a.status === "blocked" && a.reason !== "FTU" },
  ];
  return bands.map(band => ({
    key: band.key,
    cells: days.map(day => day.filter(band.matches).sort((a, b) => rank(a.role) - rank(b.role) || pos(a) - pos(b) || a.doctor.localeCompare(b.doctor, "de"))),
  })).filter(band => band.cells.some(cell => cell.length > 0));
}

/** Fixed weekly positions cannot cross role boundaries, even on sparse days. */
export function freeBandSlots(cells: Availability[][]) {
  return assignSlots(cells, a => a.doctor, a => rank(a.role));
}
const SHORT: Record<string, string> = { Freiwunsch: "X", Urlaub: "U", Fortbildung: "FB", Krank: "K", Elternzeit: "EZ", Abwesend: "A", Studientag: "ST" };
/** Short code shown inline next to the name. */
export function shortReason(reason: string) { return SHORT[reason] ?? reason; }
