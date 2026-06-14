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

alter table public.operation_machines
  add column if not exists concurrent_capacity numeric(10, 2) not null default 1,
  add column if not exists availability_hours numeric(10, 2) not null default 8,
  add column if not exists speed_multiplier numeric(10, 4) not null default 1,
  add column if not exists failure_probability_percent numeric(5, 2) not null default 0;

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

create or replace function public.calculate_operation_flow_schedule(
  p_company_id uuid,
  p_input jsonb,
  p_product_cycle_time_minutes numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation_rows jsonb := case when jsonb_typeof(p_input->'operationRows') = 'array' then p_input->'operationRows' else '[]'::jsonb end;
  v_operation_count integer := 0;
  v_operation_index integer;
  v_group_index integer;
  v_machine_index integer;
  v_target_quantity numeric := greatest(0, coalesce(nullif(p_input->>'targetQuantity', '')::numeric, 0));
  v_min_transfer_quantity numeric := greatest(1, coalesce(nullif(p_input->>'minimumTransferQuantity', '')::numeric, 1));
  v_batch_size numeric;
  v_transfer_batch_size numeric;
  v_group_count integer;
  v_strategy text := case when p_input->>'flowStrategy' in ('batch', 'flow', 'parallel') then p_input->>'flowStrategy' else 'flow' end;
  v_buffer_max_quantity numeric := greatest(0, coalesce(nullif(p_input->>'bufferMaxQuantity', '')::numeric, 0));
  v_waiting_cost_per_hour numeric := greatest(0, coalesce(nullif(p_input->>'waitingCostPerHour', '')::numeric, 0));
  v_inventory_cost_per_unit_hour numeric := greatest(0, coalesce(nullif(p_input->>'inventoryCostPerUnitHour', '')::numeric, 0));
  v_delay_cost_per_hour numeric := greatest(0, coalesce(nullif(p_input->>'delayCostPerHour', '')::numeric, 0));
  v_capacity_loss_cost_per_hour numeric := greatest(0, coalesce(nullif(p_input->>'capacityLossCostPerHour', '')::numeric, 0));
  v_entry jsonb;
  v_event jsonb;
  v_machine record;
  v_machine_id uuid;
  v_machine_ids uuid[] := '{}';
  v_machine_names text[] := '{}';
  v_machine_energy numeric[] := '{}';
  v_machine_prices numeric[] := '{}';
  v_machine_price_currencies text[] := '{}';
  v_machine_availability_hours numeric[] := '{}';
  v_machine_available_at numeric[] := '{}';
  v_machine_busy_minutes numeric[] := '{}';
  v_operation_ids text[] := '{}';
  v_operation_names text[] := '{}';
  v_operation_machine_ids uuid[] := '{}';
  v_operation_machine_names text[] := '{}';
  v_operation_process_minutes numeric[] := '{}';
  v_operation_capacities numeric[] := '{}';
  v_operation_setup_minutes numeric[] := '{}';
  v_operation_speed_multipliers numeric[] := '{}';
  v_operation_availability_hours numeric[] := '{}';
  v_operation_busy_minutes numeric[] := '{}';
  v_operation_wait_minutes numeric[] := '{}';
  v_operation_start_minutes numeric[] := '{}';
  v_operation_finish_minutes numeric[] := '{}';
  v_previous_finishes numeric[];
  v_current_finishes numeric[];
  v_group_quantity numeric;
  v_precedence_ready_minutes numeric;
  v_start_minutes numeric;
  v_setup_minutes numeric;
  v_process_minutes numeric;
  v_duration_minutes numeric;
  v_finish_minutes numeric;
  v_wait_minutes numeric;
  v_makespan_minutes numeric := 0;
  v_total_queue_wait_minutes numeric := 0;
  v_total_processing_time_minutes numeric := 0;
  v_total_idle_hours numeric := 0;
  v_total_wip_unit_minutes numeric := 0;
  v_max_wip_quantity numeric := 0;
  v_schedule_window_minutes numeric := 0;
  v_delay_minutes numeric := 0;
  v_waiting_cost numeric := 0;
  v_inventory_cost numeric := 0;
  v_delay_cost numeric := 0;
  v_capacity_loss_cost numeric := 0;
  v_operation_timing_rows jsonb := '[]'::jsonb;
  v_operation_summary jsonb := '[]'::jsonb;
  v_machine_summary jsonb := '[]'::jsonb;
  v_buffer_summary jsonb := '[]'::jsonb;
  v_buffer_events jsonb;
  v_event_sample jsonb := '[]'::jsonb;
  v_event_count integer := 0;
  v_from_finish_minutes numeric;
  v_to_start_minutes numeric;
  v_buffer_level numeric;
  v_last_event_minutes numeric;
  v_buffer_area numeric;
  v_buffer_max_wip numeric;
  v_waiting_unit_minutes numeric;
  v_bottleneck_busy_minutes numeric := 0;
  v_bottleneck jsonb := null;
  v_available_minutes numeric;
  v_idle_hours numeric;
begin
  if jsonb_array_length(v_operation_rows) = 0 or v_target_quantity <= 0 then
    return null;
  end if;

  if v_min_transfer_quantity > v_target_quantity then
    v_min_transfer_quantity := v_target_quantity;
  end if;

  v_batch_size := greatest(v_min_transfer_quantity, coalesce(nullif(p_input->>'batchSize', '')::numeric, v_min_transfer_quantity));
  v_transfer_batch_size := case
    when v_strategy = 'batch' then v_target_quantity
    when v_strategy = 'parallel' then v_min_transfer_quantity
    else least(v_target_quantity, v_batch_size)
  end;
  v_group_count := greatest(1, ceil(v_target_quantity / greatest(v_transfer_batch_size, 1))::integer);

  for v_entry in select value from jsonb_array_elements(v_operation_rows) loop
    v_machine_id := nullif(v_entry->>'machineId', '')::uuid;
    if v_machine_id is null then
      continue;
    end if;

    select * into v_machine
    from public.operation_machines
    where id = v_machine_id
      and company_id = p_company_id;

    if not found then
      raise exception 'Selected operation machine was not found for your company.';
    end if;

    v_operation_count := v_operation_count + 1;
    v_machine_index := array_position(v_machine_ids, v_machine_id);

    if v_machine_index is null then
      v_machine_ids := array_append(v_machine_ids, v_machine_id);
      v_machine_names := array_append(v_machine_names, v_machine.name);
      v_machine_energy := array_append(v_machine_energy, greatest(v_machine.hourly_energy_consumption_kwh, 0));
      v_machine_prices := array_append(v_machine_prices, greatest(v_machine.price, 0));
      v_machine_price_currencies := array_append(v_machine_price_currencies, coalesce(v_machine.price_currency, 'TRY'));
      v_machine_availability_hours := array_append(v_machine_availability_hours, greatest(0, coalesce(nullif(v_entry->>'dailyHours', '')::numeric, v_machine.availability_hours, 8)));
      v_machine_available_at := array_append(v_machine_available_at, 0);
      v_machine_busy_minutes := array_append(v_machine_busy_minutes, 0);
    else
      v_machine_availability_hours[v_machine_index] := greatest(
        v_machine_availability_hours[v_machine_index],
        greatest(0, coalesce(nullif(v_entry->>'dailyHours', '')::numeric, v_machine.availability_hours, 8))
      );
    end if;

    v_operation_ids := array_append(v_operation_ids, coalesce(nullif(v_entry->>'operationId', ''), 'operation-' || v_operation_count::text));
    v_operation_names := array_append(v_operation_names, coalesce(nullif(trim(v_entry->>'operationName'), ''), 'Operation ' || v_operation_count::text));
    v_operation_machine_ids := array_append(v_operation_machine_ids, v_machine_id);
    v_operation_machine_names := array_append(v_operation_machine_names, v_machine.name);
    v_operation_process_minutes := array_append(v_operation_process_minutes, greatest(0.0001, coalesce(nullif(v_entry->>'processTimeMinutes', '')::numeric, p_product_cycle_time_minutes, 1)));
    v_operation_capacities := array_append(v_operation_capacities, greatest(1, coalesce(nullif(v_entry->>'capacity', '')::numeric, v_machine.concurrent_capacity, 1)));
    v_operation_setup_minutes := array_append(v_operation_setup_minutes, greatest(0, coalesce(nullif(v_entry->>'setupMinutes', '')::numeric, 0)));
    v_operation_speed_multipliers := array_append(v_operation_speed_multipliers, greatest(0.0001, coalesce(nullif(v_entry->>'speedMultiplier', '')::numeric, v_machine.speed_multiplier, 1)));
    v_operation_availability_hours := array_append(v_operation_availability_hours, greatest(0, coalesce(nullif(v_entry->>'dailyHours', '')::numeric, v_machine.availability_hours, 8)));
    v_operation_busy_minutes := array_append(v_operation_busy_minutes, 0);
    v_operation_wait_minutes := array_append(v_operation_wait_minutes, 0);
    v_operation_start_minutes := array_append(v_operation_start_minutes, null::numeric);
    v_operation_finish_minutes := array_append(v_operation_finish_minutes, 0);
  end loop;

  if v_operation_count = 0 then
    return null;
  end if;

  v_previous_finishes := array_fill(0::numeric, array[v_group_count]);

  for v_operation_index in 1..v_operation_count loop
    v_current_finishes := array_fill(0::numeric, array[v_group_count]);
    v_machine_index := array_position(v_machine_ids, v_operation_machine_ids[v_operation_index]);

    for v_group_index in 1..v_group_count loop
      v_group_quantity := least(v_transfer_batch_size, v_target_quantity - ((v_group_index - 1) * v_transfer_batch_size));
      v_precedence_ready_minutes := case when v_operation_index = 1 then 0 else v_previous_finishes[v_group_index] end;
      v_start_minutes := greatest(v_machine_available_at[v_machine_index], v_precedence_ready_minutes);
      v_setup_minutes := case when v_group_index = 1 then v_operation_setup_minutes[v_operation_index] else 0 end;
      v_process_minutes := (ceil(v_group_quantity / v_operation_capacities[v_operation_index]) * v_operation_process_minutes[v_operation_index]) / v_operation_speed_multipliers[v_operation_index];
      v_duration_minutes := v_setup_minutes + v_process_minutes;
      v_finish_minutes := v_start_minutes + v_duration_minutes;
      v_wait_minutes := greatest(0, v_start_minutes - v_precedence_ready_minutes);

      v_machine_available_at[v_machine_index] := v_finish_minutes;
      v_machine_busy_minutes[v_machine_index] := v_machine_busy_minutes[v_machine_index] + v_duration_minutes;
      v_operation_busy_minutes[v_operation_index] := v_operation_busy_minutes[v_operation_index] + v_duration_minutes;
      v_operation_wait_minutes[v_operation_index] := v_operation_wait_minutes[v_operation_index] + v_wait_minutes;
      v_operation_start_minutes[v_operation_index] := case
        when v_operation_start_minutes[v_operation_index] is null then v_start_minutes
        else least(v_operation_start_minutes[v_operation_index], v_start_minutes)
      end;
      v_operation_finish_minutes[v_operation_index] := greatest(v_operation_finish_minutes[v_operation_index], v_finish_minutes);
      v_current_finishes[v_group_index] := v_finish_minutes;
      v_total_queue_wait_minutes := v_total_queue_wait_minutes + v_wait_minutes;
      v_total_processing_time_minutes := v_total_processing_time_minutes + v_duration_minutes;
      v_makespan_minutes := greatest(v_makespan_minutes, v_finish_minutes);

      v_operation_timing_rows := v_operation_timing_rows || jsonb_build_array(jsonb_build_object(
        'operationIndex', v_operation_index,
        'batchIndex', v_group_index,
        'quantity', v_group_quantity,
        'startMinutes', v_start_minutes,
        'finishMinutes', v_finish_minutes,
        'durationMinutes', v_duration_minutes,
        'waitMinutes', v_wait_minutes
      ));

      if v_event_count < 80 then
        v_event_sample := v_event_sample || jsonb_build_array(
          jsonb_build_object('event', 'start', 'operationName', v_operation_names[v_operation_index], 'batchIndex', v_group_index, 'quantity', v_group_quantity, 'timeMinutes', v_start_minutes),
          jsonb_build_object('event', 'finish', 'operationName', v_operation_names[v_operation_index], 'batchIndex', v_group_index, 'quantity', v_group_quantity, 'timeMinutes', v_finish_minutes)
        );
        v_event_count := v_event_count + 2;
      end if;
    end loop;

    v_previous_finishes := v_current_finishes;
  end loop;

  for v_operation_index in 1..greatest(v_operation_count - 1, 0) loop
    v_buffer_events := '[]'::jsonb;
    v_waiting_unit_minutes := 0;

    for v_group_index in 1..v_group_count loop
      select
        coalesce(nullif(t.value->>'finishMinutes', '')::numeric, 0),
        coalesce(nullif(t.value->>'quantity', '')::numeric, 0)
      into v_from_finish_minutes, v_group_quantity
      from jsonb_array_elements(v_operation_timing_rows) as t(value)
      where coalesce(nullif(t.value->>'operationIndex', '')::integer, 0) = v_operation_index
        and coalesce(nullif(t.value->>'batchIndex', '')::integer, 0) = v_group_index
      limit 1;

      select coalesce(nullif(t.value->>'startMinutes', '')::numeric, 0)
      into v_to_start_minutes
      from jsonb_array_elements(v_operation_timing_rows) as t(value)
      where coalesce(nullif(t.value->>'operationIndex', '')::integer, 0) = v_operation_index + 1
        and coalesce(nullif(t.value->>'batchIndex', '')::integer, 0) = v_group_index
      limit 1;

      v_buffer_events := v_buffer_events || jsonb_build_array(
        jsonb_build_object('timeMinutes', v_from_finish_minutes, 'delta', v_group_quantity, 'priority', 0),
        jsonb_build_object('timeMinutes', v_to_start_minutes, 'delta', -v_group_quantity, 'priority', 1)
      );
      v_waiting_unit_minutes := v_waiting_unit_minutes + (v_group_quantity * greatest(0, v_to_start_minutes - v_from_finish_minutes));
    end loop;

    v_buffer_level := 0;
    v_last_event_minutes := 0;
    v_buffer_area := 0;
    v_buffer_max_wip := 0;

    for v_event in
      select jsonb_build_object('timeMinutes', event_time_minutes, 'delta', total_delta)
      from (
        select
          coalesce(nullif(e.value->>'timeMinutes', '')::numeric, 0) as event_time_minutes,
          sum(coalesce(nullif(e.value->>'delta', '')::numeric, 0)) as total_delta
        from jsonb_array_elements(v_buffer_events) as e(value)
        group by event_time_minutes
      ) grouped_buffer_events
      order by event_time_minutes
    loop
      v_buffer_area := v_buffer_area + (greatest(0, coalesce(nullif(v_event->>'timeMinutes', '')::numeric, 0) - v_last_event_minutes) * v_buffer_level);
      v_buffer_level := greatest(0, v_buffer_level + coalesce(nullif(v_event->>'delta', '')::numeric, 0));
      v_buffer_max_wip := greatest(v_buffer_max_wip, v_buffer_level);
      v_last_event_minutes := coalesce(nullif(v_event->>'timeMinutes', '')::numeric, 0);
    end loop;

    v_total_wip_unit_minutes := v_total_wip_unit_minutes + v_buffer_area;
    v_max_wip_quantity := greatest(v_max_wip_quantity, v_buffer_max_wip);
    v_buffer_summary := v_buffer_summary || jsonb_build_array(jsonb_build_object(
      'fromOperationName', v_operation_names[v_operation_index],
      'toOperationName', v_operation_names[v_operation_index + 1],
      'maxWip', v_buffer_max_wip,
      'averageWip', case when v_makespan_minutes > 0 then v_buffer_area / v_makespan_minutes else 0 end,
      'waitingUnitHours', v_waiting_unit_minutes / 60,
      'bufferMaxQuantity', v_buffer_max_quantity,
      'bufferLimitBreached', case when v_buffer_max_quantity > 0 then v_buffer_max_wip > v_buffer_max_quantity else false end
    ));
  end loop;

  for v_operation_index in 1..v_operation_count loop
    if v_operation_busy_minutes[v_operation_index] > v_bottleneck_busy_minutes then
      v_bottleneck_busy_minutes := v_operation_busy_minutes[v_operation_index];
      v_bottleneck := jsonb_build_object(
        'operationName', v_operation_names[v_operation_index],
        'machineId', v_operation_machine_ids[v_operation_index],
        'machineName', v_operation_machine_names[v_operation_index],
        'processingTimeMinutes', v_operation_busy_minutes[v_operation_index]
      );
    end if;

    v_operation_summary := v_operation_summary || jsonb_build_array(jsonb_build_object(
      'operationId', v_operation_ids[v_operation_index],
      'operationName', v_operation_names[v_operation_index],
      'machineId', v_operation_machine_ids[v_operation_index],
      'machineName', v_operation_machine_names[v_operation_index],
      'processTimeMinutes', v_operation_process_minutes[v_operation_index],
      'capacity', v_operation_capacities[v_operation_index],
      'setupMinutes', v_operation_setup_minutes[v_operation_index],
      'speedMultiplier', v_operation_speed_multipliers[v_operation_index],
      'dailyHours', v_operation_availability_hours[v_operation_index],
      'startMinutes', coalesce(v_operation_start_minutes[v_operation_index], 0),
      'finishMinutes', v_operation_finish_minutes[v_operation_index],
      'busyMinutes', v_operation_busy_minutes[v_operation_index],
      'totalWaitMinutes', v_operation_wait_minutes[v_operation_index]
    ));
  end loop;

  if coalesce(array_length(v_machine_ids, 1), 0) > 0 then
    for v_machine_index in 1..array_length(v_machine_ids, 1) loop
      v_available_minutes := greatest(v_makespan_minutes, v_machine_availability_hours[v_machine_index] * 60);
      v_idle_hours := greatest(0, v_available_minutes - v_machine_busy_minutes[v_machine_index]) / 60;
      v_total_idle_hours := v_total_idle_hours + v_idle_hours;
      v_schedule_window_minutes := greatest(v_schedule_window_minutes, v_machine_availability_hours[v_machine_index] * 60);

      v_machine_summary := v_machine_summary || jsonb_build_array(jsonb_build_object(
        'machineId', v_machine_ids[v_machine_index],
        'name', v_machine_names[v_machine_index],
        'dailyHours', v_machine_busy_minutes[v_machine_index] / 60,
        'availabilityHours', v_machine_availability_hours[v_machine_index],
        'idleHours', v_idle_hours,
        'utilizationPercent', case when v_available_minutes > 0 then (v_machine_busy_minutes[v_machine_index] / v_available_minutes) * 100 else 0 end,
        'hourlyEnergyConsumptionKwh', v_machine_energy[v_machine_index],
        'energyConsumptionKwh', (v_machine_busy_minutes[v_machine_index] / 60) * v_machine_energy[v_machine_index],
        'price', v_machine_prices[v_machine_index],
        'priceCurrency', v_machine_price_currencies[v_machine_index]
      ));
    end loop;
  end if;

  v_waiting_cost := (v_total_queue_wait_minutes / 60) * v_waiting_cost_per_hour;
  v_inventory_cost := (v_total_wip_unit_minutes / 60) * v_inventory_cost_per_unit_hour;
  v_delay_minutes := greatest(0, v_makespan_minutes - v_schedule_window_minutes);
  v_delay_cost := (v_delay_minutes / 60) * v_delay_cost_per_hour;
  v_capacity_loss_cost := v_total_idle_hours * v_capacity_loss_cost_per_hour;

  return jsonb_build_object(
    'targetQuantity', v_target_quantity,
    'flowStrategy', v_strategy,
    'batchSize', v_batch_size,
    'minimumTransferQuantity', v_min_transfer_quantity,
    'transferBatchSize', v_transfer_batch_size,
    'batchCount', v_group_count,
    'producedQuantity', v_target_quantity,
    'totalProductionTimeMinutes', v_makespan_minutes,
    'totalProcessingTimeMinutes', v_total_processing_time_minutes,
    'effectiveCycleTimeMinutes', case when v_target_quantity > 0 then v_makespan_minutes / v_target_quantity else 0 end,
    'waitingTimeHours', v_total_queue_wait_minutes / 60,
    'wipUnitHours', v_total_wip_unit_minutes / 60,
    'maxWipQuantity', v_max_wip_quantity,
    'recommendedBufferQuantity', v_max_wip_quantity,
    'totalIdleTimeHours', v_total_idle_hours,
    'delayMinutes', v_delay_minutes,
    'waitingCost', v_waiting_cost,
    'inventoryCost', v_inventory_cost,
    'delayCost', v_delay_cost,
    'capacityLossCost', v_capacity_loss_cost,
    'objectiveScore', v_makespan_minutes + v_waiting_cost + v_inventory_cost + v_delay_cost + v_capacity_loss_cost,
    'bottleneck', v_bottleneck,
    'operationRows', v_operation_summary,
    'machineRows', v_machine_summary,
    'bufferRows', v_buffer_summary,
    'eventSample', v_event_sample,
    'optimization', jsonb_build_object(
      'recommendedBatchSize', v_transfer_batch_size,
      'totalProductionTimeMinutes', v_makespan_minutes,
      'waitingCost', v_waiting_cost,
      'inventoryCost', v_inventory_cost,
      'objectiveScore', v_makespan_minutes + v_waiting_cost + v_inventory_cost + v_delay_cost + v_capacity_loss_cost
    )
  );
end;
$$;

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
  v_operation_rows jsonb := case when jsonb_typeof(p_input->'operationRows') = 'array' then p_input->'operationRows' else '[]'::jsonb end;
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
  v_flow_cost numeric := 0;
  v_product_unit text := 'adet';
  v_product_price numeric := 0;
  v_product_cycle_time_minutes numeric := 1;
  v_product_material_count integer := 0;
  v_primary_machine_daily_hours numeric := 0;
  v_produced_quantity numeric := 0;
  v_total_tracked_daily_cost numeric := 0;
  v_flow_result jsonb := null;
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
  v_flow_result := public.calculate_operation_flow_schedule(v_company_id, p_input, v_product_cycle_time_minutes);

  if v_flow_result is not null then
    v_machine_summary := coalesce(v_flow_result->'machineRows', '[]'::jsonb);
    v_machine_hours_used := 0;
    v_primary_machine_daily_hours := 0;
    v_energy_consumption_kwh := 0;
    v_selected_machine_value := 0;

    for v_entry in select value from jsonb_array_elements(v_machine_summary) loop
      v_daily_hours := greatest(0, coalesce(nullif(v_entry->>'dailyHours', '')::numeric, 0));
      v_machine_hours_used := v_machine_hours_used + v_daily_hours;
      v_primary_machine_daily_hours := greatest(v_primary_machine_daily_hours, v_daily_hours);
      v_energy_consumption_kwh := v_energy_consumption_kwh + greatest(0, coalesce(nullif(v_entry->>'energyConsumptionKwh', '')::numeric, 0));
      v_selected_machine_value := v_selected_machine_value + greatest(0, coalesce(nullif(v_entry->>'price', '')::numeric, 0));
    end loop;

    v_produced_quantity := greatest(0, coalesce(nullif(v_flow_result->>'producedQuantity', '')::numeric, 0));
  else
    v_produced_quantity := (v_primary_machine_daily_hours * 60) / v_product_cycle_time_minutes;
  end if;

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

  if v_flow_result is not null then
    v_flow_cost :=
      greatest(0, coalesce(nullif(v_flow_result->>'waitingCost', '')::numeric, 0)) +
      greatest(0, coalesce(nullif(v_flow_result->>'inventoryCost', '')::numeric, 0)) +
      greatest(0, coalesce(nullif(v_flow_result->>'delayCost', '')::numeric, 0)) +
      greatest(0, coalesce(nullif(v_flow_result->>'capacityLossCost', '')::numeric, 0));
  end if;

  v_total_tracked_daily_cost := v_material_cost + v_workforce_cost + v_flow_cost;

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
  ) || coalesce(v_flow_result, '{}'::jsonb);

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
