import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { moveStandby } from "@/lib/suite.functions";
import { ROLE_COLOR } from "@/lib/shifts";
import type { StaffInfo } from "@/lib/scheduleStore";

const LEVELS = ["Oberarzt", "Facharzt", "Assistenzarzt"];

/** Stand-in order per level. Whoever stepped in last is at the bottom; the top two are asked first. */
export function StandbyList({ staff, onChanged }: { staff: StaffInfo[]; onChanged: () => void }) {
  const moveFn = useServerFn(moveStandby);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!staff.length) return null;

  async function move(name: string, dir: "up" | "down" | "bottom") {
    setBusy(true);
    setError(null);
    try { await moveFn({ data: { name, dir } }); onChanged(); }
    catch (err) { setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen"); }
    setBusy(false);
  }

  return (
    <details className="legend standby">
      <summary>Einspringliste</summary>
      <p className="assistant-sub">Oben steht, wer als Nächstes gefragt wird. Wer einspringt, rutscht ans Ende. Die Reihenfolge gilt sofort für alle Tage.</p>
      {error && <p className="form-error">{error}</p>}
      <div className="legend-body">
        {LEVELS.map(level => {
          const list = staff.filter(s => s.active && s.role === level).sort((a, b) => a.standbyPos - b.standbyPos || a.name.localeCompare(b.name, "de"));
          return (
            <div key={level}>
              <h4><span className="doc-dot" style={{ background: ROLE_COLOR[level] }} /> {level}</h4>
              <ol className="standby-list">
                {list.map((s, i) => (
                  <li key={s.name}>
                    <span className="standby-pos">{i + 1}</span>
                    <span className="standby-name">{s.name}</span>
                    <button className="nav-btn" disabled={busy || i === 0} onClick={() => move(s.name, "up")} aria-label={`${s.name} nach oben`}>↑</button>
                    <button className="nav-btn" disabled={busy || i === list.length - 1} onClick={() => move(s.name, "down")} aria-label={`${s.name} nach unten`}>↓</button>
                    <button className="nav-btn" disabled={busy || i === list.length - 1} onClick={() => move(s.name, "bottom")} title="Ist eingesprungen: ans Ende" aria-label={`${s.name} ans Ende`}>⤓</button>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </details>
  );
}
