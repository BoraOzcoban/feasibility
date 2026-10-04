alter table public.operation_products
  add column if not exists price_currency text not null default 'TRY',
  add column if not exists cycle_time_unit text not null default 'minute',
  add column if not exists default_flow_strategy text not null default 'pull',
  add column if not exists default_batch_size numeric(14, 4) not null default 1,
  add column if not exists minimum_transfer_quantity numeric(14, 4) not null default 1,
  add column if not exists default_safety_stock_quantity numeric(14, 4) not null default 0;

alter table public.operation_machines
  add column if not exists price_currency text not null default 'TRY',
  add column if not exists concurrent_capacity numeric(10, 2) not null default 1,
  add column if not exists availability_hours numeric(10, 2) not null default 8,
  add column if not exists speed_multiplier numeric(10, 4) not null default 1,
  add column if not exists failure_probability_percent numeric(5, 2) not null default 0;

alter table public.operation_materials
  add column if not exists material_group text not null default 'Genel',
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

alter table public.operation_products
  drop constraint if exists operation_products_default_flow_strategy_check;

update public.operation_products
set default_flow_strategy = case
      when default_flow_strategy = 'batch' then 'push'
      when default_flow_strategy in ('flow', 'parallel') then 'pull'
      when default_flow_strategy in ('push', 'pull') then default_flow_strategy
      else 'pull'
    end,
    minimum_transfer_quantity = greatest(1, coalesce(minimum_transfer_quantity, 1)),
    default_batch_size = greatest(greatest(1, coalesce(minimum_transfer_quantity, 1)), coalesce(default_batch_size, 1)),
    default_safety_stock_quantity = greatest(0, coalesce(default_safety_stock_quantity, 0));

alter table public.operation_products
  alter column default_flow_strategy set default 'pull';

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'operation_products'
      and constraint_name = 'operation_products_default_flow_strategy_check'
  ) then
    alter table public.operation_products
      add constraint operation_products_default_flow_strategy_check
      check (default_flow_strategy in ('push', 'pull'));
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'operation_products'
      and constraint_name = 'operation_products_transfer_quantities_check'
  ) then
    alter table public.operation_products
      add constraint operation_products_transfer_quantities_check
      check (minimum_transfer_quantity >= 1 and default_batch_size >= minimum_transfer_quantity);
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'operation_products'
      and constraint_name = 'operation_products_safety_stock_check'
  ) then
    alter table public.operation_products
      add constraint operation_products_safety_stock_check
      check (default_safety_stock_quantity >= 0);
  end if;
end;
$$;

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

create table if not exists public.operation_product_processes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.operation_products(id) on delete cascade,
  step_order integer not null check (step_order >= 1),
  operation_name text not null,
  machine_id uuid not null references public.operation_machines(id),
  process_time_minutes numeric(14, 4) not null default 1 check (process_time_minutes > 0),
  daily_hours numeric(10, 2) not null default 8 check (daily_hours >= 0),
  material_id uuid references public.operation_materials(id) on delete set null,
  material_quantity_per_unit numeric(14, 4) not null default 0 check (material_quantity_per_unit >= 0),
  equipment_id uuid references public.operation_equipment(id) on delete set null,
  workforce_id uuid references public.operation_workforce_resources(id) on delete set null,
  people_assigned numeric(10, 2) not null default 0 check (people_assigned >= 0),
  workforce_daily_hours numeric(10, 2) not null default 0 check (workforce_daily_hours >= 0),
  capacity numeric(10, 2) not null default 1 check (capacity >= 1),
  setup_minutes numeric(14, 4) not null default 0 check (setup_minutes >= 0),
  speed_multiplier numeric(10, 4) not null default 1 check (speed_multiplier > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, step_order)
);

