-- New users no longer pick their company from client-supplied metadata.
--
-- Before: handle_new_user read raw_user_meta_data->>'company', which the person
-- signing up controls, so anyone who knew a company's name could join it.
--
-- Now: a user joins an existing company only through raw_app_meta_data, which
-- only the service role can set (the create-company-user Edge Function does
-- this after checking the caller's authorization permission). Anyone else who
-- signs up gets a new, separate company and is its admin.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := nullif(new.raw_app_meta_data->>'company_id', '')::uuid;
  v_access_level text := lower(coalesce(nullif(trim(new.raw_app_meta_data->>'access_level'), ''), 'user'));
  v_company_name text;
begin
  if v_company_id is not null then
    if not exists (select 1 from public.companies where id = v_company_id) then
      raise exception 'Unknown company for new user.';
    end if;

    perform public.ensure_company_defaults(v_company_id);

    if not exists (
      select 1
      from public.company_roles
      where company_id = v_company_id
        and lower(name) = v_access_level
    ) then
      v_access_level := 'user';
    end if;
  else
    v_company_name := coalesce(
      nullif(trim(new.raw_user_meta_data->>'company'), ''),
      split_part(new.email, '@', 1)
    );

    if exists (select 1 from public.companies where name = v_company_name) then
      v_company_name := v_company_name || ' (' || left(new.id::text, 8) || ')';
    end if;

    insert into public.companies (name)
    values (v_company_name)
    returning id into v_company_id;

    v_access_level := 'admin';
  end if;

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
    coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'phone_number',
    v_company_id,
    new.raw_user_meta_data->>'department',
    v_access_level,
    case when new.raw_user_meta_data->>'language' in ('en', 'tr') then new.raw_user_meta_data->>'language' else 'en' end,
    case when new.raw_user_meta_data->>'theme' in ('light', 'dark') then new.raw_user_meta_data->>'theme' else 'light' end
  )
  on conflict (id) do update set
    username = excluded.username,
    email = excluded.email,
    phone_number = excluded.phone_number,
    company_id = excluded.company_id,
    department = excluded.department,
    access_level = profiles.access_level,
    language = excluded.language,
    theme = excluded.theme;

  perform public.ensure_company_defaults(v_company_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
