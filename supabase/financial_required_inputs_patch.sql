insert into public.app_modules (module_key, name)
values ('financial-modelling', 'Finansal Modelleme')
on conflict (module_key) do update set name = excluded.name;

select public.ensure_company_defaults(id) from public.companies;

alter table public.financial_model_settings
  add column if not exists loan_rows jsonb not null default '[]'::jsonb,
  add column if not exists investment_grant_amount numeric(14, 2) not null default 0,
  add column if not exists sales_vat_rate numeric(8, 4) not null default 20,
  add column if not exists expense_vat_rate numeric(8, 4) not null default 20,
  add column if not exists tax_payment_delay_months integer not null default 3,
  add column if not exists receivables_collection_days numeric(8, 2) not null default 30,
  add column if not exists raw_material_stock_days numeric(8, 2) not null default 0,
  add column if not exists supplier_payment_days numeric(8, 2) not null default 45,
  add column if not exists initial_capacity_units numeric(14, 3) not null default 0,
  add column if not exists monthly_currency_increase_percent numeric(8, 4) not null default 0,
  add column if not exists monthly_inflation_percent numeric(8, 4) not null default 0,
  add column if not exists monthly_energy_price_increase_percent numeric(8, 4) not null default 0,
  add column if not exists monthly_wage_increase_percent numeric(8, 4) not null default 0,
  add column if not exists cogs_inflation_annual_percent numeric(8, 4) not null default 0,
  add column if not exists opex_inflation_annual_percent numeric(8, 4) not null default 0,
  add column if not exists price_increase_annual_percent numeric(8, 4) not null default 0,
  add column if not exists asset_value_increase_annual_percent numeric(8, 4) not null default 0,
  add column if not exists increase_frequency text not null default 'semiannual';

update public.financial_model_settings
set sales_vat_rate = vat_rate
where sales_vat_rate = 20 and vat_rate is not null;

update public.financial_model_settings
set expense_vat_rate = vat_rate
where expense_vat_rate = 20 and vat_rate is not null;

update public.financial_model_settings
set increase_frequency = 'semiannual'
where increase_frequency not in ('monthly', 'quarterly', 'semiannual', 'annual');

