/**
 * Robust parser for the monthly "Dienstplan" PDFs.
 * Works in the browser (drag & drop) and in Node (build script) via pdfjs-dist.
 */

export interface ScheduleEntry {
  doctor: string;
  role: string;
  date: string;
  code: string;
}

export interface ParsedSchedule {
  year: number;
  month: number; // 1-12
  monthLabel: string;
  entries: ScheduleEntry[];
  doctors: Record<string, string>;
  unknownDoctors: string[];
}

const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

interface Item { text: string; x: number; xEnd: number; top: number }

async function loadPdfjs() {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = (worker as any).default;
  } catch {
    // Node / no bundler: run on the main thread
    pdfjs.GlobalWorkerOptions.workerSrc = "";
  }
  return pdfjs;
}

async function extractItems(data: ArrayBuffer): Promise<Item[]> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise;
  const items: Item[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    for (const it of content.items as any[]) {
      const text = (it.str ?? "").trim();
      if (!text) continue;
      const x = it.transform[4] as number;
      const y = it.transform[5] as number;
      items.push({
        text,
        x,
        xEnd: x + (it.width ?? 0),
        top: (p - 1) * 10000 + (viewport.height - y),
      });
    }
  }
  return items;
}

function groupLines(items: Item[], tol = 1.6): Item[][] {
  const sorted = [...items].sort((a, b) => a.top - b.top || a.x - b.x);
  const lines: Item[][] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last[0].top - it.top) <= tol) last.push(it);
    else lines.push([it]);
  }
  return lines.map(l => l.sort((a, b) => a.x - b.x));
}

const FTE_RE = /^\d[.,]\d{1,2}$/;
const TIME_RE = /\d{1,2}[:*]\d{2}/;

function makeNameReader(nameMaxX: number, nameStartX: number) {
  return (line: Item[]): string | null => {
    const left = line.filter(
      i => i.x < nameMaxX && i.x >= nameStartX - 1.5 && !FTE_RE.test(i.text) && i.text.length >= 3,
    );
    if (!left.length) return null;
    const text = left.map(i => i.text).join(" ").trim();
    if (!text || /^\d/.test(text)) return null;
    if (!/[A-Za-zÄÖÜäöüß]/.test(text)) return null;
    return text;
  };
}


function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function joinParts(parts: string[]): string {
  return parts.reduce((acc, part) => {
    if (!acc) return part;
    if (acc.endsWith("+") || part.startsWith("+")) return acc + part;
    return `${acc}+${part}`;
  }, "");
}

