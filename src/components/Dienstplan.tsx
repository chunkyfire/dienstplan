import { useCallback, useEffect, useMemo, useState } from "react";
import { SHIFT_GROUPS, ROLE_ORDER, ROLE_COLOR, metaFor, kindsFor, earlyRank, earlyArea, nefRank, displayCode, type ShiftKind } from "@/lib/shifts";
import { availabilityFor, bySeniorityThenCode } from "@/lib/availability";
import { freeRowGroups, shortReason, isRoleBand } from "@/components/freeRowGroups";
import { assignSlots } from "@/components/weekSlots";
import { mergeSchedule, type BaseSchedule } from "@/lib/scheduleStore";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { markCovered } from "@/lib/suite.functions";
import { SuiteTabs } from "@/components/SuiteTabs";
import { StandbyList } from "@/components/StandbyList";
import { ScheduleImport } from "@/components/ScheduleImport";
import { OutagePanel } from "@/components/OutagePanel";
import { AskAssistant } from "@/components/AskAssistant";
import type { Outage } from "@/lib/swapSolver";
import { Button } from "@/components/ui/button";
import { dateFromISO, isoFromDateUTC, addDays, localTodayISO, dayFlags } from "@/lib/dates";

interface Entry { doctor: string; role: string; date: string; code: string; }

