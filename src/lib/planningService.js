export const emptySalesStrategy = {
  campaignTypes: [],
  channelTypes: [],
  company: {
    monthlyMultipliers: Array.from({ length: 12 }, () => 1),
  },
  campaigns: [],
  channels: [],
  personnel: [],
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

function nullableNumber(value) {
  const normalized = normalizeOptionalNumber(value);
  return normalized === "" ? null : normalized;
}

function normalizeMonthlyMultipliers(value) {
  const rows = Array.isArray(value) ? value : [];
  return Array.from({ length: 12 }, (_, index) => normalizeNumber(rows[index], 1));
}

function normalizeSeasonalityCurve(value) {
  const rows = Array.isArray(value) ? value : [];
  return Array.from({ length: 12 }, (_, index) => normalizeOptionalNumber(rows[index]));
}

function nullableSeasonalityCurve(value) {
  const curve = normalizeSeasonalityCurve(value).map(nullableNumber);
  return curve.some((item) => item !== null) ? curve : null;
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

function getSalesTypeId(value, fallback) {
  if (typeof value === "string" && value) return value;
  if (value?.id) return value.id;
  return fallback;
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
    { data: personnelRows, error: personnelError },
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
    supabase.from("sales_personnel").select("*").order("created_at", { ascending: true }),
  ]);

  if (channelTypesError) throwPlanningError(channelTypesError);
  if (campaignTypesError) throwPlanningError(campaignTypesError);
  if (settingsError) throwPlanningError(settingsError);
  if (channelsError) throwPlanningError(channelsError);
  if (campaignsError) throwPlanningError(campaignsError);
  if (personnelError) throwPlanningError(personnelError);

  const settings = settingsRows || {};

  return {
    campaignTypes: (campaignTypeRows || []).map(mapSalesType),
    channelTypes: (channelTypeRows || []).map(mapSalesType),
    company: {
      monthlyMultipliers: normalizeMonthlyMultipliers(settings.monthly_multipliers),
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
    personnel: (personnelRows || []).map((row) => ({
      assignedChannel: row.assigned_channel || "",
      id: row.id,
      monthlyTarget: normalizeNumber(row.monthly_target),
      name: row.name || "",
      realizedSalesUnits: normalizeNumber(row.realized_sales_units),
      role: row.role || "",
    })),
  };
}

export async function saveSalesStrategy(supabase, companyId, strategy) {
  const company = strategy.company || emptySalesStrategy.company;
  const monthlyMultipliers = normalizeMonthlyMultipliers(company.monthlyMultipliers);

  const { error: settingsError } = await supabase.from("sales_strategy_settings").upsert({
    company_id: companyId,
    monthly_multipliers: monthlyMultipliers,
  }, { onConflict: "company_id" });

  if (settingsError) throwPlanningError(settingsError);

  const tables = ["sales_channels", "sales_campaigns", "sales_personnel"];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("company_id", companyId);
    if (error) throwPlanningError(error);
  }

  if (strategy.channels?.length) {
    const { error } = await supabase.from("sales_channels").insert(strategy.channels.map((channel) => ({
      basket_size: nullableNumber(channel.basketSize),
      capacity_limit: nullableNumber(channel.capacityLimit),
      churn_rate_percent: nullableNumber(channel.churnRatePercent),
      company_id: companyId,
      commission_percent: normalizeNumber(channel.commissionPercent),
      conversion_rate_percent: nullableNumber(channel.conversionRatePercent),
      customer_acquisition_cost: normalizeNumber(channel.customerAcquisitionCost),
      collection_days: normalizeNumber(channel.collectionDays, 30),
      discount_rate_percent: nullableNumber(channel.discountRatePercent),
      failure_probability_percent: nullableNumber(channel.failureProbabilityPercent),
      growth_months_1_6_percent: normalizeNumber(channel.growthMonths1To6Percent),
      growth_months_7_18_percent: normalizeNumber(channel.growthMonths7To18Percent),
      growth_months_19_24_percent: normalizeNumber(channel.growthMonths19To24Percent),
      growth_years_3_5_percent: normalizeNumber(channel.growthYears3To5Percent),
      id: channel.id,
      launch_fee: nullableNumber(channel.launchFee),
      moq_monthly: nullableNumber(channel.moqMonthly),
      monthly_sales_units: normalizeNumber(channel.monthlySalesUnits),
      name: channel.name || "",
      product_id: channel.productId || null,
      ramp_up_months: nullableNumber(channel.rampUpMonths),
      repeat_rate_percent: nullableNumber(channel.repeatRatePercent),
      return_rate_percent: nullableNumber(channel.returnRatePercent),
      seasonality_curve: nullableSeasonalityCurve(channel.seasonalityCurve),
      start_month: Math.max(1, Math.round(normalizeNumber(channel.startMonth, 1))),
      traffic_score: nullableNumber(channel.trafficScore),
      type_id: getSalesTypeId(channel.typeId || channel.type, "direct"),
    })));
    if (error) throwPlanningError(error);
  }

  if (strategy.campaigns?.length) {
    const { error } = await supabase.from("sales_campaigns").insert(strategy.campaigns.map((campaign) => ({
      budget: normalizeNumber(campaign.budget),
      channel: campaign.channel || "",
      company_id: companyId,
      duration_days: normalizeNumber(campaign.durationDays),
      goal: campaign.goal || "",
      id: campaign.id,
      name: campaign.name || "",
      type_id: getSalesTypeId(campaign.typeId || campaign.type, "digital"),
    })));
    if (error) throwPlanningError(error);
  }

  if (strategy.personnel?.length) {
    const { error } = await supabase.from("sales_personnel").insert(strategy.personnel.map((person) => ({
      assigned_channel: person.assignedChannel || "",
      company_id: companyId,
      id: person.id,
      monthly_target: normalizeNumber(person.monthlyTarget),
      name: person.name || "",
      realized_sales_units: normalizeNumber(person.realizedSalesUnits),
      role: person.role || "",
    })));
    if (error) throwPlanningError(error);
  }
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
