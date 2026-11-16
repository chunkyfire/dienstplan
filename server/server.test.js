import { test, expect } from "bun:test";
import { dispatch, handle } from "./core";
import { memoryDb } from "./db";
import { hashPassword } from "../src/lib/password";

const person = (id, name, role, extra = {}) => ({
  id: `00000000-0000-4000-8000-0000000000${id}`, name, role, stellenanteil: 1, qualifications: [], active: true, is_planner: false,
  standby_pos: Number(id), pw_hash: null, invite_code: null, fail_count: 0, locked_until: null, ...extra,
});
const NOW = Date.parse("2026-11-16T10:00:00Z");

async function setup() {
  const db = memoryDb({
    dp_settings: [{ key: "site_pw_hash", value: await hashPassword("gemeinsam-123") }],
    dp_staff: [
      person("01", "Planer", "Oberarzt", { is_planner: true, invite_code: "PLANER01" }),
      person("02", "Anna", "Assistenzarzt", { invite_code: "ANNA0002" }),
      person("03", "Ben", "Assistenzarzt"), person("04", "Cleo", "Assistenzarzt"), person("05", "Dana", "Assistenzarzt"),
      person("06", "Weg", "Assistenzarzt", { active: false, invite_code: "WEG00006" }),
    ],
    dp_wishes: [
      { staff_id: person("03").id, date: "2026-12-08", code: "X", note: "Geburtstag" },
      { staff_id: person("04").id, date: "2026-12-08", code: "U", note: null },
    ],
    dp_plans: [{ month_key: "2026-11", month_label: "November 2026", imported_at: "x", status: "final", doctors: { Anna: "Assistenzarzt" }, entries: [{ doctor: "Anna", role: "Assistenzarzt", date: "2026-11-30", code: "N" }] }],
  });
  const env = { db, secret: "test-secret", now: () => NOW };
  const as = { token: null };
  const call = async (action, data, who = as) => {
    const r = await dispatch(env, action, data, who.token);
    if (r.token !== undefined) who.token = r.token || null;
    return r;
  };
  return { db, env, call, as };
}
async function signedIn(call, who, id, code, password = "eigenes-pw-1") {
  await call("unlock", { password: "gemeinsam-123" }, who);
  return call("login", { staffId: person(id).id, code, password }, who);
}

