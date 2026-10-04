alter table public.profiles
  add column if not exists financial_overview_widgets jsonb not null default '[]'::jsonb;
