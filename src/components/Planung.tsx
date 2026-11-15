import { useMemo, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getExport, setPlanningMonth, setPlanStatus, setWish, type LoginName, type Me } from "@/lib/suite.functions";
import { saveScheduleImport } from "@/lib/gate.functions";
import { parseSchedulePdf } from "@/lib/parseSchedulePdf";
import { toStoredImport } from "@/lib/scheduleStore";
import { WISH_CODES, wishMeta, hintLevel, hintText, daysInMonth, nextMonth, prevMonth, type DayHint } from "@/lib/wishes";
import { ROLE_COLOR, ROLE_ORDER } from "@/lib/shifts";
import { dateFromISO, dayFlags, localTodayISO } from "@/lib/dates";
import { SuiteTabs } from "@/components/SuiteTabs";
import { LoginBox } from "@/components/LoginBox";

interface Wish { date: string; code: string; note: string | null; }
interface Person { id: string; name: string; role: string; }
export interface PlanningData {
  month: string;
  me: Me | null;
  names: LoginName[];
  locked?: boolean;
  deadline?: string | null;
  mine?: Wish[];
  hints?: Record<string, DayHint>;
  group?: number;
  planner?: {
    people: Person[];
    wishes: { staffId: string; date: string; code: string; note: string | null }[];
    plans: { key: string; label: string; importedAt: string; status: string }[];
  };
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const monthLabel = (m: string) => dateFromISO(`${m}-01`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
const fmtDate = (iso: string) => dateFromISO(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const pillClass = (code: string) => `wish-pill wish-${wishMeta(code)?.kind ?? "dienst"}`;
const pillText = (code: string) => (code.startsWith("!") ? `kein ${code.slice(1)}` : code);

/** Month as rows of seven cells starting on Monday; null pads the first and last week. */
function monthGrid(month: string): (string | null)[] {
  const n = daysInMonth(month);
  const lead = (dateFromISO(`${month}-01`).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= n; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function Planung({ data }: { data: PlanningData }) {
  const router = useRouter();
  const { month, me } = data;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <div className="brand-mark" aria-hidden />
            <div>
              <h1>Dienstplan</h1>
              <p>Planung · {monthLabel(month)}</p>
            </div>
          </div>
        </div>
      </header>
      <SuiteTabs active="planung" me={me} />
      <main className="app-main">
        {!me ? (
          <LoginBox names={data.names} purpose="Für Dienstwünsche meldest du dich persönlich an. So kann jede Person nur ihre eigenen Wünsche sehen und ändern." />
        ) : (
          <>
            <div className="toolbar">
              <div className="period-nav">
                <button className="nav-btn" onClick={() => router.navigate({ to: "/planung", search: { m: prevMonth(month) } })} aria-label="Monat zurück">‹</button>
                <span className="period-label">{monthLabel(month)}</span>
                <button className="nav-btn" onClick={() => router.navigate({ to: "/planung", search: { m: nextMonth(month) } })} aria-label="Monat vor">›</button>
              </div>
            </div>
            <MyWishes data={data} />
            {data.planner && <PlannerPanel data={data} />}
          </>
        )}
      </main>
    </div>
  );
}

function MyWishes({ data }: { data: PlanningData }) {
  const router = useRouter();
  const setFn = useServerFn(setWish);
  const { month, hints = {}, group = 0 } = data;
  const [pen, setPen] = useState<string | null>("X");
  const [pending, setPending] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);

  const mine = useMemo(() => {
    const map = new Map((data.mine ?? []).map(w => [w.date, w.code]));
    for (const [date, code] of Object.entries(pending)) { if (code === null) map.delete(date); else map.set(date, code); }
    return map;
  }, [data.mine, pending]);

  const past = month < localTodayISO().slice(0, 7);
  const readOnly = !!data.locked || past;

  async function toggle(date: string) {
    if (readOnly) return;
    const code = pen !== null && mine.get(date) !== pen ? pen : null;
    if (code === null && !mine.has(date)) return;
    setError(null);
    setPending(p => ({ ...p, [date]: code }));
    try {
      await setFn({ data: { date, code } });
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    }
    setPending(p => { const { [date]: _done, ...rest } = p; return rest; });
  }

  return (
    <section className="wish-section">
      <div className="wish-head">
        <h2>Meine Wünsche</h2>
        <p className="assistant-sub">
          {data.locked ? "Die Wunschabgabe für diesen Monat ist geschlossen." : past ? "Dieser Monat ist vorbei." : data.deadline ? `Abgabe bis ${fmtDate(data.deadline)}.` : "Wunsch auswählen, dann die Tage antippen. Noch einmal antippen nimmt ihn zurück."}
        </p>
      </div>

      {!readOnly && (
        <div className="pen-bar" role="radiogroup" aria-label="Wunsch auswählen">
          {WISH_CODES.map(w => (
            <button key={w.code} role="radio" aria-checked={pen === w.code} className={`pen ${pen === w.code ? "is-active" : ""}`} onClick={() => setPen(w.code)}>
              <span className={pillClass(w.code)}>{pillText(w.code)}</span>{w.label}
            </button>
          ))}
          <button role="radio" aria-checked={pen === null} className={`pen ${pen === null ? "is-active" : ""}`} onClick={() => setPen(null)}>Löschen</button>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <div className="wish-grid">
        {WEEKDAYS.map(d => <div key={d} className="wish-weekday">{d}</div>)}
        {monthGrid(month).map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="wish-day is-pad" aria-hidden />;
          const flags = dayFlags(date);
          const code = mine.get(date);
          const hint = hints[date];
          const level = hintLevel(hint, group);
          const lines = hintText(hint, code);
          return (
            <button
              key={date}
              type="button"
              disabled={readOnly}
              className={`wish-day ${flags.isWeekend ? "is-weekend" : ""} ${flags.holidayName ? "is-holiday" : ""} ${code ? "has-wish" : ""}`}
              onClick={() => toggle(date)}
              title={[flags.holidayName, ...lines].filter(Boolean).join(" · ") || undefined}
            >
              <span className="wish-daynum">{Number(date.slice(8))}{flags.holidayName && <small>{flags.holidayName}</small>}</span>
              {code && <span className={pillClass(code)}>{pillText(code)}</span>}
              {lines.length > 0 && <span className={`wish-hint hint-${level}`}>{lines.join(" · ")}</span>}
            </button>
          );
        })}
      </div>

      <p className="assistant-sub">
        {group >= 3
          ? "Die Hinweise zeigen nur Anzahlen aus deiner Ebene: wie viele andere am selben Tag frei, Urlaub oder denselben Dienst wünschen. Rot heißt, es wird eng. Wer was wünscht, sieht nur die Dienstplanung."
          : "Deine Ebene ist zu klein für anonyme Hinweise. Deine Wünsche sieht nur die Dienstplanung."}
      </p>
    </section>
  );
}

function PlannerPanel({ data }: { data: PlanningData }) {
  const router = useRouter();
  const { month } = data;
  const planner = data.planner!;
  const monthFn = useServerFn(setPlanningMonth);
  const statusFn = useServerFn(setPlanStatus);
  const exportFn = useServerFn(getExport);
  const saveFn = useServerFn(saveScheduleImport);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`), [month]);
  const byCell = useMemo(() => new Map(planner.wishes.map(w => [`${w.staffId}|${w.date}`, w])), [planner.wishes]);
  const people = useMemo(() => [...planner.people].sort((a, b) =>
    (ROLE_ORDER as readonly string[]).indexOf(a.role) - (ROLE_ORDER as readonly string[]).indexOf(b.role) || a.name.localeCompare(b.name, "de")), [planner.people]);
  const answered = new Set(planner.wishes.map(w => w.staffId)).size;

  async function run(action: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setMessage(null);
    try { await action(); await router.invalidate(); if (done) setMessage(done); }
    catch (err) { setMessage(err instanceof Error ? err.message : "Das hat nicht geklappt"); }
    setBusy(false);
  }

  async function download() {
    const pack = await exportFn({ data: { month } });
    const url = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `planungspaket-${month}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function uploadDraft(file: File) {
    const doctors = Object.fromEntries(planner.people.map(p => [p.name, p.role]));
    const parsed = await parseSchedulePdf(await file.arrayBuffer(), doctors);
    if (!parsed.entries.length) throw new Error("Keine Dienste erkannt");
    await saveFn({ data: { ...toStoredImport(parsed), draft: true } });
    setMessage(`${parsed.monthLabel} als Entwurf gespeichert (${parsed.entries.length} Einträge).`);
  }

  return (
    <section className="planner">
      <h2>Dienstplanung</h2>
      <p className="assistant-sub">Nur für Planer sichtbar. {answered} von {people.length} Personen haben für {monthLabel(month)} Wünsche eingetragen.</p>
      {message && <p className="planner-message">{message}</p>}

      <div className="planner-actions">
        <label>
          <span>Abgabe bis</span>
          <input type="date" className="field" defaultValue={data.deadline ?? ""} key={`${month}-${data.deadline}`} disabled={busy}
            onChange={e => run(() => monthFn({ data: { month, locked: !!data.locked, deadline: e.target.value || null } }))} />
        </label>
        <button className="btn-plain" disabled={busy} onClick={() => run(() => monthFn({ data: { month, locked: !data.locked, deadline: data.deadline ?? null } }))}>
          {data.locked ? "Wunschabgabe wieder öffnen" : "Wunschabgabe schließen"}
        </button>
        <button className="assistant-btn" disabled={busy} onClick={() => run(download)}>Planungspaket herunterladen</button>
      </div>
      <p className="assistant-sub">Das Planungspaket enthält Personal, alle Wünsche, die letzten sieben Tage des Vormonats, die Pläne der letzten sechs Monate und die Einspringliste: alles, was der Dienstplan-Generator braucht.</p>

      <div className="matrix-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th />
              {days.map(d => {
                const f = dayFlags(d);
                return <th key={d} className={f.isWeekend || f.holidayName ? "is-weekend" : ""}>{Number(d.slice(8))}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {people.map(p => (
              <tr key={p.id}>
                <th><span className="doc-dot" style={{ background: ROLE_COLOR[p.role] }} /> {p.name}</th>
                {days.map(d => {
                  const w = byCell.get(`${p.id}|${d}`);
                  const f = dayFlags(d);
                  return (
                    <td key={d} className={f.isWeekend || f.holidayName ? "is-weekend" : ""} title={w?.note ?? undefined}>
                      {w && <span className={pillClass(w.code)}>{pillText(w.code)}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Pläne</h3>
      <ul className="import-list">
        {planner.plans.map(p => (
          <li key={p.key}>
            <span>{p.label} · {p.status === "entwurf" ? "Entwurf" : "verabschiedet"} · {new Date(p.importedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</span>
            <span className="plan-actions">
              {p.status === "entwurf" && <Link to="/" search={{ entwurf: true }} className="btn-plain btn-sm">Ansehen</Link>}
              {p.status === "entwurf"
                ? <button className="assistant-btn btn-sm" disabled={busy} onClick={() => run(() => statusFn({ data: { key: p.key, status: "final" } }), `${p.label} ist verabschiedet und für alle sichtbar.`)}>Verabschieden</button>
                : <button className="btn-plain btn-sm" disabled={busy} onClick={() => run(() => statusFn({ data: { key: p.key, status: "entwurf" } }), `${p.label} ist wieder Entwurf und für das Team ausgeblendet.`)}>Zurück zum Entwurf</button>}
            </span>
          </li>
        ))}
      </ul>
      <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void run(() => uploadDraft(f)); }} />
      <button className="btn-plain" disabled={busy} onClick={() => fileRef.current?.click()}>Neuen Plan als Entwurf hochladen (PDF)</button>
    </section>
  );
}