with latest_product_plans as (
  select distinct on (product_id)
    product_id,
    input
  from public.operation_resource_plans
  where jsonb_typeof(input->'operationRows') = 'array'
  order by product_id, is_active desc, created_at desc
),
legacy_process_rows as (
  select
    plan.product_id,
    process.value,
    process.ordinality::integer as step_order
  from latest_product_plans plan
  cross join lateral jsonb_array_elements(plan.input->'operationRows') with ordinality as process(value, ordinality)
)
insert into public.operation_product_processes (
  product_id, step_order, operation_name, machine_id, process_time_minutes,
  daily_hours, material_id, material_quantity_per_unit, equipment_id,
  workforce_id, people_assigned, workforce_daily_hours, capacity,
  setup_minutes, speed_multiplier
)
select
  process.product_id,
  process.step_order,
  coalesce(nullif(trim(process.value->>'operationName'), ''), 'Process ' || process.step_order::text),
  machine.id,
  greatest(0.0001, coalesce(nullif(process.value->>'processTimeMinutes', '')::numeric, 1)),
  greatest(0, coalesce(nullif(process.value->>'dailyHours', '')::numeric, machine.availability_hours, 8)),
  material.id,
  greatest(0, coalesce(nullif(process.value->>'materialQuantityPerUnit', '')::numeric, 0)),
  equipment.id,
  workforce.id,
  greatest(0, coalesce(nullif(process.value->>'peopleAssigned', '')::numeric, 0)),
  greatest(0, coalesce(nullif(process.value->>'workforceDailyHours', '')::numeric, 0)),
  greatest(1, coalesce(nullif(process.value->>'capacity', '')::numeric, machine.concurrent_capacity, 1)),
  greatest(0, coalesce(nullif(process.value->>'setupMinutes', '')::numeric, 0)),
  greatest(0.0001, coalesce(nullif(process.value->>'speedMultiplier', '')::numeric, 1))
from legacy_process_rows process
join public.operation_machines machine
  on machine.id::text = process.value->>'machineId'
join public.operation_products product
  on product.id = process.product_id
 and product.company_id = machine.company_id
left join public.operation_materials material
  on material.id::text = process.value->>'materialId'
 and material.company_id = product.company_id
left join public.operation_equipment equipment
  on equipment.id::text = process.value->>'equipmentId'
 and equipment.company_id = product.company_id
left join public.operation_workforce_resources workforce
  on workforce.id::text = process.value->>'workforceId'
 and workforce.company_id = product.company_id
where not exists (
  select 1
  from public.operation_product_processes existing
  where existing.product_id = process.product_id
)
on conflict (product_id, step_order) do nothing;

alter table public.operation_product_processes enable row level security;

drop policy if exists "operation_product_processes_select_company" on public.operation_product_processes;
drop policy if exists "operation_product_processes_write_company" on public.operation_product_processes;

create policy "operation_product_processes_select_company"
on public.operation_product_processes
for select
using (
  exists (
    select 1 from public.operation_products p
    where p.id = operation_product_processes.product_id
      and p.company_id = public.current_profile_company_id()
  )
  and public.has_module_permission('operations', 'read')
);

create policy "operation_product_processes_write_company"
on public.operation_product_processes
for all
using (
  exists (
    select 1 from public.operation_products p
    where p.id = operation_product_processes.product_id
      and p.company_id = public.current_profile_company_id()
  )
  and public.has_module_permission('operations', 'write')
)
with check (
  exists (
    select 1
    from public.operation_products p
    join public.operation_machines m on m.id = operation_product_processes.machine_id
    where p.id = operation_product_processes.product_id
      and m.company_id = p.company_id
      and p.company_id = public.current_profile_company_id()
  )
  and (
    operation_product_processes.material_id is null
    or exists (
      select 1
      from public.operation_materials material
      join public.operation_products p on p.id = operation_product_processes.product_id
      where material.id = operation_product_processes.material_id
        and material.company_id = p.company_id
    )
  )
  and (
    operation_product_processes.equipment_id is null
    or exists (
      select 1
      from public.operation_equipment equipment
      join public.operation_products p on p.id = operation_product_processes.product_id
      where equipment.id = operation_product_processes.equipment_id
        and equipment.company_id = p.company_id
    )
  )
  and (
    operation_product_processes.workforce_id is null
    or exists (
      select 1
      from public.operation_workforce_resources workforce
      join public.operation_products p on p.id = operation_product_processes.product_id
      where workforce.id = operation_product_processes.workforce_id
        and workforce.company_id = p.company_id
    )
  )
  and public.has_module_permission('operations', 'write')
);

