-- Run this in the Supabase SQL Editor when Sales Strategy or Simulation says
-- a planning table is missing from the schema cache.

create table if not exists public.sales_strategy_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  monthly_multipliers jsonb not null default '[1,1,1,1,1,1,1,1,1,1,1,1]'::jsonb,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sales_strategy_settings
  add column if not exists monthly_multipliers jsonb not null default '[1,1,1,1,1,1,1,1,1,1,1,1]'::jsonb,
  drop column if exists product_name,
  drop column if exists target_segment,
  drop column if exists base_sales_price,
  drop column if exists monthly_target,
  drop column if exists monthly_forecast,
  drop column if exists annual_sales_growth_percent,
  drop column if exists spoilage_rate,
  drop column if exists market_share,
  drop column if exists reputation_score,
  drop column if exists positioning;

create table if not exists public.sales_channel_types (
  id text primary key,
  name_en text not null default '',
  name_tr text not null default '',
  average_customer_acquisition_rate numeric(8, 4) not null default 0,
  average_conversion_rate numeric(8, 4) not null default 0,
  average_commission_percent numeric(8, 4) not null default 0,
  average_duration_days numeric(8, 2) not null default 0,
  description_en text not null default '',
  description_tr text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_campaign_types (
  id text primary key,
  name_en text not null default '',
  name_tr text not null default '',
  average_customer_acquisition_rate numeric(8, 4) not null default 0,
  average_conversion_rate numeric(8, 4) not null default 0,
  average_commission_percent numeric(8, 4) not null default 0,
  average_duration_days numeric(8, 2) not null default 0,
  description_en text not null default '',
  description_tr text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.sales_channel_types (
  id, name_en, name_tr, average_customer_acquisition_rate, average_conversion_rate,
  average_commission_percent, average_duration_days, description_en, description_tr, sort_order
) values
  ('direct', 'Direct sales', 'Direkt satış', 18, 12, 0, 0, 'Direct sales owned by the company.', 'Şirketin doğrudan yönettiği satış.', 10),
  ('online', 'Online', 'Online', 8, 4, 8, 0, 'Digital storefront or online flow.', 'Dijital mağaza veya online akış.', 20),
  ('retail', 'Retail', 'Perakende', 5, 3, 20, 0, 'Retail shelf or store channel.', 'Perakende raf veya mağaza kanalı.', 30),
  ('distributor', 'Distributor', 'Distribütör', 4, 2.5, 25, 0, 'Distributor-led sales route.', 'Distribütör üzerinden satış rotası.', 40),
  ('marketplace', 'Marketplace', 'Pazaryeri', 7, 3.5, 15, 0, 'Marketplace platform channel.', 'Pazaryeri platform kanalı.', 50)
on conflict (id) do update set
  name_en = excluded.name_en,
  name_tr = excluded.name_tr,
  average_customer_acquisition_rate = excluded.average_customer_acquisition_rate,
  average_conversion_rate = excluded.average_conversion_rate,
  average_commission_percent = excluded.average_commission_percent,
  average_duration_days = excluded.average_duration_days,
  description_en = excluded.description_en,
  description_tr = excluded.description_tr,
  sort_order = excluded.sort_order;

insert into public.sales_campaign_types (
  id, name_en, name_tr, average_customer_acquisition_rate, average_conversion_rate,
  average_commission_percent, average_duration_days, description_en, description_tr, sort_order
) values
  ('digital', 'Digital advertising', 'Dijital reklam', 6, 3, 0, 30, 'Paid digital acquisition campaign.', 'Ücretli dijital müşteri kazanım kampanyası.', 10),
  ('social', 'Social media', 'Sosyal medya', 5, 2.5, 0, 21, 'Organic and paid social campaign.', 'Organik ve ücretli sosyal medya kampanyası.', 20),
  ('influencer', 'Influencer', 'Influencer', 7, 4, 0, 14, 'Creator or influencer-led campaign.', 'İçerik üretici veya influencer odaklı kampanya.', 30),
  ('trade', 'Trade promotion', 'Ticari promosyon', 4, 5, 0, 30, 'Trade promotion for partners.', 'Ticari iş ortakları için promosyon.', 40),
  ('event', 'Event / fair', 'Etkinlik / fuar', 3, 6, 0, 7, 'Event, fair, or field activation.', 'Etkinlik, fuar veya saha aktivasyonu.', 50),
  ('email', 'Email / CRM', 'E-posta / CRM', 4, 2, 0, 14, 'Email and CRM lifecycle campaign.', 'E-posta ve CRM yaşam döngüsü kampanyası.', 60)
on conflict (id) do update set
  name_en = excluded.name_en,
  name_tr = excluded.name_tr,
  average_customer_acquisition_rate = excluded.average_customer_acquisition_rate,
  average_conversion_rate = excluded.average_conversion_rate,
  average_commission_percent = excluded.average_commission_percent,
  average_duration_days = excluded.average_duration_days,
  description_en = excluded.description_en,
  description_tr = excluded.description_tr,
  sort_order = excluded.sort_order;

create table if not exists public.sales_channels (
  company_id uuid not null references public.companies(id) on delete cascade,
  id text not null,
  name text not null default '',
  type_id text not null default 'direct' references public.sales_channel_types(id),
  product_id uuid references public.operation_products(id) on delete set null,
  start_month integer not null default 1,
  monthly_sales_units numeric(14, 3) not null default 0,
  growth_months_1_6_percent numeric(8, 4) not null default 0,
  growth_months_7_18_percent numeric(8, 4) not null default 0,
  growth_months_19_24_percent numeric(8, 4) not null default 0,
  growth_years_3_5_percent numeric(8, 4) not null default 0,
  collection_days numeric(8, 2) not null default 30,
  customer_acquisition_cost numeric(14, 2) not null default 0,
  commission_percent numeric(8, 4) not null default 0,
  basket_size numeric(12, 4),
  conversion_rate_percent numeric(8, 4),
  traffic_score numeric(10, 4),
  repeat_rate_percent numeric(8, 4),
  churn_rate_percent numeric(8, 4),
  discount_rate_percent numeric(8, 4),
  return_rate_percent numeric(8, 4),
  capacity_limit numeric(14, 3),
  launch_fee numeric(14, 2),
  moq_monthly numeric(14, 3),
  failure_probability_percent numeric(8, 4),
  ramp_up_months numeric(8, 2),
  seasonality_curve jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

alter table public.sales_channels
  add column if not exists type_id text not null default 'direct',
  add column if not exists product_id uuid references public.operation_products(id) on delete set null,
  add column if not exists start_month integer not null default 1,
  add column if not exists monthly_sales_units numeric(14, 3) not null default 0,
  add column if not exists growth_months_1_6_percent numeric(8, 4) not null default 0,
  add column if not exists growth_months_7_18_percent numeric(8, 4) not null default 0,
  add column if not exists growth_months_19_24_percent numeric(8, 4) not null default 0,
  add column if not exists growth_years_3_5_percent numeric(8, 4) not null default 0,
  add column if not exists collection_days numeric(8, 2) not null default 30,
  add column if not exists customer_acquisition_cost numeric(14, 2) not null default 0,
  add column if not exists commission_percent numeric(8, 4) not null default 0,
  add column if not exists basket_size numeric(12, 4),
  add column if not exists conversion_rate_percent numeric(8, 4),
  add column if not exists traffic_score numeric(10, 4),
  add column if not exists repeat_rate_percent numeric(8, 4),
  add column if not exists churn_rate_percent numeric(8, 4),
  add column if not exists discount_rate_percent numeric(8, 4),
  add column if not exists return_rate_percent numeric(8, 4),
  add column if not exists capacity_limit numeric(14, 3),
  add column if not exists launch_fee numeric(14, 2),
  add column if not exists moq_monthly numeric(14, 3),
  add column if not exists failure_probability_percent numeric(8, 4),
  add column if not exists ramp_up_months numeric(8, 2),
  add column if not exists seasonality_curve jsonb,
  drop column if exists price,
  drop column if exists budget,
  drop column if exists revenue_share,
  drop column if exists margin_percent,
  drop column if exists success_score,
  drop column if exists note;

alter table public.sales_channels
  alter column return_rate_percent drop not null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales_channels' and column_name = 'conversion_rate'
  ) then
    execute 'update public.sales_channels set conversion_rate_percent = conversion_rate where conversion_rate_percent is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales_channels' and column_name = 'discount_percent'
  ) then
    execute 'update public.sales_channels set discount_rate_percent = discount_percent where discount_rate_percent is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales_channels' and column_name = 'payment_delay_days'
  ) then
    execute 'update public.sales_channels set collection_days = payment_delay_days where collection_days = 30';
  end if;
