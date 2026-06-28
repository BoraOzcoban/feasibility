-- Startup feasibility seed for the functional cold-chain beverage scenario.
-- Run after schema.sql and the patch files. Re-running is safe for the records
-- owned by this scenario. It seeds each company with one coherent test case.

insert into public.companies (name)
select 'Atera Startup Test'
where not exists (select 1 from public.companies);

select public.ensure_company_defaults(id) from public.companies;

insert into public.sales_channel_types (
  id, name_en, name_tr, average_customer_acquisition_rate, average_conversion_rate,
  average_commission_percent, average_duration_days, description_en, description_tr, sort_order
) values
  ('direct', 'Direct sales', 'Direkt satış', 18, 12, 0, 0, 'Direct sales owned by the company.', 'Şirketin doğrudan yönettiği satış.', 10),
  ('online', 'Online', 'Online', 8, 4, 8, 0, 'Digital storefront or online flow.', 'Dijital mağaza veya online akış.', 20),
  ('retail', 'Retail', 'Perakende', 5, 3, 20, 0, 'Retail shelf or store channel.', 'Perakende raf veya mağaza kanalı.', 30)
on conflict (id) do update set
  name_en = excluded.name_en,
  name_tr = excluded.name_tr,
  average_customer_acquisition_rate = excluded.average_customer_acquisition_rate,
  average_conversion_rate = excluded.average_conversion_rate,
  average_commission_percent = excluded.average_commission_percent,
  average_duration_days = excluded.average_duration_days,
  description_en = excluded.description_en,
  description_tr = excluded.description_tr,
  sort_order = excluded.sort_order;

insert into public.sales_campaign_types (
  id, name_en, name_tr, average_customer_acquisition_rate, average_conversion_rate,
  average_commission_percent, average_duration_days, description_en, description_tr, sort_order
) values
  ('digital', 'Digital advertising', 'Dijital reklam', 6, 3, 0, 30, 'Paid digital acquisition campaign.', 'Ücretli dijital müşteri kazanım kampanyası.', 10),
  ('trade', 'Trade promotion', 'Ticari promosyon', 4, 5, 0, 30, 'Trade promotion for partners.', 'Ticari iş ortakları için promosyon.', 40),
  ('event', 'Event / fair', 'Etkinlik / fuar', 3, 6, 0, 7, 'Event, fair, or field activation.', 'Etkinlik, fuar veya saha aktivasyonu.', 50)
on conflict (id) do update set
  name_en = excluded.name_en,
  name_tr = excluded.name_tr,
  average_customer_acquisition_rate = excluded.average_customer_acquisition_rate,
  average_conversion_rate = excluded.average_conversion_rate,
  average_commission_percent = excluded.average_commission_percent,
  average_duration_days = excluded.average_duration_days,
  description_en = excluded.description_en,
  description_tr = excluded.description_tr,
  sort_order = excluded.sort_order;

do $$
declare
  v_box_id uuid;
  v_cap_label_id uuid;
  v_chiller_id uuid;
  v_cold_pack_id uuid;
  v_company record;
  v_concentrate_id uuid;
  v_filler_id uuid;
  v_flavor_id uuid;
  v_mixer_id uuid;
  v_operator_id uuid;
  v_plan_id uuid;
  v_product_id uuid;
  v_qc_id uuid;
  v_shipper_material_id uuid;
  v_shipper_role_id uuid;
  v_water_id uuid;
