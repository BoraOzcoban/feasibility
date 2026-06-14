alter table public.operation_products
  add column if not exists price_currency text not null default 'TRY',
  add column if not exists cycle_time_unit text not null default 'minute';

alter table public.operation_machines
  add column if not exists price_currency text not null default 'TRY',
  add column if not exists concurrent_capacity numeric(10, 2) not null default 1,
  add column if not exists availability_hours numeric(10, 2) not null default 8,
  add column if not exists speed_multiplier numeric(10, 4) not null default 1,
  add column if not exists failure_probability_percent numeric(5, 2) not null default 0;

alter table public.operation_materials
  add column if not exists price_currency text not null default 'TRY';

alter table public.operation_workforce_resources
  add column if not exists hourly_cost_currency text not null default 'TRY';

update public.operation_products
set cycle_time_unit = 'minute'
where cycle_time_unit is null
   or cycle_time_unit not in ('minute', 'hour', 'day');

update public.operation_products
set price_currency = 'TRY'
where price_currency not in ('TRY', 'USD', 'EUR');

update public.operation_machines
set price_currency = 'TRY'
where price_currency not in ('TRY', 'USD', 'EUR');

update public.operation_materials
set price_currency = 'TRY'
where price_currency not in ('TRY', 'USD', 'EUR');

update public.operation_workforce_resources
set hourly_cost_currency = 'TRY'
where hourly_cost_currency not in ('TRY', 'USD', 'EUR');

create table if not exists public.operation_equipment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  price numeric(14, 2) not null default 0,
  price_currency text not null default 'TRY' check (price_currency in ('TRY', 'USD', 'EUR')),
  quantity numeric(14, 4) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

alter table public.operation_equipment
  add column if not exists price numeric(14, 2) not null default 0,
  add column if not exists price_currency text not null default 'TRY',
  add column if not exists quantity numeric(14, 4) not null default 1;

