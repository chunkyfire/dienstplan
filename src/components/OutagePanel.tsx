import { useMemo } from "react";
import { solveOutage, TYPE_LABEL, type Outage, type SEntry, type SolutionType } from "@/lib/swapSolver";
import { ROLE_COLOR } from "@/lib/shifts";

function fmt(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
}
const HINT: Record<SolutionType, string> = {
  direct: "Eine Person anrufen",
  sameDay: "Jemand wechselt die Schicht, ein Freier füllt nach",
  twoDay: "Ersatz gibt dafür einen Dienst am Nachbartag ab",
  ring: "Drei Personen verschieben sich",
};

export function OutagePanel({ outage, entries, doctors, onClose }: { outage: Outage; entries: SEntry[]; doctors: Record<string, string>; onClose: () => void }) {
  const sols = useMemo(() => solveOutage(entries, doctors, outage), [entries, doctors, outage]);
  const types: SolutionType[] = ["direct", "sameDay", "twoDay", "ring"];
  return (
    <aside className="outage-panel" role="dialog" aria-label="Ausfall lösen">
      <div className="outage-head">
        <div>
          <p className="outage-kicker">Ausfall</p>
          <h2>{outage.doctor} · <span className="shift-pill">{outage.code}</span> · {fmt(outage.date)}</h2>
        </div>
        <button className="nav-btn" onClick={onClose} aria-label="Schließen">×</button>
      </div>
      {sols.length === 0 && <p className="outage-empty">Keine Lösung, die das Arbeitszeitgesetz einhält.</p>}
      {types.map(t => {
        const list = sols.filter(s => s.type === t);
        if (!list.length) return null;
        return (
          <section key={t} className="outage-group">
            <h3>{TYPE_LABEL[t]} <small>{HINT[t]}</small></h3>
            {list.map((s, i) => (
              <div key={i} className="outage-card">
                <div className="outage-call">Anrufen: {s.call.join(", ")}</div>
                <ol>
                  {s.moves.map((m, j) => (
                    <li key={j}>
                      <span className="doc-dot" style={{ background: ROLE_COLOR[m.role] }} />
                      <b>{m.doctor}</b> {fmt(m.date)}: <span className="mv-from">{m.from}</span> → <span className="mv-to">{m.to}</span>
                    </li>
                  ))}
                </ol>
                {s.warnings.length > 0 && <div className="outage-warn">⚠ {s.warnings.join(" · ")}</div>}
              </div>
            ))}
          </section>
        );
      })}
      <p className="outage-foot">Geprüft: 11 h Ruhezeit, max. 24 h am Stück, Freiwünsche (X), Urlaub/Krank, Hierarchie, NEF-Erfahrung. Die Chefarzt-Ebene wird nie vorgeschlagen.</p>
    </aside>
  );
}
