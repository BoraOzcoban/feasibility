insert into public.financial_loans (
  id,
  company_id,
  name,
  amount,
  currency,
  annual_interest_rate,
  grace_period_months,
  loan_term_months,
  received_date,
  created_by
)
select
  seed.id,
  c.id,
  seed.name,
  seed.amount,
  seed.currency,
  seed.annual_interest_rate,
  seed.grace_period_months,
  seed.loan_term_months,
  seed.received_date,
  null
from public.companies c
cross join (
  values
    (
      'dummy-working-capital-loan',
      'Isletme Sermayesi Kredisi',
      850000::numeric,
      'TRY',
      36::numeric,
      2,
      12,
      (current_date - interval '2 months')::date
    ),
    (
      'dummy-usd-equipment-loan',
      'USD Ekipman Kredisi',
      45000::numeric,
      'USD',
      9.5::numeric,
      1,
      18,
      (current_date - interval '1 month')::date
    ),
    (
      'dummy-eur-short-term-loan',
      'EUR Kisa Vadeli Kredi',
      30000::numeric,
      'EUR',
      7.25::numeric,
      0,
      6,
      (current_date + interval '1 month')::date
    )
) as seed(id, name, amount, currency, annual_interest_rate, grace_period_months, loan_term_months, received_date)
where c.name = 'Atera'
  and not exists (
    select 1
    from public.financial_loans existing_loans
    where existing_loans.company_id = c.id
  )
on conflict (company_id, id) do nothing;
