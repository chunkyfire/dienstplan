import { useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { backupExport, backupImport, changePassword, inviteStaff, saveStaff, setAiModel, setSitePassword, STAFF_ROLES, QUALIFICATIONS, type LoginName, type Me, type StaffAdmin } from "@/lib/suite.functions";
import { SuiteTabs } from "@/components/SuiteTabs";
import { LoginBox } from "@/components/LoginBox";

export interface SettingsData { me: Me | null; names: LoginName[]; staff: StaffAdmin[]; aiModel?: string; aiReady?: boolean; }

const BLANK: StaffAdmin = { id: "", name: "", role: "Assistenzarzt", stellenanteil: 1, qualifications: [], active: true, isPlanner: false, hasAccount: false, hasInvite: false };

export function Einstellungen({ data }: { data: SettingsData }) {
  const { me } = data;
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <div className="brand-mark" aria-hidden />
            <div><h1>Dienstplan</h1><p>Einstellungen</p></div>
          </div>
        </div>
      </header>
      <SuiteTabs active="einstellungen" me={me} />
      <main className="app-main">
        {!me ? <LoginBox names={data.names} purpose="Einstellungen sind an dein persönliches Konto gebunden." /> : (
          <>
            {me.isPlanner && <StaffTable staff={data.staff} meId={me.id} />}
            <PasswordForm />
            {me.isPlanner && <AdminTools data={data} />}
          </>
        )}
      </main>
    </div>
  );
}

function PasswordForm() {
  const changeFn = useServerFn(changePassword);
  const [message, setMessage] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const res = await changeFn({ data: { current: String(form.get("current") ?? ""), next: String(form.get("next") ?? "") } });
    setMessage(res.ok ? "Passwort geändert." : res.error);
    if (res.ok) formEl.reset();
  }
  return (
    <form className="login-box" onSubmit={onSubmit}>
      <h2>Passwort ändern</h2>
      <label><span>Aktuelles Passwort</span><input name="current" type="password" className="field" autoComplete="current-password" required /></label>
      <label><span>Neues Passwort (mindestens 8 Zeichen)</span><input name="next" type="password" className="field" autoComplete="new-password" minLength={8} required /></label>
      {message && <p className="planner-message">{message}</p>}
      <button type="submit" className="assistant-btn">Speichern</button>
    </form>
  );
}

