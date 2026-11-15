import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { unlockSite } from "@/lib/gate.functions";

export function Unlock() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await unlockSite({ data: { password: String(new FormData(e.currentTarget).get("password") ?? "") } });
      if (res.ok) await router.invalidate();
      else setError(res.error ?? "Falsches Passwort");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Das hat nicht geklappt");
    }
    setBusy(false);
  }

  return (
    <div className="app-shell app-wait">
      <form onSubmit={onSubmit} className="login-box">
        <h2>Dienstplan</h2>
        <label>
          <span>Passwort</span>
          <input name="password" type="password" autoFocus autoComplete="current-password" className="field" required />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="assistant-btn" disabled={busy}>{busy ? "…" : "Öffnen"}</button>
      </form>
    </div>
  );
}