end;
$$;

update public.sales_channels
set start_month = 1
where start_month is null or start_month < 1;

alter table public.sales_channels
  drop column if exists conversion_rate,
  drop column if exists discount_percent,
  drop column if exists payment_delay_days;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sales_channels'
      and column_name = 'type'
  ) then
    execute $migration$
      update public.sales_channels c
      set type_id = coalesce((
        select t.id
        from public.sales_channel_types t
        where lower(t.id) = lower(c.type)
           or lower(t.name_en) = lower(c.type)
           or lower(t.name_tr) = lower(c.type)
        limit 1
      ), 'direct')
    $migration$;
  end if;
end;
$$;

update public.sales_channels
set type_id = 'direct'
where type_id is null
   or not exists (select 1 from public.sales_channel_types t where t.id = sales_channels.type_id);

alter table public.sales_channels
  drop column if exists type;

alter table public.sales_channels
  drop constraint if exists sales_channels_type_id_fkey;

alter table public.sales_channels
  add constraint sales_channels_type_id_fkey foreign key (type_id) references public.sales_channel_types(id);

create table if not exists public.sales_campaigns (
  company_id uuid not null references public.companies(id) on delete cascade,
  id text not null,
  name text not null default '',
  type_id text not null default 'digital' references public.sales_campaign_types(id),
  channel text not null default '',
  budget numeric(14, 2) not null default 0,
  duration_days numeric(8, 2) not null default 0,
  goal text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

alter table public.sales_campaigns
  add column if not exists type_id text not null default 'digital',
  add column if not exists duration_days numeric(8, 2) not null default 0;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sales_campaigns'
      and column_name = 'duration_weeks'
  ) then
    execute 'update public.sales_campaigns set duration_days = duration_weeks * 7 where duration_days = 0';
  end if;
