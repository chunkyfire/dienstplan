import { test, expect } from "bun:test";
import { freeRowGroups, freeBandSlots, ftuEntriesFor } from "./freeRowGroups";
import { availabilityFor } from "../lib/availability";

const person = (doctor, role, status = "available", reason) => ({ doctor, role, status, reason });

test("Freie Ärzte stehen als Assistenzärzte, Fachärzte, Oberärzte in getrennten Wochenbändern", () => {
  const groups = freeRowGroups([
    [person("O", "Oberarzt"), person("A", "Assistenzarzt")],
    [person("F", "Facharzt"), person("A2", "Assistenzarzt", "partial")],
  ]);
  expect(groups.map(g => g.key)).toEqual(["Assistenzarzt", "Facharzt", "Oberarzt", "partial"]);
  expect(groups[0].cells.map(c => c.map(a => a.doctor))).toEqual([["A"], []]);
  expect(groups[3].cells.map(c => c.map(a => a.doctor))).toEqual([[], ["A2"]]);
  expect(groups[1].cells[0]).toEqual([]);
});

test("Nach freien Ärzten folgen X und Urlaub, ohne FTU-Dopplung", () => {
  const groups = freeRowGroups([[
    person("FTU", "Assistenzarzt", "blocked", "FTU"),
    person("U", "Oberarzt", "blocked", "Urlaub"),
    person("XO", "Oberarzt", "wish", "Freiwunsch"),
    person("XF", "Facharzt", "wish", "Freiwunsch"),
    person("XA", "Assistenzarzt", "wish", "Freiwunsch"),
    person("Frei", "Assistenzarzt"),
    person("N", "Assistenzarzt", "blocked", "nach Nacht"),
  ]]);
  expect(groups.map(g => g.key)).toEqual(["Assistenzarzt", "wish", "blocked"]);
  expect(groups[1].cells[0].map(a => a.doctor)).toEqual(["XA", "XF", "XO"]);
  expect(groups.flatMap(g => g.cells[0]).map(a => a.doctor)).not.toContain("FTU");
  expect(groups.flatMap(g => g.cells[0]).length).toBe(6);
});

test("X bleibt an jedem Wochentag grün vor gelb vor rot trotz wechselnder Besetzung", () => {
  const groups = freeRowGroups([
    [person("O", "Oberarzt", "wish"), person("A", "Assistenzarzt", "wish")],
    [person("F", "Facharzt", "wish"), person("A", "Assistenzarzt", "wish")],
    [person("A2", "Assistenzarzt", "wish"), person("F", "Facharzt", "wish"), person("O", "Oberarzt", "wish")],
  ]);
  const slots = freeBandSlots(groups[0].cells);
  expect(slots.map(day => day.map(a => a?.doctor ?? null))).toEqual([
    ["A", null, "O"], ["A", "F", null], ["A2", "F", "O"],
  ]);
});

test("Urlaub, Fortbildung, Elternzeit und nach Nacht bilden einen gemeinsamen rollen-sortierten Block", () => {
  const groups = freeRowGroups([[
    person("U", "Oberarzt", "blocked", "Urlaub"),
    person("FB", "Facharzt", "blocked", "Fortbildung"),
    person("EZ", "Assistenzarzt", "blocked", "Elternzeit"),
    person("N", "Assistenzarzt", "blocked", "nach Nacht"),
  ]]);
  expect(groups.map(g => g.key)).toEqual(["blocked"]);
  expect(freeBandSlots(groups[0].cells)[0].map(a => a.doctor)).toEqual(["EZ", "N", "FB", "U"]);
});

test("PX und Px erscheinen im FTU-Block, bleiben gesperrt und fehlen in der Einspringliste", () => {
  const entries = [
    { doctor: "A", role: "Assistenzarzt", date: "2026-11-16", code: "PX" },
    { doctor: "F", role: "Facharzt", date: "2026-11-16", code: "Px" },
    { doctor: "O", role: "Oberarzt", date: "2026-11-17", code: "PX" },
  ];
  expect(ftuEntriesFor("2026-11-16", entries, null).map(e => e.doctor)).toEqual(["A", "F"]);
  expect(ftuEntriesFor("2026-11-16", entries, "Facharzt").map(e => e.doctor)).toEqual(["F"]);
  const availability = availabilityFor("2026-11-16", entries, { A: "Assistenzarzt", F: "Facharzt" });
  expect(availability.filter(a => a.reason === "FTU").map(a => a.status)).toEqual(["blocked", "blocked"]);
  expect(freeRowGroups([availability]).flatMap(g => g.cells[0]).map(a => a.doctor)).not.toContain("A");
  expect(freeRowGroups([availability]).flatMap(g => g.cells[0]).map(a => a.doctor)).not.toContain("F");
});
test("Einspringliste bestimmt die Reihenfolge innerhalb der Ebene", () => {
  const day = ["Zeller", "Dahl", "Kern"].map(doctor => ({ doctor, role: "Assistenzarzt", status: "available" }));
  const bands = freeRowGroups([day], { Kern: 1, Zeller: 2 });
  expect(bands[0].cells[0].map(a => a.doctor)).toEqual(["Kern", "Zeller", "Dahl"]);
});

test("Wer ein X hat, zählt nicht zu den Nächsten: vorn stehen nur, die können", () => {
  const standby = { Erste: 1, Zweite: 2, Dritte: 3 };
  const groups = freeRowGroups([[person("Dritte", "Oberarzt"), person("Erste", "Oberarzt", "wish", "Freiwunsch"), person("Zweite", "Oberarzt")]], standby);
  expect(groups.find(g => g.key === "Oberarzt").cells[0].map(a => a.doctor)).toEqual(["Zweite", "Dritte"]);
  expect(groups.find(g => g.key === "wish").cells[0].map(a => a.doctor)).toEqual(["Erste"]);
});
