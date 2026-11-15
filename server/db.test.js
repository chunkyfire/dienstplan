import { test, expect } from "bun:test";
import { restDb } from "./db";

function fake(pages = [[]]) {
  const calls = [];
  let n = 0;
  const f = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
    return new Response(init.method === "GET" ? JSON.stringify(pages[n++] ?? []) : null, { status: init.method === "GET" ? 200 : 201 });
  };
  return { calls, db: restDb("https://p.supabase.co/", "service-key", f) };
}

test("Lesen: Filter, Sortierung, Schlüssel und Blättern über 1000 Zeilen", async () => {
  const full = Array.from({ length: 1000 }, (_, i) => ({ i }));
  const { calls, db } = fake([full, [{ i: 1000 }]]);
  const rows = await db.select("dp_wishes", { where: [["date", "gte", "2026-12-01"], ["name", "eq", "Müller & Co"]], order: ["date", "standby_pos.desc"] });
  expect(rows.length).toBe(1001);
  expect(calls[0].url).toBe("https://p.supabase.co/rest/v1/dp_wishes?date=gte.2026-12-01&name=eq.M%C3%BCller%20%26%20Co&select=*&limit=1000&offset=0&order=date,standby_pos.desc");
  expect(calls[1].url).toContain("offset=1000");
  expect(calls[0].headers).toMatchObject({ apikey: "service-key", Authorization: "Bearer service-key" });
});
test("Schreiben: Upsert, Ändern, Löschen; nie ohne Bedingung", async () => {
  const { calls, db } = fake();
  await db.insert("dp_wishes", [{ staff_id: "a", date: "2026-12-01", code: "X" }], "staff_id,date");
  await db.insert("dp_staff", []);
  await db.update("dp_staff", { active: false }, [["id", "eq", "a"]]);
  await db.remove("dp_plans", [["month_key", "eq", "2026-11"]]);
  expect(calls.map(c => `${c.method} ${c.url.split("/rest/v1/")[1]}`)).toEqual(["POST dp_wishes?on_conflict=staff_id,date", "PATCH dp_staff?id=eq.a", "DELETE dp_plans?month_key=eq.2026-11"]);
  expect(calls[0].headers.Prefer).toBe("resolution=merge-duplicates,return=minimal");
  expect(calls[1].body).toEqual({ active: false });
  await expect(db.remove("dp_plans", [])).rejects.toThrow();
  await expect(db.update("dp_plans", { status: "final" }, [])).rejects.toThrow();
});
test("Fehler der Datenbank werden nicht verschluckt", async () => {
  const db = restDb("https://p.supabase.co", "k", async () => new Response("relation does not exist", { status: 404 }));
  await expect(db.select("dp_fehlt")).rejects.toThrow("404");
});
