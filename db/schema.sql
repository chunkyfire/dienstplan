-- Dienstplan: Tabellen im eigenen Supabase-Projekt. Idempotent, alle mit Präfix dp_.
-- Zugriff ausschließlich über die Edge Function (service_role); RLS ohne Policies sperrt jeden Direktzugriff.
CREATE TABLE IF NOT EXISTS public.dp_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('Chefarzt','Oberarzt','Facharzt','Assistenzarzt')),
  stellenanteil numeric NOT NULL DEFAULT 1.0,
  qualifications text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  is_planner boolean NOT NULL DEFAULT false,
  standby_pos integer NOT NULL DEFAULT 0,
  pw_hash text,
  invite_code text,
  fail_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.dp_wishes (
  staff_id uuid NOT NULL REFERENCES public.dp_staff(id) ON DELETE CASCADE,
  date date NOT NULL,
  code text NOT NULL,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, date)
);
CREATE INDEX IF NOT EXISTS dp_wishes_date_idx ON public.dp_wishes (date);
CREATE TABLE IF NOT EXISTS public.dp_cover_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.dp_staff(id) ON DELETE CASCADE,
  date date NOT NULL,
  code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.dp_planning_months (
  month_key text PRIMARY KEY,
  deadline date,
  locked boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.dp_plans (
  month_key text PRIMARY KEY,
  month_label text NOT NULL,
  entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  doctors jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'final' CHECK (status IN ('final','entwurf'))
);
CREATE TABLE IF NOT EXISTS public.dp_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);
ALTER TABLE public.dp_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dp_wishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dp_cover_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dp_planning_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dp_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dp_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dp_staff, public.dp_wishes, public.dp_cover_events, public.dp_planning_months, public.dp_plans, public.dp_settings FROM anon, authenticated;
GRANT ALL ON public.dp_staff, public.dp_wishes, public.dp_cover_events, public.dp_planning_months, public.dp_plans, public.dp_settings TO service_role;
