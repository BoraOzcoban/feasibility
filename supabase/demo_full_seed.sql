-- Demo seed for Atera.
-- Run after schema.sql + patch files in the Supabase SQL Editor.
-- It seeds every company with a complete, form-filled scenario so the app can be tested visually.
-- Re-running is safe: demo plans/one-off demo records are replaced, master records are upserted.

insert into public.companies (name)
select 'Atera Demo'
where not exists (select 1 from public.companies);

select public.ensure_company_defaults(id) from public.companies;

insert into public.sales_channel_types (
  id, name_en, name_tr, average_customer_acquisition_rate, average_conversion_rate,
  average_commission_percent, average_duration_days, description_en, description_tr, sort_order
) values
  ('direct', 'Direct sales', 'Direkt satış', 18, 12, 0, 0, 'Direct sales owned by the company.', 'Şirketin doğrudan yönettiği satış.', 10),
  ('online', 'Online', 'Online', 8, 4, 8, 0, 'Digital storefront or online flow.', 'Dijital mağaza veya online akış.', 20),
  ('retail', 'Retail', 'Perakende', 5, 3, 20, 0, 'Retail shelf or store channel.', 'Perakende raf veya mağaza kanalı.', 30),
  ('distributor', 'Distributor', 'Distribütör', 4, 2.5, 25, 0, 'Distributor-led sales route.', 'Distribütör üzerinden satış rotası.', 40),
  ('marketplace', 'Marketplace', 'Pazaryeri', 7, 3.5, 15, 0, 'Marketplace platform channel.', 'Pazaryeri platform kanalı.', 50)
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
  ('social', 'Social media', 'Sosyal medya', 5, 2.5, 0, 21, 'Organic and paid social campaign.', 'Organik ve ücretli sosyal medya kampanyası.', 20),
  ('influencer', 'Influencer', 'Influencer', 7, 4, 0, 14, 'Creator or influencer-led campaign.', 'İçerik üretici veya influencer odaklı kampanya.', 30),
  ('trade', 'Trade promotion', 'Ticari promosyon', 4, 5, 0, 30, 'Trade promotion for partners.', 'Ticari iş ortakları için promosyon.', 40),
  ('event', 'Event / fair', 'Etkinlik / fuar', 3, 6, 0, 7, 'Event, fair, or field activation.', 'Etkinlik, fuar veya saha aktivasyonu.', 50),
  ('email', 'Email / CRM', 'E-posta / CRM', 4, 2, 0, 14, 'Email and CRM lifecycle campaign.', 'E-posta ve CRM yaşam döngüsü kampanyası.', 60)
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
  v_company record;
  v_product_id uuid;
  v_secondary_product_id uuid;
  v_milk_id uuid;
  v_strawberry_id uuid;
  v_bottle_id uuid;
  v_label_id uuid;
  v_box_id uuid;
  v_pasteurizer_id uuid;
  v_homogenizer_id uuid;
  v_filler_id uuid;
  v_packer_id uuid;
  v_operator_id uuid;
  v_packer_role_id uuid;
  v_qc_id uuid;
  v_plan_flow_id uuid;
  v_plan_batch_id uuid;
  v_flow_input jsonb;
  v_flow_result jsonb;
  v_batch_input jsonb;
  v_batch_result jsonb;
