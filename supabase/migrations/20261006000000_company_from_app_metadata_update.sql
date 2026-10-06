-- Users created by an admin landed in a new company of their own.
--
-- The auth server's admin createUser (used by the create-company-user Edge
-- Function) inserts the user first and writes app_metadata in a second
-- statement of the same transaction. handle_new_user runs on the insert, so it
-- never saw app_metadata.company_id: it treated the user as a self sign-up,
-- created a company for them and made them its admin.
--
-- This trigger runs when app_metadata gets a company_id. It moves the profile
-- into that company with the role from app_metadata.access_level, then deletes
-- the company handle_new_user created, but only if that company was created
-- in this same transaction and nobody else belongs to it.

create or replace function public.handle_user_company_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := nullif(new.raw_app_meta_data->>'company_id', '')::uuid;
  v_access_level text := lower(coalesce(nullif(trim(new.raw_app_meta_data->>'access_level'), ''), 'user'));
  v_previous_company_id uuid;
begin
  if v_company_id is null
    or v_company_id is not distinct from nullif(old.raw_app_meta_data->>'company_id', '')::uuid then
    return new;
  end if;

  if not exists (select 1 from public.companies where id = v_company_id) then
    raise exception 'Unknown company for user.';
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

  select company_id into v_previous_company_id from public.profiles where id = new.id;

  update public.profiles
  set company_id = v_company_id,
      access_level = v_access_level
  where id = new.id;

  -- now() is the transaction's start time, so this matches only a company
  -- created in this transaction, by handle_new_user for this user.
  delete from public.companies c
  where c.id = v_previous_company_id
    and c.id <> v_company_id
    and c.created_at = now()
    and not exists (select 1 from public.profiles p where p.company_id = c.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_company_assigned on auth.users;
create trigger on_auth_user_company_assigned
after update of raw_app_meta_data on auth.users
for each row execute function public.handle_user_company_assignment();
