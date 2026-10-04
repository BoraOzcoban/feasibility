-- Adds explicit cycle-time units for existing operation products.
-- Run this only if the base schema was applied before cycle_time_unit existed.

alter table public.operation_products
  add column if not exists cycle_time_unit text not null default 'minute';

update public.operation_products
set cycle_time_unit = 'minute'
where cycle_time_unit is null
   or cycle_time_unit not in ('minute', 'hour', 'day');

select pg_notify('pgrst', 'reload schema');
