alter table public.operation_products
  add column if not exists cycle_time_unit text not null default 'minute';

update public.operation_products
set cycle_time_unit = 'minute'
where cycle_time_unit is null
   or cycle_time_unit not in ('minute', 'hour', 'day');

create table if not exists public.operation_equipment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  price numeric(14, 2) not null default 0,
  quantity numeric(14, 4) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

alter table public.operation_equipment
  add column if not exists price numeric(14, 2) not null default 0,
  add column if not exists quantity numeric(14, 4) not null default 1;

alter table public.operation_equipment enable row level security;

drop policy if exists "operation_equipment_select_company" on public.operation_equipment;
drop policy if exists "operation_equipment_write_company" on public.operation_equipment;

create policy "operation_equipment_select_company"
on public.operation_equipment
for select
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'read'));

create policy "operation_equipment_write_company"
on public.operation_equipment
for all
using (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'))
with check (company_id = public.current_profile_company_id() and public.has_module_permission('operations', 'write'));

drop trigger if exists operation_equipment_set_updated_at on public.operation_equipment;
create trigger operation_equipment_set_updated_at
before update on public.operation_equipment
for each row execute function public.set_updated_at();

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

  if p_entity = 'equipment' then
    insert into public.operation_equipment (
      company_id, name, price, quantity
    )
    values (
      v_company_id,
      nullif(trim(p_input->>'name'), ''),
      greatest(0, coalesce(nullif(p_input->>'price', '')::numeric, 0)),
      greatest(0, coalesce(nullif(p_input->>'quantity', '')::numeric, 1))
    )
    on conflict (company_id, name) do update set
      price = excluded.price,
      quantity = excluded.quantity
    returning id into v_record_id;

    select to_jsonb(e.*) into v_row from public.operation_equipment e where e.id = v_record_id;
    return v_row;
  end if;

  if p_entity = 'product' then
    insert into public.operation_products (
      company_id, product_code, name, unit, price, cycle_time_minutes, cycle_time_unit, product_group, revision, status, description
    )
    values (
      v_company_id,
      'PROD-' || upper(substr(md5(coalesce(nullif(trim(p_input->>'name'), ''), gen_random_uuid()::text)), 1, 12)),
      nullif(trim(p_input->>'name'), ''),
      coalesce(nullif(trim(p_input->>'unit'), ''), 'adet'),
      greatest(0, coalesce(nullif(p_input->>'price', '')::numeric, 0)),
      greatest(0.0001, coalesce(nullif(p_input->>'cycleTimeMinutes', '')::numeric, 1)),
      case
        when p_input->>'cycleTimeUnit' in ('minute', 'hour', 'day') then p_input->>'cycleTimeUnit'
        else 'minute'
      end,
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
      cycle_time_unit = excluded.cycle_time_unit,
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
