export const defaultFinancialSettings = {
  annualInterestRate: 0,
  electricityPricePerKwh: 0,
  incomeTaxRate: 20,
  initialCash: 0,
  loanAmount: 0,
  loanTermMonths: 24,
  rawMaterialBufferMonths: 1,
  rentBufferMonths: 1,
  salaryBufferMonths: 1,
  vatRate: 20,
  workingDaysPerMonth: 22,
};

export const emptyFinancialModel = {
  costStructure: [],
  extraCosts: [],
  incomeRows: [],
  settings: defaultFinancialSettings,
  summary: {
    breakEvenMonth: null,
    cashRunwayMonths: 0,
    discountCost: 0,
    electricityCost: 0,
    expiredWriteOffCost: 0,
    expiredWriteOffUnits: 0,
    extraInitialCost: 0,
    extraRecurringCost: 0,
    forecastSalesUnits: 0,
    incomeTax: 0,
    initialCash: 0,
    initialCashRequired: 0,
    loanAmount: 0,
    loanPayment: 0,
    machinePurchaseCost: 0,
    materialCost: 0,
    netIncome: 0,
    netSoldUnits: 0,
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

export async function loadFinancialModel(supabase, horizon = "6m") {
  const { data, error } = await supabase.rpc("calculate_financial_model", { p_horizon: horizon });

  if (error) throw error;

  return {
    ...emptyFinancialModel,
    ...(data || {}),
    settings: {
      ...defaultFinancialSettings,
      ...(data?.settings || {}),
    },
    summary: {
      ...emptyFinancialModel.summary,
      ...(data?.summary || {}),
    },
    trendChart: {
      ...emptyFinancialModel.trendChart,
      ...(data?.trendChart || {}),
    },
  };
}

export async function saveFinancialModelSettings(supabase, input) {
  const { data, error } = await supabase.rpc("save_financial_model_settings", { p_input: input });

  if (error) throw error;

  return data;
}

export async function saveFinancialExtraCost(supabase, input) {
  const { data, error } = await supabase.rpc("save_financial_extra_cost", { p_input: input });

  if (error) throw error;

  return data;
}
