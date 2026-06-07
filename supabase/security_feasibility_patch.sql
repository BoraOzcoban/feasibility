-- Run this in the Supabase SQL Editor after the base schema.
-- It applies the auth hardening and active process-plan fixes used by the app.

drop function if exists public.get_login_email(text);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_name text := coalesce(nullif(trim(new.raw_user_meta_data->>'company'), ''), 'Atera');
  v_company_id uuid;
  v_access_level text := 'user';
begin
  insert into public.companies (name)
  values (v_company_name)
  on conflict (name) do nothing;

  select id
    into v_company_id
  from public.companies
  where name = v_company_name
  limit 1;

  if not exists (
    select 1
    from public.profiles
    where company_id = v_company_id
  ) then
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
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'phone_number',
    v_company_id,
    new.raw_user_meta_data->>'department',
    v_access_level,
    coalesce(new.raw_user_meta_data->>'language', 'en'),
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

alter table public.operation_resource_plans
  add column if not exists is_active boolean not null default true;

with ranked_plans as (
  select
    id,
    row_number() over (partition by company_id, product_id order by created_at desc, id desc) as plan_rank
  from public.operation_resource_plans
)
update public.operation_resource_plans p
set is_active = ranked_plans.plan_rank = 1
from ranked_plans
where p.id = ranked_plans.id;

insert into public.app_modules (module_key, name)
values
  ('sales-strategy', 'Satış Stratejisi'),
  ('financial-modelling', 'Finansal Modelleme'),
  ('simulation', 'Simülasyon'),
  ('reports', 'Raporlar')
on conflict (module_key) do update set name = excluded.name;

select public.ensure_company_defaults(id) from public.companies;

create or replace function public.save_operation_resource_plan(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := public.current_profile_company_id();
  v_product_id uuid := nullif(p_input->>'productId', '')::uuid;
  v_plan_name text := coalesce(nullif(trim(p_input->>'planName'), ''), 'Daily production plan');
  v_product_name text := coalesce(nullif(trim(p_input->>'productName'), ''), 'Default product');
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

  if v_product_id is null then
    raise exception 'Select a saved product before saving a process plan.';
  end if;

  if not exists (
    select 1
    from public.operation_products
    where id = v_product_id
      and company_id = v_company_id
  ) then
    raise exception 'Selected product was not found for your company.';
  end if;

  select name, unit, price, cycle_time_minutes
    into v_product_name, v_product_unit, v_product_price, v_product_cycle_time_minutes
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

  if v_produced_quantity <= 0 then
    raise exception 'At least one selected machine must have daily hours greater than zero.';
  end if;

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

  if v_product_material_count = 0 then
    raise exception 'The selected product needs a saved material recipe before feasibility can be calculated.';
  end if;

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

  if not exists (
    select 1
    from jsonb_array_elements(v_material_summary) as material_row(value)
    where coalesce(nullif(material_row.value->>'dailyQuantity', '')::numeric, 0) > 0
  ) then
    raise exception 'The selected product needs at least one positive material recipe quantity before feasibility can be calculated.';
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

  update public.operation_resource_plans
  set is_active = false
  where company_id = v_company_id
    and product_id = v_product_id
    and is_active;

  insert into public.operation_resource_plans (
    company_id, product_id, plan_name, is_active, target_daily_output, input, result, created_by
  )
  values (
    v_company_id, v_product_id, v_plan_name, true, 0, p_input, v_result, auth.uid()
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

insert into storage.buckets (id, name, public)
values ('profile-pictures', 'profile-pictures', false)
on conflict (id) do nothing;

update storage.buckets
set public = false
where id = 'profile-pictures';

drop policy if exists "profile_pictures_public_read" on storage.objects;
drop policy if exists "profile_pictures_owner_read" on storage.objects;
drop policy if exists "profile_pictures_owner_insert" on storage.objects;
drop policy if exists "profile_pictures_owner_update" on storage.objects;

create policy "profile_pictures_owner_read"
on storage.objects
for select
using (
  bucket_id = 'profile-pictures'
  and auth.uid()::text = (storage.foldername(name))[1]
);

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
)
with check (
  bucket_id = 'profile-pictures'
  and auth.uid()::text = (storage.foldername(name))[1]
);

select pg_notify('pgrst', 'reload schema');
