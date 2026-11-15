// Entry point of the Supabase Edge Function. CI bundles this file into supabase/functions/dienstplan/index.ts.
import { handle } from "./core";
import { restDb } from "./db";

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Promise<Response> | Response): void };

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const origins = (Deno.env.get("DP_ALLOWED_ORIGINS") ?? "https://chunkyfire.github.io,http://localhost:5173").split(",").map(s => s.trim()).filter(Boolean);

Deno.serve(req => handle(req, {
  db: restDb(url, serviceKey),
  // The service key never leaves the server, so a key derived from it is a safe signing secret without another setting to manage.
  secret: `dienstplan-session:${serviceKey}`,
  openrouterKey: Deno.env.get("OPENROUTER_API_KEY"),
}, origins));
