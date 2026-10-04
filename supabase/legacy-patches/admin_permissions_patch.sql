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
    where p.id = auth.uid()
      and lower(p.access_level) = 'admin'
  )
  or exists (
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

update public.role_permissions rp
set can_read = true,
    can_write = true
from public.company_roles r
where rp.role_id = r.id
  and lower(r.name) = 'admin';

grant execute on function public.has_module_permission(text, text) to authenticated;
