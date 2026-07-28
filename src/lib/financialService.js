export const defaultFinancialSettings = {
  annualInterestRate: 0,
  assetValueIncreaseAnnualPercent: 0,
  cogsInflationAnnualPercent: 0,
  electricityPricePerKwh: 0,
  expenseVatRate: 20,
  incomeTaxRate: 25,
  increaseFrequency: "semiannual",
  initialCash: 0,
  initialCapacityUnits: 0,
  investmentGrantAmount: 0,
  loanAmount: 0,
  loanRows: [],
  loanTermMonths: 24,
  monthlyCurrencyIncreasePercent: 0,
  monthlyEnergyPriceIncreasePercent: 0,
  monthlyInflationPercent: 0,
  monthlyWageIncreasePercent: 0,
  opexInflationAnnualPercent: 0,
  priceIncreaseAnnualPercent: 0,
  rawMaterialBufferMonths: 1,
  rawMaterialStockDays: 0,
  receivablesCollectionDays: 30,
  rentBufferMonths: 1,
  salaryBufferMonths: 1,
  salesVatRate: 20,
  supplierPaymentDays: 45,
  taxPaymentDelayMonths: 3,
  vatRate: 20,
  workingDaysPerMonth: 22,
};

export const financialLoanCurrencyOptions = ["TRY", "USD", "EUR"];

function addDateMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function createDemoFinancialLoanRows(referenceDate = new Date()) {
  const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);

  return [
    {
      amount: 850000,
      annualInterestRate: 36,
      currency: "TRY",
      gracePeriodMonths: 2,
      id: "demo-working-capital-loan",
      loanTermMonths: 12,
      name: "Isletme Sermayesi Kredisi",
      receivedDate: formatDateInputValue(addDateMonths(monthStart, -2)),
    },
    {
      amount: 45000,
      annualInterestRate: 9.5,
      currency: "USD",
      gracePeriodMonths: 1,
      id: "demo-usd-equipment-loan",
      loanTermMonths: 18,
      name: "USD Ekipman Kredisi",
      receivedDate: formatDateInputValue(addDateMonths(monthStart, -1)),
    },
    {
      amount: 30000,
      annualInterestRate: 7.25,
      currency: "EUR",
      gracePeriodMonths: 0,
      id: "demo-eur-short-term-loan",
      loanTermMonths: 6,
      name: "EUR Kisa Vadeli Kredi",
      receivedDate: formatDateInputValue(addDateMonths(monthStart, 1)),
    },
  ];
}

export const requiredFinancialSettingFields = [
  "electricityPricePerKwh",
  "workingDaysPerMonth",
  "initialCash",
  "rawMaterialBufferMonths",
  "salaryBufferMonths",
  "rentBufferMonths",
];

export const generalFinancialAssumptionFields = [
  "investmentGrantAmount",
  "incomeTaxRate",
  "taxPaymentDelayMonths",
  "salesVatRate",
  "expenseVatRate",
  "receivablesCollectionDays",
  "rawMaterialStockDays",
  "supplierPaymentDays",
  "initialCapacityUnits",
];

export const optionalFinancialSettingFields = [
  "loanRows",
];

export const optionalMacroFinancialSettingFields = [
  "monthlyCurrencyIncreasePercent",
  "monthlyInflationPercent",
  "monthlyEnergyPriceIncreasePercent",
  "monthlyWageIncreasePercent",
];

export const inflationRevaluationFinancialFields = [
  "cogsInflationAnnualPercent",
  "opexInflationAnnualPercent",
  "priceIncreaseAnnualPercent",
  "assetValueIncreaseAnnualPercent",
  "increaseFrequency",
];

const financialSettingRules = {
  annualInterestRate: { min: 0 },
  assetValueIncreaseAnnualPercent: { min: 0 },
  cogsInflationAnnualPercent: { min: 0 },
  electricityPricePerKwh: { min: 0 },
  expenseVatRate: { min: 0 },
  incomeTaxRate: { min: 0 },
  initialCash: { min: 0 },
  initialCapacityUnits: { min: 0 },
  investmentGrantAmount: { min: 0 },
  loanAmount: { min: 0 },
  loanTermMonths: { integer: true, min: 1 },
  monthlyCurrencyIncreasePercent: { min: 0 },
  monthlyEnergyPriceIncreasePercent: { min: 0 },
  monthlyInflationPercent: { min: 0 },
  monthlyWageIncreasePercent: { min: 0 },
  opexInflationAnnualPercent: { min: 0 },
  priceIncreaseAnnualPercent: { min: 0 },
  rawMaterialBufferMonths: { min: 0 },
  rawMaterialStockDays: { min: 0 },
  receivablesCollectionDays: { min: 0 },
  rentBufferMonths: { min: 0 },
  salaryBufferMonths: { min: 0 },
  salesVatRate: { min: 0 },
  supplierPaymentDays: { min: 0 },
  taxPaymentDelayMonths: { integer: true, min: 0 },
  vatRate: { min: 0 },
  workingDaysPerMonth: { min: 1 },
};