test("ohne Seitenpasswort kommt nichts heraus", async () => {
  const { call } = await setup();
  for (const action of ["base", "planning", "settings", "login", "moveStandby", "ask", "export", "backupExport"]) {
    const r = await call(action, { month: "2026-12" });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("locked");
  }
  expect((await call("unlock", { password: "falsch" })).result.ok).toBe(false);
  expect((await call("base")).code).toBe("locked");
});
test("ein gefälschtes oder abgelaufenes Token zählt nicht", async () => {
  const { env, call, as } = await setup();
  await call("unlock", { password: "gemeinsam-123" });
  expect((await call("base")).ok).toBe(true);
  const [body] = as.token.split(".");
  expect((await dispatch(env, "base", {}, `${body}.AAAA`)).code).toBe("locked");
  expect((await dispatch({ ...env, secret: "anderes" }, "base", {}, as.token)).code).toBe("locked");
  expect((await dispatch({ ...env, now: () => NOW + 31 * 86_400_000 }, "base", {}, as.token)).code).toBe("locked");
});
test("Erstanmeldung nur mit Einmal-Code, danach nur mit Passwort", async () => {
  const { call, as, db } = await setup();
  await call("unlock", { password: "gemeinsam-123" });
  expect((await call("login", { staffId: person("02").id, code: "FALSCH", password: "eigenes-pw-1" })).result.error).toBe("Einladungscode stimmt nicht");
  expect((await call("login", { staffId: person("02").id, code: "ANNA0002", password: "kurz" })).result.ok).toBe(false);
  expect((await call("login", { staffId: person("02").id, code: "anna0002", password: "eigenes-pw-1" })).result.ok).toBe(true);
  const row = db.tables.dp_staff.find(s => s.name === "Anna");
  expect(row.invite_code).toBe(null);
  expect(row.pw_hash.startsWith("pbkdf2$")).toBe(true);
  await call("logout");
  expect((await call("login", { staffId: person("02").id, code: "ANNA0002", password: "x" })).result.error).toBe("Falsches Passwort");
  expect((await call("login", { staffId: person("02").id, password: "eigenes-pw-1" })).result.ok).toBe(true);
  expect((await call("me")).result.me.name).toBe("Anna");
  // No account without a code, and none for people who left.
  const other = { token: null };
  await call("unlock", { password: "gemeinsam-123" }, other);
  expect((await call("login", { staffId: person("03").id, code: "", password: "eigenes-pw-1" }, other)).result.ok).toBe(false);
  expect((await call("login", { staffId: person("06").id, code: "WEG00006", password: "eigenes-pw-1" }, other)).result.error).toBe("Unbekannte Person");
});
test("nach fünf Fehlversuchen ist das Konto zehn Minuten gesperrt", async () => {
  const { call } = await setup();
  await call("unlock", { password: "gemeinsam-123" });
  let last;
  for (let i = 0; i < 5; i++) last = await call("login", { staffId: person("02").id, code: "RATEN", password: "eigenes-pw-1" });
  expect(last.result.error).toContain("Zu viele Versuche");
  expect((await call("login", { staffId: person("02").id, code: "ANNA0002", password: "eigenes-pw-1" })).result.error).toContain("Zu viele Versuche");
});
test("Wünsche: nur die eigenen, fremde nur als Anzahl", async () => {
  const { call, db } = await setup();
  const anna = { token: null };
  await signedIn(call, anna, "02", "ANNA0002");
  // A foreign staff id in the request is ignored: the row is always the caller's own.
  await call("setWish", { date: "2026-12-08", code: "X", staffId: person("03").id, staff_id: person("03").id }, anna);
  expect(db.tables.dp_wishes.filter(w => w.date === "2026-12-08").map(w => w.staff_id).sort()).toEqual([person("02").id, person("03").id, person("04").id]);
  const view = (await call("planning", { month: "2026-12" }, anna)).result;
  expect(view.mine).toEqual([{ date: "2026-12-08", code: "X", note: null }]);
  expect(view.hints["2026-12-08"]).toEqual({ frei: 1, abwesend: 1, dienst: {} });
  expect(view.planner).toBeUndefined();
  const text = JSON.stringify(view);
  for (const leak of ["Ben", "Cleo", "Geburtstag", person("03").id, person("04").id]) expect(text).not.toContain(leak);
  await call("setWish", { date: "2026-12-08", code: null }, anna);
  expect(db.tables.dp_wishes.some(w => w.staff_id === person("02").id)).toBe(false);
  expect((await call("setWish", { date: "2026-10-01", code: "X" }, anna)).error).toContain("Vergangenheit");
  expect((await call("setWish", { date: "2026-12-09", code: "DROP" }, anna)).ok).toBe(false);
});
test("nur Planer sehen alle Wünsche, exportieren und verwalten", async () => {
  const { call, db } = await setup();
  const anna = { token: null }, boss = { token: null };
  await signedIn(call, anna, "02", "ANNA0002");
  await signedIn(call, boss, "01", "PLANER01");
  for (const [action, data] of [["export", { month: "2026-12" }], ["backupExport", {}], ["backupImport", { format: "dienstplan/backup@1" }], ["saveStaff", { name: "Neu", role: "Facharzt", stellenanteil: 1 }],
    ["inviteStaff", { id: person("03").id }], ["setSitePassword", { password: "neues-passwort" }], ["setPlanningMonth", { month: "2026-12", locked: true }], ["removePlan", { key: "2026-11" }],
    ["savePlan", { key: "2026-12", monthLabel: "x", entries: [{ doctor: "A", role: "", date: "2026-12-01", code: "F" }], doctors: {} }], ["setPlanStatus", { key: "2026-11", status: "entwurf" }], ["setAiModel", { model: "a/b" }]]) {
    expect((await call(action, data, anna)).error).toBe("Nur für Planer");
  }
  expect((await call("settings", {}, anna)).result.staff).toEqual([]);
  const view = (await call("planning", { month: "2026-12" }, boss)).result;
  expect(view.planner.wishes.length).toBe(2);
  const pack = (await call("export", { month: "2026-12" }, boss)).result;
  expect(pack.wuensche).toEqual({ Ben: [{ typ: "frei", tage: [8] }], Cleo: [{ typ: "urlaub", tage: [8] }] });
  expect(pack.uebergabe.tail.Anna).toEqual(["", "", "", "", "", "", "N"]);
  expect(pack.staff.map(s => s.initialen)).not.toContain("Weg");
  const settings = (await call("settings", {}, boss)).result;
  expect(JSON.stringify(settings)).not.toContain("pbkdf2");
  expect(JSON.stringify((await call("backupExport", {}, boss)).result)).not.toContain("pbkdf2");
  // Closing the month stops everyone's edits.
  await call("setPlanningMonth", { month: "2026-12", locked: true, deadline: "2026-11-30" }, boss);
  expect((await call("setWish", { date: "2026-12-20", code: "X" }, anna)).error).toContain("geschlossen");
  // A planner cannot remove their own rights by accident.
  await call("saveStaff", { id: person("01").id, name: "Planer", role: "Oberarzt", stellenanteil: 1, active: false, isPlanner: false }, boss);
  expect(db.tables.dp_staff.find(s => s.name === "Planer")).toMatchObject({ active: true, is_planner: true });
  // Resetting a password hands out a new code and removes the old password.
  const code = (await call("inviteStaff", { id: person("02").id }, boss)).result.code;
  expect(code).toMatch(/^[A-Z2-9]{8}$/);
  expect(db.tables.dp_staff.find(s => s.name === "Anna").pw_hash).toBe(null);
});
test("wer deaktiviert wird, verliert sofort den Zugang zu den Wünschen", async () => {
  const { call, db } = await setup();
  const anna = { token: null };
  await signedIn(call, anna, "02", "ANNA0002");
  db.tables.dp_staff.find(s => s.name === "Anna").active = false;
  expect((await call("setWish", { date: "2026-12-09", code: "X" }, anna)).code).toBe("login");
  expect((await call("planning", { month: "2026-12" }, anna)).result.me).toBe(null);
});
test("Entwürfe sieht nur, wer plant", async () => {
  const { call, db } = await setup();
  db.tables.dp_plans.push({ month_key: "2026-12", month_label: "Dezember 2026", imported_at: "x", status: "entwurf", doctors: {}, entries: [{ doctor: "Anna", role: "", date: "2026-12-01", code: "F" }] });
  const anna = { token: null }, boss = { token: null };
  await signedIn(call, anna, "02", "ANNA0002");
  await signedIn(call, boss, "01", "PLANER01");
  expect((await call("base", { drafts: true }, anna)).result.imports.map(i => i.key)).toEqual(["2026-11"]);
  expect((await call("base", {}, boss)).result.imports.map(i => i.key)).toEqual(["2026-11"]);
  const preview = (await call("base", { drafts: true }, boss)).result;
  expect(preview.imports.map(i => i.key)).toEqual(["2026-11", "2026-12"]);
  expect(preview.draftKeys).toEqual(["2026-12"]);
  await call("setPlanningMonth", { month: "2027-01", locked: false }, boss);
  for (const date of ["2026-12-05", "2027-01-05"]) await call("setWish", { date, code: "X" }, anna);
  await call("setPlanStatus", { key: "2026-12", status: "final" }, boss);
  expect((await call("base", {}, anna)).result.imports.length).toBe(2);
  // Mit dem verabschiedeten Plan sind die Wünsche bis zu diesem Monat weg, spätere bleiben.
  expect(db.tables.dp_wishes.map(w => w.date)).toEqual(["2027-01-05"]);
});
test("Einspringen: ans Ende der eigenen Ebene, mit Eintrag für die Historie", async () => {
  const { call, db } = await setup();
  await call("unlock", { password: "gemeinsam-123" });
  const order = () => db.tables.dp_staff.filter(s => s.role === "Assistenzarzt" && s.active).sort((a, b) => a.standby_pos - b.standby_pos).map(s => s.name);
  await call("markCovered", { name: "Anna", date: "2026-11-20", code: "N" });
  expect(order()).toEqual(["Ben", "Cleo", "Dana", "Anna"]);
  expect(db.tables.dp_cover_events.length).toBe(1);
  await call("moveStandby", { name: "Dana", dir: "up" });
  expect(order()).toEqual(["Ben", "Dana", "Cleo", "Anna"]);
  expect((await call("markCovered", { name: "Unbekannt", date: "2026-11-20" })).ok).toBe(false);
});
test("Sicherung: einspielen ergänzt, ohne Konten anzufassen", async () => {
  const { call, db } = await setup();
  const boss = { token: null };
  await signedIn(call, boss, "01", "PLANER01");
  const hash = db.tables.dp_staff.find(s => s.name === "Planer").pw_hash;
  const r = await call("backupImport", {
    format: "dienstplan/backup@1",
    staff: [{ name: "Planer", role: "Oberarzt", stellenanteil: 0.8, qualifications: ["NEF", "Unsinn"], active: true, isPlanner: false, standbyPos: 3 }, { name: "Neu", role: "Facharzt", stellenanteil: 1, standbyPos: 1 }],
    plans: [{ key: "2026-10", monthLabel: "Oktober 2026", entries: [{ doctor: "Neu", role: "Facharzt", date: "2026-10-01", code: "F" }], doctors: { Neu: "Facharzt" } }],
    wishes: [{ name: "Neu", date: "2026-12-24", code: "X" }, { name: "Gibt es nicht", date: "2026-12-24", code: "X" }],
    covers: [{ name: "Neu", date: "2026-10-03", code: "S" }],
  }, boss);
  expect(r.result).toEqual({ people: 2, plans: 1, wishes: 1, covers: 1 });
  expect(db.tables.dp_staff.find(s => s.name === "Planer")).toMatchObject({ pw_hash: hash, is_planner: true, stellenanteil: 0.8, qualifications: ["NEF"] });
  expect(db.tables.dp_plans.map(p => p.month_key).sort()).toEqual(["2026-10", "2026-11"]);
  expect((await call("backupImport", { format: "etwas anderes" }, boss)).ok).toBe(false);
});
test("Assistent: fragt OpenRouter, führt die geprüften Werkzeuge aus", async () => {
  const { call, env } = await setup();
  await call("unlock", { password: "gemeinsam-123" });
  expect((await call("ask", { messages: [{ role: "user", content: "Wer hat am 30.11. Dienst?" }] })).result.ok).toBe(false);
  const seen = [];
  env.openrouterKey = "sk-test";
  env.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    seen.push({ url, auth: init.headers.Authorization, body });
    const message = seen.length === 1
      ? { content: null, tool_calls: [{ id: "c1", function: { name: "get_day", arguments: '{"date":"2026-11-30"}' } }] }
      : { content: "Anna hat Nachtdienst." };
    return new Response(JSON.stringify({ choices: [{ message }] }), { status: 200 });
  };
  const r = await call("ask", { messages: [{ role: "user", content: "Wer hat am 30.11. Dienst?" }], today: "2026-11-16" });
  expect(r.result).toEqual({ ok: true, answer: "Anna hat Nachtdienst." });
  expect(seen[0].url).toBe("https://openrouter.ai/api/v1/chat/completions");
  expect(seen[0].auth).toBe("Bearer sk-test");
  expect(seen[0].body.model).toBe("openrouter/auto");
  expect(seen[1].body.messages.at(-1)).toEqual({ role: "tool", tool_call_id: "c1", content: "Anna (Assistenzarzt): N" });
  env.fetch = async () => new Response("no credit", { status: 402 });
  expect((await call("ask", { messages: [{ role: "user", content: "x" }] })).result.error).toBe("KI-Guthaben aufgebraucht.");
});
test("HTTP: CORS nur für erlaubte Herkunft, Antwort als JSON", async () => {
  const { env } = await setup();
  const origins = ["https://chunkyfire.github.io", "http://localhost:5173"];
  const pre = await handle(new Request("https://x/f", { method: "OPTIONS", headers: { origin: "https://boese.example" } }), env, origins);
  expect(pre.status).toBe(204);
  expect(pre.headers.get("access-control-allow-origin")).toBe("https://chunkyfire.github.io");
  const res = await handle(new Request("https://x/f", { method: "POST", headers: { origin: "http://localhost:5173" }, body: JSON.stringify({ action: "me" }) }), env, origins);
  expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  expect(await res.json()).toEqual({ ok: true, result: { unlocked: false, me: null } });
  expect((await (await handle(new Request("https://x/f", { method: "POST", body: "kein json" }), env, origins)).json()).ok).toBe(false);
  expect((await (await handle(new Request("https://x/f", { method: "POST", body: JSON.stringify({ action: "constructor" }) }), env, origins)).json()).error).toBe("Unbekannte Aktion");
});
