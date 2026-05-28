-- Run this in the Supabase SQL Editor when Sales Strategy or Simulation says
-- a planning table is missing from the schema cache.

create table if not exists public.sales_strategy_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  product_name text not null default '',
  target_segment text not null default '',
  base_sales_price numeric(14, 4) not null default 0,
  monthly_target numeric(14, 3) not null default 0,
  monthly_forecast jsonb not null default '[]'::jsonb,
  annual_sales_growth_percent numeric(8, 4) not null default 0,
  spoilage_rate numeric(8, 4) not null default 0,
  market_share numeric(8, 4) not null default 0,
  reputation_score numeric(8, 4) not null default 0,
  positioning text not null default '',
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_channels (
  company_id uuid not null references public.companies(id) on delete cascade,
  id text not null,
  name text not null default '',
  type text not null default '',
  price numeric(14, 4) not null default 0,
  budget numeric(14, 2) not null default 0,
  revenue_share numeric(8, 4) not null default 0,
  conversion_rate numeric(8, 4) not null default 0,
  margin_percent numeric(8, 4) not null default 0,
  discount_percent numeric(8, 4) not null default 0,
  return_rate_percent numeric(8, 4) not null default 0,
  payment_delay_days numeric(8, 2) not null default 0,
  success_score numeric(8, 4) not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

create table if not exists public.sales_campaigns (
  company_id uuid not null references public.companies(id) on delete cascade,
  id text not null,
  name text not null default '',
  type text not null default '',
  channel text not null default '',
  budget numeric(14, 2) not null default 0,
  duration_weeks numeric(8, 2) not null default 0,
  success_score numeric(8, 4) not null default 0,
  goal text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

create table if not exists public.sales_competitors (
  company_id uuid not null references public.companies(id) on delete cascade,
  id text not null,
  name text not null default '',
  sales_price numeric(14, 4) not null default 0,
  market_share numeric(8, 4) not null default 0,
  reputation_score numeric(8, 4) not null default 0,
  marketing_budget numeric(14, 2) not null default 0,
  threat_score numeric(8, 4) not null default 0,
  campaign_type text not null default '',
  strategy text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

create table if not exists public.sales_personnel (
  company_id uuid not null references public.companies(id) on delete cascade,
  id text not null,
  name text not null default '',
  role text not null default '',
  assigned_channel text not null default '',
  monthly_target numeric(14, 3) not null default 0,
  pipeline_value numeric(14, 2) not null default 0,
  win_rate numeric(8, 4) not null default 0,
  success_score numeric(8, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

create table if not exists public.simulation_variants (
  company_id uuid not null references public.companies(id) on delete cascade,
  id text not null,
  name text not null default '',
  label text not null default '',
  path text not null default '',
  parameters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

alter table public.sales_strategy_settings enable row level security;
alter table public.sales_channels enable row level security;
alter table public.sales_campaigns enable row level security;
alter table public.sales_competitors enable row level security;
alter table public.sales_personnel enable row level security;
alter table public.simulation_variants enable row level security;

drop policy if exists "sales_strategy_settings_select_company" on public.sales_strategy_settings;
drop policy if exists "sales_strategy_settings_write_company" on public.sales_strategy_settings;
drop policy if exists "sales_channels_select_company" on public.sales_channels;
drop policy if exists "sales_channels_write_company" on public.sales_channels;
drop policy if exists "sales_campaigns_select_company" on public.sales_campaigns;
drop policy if exists "sales_campaigns_write_company" on public.sales_campaigns;
drop policy if exists "sales_competitors_select_company" on public.sales_competitors;
drop policy if exists "sales_competitors_write_company" on public.sales_competitors;
drop policy if exists "sales_personnel_select_company" on public.sales_personnel;
drop policy if exists "sales_personnel_write_company" on public.sales_personnel;
drop policy if exists "simulation_variants_select_company" on public.simulation_variants;
drop policy if exists "simulation_variants_write_company" on public.simulation_variants;

create policy "sales_strategy_settings_select_company"
on public.sales_strategy_settings
for select
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'read'));

create policy "sales_strategy_settings_write_company"
on public.sales_strategy_settings
for all
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'))
with check (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'));

create policy "sales_channels_select_company"
on public.sales_channels
for select
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'read'));

create policy "sales_channels_write_company"
on public.sales_channels
for all
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'))
with check (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'));

create policy "sales_campaigns_select_company"
on public.sales_campaigns
for select
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'read'));

create policy "sales_campaigns_write_company"
on public.sales_campaigns
for all
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'))
with check (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'));

create policy "sales_competitors_select_company"
on public.sales_competitors
for select
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'read'));

create policy "sales_competitors_write_company"
on public.sales_competitors
for all
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'))
with check (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'));

create policy "sales_personnel_select_company"
on public.sales_personnel
for select
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'read'));

create policy "sales_personnel_write_company"
on public.sales_personnel
for all
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'))
with check (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'));

create policy "simulation_variants_select_company"
on public.simulation_variants
for select
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'read'));

create policy "simulation_variants_write_company"
on public.simulation_variants
for all
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'))
with check (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'));

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists sales_strategy_settings_set_updated_at on public.sales_strategy_settings;
create trigger sales_strategy_settings_set_updated_at
before update on public.sales_strategy_settings
for each row execute function public.set_updated_at();

drop trigger if exists sales_channels_set_updated_at on public.sales_channels;
create trigger sales_channels_set_updated_at
before update on public.sales_channels
for each row execute function public.set_updated_at();

drop trigger if exists sales_campaigns_set_updated_at on public.sales_campaigns;
create trigger sales_campaigns_set_updated_at
before update on public.sales_campaigns
for each row execute function public.set_updated_at();

drop trigger if exists sales_competitors_set_updated_at on public.sales_competitors;
create trigger sales_competitors_set_updated_at
before update on public.sales_competitors
for each row execute function public.set_updated_at();

drop trigger if exists sales_personnel_set_updated_at on public.sales_personnel;
create trigger sales_personnel_set_updated_at
before update on public.sales_personnel
for each row execute function public.set_updated_at();

drop trigger if exists simulation_variants_set_updated_at on public.simulation_variants;
create trigger simulation_variants_set_updated_at
before update on public.simulation_variants
for each row execute function public.set_updated_at();

select pg_notify('pgrst', 'reload schema');
