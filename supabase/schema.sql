create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_modules (
  id uuid primary key default gen_random_uuid(),
  module_key text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.company_roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.company_roles(id) on delete cascade,
  module_id uuid not null references public.app_modules(id) on delete cascade,
  can_read boolean not null default false,
  can_write boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role_id, module_id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text unique not null,
  phone_number text,
  company_id uuid references public.companies(id),
  department text,
  access_level text not null default 'user',
  profile_picture_url text,
  language text not null default 'en',
  theme text not null default 'light' check (theme in ('light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists company_id uuid references public.companies(id),
  add column if not exists theme text not null default 'light';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'company'
  ) then
    insert into public.companies (name)
    select distinct nullif(trim(company), '')
    from public.profiles
    where nullif(trim(company), '') is not null
    on conflict (name) do nothing;

    update public.profiles p
    set company_id = c.id
    from public.companies c
    where p.company_id is null
      and nullif(trim(p.company), '') = c.name;

    alter table public.profiles drop column company;
  end if;
end;
$$;

insert into public.companies (name)
values ('Atera')
on conflict (name) do nothing;

update public.profiles
set company_id = (select id from public.companies where name = 'Atera' limit 1)
where company_id is null;

insert into public.app_modules (module_key, name)
values
  ('authorization', 'Yetkilendirme'),
  ('operations', 'Operations')
on conflict (module_key) do update set name = excluded.name;

create or replace function public.ensure_company_defaults(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  module_record record;
  role_record record;
begin
  if p_company_id is null then
    return;
  end if;

  insert into public.company_roles (company_id, name, description, is_system)
  values
    (p_company_id, 'admin', 'Full administrative role for this company.', true),
    (p_company_id, 'manager', 'Default manager role for this company.', true),
    (p_company_id, 'user', 'Default user role for this company.', true)
  on conflict (company_id, name) do nothing;

  for module_record in select id, module_key from public.app_modules loop
    for role_record in select id, name from public.company_roles where company_id = p_company_id loop
      insert into public.role_permissions (role_id, module_id, can_read, can_write)
      values (
        role_record.id,
        module_record.id,
        role_record.name = 'admin' and module_record.module_key in ('authorization', 'operations'),
        role_record.name = 'admin' and module_record.module_key in ('authorization', 'operations')
      )
      on conflict (role_id, module_id) do nothing;
    end loop;
  end loop;
end;
$$;

create or replace function public.current_profile_company_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_profile_access_level()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select access_level from public.profiles where id = auth.uid();
$$;

create or replace function public.has_module_permission(p_module_key text, p_permission text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    join public.company_roles r
      on r.company_id = p.company_id
     and lower(r.name) = lower(p.access_level)
    join public.role_permissions rp on rp.role_id = r.id
    join public.app_modules m on m.id = rp.module_id
    where p.id = auth.uid()
      and m.module_key = p_module_key
      and (
        (p_permission = 'read' and rp.can_read)
        or (p_permission = 'write' and rp.can_write)
      )
  );
$$;

select public.ensure_company_defaults(id) from public.companies;

update public.role_permissions rp
set can_read = true,
    can_write = true
from public.company_roles r, public.app_modules m
where rp.role_id = r.id
  and rp.module_id = m.id
  and r.name = 'admin'
  and m.module_key in ('authorization', 'operations');

grant execute on function public.current_profile_company_id() to authenticated;
grant execute on function public.current_profile_access_level() to authenticated;
grant execute on function public.has_module_permission(text, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.app_modules enable row level security;
alter table public.company_roles enable row level security;
alter table public.role_permissions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_company_authorized" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_company_authorized" on public.profiles;
drop policy if exists "companies_select_own" on public.companies;
drop policy if exists "modules_select_authorized" on public.app_modules;
drop policy if exists "roles_select_company_authorized" on public.company_roles;
drop policy if exists "roles_insert_company_authorized" on public.company_roles;
drop policy if exists "roles_update_company_authorized" on public.company_roles;
drop policy if exists "permissions_select_company_authorized" on public.role_permissions;
drop policy if exists "permissions_insert_company_authorized" on public.role_permissions;
drop policy if exists "permissions_update_company_authorized" on public.role_permissions;

create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_select_company_authorized"
on public.profiles
for select
using (
  company_id = public.current_profile_company_id()
  and public.has_module_permission('authorization', 'read')
);

create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (
  auth.uid() = id
  and company_id is not distinct from public.current_profile_company_id()
  and access_level is not distinct from public.current_profile_access_level()
);

create policy "profiles_update_company_authorized"
on public.profiles
for update
using (
  company_id = public.current_profile_company_id()
  and public.has_module_permission('authorization', 'write')
)
with check (
  company_id = public.current_profile_company_id()
  and public.has_module_permission('authorization', 'write')
);

create policy "companies_select_own"
on public.companies
for select
using (id = public.current_profile_company_id());

create policy "modules_select_authorized"
on public.app_modules
for select
using (public.has_module_permission('authorization', 'read'));

create policy "roles_select_company_authorized"
on public.company_roles
for select
using (
  company_id = public.current_profile_company_id()
  and public.has_module_permission('authorization', 'read')
);

create policy "roles_insert_company_authorized"
on public.company_roles
for insert
with check (
  company_id = public.current_profile_company_id()
  and public.has_module_permission('authorization', 'write')
);

create policy "roles_update_company_authorized"
on public.company_roles
for update
using (
  company_id = public.current_profile_company_id()
  and public.has_module_permission('authorization', 'write')
)
with check (
  company_id = public.current_profile_company_id()
  and public.has_module_permission('authorization', 'write')
);

create policy "permissions_select_company_authorized"
on public.role_permissions
for select
using (
  exists (
    select 1
    from public.company_roles r
    where r.id = role_permissions.role_id
      and r.company_id = public.current_profile_company_id()
  )
  and public.has_module_permission('authorization', 'read')
);

create policy "permissions_insert_company_authorized"
on public.role_permissions
for insert
with check (
  exists (
    select 1
    from public.company_roles r
    where r.id = role_permissions.role_id
      and r.company_id = public.current_profile_company_id()
  )
  and public.has_module_permission('authorization', 'write')
);

create policy "permissions_update_company_authorized"
on public.role_permissions
for update
using (
  exists (
    select 1
    from public.company_roles r
    where r.id = role_permissions.role_id
      and r.company_id = public.current_profile_company_id()
  )
  and public.has_module_permission('authorization', 'write')
)
with check (
  exists (
    select 1
    from public.company_roles r
    where r.id = role_permissions.role_id
      and r.company_id = public.current_profile_company_id()
  )
  and public.has_module_permission('authorization', 'write')
);

create or replace function public.get_login_email(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select email from public.profiles where lower(username) = lower(p_username) limit 1;
$$;

grant execute on function public.get_login_email(text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.companies (name)
  values (coalesce(nullif(trim(new.raw_user_meta_data->>'company'), ''), 'Atera'))
  on conflict (name) do nothing;

  insert into public.profiles (
    id,
    username,
    email,
    phone_number,
    company_id,
    department,
    access_level,
    language,
    theme
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'phone_number',
    (
      select id
      from public.companies
      where name = coalesce(nullif(trim(new.raw_user_meta_data->>'company'), ''), 'Atera')
      limit 1
    ),
    new.raw_user_meta_data->>'department',
    coalesce(new.raw_user_meta_data->>'access_level', 'user'),
    coalesce(new.raw_user_meta_data->>'language', 'en'),
    case when new.raw_user_meta_data->>'theme' in ('light', 'dark') then new.raw_user_meta_data->>'theme' else 'light' end
  )
  on conflict (id) do update set
    username = excluded.username,
    email = excluded.email,
    phone_number = excluded.phone_number,
    company_id = excluded.company_id,
    department = excluded.department,
    access_level = excluded.access_level,
    language = excluded.language,
    theme = excluded.theme;

  perform public.ensure_company_defaults((
    select company_id from public.profiles where id = new.id
  ));

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

drop trigger if exists company_roles_set_updated_at on public.company_roles;
create trigger company_roles_set_updated_at
before update on public.company_roles
for each row execute function public.set_updated_at();

drop trigger if exists role_permissions_set_updated_at on public.role_permissions;
create trigger role_permissions_set_updated_at
before update on public.role_permissions
for each row execute function public.set_updated_at();

drop table if exists public.operation_product_machines cascade;
drop table if exists public.operation_process_steps cascade;
drop table if exists public.operation_suppliers cascade;
drop table if exists public.operation_constraints cascade;

create table if not exists public.operation_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_code text not null,
  name text not null,
  product_group text,
  revision text not null default 'A',
  status text not null default 'Aktif',
  unit text not null default 'adet',
  price numeric(14, 4) not null default 0,
  cycle_time_minutes numeric(12, 4) not null default 1,
  description text,
  quality_grade text,
  weight_kg numeric(12, 3) not null default 0,
  dimensions text,
  material_name text,
  cycle_time_seconds numeric(12, 4) not null default 1,
  labor_minutes_per_unit numeric(12, 4) not null default 1,
  material_kg_per_unit numeric(12, 4) not null default 0,
  scrap_rate numeric(6, 2) not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, product_code)
);

alter table public.operation_products
  add column if not exists unit text not null default 'adet',
  add column if not exists price numeric(14, 4) not null default 0,
  add column if not exists cycle_time_minutes numeric(12, 4) not null default 1;

create table if not exists public.operation_machines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  price numeric(14, 2) not null default 0,
  hourly_energy_consumption_kwh numeric(14, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

alter table public.operation_machines
  add column if not exists price numeric(14, 2) not null default 0,
  add column if not exists hourly_energy_consumption_kwh numeric(14, 4) not null default 0;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'operation_machines'
      and column_name = 'hourly_energy_cost'
  ) then
    execute 'update public.operation_machines set hourly_energy_consumption_kwh = hourly_energy_cost where hourly_energy_consumption_kwh = 0';
  end if;
end;
$$;

alter table public.operation_machines
  drop constraint if exists operation_machines_company_id_machine_code_key,
  drop column if exists machine_code,
  drop column if exists machine_type,
  drop column if exists status,
  drop column if exists available_units,
  drop column if exists operators_required,
  drop column if exists effective_capacity_per_hour,
  drop column if exists hourly_energy_cost;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'operation_machines_company_id_name_key'
  ) then
    alter table public.operation_machines
      add constraint operation_machines_company_id_name_key unique (company_id, name);
  end if;
end;
$$;

create table if not exists public.operation_materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  unit text not null default 'kg',
  price_per_unit numeric(14, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

alter table public.operation_materials
  add column if not exists price_per_unit numeric(14, 4) not null default 0;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'operation_materials'
      and column_name = 'unit_cost'
  ) then
    execute 'update public.operation_materials set price_per_unit = unit_cost where price_per_unit = 0';
  end if;
end;
$$;

alter table public.operation_materials
  drop constraint if exists operation_materials_company_id_material_code_key,
  drop column if exists product_id,
  drop column if exists material_code,
  drop column if exists stock_quantity,
  drop column if exists unit_cost,
  drop column if exists usage_per_unit,
  drop column if exists critical_stock_quantity,
  drop column if exists lead_time_days,
  drop column if exists status;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'operation_materials_company_id_name_key'
  ) then
    alter table public.operation_materials
      add constraint operation_materials_company_id_name_key unique (company_id, name);
  end if;
end;
$$;

create table if not exists public.operation_product_materials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.operation_products(id) on delete cascade,
  material_id uuid not null references public.operation_materials(id),
  quantity_per_unit numeric(14, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, material_id)
);

create table if not exists public.operation_workforce_resources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  role_name text not null,
  hourly_cost numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, role_name)
);

