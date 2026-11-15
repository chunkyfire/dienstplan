import { test, expect } from "bun:test";
import { assignSlots } from "./weekSlots";
const k = x => x;
test("Ein Arzt bleibt die ganze Woche auf derselben Höhe", () => {
  const out = assignSlots([["Tanner"], ["Sander", "Tanner"]], k, x => (x === "Tanner" ? 2 : 1));
  expect(out).toEqual([[null, "Tanner"], ["Sander", "Tanner"]]);
});
test("Freier Platz wird wiederverwendet statt neue Zeile", () => {
  const out = assignSlots([["Nagel"], ["Reuter", "Nagel"], [], ["Kern"]], k);
  expect(out[3]).toEqual(["Kern", null]);
  expect(out[0].indexOf("Nagel")).toBe(out[1].indexOf("Nagel"));
});
