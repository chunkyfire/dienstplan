import { useSyncExternalStore, type ReactNode } from "react";
import { useLoader, useLocation } from "@tanstack/react-router";
import { isLocked, onLockChange } from "@/lib/api";
import { getBaseSchedule } from "@/lib/gate.functions";
import { getPlanning, getSettings } from "@/lib/suite.functions";
import { nextMonth } from "@/lib/wishes";
import { Dienstplan } from "@/components/Dienstplan";
import { Planung } from "@/components/Planung";
import { Einstellungen } from "@/components/Einstellungen";
import { Unlock } from "@/components/Unlock";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Wishes are usually entered for the coming month. */
const defaultMonth = () => nextMonth(new Date().toISOString().slice(0, 7));

function Loaded<T>({ state, children }: { state: { data: T | undefined; error: string | null }; children: (data: T) => ReactNode }) {
  if (state.data !== undefined) return <>{children(state.data)}</>;
  return (
    <div className="app-shell app-wait">
      {state.error ? <p className="form-error">{state.error}</p> : <p className="assistant-sub">Dienstplan wird geladen …</p>}
      {state.error && <button className="btn-plain" onClick={() => window.location.reload()}>Erneut versuchen</button>}
    </div>
  );
}

function AktuellPage({ drafts }: { drafts: boolean }) {
  const state = useLoader(() => getBaseSchedule({ data: { drafts } }), `aktuell:${drafts}`);
  return <Loaded state={state}>{base => <Dienstplan base={base} />}</Loaded>;
}
function PlanungPage({ month }: { month: string }) {
  const state = useLoader(() => getPlanning({ data: { month } }), `planung:${month}`);
  return <Loaded state={state}>{data => <Planung data={data} />}</Loaded>;
}
function EinstellungenPage() {
  const state = useLoader(() => getSettings(), "einstellungen");
  return <Loaded state={state}>{data => <Einstellungen data={data} />}</Loaded>;
}

export function App() {
  const loc = useLocation();
  const locked = useSyncExternalStore(onLockChange, isLocked);
  if (locked) return <Unlock />;
  if (loc.path === "/planung") return <PlanungPage month={MONTH_RE.test(loc.search.m ?? "") ? loc.search.m : defaultMonth()} />;
  if (loc.path === "/einstellungen") return <EinstellungenPage />;
  return <AktuellPage drafts={!!loc.search.entwurf} />;
}
