-- Record deletion for operations data and optional expenses.
--
-- Until now nothing could be deleted: a wrong material, machine or product
-- stayed forever, and saving under the same name overwrote the old record.
--
-- Materials, machines and workforce that a recipe, a process step or a saved
-- plan still uses are refused with message 'record_in_use' and a JSON detail
-- of what uses them, so the app can say what to change first. Deleting a
-- product also deletes its recipe, process steps, notes and saved plans
-- (existing ON DELETE CASCADE); sales channels keep their row without a product.

create or replace function public.delete_operation_record(p_entity text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := public.current_profile_company_id();
  v_recipes integer := 0;
  v_processes integer := 0;
  v_plans integer := 0;
begin
  if v_company_id is null then
    raise exception 'Current profile is not connected to a company.';
  end if;

  if not public.has_module_permission('operations', 'write') then
    raise exception 'Operations write permission is required.';
  end if;

  if p_entity = 'material' then
    select count(*) into v_recipes from public.operation_product_materials where material_id = p_id;
    select count(*) into v_plans from public.operation_plan_materials where material_id = p_id;
  elsif p_entity = 'machine' then
    select count(*) into v_processes from public.operation_product_processes where machine_id = p_id;
    select count(*) into v_plans from public.operation_plan_machines where machine_id = p_id;
  elsif p_entity = 'workforce' then
    select count(*) into v_plans from public.operation_plan_workforce where workforce_id = p_id;
  elsif p_entity not in ('equipment', 'product') then
    raise exception 'Unknown record type: %', p_entity;
  end if;

  if v_recipes + v_processes + v_plans > 0 then
    raise exception using
      message = 'record_in_use',
      detail = json_build_object('recipes', v_recipes, 'processes', v_processes, 'plans', v_plans)::text;
  end if;

  if p_entity = 'material' then
    delete from public.operation_materials where id = p_id and company_id = v_company_id;
  elsif p_entity = 'machine' then
    delete from public.operation_machines where id = p_id and company_id = v_company_id;
  elsif p_entity = 'workforce' then
    delete from public.operation_workforce_resources where id = p_id and company_id = v_company_id;
  elsif p_entity = 'equipment' then
    delete from public.operation_equipment where id = p_id and company_id = v_company_id;
  else
    delete from public.operation_products where id = p_id and company_id = v_company_id;
  end if;

  if not found then
    raise exception 'Record not found.';
  end if;
end;
$$;

grant execute on function public.delete_operation_record(text, uuid) to authenticated;

create or replace function public.delete_financial_extra_cost(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := public.current_profile_company_id();
begin
  if v_company_id is null then
    raise exception 'Current profile is not connected to a company.';
  end if;

  if not public.has_module_permission('financial-modelling', 'write') then
    raise exception 'Financial modelling write permission is required.';
  end if;

  delete from public.financial_extra_costs where id = p_id and company_id = v_company_id;

  if not found then
    raise exception 'Record not found.';
  end if;
end;
$$;

grant execute on function public.delete_financial_extra_cost(uuid) to authenticated;
