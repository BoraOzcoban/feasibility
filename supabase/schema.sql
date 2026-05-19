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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists company_id uuid references public.companies(id);

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
values ('authorization', 'Yetkilendirme')
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
        role_record.name = 'admin' and module_record.module_key = 'authorization',
        role_record.name = 'admin' and module_record.module_key = 'authorization'
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
    language
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
    coalesce(new.raw_user_meta_data->>'language', 'en')
  )
  on conflict (id) do update set
    username = excluded.username,
    email = excluded.email,
    phone_number = excluded.phone_number,
    company_id = excluded.company_id,
    department = excluded.department,
    access_level = excluded.access_level,
    language = excluded.language;

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
