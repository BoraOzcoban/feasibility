export const emptyFinancialModel = {
  costStructure: [],
  extraCosts: [],
  incomeRows: [],
  settings: {
    electricityPricePerKwh: 0,
  },
  summary: {
    electricityCost: 0,
    extraInitialCost: 0,
    extraRecurringCost: 0,
    machinePurchaseCost: 0,
    materialCost: 0,
    netIncome: 0,
    planCount: 0,
    salesRevenue: 0,
    totalCost: 0,
    totalProduced: 0,
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
      ...emptyFinancialModel.settings,
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
