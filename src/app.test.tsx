/** Whole app in a simulated browser against the real server code with an in-memory database. */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register({ url: "https://chunkyfire.github.io/dienstplan/" });

import { test, expect } from "bun:test";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { handle } from "../server/core";
import { memoryDb } from "../server/db";
import { hashPassword } from "./lib/password";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const person = (n: number, name: string, role: string, extra = {}) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`, name, role, stellenanteil: 1, qualifications: [], active: true, is_planner: false,
  standby_pos: n, pw_hash: null, invite_code: null, fail_count: 0, locked_until: null, ...extra,
});
const today = new Date();
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const month = iso(today).slice(0, 7);

const $ = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as HTMLElement[];
const button = (text: string) => $$("button").find(b => b.textContent?.includes(text))!;
async function until(check: () => unknown, what: string) {
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
  }
  throw new Error(`Nicht eingetreten: ${what}\n${document.body.textContent?.slice(0, 400)}`);
}
async function type(el: Element, value: string) {
  await act(async () => { (el as HTMLInputElement).value = value; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); });
}
const click = (el: Element) => act(async () => { (el as HTMLElement).click(); });
const submit = (form: Element) => act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
const go = (hash: string) => act(async () => { window.location.hash = hash; window.dispatchEvent(new Event("hashchange")); });

test("entsperren, Plan sehen, anmelden, Wunsch setzen, als Planer verwalten", async () => {
  const db = memoryDb({
    dp_settings: [{ key: "site_pw_hash", value: await hashPassword("gemeinsam-123") }],
    dp_staff: [
      person(1, "Planer", "Oberarzt", { is_planner: true, invite_code: "PLANER01" }),
      person(2, "Anna", "Assistenzarzt"), person(3, "Ben", "Assistenzarzt"), person(4, "Cleo", "Assistenzarzt"), person(5, "Dana", "Assistenzarzt"),
    ],
    dp_plans: [{
      month_key: month, month_label: "Testmonat", imported_at: today.toISOString(), status: "final",
      doctors: { Anna: "Assistenzarzt", Ben: "Assistenzarzt", Cleo: "Assistenzarzt", Planer: "Oberarzt" },
      entries: [
        { doctor: "Anna", role: "Assistenzarzt", date: iso(today), code: "F" }, { doctor: "Ben", role: "Assistenzarzt", date: iso(today), code: "DF" },
        { doctor: "Cleo", role: "Assistenzarzt", date: iso(today), code: "DF" }, { doctor: "Planer", role: "Oberarzt", date: iso(today), code: "S" },
      ],
    }],
  });
  const env = { db, secret: "test" };
  globalThis.fetch = (async (url: string, init: RequestInit) => handle(new Request(url, init), env, ["https://chunkyfire.github.io"])) as typeof fetch;

  const { App } = await import("./App");
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => { root.render(<App />); });

  // 1. Locked: only the password page.
  await until(() => $("input[name=password]"), "Passwortseite");
  expect(document.body.textContent).not.toContain("Anna");
  await type($("input[name=password]")!, "falsch");
  await submit($("form")!);
  await until(() => $(".form-error")?.textContent === "Falsches Passwort", "Fehlermeldung");
  await type($("input[name=password]")!, "gemeinsam-123");
  await submit($("form")!);

  // 2. Live plan with tabs and the stand-in order.
  await until(() => $(".week-grid"), "Wochenansicht");
  expect($$(".suite-tab").map(t => t.textContent)).toEqual(["Aktuell", "Planung"]);
  expect(document.body.textContent).toContain("Anna");
  expect($$(".free-entry.is-next").map(e => e.textContent)).toContain("1Ben");
  expect(document.body.textContent).not.toContain("Dienstplan hier ablegen");

  // 3. Someone stepped in: Ben goes to the end of his level.
  await click($$(".free-entry.is-clickable").find(e => e.textContent?.includes("Ben"))!);
  await click(button("Ja, ans Ende der Liste"));
  await until(() => db.tables.dp_cover_events?.length === 1 && !$(".cover-bar"), "Einspringen gespeichert");
  await until(() => $$(".free-entry.is-next").some(e => e.textContent === "1Cleo"), "neue Reihenfolge sichtbar");

  // 4. Planning needs a personal sign-in.
  await go(`#/planung?m=${month}`);
  await until(() => $(".login-box select"), "Anmeldung");
  await type($(".login-box select")!, person(1, "", "").id);
  await until(() => $("input[name=code]"), "Einladungscode-Feld");
  await type($("input[name=code]")!, "PLANER01");
  await type($("input[name=password]")!, "eigenes-pw-1");
  await submit($(".login-box")!);
  await until(() => $(".wish-grid"), "Wunschkalender");
  expect($$(".suite-tab").map(t => t.textContent)).toEqual(["Aktuell", "Planung", "Einstellungen"]);

  // 5. Set a wish for a day later this month (or the last day).
  const days = $$(".wish-day:not(.is-pad)");
  await click(days[days.length - 1]);
  await until(() => db.tables.dp_wishes?.length === 1, "Wunsch gespeichert");
  await until(() => days[days.length - 1].querySelector(".wish-pill")?.textContent === "X", "Wunsch sichtbar");
  expect(db.tables.dp_wishes[0]).toMatchObject({ staff_id: person(1, "", "").id, code: "X" });
  expect($(".planner")?.textContent).toContain("1 von 5 Personen");

  // 6. Settings: staff list and admin tools for the planner.
  await go("#/einstellungen");
  await until(() => $(".staff-table"), "Personalliste");
  expect($$(".staff-table tbody tr").length).toBe(6);
  expect(document.body.textContent).toContain("OpenRouter-Schlüssel ist noch nicht hinterlegt");

  // 7. The planner sees the upload zone on the live plan; signing out hides it again.
  await go("#/");
  await until(() => document.body.textContent?.includes("Dienstplan hier ablegen"), "Upload für Planer");
  await click(button("Abmelden"));
  await until(() => !document.body.textContent?.includes("Dienstplan hier ablegen") && $(".week-grid"), "abgemeldet");
  await act(async () => { root.unmount(); });
});
