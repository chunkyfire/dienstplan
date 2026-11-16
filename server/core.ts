import type { Db, Row } from "./db";
import { readSession, signSession, type Session } from "./session";
import { hashPassword, verifyPassword, newInviteCode, MIN_PASSWORD } from "../src/lib/password";
import { hintsFor, isWishCode, buildWuensche, buildUebergabe, prevMonth, nextMonth } from "../src/lib/wishes";
import { mergeSchedule, type StoredImport } from "../src/lib/scheduleStore";
import { solveOutage, describeSolution, addDays } from "../src/lib/swapSolver";
import { resolveDoctor, checkConstraints, describeConstraints, weekTable } from "../src/lib/constraints";

export interface Env {
  db: Db;
  /** Key the session tokens are signed with. */
  secret: string;
  openrouterKey?: string;
  fetch?: typeof fetch;
  now?: () => number;
}
/** `code: "locked"` tells the browser to show the site-password page. */
export class AppError extends Error {
  constructor(message: string, public code?: "locked" | "login") { super(message); }
}

const T = { staff: "dp_staff", wishes: "dp_wishes", covers: "dp_cover_events", months: "dp_planning_months", plans: "dp_plans", settings: "dp_settings" };
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const ID_RE = /^[0-9a-f-]{36}$/i;
export const STAFF_ROLES = ["Chefarzt", "Oberarzt", "Facharzt", "Assistenzarzt"];
export const QUALIFICATIONS = ["NEF", "TELE", "KV"];
const ROLE_SHORT: Record<string, string> = { Chefarzt: "CA", Oberarzt: "OA", Facharzt: "FA", Assistenzarzt: "AA" };
const MAX_FAILS = 5;
const LOCK_MINUTES = 10;
const HISTORY_MONTHS = 6;
const DEFAULT_MODEL = "openrouter/auto";