end;
$$;

alter table public.sales_campaigns
  drop column if exists duration_weeks,
  drop column if exists success_score;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sales_campaigns'
      and column_name = 'type'
  ) then
    execute $migration$
      update public.sales_campaigns c
      set type_id = coalesce((
        select t.id
        from public.sales_campaign_types t
        where lower(t.id) = lower(c.type)
           or lower(t.name_en) = lower(c.type)
           or lower(t.name_tr) = lower(c.type)
        limit 1
      ), 'digital')
    $migration$;
  end if;
end;
$$;

update public.sales_campaigns
set type_id = 'digital'
where type_id is null
   or not exists (select 1 from public.sales_campaign_types t where t.id = sales_campaigns.type_id);

alter table public.sales_campaigns
  drop column if exists type;

alter table public.sales_campaigns
  drop constraint if exists sales_campaigns_type_id_fkey;

alter table public.sales_campaigns
  add constraint sales_campaigns_type_id_fkey foreign key (type_id) references public.sales_campaign_types(id);

create table if not exists public.sales_personnel (
  company_id uuid not null references public.companies(id) on delete cascade,
  id text not null,
  name text not null default '',
  role text not null default '',
  assigned_channel text not null default '',
  monthly_target numeric(14, 3) not null default 0,
  realized_sales_units numeric(14, 3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

alter table public.sales_personnel
  add column if not exists realized_sales_units numeric(14, 3) not null default 0,
  drop column if exists pipeline_value,
  drop column if exists win_rate,
  drop column if exists success_score;

do $$
begin
  if to_regclass('public.sales_competitors') is not null then
    execute 'drop trigger if exists sales_competitors_set_updated_at on public.sales_competitors';
    execute 'drop policy if exists "sales_competitors_select_company" on public.sales_competitors';
    execute 'drop policy if exists "sales_competitors_write_company" on public.sales_competitors';
  end if;
end;
$$;

drop table if exists public.sales_competitors;

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
alter table public.sales_channel_types enable row level security;
alter table public.sales_campaign_types enable row level security;
alter table public.sales_channels enable row level security;
alter table public.sales_campaigns enable row level security;
alter table public.sales_personnel enable row level security;
alter table public.simulation_variants enable row level security;

drop policy if exists "sales_strategy_settings_select_company" on public.sales_strategy_settings;
drop policy if exists "sales_strategy_settings_write_company" on public.sales_strategy_settings;
drop policy if exists "sales_channel_types_select_authenticated" on public.sales_channel_types;
drop policy if exists "sales_campaign_types_select_authenticated" on public.sales_campaign_types;
drop policy if exists "sales_channels_select_company" on public.sales_channels;
drop policy if exists "sales_channels_write_company" on public.sales_channels;
drop policy if exists "sales_campaigns_select_company" on public.sales_campaigns;
drop policy if exists "sales_campaigns_write_company" on public.sales_campaigns;
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

create policy "sales_channel_types_select_authenticated"
on public.sales_channel_types
for select
using (auth.uid() is not null);

create policy "sales_campaign_types_select_authenticated"
on public.sales_campaign_types
for select
using (auth.uid() is not null);

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

drop trigger if exists sales_channel_types_set_updated_at on public.sales_channel_types;
create trigger sales_channel_types_set_updated_at
before update on public.sales_channel_types
for each row execute function public.set_updated_at();

drop trigger if exists sales_campaign_types_set_updated_at on public.sales_campaign_types;
create trigger sales_campaign_types_set_updated_at
before update on public.sales_campaign_types
for each row execute function public.set_updated_at();

drop trigger if exists sales_channels_set_updated_at on public.sales_channels;
create trigger sales_channels_set_updated_at
before update on public.sales_channels
for each row execute function public.set_updated_at();

drop trigger if exists sales_campaigns_set_updated_at on public.sales_campaigns;
create trigger sales_campaigns_set_updated_at
before update on public.sales_campaigns
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