drop trigger if exists operation_product_processes_set_updated_at on public.operation_product_processes;
create trigger operation_product_processes_set_updated_at
before update on public.operation_product_processes
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
  v_equipment_id uuid;
  v_machine_id uuid;
  v_material_id uuid;
  v_process_count integer;
  v_step_order integer;
  v_workforce_id uuid;
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
        end,
        default_flow_strategy = case
          when p_input->>'defaultFlowStrategy' in ('push', 'pull') then p_input->>'defaultFlowStrategy'
          when p_input->>'defaultFlowStrategy' = 'batch' then 'push'
          when p_input->>'defaultFlowStrategy' in ('flow', 'parallel') then 'pull'
          else default_flow_strategy
        end,
        default_safety_stock_quantity = greatest(0, coalesce(nullif(p_input->>'defaultSafetyStockQuantity', '')::numeric, default_safety_stock_quantity, 0)),
        minimum_transfer_quantity = greatest(1, coalesce(nullif(p_input->>'minimumTransferQuantity', '')::numeric, minimum_transfer_quantity, 1)),
        default_batch_size = greatest(
          greatest(1, coalesce(nullif(p_input->>'minimumTransferQuantity', '')::numeric, minimum_transfer_quantity, 1)),
          coalesce(
            nullif(p_input->>'defaultBatchSize', '')::numeric,
            default_batch_size,
            greatest(1, coalesce(nullif(p_input->>'minimumTransferQuantity', '')::numeric, minimum_transfer_quantity, 1))
          )
        )
      where id = v_record_id
        and company_id = v_company_id;
    else
      insert into public.operation_products (
        company_id, product_code, name, unit, price, price_currency, cycle_time_minutes,
        cycle_time_unit, default_flow_strategy, default_batch_size, minimum_transfer_quantity, default_safety_stock_quantity,
        product_group, revision, status, description
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
        case
          when p_input->>'defaultFlowStrategy' in ('push', 'pull') then p_input->>'defaultFlowStrategy'
          when p_input->>'defaultFlowStrategy' = 'batch' then 'push'
          when p_input->>'defaultFlowStrategy' in ('flow', 'parallel') then 'pull'
          else 'pull'
        end,
        greatest(
          greatest(1, coalesce(nullif(p_input->>'minimumTransferQuantity', '')::numeric, 1)),
          coalesce(nullif(p_input->>'defaultBatchSize', '')::numeric, greatest(1, coalesce(nullif(p_input->>'minimumTransferQuantity', '')::numeric, 1)))
        ),
        greatest(1, coalesce(nullif(p_input->>'minimumTransferQuantity', '')::numeric, 1)),
        greatest(0, coalesce(nullif(p_input->>'defaultSafetyStockQuantity', '')::numeric, 0)),
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
        default_flow_strategy = excluded.default_flow_strategy,
        default_batch_size = excluded.default_batch_size,
        minimum_transfer_quantity = excluded.minimum_transfer_quantity,
        default_safety_stock_quantity = excluded.default_safety_stock_quantity,
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

    v_process_count := case
      when jsonb_typeof(p_input->'processRows') = 'array' then jsonb_array_length(p_input->'processRows')
      else 0
    end;

    if v_process_count = 0 then
      raise exception 'Add at least one ordered process before saving the product.';
    end if;

    delete from public.operation_product_processes
    where product_id = v_record_id;

    v_step_order := 0;
    for v_entry in
      select value
      from jsonb_array_elements(p_input->'processRows')
    loop
      v_step_order := v_step_order + 1;
      v_machine_id := nullif(v_entry->>'machineId', '')::uuid;
      v_material_id := nullif(v_entry->>'materialId', '')::uuid;
      v_equipment_id := nullif(v_entry->>'equipmentId', '')::uuid;
      v_workforce_id := nullif(v_entry->>'workforceId', '')::uuid;

      if nullif(trim(v_entry->>'operationName'), '') is null then
        raise exception 'Every product process needs a name.';
      end if;

      if v_machine_id is null or not exists (
        select 1
        from public.operation_machines
        where id = v_machine_id
          and company_id = v_company_id
      ) then
        raise exception 'Every product process needs a machine from your company.';
      end if;

      if v_material_id is not null and not exists (
        select 1
        from public.operation_product_materials
        where product_id = v_record_id
          and material_id = v_material_id
      ) then
        raise exception 'Process materials must be included in the product recipe.';
      end if;

      if v_equipment_id is not null and not exists (
        select 1 from public.operation_equipment
        where id = v_equipment_id and company_id = v_company_id
      ) then
        raise exception 'Selected process equipment was not found for your company.';
      end if;

      if v_workforce_id is not null and not exists (
        select 1 from public.operation_workforce_resources
        where id = v_workforce_id and company_id = v_company_id
      ) then
        raise exception 'Selected process workforce was not found for your company.';
      end if;

      insert into public.operation_product_processes (
        product_id, step_order, operation_name, machine_id, process_time_minutes,
        daily_hours, material_id, material_quantity_per_unit, equipment_id,
        workforce_id, people_assigned, workforce_daily_hours, capacity,
        setup_minutes, speed_multiplier
      )
      values (
        v_record_id,
        v_step_order,
        trim(v_entry->>'operationName'),
        v_machine_id,
        greatest(0.0001, coalesce(nullif(v_entry->>'processTimeMinutes', '')::numeric, 1)),
        greatest(0, coalesce(nullif(v_entry->>'dailyHours', '')::numeric, 8)),
        v_material_id,
        greatest(0, coalesce(nullif(v_entry->>'materialQuantityPerUnit', '')::numeric, 0)),
        v_equipment_id,
        v_workforce_id,
        greatest(0, coalesce(nullif(v_entry->>'peopleAssigned', '')::numeric, 0)),
        greatest(0, coalesce(nullif(v_entry->>'workforceDailyHours', '')::numeric, 0)),
        greatest(1, coalesce(nullif(v_entry->>'capacity', '')::numeric, 1)),
        greatest(0, coalesce(nullif(v_entry->>'setupMinutes', '')::numeric, 0)),
        greatest(0.0001, coalesce(nullif(v_entry->>'speedMultiplier', '')::numeric, 1))
      );
    end loop;

    select to_jsonb(p.*) into v_row from public.operation_products p where p.id = v_record_id;
    return v_row;
  end if;

  if p_entity = 'material' then
    insert into public.operation_materials (
      company_id, name, material_group, unit, price_per_unit, price_currency
    )
    values (
      v_company_id,
      nullif(trim(p_input->>'name'), ''),
      coalesce(nullif(trim(p_input->>'materialGroup'), ''), 'Genel'),
      coalesce(nullif(trim(p_input->>'unit'), ''), 'kg'),
      greatest(0, coalesce(nullif(p_input->>'pricePerUnit', '')::numeric, 0)),
      case when upper(coalesce(nullif(trim(p_input->>'priceCurrency'), ''), 'TRY')) in ('TRY', 'USD', 'EUR') then upper(coalesce(nullif(trim(p_input->>'priceCurrency'), ''), 'TRY')) else 'TRY' end
    )
    on conflict (company_id, name) do update set
      material_group = excluded.material_group,
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