interface Staff {
  id: string; name: string; role: string; stellenanteil: number; qualifications: string[];
  active: boolean; is_planner: boolean; standby_pos: number;
  pw_hash: string | null; invite_code: string | null; fail_count: number; locked_until: string | null;
}
interface Entry { doctor: string; role: string; date: string; code: string; }
interface Ctx { env: Env; db: Db; session: Session | null; now: number; newToken?: string; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Data = Record<string, any>;

const str = (v: unknown, max: number) => String(v ?? "").slice(0, max);
const month = (v: unknown) => { const s = String(v ?? ""); if (!MONTH_RE.test(s)) throw new AppError("Ungültiger Monat"); return s; };
const date = (v: unknown) => { const s = String(v ?? ""); if (!DATE_RE.test(s)) throw new AppError("Ungültiges Datum"); return s; };
const uuid = (v: unknown) => { const s = String(v ?? ""); if (!ID_RE.test(s)) throw new AppError("Ungültige Person"); return s; };
const toMe = (r: Staff) => ({ id: r.id, name: r.name, role: r.role, isPlanner: r.is_planner });
const iso = (ms: number) => new Date(ms).toISOString();

function unlocked(c: Ctx) {
  if (!c.session) throw new AppError("Bitte zuerst das Seitenpasswort eingeben", "locked");
}
/** The signed-in person, or null. Deactivated staff lose access immediately. */
async function currentStaff(c: Ctx): Promise<Staff | null> {
  if (!c.session?.staffId) return null;
  const [row] = (await c.db.select(T.staff, { where: [["id", "eq", c.session.staffId]] })) as Staff[];
  return row?.active ? row : null;
}
async function staff(c: Ctx): Promise<Staff> {
  unlocked(c);
  const me = await currentStaff(c);
  if (!me) throw new AppError("Bitte anmelden", "login");
  return me;
}
async function planner(c: Ctx): Promise<Staff> {
  const me = await staff(c);
  if (!me.is_planner) throw new AppError("Nur für Planer");
  return me;
}
async function setting<V>(db: Db, key: string): Promise<V | undefined> {
  const [row] = await db.select(T.settings, { where: [["key", "eq", key]] });
  return row?.value as V | undefined;
}
const saveSetting = (db: Db, key: string, value: unknown) => db.insert(T.settings, [{ key, value }], "key");

async function loginNames(db: Db) {
  const rows = (await db.select(T.staff, { where: [["active", "eq", true]], order: ["name"] })) as Staff[];
  return rows.map(r => ({ id: r.id, name: r.name, hasAccount: !!r.pw_hash }));
}
/** Wrong passwords and wrong invite codes share one counter, so neither can be guessed in bulk. */
async function failed(c: Ctx, row: Staff) {
  const fails = row.fail_count + 1;
  const lock = fails >= MAX_FAILS;
  await c.db.update(T.staff, { fail_count: lock ? 0 : fails, locked_until: lock ? iso(c.now + LOCK_MINUTES * 60_000) : row.locked_until }, [["id", "eq", row.id]]);
  return lock ? `Zu viele Versuche. Bitte in ${LOCK_MINUTES} Minuten erneut versuchen.` : null;
}
function lockedFor(until: string | null | undefined, now: number) {
  const ms = until ? new Date(until).getTime() - now : 0;
  return ms > 0 ? `Zu viele Versuche. Bitte in ${Math.ceil(ms / 60_000)} Minuten erneut versuchen.` : null;
}
async function renumber(db: Db, role: string, order: (rows: Staff[]) => Staff[]) {
  const rows = order((await db.select(T.staff, { where: [["role", "eq", role], ["active", "eq", true]], order: ["standby_pos", "name"] })) as Staff[]);
  await Promise.all(rows.map((r, i) => (r.standby_pos === i + 1 ? null : db.update(T.staff, { standby_pos: i + 1 }, [["id", "eq", r.id]]))));
}
const wishesOfMonth = (db: Db, m: string) =>
  db.select(T.wishes, { where: [["date", "gte", `${m}-01`], ["date", "lt", `${nextMonth(m)}-01`]], order: ["date", "staff_id"] });
const toImport = (r: Row): StoredImport => ({ key: r.month_key, monthLabel: r.month_label, importedAt: r.imported_at, entries: r.entries, doctors: r.doctors });
async function finalSchedule(db: Db) {
  const rows = await db.select(T.plans, { where: [["status", "eq", "final"]], order: ["month_key"] });
  return mergeSchedule({ entries: [], doctors: {}, imports: rows.map(toImport) });
}
function cleanPlan(d: Data) {
  const key = month(d?.key);
  if (!Array.isArray(d.entries) || !d.entries.length || d.entries.length > 5000) throw new AppError("Ungültige Einträge");
  for (const e of d.entries)
    if (typeof e?.doctor !== "string" || typeof e.code !== "string" || typeof e.date !== "string" || !e.date.startsWith(key)) throw new AppError("Ungültiger Eintrag");
  return {
    month_key: key,
    month_label: str(d.monthLabel, 60),
    imported_at: typeof d.importedAt === "string" ? d.importedAt : undefined,
    entries: (d.entries as Entry[]).map(e => ({ doctor: e.doctor.slice(0, 60), role: str(e.role, 40), date: e.date.slice(0, 10), code: e.code.slice(0, 20) })),
    doctors: Object.fromEntries(Object.entries(d.doctors ?? {}).slice(0, 300).map(([k, v]) => [str(k, 60), str(v, 40)])),
  };
}
function cleanStaff(d: Data) {
  const name = str(d?.name, 60).trim();
  if (!name) throw new AppError("Name fehlt");
  if (!STAFF_ROLES.includes(d.role)) throw new AppError("Ungültige Ebene");
  const share = Number(d.stellenanteil);
  if (!(share > 0 && share <= 1)) throw new AppError("Stellenanteil zwischen 5 und 100 %");
  return {
    name, role: d.role as string, stellenanteil: Math.round(share * 100) / 100,
    qualifications: (Array.isArray(d.qualifications) ? d.qualifications : []).filter((q: string) => QUALIFICATIONS.includes(q)) as string[],
    active: d.active !== false, is_planner: !!(d.isPlanner ?? d.is_planner),
  };
}

const actions: Record<string, (c: Ctx, d: Data) => Promise<unknown>> = {
  /* ───────────── Zugang ───────────── */
  async unlock(c, d) {
    const guard = (await setting<{ fails: number; until: string | null }>(c.db, "unlock_guard")) ?? { fails: 0, until: null };
    const wait = lockedFor(guard.until, c.now);
    if (wait) return { ok: false, error: wait };
    const hash = await setting<string>(c.db, "site_pw_hash");
    if (!hash) throw new AppError("Es ist noch kein Seitenpasswort eingerichtet");
    if (!(await verifyPassword(str(d?.password, 200), hash))) {
      const fails = guard.fails + 1;
      const lock = fails >= 10;
      await saveSetting(c.db, "unlock_guard", { fails: lock ? 0 : fails, until: lock ? iso(c.now + 5 * 60_000) : null });
      return { ok: false, error: "Falsches Passwort" };
    }
    if (guard.fails) await saveSetting(c.db, "unlock_guard", { fails: 0, until: null });
    c.newToken = await signSession(c.env.secret, { unlocked: true, staffId: c.session?.staffId }, c.now);
    return { ok: true };
  },
  async lock(c) {
    c.newToken = "";
    return { ok: true };
  },
  async me(c) {
    const me = await currentStaff(c);
    return { unlocked: !!c.session, me: me ? toMe(me) : null };
  },
  async login(c, d) {
    unlocked(c);
    const [row] = (await c.db.select(T.staff, { where: [["id", "eq", uuid(d?.staffId)], ["active", "eq", true]] })) as Staff[];
    if (!row) return { ok: false, error: "Unbekannte Person" };
    const wait = lockedFor(row.locked_until, c.now);
    if (wait) return { ok: false, error: wait };
    const password = str(d?.password, 200);
    if (row.pw_hash) {
      if (!(await verifyPassword(password, row.pw_hash))) return { ok: false, error: (await failed(c, row)) ?? "Falsches Passwort" };
      await c.db.update(T.staff, { fail_count: 0, locked_until: null }, [["id", "eq", row.id]]);
    } else {
      const code = str(d?.code, 20).trim().toUpperCase();
      if (!row.invite_code || !code || code !== row.invite_code) return { ok: false, error: (await failed(c, row)) ?? "Einladungscode stimmt nicht" };
      if (password.length < MIN_PASSWORD) return { ok: false, error: `Passwort braucht mindestens ${MIN_PASSWORD} Zeichen` };
      await c.db.update(T.staff, { pw_hash: await hashPassword(password), invite_code: null, fail_count: 0, locked_until: null }, [["id", "eq", row.id]]);
    }
    c.newToken = await signSession(c.env.secret, { unlocked: true, staffId: row.id }, c.now);
    return { ok: true, me: toMe(row) };
  },
  async logout(c) {
    unlocked(c);
    c.newToken = await signSession(c.env.secret, { unlocked: true }, c.now);
    return { ok: true };
  },
  async changePassword(c, d) {
    const me = await staff(c);
    if (!(await verifyPassword(str(d?.current, 200), me.pw_hash))) return { ok: false, error: "Aktuelles Passwort stimmt nicht" };
    const next = str(d?.next, 200);
    if (next.length < MIN_PASSWORD) return { ok: false, error: `Passwort braucht mindestens ${MIN_PASSWORD} Zeichen` };
    await c.db.update(T.staff, { pw_hash: await hashPassword(next) }, [["id", "eq", me.id]]);
    return { ok: true };
  },

  /* ───────────── Aktueller Plan ───────────── */
  async base(c, d) {
    unlocked(c);
    const me = await currentStaff(c);
    const [plans, staffRows] = await Promise.all([
      c.db.select(T.plans, { order: ["month_key"] }),
      c.db.select(T.staff, { order: ["standby_pos", "name"] }) as Promise<Staff[]>,
    ]);
    // Drafts are only merged in when a planner explicitly asks for the preview.
    const showDrafts = !!d?.drafts && !!me?.is_planner;
    const rows = plans.filter(r => r.status !== "entwurf" || showDrafts);
    return {
      entries: [], doctors: {},
      imports: rows.map(toImport),
      staff: staffRows.map(r => ({ name: r.name, role: r.role, active: r.active, standbyPos: r.standby_pos })),
      me: me ? toMe(me) : null,
      draftKeys: showDrafts ? rows.filter(r => r.status === "entwurf").map(r => r.month_key as string) : [],
    };
  },
  async savePlan(c, d) {
    await planner(c);
    const plan = cleanPlan(d);
    await c.db.insert(T.plans, [{ ...plan, imported_at: plan.imported_at ?? iso(c.now), status: d?.draft ? "entwurf" : "final" }], "month_key");
    return { ok: true };
  },
  async removePlan(c, d) {
    await planner(c);
    await c.db.remove(T.plans, [["month_key", "eq", month(d?.key)]]);
    return { ok: true };
  },
  async setPlanStatus(c, d) {
    await planner(c);
    if (d?.status !== "final" && d?.status !== "entwurf") throw new AppError("Ungültiger Status");
    const key = month(d?.key);
    await c.db.update(T.plans, { status: d.status }, [["month_key", "eq", key]]);
    // Wishes are only needed until the plan they led to is in force; the plan itself keeps what matters.
    if (d.status === "final") await c.db.remove(T.wishes, [["date", "lt", `${nextMonth(key)}-01`]]);
    return { ok: true };
  },

  /* ───────────── Einspringliste (alle mit Seitenpasswort) ───────────── */
  async moveStandby(c, d) {
    unlocked(c);
    if (!["up", "down", "bottom"].includes(d?.dir)) throw new AppError("Ungültige Richtung");
    const [row] = (await c.db.select(T.staff, { where: [["name", "eq", str(d?.name, 60)], ["active", "eq", true]] })) as Staff[];
    if (!row) throw new AppError("Unbekannte Person");
    await renumber(c.db, row.role, rows => {
      const i = rows.findIndex(r => r.id === row.id);
      const [item] = rows.splice(i, 1);
      rows.splice(d.dir === "bottom" ? rows.length : Math.max(0, Math.min(rows.length, i + (d.dir === "up" ? -1 : 1))), 0, item);
      return rows;
    });
    return { ok: true };
  },
  /** Someone stepped in: note it for the fairness history and send them to the end of their level's list. */
  async markCovered(c, d) {
    unlocked(c);
    const [row] = (await c.db.select(T.staff, { where: [["name", "eq", str(d?.name, 60)], ["active", "eq", true]] })) as Staff[];
    if (!row) throw new AppError("Diese Person steht nicht in der Personalliste");
    await c.db.insert(T.covers, [{ id: crypto.randomUUID(), staff_id: row.id, date: date(d?.date), code: str(d?.code, 20) || null, created_at: iso(c.now) }]);
    await renumber(c.db, row.role, rows => {
      const i = rows.findIndex(r => r.id === row.id);
      rows.push(...rows.splice(i, 1));
      return rows;
    });
    return { ok: true };
  },

  /* ───────────── Planung ───────────── */
  async planning(c, d) {
    unlocked(c);
    const m = month(d?.month);
    const me = await currentStaff(c);
    if (!me) return { month: m, me: null, names: await loginNames(c.db) };
    const [people, pm, rows] = await Promise.all([
      c.db.select(T.staff, { where: [["active", "eq", true]], order: ["name"] }) as Promise<Staff[]>,
      c.db.select(T.months, { where: [["month_key", "eq", m]] }),
      wishesOfMonth(c.db, m),
    ]);
    const all = rows.map(r => ({ staffId: r.staff_id as string, date: r.date as string, code: r.code as string, note: (r.note as string | null) ?? null }));
    // Only counts for the own level leave the server; other people's wishes stay here.
    const { hints, group } = hintsFor(all, people, me);
    const base = {
      month: m, me: toMe(me), names: [],
      locked: !!pm[0]?.locked, deadline: (pm[0]?.deadline as string | null) ?? null,
      mine: all.filter(w => w.staffId === me.id).map(w => ({ date: w.date, code: w.code, note: w.note })),
      hints, group,
    };
    if (!me.is_planner) return base;
    const plans = await c.db.select(T.plans, { order: ["month_key"] });
    const ids = new Set(people.map(p => p.id));
    return {
      ...base,
      planner: {
        people: people.map(p => ({ id: p.id, name: p.name, role: p.role })),
        wishes: all.filter(w => ids.has(w.staffId)),
        plans: plans.map(p => ({ key: p.month_key, label: p.month_label, importedAt: p.imported_at, status: p.status })),
      },
    };
  },
  async setWish(c, d) {
    const me = await staff(c);
    const day = date(d?.date);
    const code = d?.code === null || d?.code === undefined ? null : str(d.code, 10);
    if (code !== null && !isWishCode(code)) throw new AppError("Unbekannter Wunsch");
    const m = day.slice(0, 7);
    if (m < iso(c.now).slice(0, 7)) throw new AppError("Dieser Monat liegt in der Vergangenheit");
    const [pm] = await c.db.select(T.months, { where: [["month_key", "eq", m]] });
    if (pm?.locked) throw new AppError("Die Wunschabgabe für diesen Monat ist geschlossen");
    // The row is always the caller's own: the person comes from the session, never from the request.
    if (code === null) await c.db.remove(T.wishes, [["staff_id", "eq", me.id], ["date", "eq", day]]);
    else await c.db.insert(T.wishes, [{ staff_id: me.id, date: day, code, note: str(d?.note, 200).trim() || null, updated_at: iso(c.now) }], "staff_id,date");
    return { ok: true };
  },
  async setPlanningMonth(c, d) {
    await planner(c);
    await c.db.insert(T.months, [{ month_key: month(d?.month), locked: !!d?.locked, deadline: d?.deadline && DATE_RE.test(d.deadline) ? d.deadline : null }], "month_key");
    return { ok: true };
  },
  /** Everything the roster generator needs for one month, in one file. */
  async export(c, d) {
    await planner(c);
    const m = month(d?.month);
    const [staffRows, rows, merged, covers] = await Promise.all([
      c.db.select(T.staff, { order: ["standby_pos", "name"] }) as Promise<Staff[]>,
      wishesOfMonth(c.db, m), finalSchedule(c.db), c.db.select(T.covers, { order: ["date"] }),
    ]);
    const active = staffRows.filter(s => s.active);
    let first = m;
    for (let i = 0; i < HISTORY_MONTHS; i++) first = prevMonth(first);
    const history = merged.entries.filter(e => e.date.slice(0, 7) >= first && e.date.slice(0, 7) < m && e.code);
    const all = rows.map(r => ({ staffId: r.staff_id as string, date: r.date as string, code: r.code as string, note: r.note as string | null }));
    const nameOf = new Map(staffRows.map(s => [s.id, s.name]));
    return {
      format: "dienstplan-suite/planungspaket@1",
      monat: m,
      erstellt: iso(c.now),
      staff: active.map(s => ({ initialen: s.name, role: ROLE_SHORT[s.role] ?? s.role, stellenanteil: Number(s.stellenanteil), qualifikationen: s.qualifications ?? [] })),
      wuensche: buildWuensche(all, active, m),
      wunsch_notizen: all.filter(w => w.note && nameOf.has(w.staffId)).map(w => ({ name: nameOf.get(w.staffId)!, datum: w.date, notiz: w.note })),
      uebergabe: buildUebergabe(merged.entries, m),
      historie: { monate: [...new Set(history.map(e => e.date.slice(0, 7)))].sort(), eintraege: history.map(e => ({ name: e.doctor, datum: e.date, code: e.code })) },
      einspringen: covers.filter(x => nameOf.has(x.staff_id)).map(x => ({ name: nameOf.get(x.staff_id)!, datum: x.date as string, code: (x.code as string | null) ?? null })),
      einspringliste: Object.fromEntries(STAFF_ROLES.map(r => [r, active.filter(s => s.role === r).map(s => s.name)])),
    };
  },

  /* ───────────── Einstellungen ───────────── */
  async settings(c) {
    unlocked(c);
    const me = await currentStaff(c);
    if (!me) return { me: null, names: await loginNames(c.db), staff: [], standby: [] };
    const rows = (await c.db.select(T.staff, { order: ["name"] })) as Staff[];
    const standby = rows.filter(r => r.active).map(r => ({ name: r.name, role: r.role, active: r.active, standbyPos: r.standby_pos }));
    if (!me.is_planner) return { me: toMe(me), names: [], staff: [], standby };
    return {
      me: toMe(me), names: [], standby,
      staff: rows.map(r => ({
        id: r.id, name: r.name, role: r.role, stellenanteil: Number(r.stellenanteil), qualifications: r.qualifications ?? [],
        active: r.active, isPlanner: r.is_planner, hasAccount: !!r.pw_hash, hasInvite: !!r.invite_code,
      })),
      aiModel: (await setting<string>(c.db, "ai_model")) ?? DEFAULT_MODEL,
      aiReady: !!c.env.openrouterKey,
    };
  },
  async saveStaff(c, d) {
    const me = await planner(c);
    const fields = cleanStaff(d);
    const taken = (await c.db.select(T.staff, { where: [["name", "eq", fields.name]] })) as Staff[];
    if (d?.id) {
      const id = uuid(d.id);
      if (taken.some(t => t.id !== id)) throw new AppError("Diesen Namen gibt es schon");
      // Nobody can lock the last planner out by editing their own row.
      const self = id === me.id;
      await c.db.update(T.staff, { ...fields, active: self ? true : fields.active, is_planner: self ? true : fields.is_planner }, [["id", "eq", id]]);
    } else {
      if (taken.length) throw new AppError("Diesen Namen gibt es schon");
      const [last] = await c.db.select(T.staff, { order: ["standby_pos.desc"], limit: 1 });
      await c.db.insert(T.staff, [{ id: crypto.randomUUID(), ...fields, standby_pos: ((last?.standby_pos as number) ?? 0) + 1, pw_hash: null, invite_code: null, fail_count: 0, locked_until: null }]);
    }
    return { ok: true };
  },
  /** New one-time code; an existing password is cleared, so this is also the password reset. */
  async inviteStaff(c, d) {
    const me = await planner(c);
    const id = uuid(d?.id);
    if (id === me.id) throw new AppError("Das eigene Passwort bitte über „Passwort ändern“ setzen");
    const code = newInviteCode();
    await c.db.update(T.staff, { invite_code: code, pw_hash: null, fail_count: 0, locked_until: null }, [["id", "eq", id]]);
    return { code };
  },
  async setSitePassword(c, d) {
    await planner(c);
    const next = str(d?.password, 200);
    if (next.length < MIN_PASSWORD) return { ok: false, error: `Passwort braucht mindestens ${MIN_PASSWORD} Zeichen` };
    await saveSetting(c.db, "site_pw_hash", await hashPassword(next));
    return { ok: true };
  },
  async setAiModel(c, d) {
    await planner(c);
    const model = str(d?.model, 100).trim();
    if (!/^[\w.:/-]+$/.test(model)) throw new AppError("Ungültiger Modellname");
    await saveSetting(c.db, "ai_model", model);
    return { ok: true };
  },
  /** Full copy of the data without password hashes, to move it elsewhere or keep a backup. */
  async backupExport(c) {
    await planner(c);
    const [staffRows, plans, wishes, covers, months] = await Promise.all([
      c.db.select(T.staff, { order: ["name"] }) as Promise<Staff[]>, c.db.select(T.plans, { order: ["month_key"] }),
      c.db.select(T.wishes, { order: ["date"] }), c.db.select(T.covers, { order: ["date"] }), c.db.select(T.months, { order: ["month_key"] }),
    ]);
    const nameOf = new Map(staffRows.map(s => [s.id, s.name]));
    return {
      format: "dienstplan/backup@1", erstellt: iso(c.now),
      staff: staffRows.map(s => ({ name: s.name, role: s.role, stellenanteil: Number(s.stellenanteil), qualifications: s.qualifications ?? [], active: s.active, isPlanner: s.is_planner, standbyPos: s.standby_pos })),
      plans: plans.map(p => ({ key: p.month_key, monthLabel: p.month_label, importedAt: p.imported_at, status: p.status, entries: p.entries, doctors: p.doctors })),
      wishes: wishes.filter(w => nameOf.has(w.staff_id)).map(w => ({ name: nameOf.get(w.staff_id), date: w.date, code: w.code, note: w.note ?? null })),
      covers: covers.filter(x => nameOf.has(x.staff_id)).map(x => ({ name: nameOf.get(x.staff_id), date: x.date, code: x.code ?? null })),
      months: months.map(x => ({ month: x.month_key, locked: x.locked, deadline: x.deadline ?? null })),
    };
  },
  /** Adds what the file has; people are matched by name, existing accounts and passwords stay untouched. */
  async backupImport(c, d) {
    const me = await planner(c);
    if (d?.format !== "dienstplan/backup@1") throw new AppError("Das ist keine Dienstplan-Sicherung");
    const existing = new Map(((await c.db.select(T.staff)) as Staff[]).map(s => [s.name, s]));
    let people = 0;
    for (const raw of (Array.isArray(d.staff) ? d.staff : []).slice(0, 500)) {
      const f = cleanStaff(raw);
      const pos = Number.isFinite(Number(raw.standbyPos)) ? Number(raw.standbyPos) : 0;
      const old = existing.get(f.name);
      if (old) await c.db.update(T.staff, old.id === me.id ? { ...f, active: true, is_planner: true, standby_pos: pos } : { ...f, standby_pos: pos }, [["id", "eq", old.id]]);
      else {
        const row = { id: crypto.randomUUID(), ...f, standby_pos: pos, pw_hash: null, invite_code: null, fail_count: 0, locked_until: null };
        await c.db.insert(T.staff, [row]);
        existing.set(f.name, row as Staff);
      }
      people++;
    }
    const plans = (Array.isArray(d.plans) ? d.plans : []).slice(0, 120).map((p: Data) => {
      const plan = cleanPlan(p);
      return { ...plan, imported_at: plan.imported_at ?? iso(c.now), status: p.status === "entwurf" ? "entwurf" : "final" };
    });
    await c.db.insert(T.plans, plans, "month_key");
    const wishes = (Array.isArray(d.wishes) ? d.wishes : []).filter((w: Data) => existing.has(w?.name) && DATE_RE.test(w.date) && isWishCode(w.code))
      .map((w: Data) => ({ staff_id: existing.get(w.name)!.id, date: w.date, code: w.code, note: str(w.note, 200) || null, updated_at: iso(c.now) }));
    await c.db.insert(T.wishes, wishes, "staff_id,date");
    const covers = (Array.isArray(d.covers) ? d.covers : []).filter((x: Data) => existing.has(x?.name) && DATE_RE.test(x.date))
      .map((x: Data) => ({ id: crypto.randomUUID(), staff_id: existing.get(x.name)!.id, date: x.date, code: str(x.code, 20) || null, created_at: iso(c.now) }));
    await c.db.insert(T.covers, covers);
    const months = (Array.isArray(d.months) ? d.months : []).filter((x: Data) => MONTH_RE.test(x?.month))
      .map((x: Data) => ({ month_key: x.month, locked: !!x.locked, deadline: x.deadline && DATE_RE.test(x.deadline) ? x.deadline : null }));
    await c.db.insert(T.months, months, "month_key");
    return { people, plans: plans.length, wishes: wishes.length, covers: covers.length };
  },

  /* ───────────── KI-Assistent ───────────── */
  async ask(c, d) {
    unlocked(c);
    if (!c.env.openrouterKey) return { ok: false, error: "Der KI-Schlüssel ist noch nicht hinterlegt." };
    const today = DATE_RE.test(d?.today) ? d.today : iso(c.now).slice(0, 10);
    const wStart = DATE_RE.test(d?.weekStart) ? d.weekStart : today;
    const wEnd = DATE_RE.test(d?.weekEnd) ? d.weekEnd : addDays(wStart, 6);
    const history = (Array.isArray(d?.messages) ? d.messages : []).slice(-12)
      .map((m: Data) => ({ role: m.role === "assistant" ? "assistant" : "user", content: str(m.content, 4000) }));
    const [sched, staffRows] = await Promise.all([finalSchedule(c.db), c.db.select(T.staff) as Promise<Staff[]>]);
    for (const s of staffRows) sched.doctors[s.name] = s.role;
    const names = Object.keys(sched.doctors);
    const chefs = names.filter(n => sched.doctors[n] === "Chefarzt");
    const dayPlan = (day: string) => sched.entries.filter(e => e.date === day && e.code).map(e => `${e.doctor} (${e.role}): ${e.code}`).join("\n") || "keine Einträge";
    const runTool = (name: string, args: Data): string => {
      if (name === "resolve_doctor") { const r = resolveDoctor(String(args.name ?? ""), names); return r.length ? r.join(", ") : "Kein passender Name."; }
      if (name === "get_week") return weekTable(sched.entries, args.start || wStart);
      if (name === "check_constraints") {
        const rules = (Array.isArray(args.rules) ? args.rules : []).map((r: Data) => ({ ...r, doctor: resolveDoctor(String(r.doctor ?? ""), names)[0] ?? r.doctor }));
        return describeConstraints(checkConstraints(sched.entries, sched.doctors, args.start || wStart, args.end || wEnd, rules));
      }
      if (name === "get_day") return dayPlan(String(args.date));
      if (name === "find_options") {
        const sols = solveOutage(sched.entries, sched.doctors, { date: args.date, code: args.code, doctor: args.doctor || undefined });
        return sols.length ? sols.map(describeSolution).join("\n") : "Keine regelkonforme Lösung gefunden.";
      }
      return "Unbekanntes Tool";
    };
    const system = `Du bist der Dienstplan-Assistent einer Notaufnahme. Heute ist ${today} (morgen ${addDays(today, 1)}).
Antworte kurz auf Deutsch. Erfinde NIE Personen oder Lösungen: nutze get_day, um zu sehen, wer welchen Dienst hat, und find_options, um geprüfte Lösungen (direkter Ersatz, Tausch am selben Tag, Tausch zwischen zwei Tagen, Ringtausch) nach Arbeitszeitgesetz zu erhalten.
Codes: F Früh, Z/Z1/Z2 Zwischen, S Spät, N Nacht, NEF1/NEF3/NEF24 Notarzt, TNA Telenotarzt, X Freiwunsch, U Urlaub, DF dienstfrei.
Wenn der Nutzer "der Nachtdienst" sagt und es mehrere gibt, schau mit get_day nach und frage ggf. nach. Nenne am Ende konkret, wen man anrufen soll, in Reihenfolge der einfachsten Lösung.${chefs.length ? ` ${chefs.join(", ")} (Chefarzt-Ebene) springt nie ein.` : ""}
Der Nutzer schaut gerade auf die Woche ${wStart} bis ${wEnd} (Mo–So). "Diese Woche", Wochentage wie "Mittwoch" und Fragen ohne Datum beziehen sich auf DIESE Woche.
Ärzte im Plan: ${names.join(", ")}. Namen werden oft falsch geschrieben oder diktiert: rufe resolve_doctor für jeden Namen auf, der nicht exakt in der Liste steht.
Nennt der Nutzer Vorgaben ("X kann keine Nächte", "Y keine Wochenenden", "Z am Freitag nicht"), rufe SOFORT check_constraints für die angezeigte Woche auf, statt nachzufragen. Antworte dann: zuerst je betroffenem Dienst Datum, Wochentag, Person, Code; darunter die beste(n) geprüfte(n) Lösung(en) und wen man anrufen soll. Keine allgemeinen Ratschläge, keine Floskeln. Wenn für eine Person keine Vorgabe genannt wurde und sie nichts verletzt, sag das in einem Satz.`;
    const fn = (name: string, description: string, parameters: Data) => ({ type: "function", function: { name, description, parameters } });
    const tools = [
      fn("resolve_doctor", "Ordnet einen (falsch geschriebenen) Namen dem Arzt im Plan zu", { type: "object", properties: { name: { type: "string" } }, required: ["name"] }),
      fn("get_week", "Alle Dienste einer Woche (Mo–So) ab start", { type: "object", properties: { start: { type: "string", description: "YYYY-MM-DD Montag" } } }),
      fn("check_constraints", "Findet Dienste im Zeitraum, die gegen Vorgaben verstoßen, und liefert für jeden ArbZG-geprüfte Lösungen (Vorgaben gelten auch für Ersatzleute)", {
        type: "object", required: ["rules"],
        properties: { start: { type: "string" }, end: { type: "string" }, rules: { type: "array", items: { type: "object", required: ["doctor"], properties: { doctor: { type: "string" }, noCodes: { type: "array", items: { type: "string" }, description: 'z. B. ["N"] für keine Nächte' }, noWeekend: { type: "boolean" }, noDates: { type: "array", items: { type: "string" } } } } } },
      }),
      fn("get_day", "Alle Einträge eines Tages", { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" } }, required: ["date"] }),
      fn("find_options", "Geprüfte Lösungen für einen ausgefallenen Dienst", { type: "object", properties: { date: { type: "string" }, code: { type: "string", description: "Dienstcode, z. B. N" }, doctor: { type: "string", description: "Wer fällt aus (optional)" } }, required: ["date", "code"] }),
    ];
    const model = (await setting<string>(c.db, "ai_model")) ?? DEFAULT_MODEL;
    const messages: Data[] = [{ role: "system", content: system }, ...history];
    const f = c.env.fetch ?? fetch;
    for (let i = 0; i < 8; i++) {
      const res = await f("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${c.env.openrouterKey}`, "Content-Type": "application/json", "X-Title": "Dienstplan" },
        body: JSON.stringify({ model, messages, tools }),
      });
      if (!res.ok) {
        console.error("openrouter", res.status, (await res.text()).slice(0, 300));
        return { ok: false, error: res.status === 402 ? "KI-Guthaben aufgebraucht." : res.status === 401 ? "Der KI-Schlüssel wird nicht akzeptiert." : "Die KI ist gerade nicht erreichbar. Bitte später erneut versuchen." };
      }
      const msg = ((await res.json()) as Data)?.choices?.[0]?.message;
      if (!msg) break;
      const calls = (msg.tool_calls ?? []) as Data[];
      if (!calls.length) return { ok: true, answer: String(msg.content ?? "") };
      messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: calls });
      for (const call of calls) {
        let args: Data = {};
        try { args = JSON.parse(call.function?.arguments || "{}"); } catch { /* the model sent broken JSON; run the tool without arguments */ }
        messages.push({ role: "tool", tool_call_id: call.id, content: runTool(call.function?.name, args) });
      }
    }
    return { ok: false, error: "Keine Antwort erhalten." };
  },
};