alter table public.operation_workforce_resources
  drop column if exists available_people,
  drop column if exists productive_hours_per_shift,
  drop column if exists efficiency_percent,
  drop column if exists status;

create table if not exists public.operation_notes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.operation_products(id) on delete cascade,
  note text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.operation_resource_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.operation_products(id) on delete cascade,
  plan_name text not null default 'Günlük üretim planı',
  target_daily_output numeric(14, 3) not null default 0,
  input jsonb not null,
  result jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.operation_resource_plans
  add column if not exists plan_name text not null default 'Günlük üretim planı',
  add column if not exists target_daily_output numeric(14, 3) not null default 0,
  drop column if exists shifts,
  drop column if exists hours_per_shift,
  drop column if exists planned_downtime_minutes,
  drop column if exists setup_minutes;

create table if not exists public.operation_plan_machines (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.operation_resource_plans(id) on delete cascade,
  machine_id uuid not null references public.operation_machines(id),
  daily_hours numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.operation_plan_machines
  drop column if exists process,
  drop column if exists units_used;

create table if not exists public.operation_plan_workforce (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.operation_resource_plans(id) on delete cascade,
  workforce_id uuid not null references public.operation_workforce_resources(id),
  people_assigned numeric(10, 2) not null default 0,
  daily_hours numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.operation_plan_materials (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.operation_resource_plans(id) on delete cascade,
  material_id uuid not null references public.operation_materials(id),
  daily_quantity numeric(14, 4) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.operation_plan_materials
  add column if not exists daily_quantity numeric(14, 4) not null default 0;

create table if not exists public.financial_model_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  electricity_price_per_kwh numeric(14, 4) not null default 0,
  working_days_per_month numeric(5, 2) not null default 22,
  initial_cash numeric(14, 2) not null default 0,
  loan_amount numeric(14, 2) not null default 0,
  annual_interest_rate numeric(8, 4) not null default 0,
  loan_term_months integer not null default 24,
  vat_rate numeric(8, 4) not null default 20,
  income_tax_rate numeric(8, 4) not null default 20,
  raw_material_buffer_months numeric(6, 2) not null default 1,
  salary_buffer_months numeric(6, 2) not null default 1,
  rent_buffer_months numeric(6, 2) not null default 1,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.financial_model_settings
  add column if not exists working_days_per_month numeric(5, 2) not null default 22,
  add column if not exists initial_cash numeric(14, 2) not null default 0,
  add column if not exists loan_amount numeric(14, 2) not null default 0,
  add column if not exists annual_interest_rate numeric(8, 4) not null default 0,
  add column if not exists loan_term_months integer not null default 24,
  add column if not exists vat_rate numeric(8, 4) not null default 20,
  add column if not exists income_tax_rate numeric(8, 4) not null default 20,
  add column if not exists raw_material_buffer_months numeric(6, 2) not null default 1,
  add column if not exists salary_buffer_months numeric(6, 2) not null default 1,
  add column if not exists rent_buffer_months numeric(6, 2) not null default 1;

create table if not exists public.financial_extra_costs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  cost_type text not null default 'recurring' check (cost_type in ('initial', 'recurring')),
  amount numeric(14, 2) not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'operation_plan_materials'
      and column_name = 'quantity_per_unit'
  ) then
    execute 'update public.operation_plan_materials set daily_quantity = quantity_per_unit where daily_quantity = 0';
  end if;
end;
$$;

alter table public.operation_plan_materials
  drop column if exists quantity_per_unit;

alter table public.operation_products enable row level security;
alter table public.operation_product_materials enable row level security;
alter table public.operation_machines enable row level security;
alter table public.operation_materials enable row level security;
alter table public.operation_workforce_resources enable row level security;
alter table public.operation_notes enable row level security;
alter table public.operation_resource_plans enable row level security;
alter table public.operation_plan_machines enable row level security;
alter table public.operation_plan_workforce enable row level security;
alter table public.operation_plan_materials enable row level security;
alter table public.financial_model_settings enable row level security;
alter table public.financial_extra_costs enable row level security;
alter table public.sales_strategy_settings enable row level security;
alter table public.sales_channels enable row level security;
alter table public.sales_campaigns enable row level security;
alter table public.sales_competitors enable row level security;
alter table public.sales_personnel enable row level security;
alter table public.simulation_variants enable row level security;

drop policy if exists "operation_products_select_company" on public.operation_products;
drop policy if exists "operation_products_write_company" on public.operation_products;
drop policy if exists "operation_product_materials_select_company" on public.operation_product_materials;
drop policy if exists "operation_product_materials_write_company" on public.operation_product_materials;
drop policy if exists "operation_machines_select_company" on public.operation_machines;
drop policy if exists "operation_machines_write_company" on public.operation_machines;
drop policy if exists "operation_materials_select_company" on public.operation_materials;
drop policy if exists "operation_materials_write_company" on public.operation_materials;
drop policy if exists "operation_workforce_select_company" on public.operation_workforce_resources;
drop policy if exists "operation_workforce_write_company" on public.operation_workforce_resources;
drop policy if exists "operation_notes_select_company" on public.operation_notes;
drop policy if exists "operation_notes_write_company" on public.operation_notes;
drop policy if exists "operation_resource_plans_select_company" on public.operation_resource_plans;
drop policy if exists "operation_resource_plans_insert_company" on public.operation_resource_plans;
drop policy if exists "operation_plan_machines_select_company" on public.operation_plan_machines;
drop policy if exists "operation_plan_workforce_select_company" on public.operation_plan_workforce;
drop policy if exists "operation_plan_materials_select_company" on public.operation_plan_materials;
drop policy if exists "financial_model_settings_select_company" on public.financial_model_settings;
drop policy if exists "financial_model_settings_write_company" on public.financial_model_settings;
drop policy if exists "financial_extra_costs_select_company" on public.financial_extra_costs;
drop policy if exists "financial_extra_costs_write_company" on public.financial_extra_costs;
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

create policy "operation_products_select_company"
on public.operation_products
for select
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'read'));