begin
  for v_company in select id from public.companies loop
    perform public.ensure_company_defaults(v_company.id);

    insert into public.operation_materials (company_id, name, unit, price_per_unit, price_currency)
    values (v_company.id, 'Startup Arıtılmış Su', 'lt', 1.20, 'TRY')
    on conflict (company_id, name) do update set
      unit = excluded.unit,
      price_per_unit = excluded.price_per_unit,
      price_currency = excluded.price_currency
    returning id into v_water_id;

    insert into public.operation_materials (company_id, name, unit, price_per_unit, price_currency)
    values (v_company.id, 'Startup Fonksiyonel Konsantre', 'kg', 160.00, 'TRY')
    on conflict (company_id, name) do update set
      unit = excluded.unit,
      price_per_unit = excluded.price_per_unit,
      price_currency = excluded.price_currency
    returning id into v_concentrate_id;

    insert into public.operation_materials (company_id, name, unit, price_per_unit, price_currency)
    values (v_company.id, 'Startup Doğal Aroma ve Asitlik Düzenleyici', 'kg', 58.00, 'TRY')
    on conflict (company_id, name) do update set
      unit = excluded.unit,
      price_per_unit = excluded.price_per_unit,
      price_currency = excluded.price_currency
    returning id into v_flavor_id;

    insert into public.operation_materials (company_id, name, unit, price_per_unit, price_currency)
    values (v_company.id, 'Startup Şişe 250 ml', 'adet', 4.80, 'TRY')
    on conflict (company_id, name) do update set
      unit = excluded.unit,
      price_per_unit = excluded.price_per_unit,
      price_currency = excluded.price_currency
    returning id into v_box_id;

    insert into public.operation_materials (company_id, name, unit, price_per_unit, price_currency)
    values (v_company.id, 'Startup Kapak ve Etiket', 'adet', 1.30, 'TRY')
    on conflict (company_id, name) do update set
      unit = excluded.unit,
      price_per_unit = excluded.price_per_unit,
      price_currency = excluded.price_currency
    returning id into v_cap_label_id;

    insert into public.operation_materials (company_id, name, unit, price_per_unit, price_currency)
    values (v_company.id, 'Startup Soğuk Zincir Koli', 'adet', 20.00, 'TRY')
    on conflict (company_id, name) do update set
      unit = excluded.unit,
      price_per_unit = excluded.price_per_unit,
      price_currency = excluded.price_currency
    returning id into v_shipper_material_id;

    insert into public.operation_products (
      company_id, product_code, name, product_group, revision, status, unit, price,
      price_currency, cycle_time_minutes, cycle_time_unit, default_flow_strategy,
      default_batch_size, minimum_transfer_quantity, description, quality_grade,
      weight_kg, dimensions, material_name, cycle_time_seconds, labor_minutes_per_unit,
      material_kg_per_unit, scrap_rate
    )
    values (
      v_company.id, 'STARTUP-FUNCTIONAL-COLD-250', 'Fonksiyonel Soğuk Zincir İçecek 250 ml',
      'Soğuk Zincir İçecek', 'A', 'Aktif', 'adet', 75.00, 'TRY', 1.25,
      'minute', 'flow', 24, 12, 'Startup fizibilite testi için kanal fiyatlı fonksiyonel içecek.', 'A',
      0.28, '55x55x145 mm', 'Su, fonksiyonel konsantre, aroma, şişe', 75, 0.18, 0.25, 2.0
    )
    on conflict (company_id, product_code) do update set
      name = excluded.name,
      product_group = excluded.product_group,
      revision = excluded.revision,
      status = excluded.status,
      unit = excluded.unit,
      price = excluded.price,
      price_currency = excluded.price_currency,
      cycle_time_minutes = excluded.cycle_time_minutes,
      cycle_time_unit = excluded.cycle_time_unit,
      default_flow_strategy = excluded.default_flow_strategy,
      default_batch_size = excluded.default_batch_size,
      minimum_transfer_quantity = excluded.minimum_transfer_quantity,
      description = excluded.description,
      quality_grade = excluded.quality_grade,
      weight_kg = excluded.weight_kg,
      dimensions = excluded.dimensions,
      material_name = excluded.material_name,
      cycle_time_seconds = excluded.cycle_time_seconds,
      labor_minutes_per_unit = excluded.labor_minutes_per_unit,
      material_kg_per_unit = excluded.material_kg_per_unit,
      scrap_rate = excluded.scrap_rate
    returning id into v_product_id;

    insert into public.operation_product_materials (product_id, material_id, quantity_per_unit)
    values
      (v_product_id, v_water_id, 0.2000),
      (v_product_id, v_concentrate_id, 0.0250),
      (v_product_id, v_flavor_id, 0.0120),
      (v_product_id, v_box_id, 1.0000),
      (v_product_id, v_cap_label_id, 1.0000),
      (v_product_id, v_shipper_material_id, 0.0417)
    on conflict (product_id, material_id) do update set
      quantity_per_unit = excluded.quantity_per_unit;

    insert into public.operation_machines (
      company_id, name, price, price_currency, hourly_energy_consumption_kwh,
      concurrent_capacity, availability_hours, speed_multiplier, failure_probability_percent
    )
    values (v_company.id, 'Startup Karıştırma Tankı', 380000, 'TRY', 8.0, 1, 8, 1.00, 1.0)
    on conflict (company_id, name) do update set
      price = excluded.price,
      price_currency = excluded.price_currency,
      hourly_energy_consumption_kwh = excluded.hourly_energy_consumption_kwh,
      concurrent_capacity = excluded.concurrent_capacity,
      availability_hours = excluded.availability_hours,
      speed_multiplier = excluded.speed_multiplier,
      failure_probability_percent = excluded.failure_probability_percent
    returning id into v_mixer_id;

    insert into public.operation_machines (
      company_id, name, price, price_currency, hourly_energy_consumption_kwh,
      concurrent_capacity, availability_hours, speed_multiplier, failure_probability_percent
    )
    values (v_company.id, 'Startup Pastörizasyon ve Soğutma', 690000, 'TRY', 14.0, 1, 8, 1.00, 1.5)
    on conflict (company_id, name) do update set
      price = excluded.price,
      price_currency = excluded.price_currency,
      hourly_energy_consumption_kwh = excluded.hourly_energy_consumption_kwh,
      concurrent_capacity = excluded.concurrent_capacity,
      availability_hours = excluded.availability_hours,
      speed_multiplier = excluded.speed_multiplier,
      failure_probability_percent = excluded.failure_probability_percent
    returning id into v_chiller_id;

    insert into public.operation_machines (
      company_id, name, price, price_currency, hourly_energy_consumption_kwh,
      concurrent_capacity, availability_hours, speed_multiplier, failure_probability_percent
    )
    values (v_company.id, 'Startup Dolum ve Kapaklama Hattı', 980000, 'TRY', 18.0, 1, 8, 1.00, 2.5)
    on conflict (company_id, name) do update set
      price = excluded.price,
      price_currency = excluded.price_currency,
      hourly_energy_consumption_kwh = excluded.hourly_energy_consumption_kwh,
      concurrent_capacity = excluded.concurrent_capacity,
      availability_hours = excluded.availability_hours,
      speed_multiplier = excluded.speed_multiplier,
      failure_probability_percent = excluded.failure_probability_percent
    returning id into v_filler_id;

    insert into public.operation_machines (
      company_id, name, price, price_currency, hourly_energy_consumption_kwh,
      concurrent_capacity, availability_hours, speed_multiplier, failure_probability_percent
    )
    values (v_company.id, 'Startup Soğuk Paketleme İstasyonu', 260000, 'TRY', 5.0, 1, 8, 1.00, 1.0)
    on conflict (company_id, name) do update set
      price = excluded.price,
      price_currency = excluded.price_currency,
      hourly_energy_consumption_kwh = excluded.hourly_energy_consumption_kwh,
      concurrent_capacity = excluded.concurrent_capacity,
      availability_hours = excluded.availability_hours,
      speed_multiplier = excluded.speed_multiplier,
      failure_probability_percent = excluded.failure_probability_percent
    returning id into v_cold_pack_id;

    insert into public.operation_equipment (company_id, name, price, price_currency, quantity)
    values
      (v_company.id, 'Startup Soğuk Oda ve Raf Sistemi', 420000, 'TRY', 1),
      (v_company.id, 'Startup Kalite Kontrol Ekipmanı', 95000, 'TRY', 1),
      (v_company.id, 'Startup El Terminali ve Depo Ekipmanı', 65000, 'TRY', 1)
    on conflict (company_id, name) do update set
      price = excluded.price,
      price_currency = excluded.price_currency,
      quantity = excluded.quantity;

    insert into public.operation_workforce_resources (company_id, role_name, hourly_cost, hourly_cost_currency)
    values (v_company.id, 'Startup Üretim Operatörü', 240, 'TRY')
    on conflict (company_id, role_name) do update set
      hourly_cost = excluded.hourly_cost,
      hourly_cost_currency = excluded.hourly_cost_currency
    returning id into v_operator_id;

    insert into public.operation_workforce_resources (company_id, role_name, hourly_cost, hourly_cost_currency)
    values (v_company.id, 'Startup Kalite Sorumlusu', 360, 'TRY')
    on conflict (company_id, role_name) do update set
      hourly_cost = excluded.hourly_cost,
      hourly_cost_currency = excluded.hourly_cost_currency
    returning id into v_qc_id;

    insert into public.operation_workforce_resources (company_id, role_name, hourly_cost, hourly_cost_currency)
    values (v_company.id, 'Startup Depo ve Sevkiyat', 220, 'TRY')
    on conflict (company_id, role_name) do update set
      hourly_cost = excluded.hourly_cost,
      hourly_cost_currency = excluded.hourly_cost_currency
    returning id into v_shipper_role_id;

    update public.operation_resource_plans
    set is_active = false
    where company_id = v_company.id
      and plan_name in (
        'Demo Flow - Çilekli Süt 1000 adet',
        'Demo Batch - Çilekli Süt 1000 adet',
        'Startup Base - Fonksiyonel İçecek 12000/ay'
      );

    delete from public.operation_resource_plans
    where company_id = v_company.id
      and plan_name = 'Startup Base - Fonksiyonel İçecek 12000/ay';

    insert into public.operation_resource_plans (
      company_id, product_id, plan_name, is_active, target_daily_output, input, result, created_at
    )
    values (
      v_company.id,
      v_product_id,
      'Startup Base - Fonksiyonel İçecek 12000/ay',
      true,
      545.455,
      jsonb_build_object(
        'planName', 'Startup Base - Fonksiyonel İçecek 12000/ay',
        'productId', v_product_id,
        'productName', 'Fonksiyonel Soğuk Zincir İçecek 250 ml',
        'targetQuantity', 545.455,
        'flowStrategy', 'flow',
        'batchSize', 24,
        'minimumTransferQuantity', 12,
        'bufferMaxQuantity', 120,
        'machineRows', jsonb_build_array(
          jsonb_build_object('machineId', v_mixer_id, 'dailyHours', 2.4),
          jsonb_build_object('machineId', v_chiller_id, 'dailyHours', 5.8),
          jsonb_build_object('machineId', v_filler_id, 'dailyHours', 5.9),
          jsonb_build_object('machineId', v_cold_pack_id, 'dailyHours', 2.2)
        ),
        'operationRows', jsonb_build_array(
          jsonb_build_object('operationId', 'startup-mix', 'operationName', 'Karıştırma', 'machineId', v_mixer_id, 'processTimeMinutes', 0.35, 'capacity', 1, 'setupMinutes', 20, 'speedMultiplier', 1, 'dailyHours', 2.4),
          jsonb_build_object('operationId', 'startup-cool', 'operationName', 'Pastörizasyon ve soğutma', 'machineId', v_chiller_id, 'processTimeMinutes', 0.52, 'capacity', 1, 'setupMinutes', 30, 'speedMultiplier', 1, 'dailyHours', 5.8),
          jsonb_build_object('operationId', 'startup-fill', 'operationName', 'Dolum ve kapaklama', 'machineId', v_filler_id, 'processTimeMinutes', 0.65, 'capacity', 1, 'setupMinutes', 25, 'speedMultiplier', 1, 'dailyHours', 5.9),
          jsonb_build_object('operationId', 'startup-pack', 'operationName', 'Soğuk paketleme', 'machineId', v_cold_pack_id, 'processTimeMinutes', 0.22, 'capacity', 1, 'setupMinutes', 10, 'speedMultiplier', 1, 'dailyHours', 2.2)
        ),
        'workforceRows', jsonb_build_array(
          jsonb_build_object('workforceId', v_operator_id, 'peopleAssigned', 2, 'dailyHours', 7.5),
          jsonb_build_object('workforceId', v_qc_id, 'peopleAssigned', 1, 'dailyHours', 4),
          jsonb_build_object('workforceId', v_shipper_role_id, 'peopleAssigned', 1, 'dailyHours', 4)
        )
      ),
      jsonb_build_object(
        'planName', 'Startup Base - Fonksiyonel İçecek 12000/ay',
        'productName', 'Fonksiyonel Soğuk Zincir İçecek 250 ml',
        'productPrice', 75.00,
        'productPriceCurrency', 'TRY',
        'productUnit', 'adet',
        'producedQuantity', 545.455,
        'totalProductionTimeMinutes', 430,
        'transferBatchSize', 24,
        'flowStrategy', 'flow',
        'cycleTimeMinutes', 1.25,
        'effectiveCycleTimeMinutes', 0.7883,
        'bottleneck', jsonb_build_object('operationName', 'Dolum ve kapaklama', 'machineId', v_filler_id, 'machineName', 'Startup Dolum ve Kapaklama Hattı', 'processingTimeMinutes', 354),
        'maxWipQuantity', 96,
        'energyConsumptionKwh', 217.6,
        'materialCost', 6474.46,
        'workforceCost', 5920,
        'machineHoursUsed', 16.3,
        'workforceHoursUsed', 23,
        'selectedMachineValue', 2310000,
        'totalIdleTimeHours', 7.8,
        'waitingCost', 240,
        'inventoryCost', 180,
        'delayCost', 0,
        'capacityLossCost', 120,
        'totalTrackedDailyCost', 12934.46,
        'primaryMachineDailyHours', 5.9,
        'machineRows', jsonb_build_array(
          jsonb_build_object('machineId', v_mixer_id, 'name', 'Startup Karıştırma Tankı', 'dailyHours', 2.4, 'energyConsumptionKwh', 19.2, 'price', 380000, 'priceCurrency', 'TRY', 'utilizationPercent', 30.0),
          jsonb_build_object('machineId', v_chiller_id, 'name', 'Startup Pastörizasyon ve Soğutma', 'dailyHours', 5.8, 'energyConsumptionKwh', 81.2, 'price', 690000, 'priceCurrency', 'TRY', 'utilizationPercent', 72.5),
          jsonb_build_object('machineId', v_filler_id, 'name', 'Startup Dolum ve Kapaklama Hattı', 'dailyHours', 5.9, 'energyConsumptionKwh', 106.2, 'price', 980000, 'priceCurrency', 'TRY', 'utilizationPercent', 73.8),
          jsonb_build_object('machineId', v_cold_pack_id, 'name', 'Startup Soğuk Paketleme İstasyonu', 'dailyHours', 2.2, 'energyConsumptionKwh', 11.0, 'price', 260000, 'priceCurrency', 'TRY', 'utilizationPercent', 27.5)
        ),
        'workforceRows', jsonb_build_array(
          jsonb_build_object('workforceId', v_operator_id, 'roleName', 'Startup Üretim Operatörü', 'peopleAssigned', 2, 'dailyHours', 7.5, 'hoursUsed', 15, 'hourlyCost', 240, 'hourlyCostCurrency', 'TRY', 'cost', 3600),
          jsonb_build_object('workforceId', v_qc_id, 'roleName', 'Startup Kalite Sorumlusu', 'peopleAssigned', 1, 'dailyHours', 4, 'hoursUsed', 4, 'hourlyCost', 360, 'hourlyCostCurrency', 'TRY', 'cost', 1440),
          jsonb_build_object('workforceId', v_shipper_role_id, 'roleName', 'Startup Depo ve Sevkiyat', 'peopleAssigned', 1, 'dailyHours', 4, 'hoursUsed', 4, 'hourlyCost', 220, 'hourlyCostCurrency', 'TRY', 'cost', 880)
        ),
        'materialRows', jsonb_build_array(
          jsonb_build_object('materialId', v_water_id, 'name', 'Startup Arıtılmış Su', 'unit', 'lt', 'quantityPerUnit', 0.2000, 'producedQuantity', 545.455, 'dailyQuantity', 109.091, 'pricePerUnit', 1.20, 'priceCurrency', 'TRY', 'cost', 130.91),
          jsonb_build_object('materialId', v_concentrate_id, 'name', 'Startup Fonksiyonel Konsantre', 'unit', 'kg', 'quantityPerUnit', 0.0250, 'producedQuantity', 545.455, 'dailyQuantity', 13.636, 'pricePerUnit', 160.00, 'priceCurrency', 'TRY', 'cost', 2181.76),
          jsonb_build_object('materialId', v_flavor_id, 'name', 'Startup Doğal Aroma ve Asitlik Düzenleyici', 'unit', 'kg', 'quantityPerUnit', 0.0120, 'producedQuantity', 545.455, 'dailyQuantity', 6.545, 'pricePerUnit', 58.00, 'priceCurrency', 'TRY', 'cost', 379.61),
          jsonb_build_object('materialId', v_box_id, 'name', 'Startup Şişe 250 ml', 'unit', 'adet', 'quantityPerUnit', 1.0000, 'producedQuantity', 545.455, 'dailyQuantity', 545.455, 'pricePerUnit', 4.80, 'priceCurrency', 'TRY', 'cost', 2618.18),
          jsonb_build_object('materialId', v_cap_label_id, 'name', 'Startup Kapak ve Etiket', 'unit', 'adet', 'quantityPerUnit', 1.0000, 'producedQuantity', 545.455, 'dailyQuantity', 545.455, 'pricePerUnit', 1.30, 'priceCurrency', 'TRY', 'cost', 709.09),
          jsonb_build_object('materialId', v_shipper_material_id, 'name', 'Startup Soğuk Zincir Koli', 'unit', 'adet', 'quantityPerUnit', 0.0417, 'producedQuantity', 545.455, 'dailyQuantity', 22.745, 'pricePerUnit', 20.00, 'priceCurrency', 'TRY', 'cost', 454.91)
        )
      ),
      now()
    )
    returning id into v_plan_id;

    insert into public.operation_plan_machines (plan_id, machine_id, daily_hours)
    values
      (v_plan_id, v_mixer_id, 2.4),
      (v_plan_id, v_chiller_id, 5.8),
      (v_plan_id, v_filler_id, 5.9),
      (v_plan_id, v_cold_pack_id, 2.2);

    insert into public.operation_plan_workforce (plan_id, workforce_id, people_assigned, daily_hours)
    values
      (v_plan_id, v_operator_id, 2, 7.5),
      (v_plan_id, v_qc_id, 1, 4),
      (v_plan_id, v_shipper_role_id, 1, 4);

    insert into public.operation_plan_materials (plan_id, material_id, daily_quantity)
    values
      (v_plan_id, v_water_id, 109.091),
      (v_plan_id, v_concentrate_id, 13.636),
      (v_plan_id, v_flavor_id, 6.545),
      (v_plan_id, v_box_id, 545.455),
      (v_plan_id, v_cap_label_id, 545.455),
      (v_plan_id, v_shipper_material_id, 22.745);

    insert into public.financial_model_settings (
      company_id, electricity_price_per_kwh, working_days_per_month, initial_cash,
      investment_grant_amount, loan_amount, loan_rows, annual_interest_rate,
      loan_term_months, vat_rate, sales_vat_rate, expense_vat_rate, income_tax_rate,
      tax_payment_delay_months, receivables_collection_days, raw_material_stock_days,
      supplier_payment_days, initial_capacity_units, monthly_currency_increase_percent,
      monthly_inflation_percent, monthly_energy_price_increase_percent,
      monthly_wage_increase_percent, cogs_inflation_annual_percent,
      opex_inflation_annual_percent, price_increase_annual_percent,
      asset_value_increase_annual_percent, increase_frequency, raw_material_buffer_months,
      salary_buffer_months, rent_buffer_months
    )
    values (
      v_company.id, 4.75, 22, 2500000, 500000, 1500000,
      jsonb_build_array(
        jsonb_build_object('id', 'startup-36m-loan', 'name', 'Startup 36 Ay İşletme ve Kapasite Kredisi', 'amount', 1500000, 'currency', 'TRY', 'annualInterestRate', 38, 'gracePeriodMonths', 3, 'loanTermMonths', 36, 'receivedDate', current_date)
      ),
      38, 36, 10, 10, 20, 25, 3, 35, 15, 45, 12000, 1.5, 2.5, 2.0, 2.0, 35, 30, 30, 20, 'quarterly', 1, 1, 1
    )
    on conflict (company_id) do update set
      electricity_price_per_kwh = excluded.electricity_price_per_kwh,
      working_days_per_month = excluded.working_days_per_month,
      initial_cash = excluded.initial_cash,
      investment_grant_amount = excluded.investment_grant_amount,
      loan_amount = excluded.loan_amount,
      loan_rows = excluded.loan_rows,
      annual_interest_rate = excluded.annual_interest_rate,
      loan_term_months = excluded.loan_term_months,
      vat_rate = excluded.vat_rate,
      sales_vat_rate = excluded.sales_vat_rate,
      expense_vat_rate = excluded.expense_vat_rate,
      income_tax_rate = excluded.income_tax_rate,
      tax_payment_delay_months = excluded.tax_payment_delay_months,
      receivables_collection_days = excluded.receivables_collection_days,
      raw_material_stock_days = excluded.raw_material_stock_days,
      supplier_payment_days = excluded.supplier_payment_days,
      initial_capacity_units = excluded.initial_capacity_units,
      monthly_currency_increase_percent = excluded.monthly_currency_increase_percent,
      monthly_inflation_percent = excluded.monthly_inflation_percent,
      monthly_energy_price_increase_percent = excluded.monthly_energy_price_increase_percent,
      monthly_wage_increase_percent = excluded.monthly_wage_increase_percent,
      cogs_inflation_annual_percent = excluded.cogs_inflation_annual_percent,
      opex_inflation_annual_percent = excluded.opex_inflation_annual_percent,
      price_increase_annual_percent = excluded.price_increase_annual_percent,
      asset_value_increase_annual_percent = excluded.asset_value_increase_annual_percent,
      increase_frequency = excluded.increase_frequency,
      raw_material_buffer_months = excluded.raw_material_buffer_months,
      salary_buffer_months = excluded.salary_buffer_months,
      rent_buffer_months = excluded.rent_buffer_months;

    delete from public.financial_loans
    where company_id = v_company.id
      and id in (
        'startup-36m-loan',
        'demo-equipment-loan',
        'demo-working-capital',
        'dummy-working-capital-loan',
        'dummy-usd-equipment-loan',
        'dummy-eur-short-term-loan'
      );

    insert into public.financial_loans (
      id, company_id, name, amount, currency, annual_interest_rate,
      grace_period_months, loan_term_months, received_date
    )
    values (
      'startup-36m-loan', v_company.id, 'Startup 36 Ay İşletme ve Kapasite Kredisi',
      1500000, 'TRY', 38, 3, 36, current_date
    )
    on conflict (company_id, id) do update set
      name = excluded.name,
      amount = excluded.amount,
      currency = excluded.currency,
      annual_interest_rate = excluded.annual_interest_rate,
      grace_period_months = excluded.grace_period_months,
      loan_term_months = excluded.loan_term_months,
      received_date = excluded.received_date;

    delete from public.financial_extra_costs
    where company_id = v_company.id
      and name in (
        'Startup Dijital Lansman Kampanyası',
        'Startup Kafe Tadım Aktivasyonu',
        'Startup Market Raf Aktivasyonu',
        'Demo Soğuk Zincir Kirası',
        'Demo Marka Lansman Bütçesi',
        'Demo ERP / Yazılım Aboneliği',
        'Demo Gıda Sertifikasyon Kurulumu'
      );

    insert into public.financial_extra_costs (company_id, name, cost_type, amount)
    values
      (v_company.id, 'Startup Dijital Lansman Kampanyası', 'initial', 90000),
      (v_company.id, 'Startup Kafe Tadım Aktivasyonu', 'initial', 45000),
      (v_company.id, 'Startup Market Raf Aktivasyonu', 'initial', 125000);

    insert into public.sales_strategy_settings (company_id, monthly_multipliers, multiplier_period)
    values (
      v_company.id,
      '[1,1,1,1,1,1,1,1,1,1,1,1]'::jsonb,
      'monthly'
    )
    on conflict (company_id) do update set
      monthly_multipliers = excluded.monthly_multipliers,
      multiplier_period = excluded.multiplier_period;

    delete from public.sales_channels
    where company_id = v_company.id
      and id in (
        'startup-direct-cafe',
        'startup-online',
        'startup-retail-market',
        'demo-direct-cafes',
        'demo-online-subscription',
        'demo-retail-chain'
      );

    insert into public.sales_channels (
      company_id, id, name, type_id, product_id, start_month, monthly_sales_units,
      growth_months_1_6_percent, growth_months_7_18_percent, growth_months_19_24_percent,
      growth_years_3_5_percent, collection_days, unit_sales_price, customer_acquisition_cost,
      commission_percent, basket_size, conversion_rate_percent, traffic_score,
      repeat_rate_percent, churn_rate_percent, discount_rate_percent, return_rate_percent,
      capacity_limit, launch_fee, moq_monthly, failure_probability_percent, ramp_up_months,
      seasonality_curve
    )
    values
      (v_company.id, 'startup-direct-cafe', 'Kafe / Direkt Satış', 'direct', v_product_id, 1, 2500, 8, 4, 4, 4, 30, 75, 12, 0, null, null, 1, null, null, 0, 1, 6000, null, null, 0, null, '[1,1,1,1,1,1,1,1,1,1,1,1]'::jsonb),
      (v_company.id, 'startup-online', 'Online Kanal', 'online', v_product_id, 1, 1200, 12, 6, 6, 6, 7, 85, 45, 8, null, null, 1, null, null, 0, 2, 4000, null, null, 0, null, '[1,1,1,1,1,1,1,1,1,1,1,1]'::jsonb),
      (v_company.id, 'startup-retail-market', 'Market Kanalı', 'retail', v_product_id, 3, 3000, 6, 3, 3, 3, 60, 62, 0, 18, null, null, 1, null, null, 0, 3, 10000, null, null, 0, null, '[1,1,1,1,1,1,1,1,1,1,1,1]'::jsonb)
    on conflict (company_id, id) do update set
      name = excluded.name,
      type_id = excluded.type_id,
      product_id = excluded.product_id,
      start_month = excluded.start_month,
      monthly_sales_units = excluded.monthly_sales_units,
      growth_months_1_6_percent = excluded.growth_months_1_6_percent,
      growth_months_7_18_percent = excluded.growth_months_7_18_percent,
      growth_months_19_24_percent = excluded.growth_months_19_24_percent,
      growth_years_3_5_percent = excluded.growth_years_3_5_percent,
      collection_days = excluded.collection_days,
      unit_sales_price = excluded.unit_sales_price,
      customer_acquisition_cost = excluded.customer_acquisition_cost,
      commission_percent = excluded.commission_percent,
      basket_size = excluded.basket_size,
      conversion_rate_percent = excluded.conversion_rate_percent,
      traffic_score = excluded.traffic_score,
      repeat_rate_percent = excluded.repeat_rate_percent,
      churn_rate_percent = excluded.churn_rate_percent,
      discount_rate_percent = excluded.discount_rate_percent,
      return_rate_percent = excluded.return_rate_percent,
      capacity_limit = excluded.capacity_limit,
      launch_fee = excluded.launch_fee,
      moq_monthly = excluded.moq_monthly,
      failure_probability_percent = excluded.failure_probability_percent,
      ramp_up_months = excluded.ramp_up_months,
      seasonality_curve = excluded.seasonality_curve;

    delete from public.sales_campaigns
    where company_id = v_company.id
      and id in (
        'startup-digital-launch',
        'startup-cafe-tasting',
        'startup-retail-shelf',
        'demo-launch-digital',
        'demo-retail-trade',
        'demo-crm-retention'
      );

    insert into public.sales_campaigns (
      company_id, id, name, type_id, channel, budget, duration_days, goal
    )
    values
      (v_company.id, 'startup-digital-launch', 'Dijital lansman', 'digital', 'Online Kanal', 90000, 30, 'Online talep ve lansman trafiği oluşturmak'),
      (v_company.id, 'startup-cafe-tasting', 'Kafe tadım aktivasyonu', 'event', 'Kafe / Direkt Satış', 45000, 21, 'Kafe kanalında deneme ve ilk siparişleri artırmak'),
      (v_company.id, 'startup-retail-shelf', 'Market raf aktivasyonu', 'trade', 'Market Kanalı', 125000, 45, 'Market raf görünürlüğü ve zincir içi lansmanı desteklemek')
    on conflict (company_id, id) do update set
      name = excluded.name,
      type_id = excluded.type_id,
      channel = excluded.channel,
      budget = excluded.budget,
      duration_days = excluded.duration_days,
      goal = excluded.goal;

    insert into public.simulation_variants (company_id, id, name, label, path, parameters)
    values (
      v_company.id,
      'startup-base-case',
      'Startup Base Case',
      'Startup Base Case',
      '/simulation/startup-base-case',
      jsonb_build_object(
        'salesUnits', 6700,
        'unitSalesPrice', 74,
        'productionUnits', 12000,
        'timeHorizonMonths', 18,
        'priceChange', 0,
        'demandChange', 0,
        'campaignLift', 6,
        'productionEfficiency', 4,
        'competitorPressure', 8,
        'volatility', 14,
        'costVolatility', 12,
        'fixedCost', 260000,
        'marketingBudget', 260000,
        'variableCostRatio', 33,
        'discountPercent', 0,
        'returnRatePercent', 2,
        'spoilagePercent', 2,
        'simulationAlgorithm', 'fbm_with_tendency',
        'simulationCount', 5000
      )
    )
    on conflict (company_id, id) do update set
      name = excluded.name,
      label = excluded.label,
      path = excluded.path,
      parameters = excluded.parameters;
  end loop;
end;
$$;

select pg_notify('pgrst', 'reload schema');
