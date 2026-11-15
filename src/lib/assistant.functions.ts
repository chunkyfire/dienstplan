import { call } from "@/lib/api";

export interface ChatMsg { role: "user" | "assistant"; content: string; }
type Answer = { ok: true; answer: string } | { ok: false; error: string };

export const askAssistant = (a: { data: { messages: ChatMsg[]; today: string; weekStart?: string; weekEnd?: string } }) => call<Answer>("ask", a.data);
