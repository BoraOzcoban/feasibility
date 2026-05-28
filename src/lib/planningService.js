export const emptySalesStrategy = {
  company: {
    annualSalesGrowthPercent: 0,
    baseSalesPrice: 0,
    marketShare: 0,
    monthlyForecast: Array.from({ length: 12 }, () => 0),
    monthlyTarget: 0,
    positioning: "",
    productName: "",
    reputationScore: 0,
    spoilageRate: 0,
    targetSegment: "",
  },
  campaigns: [],
  channels: [],
  competitors: [],
  personnel: [],
};

export const defaultSimulationParameters = {
  baseRevenue: 0,
  campaignLift: 0,
  competitorPressure: 0,
  costVolatility: 0,
  demandChange: 0,
  fixedCost: 0,
  grossMargin: 0,
  marketingBudget: 0,
  marketShare: 0,
  priceChange: 0,
  productionEfficiency: 0,
  reputationScore: 0,
  simulationCount: 0,
  timeHorizonMonths: 12,
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

function normalizeMonthlyForecast(value) {
  const rows = Array.isArray(value) ? value : [];
  return Array.from({ length: 12 }, (_, index) => normalizeNumber(rows[index]));
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
    { data: settingsRows, error: settingsError },
    { data: channelRows, error: channelsError },
    { data: campaignRows, error: campaignsError },
    { data: competitorRows, error: competitorsError },
    { data: personnelRows, error: personnelError },
  ] = await Promise.all([
    supabase.from("sales_strategy_settings").select("*").maybeSingle(),
    supabase.from("sales_channels").select("*").order("created_at", { ascending: true }),
    supabase.from("sales_campaigns").select("*").order("created_at", { ascending: true }),
    supabase.from("sales_competitors").select("*").order("created_at", { ascending: true }),
    supabase.from("sales_personnel").select("*").order("created_at", { ascending: true }),
  ]);

  if (settingsError) throwPlanningError(settingsError);
  if (channelsError) throwPlanningError(channelsError);
  if (campaignsError) throwPlanningError(campaignsError);
  if (competitorsError) throwPlanningError(competitorsError);
  if (personnelError) throwPlanningError(personnelError);

  const settings = settingsRows || {};

  return {
    company: {
      annualSalesGrowthPercent: normalizeNumber(settings.annual_sales_growth_percent),
      baseSalesPrice: normalizeNumber(settings.base_sales_price),
      marketShare: normalizeNumber(settings.market_share),
      monthlyForecast: normalizeMonthlyForecast(settings.monthly_forecast),
      monthlyTarget: normalizeNumber(settings.monthly_target),
      positioning: settings.positioning || "",
      productName: settings.product_name || "",
      reputationScore: normalizeNumber(settings.reputation_score),
      spoilageRate: normalizeNumber(settings.spoilage_rate),
      targetSegment: settings.target_segment || "",
    },
    campaigns: (campaignRows || []).map((row) => ({
      budget: normalizeNumber(row.budget),
      channel: row.channel || "",
      durationWeeks: normalizeNumber(row.duration_weeks),
      goal: row.goal || "",
      id: row.id,
      name: row.name || "",
      successScore: normalizeNumber(row.success_score),
      type: row.type || "",
    })),
    channels: (channelRows || []).map((row) => ({
      budget: normalizeNumber(row.budget),
      conversionRate: normalizeNumber(row.conversion_rate),
      discountPercent: normalizeNumber(row.discount_percent),
      id: row.id,
      marginPercent: normalizeNumber(row.margin_percent),
      name: row.name || "",
      note: row.note || "",
      paymentDelayDays: normalizeNumber(row.payment_delay_days),
      price: normalizeNumber(row.price),
      returnRatePercent: normalizeNumber(row.return_rate_percent),
      revenueShare: normalizeNumber(row.revenue_share),
      successScore: normalizeNumber(row.success_score),
      type: row.type || "",
    })),
    competitors: (competitorRows || []).map((row) => ({
      campaignType: row.campaign_type || "",
      id: row.id,
      marketShare: normalizeNumber(row.market_share),
      marketingBudget: normalizeNumber(row.marketing_budget),
      name: row.name || "",
      reputationScore: normalizeNumber(row.reputation_score),
      salesPrice: normalizeNumber(row.sales_price),
      strategy: row.strategy || "",
      threatScore: normalizeNumber(row.threat_score),
    })),
    personnel: (personnelRows || []).map((row) => ({
      assignedChannel: row.assigned_channel || "",
      id: row.id,
      monthlyTarget: normalizeNumber(row.monthly_target),
      name: row.name || "",
      pipelineValue: normalizeNumber(row.pipeline_value),
      role: row.role || "",
      successScore: normalizeNumber(row.success_score),
      winRate: normalizeNumber(row.win_rate),
    })),
  };
}

