import { test, expect } from "bun:test";
import { hintsFor, hintLevel, hintText, buildWuensche, buildUebergabe } from "./wishes";

const people = [
  { id: "me", name: "Ich", role: "Oberarzt" },
  { id: "a", name: "A", role: "Oberarzt" }, { id: "b", name: "B", role: "Oberarzt" }, { id: "c", name: "C", role: "Oberarzt" },
  { id: "f", name: "F", role: "Facharzt" },
];
const me = people[0];

test("Hinweise zählen nur die eigene Ebene und nie mich selbst", () => {
  const { hints, group } = hintsFor([
    { staffId: "a", date: "2027-01-05", code: "X" }, { staffId: "b", date: "2027-01-05", code: "U" },
    { staffId: "f", date: "2027-01-05", code: "X" }, { staffId: "me", date: "2027-01-05", code: "X" },
    { staffId: "c", date: "2027-01-06", code: "N" }, { staffId: "c", date: "2027-01-07", code: "!N" },
  ], people, me);
  expect(group).toBe(3);
  expect(hints["2027-01-05"]).toEqual({ frei: 1, abwesend: 1, dienst: {} });
  expect(hints["2027-01-06"].dienst.N).toBe(1);
  expect(hints["2027-01-07"]).toBeUndefined();
});
test("Hinweise enthalten keine Namen oder IDs", () => {
  const { hints } = hintsFor([{ staffId: "a", date: "2027-01-05", code: "X" }], people, me);
  expect(JSON.stringify(hints)).not.toMatch(/"a"|staffId|name/);
});
test("Zu kleine Ebene: kein Hinweis, weil er auf eine Person zeigen würde", () => {
  const small = people.filter(p => p.id !== "c");
  expect(hintsFor([{ staffId: "a", date: "2027-01-05", code: "U" }], small, me).hints).toEqual({});
  expect(hintsFor([{ staffId: "me", date: "2027-01-05", code: "U" }], people, people[4]).hints).toEqual({});
});
test("Ampel und Text", () => {
  expect(hintLevel(undefined, 8)).toBe("none");
  expect(hintLevel({ frei: 1, abwesend: 0, dienst: {} }, 8)).toBe("some");
  expect(hintLevel({ frei: 2, abwesend: 1, dienst: {} }, 8)).toBe("tight");
  expect(hintText({ frei: 2, abwesend: 1, dienst: { N: 1 } }, "N")).toEqual(["1 Urlaub/Fortbildung", "2 weitere Freiwünsche", "1 weiterer Wunsch N"]);
  expect(hintText({ frei: 0, abwesend: 0, dienst: { N: 1 } }, "F")).toEqual([]);
});
test("Export im Format des Dienstplan-Generators", () => {
  const out = buildWuensche([
    { staffId: "a", date: "2027-01-03", code: "U" }, { staffId: "a", date: "2027-01-02", code: "U" },
    { staffId: "a", date: "2027-01-09", code: "X" }, { staffId: "a", date: "2027-01-12", code: "!N" },
    { staffId: "b", date: "2027-01-20", code: "F" }, { staffId: "b", date: "2027-02-01", code: "X" },
    { staffId: "weg", date: "2027-01-01", code: "X" },
  ], people, "2027-01");
  expect(out).toEqual({
    A: [{ typ: "urlaub", tage: [2, 3] }, { typ: "frei", tage: [9] }, { typ: "kein", tag: 12, code: "N" }],
    B: [{ typ: "vorbelegung", tag: 20, code: "F" }],
  });
});
test("Übergabe: letzte sieben Tage des Vormonats, ältester zuerst", () => {
  const u = buildUebergabe([
    { doctor: "A", date: "2026-12-25", code: "N" }, { doctor: "A", date: "2026-12-31", code: "S" },
    { doctor: "A", date: "2026-12-30", code: "DF" }, { doctor: "A", date: "2026-12-24", code: "F" },
  ], "2027-01");
  expect(u.tail_dates[0]).toBe("2026-12-25");
  expect(u.tail.A).toEqual(["N", "", "", "", "", "", "S"]);
  expect(u.source_month).toBe("2026-12");
});
