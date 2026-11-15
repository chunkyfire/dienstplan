import { call } from "@/lib/api";
import type { PlanningData } from "@/components/Planung";
import type { SettingsData } from "@/components/Einstellungen";

export const STAFF_ROLES = ["Chefarzt", "Oberarzt", "Facharzt", "Assistenzarzt"] as const;
export const QUALIFICATIONS = ["NEF", "TELE", "KV"] as const;

export interface Me { id: string; name: string; role: string; isPlanner: boolean; }
export interface LoginName { id: string; name: string; hasAccount: boolean; }
export interface StaffAdmin {
  id: string; name: string; role: string; stellenanteil: number; qualifications: string[];
  active: boolean; isPlanner: boolean; hasAccount: boolean; hasInvite: boolean;
}
type Ok = { ok: true };
type Result = Ok | { ok: false; error: string };

export const login = (a: { data: { staffId: string; password: string; code?: string } }) => call<{ ok: true; me: Me } | { ok: false; error: string }>("login", a.data);
export const logout = () => call<Ok>("logout");
export const changePassword = (a: { data: { current: string; next: string } }) => call<Result>("changePassword", a.data);

export const getSettings = () => call<SettingsData>("settings");
export const saveStaff = (a: { data: { id?: string; name: string; role: string; stellenanteil: number; qualifications: string[]; active: boolean; isPlanner: boolean } }) => call<Ok>("saveStaff", a.data);
export const inviteStaff = (a: { data: { id: string } }) => call<{ code: string }>("inviteStaff", a.data);
export const setSitePassword = (a: { data: { password: string } }) => call<Result>("setSitePassword", a.data);
export const setAiModel = (a: { data: { model: string } }) => call<Ok>("setAiModel", a.data);
export const backupExport = () => call<Record<string, unknown>>("backupExport");
export const backupImport = (a: { data: unknown }) => call<{ people: number; plans: number; wishes: number; covers: number }>("backupImport", a.data);

export const moveStandby = (a: { data: { name: string; dir: "up" | "down" | "bottom" } }) => call<Ok>("moveStandby", a.data);
export const markCovered = (a: { data: { name: string; date: string; code?: string } }) => call<Ok>("markCovered", a.data);

export const getPlanning = (a: { data: { month: string } }) => call<PlanningData>("planning", a.data);
export const setWish = (a: { data: { date: string; code: string | null; note?: string } }) => call<Ok>("setWish", a.data);
export const setPlanningMonth = (a: { data: { month: string; locked: boolean; deadline: string | null } }) => call<Ok>("setPlanningMonth", a.data);
export const setPlanStatus = (a: { data: { key: string; status: "final" | "entwurf" } }) => call<Ok>("setPlanStatus", a.data);
export const getExport = (a: { data: { month: string } }) => call<Record<string, unknown>>("export", a.data);