export async function saveSalesStrategy(supabase, companyId, strategy) {
  const company = strategy.company || emptySalesStrategy.company;
  const monthlyForecast = normalizeMonthlyForecast(company.monthlyForecast);

  const { error: settingsError } = await supabase.from("sales_strategy_settings").upsert({
    annual_sales_growth_percent: normalizeNumber(company.annualSalesGrowthPercent),
    base_sales_price: normalizeNumber(company.baseSalesPrice),
    company_id: companyId,
    market_share: normalizeNumber(company.marketShare),
    monthly_forecast: monthlyForecast,
    monthly_target: normalizeNumber(company.monthlyTarget),
    positioning: company.positioning || "",
    product_name: company.productName || "",
    reputation_score: normalizeNumber(company.reputationScore),
    spoilage_rate: normalizeNumber(company.spoilageRate),
    target_segment: company.targetSegment || "",
  }, { onConflict: "company_id" });

  if (settingsError) throwPlanningError(settingsError);

  const tables = ["sales_channels", "sales_campaigns", "sales_competitors", "sales_personnel"];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("company_id", companyId);
    if (error) throwPlanningError(error);
  }

  if (strategy.channels?.length) {
    const { error } = await supabase.from("sales_channels").insert(strategy.channels.map((channel) => ({
      budget: normalizeNumber(channel.budget),
      company_id: companyId,
      conversion_rate: normalizeNumber(channel.conversionRate),
      discount_percent: normalizeNumber(channel.discountPercent),
      id: channel.id,
      margin_percent: normalizeNumber(channel.marginPercent),
      name: channel.name || "",
      note: channel.note || "",
      payment_delay_days: normalizeNumber(channel.paymentDelayDays),
      price: normalizeNumber(channel.price),
      return_rate_percent: normalizeNumber(channel.returnRatePercent),
      revenue_share: normalizeNumber(channel.revenueShare),
      success_score: normalizeNumber(channel.successScore),
      type: channel.type || "",
    })));
    if (error) throwPlanningError(error);
  }

  if (strategy.campaigns?.length) {
    const { error } = await supabase.from("sales_campaigns").insert(strategy.campaigns.map((campaign) => ({
      budget: normalizeNumber(campaign.budget),
      channel: campaign.channel || "",
      company_id: companyId,
      duration_weeks: normalizeNumber(campaign.durationWeeks),
      goal: campaign.goal || "",
      id: campaign.id,
      name: campaign.name || "",
      success_score: normalizeNumber(campaign.successScore),
      type: campaign.type || "",
    })));
    if (error) throwPlanningError(error);
  }

  if (strategy.competitors?.length) {
    const { error } = await supabase.from("sales_competitors").insert(strategy.competitors.map((competitor) => ({
      campaign_type: competitor.campaignType || "",
      company_id: companyId,
      id: competitor.id,
      market_share: normalizeNumber(competitor.marketShare),
      marketing_budget: normalizeNumber(competitor.marketingBudget),
      name: competitor.name || "",
      reputation_score: normalizeNumber(competitor.reputationScore),
      sales_price: normalizeNumber(competitor.salesPrice),
      strategy: competitor.strategy || "",
      threat_score: normalizeNumber(competitor.threatScore),
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
      pipeline_value: normalizeNumber(person.pipelineValue),
      role: person.role || "",
      success_score: normalizeNumber(person.successScore),
      win_rate: normalizeNumber(person.winRate),
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
