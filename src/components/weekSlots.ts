/**
 * Gives each person a fixed vertical slot for the whole week, so a name stays
 * at the same height every day. Sections (e.g. F, E, rotations) stay stacked in
 * order; a free slot is reused by someone working on other days.
 */
export function assignSlots<T>(cells: T[][], keyOf: (x: T) => string, sectionOf: (x: T) => number = () => 0): (T | null)[][] {
  const info = new Map<string, { section: number; first: number; days: Set<number> }>();
  cells.forEach((list, day) => list.forEach((x, pos) => {
    const k = keyOf(x);
    const cur = info.get(k) ?? { section: sectionOf(x), first: Infinity, days: new Set<number>() };
    cur.section = Math.min(cur.section, sectionOf(x));
    cur.first = Math.min(cur.first, pos);
    cur.days.add(day);
    info.set(k, cur);
  }));
  const sections = [...new Set([...info.values()].map(i => i.section))].sort((a, b) => a - b);
  const slotOf = new Map<string, number>();
  let offset = 0;
  for (const s of sections) {
    const keys = [...info.entries()].filter(([, i]) => i.section === s).sort((a, b) => a[1].first - b[1].first);
    const used: Set<number>[] = [];
    for (const [k, i] of keys) {
      let slot = 0;
      while (used[slot] && [...i.days].some(d => used[slot].has(d))) slot++;
      (used[slot] ??= new Set()).forEach(() => {});
      i.days.forEach(d => used[slot].add(d));
      slotOf.set(k, offset + slot);
    }
    offset += used.length;
  }
  return cells.map(list => {
    const out: (T | null)[] = Array(offset).fill(null);
    list.forEach(x => { out[slotOf.get(keyOf(x))!] = x; });
    return out;
  });
}