update public.operation_equipment
set price_currency = 'TRY'
where price_currency not in ('TRY', 'USD', 'EUR');

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
      company_id, name, price, price_currency, hourly_energy_consumption_kwh,
      concurrent_capacity, availability_hours, speed_multiplier, failure_probability_percent
    )
    values (
      v_company_id,
      nullif(trim(p_input->>'name'), ''),
      greatest(0, coalesce(nullif(p_input->>'price', '')::numeric, 0)),
      case when upper(coalesce(nullif(trim(p_input->>'priceCurrency'), ''), 'TRY')) in ('TRY', 'USD', 'EUR') then upper(coalesce(nullif(trim(p_input->>'priceCurrency'), ''), 'TRY')) else 'TRY' end,
      greatest(0, coalesce(nullif(p_input->>'hourlyEnergyConsumptionKwh', '')::numeric, 0)),
      greatest(1, coalesce(nullif(p_input->>'concurrentCapacity', '')::numeric, 1)),
      greatest(0, coalesce(nullif(p_input->>'availabilityHours', '')::numeric, 8)),
      greatest(0.0001, coalesce(nullif(p_input->>'speedMultiplier', '')::numeric, 1)),
      greatest(0, coalesce(nullif(p_input->>'failureProbabilityPercent', '')::numeric, 0))
    )
    on conflict (company_id, name) do update set
      price = excluded.price,
      price_currency = excluded.price_currency,
      hourly_energy_consumption_kwh = excluded.hourly_energy_consumption_kwh,
      concurrent_capacity = excluded.concurrent_capacity,
      availability_hours = excluded.availability_hours,
      speed_multiplier = excluded.speed_multiplier,
      failure_probability_percent = excluded.failure_probability_percent
    returning id into v_record_id;

    select to_jsonb(m.*) into v_row from public.operation_machines m where m.id = v_record_id;
    return v_row;
  end if;

  if p_entity = 'equipment' then
    insert into public.operation_equipment (
      company_id, name, price, price_currency, quantity
    )
    values (
      v_company_id,
      nullif(trim(p_input->>'name'), ''),
      greatest(0, coalesce(nullif(p_input->>'price', '')::numeric, 0)),
      case when upper(coalesce(nullif(trim(p_input->>'priceCurrency'), ''), 'TRY')) in ('TRY', 'USD', 'EUR') then upper(coalesce(nullif(trim(p_input->>'priceCurrency'), ''), 'TRY')) else 'TRY' end,
      greatest(0, coalesce(nullif(p_input->>'quantity', '')::numeric, 1))
    )
    on conflict (company_id, name) do update set
      price = excluded.price,
      price_currency = excluded.price_currency,
      quantity = excluded.quantity
    returning id into v_record_id;

    select to_jsonb(e.*) into v_row from public.operation_equipment e where e.id = v_record_id;
    return v_row;
  end if;

  if p_entity = 'product' then
    v_record_id := nullif(p_input->>'productId', '')::uuid;

    if v_record_id is not null and exists (
      select 1
      from public.operation_products
      where id = v_record_id
        and company_id = v_company_id
    ) then
      update public.operation_products
      set
        name = nullif(trim(p_input->>'name'), ''),
        unit = coalesce(nullif(trim(p_input->>'unit'), ''), 'adet'),
        price = greatest(0, coalesce(nullif(p_input->>'price', '')::numeric, 0)),
        price_currency = case when upper(coalesce(nullif(trim(p_input->>'priceCurrency'), ''), 'TRY')) in ('TRY', 'USD', 'EUR') then upper(coalesce(nullif(trim(p_input->>'priceCurrency'), ''), 'TRY')) else 'TRY' end,
        cycle_time_minutes = greatest(0.0001, coalesce(nullif(p_input->>'cycleTimeMinutes', '')::numeric, 1)),
        cycle_time_unit = case
          when p_input->>'cycleTimeUnit' in ('minute', 'hour', 'day') then p_input->>'cycleTimeUnit'
          else 'minute'
        end
      where id = v_record_id
        and company_id = v_company_id;
    else
      insert into public.operation_products (
        company_id, product_code, name, unit, price, price_currency, cycle_time_minutes, cycle_time_unit, product_group, revision, status, description
      )
      values (
        v_company_id,
        'PROD-' || upper(substr(md5(coalesce(nullif(trim(p_input->>'name'), ''), gen_random_uuid()::text)), 1, 12)),
        nullif(trim(p_input->>'name'), ''),
        coalesce(nullif(trim(p_input->>'unit'), ''), 'adet'),
        greatest(0, coalesce(nullif(p_input->>'price', '')::numeric, 0)),
        case when upper(coalesce(nullif(trim(p_input->>'priceCurrency'), ''), 'TRY')) in ('TRY', 'USD', 'EUR') then upper(coalesce(nullif(trim(p_input->>'priceCurrency'), ''), 'TRY')) else 'TRY' end,
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
        price_currency = excluded.price_currency,
        cycle_time_minutes = excluded.cycle_time_minutes,
        cycle_time_unit = excluded.cycle_time_unit,
        product_group = excluded.product_group,
        status = excluded.status,
        description = excluded.description
      returning id into v_record_id;
    end if;

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
      company_id, name, unit, price_per_unit, price_currency
    )
    values (
      v_company_id,
      nullif(trim(p_input->>'name'), ''),
      coalesce(nullif(trim(p_input->>'unit'), ''), 'kg'),
      greatest(0, coalesce(nullif(p_input->>'pricePerUnit', '')::numeric, 0)),
      case when upper(coalesce(nullif(trim(p_input->>'priceCurrency'), ''), 'TRY')) in ('TRY', 'USD', 'EUR') then upper(coalesce(nullif(trim(p_input->>'priceCurrency'), ''), 'TRY')) else 'TRY' end
    )
    on conflict (company_id, name) do update set
      unit = excluded.unit,
      price_per_unit = excluded.price_per_unit,
      price_currency = excluded.price_currency
    returning id into v_record_id;

    select to_jsonb(m.*) into v_row from public.operation_materials m where m.id = v_record_id;
    return v_row;
  end if;

  if p_entity = 'workforce' then
    insert into public.operation_workforce_resources (
      company_id, role_name, hourly_cost, hourly_cost_currency
    )
    values (
      v_company_id,
      nullif(trim(p_input->>'roleName'), ''),
      greatest(0, coalesce(nullif(p_input->>'hourlyCost', '')::numeric, 0)),
      case when upper(coalesce(nullif(trim(p_input->>'hourlyCostCurrency'), ''), 'TRY')) in ('TRY', 'USD', 'EUR') then upper(coalesce(nullif(trim(p_input->>'hourlyCostCurrency'), ''), 'TRY')) else 'TRY' end
    )
    on conflict (company_id, role_name) do update set
      hourly_cost = excluded.hourly_cost,
      hourly_cost_currency = excluded.hourly_cost_currency
    returning id into v_record_id;

    select to_jsonb(w.*) into v_row from public.operation_workforce_resources w where w.id = v_record_id;
    return v_row;
  end if;

  raise exception 'Unsupported operation entity: %', p_entity;
end;
$$;

grant execute on function public.save_operation_record(text, jsonb) to authenticated;

select pg_notify('pgrst', 'reload schema');
