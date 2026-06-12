export const emptySalesStrategy = {
  campaignTypes: [],
  channelTypes: [],
  company: {
    monthlyMultipliers: Array.from({ length: 12 }, () => 1),
    multiplierPeriod: "monthly",
  },
  campaigns: [],
  channels: [],
};

export const defaultSimulationParameters = {
  baseRevenue: 0,
  campaignLift: 0,
  competitorPressure: 0,
  costVolatility: 0,
  demandChange: 0,
  discountPercent: 0,
  fixedCost: 0,
  grossMargin: 0,
  marketingBudget: 0,
  marketShare: 0,
  priceChange: 0,
  productionUnits: 0,
  productionEfficiency: 0,
  reputationScore: 0,
  returnRatePercent: 0,
  simulationAlgorithm: "fbm_with_tendency",
  salesUnits: 0,
  simulationCount: 0,
  spoilagePercent: 0,
  timeHorizonMonths: 12,
  unitSalesPrice: 0,
  variableCostRatio: 0,
  volatility: 0,
};

export const emptySimulationVariant = {
  id: "current-situation",
  label: "Current Situation",
  name: "Current Situation",
  path: "/simulation/current-situation",
  parameters: defaultSimulationParameters,
};

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeOptionalNumber(value) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  return Number.isFinite(number) ? number : "";
}

function normalizeMonthlyMultipliers(value, multiplierPeriod = "monthly") {
  const rows = Array.isArray(value) ? value : [];

  if (multiplierPeriod === "quarterly" && rows.length === 4) {
    return Array.from({ length: 12 }, (_, index) => normalizeNumber(rows[Math.floor(index / 3)], 1));
  }

  return Array.from({ length: 12 }, (_, index) => normalizeNumber(rows[index], 1));
}

function normalizeMultiplierPeriod(value) {
  return value === "quarterly" ? "quarterly" : "monthly";
}

function normalizeSeasonalityCurve(value) {
  const rows = Array.isArray(value) ? value : [];
  return Array.from({ length: 12 }, (_, index) => normalizeOptionalNumber(rows[index]));
}

function mapSalesType(row) {
  return {
    averageCommissionPercent: normalizeNumber(row.average_commission_percent),
    averageConversionRate: normalizeNumber(row.average_conversion_rate),
    averageCustomerAcquisitionRate: normalizeNumber(row.average_customer_acquisition_rate),
    averageDurationDays: normalizeNumber(row.average_duration_days),
    descriptionEn: row.description_en || "",
    descriptionTr: row.description_tr || "",
    id: row.id,
    nameEn: row.name_en || row.id,
    nameTr: row.name_tr || row.name_en || row.id,
    sortOrder: normalizeNumber(row.sort_order),
  };
}

function throwPlanningError(error) {
  const message = error?.message || "";

  if (
    error?.code === "42P01" ||
    message.includes("schema cache") ||
    message.includes("Could not find the table")
  ) {
    throw new Error("Planning tables are missing in Supabase. Run supabase/planning_patch.sql in the Supabase SQL Editor, then refresh this page.");
  }

  throw error;
}