export interface Reply { ok: boolean; result?: unknown; error?: string; code?: string; token?: string; }

/** One request in, one answer out. `token` in the answer replaces the browser's session ("" ends it). */
export async function dispatch(env: Env, action: string, data: unknown, token?: string | null): Promise<Reply> {
  const run = Object.hasOwn(actions, action) ? actions[action] : null;
  if (!run) return { ok: false, error: "Unbekannte Aktion" };
  const now = env.now?.() ?? Date.now();
  const ctx: Ctx = { env, db: env.db, now, session: await readSession(env.secret, token, now) };
  try {
    const result = await run(ctx, (data ?? {}) as Data);
    return { ok: true, result, ...(ctx.newToken !== undefined ? { token: ctx.newToken } : {}) };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message, code: err.code };
    console.error(action, err);
    return { ok: false, error: "Das hat nicht geklappt. Bitte später erneut versuchen." };
  }
}

const cors = (origin: string | null, allowed: string[]) => ({
  "Access-Control-Allow-Origin": origin && allowed.includes(origin) ? origin : allowed[0],
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-dp-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

export async function handle(req: Request, env: Env, allowedOrigins: string[]): Promise<Response> {
  const headers = { ...cors(req.headers.get("origin"), allowedOrigins), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "Nur POST" }), { status: 405, headers });
  let body: { action?: string; data?: unknown };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ ok: false, error: "Ungültige Anfrage" }), { status: 400, headers }); }
  const reply = await dispatch(env, String(body.action ?? ""), body.data, req.headers.get("x-dp-session"));
  return new Response(JSON.stringify(reply), { status: 200, headers });
}
