import { call, setLocked } from "@/lib/api";
import type { BaseSchedule } from "@/lib/scheduleStore";

interface Entry { doctor: string; role: string; date: string; code: string; }
type Ok = { ok: true };

export async function unlockSite(a: { data: { password: string } }) {
  const res = await call<{ ok: boolean; error?: string }>("unlock", a.data);
  if (res.ok) setLocked(false);
  return res;
}
export async function lockSite() {
  const res = await call<Ok>("lock");
  setLocked(true);
  return res;
}
export const getBaseSchedule = (a?: { data?: { drafts?: boolean } }) => call<BaseSchedule>("base", a?.data);
export const saveScheduleImport = (a: { data: { key: string; monthLabel: string; importedAt?: string; entries: Entry[]; doctors: Record<string, string>; draft?: boolean } }) => call<Ok>("savePlan", a.data);
export const removeScheduleImport = (a: { data: { key: string } }) => call<Ok>("removePlan", a.data);