create policy "operation_products_write_company"
on public.operation_products
for all
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'))
with check (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'));

create policy "operation_product_materials_select_company"
on public.operation_product_materials
for select
using (
  exists (
    select 1
    from public.operation_products p
    where p.id = operation_product_materials.product_id
      and p.company_id = public.current_profile_company_id()
  )
  and public.has_module_permission('operations', 'read')
);

create policy "operation_product_materials_write_company"
on public.operation_product_materials
for all
using (
  exists (
    select 1
    from public.operation_products p
    where p.id = operation_product_materials.product_id
      and p.company_id = public.current_profile_company_id()
  )
  and public.has_module_permission('operations', 'write')
)
with check (
  exists (
    select 1
    from public.operation_products p
    where p.id = operation_product_materials.product_id
      and p.company_id = public.current_profile_company_id()
  )
  and exists (
    select 1
    from public.operation_materials m
    join public.operation_products p on p.id = operation_product_materials.product_id
    where m.id = operation_product_materials.material_id
      and m.company_id = p.company_id
      and p.company_id = public.current_profile_company_id()
  )
  and public.has_module_permission('operations', 'write')
);

create policy "operation_machines_select_company"
on public.operation_machines
for select
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'read'));

create policy "operation_machines_write_company"
on public.operation_machines
for all
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'))
with check (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'));

create policy "operation_materials_select_company"
on public.operation_materials
for select
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'read'));

create policy "operation_materials_write_company"
on public.operation_materials
for all
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'))
with check (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'));

create policy "operation_workforce_select_company"
on public.operation_workforce_resources
for select
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'read'));

create policy "operation_workforce_write_company"
on public.operation_workforce_resources
for all
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'))
with check (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'));

create policy "operation_notes_select_company"
on public.operation_notes
for select
using (
  exists (
    select 1
    from public.operation_products p
    where p.id = operation_notes.product_id
      and p.company_id = public.current_profile_company_id()
  )
  and public.has_module_permission('operations', 'read')
);

create policy "operation_notes_write_company"
on public.operation_notes
for all
using (
  exists (
    select 1
    from public.operation_products p
    where p.id = operation_notes.product_id
      and p.company_id = public.current_profile_company_id()
  )
  and public.has_module_permission('operations', 'write')
)
with check (
  exists (
    select 1
    from public.operation_products p
    where p.id = operation_notes.product_id
      and p.company_id = public.current_profile_company_id()
  )
  and public.has_module_permission('operations', 'write')
);

create policy "operation_resource_plans_select_company"
on public.operation_resource_plans
for select
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'read'));

create policy "operation_resource_plans_insert_company"
on public.operation_resource_plans
for insert
with check (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'));

create policy "operation_plan_machines_select_company"
on public.operation_plan_machines
for select
using (
  exists (
    select 1
    from public.operation_resource_plans p
    where p.id = operation_plan_machines.plan_id
      and p.company_id = public.current_profile_company_id()
  )
  and public.has_module_permission('operations', 'read')
);

create policy "operation_plan_workforce_select_company"
on public.operation_plan_workforce
for select
using (
  exists (
    select 1
    from public.operation_resource_plans p
    where p.id = operation_plan_workforce.plan_id
      and p.company_id = public.current_profile_company_id()
  )
  and public.has_module_permission('operations', 'read')
);

create policy "operation_plan_materials_select_company"
on public.operation_plan_materials
for select
using (
  exists (
    select 1
    from public.operation_resource_plans p
    where p.id = operation_plan_materials.plan_id
      and p.company_id = public.current_profile_company_id()
  )
  and public.has_module_permission('operations', 'read')
);

create policy "financial_model_settings_select_company"
on public.financial_model_settings
for select
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'read'));