export async function loadSalesStrategy(supabase) {
  const [
    { data: channelTypeRows, error: channelTypesError },
    { data: campaignTypeRows, error: campaignTypesError },
    { data: settingsRows, error: settingsError },
    { data: channelRows, error: channelsError },
    { data: campaignRows, error: campaignsError },
  ] = await Promise.all([
    supabase.from("sales_channel_types").select("*").order("sort_order", { ascending: true }),
    supabase.from("sales_campaign_types").select("*").order("sort_order", { ascending: true }),
    supabase.from("sales_strategy_settings").select("*").maybeSingle(),
    supabase
      .from("sales_channels")
      .select("*, product:operation_products(id, name, unit, price), type:sales_channel_types(*)")
      .order("created_at", { ascending: true }),
    supabase
      .from("sales_campaigns")
      .select("*, type:sales_campaign_types(*)")
      .order("created_at", { ascending: true }),
  ]);

  if (channelTypesError) throwPlanningError(channelTypesError);
  if (campaignTypesError) throwPlanningError(campaignTypesError);
  if (settingsError) throwPlanningError(settingsError);
  if (channelsError) throwPlanningError(channelsError);
  if (campaignsError) throwPlanningError(campaignsError);

  const settings = settingsRows || {};
  const multiplierPeriod = normalizeMultiplierPeriod(settings.multiplier_period);

  return {
    campaignTypes: (campaignTypeRows || []).map(mapSalesType),
    channelTypes: (channelTypeRows || []).map(mapSalesType),
    company: {
      monthlyMultipliers: normalizeMonthlyMultipliers(settings.monthly_multipliers, multiplierPeriod),
      multiplierPeriod,
    },
    campaigns: (campaignRows || []).map((row) => ({
      budget: normalizeNumber(row.budget),
      channel: row.channel || "",
      durationDays: normalizeNumber(row.duration_days),
      goal: row.goal || "",
      id: row.id,
      name: row.name || "",
      type: row.type || null,
      typeId: row.type_id || row.type?.id || "",
    })),
    channels: (channelRows || []).map((row) => ({
      basketSize: normalizeOptionalNumber(row.basket_size),
      capacityLimit: normalizeOptionalNumber(row.capacity_limit),
      churnRatePercent: normalizeOptionalNumber(row.churn_rate_percent),
      commissionPercent: normalizeNumber(row.commission_percent),
      conversionRatePercent: normalizeOptionalNumber(row.conversion_rate_percent),
      customerAcquisitionCost: normalizeNumber(row.customer_acquisition_cost),
      collectionDays: normalizeNumber(row.collection_days, 30),
      discountRatePercent: normalizeOptionalNumber(row.discount_rate_percent),
      failureProbabilityPercent: normalizeOptionalNumber(row.failure_probability_percent),
      growthMonths1To6Percent: normalizeNumber(row.growth_months_1_6_percent),
      growthMonths7To18Percent: normalizeNumber(row.growth_months_7_18_percent),
      growthMonths19To24Percent: normalizeNumber(row.growth_months_19_24_percent),
      growthYears3To5Percent: normalizeNumber(row.growth_years_3_5_percent),
      id: row.id,
      launchFee: normalizeOptionalNumber(row.launch_fee),
      moqMonthly: normalizeOptionalNumber(row.moq_monthly),
      monthlySalesUnits: normalizeNumber(row.monthly_sales_units),
      name: row.name || "",
      product: row.product || null,
      productId: row.product_id || "",
      productName: row.product?.name || "",
      rampUpMonths: normalizeOptionalNumber(row.ramp_up_months),
      repeatRatePercent: normalizeOptionalNumber(row.repeat_rate_percent),
      returnRatePercent: normalizeOptionalNumber(row.return_rate_percent),
      seasonalityCurve: normalizeSeasonalityCurve(row.seasonality_curve),
      startMonth: normalizeNumber(row.start_month, 1) || 1,
      trafficScore: normalizeOptionalNumber(row.traffic_score),
      type: row.type || null,
      typeId: row.type_id || row.type?.id || "",
    })),
  };
}

export async function saveSalesStrategy(supabase, companyId, strategy) {
  const multiplierPeriod = normalizeMultiplierPeriod(strategy.company?.multiplierPeriod);
  const { data, error } = await supabase.rpc("save_sales_strategy", {
    p_input: {
      ...strategy,
      company: {
        ...(strategy.company || {}),
        monthlyMultipliers: normalizeMonthlyMultipliers(strategy.company?.monthlyMultipliers, multiplierPeriod),
        multiplierPeriod,
      },
    },
  });

  if (error) throwPlanningError(error);

  return data;
}

export async function loadSimulationVariants(supabase) {
  const { data, error } = await supabase
    .from("simulation_variants")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throwPlanningError(error);

  const variants = (data || []).map((row) => ({
    id: row.id,
    label: row.label || row.name || row.id,
    name: row.name || row.label || row.id,
    path: row.path || `/simulation/${row.id}`,
    parameters: {
      ...defaultSimulationParameters,
      ...(row.parameters || {}),
    },
  }));

  return variants.some((variant) => variant.id === emptySimulationVariant.id)
    ? variants
    : [emptySimulationVariant, ...variants];
}

export async function saveSimulationVariant(supabase, companyId, variant) {
  const { error } = await supabase.from("simulation_variants").upsert({
    company_id: companyId,
    id: variant.id,
    label: variant.label || variant.name || variant.id,
    name: variant.name || variant.label || variant.id,
    parameters: {
      ...defaultSimulationParameters,
      ...(variant.parameters || {}),
    },
    path: variant.path || `/simulation/${variant.id}`,
  }, { onConflict: "company_id,id" });

  if (error) throwPlanningError(error);
}

export async function deleteSimulationVariantRecord(supabase, companyId, id) {
  const { error } = await supabase
    .from("simulation_variants")
    .delete()
    .eq("company_id", companyId)
    .eq("id", id);
  if (error) throwPlanningError(error);
}
