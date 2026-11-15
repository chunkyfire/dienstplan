import { test, expect } from "bun:test";
import { mergeSchedule } from "./scheduleStore";

test("Hochgeladener Monat ersetzt den gespeicherten Monat komplett", () => {
  const r = mergeSchedule({
    entries: [
      { doctor: "A", role: "Facharzt", date: "2026-12-01", code: "F" },
      { doctor: "A", role: "Facharzt", date: "2026-11-30", code: "S" },
    ],
    doctors: { A: "Facharzt" },
    imports: [{ key: "2026-12", monthLabel: "Dezember 2026", importedAt: "x",
      entries: [{ doctor: "B", role: "Oberarzt", date: "2026-12-01", code: "N" }], doctors: { B: "Oberarzt" } }],
  });
  expect(r.entries.map(e => `${e.date}:${e.doctor}:${e.code}`)).toEqual(["2026-11-30:A:S", "2026-12-01:B:N"]);
});