create policy "financial_model_settings_write_company"
on public.financial_model_settings
for all
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'))
with check (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'));

create policy "financial_extra_costs_select_company"
on public.financial_extra_costs
for select
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'read'));

create policy "financial_extra_costs_write_company"
on public.financial_extra_costs
for all
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'))
with check (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'));

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

drop trigger if exists operation_products_set_updated_at on public.operation_products;
create trigger operation_products_set_updated_at
before update on public.operation_products
for each row execute function public.set_updated_at();

drop trigger if exists operation_product_materials_set_updated_at on public.operation_product_materials;
create trigger operation_product_materials_set_updated_at
before update on public.operation_product_materials
for each row execute function public.set_updated_at();

drop trigger if exists operation_machines_set_updated_at on public.operation_machines;
create trigger operation_machines_set_updated_at
before update on public.operation_machines
for each row execute function public.set_updated_at();

drop trigger if exists operation_materials_set_updated_at on public.operation_materials;
create trigger operation_materials_set_updated_at
before update on public.operation_materials
for each row execute function public.set_updated_at();

drop trigger if exists operation_workforce_set_updated_at on public.operation_workforce_resources;
create trigger operation_workforce_set_updated_at
before update on public.operation_workforce_resources
for each row execute function public.set_updated_at();

drop trigger if exists financial_model_settings_set_updated_at on public.financial_model_settings;
create trigger financial_model_settings_set_updated_at
before update on public.financial_model_settings
for each row execute function public.set_updated_at();

drop trigger if exists financial_extra_costs_set_updated_at on public.financial_extra_costs;
create trigger financial_extra_costs_set_updated_at
before update on public.financial_extra_costs
for each row execute function public.set_updated_at();

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

create or replace function public.save_operation_resource_plan(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := public.current_profile_company_id();
  v_product_id uuid := nullif(p_input->>'productId', '')::uuid;
  v_plan_name text := coalesce(nullif(trim(p_input->>'planName'), ''), 'Günlük üretim planı');
  v_product_name text := coalesce(nullif(trim(p_input->>'productName'), ''), 'Varsayılan Ürün');
  v_machine_rows jsonb := case when jsonb_typeof(p_input->'machineRows') = 'array' then p_input->'machineRows' else '[]'::jsonb end;
  v_workforce_rows jsonb := case when jsonb_typeof(p_input->'workforceRows') = 'array' then p_input->'workforceRows' else '[]'::jsonb end;
  v_material_rows jsonb := case when jsonb_typeof(p_input->'materialRows') = 'array' then p_input->'materialRows' else '[]'::jsonb end;
  v_machine_summary jsonb := '[]'::jsonb;
  v_workforce_summary jsonb := '[]'::jsonb;
  v_material_summary jsonb := '[]'::jsonb;
  v_entry jsonb;
  v_machine record;
  v_workforce record;
  v_material record;
  v_daily_hours numeric;
  v_people numeric;
  v_daily_quantity numeric;
  v_machine_hours_used numeric := 0;
  v_workforce_hours_used numeric := 0;
  v_energy_consumption_kwh numeric := 0;
  v_selected_machine_value numeric := 0;
  v_workforce_cost numeric := 0;
  v_material_cost numeric := 0;
  v_product_unit text := 'adet';
  v_product_price numeric := 0;
  v_product_cycle_time_minutes numeric := 1;
  v_product_material_count integer := 0;
  v_primary_machine_daily_hours numeric := 0;
  v_produced_quantity numeric := 0;
  v_total_tracked_daily_cost numeric := 0;
  v_result jsonb;
  v_plan_id uuid;
begin
  if v_company_id is null then
    raise exception 'Current profile is not connected to a company.';
  end if;

  if not public.has_module_permission('operations', 'write') then
    raise exception 'Operations write permission is required.';
  end if;

  if v_product_id is not null and not exists (
    select 1
    from public.operation_products
    where id = v_product_id
      and company_id = v_company_id
  ) then
    v_product_id := null;
  end if;

  if v_product_id is null then
    insert into public.operation_products (
      company_id, product_code, name, product_group, revision, status, description
    )
    values (
      v_company_id,
      'PLAN-' || upper(substr(md5(v_product_name), 1, 12)),
      v_product_name,
      'Basit Üretim',
      'A',
      'Aktif',
      'Veri girişi planları için otomatik oluşturulan yüzeysel ürün kaydı.'
    )
    on conflict (company_id, product_code) do update set
      name = excluded.name,
      product_group = excluded.product_group,
      status = excluded.status,
      description = excluded.description
    returning id into v_product_id;
  else
    update public.operation_products
    set name = v_product_name
    where id = v_product_id
      and company_id = v_company_id;
  end if;

  select unit, price, cycle_time_minutes
    into v_product_unit, v_product_price, v_product_cycle_time_minutes
  from public.operation_products
  where id = v_product_id
    and company_id = v_company_id;

  for v_entry in select value from jsonb_array_elements(v_machine_rows) loop
    select * into v_machine
    from public.operation_machines
    where id = nullif(v_entry->>'machineId', '')::uuid
      and company_id = v_company_id;

    if not found then
      raise exception 'Selected machine was not found for your company.';
    end if;

    v_daily_hours := greatest(0, coalesce(nullif(v_entry->>'dailyHours', '')::numeric, 0));
    v_machine_hours_used := v_machine_hours_used + v_daily_hours;
    v_primary_machine_daily_hours := greatest(v_primary_machine_daily_hours, v_daily_hours);
    v_energy_consumption_kwh := v_energy_consumption_kwh + (v_daily_hours * greatest(v_machine.hourly_energy_consumption_kwh, 0));
    v_selected_machine_value := v_selected_machine_value + greatest(v_machine.price, 0);
    v_machine_summary := v_machine_summary || jsonb_build_array(jsonb_build_object(
      'machineId', v_machine.id,
      'name', v_machine.name,
      'dailyHours', v_daily_hours,
      'hourlyEnergyConsumptionKwh', v_machine.hourly_energy_consumption_kwh,
      'energyConsumptionKwh', v_daily_hours * greatest(v_machine.hourly_energy_consumption_kwh, 0),
      'price', v_machine.price
    ));
  end loop;

  v_product_cycle_time_minutes := greatest(0.0001, coalesce(v_product_cycle_time_minutes, 1));
  v_produced_quantity := (v_primary_machine_daily_hours * 60) / v_product_cycle_time_minutes;

  for v_entry in select value from jsonb_array_elements(v_workforce_rows) loop
    select * into v_workforce
    from public.operation_workforce_resources
    where id = nullif(v_entry->>'workforceId', '')::uuid
      and company_id = v_company_id;

    if not found then
      raise exception 'Selected workforce resource was not found for your company.';
    end if;

    v_people := greatest(0, coalesce(nullif(v_entry->>'peopleAssigned', '')::numeric, 0));
    v_daily_hours := greatest(0, coalesce(nullif(v_entry->>'dailyHours', '')::numeric, 0));
    v_workforce_hours_used := v_workforce_hours_used + (v_people * v_daily_hours);
    v_workforce_cost := v_workforce_cost + (v_people * v_daily_hours * greatest(v_workforce.hourly_cost, 0));
    v_workforce_summary := v_workforce_summary || jsonb_build_array(jsonb_build_object(
      'workforceId', v_workforce.id,
      'roleName', v_workforce.role_name,
      'peopleAssigned', v_people,
      'dailyHours', v_daily_hours,
      'hoursUsed', v_people * v_daily_hours,
      'hourlyCost', v_workforce.hourly_cost,
      'cost', v_people * v_daily_hours * greatest(v_workforce.hourly_cost, 0)
    ));
  end loop;

  select count(*) into v_product_material_count
  from public.operation_product_materials
  where product_id = v_product_id;

  if v_product_material_count > 0 then
    for v_material in
      select
        m.id,
        m.name,
        m.unit,
        m.price_per_unit,
        pm.quantity_per_unit
      from public.operation_product_materials pm
      join public.operation_materials m on m.id = pm.material_id
      where pm.product_id = v_product_id
        and m.company_id = v_company_id
    loop
      v_daily_quantity := v_produced_quantity * greatest(v_material.quantity_per_unit, 0);
      v_material_cost := v_material_cost + (v_daily_quantity * greatest(v_material.price_per_unit, 0));
      v_material_summary := v_material_summary || jsonb_build_array(jsonb_build_object(
        'materialId', v_material.id,
        'name', v_material.name,
        'unit', v_material.unit,
        'quantityPerUnit', v_material.quantity_per_unit,
        'producedQuantity', v_produced_quantity,
        'dailyQuantity', v_daily_quantity,
        'pricePerUnit', v_material.price_per_unit,
        'cost', v_daily_quantity * greatest(v_material.price_per_unit, 0)
      ));
    end loop;
  else
    for v_entry in select value from jsonb_array_elements(v_material_rows) loop
      select * into v_material
      from public.operation_materials
      where id = nullif(v_entry->>'materialId', '')::uuid
        and company_id = v_company_id;

      if not found then
        raise exception 'Selected material was not found for your company.';
      end if;

      v_daily_quantity := greatest(0, coalesce(nullif(v_entry->>'dailyQuantity', '')::numeric, 0));
      v_material_cost := v_material_cost + (v_daily_quantity * greatest(v_material.price_per_unit, 0));
      v_material_summary := v_material_summary || jsonb_build_array(jsonb_build_object(
        'materialId', v_material.id,
        'name', v_material.name,
        'unit', v_material.unit,
        'dailyQuantity', v_daily_quantity,
        'pricePerUnit', v_material.price_per_unit,
        'cost', v_daily_quantity * greatest(v_material.price_per_unit, 0)
      ));
    end loop;
  end if;

  v_total_tracked_daily_cost := v_material_cost + v_workforce_cost;

  v_result := jsonb_build_object(
    'productName', v_product_name,
    'productUnit', coalesce(v_product_unit, 'adet'),
    'productPrice', coalesce(v_product_price, 0),
    'cycleTimeMinutes', v_product_cycle_time_minutes,
    'primaryMachineDailyHours', v_primary_machine_daily_hours,
    'producedQuantity', v_produced_quantity,
    'machineHoursUsed', v_machine_hours_used,
    'workforceHoursUsed', v_workforce_hours_used,
    'energyConsumptionKwh', v_energy_consumption_kwh,
    'selectedMachineValue', v_selected_machine_value,
    'materialCost', v_material_cost,
    'workforceCost', v_workforce_cost,
    'totalTrackedDailyCost', v_total_tracked_daily_cost,
    'machineRows', v_machine_summary,
    'workforceRows', v_workforce_summary,
    'materialRows', v_material_summary
  );

  insert into public.operation_resource_plans (
    company_id, product_id, plan_name, target_daily_output, input, result, created_by
  )
  values (
    v_company_id, v_product_id, v_plan_name, 0, p_input, v_result, auth.uid()
  )
  returning id into v_plan_id;

  for v_entry in select value from jsonb_array_elements(v_machine_summary) loop
    insert into public.operation_plan_machines (plan_id, machine_id, daily_hours)
    values (
      v_plan_id,
      nullif(v_entry->>'machineId', '')::uuid,
      coalesce(nullif(v_entry->>'dailyHours', '')::numeric, 0)
    );
  end loop;

  for v_entry in select value from jsonb_array_elements(v_workforce_summary) loop
    insert into public.operation_plan_workforce (plan_id, workforce_id, people_assigned, daily_hours)
    values (
      v_plan_id,
      nullif(v_entry->>'workforceId', '')::uuid,
      coalesce(nullif(v_entry->>'peopleAssigned', '')::numeric, 0),
      coalesce(nullif(v_entry->>'dailyHours', '')::numeric, 0)
    );
  end loop;

  for v_entry in select value from jsonb_array_elements(v_material_summary) loop
    insert into public.operation_plan_materials (plan_id, material_id, daily_quantity)
    values (
      v_plan_id,
      nullif(v_entry->>'materialId', '')::uuid,
      coalesce(nullif(v_entry->>'dailyQuantity', '')::numeric, 0)
    );
  end loop;

  return jsonb_build_object('id', v_plan_id, 'input', p_input, 'result', v_result);
end;
$$;

grant execute on function public.save_operation_resource_plan(jsonb) to authenticated;

create or replace function public.save_operation_record(p_entity text, p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := public.current_profile_company_id();
  v_record_id uuid;
  v_entry jsonb;
  v_material_id uuid;
  v_row jsonb;
begin
  if v_company_id is null then
    raise exception 'Current profile is not connected to a company.';
  end if;

  if not public.has_module_permission('operations', 'write') then
    raise exception 'Operations write permission is required.';
  end if;

  if p_entity = 'machine' then
    insert into public.operation_machines (
      company_id, name, price, hourly_energy_consumption_kwh
    )
    values (
      v_company_id,
      nullif(trim(p_input->>'name'), ''),
      greatest(0, coalesce(nullif(p_input->>'price', '')::numeric, 0)),
      greatest(0, coalesce(nullif(p_input->>'hourlyEnergyConsumptionKwh', '')::numeric, 0))
    )
    on conflict (company_id, name) do update set
      price = excluded.price,
      hourly_energy_consumption_kwh = excluded.hourly_energy_consumption_kwh
    returning id into v_record_id;

    select to_jsonb(m.*) into v_row from public.operation_machines m where m.id = v_record_id;
    return v_row;
  end if;

  if p_entity = 'product' then
    insert into public.operation_products (
      company_id, product_code, name, unit, price, cycle_time_minutes, product_group, revision, status, description
    )
    values (
      v_company_id,
      'PROD-' || upper(substr(md5(coalesce(nullif(trim(p_input->>'name'), ''), gen_random_uuid()::text)), 1, 12)),
      nullif(trim(p_input->>'name'), ''),
      coalesce(nullif(trim(p_input->>'unit'), ''), 'adet'),
      greatest(0, coalesce(nullif(p_input->>'price', '')::numeric, 0)),
      greatest(0.0001, coalesce(nullif(p_input->>'cycleTimeMinutes', '')::numeric, 1)),
      'Basit Üretim',
      'A',
      'Aktif',
      'Veri girişi planlarında seçilmek için eklenen ürün kaydı.'
    )
    on conflict (company_id, product_code) do update set
      name = excluded.name,
      unit = excluded.unit,
      price = excluded.price,
      cycle_time_minutes = excluded.cycle_time_minutes,
      product_group = excluded.product_group,
      status = excluded.status,
      description = excluded.description
    returning id into v_record_id;

    delete from public.operation_product_materials
    where product_id = v_record_id;

    for v_entry in
      select value
      from jsonb_array_elements(
        case when jsonb_typeof(p_input->'materialRows') = 'array' then p_input->'materialRows' else '[]'::jsonb end
      )
    loop
      v_material_id := nullif(v_entry->>'materialId', '')::uuid;

      if v_material_id is not null and exists (
        select 1
        from public.operation_materials
        where id = v_material_id
          and company_id = v_company_id
      ) then
        insert into public.operation_product_materials (
          product_id, material_id, quantity_per_unit
        )
        values (
          v_record_id,
          v_material_id,
          greatest(0, coalesce(nullif(v_entry->>'quantityPerUnit', '')::numeric, 0))
        )
        on conflict (product_id, material_id) do update set
          quantity_per_unit = excluded.quantity_per_unit;
      end if;
    end loop;

    select to_jsonb(p.*) into v_row from public.operation_products p where p.id = v_record_id;
    return v_row;
  end if;

  if p_entity = 'material' then
    insert into public.operation_materials (
      company_id, name, unit, price_per_unit
    )
    values (
      v_company_id,
      nullif(trim(p_input->>'name'), ''),
      coalesce(nullif(trim(p_input->>'unit'), ''), 'kg'),
      greatest(0, coalesce(nullif(p_input->>'pricePerUnit', '')::numeric, 0))
    )
    on conflict (company_id, name) do update set
      unit = excluded.unit,
      price_per_unit = excluded.price_per_unit
    returning id into v_record_id;

    select to_jsonb(m.*) into v_row from public.operation_materials m where m.id = v_record_id;
    return v_row;
  end if;

  if p_entity = 'workforce' then
    insert into public.operation_workforce_resources (
      company_id, role_name, hourly_cost
    )
    values (
      v_company_id,
      nullif(trim(p_input->>'roleName'), ''),
      greatest(0, coalesce(nullif(p_input->>'hourlyCost', '')::numeric, 0))
    )
    on conflict (company_id, role_name) do update set
      hourly_cost = excluded.hourly_cost
    returning id into v_record_id;

    select to_jsonb(w.*) into v_row from public.operation_workforce_resources w where w.id = v_record_id;
    return v_row;
  end if;

  raise exception 'Unsupported operation entity: %', p_entity;
end;
$$;

grant execute on function public.save_operation_record(text, jsonb) to authenticated;

create or replace function public.save_financial_model_settings(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := public.current_profile_company_id();
  v_row jsonb;
begin
  if v_company_id is null then
    raise exception 'Current profile is not connected to a company.';
  end if;

  if not public.has_module_permission('operations', 'write') then
    raise exception 'Operations write permission is required.';
  end if;

  insert into public.financial_model_settings (
    company_id,
    electricity_price_per_kwh,
    working_days_per_month,
    initial_cash,
    loan_amount,
    annual_interest_rate,
    loan_term_months,
    vat_rate,
    income_tax_rate,
    raw_material_buffer_months,
    salary_buffer_months,
    rent_buffer_months,
    updated_by
  )
  values (
    v_company_id,
    greatest(0, coalesce(nullif(p_input->>'electricityPricePerKwh', '')::numeric, 0)),
    greatest(1, coalesce(nullif(p_input->>'workingDaysPerMonth', '')::numeric, 22)),
    greatest(0, coalesce(nullif(p_input->>'initialCash', '')::numeric, 0)),
    greatest(0, coalesce(nullif(p_input->>'loanAmount', '')::numeric, 0)),
    greatest(0, coalesce(nullif(p_input->>'annualInterestRate', '')::numeric, 0)),
    greatest(1, coalesce(nullif(p_input->>'loanTermMonths', '')::integer, 24)),
    greatest(0, coalesce(nullif(p_input->>'vatRate', '')::numeric, 20)),
    greatest(0, coalesce(nullif(p_input->>'incomeTaxRate', '')::numeric, 20)),
    greatest(0, coalesce(nullif(p_input->>'rawMaterialBufferMonths', '')::numeric, 1)),
    greatest(0, coalesce(nullif(p_input->>'salaryBufferMonths', '')::numeric, 1)),
    greatest(0, coalesce(nullif(p_input->>'rentBufferMonths', '')::numeric, 1)),
    auth.uid()
  )
  on conflict (company_id) do update set
    electricity_price_per_kwh = excluded.electricity_price_per_kwh,
    working_days_per_month = excluded.working_days_per_month,
    initial_cash = excluded.initial_cash,
    loan_amount = excluded.loan_amount,
    annual_interest_rate = excluded.annual_interest_rate,
    loan_term_months = excluded.loan_term_months,
    vat_rate = excluded.vat_rate,
    income_tax_rate = excluded.income_tax_rate,
    raw_material_buffer_months = excluded.raw_material_buffer_months,
    salary_buffer_months = excluded.salary_buffer_months,
    rent_buffer_months = excluded.rent_buffer_months,
    updated_by = excluded.updated_by;

  select to_jsonb(s.*)
    into v_row
  from public.financial_model_settings s
  where s.company_id = v_company_id;

  return v_row;
end;
$$;

grant execute on function public.save_financial_model_settings(jsonb) to authenticated;

create or replace function public.save_financial_extra_cost(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := public.current_profile_company_id();
  v_record_id uuid;
  v_row jsonb;
begin
  if v_company_id is null then
    raise exception 'Current profile is not connected to a company.';
  end if;

  if not public.has_module_permission('operations', 'write') then
    raise exception 'Operations write permission is required.';
  end if;

  insert into public.financial_extra_costs (
    company_id, name, cost_type, amount, created_by
  )
  values (
    v_company_id,
    coalesce(nullif(trim(p_input->>'name'), ''), 'Ek gider'),
    case when p_input->>'costType' = 'initial' then 'initial' else 'recurring' end,
    greatest(0, coalesce(nullif(p_input->>'amount', '')::numeric, 0)),
    auth.uid()
  )
  returning id into v_record_id;

  select to_jsonb(c.*)
    into v_row
  from public.financial_extra_costs c
  where c.id = v_record_id;

  return v_row;
end;
$$;

grant execute on function public.save_financial_extra_cost(jsonb) to authenticated;

drop function if exists public.calculate_financial_model();

create or replace function public.calculate_financial_model(p_horizon text default '6m')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := public.current_profile_company_id();
  v_electricity_price numeric := 0;
  v_working_days_per_month numeric := 22;
  v_initial_cash numeric := 0;
  v_loan_amount numeric := 0;
  v_annual_interest_rate numeric := 0;
  v_loan_term_months integer := 24;
  v_vat_rate numeric := 20;
  v_income_tax_rate numeric := 20;
  v_raw_material_buffer_months numeric := 1;
  v_salary_buffer_months numeric := 1;
  v_rent_buffer_months numeric := 1;
  v_base_sales_revenue numeric := 0;
  v_base_material_cost numeric := 0;
  v_base_electricity_cost numeric := 0;
  v_base_produced_quantity numeric := 0;
  v_sales_revenue numeric := 0;
  v_material_cost numeric := 0;
  v_machine_purchase_cost numeric := 0;
  v_electricity_cost numeric := 0;
  v_extra_initial_cost numeric := 0;
  v_extra_recurring_cost numeric := 0;
  v_total_cost numeric := 0;
  v_net_income numeric := 0;
  v_plan_count integer := 0;
  v_total_produced numeric := 0;
  v_month_count integer := 6;
  v_trend_rows jsonb := '[]'::jsonb;
  v_income_rows jsonb := '[]'::jsonb;
  v_cost_structure jsonb := '[]'::jsonb;
  v_extra_costs jsonb := '[]'::jsonb;
  v_sales_path text := '';
  v_cost_path text := '';
  v_net_path text := '';
  v_labels jsonb := '[]'::jsonb;
  v_period record;
  v_index integer := 0;
  v_period_count integer := 0;
  v_max_value numeric := 1;
  v_x numeric;
  v_sales_y numeric;
  v_cost_y numeric;
  v_net_y numeric;
  v_period_start date;
  v_period_days numeric;
begin
  if v_company_id is null then
    raise exception 'Current profile is not connected to a company.';
  end if;

  if not public.has_module_permission('operations', 'read') then
    raise exception 'Operations read permission is required.';
  end if;

  select
    coalesce(electricity_price_per_kwh, 0),
    coalesce(working_days_per_month, 22),
    coalesce(initial_cash, 0),
    coalesce(loan_amount, 0),
    coalesce(annual_interest_rate, 0),
    coalesce(loan_term_months, 24),
    coalesce(vat_rate, 20),
    coalesce(income_tax_rate, 20),
    coalesce(raw_material_buffer_months, 1),
    coalesce(salary_buffer_months, 1),
    coalesce(rent_buffer_months, 1)
    into
      v_electricity_price,
      v_working_days_per_month,
      v_initial_cash,
      v_loan_amount,
      v_annual_interest_rate,
      v_loan_term_months,
      v_vat_rate,
      v_income_tax_rate,
      v_raw_material_buffer_months,
      v_salary_buffer_months,
      v_rent_buffer_months
  from public.financial_model_settings
  where company_id = v_company_id;

  v_electricity_price := coalesce(v_electricity_price, 0);
  v_working_days_per_month := coalesce(v_working_days_per_month, 22);
  v_initial_cash := coalesce(v_initial_cash, 0);
  v_loan_amount := coalesce(v_loan_amount, 0);
  v_annual_interest_rate := coalesce(v_annual_interest_rate, 0);
  v_loan_term_months := coalesce(v_loan_term_months, 24);
  v_vat_rate := coalesce(v_vat_rate, 20);
  v_income_tax_rate := coalesce(v_income_tax_rate, 20);
  v_raw_material_buffer_months := coalesce(v_raw_material_buffer_months, 1);
  v_salary_buffer_months := coalesce(v_salary_buffer_months, 1);
  v_rent_buffer_months := coalesce(v_rent_buffer_months, 1);
  v_month_count := case
    when p_horizon = '5y' then 60
    when p_horizon = '1y' then 12
    else 6
  end;

  select
    count(*),
    coalesce(sum(coalesce(nullif(rp.result->>'producedQuantity', '')::numeric, 0)), 0),
    coalesce(sum(coalesce(nullif(rp.result->>'producedQuantity', '')::numeric, 0) * greatest(coalesce(p.price, 0), 0)), 0),
    coalesce(sum(coalesce(nullif(rp.result->>'energyConsumptionKwh', '')::numeric, 0) * v_electricity_price), 0)
  into v_plan_count, v_base_produced_quantity, v_base_sales_revenue, v_base_electricity_cost
  from public.operation_resource_plans rp
  join public.operation_products p on p.id = rp.product_id
  where rp.company_id = v_company_id;

  select coalesce(sum(pm.daily_quantity * greatest(m.price_per_unit, 0)), 0)
    into v_base_material_cost
  from public.operation_plan_materials pm
  join public.operation_resource_plans rp on rp.id = pm.plan_id
  join public.operation_materials m on m.id = pm.material_id
  where rp.company_id = v_company_id;

  select coalesce(sum(machine_price), 0)
    into v_machine_purchase_cost
  from (
    select distinct m.id, greatest(m.price, 0) as machine_price
    from public.operation_plan_machines opm
    join public.operation_resource_plans rp on rp.id = opm.plan_id
    join public.operation_machines m on m.id = opm.machine_id
    where rp.company_id = v_company_id
  ) used_machines;

  select
    coalesce(sum(amount) filter (where cost_type = 'initial'), 0),
    coalesce(sum(amount) filter (where cost_type = 'recurring'), 0),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'name', name,
      'costType', cost_type,
      'amount', amount
    ) order by created_at desc), '[]'::jsonb)
  into v_extra_initial_cost, v_extra_recurring_cost, v_extra_costs
  from public.financial_extra_costs
  where company_id = v_company_id;

  drop table if exists pg_temp.financial_model_periods;

  create temporary table financial_model_periods (
    period_date date,
    produced_quantity numeric,
    sales_revenue numeric,
    material_cost numeric,
    electricity_cost numeric,
    total_cost numeric,
    net_income numeric
  ) on commit drop;

  truncate table financial_model_periods;

  insert into financial_model_periods (
    period_date, produced_quantity, sales_revenue, material_cost, electricity_cost, total_cost, net_income
  )
  select
    period_start,
    v_base_produced_quantity * period_days,
    v_base_sales_revenue * period_days,
    v_base_material_cost * period_days,
    v_base_electricity_cost * period_days,
    (v_base_material_cost * period_days) + (v_base_electricity_cost * period_days) + v_extra_recurring_cost,
    (v_base_sales_revenue * period_days) - ((v_base_material_cost * period_days) + (v_base_electricity_cost * period_days) + v_extra_recurring_cost)
  from (
    select
      (date_trunc('month', current_date)::date + (month_index || ' months')::interval)::date as period_start,
      extract(day from (
        date_trunc('month', current_date)::date
        + (month_index || ' months')::interval
        + interval '1 month - 1 day'
      ))::numeric as period_days
    from generate_series(0, v_month_count - 1) as month_series(month_index)
  ) projection_rows
  order by period_start asc;

  update financial_model_periods
  set total_cost = total_cost + v_machine_purchase_cost + v_extra_initial_cost,
      net_income = sales_revenue - (total_cost + v_machine_purchase_cost + v_extra_initial_cost)
  where period_date = (select min(period_date) from financial_model_periods);

  select
    coalesce(sum(produced_quantity), 0),
    coalesce(sum(sales_revenue), 0),
    coalesce(sum(material_cost), 0),
    coalesce(sum(electricity_cost), 0),
    coalesce(sum(total_cost), 0),
    coalesce(sum(net_income), 0)
  into
    v_total_produced,
    v_sales_revenue,
    v_material_cost,
    v_electricity_cost,
    v_total_cost,
    v_net_income
  from financial_model_periods;

  v_income_rows := jsonb_build_array(
    jsonb_build_object('label', 'Satış kazançları', 'amount', v_sales_revenue, 'kind', 'income'),
    jsonb_build_object('label', 'Malzeme giderleri', 'amount', v_material_cost, 'kind', 'cost'),
    jsonb_build_object('label', 'Makine satın alımı giderleri', 'amount', v_machine_purchase_cost, 'kind', 'cost'),
    jsonb_build_object('label', 'Elektrik giderleri', 'amount', v_electricity_cost, 'kind', 'cost')
  );

  for v_period in
    select name, cost_type, amount
    from public.financial_extra_costs
    where company_id = v_company_id
    order by created_at asc
  loop
    v_income_rows := v_income_rows || jsonb_build_array(jsonb_build_object(
      'label', v_period.name,
      'amount', case when v_period.cost_type = 'recurring' then v_period.amount * v_month_count else v_period.amount end,
      'kind', 'cost',
      'costType', v_period.cost_type
    ));
  end loop;

  v_cost_structure := jsonb_build_array(
    jsonb_build_object('label', 'Malzeme', 'amount', v_material_cost),
    jsonb_build_object('label', 'Makine satın alımı', 'amount', v_machine_purchase_cost),
    jsonb_build_object('label', 'Elektrik', 'amount', v_electricity_cost),
    jsonb_build_object('label', 'Ek başlangıç giderleri', 'amount', v_extra_initial_cost),
    jsonb_build_object('label', 'Ek tekrarlayan giderler', 'amount', v_extra_recurring_cost * v_month_count)
  );

  select
    count(*),
    greatest(
      1,
      coalesce(max(sales_revenue), 0),
      coalesce(max(total_cost), 0),
      coalesce(max(net_income), 0)
    )
  into v_period_count, v_max_value
  from financial_model_periods;

  for v_period in
    select *
    from financial_model_periods
    order by period_date asc
  loop
    v_index := v_index + 1;
    v_x := case when v_period_count <= 1 then 36 else 36 + ((v_index - 1) * (434.0 / (v_period_count - 1))) end;
    v_sales_y := 210 - ((greatest(v_period.sales_revenue, 0) / v_max_value) * 170);
    v_cost_y := 210 - ((greatest(v_period.total_cost, 0) / v_max_value) * 170);
    v_net_y := 210 - ((greatest(v_period.net_income, 0) / v_max_value) * 170);

    v_sales_path := v_sales_path || case when v_index = 1 then 'M' else ' L' end || round(v_x, 2) || ' ' || round(v_sales_y, 2);
    v_cost_path := v_cost_path || case when v_index = 1 then 'M' else ' L' end || round(v_x, 2) || ' ' || round(v_cost_y, 2);
    v_net_path := v_net_path || case when v_index = 1 then 'M' else ' L' end || round(v_x, 2) || ' ' || round(v_net_y, 2);

    v_labels := v_labels || jsonb_build_array(jsonb_build_object(
      'period', v_period.period_date,
      'salesRevenue', v_period.sales_revenue,
      'totalCost', v_period.total_cost,
      'netIncome', v_period.net_income
    ));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'period', period_date,
    'salesRevenue', sales_revenue,
    'materialCost', material_cost,
    'electricityCost', electricity_cost,
    'totalCost', total_cost,
    'netIncome', net_income
  ) order by period_date), '[]'::jsonb)
    into v_trend_rows
  from financial_model_periods;

  return jsonb_build_object(
    'settings', jsonb_build_object(
      'electricityPricePerKwh', v_electricity_price,
      'workingDaysPerMonth', v_working_days_per_month,
      'initialCash', v_initial_cash,
      'loanAmount', v_loan_amount,
      'annualInterestRate', v_annual_interest_rate,
      'loanTermMonths', v_loan_term_months,
      'vatRate', v_vat_rate,
      'incomeTaxRate', v_income_tax_rate,
      'rawMaterialBufferMonths', v_raw_material_buffer_months,
      'salaryBufferMonths', v_salary_buffer_months,
      'rentBufferMonths', v_rent_buffer_months
    ),
    'horizon', p_horizon,
    'summary', jsonb_build_object(
      'planCount', v_plan_count,
      'totalProduced', v_total_produced,
      'salesRevenue', v_sales_revenue,
      'materialCost', v_material_cost,
      'machinePurchaseCost', v_machine_purchase_cost,
      'electricityCost', v_electricity_cost,
      'extraInitialCost', v_extra_initial_cost,
      'extraRecurringCost', v_extra_recurring_cost * v_month_count,
      'totalCost', v_total_cost,
      'netIncome', v_net_income
    ),
    'incomeRows', v_income_rows,
    'costStructure', v_cost_structure,
    'extraCosts', v_extra_costs,
    'trendRows', v_trend_rows,
    'trendChart', jsonb_build_object(
      'salesPath', v_sales_path,
      'costPath', v_cost_path,
      'netPath', v_net_path,
      'labels', v_labels
    )
  );
end;
$$;

grant execute on function public.calculate_financial_model(text) to authenticated;

insert into storage.buckets (id, name, public)
values ('profile-pictures', 'profile-pictures', true)
on conflict (id) do nothing;

drop policy if exists "profile_pictures_public_read" on storage.objects;
drop policy if exists "profile_pictures_owner_insert" on storage.objects;
drop policy if exists "profile_pictures_owner_update" on storage.objects;

create policy "profile_pictures_public_read"
on storage.objects
for select
using (bucket_id = 'profile-pictures');

create policy "profile_pictures_owner_insert"
on storage.objects
for insert
with check (
  bucket_id = 'profile-pictures'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "profile_pictures_owner_update"
on storage.objects
for update
using (
  bucket_id = 'profile-pictures'
  and auth.uid()::text = (storage.foldername(name))[1]
);