function fmtDayShort(iso: string) {
  return dateFromISO(iso).toLocaleDateString("de-DE", { weekday: "short", timeZone: "UTC" });
}
function fmtDayNum(iso: string) {
  return dateFromISO(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}
function startOfWeek(iso: string): string {
  const d = dateFromISO(iso);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - day);
  return isoFromDateUTC(d);
}
function weekDays(iso: string): string[] {
  const start = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
function getISOWeek(iso: string) {
  const d = dateFromISO(iso);
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

function cellCls(d: string) {
  const f = dayFlags(d);
  return `week-cell ${f.isWeekend ? "is-weekend" : ""} ${f.holidayName ? "is-holiday" : ""} ${d === localTodayISO() ? "is-today" : ""}`;
}

function DoctorChip({ doctor, role }: { doctor: string; role: string }) {
  return (
    <span className="doc-chip" title={role}>
      <span className="doc-dot" style={{ background: ROLE_COLOR[role] ?? "var(--muted-foreground)" }} />
      <span>{doctor}</span>
    </span>
  );
}

interface Cover { doctor: string; date: string; }

function WeekView({ date, days, entries, all, doctors, standby, roleFilter, onPick, onCover }: { date: string; days: string[]; entries: Entry[]; all: Entry[]; doctors: Record<string, string>; standby: Record<string, number>; roleFilter: string | null; onPick: (o: Outage) => void; onCover: (c: Cover) => void }) {
  return (
    <div className="week-view">
      <div className="week-grid">
        <div className="week-corner">Schicht</div>
        {days.map(d => {
          const flags = dayFlags(d);
          return (
            <div
              key={d}
              className={`week-day-head ${d === date ? "is-active" : ""} ${d === localTodayISO() ? "is-today" : ""} ${flags.isWeekend ? "is-weekend" : ""} ${flags.holidayName ? "is-holiday" : ""}`}
              title={flags.holidayName ?? (flags.isWeekend ? "Wochenende" : undefined)}
            >
              <span className="wd-name">{fmtDayShort(d)}</span>
              <span className="wd-date">{fmtDayNum(d)}</span>
              {flags.holidayName && <span className="wd-badge">{flags.holidayName}</span>}
              {flags.isWeekend && !flags.holidayName && <span className="wd-badge">Wochenende</span>}
            </div>
          );
        })}

        {SHIFT_GROUPS.map(group => (
          <Row key={group.id} group={group} days={days} entries={entries} roleFilter={roleFilter} onPick={onPick} />
        ))}
        <FreeRow days={days} all={all} doctors={doctors} standby={standby} roleFilter={roleFilter} onCover={onCover} />
      </div>
      <div className="av-legend">
        <span className="free-entry av-available is-next"><span className="next-rank">1</span>als Nächste dran laut Einspringliste</span>
        <span className="free-entry av-available">kann einspringen</span>
        <span className="free-entry av-partial">eingeschränkt (z. B. nach Spät nur ab Mittag)</span>
        <span className="free-entry av-wish">Freiwunsch (X)</span>
        <span className="free-entry av-blocked">nicht einsetzbar (Ruhezeit, Urlaub, krank …)</span>
      </div>
    </div>
  );
}

const CANNOT = new Set(["wish", "blocked"]);

function FreeRow({ days, all, doctors, standby, roleFilter, onCover }: { days: string[]; all: Entry[]; doctors: Record<string, string>; standby: Record<string, number>; roleFilter: string | null; onCover: (c: Cover) => void }) {
  const bands = freeRowGroups(days.map(d => availabilityFor(d, all, doctors).filter(a => !roleFilter || a.role === roleFilter)), standby);
  const firstCan = bands.findIndex(b => !CANNOT.has(b.key));
  const firstCannot = bands.findIndex(b => CANNOT.has(b.key));
  return (
    <>
      {bands.map((band, index) => {
        const cannot = CANNOT.has(band.key);
        const label = index === firstCan ? "Wer kann einspringen?" : index === firstCannot ? "Wer kann nicht einspringen?" : null;
        return <FreeBand key={band.key} band={band} days={days} label={label} cannot={cannot} sectionStart={index === firstCannot} standby={standby} onCover={onCover} />;
      })}
    </>
  );
}

/** The first two free people of a level are the ones the stand-in list asks first. */
const NEXT_UP = 2;

function FreeBand({ band, days, label, cannot, sectionStart, standby, onCover }: { band: ReturnType<typeof freeRowGroups>[number]; days: string[]; label: string | null; cannot: boolean; sectionStart: boolean; standby: Record<string, number>; onCover: (c: Cover) => void }) {
  const ranked = isRoleBand(band.key);
  const cls = `${cannot ? "free-section-cannot" : ""} ${sectionStart ? "free-section-start" : ""}`;
  return (
    <>
      <div className={`week-row-label kind-free free-band-label ${cls}`}>{label}</div>
      {band.cells.map((list, i) => (
        <div key={days[i]} className={`${cellCls(days[i])} free-band ${cls}`}>
          {list.map((a, n) => {
            if (ranked && a.doctor in standby) return (
              <button type="button" key={a.doctor} className={`free-entry av-${a.status} is-inline is-clickable ${n < NEXT_UP ? "is-next" : ""}`} title="Ist eingesprungen? Antippen" onClick={() => onCover({ doctor: a.doctor, date: days[i] })}>
                {n < NEXT_UP && <span className="next-rank">{n + 1}</span>}
                <DoctorChip doctor={a.doctor} role={a.role} />
              </button>
            );
            return (
              <div key={a.doctor} className={`free-entry av-${a.status} is-inline`} title={a.reason}>
                <DoctorChip doctor={a.doctor} role={a.role} />
                {a.reason && <span className="av-reason">{a.status === "partial" ? (a.reason.includes("Mittag") ? "ab Mittag" : a.reason) : shortReason(a.reason)}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

function RowLabel({ kind, label, times }: { kind: string; label: string; times?: string[] }) {
  return (
    <div className={`week-row-label kind-${kind}`}>
      <span>{label}</span>
      {times?.map(t => <span key={t} className="row-time">{t}</span>)}
    </div>
  );
}

function Row({ group, days, entries, roleFilter, onPick }: { group: { id: ShiftKind; label: string; times?: string[] }; days: string[]; entries: Entry[]; roleFilter: string | null; onPick: (o: Outage) => void }) {
  if (group.id === "frueh") {
    return (
      <>
        <ShiftBand group={group} days={days} entries={entries} roleFilter={roleFilter} onPick={onPick} area="zna" />
        <ShiftBand group={group} days={days} entries={entries} roleFilter={roleFilter} onPick={onPick} area="other-area" />
      </>
    );
  }
  return <ShiftBand group={group} days={days} entries={entries} roleFilter={roleFilter} onPick={onPick} />;
}

function ShiftBand({ group, days, entries, roleFilter, onPick, area }: { group: { id: ShiftKind; label: string; times?: string[] }; days: string[]; entries: Entry[]; roleFilter: string | null; onPick: (o: Outage) => void; area?: "zna" | "other-area" }) {
  const raw = days.map(d =>
    entries.filter(e =>
      e.date === d && (area ? earlyArea(e.code) === area : kindsFor(e.code).includes(group.id)) && (!roleFilter || e.role === roleFilter)
    ).sort((a, b) => (group.id === "frueh" ? earlyRank(a.code) - earlyRank(b.code) : group.id === "nef" ? nefRank(a.code) - nefRank(b.code) : 0) || bySeniorityThenCode(a, b))
  );
  if (raw.every(c => c.length === 0)) return null;
  const section = (e: Entry) => (group.id === "frueh" ? earlyRank(e.code) : 0);
  const cells = assignSlots(raw, e => `${e.doctor}|${section(e)}`, section);
  return (
    <>
      {area === "other-area" ? (
        <div className="week-row-label kind-frueh early-other-label"><span>FTU · Rotation · Büro</span></div>
      ) : (
        <RowLabel kind={group.id} label={group.label} times={area === "zna" ? [...(group.times ?? []), "ZNA"] : group.times} />
      )}
      {cells.map((list, i) => (
        <div key={i} className={`${cellCls(days[i])} ${area === "other-area" ? "early-other-cell" : ""}`}>
          {list.map((e, j) => {
            if (e === null) return <div key={j} className="slot-gap" aria-hidden />;
            const shown = displayCode(e.code, group.id);
            const tna = group.id === "nef" && e.code === "TNA";
            if (e.code.toUpperCase() === "PX") return (
              <div key={e.doctor + e.code} className="week-entry shift-off">
                <span className="we-code">FTU</span>
                <DoctorChip doctor={e.doctor} role={e.role} />
              </div>
            );
            return (
              <Button variant="ghost" type="button" key={e.doctor + e.code} className={`week-entry shift-${group.id} ${tna ? "is-tna" : ""}`} title="Fällt aus? Lösungen anzeigen" onClick={() => onPick({ doctor: e.doctor, date: e.date, code: e.code })}>
                <span className="we-code">{shown.code}</span>
                <DoctorChip doctor={e.doctor} role={e.role} />
                {shown.note && <span className="we-note">{shown.note}</span>}
              </Button>
            );
          })}
        </div>
      ))}
    </>
  );
}

function Legend() {
  const shiftCodes = ["F", "Z", "Z1", "Z2", "S", "N", "NEF1", "NEF3", "NEF24", "WNEF24", "F+NEF24", "TNA"];
  const offCodes = ["U", "X", "K", "FB", "DF", "O", "UC", "PX", "ST", "E", "NEF-E", "EZ"];
  return (
    <details className="legend">
      <summary>Legende &amp; Schichtzeiten</summary>
      <div className="legend-body">
        <div>
          <h4>Dienste</h4>
          <ul>
            {shiftCodes.map(c => {
              const m = metaFor(c);
              return (
                <li key={c}>
                  <span className={`shift-pill shift-${m.kind}`}>{c}</span>
                  <span>{m.label}</span>
                  {m.time && <span className="legend-time">{m.time}</span>}
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <h4>Frei / Sonstiges</h4>
          <ul>
            {offCodes.map(c => {
              const m = metaFor(c);
              return (
                <li key={c}>
                  <span className={`shift-pill shift-${m.kind}`}>{c}</span>
                  <span>{m.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <h4>Hierarchie</h4>
          <ul>
            {ROLE_ORDER.map(r => (
              <li key={r}>
                <span className="doc-dot" style={{ background: ROLE_COLOR[r] }} />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

export function Dienstplan({ base }: { base: BaseSchedule }) {
  const router = useRouter();
  const data = useMemo(() => mergeSchedule(base), [base]);
  const [date, setDate] = useState<string>(localTodayISO());
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [outage, setOutage] = useState<Outage | null>(null);
  const [cover, setCover] = useState<Cover | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const coverFn = useServerFn(markCovered);

  const reload = useCallback(() => { void router.invalidate(); }, [router]);

  // Always show the shared cloud state: refresh periodically and when the tab regains focus.
  useEffect(() => {
    const id = window.setInterval(reload, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") reload(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onVis); };
  }, [reload]);

  const range = useMemo(() => {
    const dates = data.entries.map(e => e.date);
    const min = dates.length ? dates[0] : localTodayISO();
    const max = dates.length ? dates[dates.length - 1] : localTodayISO();
    return { min, max };
  }, [data]);

  const clamp = useCallback((iso: string) => {
    if (iso < range.min) return range.min;
    if (iso > range.max) return range.max;
    return iso;
  }, [range]);

  const activeDate = clamp(date);
  const days = useMemo(() => weekDays(activeDate), [activeDate]);
  const weekEntries = useMemo(() => {
    const set = new Set(days);
    return data.entries.filter(e => set.has(e.date));
  }, [data, days]);

  const periodLabel = `KW ${getISOWeek(days[0])} · ${fmtDayNum(days[0])} – ${fmtDayNum(days[6])}`;
  const monthsLabel = useMemo(() => {
    const months = [...new Set(data.entries.map(e => e.date.slice(0, 7)))].sort();
    if (!months.length) return "keine Daten";
    const fmt = (m: string) => dateFromISO(`${m}-01`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
    return months.length === 1 ? fmt(months[0]) : `${fmt(months[0])} – ${fmt(months[months.length - 1])}`;
  }, [data]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <div className="brand-mark" aria-hidden />
            <div>
              <h1>Dienstplan</h1>
              <p>{monthsLabel}</p>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn-ghost" onClick={() => setDate(clamp(localTodayISO()))}>Heute</button>
            <input
              type="date"
              value={activeDate}
              min={range.min}
              max={range.max}
              onChange={e => setDate(clamp(e.target.value))}
              className="date-input"
            />
          </div>
        </div>
      </header>

      <SuiteTabs active="aktuell" me={base.me ?? null} />

      <main className="app-main">
        {(base.draftKeys?.length ?? 0) > 0 && (
          <p className="draft-banner">Entwurfsansicht: {base.draftKeys!.join(", ")} ist noch nicht verabschiedet und nur für die Dienstplanung sichtbar.</p>
        )}
        <div className="toolbar">
          <div className="period-nav">
            <button className="nav-btn" onClick={() => setDate(clamp(addDays(activeDate, -7)))} aria-label="zurück">‹</button>
            <span className="period-label">{periodLabel}</span>
            <button className="nav-btn" onClick={() => setDate(clamp(addDays(activeDate, 7)))} aria-label="vor">›</button>
          </div>

          <div className="role-filter">
            <button
              className={`role-chip ${roleFilter === null ? "is-active" : ""}`}
              onClick={() => setRoleFilter(null)}
            >Alle</button>
            {ROLE_ORDER.map(r => (
              <button
                key={r}
                className={`role-chip ${roleFilter === r ? "is-active" : ""}`}
                onClick={() => setRoleFilter(roleFilter === r ? null : r)}
                style={{ "--role-color": ROLE_COLOR[r] } as React.CSSProperties}
              >
                <span className="doc-dot" style={{ background: ROLE_COLOR[r] }} />
                {r}
              </button>
            ))}
          </div>
        </div>

        <WeekView date={activeDate} days={days} entries={weekEntries} all={data.entries} doctors={data.doctors} standby={data.standby} roleFilter={roleFilter} onPick={setOutage} onCover={c => { setCoverError(null); setCover(c); }} />
        <p className="assistant-sub">Tipp: Tippe auf einen Dienst, um zu sehen, wer bei Ausfall einspringen oder tauschen kann. Tippe auf einen freien Namen, wenn die Person eingesprungen ist.</p>

        <AskAssistant weekStart={days[0]} weekEnd={days[6]} label={periodLabel} />

        <StandbyList staff={base.staff ?? []} onChanged={reload} />

        <Legend />

        {base.me?.isPlanner && <ScheduleImport imports={data.imports} doctors={data.doctors} onChanged={reload} />}
      </main>

      {cover && (
        <div className="cover-bar" role="dialog" aria-label="Einspringen vermerken">
          <span><b>{cover.doctor}</b> ist am {fmtDayShort(cover.date)} {fmtDayNum(cover.date)} eingesprungen?</span>
          {coverError && <span className="form-error">{coverError}</span>}
          <button className="assistant-btn" onClick={async () => {
            try { await coverFn({ data: { name: cover.doctor, date: cover.date } }); setCover(null); reload(); }
            catch (err) { setCoverError(err instanceof Error ? err.message : "Speichern fehlgeschlagen"); }
          }}>Ja, ans Ende der Liste</button>
          <button className="btn-plain" onClick={() => setCover(null)}>Abbrechen</button>
        </div>
      )}

      {outage && <OutagePanel outage={outage} entries={data.entries} doctors={data.doctors} onClose={() => setOutage(null)} />}

      <footer className="app-footer">
        Datenstand: {monthsLabel} · {data.entries.length.toLocaleString("de-DE")} Einträge · {Object.keys(data.doctors).length} Ärzte
      </footer>
    </div>
  );
}
