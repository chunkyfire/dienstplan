import { test, expect } from "bun:test";
import { solveOutage } from "./swapSolver";

const doctors = { Chef: "Chefarzt", A: "Assistenzarzt", B: "Assistenzarzt", C: "Assistenzarzt", Oa: "Oberarzt" };
const e = (doctor, date, code) => ({ doctor, role: doctors[doctor], date, code });

test("Ruhezeit: nach Nacht am Vortag kein Frühdienst", () => {
  const s = solveOutage([e("A", "2026-11-09", "N"), e("A", "2026-11-10", ""), e("B", "2026-11-10", "F")],
    doctors, { date: "2026-11-10", code: "F", doctor: "B" });
  expect(s.some(x => x.moves.some(m => m.doctor === "A" && m.date === "2026-11-10"))).toBe(false);
});

test("Tausch am selben Tag: Z1 rückt in die Nacht, Freier übernimmt Z1", () => {
  const s = solveOutage([e("B", "2026-11-10", "N"), e("A", "2026-11-10", "Z1"), e("C", "2026-11-10", "DF"), e("C", "2026-11-11", "F")],
    doctors, { date: "2026-11-10", code: "N", doctor: "B" });
  const same = s.find(x => x.type === "sameDay");
  expect(same.moves[0]).toMatchObject({ doctor: "A", from: "Z1", to: "N" });
  expect(same.moves[1]).toMatchObject({ doctor: "C", to: "Z1" });
});

test("Ringtausch wird gefunden", () => {
  // A frei am 10., aber S am 9. blockiert F am 10. B frei am 9., aber N am 8. blockiert S am 9. C frei am 8.
  const s = solveOutage([
    e("Oa", "2026-11-10", "F"),
    e("A", "2026-11-09", "S"), e("A", "2026-11-10", ""),
    e("B", "2026-11-08", "N"), e("B", "2026-11-09", ""), e("B", "2026-11-10", "U"),
    e("C", "2026-11-08", ""), e("C", "2026-11-09", "U"), e("C", "2026-11-10", "U"),
  ], { ...doctors, Oa: "Assistenzarzt" }, { date: "2026-11-10", code: "F", doctor: "Oa" });
  const ring = s.find(x => x.type === "ring");
  expect(ring.call).toEqual(["A", "B", "C"]);
});

test("Die Chefärztin oder der Chefarzt wird nie vorgeschlagen", () => {
  const s = solveOutage([e("Chef", "2026-11-10", ""), e("B", "2026-11-10", "F")], doctors, { date: "2026-11-10", code: "F", doctor: "B" });
  expect(s.flatMap(x => x.call)).not.toContain("Chef");
});

test("Freiwunsch X wird beachtet", () => {
  const s = solveOutage([e("A", "2026-11-10", "X"), e("B", "2026-11-10", "F")], doctors, { date: "2026-11-10", code: "F", doctor: "B" });
  expect(s.flatMap(x => x.call)).not.toContain("A");
});