begin
  for v_company in select id from public.companies loop
    perform public.ensure_company_defaults(v_company.id);

    insert into public.operation_materials (company_id, name, unit, price_per_unit, price_currency)
    values (v_company.id, 'Demo Süt Bazı', 'lt', 21.50, 'TRY')
    on conflict (company_id, name) do update set unit = excluded.unit, price_per_unit = excluded.price_per_unit, price_currency = excluded.price_currency
    returning id into v_milk_id;

    insert into public.operation_materials (company_id, name, unit, price_per_unit, price_currency)
    values (v_company.id, 'Demo Çilek Püresi', 'kg', 86.00, 'TRY')
    on conflict (company_id, name) do update set unit = excluded.unit, price_per_unit = excluded.price_per_unit, price_currency = excluded.price_currency
    returning id into v_strawberry_id;

    insert into public.operation_materials (company_id, name, unit, price_per_unit, price_currency)
    values (v_company.id, 'Demo Şişe 250 ml', 'adet', 4.20, 'TRY')
    on conflict (company_id, name) do update set unit = excluded.unit, price_per_unit = excluded.price_per_unit, price_currency = excluded.price_currency
    returning id into v_bottle_id;

    insert into public.operation_materials (company_id, name, unit, price_per_unit, price_currency)
    values (v_company.id, 'Demo Etiket', 'adet', 0.85, 'TRY')
    on conflict (company_id, name) do update set unit = excluded.unit, price_per_unit = excluded.price_per_unit, price_currency = excluded.price_currency
    returning id into v_label_id;

    insert into public.operation_materials (company_id, name, unit, price_per_unit, price_currency)
    values (v_company.id, 'Demo Koli', 'adet', 18.00, 'TRY')
    on conflict (company_id, name) do update set unit = excluded.unit, price_per_unit = excluded.price_per_unit, price_currency = excluded.price_currency
    returning id into v_box_id;

    insert into public.operation_products (
      company_id, product_code, name, product_group, revision, status, unit, price,
      price_currency, cycle_time_minutes, cycle_time_unit, default_flow_strategy,
      default_batch_size, minimum_transfer_quantity, description, quality_grade,
      weight_kg, dimensions, material_name, cycle_time_seconds, labor_minutes_per_unit,
      material_kg_per_unit, scrap_rate
    )
    values (
      v_company.id, 'DEMO-STRAWBERRY-MILK', 'Demo Çilekli Süt 250 ml',
      'Soğuk Zincir İçecek', 'A', 'Aktif', 'adet', 100.00, 'TRY', 2.00,
      'minute', 'flow', 5, 5, 'Demo seed ile eklenen tam reçeteli ürün.', 'A+', 0.28,
      '55x55x145 mm', 'Süt, çilek püresi, şişe', 120, 0.45, 0.25, 1.8
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

    insert into public.operation_products (
      company_id, product_code, name, product_group, revision, status, unit, price,
      price_currency, cycle_time_minutes, cycle_time_unit, default_flow_strategy,
      default_batch_size, minimum_transfer_quantity, description, quality_grade,
      weight_kg, dimensions, material_name, cycle_time_seconds, labor_minutes_per_unit,
      material_kg_per_unit, scrap_rate
    )
    values (
      v_company.id, 'DEMO-MANGO-PUREE', 'Demo Mango Püresi 500 g',
      'Meyve Püresi', 'B', 'Aktif', 'adet', 145.00, 'TRY', 2.75,
      'minute', 'flow', 5, 5, 'İkinci demo ürün; ürün listesi ve satış seçimi dolu görünsün diye eklenir.', 'A', 0.54,
      '90x65x165 mm', 'Mango, ambalaj', 165, 0.55, 0.50, 2.2
    )
    on conflict (company_id, product_code) do update set
      name = excluded.name,
      product_group = excluded.product_group,
      status = excluded.status,
      price = excluded.price,
      cycle_time_minutes = excluded.cycle_time_minutes,
      cycle_time_unit = excluded.cycle_time_unit,
      default_flow_strategy = excluded.default_flow_strategy,
      default_batch_size = excluded.default_batch_size,
      minimum_transfer_quantity = excluded.minimum_transfer_quantity,
      description = excluded.description
    returning id into v_secondary_product_id;

    insert into public.operation_product_materials (product_id, material_id, quantity_per_unit)
    values
      (v_product_id, v_milk_id, 0.22),
      (v_product_id, v_strawberry_id, 0.045),
      (v_product_id, v_bottle_id, 1),
      (v_product_id, v_label_id, 1),
      (v_product_id, v_box_id, 0.0417)
    on conflict (product_id, material_id) do update set quantity_per_unit = excluded.quantity_per_unit;

    insert into public.operation_product_materials (product_id, material_id, quantity_per_unit)
    values
      (v_secondary_product_id, v_strawberry_id, 0.28),
      (v_secondary_product_id, v_bottle_id, 1),
      (v_secondary_product_id, v_label_id, 1),
      (v_secondary_product_id, v_box_id, 0.0833)
    on conflict (product_id, material_id) do update set quantity_per_unit = excluded.quantity_per_unit;

    insert into public.operation_machines (
      company_id, name, price, price_currency, hourly_energy_consumption_kwh,
      concurrent_capacity, availability_hours, speed_multiplier, failure_probability_percent
    )
    values (v_company.id, 'Demo Pastörizasyon Kazanı', 825000, 'TRY', 18.5, 10, 8, 1.10, 2.5)
    on conflict (company_id, name) do update set
      price = excluded.price,
      price_currency = excluded.price_currency,
      hourly_energy_consumption_kwh = excluded.hourly_energy_consumption_kwh,
      concurrent_capacity = excluded.concurrent_capacity,
      availability_hours = excluded.availability_hours,
      speed_multiplier = excluded.speed_multiplier,
      failure_probability_percent = excluded.failure_probability_percent
    returning id into v_pasteurizer_id;

    insert into public.operation_machines (
      company_id, name, price, price_currency, hourly_energy_consumption_kwh,
      concurrent_capacity, availability_hours, speed_multiplier, failure_probability_percent
    )
    values (v_company.id, 'Demo Homojenizatör', 540000, 'TRY', 13.2, 8, 8, 1.05, 1.8)
    on conflict (company_id, name) do update set
      price = excluded.price,
      price_currency = excluded.price_currency,
      hourly_energy_consumption_kwh = excluded.hourly_energy_consumption_kwh,
      concurrent_capacity = excluded.concurrent_capacity,
      availability_hours = excluded.availability_hours,
      speed_multiplier = excluded.speed_multiplier,
      failure_probability_percent = excluded.failure_probability_percent
    returning id into v_homogenizer_id;

    insert into public.operation_machines (
      company_id, name, price, price_currency, hourly_energy_consumption_kwh,
      concurrent_capacity, availability_hours, speed_multiplier, failure_probability_percent
    )
    values (v_company.id, 'Demo Dolum Hattı', 1125000, 'TRY', 22.8, 5, 8, 1.00, 3.2)
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
    values (v_company.id, 'Demo Paketleme Robotu', 610000, 'TRY', 9.6, 12, 8, 1.20, 1.4)
    on conflict (company_id, name) do update set
      price = excluded.price,
      price_currency = excluded.price_currency,
      hourly_energy_consumption_kwh = excluded.hourly_energy_consumption_kwh,
      concurrent_capacity = excluded.concurrent_capacity,
      availability_hours = excluded.availability_hours,
      speed_multiplier = excluded.speed_multiplier,
      failure_probability_percent = excluded.failure_probability_percent
    returning id into v_packer_id;

    insert into public.operation_equipment (company_id, name, price, price_currency, quantity)
    values
      (v_company.id, 'Demo Soğuk Hava Deposu', 375000, 'TRY', 1),
      (v_company.id, 'Demo CIP Temizlik Seti', 95000, 'TRY', 1),
      (v_company.id, 'Demo Kalite Kontrol Kitleri', 18000, 'TRY', 12)
    on conflict (company_id, name) do update set
      price = excluded.price,
      price_currency = excluded.price_currency,
      quantity = excluded.quantity;

    insert into public.operation_workforce_resources (company_id, role_name, hourly_cost, hourly_cost_currency)
    values (v_company.id, 'Demo Hat Operatörü', 310, 'TRY')
    on conflict (company_id, role_name) do update set hourly_cost = excluded.hourly_cost, hourly_cost_currency = excluded.hourly_cost_currency
    returning id into v_operator_id;

    insert into public.operation_workforce_resources (company_id, role_name, hourly_cost, hourly_cost_currency)
    values (v_company.id, 'Demo Paketleme Personeli', 260, 'TRY')
    on conflict (company_id, role_name) do update set hourly_cost = excluded.hourly_cost, hourly_cost_currency = excluded.hourly_cost_currency
    returning id into v_packer_role_id;

    insert into public.operation_workforce_resources (company_id, role_name, hourly_cost, hourly_cost_currency)
    values (v_company.id, 'Demo Kalite Sorumlusu', 420, 'TRY')
    on conflict (company_id, role_name) do update set hourly_cost = excluded.hourly_cost, hourly_cost_currency = excluded.hourly_cost_currency
    returning id into v_qc_id;

    delete from public.operation_notes
    where product_id in (v_product_id, v_secondary_product_id)
      and note like 'Demo:%';

    insert into public.operation_notes (product_id, note)
    values
      (v_product_id, 'Demo: Flow senaryosu 5 adet transfer batch ile dolum hattı darboğazını gösterir.'),
      (v_product_id, 'Demo: Buffer/WIP ve bekleme maliyeti görsellerini test etmek için hazırlanmıştır.');

    delete from public.operation_resource_plans
    where company_id = v_company.id
      and plan_name in ('Demo Flow - Çilekli Süt 1000 adet', 'Demo Batch - Çilekli Süt 1000 adet');

    v_flow_input := jsonb_build_object(
      'planName', 'Demo Flow - Çilekli Süt 1000 adet',
      'productId', v_product_id,
      'productName', 'Demo Çilekli Süt 250 ml',
      'targetQuantity', 1000,
      'flowStrategy', 'flow',
      'batchSize', 5,
      'minimumTransferQuantity', 5,
      'bufferMaxQuantity', 40,
      'waitingCostPerHour', 350,
      'inventoryCostPerUnitHour', 0.12,
      'delayCostPerHour', 900,
      'capacityLossCostPerHour', 220,
      'machineRows', jsonb_build_array(
        jsonb_build_object('machineId', v_pasteurizer_id, 'dailyHours', 8),
        jsonb_build_object('machineId', v_homogenizer_id, 'dailyHours', 8),
        jsonb_build_object('machineId', v_filler_id, 'dailyHours', 8),
        jsonb_build_object('machineId', v_packer_id, 'dailyHours', 8)
      ),
      'operationRows', jsonb_build_array(
        jsonb_build_object('operationId', 'op-pasteurize', 'operationName', 'Pastörizasyon', 'machineId', v_pasteurizer_id, 'processTimeMinutes', 1.20, 'capacity', 10, 'setupMinutes', 18, 'speedMultiplier', 1.10, 'dailyHours', 8),
        jsonb_build_object('operationId', 'op-homogenize', 'operationName', 'Homojenizasyon', 'machineId', v_homogenizer_id, 'processTimeMinutes', 0.95, 'capacity', 8, 'setupMinutes', 12, 'speedMultiplier', 1.05, 'dailyHours', 8),
        jsonb_build_object('operationId', 'op-fill', 'operationName', 'Dolum ve Kapaklama', 'machineId', v_filler_id, 'processTimeMinutes', 1.85, 'capacity', 5, 'setupMinutes', 22, 'speedMultiplier', 1.00, 'dailyHours', 8),
        jsonb_build_object('operationId', 'op-pack', 'operationName', 'Koli Paketleme', 'machineId', v_packer_id, 'processTimeMinutes', 0.70, 'capacity', 12, 'setupMinutes', 10, 'speedMultiplier', 1.20, 'dailyHours', 8)
      ),
      'workforceRows', jsonb_build_array(
        jsonb_build_object('workforceId', v_operator_id, 'peopleAssigned', 2, 'dailyHours', 7.5),
        jsonb_build_object('workforceId', v_packer_role_id, 'peopleAssigned', 2, 'dailyHours', 6),
        jsonb_build_object('workforceId', v_qc_id, 'peopleAssigned', 1, 'dailyHours', 4)
      )
    );

    v_flow_result := jsonb_build_object(
      'planName', 'Demo Flow - Çilekli Süt 1000 adet',
      'productName', 'Demo Çilekli Süt 250 ml',
      'productPrice', 100.00,
      'productPriceCurrency', 'TRY',
      'productUnit', 'adet',
      'producedQuantity', 1000,
      'totalProductionTimeMinutes', 426,
      'transferBatchSize', 5,
      'flowStrategy', 'flow',
      'cycleTimeMinutes', 2,
      'effectiveCycleTimeMinutes', 0.426,
      'bottleneck', jsonb_build_object('operationName', 'Dolum ve Kapaklama', 'machineId', v_filler_id, 'machineName', 'Demo Dolum Hattı', 'processingTimeMinutes', 392),
      'maxWipQuantity', 35,
      'optimization', jsonb_build_object('recommendedBatchSize', 5, 'objectiveScore', 7592, 'testedBatchSizes', jsonb_build_array(1, 5, 10, 25, 50, 100, 1000)),
      'energyConsumptionKwh', 462.8,
      'materialCost', 16520,
      'workforceCost', 9410,
      'machineHoursUsed', 21.9,
      'workforceHoursUsed', 31,
      'selectedMachineValue', 3100000,
      'totalIdleTimeHours', 10.1,
      'waitingCost', 740,
      'inventoryCost', 95,
      'delayCost', 0,
      'capacityLossCost', 2222,
      'totalTrackedDailyCost', 28987,
      'primaryMachineDailyHours', 6.53,
      'operationRows', jsonb_build_array(
        jsonb_build_object('operationId', 'op-pasteurize', 'operationName', 'Pastörizasyon', 'machineId', v_pasteurizer_id, 'machineName', 'Demo Pastörizasyon Kazanı', 'busyMinutes', 128, 'utilizationPercent', 30.0),
        jsonb_build_object('operationId', 'op-homogenize', 'operationName', 'Homojenizasyon', 'machineId', v_homogenizer_id, 'machineName', 'Demo Homojenizatör', 'busyMinutes', 130, 'utilizationPercent', 30.5),
        jsonb_build_object('operationId', 'op-fill', 'operationName', 'Dolum ve Kapaklama', 'machineId', v_filler_id, 'machineName', 'Demo Dolum Hattı', 'busyMinutes', 392, 'utilizationPercent', 92.0),
        jsonb_build_object('operationId', 'op-pack', 'operationName', 'Koli Paketleme', 'machineId', v_packer_id, 'machineName', 'Demo Paketleme Robotu', 'busyMinutes', 84, 'utilizationPercent', 19.7)
      ),
      'bufferRows', jsonb_build_array(
        jsonb_build_object('fromOperationName', 'Pastörizasyon', 'toOperationName', 'Homojenizasyon', 'maxWip', 15, 'averageWip', 6.8),
        jsonb_build_object('fromOperationName', 'Homojenizasyon', 'toOperationName', 'Dolum ve Kapaklama', 'maxWip', 35, 'averageWip', 18.2),
        jsonb_build_object('fromOperationName', 'Dolum ve Kapaklama', 'toOperationName', 'Koli Paketleme', 'maxWip', 10, 'averageWip', 3.1)
      ),
      'machineRows', jsonb_build_array(
        jsonb_build_object('machineId', v_pasteurizer_id, 'name', 'Demo Pastörizasyon Kazanı', 'dailyHours', 2.13, 'energyConsumptionKwh', 39.4, 'utilizationPercent', 30.0),
        jsonb_build_object('machineId', v_homogenizer_id, 'name', 'Demo Homojenizatör', 'dailyHours', 2.17, 'energyConsumptionKwh', 28.6, 'utilizationPercent', 30.5),
        jsonb_build_object('machineId', v_filler_id, 'name', 'Demo Dolum Hattı', 'dailyHours', 6.53, 'energyConsumptionKwh', 148.9, 'utilizationPercent', 92.0),
        jsonb_build_object('machineId', v_packer_id, 'name', 'Demo Paketleme Robotu', 'dailyHours', 1.40, 'energyConsumptionKwh', 13.4, 'utilizationPercent', 19.7)
      ),
      'workforceRows', jsonb_build_array(
        jsonb_build_object('workforceId', v_operator_id, 'roleName', 'Demo Hat Operatörü', 'peopleAssigned', 2, 'dailyHours', 7.5, 'cost', 4650),
        jsonb_build_object('workforceId', v_packer_role_id, 'roleName', 'Demo Paketleme Personeli', 'peopleAssigned', 2, 'dailyHours', 6, 'cost', 3120),
        jsonb_build_object('workforceId', v_qc_id, 'roleName', 'Demo Kalite Sorumlusu', 'peopleAssigned', 1, 'dailyHours', 4, 'cost', 1680)
      ),
      'materialRows', jsonb_build_array(
        jsonb_build_object('materialId', v_milk_id, 'name', 'Demo Süt Bazı', 'dailyQuantity', 220, 'unit', 'lt', 'cost', 4730),
        jsonb_build_object('materialId', v_strawberry_id, 'name', 'Demo Çilek Püresi', 'dailyQuantity', 45, 'unit', 'kg', 'cost', 3870),
        jsonb_build_object('materialId', v_bottle_id, 'name', 'Demo Şişe 250 ml', 'dailyQuantity', 1000, 'unit', 'adet', 'cost', 4200),
        jsonb_build_object('materialId', v_label_id, 'name', 'Demo Etiket', 'dailyQuantity', 1000, 'unit', 'adet', 'cost', 850),
        jsonb_build_object('materialId', v_box_id, 'name', 'Demo Koli', 'dailyQuantity', 41.7, 'unit', 'adet', 'cost', 750.6)
      )
    );

    v_batch_input := v_flow_input || jsonb_build_object(
      'planName', 'Demo Batch - Çilekli Süt 1000 adet',
      'flowStrategy', 'batch',
      'batchSize', 1000,
      'minimumTransferQuantity', 1000,
      'bufferMaxQuantity', 0
    );

    v_batch_result := v_flow_result || jsonb_build_object(
      'planName', 'Demo Batch - Çilekli Süt 1000 adet',
      'totalProductionTimeMinutes', 734,
      'transferBatchSize', 1000,
      'flowStrategy', 'batch',
      'effectiveCycleTimeMinutes', 0.734,
      'maxWipQuantity', 1000,
      'energyConsumptionKwh', 491.2,
      'machineHoursUsed', 22.6,
      'totalIdleTimeHours', 15.8,
      'waitingCost', 2380,
      'inventoryCost', 610,
      'delayCost', 0,
      'capacityLossCost', 3476,
      'totalTrackedDailyCost', 32656,
      'optimization', jsonb_build_object('recommendedBatchSize', 5, 'objectiveScore', 12140, 'testedBatchSizes', jsonb_build_array(1, 5, 10, 25, 50, 100, 1000)),
      'bufferRows', jsonb_build_array(
        jsonb_build_object('fromOperationName', 'Pastörizasyon', 'toOperationName', 'Homojenizasyon', 'maxWip', 1000, 'averageWip', 500),
        jsonb_build_object('fromOperationName', 'Homojenizasyon', 'toOperationName', 'Dolum ve Kapaklama', 'maxWip', 1000, 'averageWip', 500),
        jsonb_build_object('fromOperationName', 'Dolum ve Kapaklama', 'toOperationName', 'Koli Paketleme', 'maxWip', 1000, 'averageWip', 500)
      )
    );

    insert into public.operation_resource_plans (
      company_id, product_id, plan_name, is_active, target_daily_output, input, result, created_at
    )
    values (
      v_company.id, v_product_id, 'Demo Batch - Çilekli Süt 1000 adet', true, 1000,
      v_batch_input, v_batch_result, now() - interval '1 day'
    )
    returning id into v_plan_batch_id;

    insert into public.operation_resource_plans (
      company_id, product_id, plan_name, is_active, target_daily_output, input, result, created_at
    )
    values (
      v_company.id, v_product_id, 'Demo Flow - Çilekli Süt 1000 adet', true, 1000,
      v_flow_input, v_flow_result, now()
    )
    returning id into v_plan_flow_id;

    insert into public.operation_plan_machines (plan_id, machine_id, daily_hours)
    values
      (v_plan_flow_id, v_pasteurizer_id, 2.13),
      (v_plan_flow_id, v_homogenizer_id, 2.17),
      (v_plan_flow_id, v_filler_id, 6.53),
      (v_plan_flow_id, v_packer_id, 1.40),
      (v_plan_batch_id, v_pasteurizer_id, 2.28),
      (v_plan_batch_id, v_homogenizer_id, 2.32),
      (v_plan_batch_id, v_filler_id, 6.82),
      (v_plan_batch_id, v_packer_id, 1.42);

    insert into public.operation_plan_workforce (plan_id, workforce_id, people_assigned, daily_hours)
    values
      (v_plan_flow_id, v_operator_id, 2, 7.5),
      (v_plan_flow_id, v_packer_role_id, 2, 6),
      (v_plan_flow_id, v_qc_id, 1, 4),
      (v_plan_batch_id, v_operator_id, 2, 7.5),
      (v_plan_batch_id, v_packer_role_id, 2, 6),
      (v_plan_batch_id, v_qc_id, 1, 4);

    insert into public.operation_plan_materials (plan_id, material_id, daily_quantity)
    values
      (v_plan_flow_id, v_milk_id, 220),
      (v_plan_flow_id, v_strawberry_id, 45),
      (v_plan_flow_id, v_bottle_id, 1000),
      (v_plan_flow_id, v_label_id, 1000),
      (v_plan_flow_id, v_box_id, 41.7),
      (v_plan_batch_id, v_milk_id, 220),
      (v_plan_batch_id, v_strawberry_id, 45),
      (v_plan_batch_id, v_bottle_id, 1000),
      (v_plan_batch_id, v_label_id, 1000),
      (v_plan_batch_id, v_box_id, 41.7);

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
      v_company.id, 4.65, 22, 1250000, 250000, 1800000,
      jsonb_build_array(
        jsonb_build_object('id', 'demo-equipment-loan', 'name', 'Demo Ekipman Kredisi', 'amount', 1200000, 'currency', 'TRY', 'annualInterestRate', 38, 'gracePeriodMonths', 3, 'loanTermMonths', 36, 'receivedDate', current_date - 20),
        jsonb_build_object('id', 'demo-working-capital', 'name', 'Demo İşletme Sermayesi', 'amount', 600000, 'currency', 'TRY', 'annualInterestRate', 32, 'gracePeriodMonths', 1, 'loanTermMonths', 18, 'receivedDate', current_date - 10)
      ),
      36, 36, 20, 10, 20, 25, 3, 35, 12, 45, 22000, 1.8, 3.2, 2.4, 2.8, 34, 28, 24, 18, 'quarterly', 1.2, 1.0, 1.5
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
      and id in ('demo-equipment-loan', 'demo-working-capital');

    insert into public.financial_loans (
      id, company_id, name, amount, currency, annual_interest_rate,
      grace_period_months, loan_term_months, received_date
    )
    values
      ('demo-equipment-loan', v_company.id, 'Demo Ekipman Kredisi', 1200000, 'TRY', 38, 3, 36, current_date - 20),
      ('demo-working-capital', v_company.id, 'Demo İşletme Sermayesi', 600000, 'TRY', 32, 1, 18, current_date - 10)
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
      and name in ('Demo Soğuk Zincir Kirası', 'Demo Marka Lansman Bütçesi', 'Demo ERP / Yazılım Aboneliği', 'Demo Gıda Sertifikasyon Kurulumu');

    insert into public.financial_extra_costs (company_id, name, cost_type, amount)
    values
      (v_company.id, 'Demo Soğuk Zincir Kirası', 'recurring', 78000),
      (v_company.id, 'Demo Marka Lansman Bütçesi', 'recurring', 125000),
      (v_company.id, 'Demo ERP / Yazılım Aboneliği', 'recurring', 18500),
      (v_company.id, 'Demo Gıda Sertifikasyon Kurulumu', 'initial', 165000);

    delete from public.financial_exchange_rates
    where company_id = v_company.id
      and source = 'DEMO';

    insert into public.financial_exchange_rates (company_id, currency, rate_to_try, source, fetched_at)
    values
      (v_company.id, 'USD', 32.15, 'DEMO', now()),
      (v_company.id, 'EUR', 34.90, 'DEMO', now());

    insert into public.sales_strategy_settings (company_id, monthly_multipliers, multiplier_period)
    values (
      v_company.id,
      '[0.92,0.96,1.00,1.04,1.08,1.16,1.22,1.18,1.10,1.05,1.02,1.12]'::jsonb,
      'monthly'
    )
    on conflict (company_id) do update set
      monthly_multipliers = excluded.monthly_multipliers,
      multiplier_period = excluded.multiplier_period;

    delete from public.sales_channels
    where company_id = v_company.id
      and id in ('demo-direct-cafes', 'demo-online-subscription', 'demo-retail-chain');

    insert into public.sales_channels (
      company_id, id, name, type_id, product_id, start_month, monthly_sales_units,
      growth_months_1_6_percent, growth_months_7_18_percent, growth_months_19_24_percent,
      growth_years_3_5_percent, collection_days, customer_acquisition_cost,
      commission_percent, basket_size, conversion_rate_percent, traffic_score,
      repeat_rate_percent, churn_rate_percent, discount_rate_percent, return_rate_percent,
      capacity_limit, launch_fee, moq_monthly, failure_probability_percent, ramp_up_months,
      seasonality_curve
    )
    values
      (v_company.id, 'demo-direct-cafes', 'Demo Kafe Zinciri Direkt Satış', 'direct', v_product_id, 1, 7800, 12, 6, 4, 18, 21, 42, 0, 24, 14, 82, 36, 4, 3, 1.2, 15000, 0, 2500, 4.5, 2, '[0.90,0.95,1.00,1.04,1.08,1.14,1.22,1.18,1.10,1.04,1.00,1.12]'::jsonb),
      (v_company.id, 'demo-online-subscription', 'Demo Online Abonelik', 'online', v_product_id, 1, 4200, 18, 9, 5, 24, 7, 68, 8, 12, 4.8, 76, 42, 7, 5, 2.4, 9000, 65000, 500, 6.2, 3, '[0.88,0.92,0.98,1.04,1.10,1.20,1.28,1.24,1.12,1.05,1.02,1.18]'::jsonb),
      (v_company.id, 'demo-retail-chain', 'Demo Ulusal Market Rafı', 'retail', v_product_id, 2, 9600, 8, 5, 3, 14, 45, 35, 18, 36, 3.2, 68, 24, 3, 9, 3.6, 18000, 110000, 6000, 8, 4, '[0.94,0.96,0.98,1.02,1.06,1.14,1.20,1.18,1.10,1.04,1.00,1.08]'::jsonb)
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
      and id in ('demo-launch-digital', 'demo-retail-trade', 'demo-crm-retention');

    insert into public.sales_campaigns (
      company_id, id, name, type_id, channel, budget, duration_days, goal
    )
    values
      (v_company.id, 'demo-launch-digital', 'Demo Lansman Performans Kampanyası', 'digital', 'Online + Direkt', 185000, 45, 'İlk 45 günde abonelik talebi ve kafe denemesi yaratmak'),
      (v_company.id, 'demo-retail-trade', 'Demo Raf Aktivasyonu', 'trade', 'Perakende', 260000, 60, 'Market zincirinde raf payı ve tadım aktivasyonu'),
      (v_company.id, 'demo-crm-retention', 'Demo CRM Yeniden Satın Alma', 'email', 'Online', 42000, 30, 'Abonelik churn oranını düşürmek')
    on conflict (company_id, id) do update set
      name = excluded.name,
      type_id = excluded.type_id,
      channel = excluded.channel,
      budget = excluded.budget,
      duration_days = excluded.duration_days,
      goal = excluded.goal;

    insert into public.simulation_variants (company_id, id, name, label, path, parameters)
    values
      (
        v_company.id,
        'current-situation',
        'Demo Current Situation',
        'Current Situation',
        '/simulation/current-situation',
        jsonb_build_object(
          'salesUnits', 21600,
          'unitSalesPrice', 100,
          'productionUnits', 22000,
          'timeHorizonMonths', 12,
          'priceChange', 0,
          'demandChange', 0,
          'campaignLift', 4,
          'productionEfficiency', 6,
          'competitorPressure', 7,
          'volatility', 13,
          'costVolatility', 9,
          'fixedCost', 221500,
          'marketingBudget', 185000,
          'variableCostRatio', 36,
          'discountPercent', 4,
          'returnRatePercent', 2.1,
          'spoilagePercent', 1.8,
          'simulationAlgorithm', 'fbm_with_tendency',
          'simulationCount', 5000
        )
      ),
      (
        v_company.id,
        'demo-growth-case',
        'Demo Growth Case',
        'Growth Case',
        '/simulation/demo-growth-case',
        jsonb_build_object(
          'salesUnits', 28600,
          'unitSalesPrice', 106,
          'productionUnits', 29000,
          'timeHorizonMonths', 18,
          'priceChange', 6,
          'demandChange', 18,
          'campaignLift', 12,
          'productionEfficiency', 10,
          'competitorPressure', 5,
          'volatility', 16,
          'costVolatility', 11,
          'fixedCost', 246000,
          'marketingBudget', 260000,
          'variableCostRatio', 34,
          'discountPercent', 5,
          'returnRatePercent', 2.5,
          'spoilagePercent', 1.6,
          'simulationAlgorithm', 'fbm_with_tendency',
          'simulationCount', 8000
        )
      ),
      (
        v_company.id,
        'demo-risk-case',
        'Demo Risk Case',
        'Risk Case',
        '/simulation/demo-risk-case',
        jsonb_build_object(
          'salesUnits', 16800,
          'unitSalesPrice', 96,
          'productionUnits', 18000,
          'timeHorizonMonths', 12,
          'priceChange', -4,
          'demandChange', -14,
          'campaignLift', 2,
          'productionEfficiency', 2,
          'competitorPressure', 18,
          'volatility', 24,
          'costVolatility', 18,
          'fixedCost', 221500,
          'marketingBudget', 95000,
          'variableCostRatio', 41,
          'discountPercent', 8,
          'returnRatePercent', 4.5,
          'spoilagePercent', 3.2,
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