export async function parseSchedulePdf(
  data: ArrayBuffer,
  knownRoles: Record<string, string> = {},
): Promise<ParsedSchedule> {
  const items = await extractItems(data);
  if (!items.length) throw new Error("Keine Textinhalte im PDF gefunden.");
  const lines = groupLines(items);

  // 1) Month / year from the title line
  let year = 0;
  let month = 0;
  for (const line of lines.slice(0, 6)) {
    const text = line.map(i => i.text).join(" ");
    const m = text.match(/([A-ZÄÖÜ][a-zäöüß]+)\s+(\d{4})/);
    if (m) {
      // Printed plans sometimes abbreviate the title, e.g. "Novemb 2026".
      const titleMonth = m[1].toLowerCase();
      const idx = MONTHS.findIndex(n => titleMonth.length >= 3 && n.toLowerCase().startsWith(titleMonth));
      if (idx >= 0) { month = idx + 1; year = Number(m[2]); break; }
    }
  }
  if (!month || !year) throw new Error("Monat/Jahr konnten nicht erkannt werden.");

  // 2) Day header row -> column centers
  const headerLine = lines.find(l => l.filter(i => /^\d{1,2}$/.test(i.text)).length >= 20);
  if (!headerLine) throw new Error("Tageszeile konnte nicht erkannt werden.");
  const dayItems = headerLine.filter(i => /^\d{1,2}$/.test(i.text));
  const total = daysInMonth(year, month);
  const columns: { center: number; date: string }[] = [];
  for (const it of dayItems) {
    const day = Number(it.text);
    if (columns.length >= total) break;
    if (day !== columns.length + 1) continue; // ignore leading/trailing foreign-month columns
    columns.push({
      center: (it.x + it.xEnd) / 2,
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    });
  }
  if (columns.length < total * 0.8) throw new Error("Tagesspalten unvollständig erkannt.");

  const headerIdx = lines.indexOf(headerLine);
  const pitch = columns.length > 1 ? columns[1].center - columns[0].center : 21;
  const nameMaxX = columns[0].center - pitch * 0.55;

  const bodyLines = lines.slice(headerIdx + 1);
  // Legend / footer cutoff
  let endIdx = bodyLines.length;
  for (let i = 0; i < bodyLines.length; i++) {
    const text = bodyLines[i].map(it => it.text).join(" ");
    if (/Kürzel/i.test(text) || (i > 5 && TIME_RE.test(text))) { endIdx = i; break; }
  }
  const body = bodyLines.slice(0, endIdx);

  // Left name column start (ignores rotated hierarchy labels further left)
  const candidates = body
    .flatMap(l => l)
    .filter(i => i.x < nameMaxX && i.text.length >= 3 && !FTE_RE.test(i.text));
  const nameStartX = candidates.length ? Math.min(...candidates.map(i => i.x)) : 0;
  const nameOf = makeNameReader(nameMaxX, nameStartX);

  // 3) Collect cell text per doctor / day.
  // A code line only counts when it sits on the same visual row as a name.
  // Unnamed blocks (e.g. the NEF summary row under the head physician) are ignored.
  const cells = new Map<string, Map<number, string[]>>();
  const order: string[] = [];

  const register = (name: string) => {
    const existing = cells.get(name);
    if (existing) return existing;
    const map = new Map<number, string[]>();
    cells.set(name, map);
    order.push(name);
    return map;
  };
  const addItems = (map: Map<number, string[]>, line: Item[]) => {
    for (const it of line) {
      if (it.x < nameMaxX || FTE_RE.test(it.text)) continue;
      const center = (it.x + it.xEnd) / 2;
      let best = -1, bestD = Infinity;
      columns.forEach((c, idx) => {
        const d = Math.abs(c.center - center);
        if (d < bestD) { bestD = d; best = idx; }
      });
      if (best < 0 || bestD > pitch * 0.6) continue;
      const list = map.get(best) ?? [];
      if (!list.includes(it.text)) list.push(it.text);
      map.set(best, list);
    }
  };

  for (let i = 0; i < body.length; i++) {
    const line = body[i];
    const name = nameOf(line);
    if (name) { addItems(register(name), line); continue; }
    const next = body[i + 1];
    const nextName = next ? nameOf(next) : null;
    if (nextName && Math.abs(next[0].top - line[0].top) < 2.6) {
      addItems(register(nextName), line);
    }
  }




  // 4) Roles: known doctors keep their role, new ones inherit from the block above
  const doctors: Record<string, string> = {};
  const unknownDoctors: string[] = [];
  let lastRole = "Oberarzt";
  for (const name of order) {
    const role = knownRoles[name];
    if (role) { lastRole = role; doctors[name] = role; }
    else { doctors[name] = lastRole; unknownDoctors.push(name); }
  }

  const entries: ScheduleEntry[] = [];
  for (const name of order) {
    const map = cells.get(name);
    if (!map) continue;
    for (const [colIdx, parts] of map) {
      const code = joinParts(parts).replace(/\s+/g, "");
      if (!code) continue;
      entries.push({ doctor: name, role: doctors[name], date: columns[colIdx].date, code });
    }
  }
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.doctor.localeCompare(b.doctor));

  return {
    year,
    month,
    monthLabel: `${MONTHS[month - 1]} ${year}`,
    entries,
    doctors,
    unknownDoctors,
  };
}
