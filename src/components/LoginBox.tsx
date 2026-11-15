import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { login, type LoginName } from "@/lib/suite.functions";

/** Personal sign-in: pick your name, then your password. The first time, the invite code from planning sets it. */
export function LoginBox({ names, purpose }: { names: LoginName[]; purpose: string }) {
  const router = useRouter();
  const loginFn = useServerFn(login);
  const [staffId, setStaffId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const person = names.find(n => n.id === staffId);
  const first = !!person && !person.hasAccount;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await loginFn({ data: { staffId, password: String(form.get("password") ?? ""), code: String(form.get("code") ?? "") } });
      if (res.ok) await router.invalidate();
      else setError(res.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen");
    }
    setBusy(false);
  }

  return (
    <form className="login-box" onSubmit={onSubmit}>
      <h2>Anmelden</h2>
      <p className="assistant-sub">{purpose}</p>
      <label>
        <span>Name</span>
        <select className="field" value={staffId} onChange={e => { setStaffId(e.target.value); setError(null); }} required>
          <option value="">Bitte wählen</option>
          {names.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
      </label>
      {first && (
        <label>
          <span>Einladungscode</span>
          <input name="code" className="field" autoComplete="one-time-code" autoCapitalize="characters" required />
          <small>Den Code bekommst du von der Dienstplanung. Er gilt einmal.</small>
        </label>
      )}
      {person && (
        <label>
          <span>{first ? "Neues Passwort (mindestens 8 Zeichen)" : "Passwort"}</span>
          <input name="password" type="password" className="field" autoComplete={first ? "new-password" : "current-password"} minLength={first ? 8 : undefined} required />
        </label>
      )}
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="assistant-btn" disabled={busy || !person}>{busy ? "…" : first ? "Konto einrichten" : "Anmelden"}</button>
    </form>
  );
}
