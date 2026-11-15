import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askAssistant, type ChatMsg } from "@/lib/assistant.functions";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AskAssistant({ weekStart, weekEnd, label }: { weekStart: string; weekEnd: string; label: string }) {
  const ask = useServerFn(askAssistant);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const r = await ask({ data: { messages: next, today: todayISO(), weekStart, weekEnd } });
      setMsgs([...next, { role: "assistant", content: r.ok ? r.answer : `⚠ ${r.error}` }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "⚠ Anfrage fehlgeschlagen." }]);
    } finally { setBusy(false); }
  }

  return (
    <section className="assistant">
      <h2>Ausfall-Assistent</h2>
      <p className="assistant-sub">Frag z. B.: „Mittwoch fällt der Nachtdienst aus – wen kann ich anrufen?" oder „Dr. A kann keine Nächte, Dr. B keine Wochenenden – was tun?"</p>
      {msgs.length > 0 && (
        <div className="assistant-log" aria-live="polite">
          {msgs.map((m, i) => <div key={i} className={`assistant-msg is-${m.role}`}>{m.content.split(/\*\*(.+?)\*\*/g).map((t, j) => j % 2 ? <b key={j}>{t}</b> : t)}</div>)}
          {busy && <div className="assistant-msg is-assistant">Prüfe Dienstplan …</div>}
        </div>
      )}
      <form onSubmit={send} className="assistant-form">
        <input value={input} onChange={e => setInput(e.target.value)} aria-label="Frage an den Assistenten" placeholder="Wer kann Mittwoch den Spätdienst übernehmen?" className="assistant-input" />
        <button className="assistant-btn" disabled={busy}>Fragen</button>
      </form>
      <p className="assistant-scope">Bezieht sich auf die angezeigte Woche: {label}</p>
    </section>
  );
}