create or replace function public.save_financial_model_settings(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := public.current_profile_company_id();
  v_annual_interest_rate numeric := 0;
  v_clean_loan_rows jsonb := '[]'::jsonb;
  v_loan_amount numeric := 0;
  v_loan_entry jsonb;
  v_loan_entry_amount numeric;
  v_loan_entry_grace integer;
  v_loan_entry_interest numeric;
  v_loan_entry_term integer;
  v_loan_interest_weight numeric := 0;
  v_loan_rows jsonb := '[]'::jsonb;
  v_loan_term_months integer := 0;
  v_required_key text;
  v_required_label text;
  v_row jsonb;
begin
  if v_company_id is null then
    raise exception 'Current profile is not connected to a company.';
  end if;

  if not (
    public.has_module_permission('financial-modelling', 'write')
    or public.has_module_permission('operations', 'write')
  ) then
    raise exception 'Financial modelling write permission is required.';
  end if;

  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'Financial settings input is required.';
  end if;

  for v_required_key, v_required_label in
    select key, label
    from (values
      ('electricityPricePerKwh', 'Electricity kWh price'),
      ('workingDaysPerMonth', 'Working days per month'),
      ('initialCash', 'Initial cash'),
      ('investmentGrantAmount', 'Investment grant / subsidy'),
      ('vatRate', 'VAT rate'),
      ('salesVatRate', 'Sales VAT rate'),
      ('expenseVatRate', 'Expense VAT rate'),
      ('incomeTaxRate', 'Income tax rate'),
      ('taxPaymentDelayMonths', 'Tax payment delay months'),
      ('receivablesCollectionDays', 'Receivables collection days'),
      ('rawMaterialStockDays', 'Raw material stock days'),
      ('supplierPaymentDays', 'Supplier payment days'),
      ('initialCapacityUnits', 'Initial capacity units'),
      ('cogsInflationAnnualPercent', 'COGS inflation'),
      ('opexInflationAnnualPercent', 'OpEx inflation'),
      ('priceIncreaseAnnualPercent', 'Price increase policy'),
      ('assetValueIncreaseAnnualPercent', 'Asset value increase'),
      ('increaseFrequency', 'Increase frequency'),
      ('rawMaterialBufferMonths', 'Material buffer months'),
      ('salaryBufferMonths', 'Salary buffer months'),
      ('rentBufferMonths', 'Rent buffer months')
    ) as required_fields(key, label)
  loop
    if not (p_input ? v_required_key) or nullif(trim(p_input->>v_required_key), '') is null then
      raise exception '% is required.', v_required_label;
    end if;
  end loop;

  if nullif(trim(p_input->>'workingDaysPerMonth'), '')::numeric < 1 then
    raise exception 'Working days per month must be at least 1.';
  end if;

  for v_required_key, v_required_label in
    select key, label
    from (values
      ('electricityPricePerKwh', 'Electricity kWh price'),
      ('initialCash', 'Initial cash'),
      ('investmentGrantAmount', 'Investment grant / subsidy'),
      ('loanAmount', 'Loan amount'),
      ('annualInterestRate', 'Annual interest rate'),
      ('vatRate', 'VAT rate'),
      ('salesVatRate', 'Sales VAT rate'),
      ('expenseVatRate', 'Expense VAT rate'),
      ('incomeTaxRate', 'Income tax rate'),
      ('taxPaymentDelayMonths', 'Tax payment delay months'),
      ('receivablesCollectionDays', 'Receivables collection days'),
      ('rawMaterialStockDays', 'Raw material stock days'),
      ('supplierPaymentDays', 'Supplier payment days'),
      ('initialCapacityUnits', 'Initial capacity units'),
      ('monthlyCurrencyIncreasePercent', 'Monthly FX increase'),
      ('monthlyInflationPercent', 'Monthly inflation'),
      ('monthlyEnergyPriceIncreasePercent', 'Monthly energy price increase'),
      ('monthlyWageIncreasePercent', 'Monthly wage increase'),
      ('cogsInflationAnnualPercent', 'COGS inflation'),
      ('opexInflationAnnualPercent', 'OpEx inflation'),
      ('priceIncreaseAnnualPercent', 'Price increase policy'),
      ('assetValueIncreaseAnnualPercent', 'Asset value increase'),
      ('rawMaterialBufferMonths', 'Material buffer months'),
      ('salaryBufferMonths', 'Salary buffer months'),
      ('rentBufferMonths', 'Rent buffer months')
    ) as numeric_fields(key, label)
  loop
    if (p_input ? v_required_key) and nullif(trim(p_input->>v_required_key), '') is not null and nullif(trim(p_input->>v_required_key), '')::numeric < 0 then
      raise exception '% cannot be negative.', v_required_label;
    end if;
  end loop;

  if (p_input ? 'loanTermMonths') and nullif(trim(p_input->>'loanTermMonths'), '') is not null and nullif(trim(p_input->>'loanTermMonths'), '')::integer < 1 then
    raise exception 'Loan term months must be at least 1.';
  end if;

  if (p_input ? 'loanRows') and jsonb_typeof(p_input->'loanRows') <> 'array' then
    raise exception 'Loan rows must be an array.';
  end if;

  if coalesce(nullif(trim(p_input->>'increaseFrequency'), ''), 'semiannual') not in ('monthly', 'quarterly', 'semiannual', 'annual') then
    raise exception 'Increase frequency is invalid.';
  end if;

  v_loan_rows := case when jsonb_typeof(p_input->'loanRows') = 'array' then p_input->'loanRows' else '[]'::jsonb end;

  if v_loan_rows = '[]'::jsonb and nullif(trim(p_input->>'loanAmount'), '') is not null and nullif(trim(p_input->>'loanAmount'), '')::numeric > 0 then
    v_loan_rows := jsonb_build_array(jsonb_build_object(
      'id', 'legacy-loan',
      'amount', nullif(p_input->>'loanAmount', '')::numeric,
      'annualInterestRate', coalesce(nullif(p_input->>'annualInterestRate', '')::numeric, 0),
      'gracePeriodMonths', greatest(0, coalesce(nullif(p_input->>'gracePeriodMonths', '')::integer, 0)),
      'loanTermMonths', greatest(1, coalesce(nullif(p_input->>'loanTermMonths', '')::integer, 24))
    ));
  end if;

  for v_loan_entry in select value from jsonb_array_elements(v_loan_rows) loop
    if jsonb_typeof(v_loan_entry) <> 'object' then
      raise exception 'Each loan row must be an object.';
    end if;

    if nullif(trim(v_loan_entry->>'amount'), '') is null then
      raise exception 'Loan amount is required for every loan.';
    end if;

    if nullif(trim(v_loan_entry->>'annualInterestRate'), '') is null then
      raise exception 'Annual interest rate is required for every loan.';
    end if;

    if nullif(trim(v_loan_entry->>'loanTermMonths'), '') is null then
      raise exception 'Loan term months is required for every loan.';
    end if;

    v_loan_entry_amount := nullif(v_loan_entry->>'amount', '')::numeric;
    v_loan_entry_grace := greatest(0, coalesce(nullif(v_loan_entry->>'gracePeriodMonths', '')::integer, 0));
    v_loan_entry_interest := nullif(v_loan_entry->>'annualInterestRate', '')::numeric;
    v_loan_entry_term := nullif(v_loan_entry->>'loanTermMonths', '')::integer;

    if v_loan_entry_amount <= 0 then
      raise exception 'Loan amount must be greater than zero.';
    end if;

    if v_loan_entry_interest < 0 then
      raise exception 'Annual interest rate cannot be negative.';
    end if;

    if v_loan_entry_term < 1 then
      raise exception 'Loan term months must be at least 1.';
    end if;

    if v_loan_entry_grace >= v_loan_entry_term then
      raise exception 'Grace period months must be less than loan term months.';
    end if;

    v_loan_amount := v_loan_amount + v_loan_entry_amount;
    v_loan_interest_weight := v_loan_interest_weight + (v_loan_entry_amount * v_loan_entry_interest);
    v_loan_term_months := greatest(v_loan_term_months, v_loan_entry_term);
    v_clean_loan_rows := v_clean_loan_rows || jsonb_build_array(jsonb_build_object(
      'id', coalesce(nullif(trim(v_loan_entry->>'id'), ''), gen_random_uuid()::text),
      'amount', v_loan_entry_amount,
      'annualInterestRate', v_loan_entry_interest,
      'gracePeriodMonths', v_loan_entry_grace,
      'loanTermMonths', v_loan_entry_term
    ));
  end loop;

  if v_loan_amount > 0 then
    v_annual_interest_rate := v_loan_interest_weight / v_loan_amount;
  end if;

  if v_loan_term_months < 1 then
    v_loan_term_months := 24;
  end if;

  insert into public.financial_model_settings (
    company_id,
    electricity_price_per_kwh,
    working_days_per_month,
    initial_cash,
    investment_grant_amount,
    loan_amount,
    loan_rows,
    annual_interest_rate,
    loan_term_months,
    vat_rate,
    sales_vat_rate,
    expense_vat_rate,
    income_tax_rate,
    tax_payment_delay_months,
    receivables_collection_days,
    raw_material_stock_days,
    supplier_payment_days,
    initial_capacity_units,
    monthly_currency_increase_percent,
    monthly_inflation_percent,
    monthly_energy_price_increase_percent,
    monthly_wage_increase_percent,
    cogs_inflation_annual_percent,
    opex_inflation_annual_percent,
    price_increase_annual_percent,
    asset_value_increase_annual_percent,
    increase_frequency,
    raw_material_buffer_months,
    salary_buffer_months,
    rent_buffer_months,
    updated_by
  )
  values (
    v_company_id,
    greatest(0, nullif(p_input->>'electricityPricePerKwh', '')::numeric),
    greatest(1, nullif(p_input->>'workingDaysPerMonth', '')::numeric),
    greatest(0, nullif(p_input->>'initialCash', '')::numeric),
    greatest(0, nullif(p_input->>'investmentGrantAmount', '')::numeric),
    v_loan_amount,
    v_clean_loan_rows,
    v_annual_interest_rate,
    v_loan_term_months,
    greatest(0, nullif(p_input->>'vatRate', '')::numeric),
    greatest(0, coalesce(nullif(p_input->>'salesVatRate', '')::numeric, nullif(p_input->>'vatRate', '')::numeric)),
    greatest(0, coalesce(nullif(p_input->>'expenseVatRate', '')::numeric, nullif(p_input->>'vatRate', '')::numeric)),
    greatest(0, nullif(p_input->>'incomeTaxRate', '')::numeric),
    greatest(0, nullif(p_input->>'taxPaymentDelayMonths', '')::integer),
    greatest(0, nullif(p_input->>'receivablesCollectionDays', '')::numeric),
    greatest(0, nullif(p_input->>'rawMaterialStockDays', '')::numeric),
    greatest(0, nullif(p_input->>'supplierPaymentDays', '')::numeric),
    greatest(0, nullif(p_input->>'initialCapacityUnits', '')::numeric),
    greatest(0, coalesce(nullif(p_input->>'monthlyCurrencyIncreasePercent', '')::numeric, 0)),
    greatest(0, coalesce(nullif(p_input->>'monthlyInflationPercent', '')::numeric, 0)),
    greatest(0, coalesce(nullif(p_input->>'monthlyEnergyPriceIncreasePercent', '')::numeric, 0)),
    greatest(0, coalesce(nullif(p_input->>'monthlyWageIncreasePercent', '')::numeric, 0)),
    greatest(0, nullif(p_input->>'cogsInflationAnnualPercent', '')::numeric),
    greatest(0, nullif(p_input->>'opexInflationAnnualPercent', '')::numeric),
    greatest(0, nullif(p_input->>'priceIncreaseAnnualPercent', '')::numeric),
    greatest(0, nullif(p_input->>'assetValueIncreaseAnnualPercent', '')::numeric),
    coalesce(nullif(trim(p_input->>'increaseFrequency'), ''), 'semiannual'),
    greatest(0, nullif(p_input->>'rawMaterialBufferMonths', '')::numeric),
    greatest(0, nullif(p_input->>'salaryBufferMonths', '')::numeric),
    greatest(0, nullif(p_input->>'rentBufferMonths', '')::numeric),
    auth.uid()
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
    rent_buffer_months = excluded.rent_buffer_months,
    updated_by = excluded.updated_by;

  select to_jsonb(s.*)
    into v_row
  from public.financial_model_settings s
  where s.company_id = v_company_id;

  return v_row;
end;
$$;

grant execute on function public.save_financial_model_settings(jsonb) to authenticated;

select pg_notify('pgrst', 'reload schema');