function StaffTable({ staff, meId }: { staff: StaffAdmin[]; meId: string }) {
  return (
    <section className="planner">
      <h2>Personal</h2>
      <p className="assistant-sub">
        Diese Liste gilt für die ganze App: Ebene, Einspringliste, Wunschabgabe und Export. Der Name muss so geschrieben sein wie im Dienstplan.
        Wer geht, wird auf „nicht aktiv“ gesetzt, alte Pläne bleiben damit lesbar.
      </p>
      <div className="matrix-wrap">
        <table className="staff-table">
          <thead>
            <tr><th>Name</th><th>Ebene</th><th>Stelle</th><th>Qualifikation</th><th>Aktiv</th><th>Planer</th><th>Konto</th><th /></tr>
          </thead>
          <tbody>
            {staff.map(s => <StaffRowEdit key={s.id} initial={s} self={s.id === meId} />)}
            <StaffRowEdit key={`new-${staff.length}`} initial={BLANK} self={false} />
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StaffRowEdit({ initial, self }: { initial: StaffAdmin; self: boolean }) {
  const router = useRouter();
  const saveFn = useServerFn(saveStaff);
  const inviteFn = useServerFn(inviteStaff);
  const [row, setRow] = useState(initial);
  const [note, setNote] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const isNew = !initial.id;
  const dirty = JSON.stringify(row) !== JSON.stringify(initial);
  const set = (patch: Partial<StaffAdmin>) => { setRow(r => ({ ...r, ...patch })); setNote(null); };

  async function save() {
    try {
      await saveFn({ data: { id: row.id || undefined, name: row.name, role: row.role, stellenanteil: row.stellenanteil, qualifications: row.qualifications, active: row.active, isPlanner: row.isPlanner } });
      await router.invalidate();
      setNote("Gespeichert");
    } catch (err) { setNote(err instanceof Error ? err.message : "Speichern fehlgeschlagen"); }
  }
  async function invite() {
    try { setCode((await inviteFn({ data: { id: row.id } })).code); await router.invalidate(); }
    catch (err) { setNote(err instanceof Error ? err.message : "Code konnte nicht erzeugt werden"); }
  }

  return (
    <tr className={row.active ? "" : "is-inactive"}>
      <td><input className="field" value={row.name} placeholder={isNew ? "Neue Person" : ""} onChange={e => set({ name: e.target.value })} aria-label="Name" /></td>
      <td>
        <select className="field" value={row.role} onChange={e => set({ role: e.target.value })} aria-label="Ebene">
          {STAFF_ROLES.map(r => <option key={r}>{r}</option>)}
        </select>
      </td>
      <td><input className="field share-input" type="number" min={5} max={100} step={5} value={Math.round(row.stellenanteil * 100)} onChange={e => set({ stellenanteil: Number(e.target.value) / 100 })} aria-label="Stellenanteil in Prozent" /> %</td>
      <td className="quali">
        {QUALIFICATIONS.map(q => (
          <label key={q}>
            <input type="checkbox" checked={row.qualifications.includes(q)} onChange={e => set({ qualifications: e.target.checked ? [...row.qualifications, q] : row.qualifications.filter(x => x !== q) })} /> {q}
          </label>
        ))}
      </td>
      <td><input type="checkbox" checked={row.active} disabled={self} onChange={e => set({ active: e.target.checked })} aria-label="Aktiv" /></td>
      <td><input type="checkbox" checked={row.isPlanner} disabled={self} onChange={e => set({ isPlanner: e.target.checked })} aria-label="Planer" /></td>
      <td>
        {isNew ? "" : code ? <span className="invite-code" title="Einmal gültig. Bitte persönlich weitergeben.">{code}</span>
          : self ? "angemeldet"
          : <button className="btn-plain btn-sm" onClick={invite}>{initial.hasAccount ? "Passwort zurücksetzen" : initial.hasInvite ? "Neuen Code erzeugen" : "Einladungscode"}</button>}
      </td>
      <td>
        {(dirty || isNew) && <button className="assistant-btn btn-sm" disabled={!row.name.trim()} onClick={save}>{isNew ? "Anlegen" : "Speichern"}</button>}
        {note && <small className="row-note">{note}</small>}
      </td>
    </tr>
  );
}

function AdminTools({ data }: { data: SettingsData }) {
  const router = useRouter();
  const sitePwFn = useServerFn(setSitePassword);
  const modelFn = useServerFn(setAiModel);
  const exportFn = useServerFn(backupExport);
  const importFn = useServerFn(backupImport);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<string | void>) {
    setBusy(true);
    setMessage(null);
    try { const done = await action(); await router.invalidate(); if (done) setMessage(done); }
    catch (err) { setMessage(err instanceof Error ? err.message : "Das hat nicht geklappt"); }
    setBusy(false);
  }
  async function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(await exportFn(), null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `dienstplan-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function upload(file: File) {
    let parsed: unknown;
    try { parsed = JSON.parse(await file.text()); } catch { throw new Error("Die Datei ist keine gültige Sicherung"); }
    const r = await importFn({ data: parsed });
    return `Übernommen: ${r.people} Personen, ${r.plans} Monatspläne, ${r.wishes} Wünsche, ${r.covers} Einspring-Einträge.`;
  }

  return (
    <section className="planner">
      <h2>Verwaltung</h2>
      {message && <p className="planner-message">{message}</p>}

      <form className="admin-row" onSubmit={e => {
        e.preventDefault();
        const formEl = e.currentTarget;
        const password = String(new FormData(formEl).get("password") ?? "");
        void run(async () => { const r = await sitePwFn({ data: { password } }); if (!r.ok) throw new Error(r.error); formEl.reset(); return "Seitenpasswort geändert. Wer schon angemeldet ist, bleibt es."; });
      }}>
        <label><span>Neues Seitenpasswort für alle (mindestens 8 Zeichen)</span><input name="password" type="password" className="field" autoComplete="new-password" minLength={8} required /></label>
        <button className="btn-plain" disabled={busy}>Ändern</button>
      </form>

      <form className="admin-row" onSubmit={e => {
        e.preventDefault();
        const model = String(new FormData(e.currentTarget).get("model") ?? "").trim();
        void run(async () => { await modelFn({ data: { model } }); return "KI-Modell gespeichert."; });
      }}>
        <label>
          <span>KI-Modell des Ausfall-Assistenten (OpenRouter-Bezeichnung)</span>
          <input name="model" className="field" defaultValue={data.aiModel ?? ""} key={data.aiModel} required />
        </label>
        <button className="btn-plain" disabled={busy}>Speichern</button>
      </form>
      {!data.aiReady && <p className="form-error">Der OpenRouter-Schlüssel ist noch nicht hinterlegt, der Assistent antwortet deshalb nicht.</p>}

      <div className="admin-row">
        <button className="btn-plain" disabled={busy} onClick={() => run(download)}>Sicherung herunterladen</button>
        <button className="btn-plain" disabled={busy} onClick={() => fileRef.current?.click()}>Sicherung einspielen</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void run(() => upload(f)); }} />
      </div>
      <p className="assistant-sub">Die Sicherung enthält Personal, alle Pläne, Wünsche und die Einspring-Historie, aber keine Passwörter. Beim Einspielen werden Personen über den Namen zugeordnet; bestehende Konten bleiben unberührt.</p>
    </section>
  );
}