const allowedIncreaseFrequencies = new Set(["monthly", "quarterly", "semiannual", "annual"]);
const currencyCodePattern = /^[A-Z]{3}$/;

function isBlankFinancialValue(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function formatDateInputValue(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getTodayDateInputValue() {
  return formatDateInputValue(new Date());
}

function normalizeLoanCurrency(value) {
  const currency = String(value || "TRY").trim().toUpperCase();
  return currencyCodePattern.test(currency) && financialLoanCurrencyOptions.includes(currency) ? currency : "TRY";
}

function normalizeLoanReceivedDate(value) {
  if (isBlankFinancialValue(value)) return getTodayDateInputValue();

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Loan received date must be a valid date.");
  }

  return formatDateInputValue(date);
}

export function normalizeFinancialLoanRows(input = {}) {
  const sourceRows = Array.isArray(input.loanRows) ? input.loanRows : [];
  const legacyLoanAmount = Number(input.loanAmount);
  const rows = sourceRows.length
    ? sourceRows
    : (Number.isFinite(legacyLoanAmount) && legacyLoanAmount > 0
        ? [{
            amount: input.loanAmount,
            annualInterestRate: input.annualInterestRate,
            gracePeriodMonths: input.gracePeriodMonths,
            loanTermMonths: input.loanTermMonths,
          }]
        : []);

  return rows.map((row, index) => {
    const amount = Number(row.amount);
    const annualInterestRate = Number(row.annualInterestRate);
    const currency = normalizeLoanCurrency(row.currency || input.loanCurrency);
    const gracePeriodMonths = isBlankFinancialValue(row.gracePeriodMonths) ? 0 : Number(row.gracePeriodMonths);
    const loanTermMonths = Number(row.loanTermMonths);
    const name = String(row.name || `Loan ${index + 1}`).trim() || `Loan ${index + 1}`;
    const receivedDate = normalizeLoanReceivedDate(row.receivedDate || row.received_date || input.loanReceivedDate);

    if (isBlankFinancialValue(row.amount)) {
      throw new Error(`Missing loan amount for loan ${index + 1}`);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Loan amount must be greater than zero for loan ${index + 1}`);
    }

    if (isBlankFinancialValue(row.annualInterestRate)) {
      throw new Error(`Missing annual interest rate for loan ${index + 1}`);
    }

    if (!Number.isFinite(annualInterestRate) || annualInterestRate < 0) {
      throw new Error(`Annual interest rate must be zero or more for loan ${index + 1}`);
    }

    if (isBlankFinancialValue(row.loanTermMonths)) {
      throw new Error(`Missing term months for loan ${index + 1}`);
    }

    if (!Number.isFinite(loanTermMonths) || loanTermMonths < 1) {
      throw new Error(`Loan term months must be at least 1 for loan ${index + 1}`);
    }

    if (!Number.isFinite(gracePeriodMonths) || gracePeriodMonths < 0) {
      throw new Error(`Grace period months must be zero or more for loan ${index + 1}`);
    }

    if (gracePeriodMonths >= loanTermMonths) {
      throw new Error(`Grace period months must be less than the loan term for loan ${index + 1}`);
    }

    return {
      amount,
      annualInterestRate,
      currency,
      gracePeriodMonths: Math.round(gracePeriodMonths),
      id: row.id || `loan-${index + 1}`,
      loanTermMonths: Math.round(loanTermMonths),
      name,
      receivedDate,
    };
  });
}

function getLoanSummary(loanRows) {
  const loanAmount = loanRows.reduce((total, row) => total + row.amount, 0);
  const annualInterestRate = loanAmount
    ? loanRows.reduce((total, row) => total + (row.annualInterestRate * row.amount), 0) / loanAmount
    : 0;
  const loanTermMonths = loanRows.length
    ? loanRows.reduce((longestTerm, row) => Math.max(longestTerm, row.loanTermMonths), 1)
    : 24;

  return { annualInterestRate, loanAmount, loanTermMonths };
}

export function normalizeFinancialModelSettings(input = {}) {
  const normalized = { ...defaultFinancialSettings };
  const requiredFields = new Set([
    ...requiredFinancialSettingFields,
    ...generalFinancialAssumptionFields,
    ...inflationRevaluationFinancialFields,
  ]);
  const numericFields = [
    ...requiredFinancialSettingFields,
    ...generalFinancialAssumptionFields,
    ...optionalMacroFinancialSettingFields,
    ...inflationRevaluationFinancialFields.filter((field) => field !== "increaseFrequency"),
  ];

  numericFields.forEach((field) => {
    const value = input[field];
    const rule = financialSettingRules[field] || { min: 0 };

    if (isBlankFinancialValue(value)) {
      if (requiredFields.has(field)) {
        throw new Error(`Missing required financial input: ${field}`);
      }

      normalized[field] = defaultFinancialSettings[field];
      return;
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
      throw new Error(`Financial input must be numeric: ${field}`);
    }

    if (number < rule.min) {
      throw new Error(`Financial input is below the minimum value: ${field}`);
    }

    normalized[field] = rule.integer ? Math.round(number) : number;
  });

  const increaseFrequency = input.increaseFrequency || defaultFinancialSettings.increaseFrequency;
  if (!allowedIncreaseFrequencies.has(increaseFrequency)) {
    throw new Error("Financial input must use a valid increase frequency.");
  }

  normalized.increaseFrequency = increaseFrequency;
  normalized.vatRate = normalized.salesVatRate;
  normalized.loanRows = normalizeFinancialLoanRows(input);
  Object.assign(normalized, getLoanSummary(normalized.loanRows));

  return normalized;
}

export const emptyFinancialModel = {
  costStructure: [],
  extraCosts: [],
  incomeRows: [],
  settings: defaultFinancialSettings,
  settingsSaved: false,
  summary: {
    breakEvenMonth: null,
    cashRunwayMonths: 0,
    discountCost: 0,
    electricityCost: 0,
    equipmentPurchaseCost: 0,
    expiredWriteOffCost: 0,
    expiredWriteOffUnits: 0,
    extraInitialCost: 0,
    extraRecurringCost: 0,
    forecastSalesUnits: 0,
    incomeTax: 0,
    initialCash: 0,
    initialCashRequired: 0,
    investmentGrantAmount: 0,
    loanAmount: 0,
    loanInterest: 0,
    loanPayment: 0,
    loanPaymentTotal: 0,
    machinePurchaseCost: 0,
    materialCost: 0,
    netIncome: 0,
    netSoldUnits: 0,
    otherProductionCost: 0,
    paybackMonth: null,
    planCount: 0,
    requiredMonthlySalesVolume: 0,
    retailerMarginCost: 0,
    returnedUnits: 0,
    salesRevenue: 0,
    totalCashFlow: 0,
    totalCost: 0,
    totalProduced: 0,
    unsoldInventoryUnits: 0,
    vatPayable: 0,
    workingCapitalRequirement: 0,
  },
  trendChart: {
    costPath: "",
    labels: [],
    netPath: "",
    salesPath: "",
  },
  trendRows: [],
};

export const emptyFinancialExtraCostForm = {
  amount: 0,
  costType: "recurring",
  name: "",
};

function mapFinancialExtraCostRow(row) {
  return {
    amount: row.amount,
    costType: row.cost_type,
    id: row.id,
    name: row.name,
  };
}

function mapFinancialSettingsRow(row) {
  if (!row) return {};

  return {
    annualInterestRate: row.annual_interest_rate,
    assetValueIncreaseAnnualPercent: row.asset_value_increase_annual_percent,
    cogsInflationAnnualPercent: row.cogs_inflation_annual_percent,
    electricityPricePerKwh: row.electricity_price_per_kwh,
    expenseVatRate: row.expense_vat_rate ?? row.vat_rate,
    incomeTaxRate: row.income_tax_rate,
    increaseFrequency: row.increase_frequency || "semiannual",
    initialCash: row.initial_cash,
    initialCapacityUnits: row.initial_capacity_units,
    investmentGrantAmount: row.investment_grant_amount,
    loanAmount: row.loan_amount,
    loanRows: Array.isArray(row.loan_rows) ? row.loan_rows : [],
    loanTermMonths: row.loan_term_months,
    rawMaterialBufferMonths: row.raw_material_buffer_months,
    rawMaterialStockDays: row.raw_material_stock_days,
    receivablesCollectionDays: row.receivables_collection_days,
    rentBufferMonths: row.rent_buffer_months,
    salaryBufferMonths: row.salary_buffer_months,
    salesVatRate: row.sales_vat_rate ?? row.vat_rate,
    supplierPaymentDays: row.supplier_payment_days,
    taxPaymentDelayMonths: row.tax_payment_delay_months,
    monthlyCurrencyIncreasePercent: row.monthly_currency_increase_percent,
    monthlyEnergyPriceIncreasePercent: row.monthly_energy_price_increase_percent,
    monthlyInflationPercent: row.monthly_inflation_percent,
    monthlyWageIncreasePercent: row.monthly_wage_increase_percent,
    opexInflationAnnualPercent: row.opex_inflation_annual_percent,
    priceIncreaseAnnualPercent: row.price_increase_annual_percent,
    vatRate: row.vat_rate,
    workingDaysPerMonth: row.working_days_per_month,
  };
}

function mapFinancialLoanRow(row) {
  return {
    amount: row.amount,
    annualInterestRate: row.annual_interest_rate,
    currency: normalizeLoanCurrency(row.currency),
    gracePeriodMonths: row.grace_period_months,
    id: row.id,
    loanTermMonths: row.loan_term_months,
    name: row.name,
    receivedDate: row.received_date,
  };
}

function isMissingFinancialLoansTableError(error) {
  if (!error) return false;
  const message = String(error.message || "").toLowerCase();
  return error.code === "42P01" || (message.includes("financial_loans") && message.includes("does not exist"));
}

export async function loadFinancialModel(supabase, horizon = "6m") {
  let settingsRow = null;
  const [
    { data: settingsData, error: settingsError },
    { data: extraCostRows, error: extraCostsError },
    { data: loanRows, error: loanRowsError },
  ] = await Promise.all([
    supabase
      .from("financial_model_settings")
      .select("electricity_price_per_kwh, working_days_per_month, initial_cash, investment_grant_amount, loan_amount, loan_rows, annual_interest_rate, loan_term_months, vat_rate, sales_vat_rate, expense_vat_rate, income_tax_rate, tax_payment_delay_months, receivables_collection_days, raw_material_stock_days, supplier_payment_days, initial_capacity_units, raw_material_buffer_months, salary_buffer_months, rent_buffer_months, monthly_currency_increase_percent, monthly_inflation_percent, monthly_energy_price_increase_percent, monthly_wage_increase_percent, cogs_inflation_annual_percent, opex_inflation_annual_percent, price_increase_annual_percent, asset_value_increase_annual_percent, increase_frequency")
      .maybeSingle(),
    supabase
      .from("financial_extra_costs")
      .select("id, name, cost_type, amount")
      .order("created_at", { ascending: false }),
    supabase
      .from("financial_loans")
      .select("id, name, amount, currency, annual_interest_rate, grace_period_months, loan_term_months, received_date")
      .order("received_date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (settingsError) throw settingsError;
  if (extraCostsError) throw extraCostsError;
  if (loanRowsError && !isMissingFinancialLoansTableError(loanRowsError)) throw loanRowsError;
  settingsRow = settingsData;
  const mappedSettings = mapFinancialSettingsRow(settingsRow);
  const mappedLoanRows = loanRowsError ? [] : (loanRows || []).map(mapFinancialLoanRow);

  return {
    ...emptyFinancialModel,
    extraCosts: (extraCostRows || []).map(mapFinancialExtraCostRow),
    settings: {
      ...defaultFinancialSettings,
      ...mappedSettings,
      loanRows: mappedLoanRows.length ? mappedLoanRows : (mappedSettings.loanRows || []),
    },
    settingsSaved: Boolean(settingsRow),
    horizon,
  };
}

export async function saveFinancialModelSettings(supabase, input) {
  const { data, error } = await supabase.rpc("save_financial_model_settings", {
    p_input: normalizeFinancialModelSettings(input),
  });

  if (error) throw error;

  return data;
}

export async function saveFinancialExtraCost(supabase, input) {
  const { data, error } = await supabase.rpc("save_financial_extra_cost", { p_input: input });

  if (error) throw error;

  return data;
}
