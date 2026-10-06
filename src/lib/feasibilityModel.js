import { defaultFinancialSettings, emptyFinancialModel } from "./financialService.js";
import { getCurrentOperationPlans, hasViablePlanResult } from "./operationsCalculations.js";

function getDocumentLanguage() {
  return typeof document === "undefined" ? "en" : document.documentElement.lang;
}

export function normalizeCurrencyCode(value) {
  const currency = String(value || "TRY")
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "TRY";
}

export const defaultExchangeRates = {
  error: "",
  EUR: 0,
  source: "TCMB",
  sourceDetail: "",
  status: "idle",
  TRY: 1,
  USD: 0,
  updatedAt: null,
};

export function getCurrencyRateToTry(exchangeRates, currency = "TRY") {
  const currencyCode = normalizeCurrencyCode(currency);
  if (currencyCode === "TRY") return 1;
  if (!["USD", "EUR"].includes(currencyCode)) return 0;

  const rate = Number(exchangeRates?.[currencyCode]);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

export function convertMoneyToTry(value, currency = "TRY", exchangeRates = defaultExchangeRates) {
  return Math.max(0, toFiniteNumber(value)) * getCurrencyRateToTry(exchangeRates, currency);
}

export function hasUsableExchangeRates(exchangeRates) {
  return ["USD", "EUR"].every((currency) => getCurrencyRateToTry(exchangeRates, currency) > 0);
}

export function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function toOptionalFiniteNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function asObjectArray(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

export function getOptionalPositiveNumber(value) {
  const number = toOptionalFiniteNumber(value);
  return number === null || number <= 0 ? null : number;
}

export function getProjectionMonthCount(horizon) {
  if (horizon === "5y") return 60;
  if (horizon === "1y") return 12;
  return 6;
}

export function getTodayDateInputValue() {
  return formatDateInputValue(new Date());
}

export function parseDateInput(value) {
  if (!value) return null;

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateInputValue(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function getDateInputValue(value, fallback = getTodayDateInputValue()) {
  const date = parseDateInput(value) || parseDateInput(fallback) || new Date();
  return formatDateInputValue(date);
}

export function getMonthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthDifference(startDate, endDate) {
  return (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
}

export function getMonthlyLoanPayment(amount, annualInterestRate, termMonths) {
  const principal = Math.max(0, toFiniteNumber(amount));
  const term = Math.max(1, Math.round(toFiniteNumber(termMonths, 1)));
  const monthlyRate = Math.max(0, toFiniteNumber(annualInterestRate)) / 100 / 12;

  if (!principal) return 0;
  if (!monthlyRate) return principal / term;

  return (principal * (monthlyRate * (1 + monthlyRate) ** term)) / ((1 + monthlyRate) ** term - 1);
}

export function getMonthlyRateFromAnnualPercent(annualPercent) {
  const annualRate = Math.max(0, toFiniteNumber(annualPercent)) / 100;
  return (1 + annualRate) ** (1 / 12) - 1;
}

export function getIncreaseFrequencyMonths(frequency) {
  if (frequency === "monthly") return 1;
  if (frequency === "quarterly") return 3;
  if (frequency === "annual") return 12;
  return 6;
}

export function getPeriodicAnnualIncreaseMultiplier(annualPercent, monthIndex, frequency) {
  const annualRate = Math.max(0, toFiniteNumber(annualPercent)) / 100;
  if (!annualRate) return 1;

  const periodMonths = getIncreaseFrequencyMonths(frequency);
  const periodRate = (1 + annualRate) ** (periodMonths / 12) - 1;
  const elapsedPeriods = Math.floor(monthIndex / periodMonths);

  return (1 + periodRate) ** elapsedPeriods;
}

export function getFinancialLoanRows(settings = {}) {
  const sourceRows = Array.isArray(settings.loanRows) ? settings.loanRows : [];
  const rows = sourceRows.length
    ? sourceRows
    : toFiniteNumber(settings.loanAmount) > 0
      ? [
          {
            amount: settings.loanAmount,
            annualInterestRate: settings.annualInterestRate,
            gracePeriodMonths: settings.gracePeriodMonths,
            id: "legacy-loan",
            loanTermMonths: settings.loanTermMonths,
          },
        ]
      : [];

  return rows
    .map((row, index) => {
      const amount = Math.max(0, toFiniteNumber(row.amount));
      const annualInterestRate = Math.max(0, toFiniteNumber(row.annualInterestRate));
      const currency = normalizeCurrencyCode(row.currency);
      const loanTermMonths = Math.max(1, Math.round(toFiniteNumber(row.loanTermMonths, 24)));
      const gracePeriodMonths = Math.min(
        loanTermMonths - 1,
        Math.max(0, Math.round(toFiniteNumber(row.gracePeriodMonths))),
      );
      const name = String(row.name || `${getDocumentLanguage() === "tr" ? "Kredi" : "Loan"} ${index + 1}`).trim();
      const receivedDate = getDateInputValue(row.receivedDate || row.received_date);
      const receivedMonth = getMonthStart(parseDateInput(receivedDate) || new Date());
      const paymentStartMonth = addMonths(receivedMonth, gracePeriodMonths);
      const paymentEndMonth = addMonths(receivedMonth, loanTermMonths - 1);
      const monthlyRate = annualInterestRate / 100 / 12;
      const principalAfterGrace = monthlyRate ? amount * (1 + monthlyRate) ** gracePeriodMonths : amount;
      const repaymentTermMonths = Math.max(1, loanTermMonths - gracePeriodMonths);

      return {
        amount,
        annualInterestRate,
        currency,
        gracePeriodMonths,
        id: row.id || `loan-${index + 1}`,
        loanTermMonths,
        monthlyPayment: getMonthlyLoanPayment(principalAfterGrace, annualInterestRate, repaymentTermMonths),
        name,
        paymentEndDate: formatDateInputValue(paymentEndMonth),
        paymentStartDate: formatDateInputValue(paymentStartMonth),
        principalAfterGrace,
        receivedDate,
        repaymentTermMonths,
      };
    })
    .filter((row) => row.amount > 0);
}

export function getSalesExpectationMultipliers(salesStrategy) {
  const company = salesStrategy.company || {};
  const source = Array.isArray(company.monthlyMultipliers)
    ? company.monthlyMultipliers
    : Array.isArray(company.monthlyForecast)
      ? company.monthlyForecast
      : [];

  if (getSalesMultiplierPeriod(salesStrategy) === "quarterly") {
    const quarterlyMultipliers = getQuarterlySalesExpectationMultipliers(source);

    return Array.from({ length: 12 }, (_, index) => quarterlyMultipliers[Math.floor(index / 3)] ?? 1);
  }

  return Array.from({ length: 12 }, (_, index) => Math.max(0, toFiniteNumber(source[index], 1)));
}

export function getSalesMultiplierPeriod(salesStrategy) {
  return salesStrategy.company?.multiplierPeriod === "quarterly" ? "quarterly" : "monthly";
}

export function getQuarterlySalesExpectationMultipliers(source) {
  const rows = Array.isArray(source) ? source : [];

  if (rows.length === 4) {
    return Array.from({ length: 4 }, (_, index) => Math.max(0, toFiniteNumber(rows[index], 1)));
  }

  return Array.from({ length: 4 }, (_, quarterIndex) => {
    const quarterValues = Array.from({ length: 3 }, (_, offset) =>
      Math.max(0, toFiniteNumber(rows[quarterIndex * 3 + offset], 1)),
    );
    return quarterValues.reduce((total, value) => total + value, 0) / quarterValues.length;
  });
}

export function getSalesExpectationInputMultipliers(salesStrategy) {
  const company = salesStrategy.company || {};
  const source = Array.isArray(company.monthlyMultipliers)
    ? company.monthlyMultipliers
    : Array.isArray(company.monthlyForecast)
      ? company.monthlyForecast
      : [];

  return getSalesMultiplierPeriod(salesStrategy) === "quarterly"
    ? getQuarterlySalesExpectationMultipliers(source)
    : getSalesExpectationMultipliers(salesStrategy);
}

export function getSalesExpectationMultiplier(salesStrategy, monthIndex) {
  const multipliers = getSalesExpectationMultipliers(salesStrategy);
  return multipliers[monthIndex % multipliers.length] ?? 1;
}

export function getChannelGrowthRate(channel, elapsedMonthIndex) {
  if (elapsedMonthIndex < 6) return Math.max(0, toFiniteNumber(channel.growthMonths1To6Percent)) / 100;
  if (elapsedMonthIndex < 18) return Math.max(0, toFiniteNumber(channel.growthMonths7To18Percent)) / 100;
  if (elapsedMonthIndex < 24) return Math.max(0, toFiniteNumber(channel.growthMonths19To24Percent)) / 100;
  return Math.max(0, toFiniteNumber(channel.growthYears3To5Percent)) / 100;
}

export function getChannelGrowthMultiplier(channel, elapsedMonthIndex) {
  let multiplier = 1;

  for (let index = 1; index <= elapsedMonthIndex; index += 1) {
    multiplier *= 1 + getChannelGrowthRate(channel, index - 1);
  }

  return multiplier;
}

export function getChannelSeasonalityMultiplier(channel, monthIndex) {
  const curve = Array.isArray(channel.seasonalityCurve) ? channel.seasonalityCurve : [];
  const value = getOptionalPositiveNumber(curve[monthIndex % 12]);
  return value ?? 1;
}

export function getProjectedChannelSalesUnits(channel, monthIndex, salesStrategy) {
  const startMonth = Math.max(1, Math.round(toFiniteNumber(channel.startMonth, 1)));
  const monthNumber = monthIndex + 1;

  if (monthNumber < startMonth) return 0;

  const elapsedMonthIndex = monthNumber - startMonth;
  const expectationMultiplier = getSalesExpectationMultiplier(salesStrategy, monthIndex);
  const trafficScore = getOptionalPositiveNumber(channel.trafficScore) ?? 1;
  const rampUpMonths = getOptionalPositiveNumber(channel.rampUpMonths);
  const failureRate = Math.min(1, Math.max(0, toFiniteNumber(channel.failureProbabilityPercent)) / 100);
  const capacityLimit = getOptionalPositiveNumber(channel.capacityLimit);
  const moqMonthly = getOptionalPositiveNumber(channel.moqMonthly);
  let units =
    Math.max(0, toFiniteNumber(channel.monthlySalesUnits)) *
    getChannelGrowthMultiplier(channel, elapsedMonthIndex) *
    expectationMultiplier *
    getChannelSeasonalityMultiplier(channel, monthIndex) *
    trafficScore *
    (1 - failureRate);

  if (rampUpMonths) {
    units *= Math.min(1, (elapsedMonthIndex + 1) / rampUpMonths);
  }

  if (capacityLimit) {
    units = Math.min(units, capacityLimit);
  }

  if (moqMonthly && units > 0) {
    units = Math.max(units, moqMonthly);
  }

  return Math.max(0, units);
}

export function getBaseMonthlySalesUnits(salesStrategy) {
  const channels = Array.isArray(salesStrategy.channels) ? salesStrategy.channels : [];
  return channels.reduce((total, channel) => total + Math.max(0, toFiniteNumber(channel.monthlySalesUnits)), 0);
}

export function getSalesForecastForMonth(salesStrategy, monthIndex) {
  const channels = Array.isArray(salesStrategy.channels) ? salesStrategy.channels : [];
  return channels.reduce(
    (total, channel) => total + getProjectedChannelSalesUnits(channel, monthIndex, salesStrategy),
    0,
  );
}

export function getPlanProductId(plan) {
  return plan?.product_id || plan?.product?.id || plan?.input?.productId || "";
}

export function getMonthlyProductProductionMap(operationsWorkspace, workingDaysPerMonth = 22) {
  const plans = getCurrentOperationPlans(operationsWorkspace).filter((plan) => hasViablePlanResult(plan.result));
  const productionByProduct = new Map();

  plans.forEach((plan) => {
    const productId = getPlanProductId(plan);
    if (!productId) return;

    const monthlyProduced =
      Math.max(0, toFiniteNumber(plan.result?.producedQuantity)) * Math.max(1, toFiniteNumber(workingDaysPerMonth, 22));
    productionByProduct.set(productId, (productionByProduct.get(productId) || 0) + monthlyProduced);
  });

  return productionByProduct;
}

export function getOperationProductMap(operationsWorkspace) {
  return new Map((operationsWorkspace.products || []).map((product) => [product.id, product]));
}

export function calculateChannelMonth(
  monthIndex,
  salesStrategy,
  operationsWorkspace = {},
  workingDaysPerMonth = 22,
  settingsInput = {},
) {
  const channels = Array.isArray(salesStrategy.channels) ? salesStrategy.channels : [];
  const productionByProduct = getMonthlyProductProductionMap(operationsWorkspace, workingDaysPerMonth);
  const productMap = getOperationProductMap(operationsWorkspace);
  const priceIncreaseMultiplier = getPeriodicAnnualIncreaseMultiplier(
    settingsInput.priceIncreaseAnnualPercent,
    monthIndex,
    settingsInput.increaseFrequency,
  );

  const totals = channels.reduce(
    (currentTotals, channel) => {
      const productId = channel.productId || channel.product_id || "";
      const desiredUnits = getProjectedChannelSalesUnits(channel, monthIndex, salesStrategy);
      const availableUnits = productId ? Math.max(0, productionByProduct.get(productId) || 0) : 0;
      const channelUnits = Math.min(desiredUnits, availableUnits);
      const product = productMap.get(productId) || channel.product || {};
      const channelUnitPrice = getOptionalPositiveNumber(channel.unitSalesPrice);
      const price = Math.max(0, channelUnitPrice ?? toFiniteNumber(product.price)) * priceIncreaseMultiplier;
      const commissionRate = Math.max(0, toFiniteNumber(channel.commissionPercent)) / 100;
      const discountRate = Math.max(0, toFiniteNumber(channel.discountRatePercent)) / 100;
      const returnRate = Math.max(0, toFiniteNumber(channel.returnRatePercent)) / 100;
      const returnedUnits = channelUnits * returnRate;
      const netUnits = Math.max(0, channelUnits - returnedUnits);
      const launchFee =
        monthIndex + 1 === Math.max(1, Math.round(toFiniteNumber(channel.startMonth, 1)))
          ? Math.max(0, toFiniteNumber(channel.launchFee))
          : 0;
      const grossRevenue = netUnits * price * Math.max(0, 1 - discountRate);
      const acquisitionCost = netUnits * Math.max(0, toFiniteNumber(channel.customerAcquisitionCost));
      const commissionCost = grossRevenue * commissionRate;
      const channelCost = commissionCost + acquisitionCost + launchFee;
      const revenue = Math.max(0, grossRevenue - channelCost);
      const collectionDays =
        toOptionalFiniteNumber(channel.collectionDays) ?? toFiniteNumber(settingsInput.receivablesCollectionDays, 30);
      const delayMonths = Math.max(0, Math.ceil(collectionDays / 30));

      if (productId) {
        productionByProduct.set(productId, Math.max(0, availableUnits - channelUnits));
      }

      currentTotals.channels.push({
        delayMonths,
        desiredUnits,
        marginCost: channelCost,
        productId,
        revenue,
        returnedUnits,
        units: netUnits,
      });
      currentTotals.delayWeight += desiredUnits;
      currentTotals.discountCost += netUnits * price * discountRate;
      currentTotals.marginCost += channelCost;
      currentTotals.netSoldUnits += netUnits;
      currentTotals.forecastUnits += desiredUnits;
      currentTotals.revenue += revenue;
      currentTotals.returnedUnits += returnedUnits;
      currentTotals.weightedPaymentDelayDays += desiredUnits * collectionDays;

      return currentTotals;
    },
    {
      channels: [],
      delayWeight: 0,
      discountCost: 0,
      forecastUnits: 0,
      marginCost: 0,
      netSoldUnits: 0,
      returnedUnits: 0,
      revenue: 0,
      weightedPaymentDelayDays: 0,
    },
  );

  return {
    ...totals,
    weightedPaymentDelayDays: totals.delayWeight ? totals.weightedPaymentDelayDays / totals.delayWeight : 0,
  };
}

function buildIdMap(rows) {
  return new Map(asObjectArray(rows).map((row) => [row.id, row]));
}

// Daily cost of one saved process plan, priced with the current (TRY-converted)
// material, workforce and electricity records so price edits apply without
// re-saving the plan.
export function calculatePlanDailyCost(result = {}, operationsWorkspace = {}, settings = {}) {
  const materials = buildIdMap(operationsWorkspace.materials);
  const workforce = buildIdMap(operationsWorkspace.workforce);
  const producedQuantity = Math.max(0, toFiniteNumber(result?.producedQuantity));
  const electricityPrice = Math.max(0, toFiniteNumber(settings.electricityPricePerKwh));
  const missingMaterialPrices = [];
  const missingWorkforceRates = [];
  let foreignCurrencyMaterial = 0;

  const material = asObjectArray(result?.materialRows).reduce((total, row) => {
    const record = materials.get(row.materialId) || row.material || null;
    const price = Math.max(0, toFiniteNumber(record?.price_per_unit));
    const quantity = Math.max(0, toFiniteNumber(row.dailyQuantity));
    if (quantity > 0 && price <= 0) missingMaterialPrices.push(record?.name || row.name || row.materialId);
    if (normalizeCurrencyCode(record?.price_currency_original || record?.price_currency) !== "TRY") {
      foreignCurrencyMaterial += quantity * price;
    }
    return total + quantity * price;
  }, 0);

  const labor = asObjectArray(result?.workforceRows).reduce((total, row) => {
    const record = workforce.get(row.workforceId);
    const rate = Math.max(0, toFiniteNumber(record?.hourly_cost));
    const hours = Math.max(
      0,
      toFiniteNumber(row.hoursUsed, toFiniteNumber(row.peopleAssigned) * toFiniteNumber(row.dailyHours)),
    );
    if (hours > 0 && rate <= 0) missingWorkforceRates.push(record?.role_name || row.roleName || row.workforceId);
    return total + hours * rate;
  }, 0);

  const machineRows = asObjectArray(result?.machineRows);
  const energyKwh = machineRows.length
    ? machineRows.reduce((total, row) => total + Math.max(0, toFiniteNumber(row.energyConsumptionKwh)), 0)
    : Math.max(0, toFiniteNumber(result?.energyConsumptionKwh));
  const energy = energyKwh * electricityPrice;
  const perUnit = (value) => (producedQuantity > 0 ? value / producedQuantity : 0);

  return {
    daily: { energy, labor, material, total: material + labor + energy },
    energyKwh,
    foreignCurrencyMaterial,
    missingElectricityPrice: energyKwh > 0 && electricityPrice <= 0,
    missingMaterialPrices,
    missingWorkforceRates,
    producedQuantity,
    unit: {
      energy: perUnit(energy),
      labor: perUnit(labor),
      material: perUnit(material),
      total: perUnit(material + labor + energy),
    },
  };
}

export const DEFAULT_ASSET_USEFUL_LIFE_YEARS = 10;

const COST_COMPONENTS = ["material", "labor", "energy"];

// A saved plan's output is its target quantity, even when the schedule needs more
// time than the machines are available. Scale the output down to what fits.
export function getPlanDailyOutput(result = {}, operationsWorkspace = {}) {
  const target = Math.max(0, toFiniteNumber(result?.producedQuantity));
  const makespanMinutes = Math.max(0, toFiniteNumber(result?.totalProductionTimeMinutes));
  const machines = buildIdMap(operationsWorkspace.machines);
  const availabilityHours = asObjectArray(result?.machineRows)
    .map((row) =>
      toFiniteNumber(machines.get(row.machineId)?.availability_hours, toFiniteNumber(row.availabilityHours)),
    )
    .filter((hours) => hours > 0);

  if (!target || !makespanMinutes || !availabilityHours.length) {
    return { availableMinutes: null, limited: false, makespanMinutes, output: target, target };
  }

  const availableMinutes = Math.max(...availabilityHours) * 60;
  const ratio = Math.min(1, availableMinutes / makespanMinutes);

  return {
    availableMinutes,
    limited: ratio < 1,
    makespanMinutes,
    output: target * ratio,
    target,
  };
}

// Daily output and cost per product. Materials and energy scale with output;
// workforce hours are a fixed daily shift.
export function buildProductionCostProfile(activePlans = [], operationsWorkspace = {}, settings = {}) {
  const products = new Map();
  const warnings = {
    capacityLimitedPlans: [],
    missingElectricityPrice: false,
    missingMaterialPrices: new Set(),
    missingWorkforceRates: new Set(),
  };

  activePlans.forEach((plan) => {
    const cost = calculatePlanDailyCost(plan.result, operationsWorkspace, settings);
    const capacity = getPlanDailyOutput(plan.result, operationsWorkspace);
    const ratio = capacity.target ? capacity.output / capacity.target : 0;
    const productId = getPlanProductId(plan) || plan.id || "unknown";
    const current = products.get(productId) || {
      daily: { energy: 0, labor: 0, material: 0 },
      dailyOutput: 0,
      foreignCurrencyMaterial: 0,
      productId,
    };

    current.dailyOutput += capacity.output;
    current.foreignCurrencyMaterial += cost.foreignCurrencyMaterial * ratio;
    current.daily.material += cost.daily.material * ratio;
    current.daily.energy += cost.daily.energy * ratio;
    current.daily.labor += cost.daily.labor;
    products.set(productId, current);

    if (capacity.limited) {
      warnings.capacityLimitedPlans.push({
        output: capacity.output,
        planName: plan.plan_name || plan.result?.planName || plan.result?.productName || productId,
        target: capacity.target,
      });
    }
    cost.missingMaterialPrices.forEach((name) => warnings.missingMaterialPrices.add(name));
    cost.missingWorkforceRates.forEach((name) => warnings.missingWorkforceRates.add(name));
    warnings.missingElectricityPrice = warnings.missingElectricityPrice || cost.missingElectricityPrice;
  });

  const daily = { energy: 0, labor: 0, material: 0 };
  let dailyProduced = 0;

  products.forEach((product) => {
    product.foreignCurrencyMaterialShare =
      product.daily.material > 0 ? product.foreignCurrencyMaterial / product.daily.material : 0;
    product.unit = Object.fromEntries(
      COST_COMPONENTS.map((key) => [key, product.dailyOutput > 0 ? product.daily[key] / product.dailyOutput : 0]),
    );
    dailyProduced += product.dailyOutput;
    COST_COMPONENTS.forEach((key) => {
      daily[key] += product.daily[key];
    });
  });

  const perUnit = (value) => (dailyProduced > 0 ? value / dailyProduced : 0);

  return {
    daily,
    dailyProduced,
    products,
    unit: {
      energy: perUnit(daily.energy),
      labor: perUnit(daily.labor),
      material: perUnit(daily.material),
    },
    warnings: {
      capacityLimitedPlans: warnings.capacityLimitedPlans,
      missingElectricityPrice: warnings.missingElectricityPrice,
      missingMaterialPrices: Array.from(warnings.missingMaterialPrices),
      missingWorkforceRates: Array.from(warnings.missingWorkforceRates),
    },
  };
}

// Campaign budgets have no start date yet, so each one is spread evenly over its
// duration starting in the first projection month.
export function buildCampaignSpendSchedule(campaigns = [], monthCount = 0) {
  const schedule = Array.from({ length: Math.max(0, monthCount) }, () => 0);

  asObjectArray(campaigns).forEach((campaign) => {
    const budget = Math.max(0, toFiniteNumber(campaign.budget));
    if (!budget) return;
    const months = Math.max(1, Math.ceil(Math.max(0, toFiniteNumber(campaign.durationDays, 30)) / 30));
    for (let index = 0; index < months && index < schedule.length; index += 1) {
      schedule[index] += budget / months;
    }
  });

  return schedule;
}

function getCollectionDelayMonths(days) {
  return Math.max(0, Math.ceil(Math.max(0, toFiniteNumber(days)) / 30));
}

// Allocates the month's sellable stock to channels in their listed order.
// Multipliers for sensitivity runs; 1 = the user's plan.
function getSensitivity(settings = {}) {
  const sensitivity = settings.sensitivity || {};
  return {
    cost: Math.max(0, toFiniteNumber(sensitivity.cost, 1)),
    price: Math.max(0, toFiniteNumber(sensitivity.price, 1)),
    volume: Math.max(0, toFiniteNumber(sensitivity.volume, 1)),
  };
}

function allocateChannelSales(monthIndex, salesStrategy, productMap, stockUnits, settings) {
  const channels = Array.isArray(salesStrategy.channels) ? salesStrategy.channels : [];
  const sensitivity = getSensitivity(settings);
  const priceIncreaseMultiplier =
    getPeriodicAnnualIncreaseMultiplier(settings.priceIncreaseAnnualPercent, monthIndex, settings.increaseFrequency) *
    sensitivity.price;

  return channels.map((channel) => {
    const productId = channel.productId || channel.product_id || "";
    const desiredUnits = getProjectedChannelSalesUnits(channel, monthIndex, salesStrategy) * sensitivity.volume;
    const availableUnits = productId ? Math.max(0, stockUnits.get(productId) || 0) : 0;
    const shippedUnits = Math.min(desiredUnits, availableUnits);
    const product = productMap.get(productId) || channel.product || {};
    const channelUnitPrice = getOptionalPositiveNumber(channel.unitSalesPrice);
    const price = Math.max(0, channelUnitPrice ?? toFiniteNumber(product.price)) * priceIncreaseMultiplier;
    const discountRate = Math.min(1, Math.max(0, toFiniteNumber(channel.discountRatePercent)) / 100);
    const returnRate = Math.min(1, Math.max(0, toFiniteNumber(channel.returnRatePercent)) / 100);
    const returnedUnits = shippedUnits * returnRate;
    const netUnits = Math.max(0, shippedUnits - returnedUnits);
    const netSales = netUnits * price * (1 - discountRate);
    const launchFee =
      monthIndex + 1 === Math.max(1, Math.round(toFiniteNumber(channel.startMonth, 1)))
        ? Math.max(0, toFiniteNumber(channel.launchFee))
        : 0;
    const channelCost =
      (netSales * Math.max(0, toFiniteNumber(channel.commissionPercent))) / 100 +
      netUnits * Math.max(0, toFiniteNumber(channel.customerAcquisitionCost)) +
      launchFee;
    const collectionDays =
      toOptionalFiniteNumber(channel.collectionDays) ?? toFiniteNumber(settings.receivablesCollectionDays, 30);

    if (productId) {
      stockUnits.set(productId, Math.max(0, availableUnits - shippedUnits));
    }

    return {
      channelCost,
      collectionDays,
      delayMonths: getCollectionDelayMonths(collectionDays),
      desiredUnits,
      discountCost: netUnits * price * discountRate,
      netSales,
      netUnits,
      productId,
      returnedUnits,
      shippedUnits,
    };
  });
}

function getAverageUnitCost(stock) {
  if (!stock || stock.units <= 0) return { energy: 0, labor: 0, material: 0 };
  return Object.fromEntries(COST_COMPONENTS.map((key) => [key, stock.value[key] / stock.units]));
}

function removeFromStock(stock, units) {
  const average = getAverageUnitCost(stock);
  const removed = Math.min(stock.units, Math.max(0, units));
  const cost = Object.fromEntries(COST_COMPONENTS.map((key) => [key, average[key] * removed]));

  stock.units -= removed;
  COST_COMPONENTS.forEach((key) => {
    stock.value[key] = Math.max(0, stock.value[key] - cost[key]);
  });

  return cost;
}

const sumComponents = (cost) => COST_COMPONENTS.reduce((total, key) => total + cost[key], 0);

export const DEFAULT_DISCOUNT_RATE_ANNUAL_PERCENT = 30;

// Net present value of monthly cash flows; flows[0] happens today, flows[i]
// at the end of month i.
export function calculateNetPresentValue(flows = [], annualRatePercent = DEFAULT_DISCOUNT_RATE_ANNUAL_PERCENT) {
  const monthlyRate = getMonthlyRateFromAnnualPercent(annualRatePercent);
  return flows.reduce((total, flow, month) => total + toFiniteNumber(flow) / (1 + monthlyRate) ** month, 0);
}

// Annual internal rate of return in percent, or null when the flows never
// change sign (nothing invested, or never paid back).
export function calculateInternalRateOfReturn(flows = []) {
  const values = flows.map((flow) => toFiniteNumber(flow));
  if (!values.some((value) => value < 0) || !values.some((value) => value > 0)) return null;

  const npvAt = (monthlyRate) => values.reduce((total, value, month) => total + value / (1 + monthlyRate) ** month, 0);
  let low = -0.99;
  let high = 1;
  let npvLow = npvAt(low);
  let npvHigh = npvAt(high);
  while (Math.sign(npvLow) === Math.sign(npvHigh) && high < 100) {
    high *= 2;
    npvHigh = npvAt(high);
  }
  if (Math.sign(npvLow) === Math.sign(npvHigh)) return null;

  for (let step = 0; step < 200; step += 1) {
    const middle = (low + high) / 2;
    const npvMiddle = npvAt(middle);
    if (Math.abs(npvMiddle) < 1e-7 || high - low < 1e-12) {
      low = middle;
      high = middle;
      break;
    }
    if (Math.sign(npvMiddle) === Math.sign(npvLow)) {
      low = middle;
      npvLow = npvMiddle;
    } else {
      high = middle;
    }
  }

  return ((1 + (low + high) / 2) ** 12 - 1) * 100;
}

// Decision thresholds are a team decision (see the audit's open questions);
// keep them here so the dashboard, report and tests use the same values.
export const defaultDecisionThresholds = {
  maxPaybackMonths: 36,
};

// Turns the model summary into "feasible" / "wait" / "risky":
// - risky: the investment loses value (NPV < 0) or does not pay back in the horizon;
// - feasible: NPV ≥ 0, payback within the limit, cash never runs out and
//   capacity covers demand;
// - wait: it creates value, but one of the other checks fails.
export function evaluateFeasibilityDecision(summary = {}, thresholds = defaultDecisionThresholds) {
  const paybackMonth = summary.paybackMonth ?? null;
  const checks = [
    { key: "npv", ok: toFiniteNumber(summary.netPresentValue) >= 0 },
    { key: "payback", ok: paybackMonth !== null && paybackMonth <= thresholds.maxPaybackMonths },
    { key: "cash", ok: toFiniteNumber(summary.lowestCashBalance) >= 0 },
    // null means there is demand but no production capacity at all.
    { key: "capacity", ok: summary.capacityUtilization !== null && toFiniteNumber(summary.capacityUtilization) <= 1 },
  ];
  const failed = new Set(checks.filter((check) => !check.ok).map((check) => check.key));
  const status = failed.has("npv") || paybackMonth === null ? "risky" : failed.size ? "wait" : "feasible";

  return { checks, status, thresholds };
}

// Monthly three-statement projection. Prices and costs are VAT exclusive; VAT is
// collected and paid through cash and the balance sheet, never expensed.
export function buildFinancialFeasibilityModel(baseModel, salesStrategy, settingsInput, operationsWorkspace, horizon) {
  const settings = {
    ...defaultFinancialSettings,
    ...(baseModel.settings || {}),
    ...(settingsInput || {}),
  };
  const monthCount = getProjectionMonthCount(horizon);
  const activePlans = getCurrentOperationPlans(operationsWorkspace).filter((plan) => hasViablePlanResult(plan.result));
  const workingDaysPerMonth = Math.max(1, toFiniteNumber(settings.workingDaysPerMonth, 22));
  const investmentGrantAmount = Math.max(0, toFiniteNumber(settings.investmentGrantAmount));
  const initialCapacityUnits = Math.max(0, toFiniteNumber(settings.initialCapacityUnits));
  const initialCash = Math.max(0, toFiniteNumber(settings.initialCash));
  const usefulLifeYears = Math.max(1, toFiniteNumber(settings.assetUsefulLifeYears, DEFAULT_ASSET_USEFUL_LIFE_YEARS));
  const costProfile = buildProductionCostProfile(activePlans, operationsWorkspace, settings);
  const costSensitivity = getSensitivity(settings).cost;
  const dailyProduced = costProfile.dailyProduced;
  const unitMaterialCost = costProfile.unit.material * costSensitivity;
  const unitWorkforceCost = costProfile.unit.labor * costSensitivity;
  const unitElectricityCost = costProfile.unit.energy * costSensitivity;
  const unitProductionCost = unitMaterialCost + unitWorkforceCost + unitElectricityCost;
  const productMap = getOperationProductMap(operationsWorkspace);
  const machineRecords = buildIdMap(operationsWorkspace.machines);
  const uniqueMachines = new Map();

  activePlans.forEach((plan) => {
    (plan.result?.machineRows || []).forEach((row) => {
      if (row.machineId && !uniqueMachines.has(row.machineId)) {
        // Saved plan rows keep the machine price in its original currency; the
        // workspace record is already converted to TRY.
        const record = machineRecords.get(row.machineId);
        const price = record
          ? toFiniteNumber(record.price)
          : normalizeCurrencyCode(row.priceCurrency) === "TRY"
            ? toFiniteNumber(row.price)
            : 0;
        uniqueMachines.set(row.machineId, Math.max(0, price));
      }
    });
  });

  const machinePurchaseCost =
    Array.from(uniqueMachines.values()).reduce((total, price) => total + price, 0) ||
    toFiniteNumber(baseModel.summary?.machinePurchaseCost);
  const equipmentPurchaseCost = (operationsWorkspace.equipment || []).reduce(
    (total, equipment) =>
      total + Math.max(0, toFiniteNumber(equipment.price)) * Math.max(0, toFiniteNumber(equipment.quantity, 1)),
    0,
  );
  const capitalExpenditure = machinePurchaseCost + equipmentPurchaseCost;
  const monthlyDepreciation = capitalExpenditure / (usefulLifeYears * 12);
  const extraCosts = baseModel.extraCosts || [];
  const extraInitialCost = extraCosts.reduce(
    (total, cost) => total + (cost.costType === "initial" ? Math.max(0, toFiniteNumber(cost.amount)) : 0),
    0,
  );
  const extraRecurringCost = extraCosts.reduce(
    (total, cost) => total + (cost.costType === "recurring" ? Math.max(0, toFiniteNumber(cost.amount)) : 0),
    0,
  );
  const initialInvestment = capitalExpenditure + extraInitialCost;
  const projectionStartMonth = getMonthStart(new Date());
  const loanRows = getFinancialLoanRows(settings)
    .map((loan) => ({
      ...loan,
      amount: convertMoneyToTry(loan.amount, loan.currency, settings.exchangeRates),
      currency: "TRY",
      monthlyPayment: convertMoneyToTry(loan.monthlyPayment, loan.currency, settings.exchangeRates),
      originalAmount: loan.amount,
      originalCurrency: loan.currency,
      originalMonthlyPayment: loan.monthlyPayment,
    }))
    .map((loan) => {
      const receivedMonth = getMonthStart(parseDateInput(loan.receivedDate) || projectionStartMonth);
      const receivedMonthIndex = Math.max(0, getMonthDifference(projectionStartMonth, receivedMonth));

      return {
        ...loan,
        receivedMonthIndex,
      };
    });
  const loanAmount = loanRows.reduce((total, row) => total + row.amount, 0);
  const initialLoanFunding = loanRows.reduce(
    (total, row) => (row.receivedMonthIndex === 0 ? total + row.amount : total),
    0,
  );
  const monthlyLoanPayment = loanRows.reduce((total, row) => total + row.monthlyPayment, 0);
  const monthlyCurrencyIncreaseRate = Math.max(0, toFiniteNumber(settings.monthlyCurrencyIncreasePercent)) / 100;
  const monthlyEnergyPriceIncreaseRate = Math.max(0, toFiniteNumber(settings.monthlyEnergyPriceIncreasePercent)) / 100;
  const monthlyInflationRate = Math.max(0, toFiniteNumber(settings.monthlyInflationPercent)) / 100;
  const monthlyWageIncreaseRate = Math.max(0, toFiniteNumber(settings.monthlyWageIncreasePercent)) / 100;
  const monthlyCogsInflationRate = getMonthlyRateFromAnnualPercent(settings.cogsInflationAnnualPercent);
  const monthlyOpexInflationRate = getMonthlyRateFromAnnualPercent(settings.opexInflationAnnualPercent);
  const compoundMonthlyRate = (rate, monthIndex) => (1 + rate) ** monthIndex;
  const salesVatRate = Math.max(0, toFiniteNumber(settings.salesVatRate, settings.vatRate ?? 20)) / 100;
  const expenseVatRate = Math.max(0, toFiniteNumber(settings.expenseVatRate, settings.vatRate ?? 20)) / 100;
  const incomeTaxRate = Math.max(0, toFiniteNumber(settings.incomeTaxRate, 25)) / 100;
  const taxPaymentDelayMonths = Math.max(1, Math.round(toFiniteNumber(settings.taxPaymentDelayMonths, 3)));
  const supplierDelayMonths = getCollectionDelayMonths(settings.supplierPaymentDays);
  const rawMaterialBufferMonths =
    Math.max(0, toFiniteNumber(settings.rawMaterialBufferMonths, 1)) +
    Math.max(0, toFiniteNumber(settings.rawMaterialStockDays)) / 30;
  const rawMaterialBufferValue =
    costProfile.daily.material * costSensitivity * workingDaysPerMonth * rawMaterialBufferMonths;
  const minimumCashReserve =
    costProfile.daily.labor *
      costSensitivity *
      workingDaysPerMonth *
      Math.max(0, toFiniteNumber(settings.salaryBufferMonths, 1)) +
    extraRecurringCost * Math.max(0, toFiniteNumber(settings.rentBufferMonths, 1));
  const campaignSchedule = buildCampaignSpendSchedule(salesStrategy.campaigns, monthCount);
  const scheduleLength = monthCount + 36;
  const collections = Array.from({ length: scheduleLength }, () => 0);
  const supplierPayments = Array.from({ length: scheduleLength }, () => 0);
  const vatPayments = Array.from({ length: scheduleLength }, () => 0);
  const taxPayments = Array.from({ length: scheduleLength }, () => 0);
  const loanReceipts = Array.from({ length: scheduleLength }, () => 0);
  loanRows.forEach((loan) => {
    if (loan.receivedMonthIndex > 0 && loan.receivedMonthIndex < loanReceipts.length) {
      loanReceipts[loan.receivedMonthIndex] += loan.amount;
    }
  });
  const loanBalances = loanRows.map((row) => (row.receivedMonthIndex === 0 ? row.amount : 0));
  const stock = new Map(
    Array.from(costProfile.products.keys()).map((productId) => [
      productId,
      { units: 0, value: { energy: 0, labor: 0, material: 0 } },
    ]),
  );
  const paidInCapital = initialCash + investmentGrantAmount;
  let cashBalance = initialCash + initialLoanFunding + investmentGrantAmount - capitalExpenditure;
  let accumulatedDepreciation = 0;
  let retainedEarnings = 0;
  let vatCredit = 0;
  let taxPayable = 0;
  let taxLossCarryForward = 0;
  let yearToDateTaxableProfit = 0;
  let yearToDateTaxProvision = 0;
  let cumulativeNetIncome = 0;
  let cumulativeProjectCashFlow = -capitalExpenditure;
  // Project (unlevered) cash flows for NPV and IRR: machines today, then
  // monthly operating cash flow; loans are financing and stay out.
  const projectCashFlows = [-capitalExpenditure];
  let lowestCashBalance = cashBalance;
  let cashRunwayMonths = cashBalance < 0 ? 0 : monthCount;
  let breakEvenMonth = null;
  let paybackMonth = null;
  let peakWorkingCapital = 0;
  const rows = [];
  const totals = {
    cashFlow: 0,
    channelCost: 0,
    depreciation: 0,
    discountCost: 0,
    electricityCost: 0,
    expiredWriteOffCost: 0,
    expiredWriteOffUnits: 0,
    forecastSalesUnits: 0,
    incomeTax: 0,
    loanInterest: 0,
    loanPayment: 0,
    marketingCost: 0,
    materialCost: 0,
    netIncome: 0,
    netSoldUnits: 0,
    overheadCost: 0,
    producedUnits: 0,
    returnedUnits: 0,
    revenue: 0,
    totalCost: 0,
    vatPayable: 0,
    workforceCost: 0,
  };

  for (let index = 0; index < monthCount; index += 1) {
    // Each cost line grows with one rate: its own assumption when given,
    // otherwise general inflation. FX drift applies only to FX-priced materials.
    const localMaterialMultiplier = compoundMonthlyRate(monthlyCogsInflationRate || monthlyInflationRate, index);
    const foreignMaterialMultiplier = compoundMonthlyRate(monthlyCurrencyIncreaseRate, index);
    const multipliers = {
      energy: compoundMonthlyRate(monthlyEnergyPriceIncreaseRate || monthlyInflationRate, index),
      labor: compoundMonthlyRate(monthlyWageIncreaseRate || monthlyInflationRate, index),
    };
    const overheadMultiplier = compoundMonthlyRate(monthlyOpexInflationRate || monthlyInflationRate, index);
    const plannedUnits = dailyProduced * workingDaysPerMonth;
    const capacityScale =
      index === 0 && initialCapacityUnits > 0 && plannedUnits > initialCapacityUnits
        ? initialCapacityUnits / plannedUnits
        : 1;

    // 1. Production: costs go into finished-goods stock.
    const productionSpend = { energy: 0, labor: 0, material: 0 };
    let producedUnits = 0;
    costProfile.products.forEach((product, productId) => {
      const units = product.dailyOutput * workingDaysPerMonth * capacityScale;
      const productStock = stock.get(productId);
      producedUnits += units;
      productStock.units += units;
      const productMultipliers = {
        ...multipliers,
        material:
          (1 - product.foreignCurrencyMaterialShare) * localMaterialMultiplier +
          product.foreignCurrencyMaterialShare * foreignMaterialMultiplier,
      };
      COST_COMPONENTS.forEach((key) => {
        const amount = units * product.unit[key] * productMultipliers[key] * costSensitivity;
        productStock.value[key] += amount;
        productionSpend[key] += amount;
      });
    });

    // 2. Sales from stock.
    const stockUnits = new Map(Array.from(stock.entries()).map(([productId, item]) => [productId, item.units]));
    const channelResults = allocateChannelSales(index, salesStrategy, productMap, stockUnits, settings);
    const cogs = { energy: 0, labor: 0, material: 0 };
    let writeOffCost = 0;
    let netSales = 0;
    let channelCost = 0;
    let discountCost = 0;
    let netSoldUnits = 0;
    let returnedUnits = 0;
    let forecastUnits = 0;

    channelResults.forEach((channel) => {
      const productStock = stock.get(channel.productId);
      forecastUnits += channel.desiredUnits;
      netSales += channel.netSales;
      channelCost += channel.channelCost;
      discountCost += channel.discountCost;
      netSoldUnits += channel.netUnits;
      returnedUnits += channel.returnedUnits;

      if (productStock && channel.shippedUnits > 0) {
        const soldCost = removeFromStock(productStock, channel.netUnits);
        const returnedCost = removeFromStock(productStock, channel.returnedUnits);
        COST_COMPONENTS.forEach((key) => {
          cogs[key] += soldCost[key];
        });
        writeOffCost += sumComponents(returnedCost);
      }

      const receiptIndex = index + channel.delayMonths;
      if (receiptIndex < collections.length) {
        collections[receiptIndex] += channel.netSales * (1 + salesVatRate);
      }
    });

    // 3. Operating expenses.
    const overheadCost = extraRecurringCost * overheadMultiplier;
    const marketingCost = campaignSchedule[index] || 0;
    const initialExpense = index === 0 ? extraInitialCost : 0;
    const depreciation = Math.min(monthlyDepreciation, Math.max(0, capitalExpenditure - accumulatedDepreciation));
    accumulatedDepreciation += depreciation;
    const rawMaterialPurchase = index === 0 ? rawMaterialBufferValue : 0;

    // 4. Financing.
    const loanMonth = loanRows.reduce(
      (total, loan, loanIndex) => {
        const monthsSinceReceived = index - loan.receivedMonthIndex;
        if (monthsSinceReceived === 0 && loan.receivedMonthIndex > 0) {
          loanBalances[loanIndex] = loan.amount;
        }
        if (monthsSinceReceived < 0 || monthsSinceReceived >= loan.loanTermMonths) {
          return total;
        }

        const balance = loanBalances[loanIndex] || 0;
        const monthlyRate = loan.annualInterestRate / 100 / 12;
        const interest = balance * monthlyRate;
        const isGraceMonth = monthsSinceReceived < loan.gracePeriodMonths;
        const isLastMonth = monthsSinceReceived === loan.loanTermMonths - 1;
        const scheduledPayment = isLastMonth ? balance + interest : Math.min(loan.monthlyPayment, balance + interest);
        const payment = !isGraceMonth ? scheduledPayment : 0;
        const principal = Math.max(0, payment - interest);

        loanBalances[loanIndex] = isGraceMonth ? Math.max(0, balance + interest) : Math.max(0, balance - principal);

        return {
          interest: total.interest + interest,
          payment: total.payment + payment,
        };
      },
      { interest: 0, payment: 0 },
    );

    // 5. VAT: output minus input, credit carried forward, paid the next month.
    const vatableExpenses =
      productionSpend.material +
      productionSpend.energy +
      overheadCost +
      marketingCost +
      channelCost +
      initialExpense +
      rawMaterialPurchase;
    const outputVat = netSales * salesVatRate;
    const inputVat = vatableExpenses * expenseVatRate;
    const vatPosition = outputVat - inputVat - vatCredit;
    const vatPayable = Math.max(0, vatPosition);
    vatCredit = Math.max(0, -vatPosition);
    if (index + 1 < vatPayments.length) {
      vatPayments[index + 1] += vatPayable;
    }

    // 6. Income tax on the year's profit, after losses carried from earlier years.
    const costOfSales = sumComponents(cogs);
    const operatingExpenses = channelCost + marketingCost + overheadCost + initialExpense;
    const profitBeforeTax =
      netSales - costOfSales - writeOffCost - depreciation - operatingExpenses - loanMonth.interest;
    yearToDateTaxableProfit += profitBeforeTax;
    const yearToDateTaxDue = Math.max(0, yearToDateTaxableProfit - taxLossCarryForward) * incomeTaxRate;
    const incomeTax = yearToDateTaxDue - yearToDateTaxProvision;
    yearToDateTaxProvision = yearToDateTaxDue;
    taxPayable += incomeTax;
    const netIncome = profitBeforeTax - incomeTax;

    if ((index + 1) % 12 === 0) {
      if (yearToDateTaxableProfit < 0) {
        taxLossCarryForward += -yearToDateTaxableProfit;
      } else {
        taxLossCarryForward = Math.max(0, taxLossCarryForward - yearToDateTaxableProfit);
      }
      const paymentIndex = index + taxPaymentDelayMonths;
      if (paymentIndex < taxPayments.length) {
        taxPayments[paymentIndex] += yearToDateTaxProvision;
      }
      yearToDateTaxableProfit = 0;
      yearToDateTaxProvision = 0;
    }

    // 7. Cash.
    const materialPurchaseWithVat = productionSpend.material * (1 + expenseVatRate);
    if (index + supplierDelayMonths < supplierPayments.length) {
      supplierPayments[index + supplierDelayMonths] += materialPurchaseWithVat;
    }
    const supplierPayment = supplierPayments[index] || 0;
    const vatPayment = vatPayments[index] || 0;
    const taxPayment = taxPayments[index] || 0;
    taxPayable -= taxPayment;
    const collected = collections[index] || 0;
    const operatingCashOut =
      supplierPayment +
      productionSpend.labor +
      productionSpend.energy * (1 + expenseVatRate) +
      (overheadCost + marketingCost + channelCost + initialExpense + rawMaterialPurchase) * (1 + expenseVatRate) +
      vatPayment +
      taxPayment;
    const operatingCashFlow = collected - operatingCashOut;
    const cashIn = collected + (loanReceipts[index] || 0);
    const cashFlow = operatingCashFlow + (loanReceipts[index] || 0) - loanMonth.payment;

    cashBalance += cashFlow;
    cumulativeNetIncome += netIncome;
    cumulativeProjectCashFlow += operatingCashFlow;
    projectCashFlows.push(operatingCashFlow);
    lowestCashBalance = Math.min(lowestCashBalance, cashBalance);
    retainedEarnings += netIncome;

    if (cashBalance < 0 && cashRunwayMonths === monthCount) {
      cashRunwayMonths = index;
    }
    if (breakEvenMonth === null && cumulativeNetIncome >= 0) {
      breakEvenMonth = index + 1;
    }
    if (paybackMonth === null && cumulativeProjectCashFlow >= 0) {
      paybackMonth = index + 1;
    }

    // 8. Balance sheet at month end.
    const receivables = collections.slice(index + 1).reduce((total, value) => total + value, 0);
    const payables = supplierPayments.slice(index + 1).reduce((total, value) => total + value, 0);
    const vatDue = vatPayments.slice(index + 1).reduce((total, value) => total + value, 0);
    const finishedGoodsValue = Array.from(stock.values()).reduce((total, item) => total + sumComponents(item.value), 0);
    const inventoryValue = finishedGoodsValue + rawMaterialBufferValue;
    const inventoryUnits = Array.from(stock.values()).reduce((total, item) => total + item.units, 0);
    const fixedAssets = capitalExpenditure - accumulatedDepreciation;
    const loanBalance = loanBalances.reduce((total, value) => total + value, 0);
    const totalAssets = cashBalance + receivables + inventoryValue + vatCredit + fixedAssets;
    const equity = paidInCapital + retainedEarnings;
    const totalLiabilities = payables + vatDue + taxPayable + loanBalance;
    const workingCapital = receivables + inventoryValue + vatCredit - payables - vatDue - taxPayable;
    peakWorkingCapital = Math.max(peakWorkingCapital, workingCapital);
    const totalCost = costOfSales + writeOffCost + depreciation + operatingExpenses + loanMonth.interest + incomeTax;

    totals.cashFlow += cashFlow;
    totals.channelCost += channelCost;
    totals.depreciation += depreciation;
    totals.discountCost += discountCost;
    totals.electricityCost += cogs.energy;
    totals.expiredWriteOffCost += writeOffCost;
    totals.expiredWriteOffUnits += returnedUnits;
    totals.forecastSalesUnits += forecastUnits;
    totals.incomeTax += incomeTax;
    totals.loanInterest += loanMonth.interest;
    totals.loanPayment += loanMonth.payment;
    totals.marketingCost += marketingCost;
    totals.materialCost += cogs.material;
    totals.netIncome += netIncome;
    totals.netSoldUnits += netSoldUnits;
    totals.overheadCost += overheadCost + initialExpense;
    totals.producedUnits += producedUnits;
    totals.returnedUnits += returnedUnits;
    totals.revenue += netSales;
    totals.totalCost += totalCost;
    totals.vatPayable += vatPayable;
    totals.workforceCost += cogs.labor;

    rows.push({
      cashBalance,
      cashFlow,
      cashIn,
      channelCost,
      depreciation,
      electricityCost: cogs.energy,
      equity,
      fixedAssets,
      forecastUnits,
      incomeTax,
      initialExpense,
      inventoryUnits,
      inventoryValue,
      loanBalance,
      loanInterest: loanMonth.interest,
      loanPayment: loanMonth.payment,
      marketingCost,
      materialCost: cogs.material,
      netIncome,
      netSoldUnits,
      operatingCashFlow,
      otherProductionCost: depreciation,
      overheadCost: overheadCost + initialExpense,
      payables,
      period: index + 1,
      producedUnits,
      profitBeforeTax,
      receivables,
      salesRevenue: netSales,
      sellingCost: channelCost + marketingCost,
      taxPayable,
      totalAssets,
      totalCost,
      totalLiabilities,
      totalLiabilitiesAndEquity: totalLiabilities + equity,
      unsoldUnits: inventoryUnits,
      vatCredit,
      vatDue,
      vatPayable,
      workforceCost: cogs.labor,
      workingCapital,
      writeOffCost,
      writeOffUnits: returnedUnits,
    });
  }

  const lastRow = rows[rows.length - 1] || {};
  const firstMonth = rows[0] || {};
  const averageNetPrice = totals.netSoldUnits
    ? totals.revenue / totals.netSoldUnits
    : toFiniteNumber(operationsWorkspace.products?.[0]?.price);
  const contributionPerUnit = Math.max(0, averageNetPrice - unitProductionCost);
  const requiredMonthlySalesVolume = contributionPerUnit
    ? (extraRecurringCost + Math.min(monthlyLoanPayment, loanAmount || monthlyLoanPayment)) / contributionPerUnit
    : 0;
  // Own cash needed so that cash never drops below the salary and rent reserve.
  const lowestCashWithoutOwnCash = Math.min(
    initialLoanFunding + investmentGrantAmount - capitalExpenditure,
    ...rows.map((row) => row.cashBalance - initialCash),
  );
  const requiredOwnCash = Math.max(0, -lowestCashWithoutOwnCash) + minimumCashReserve;
  // At the horizon the business is still running: count the machines' book
  // value and the working capital tied up in it as recovered.
  const residualValue = toFiniteNumber(lastRow.fixedAssets) + toFiniteNumber(lastRow.workingCapital);
  const valuationFlows = projectCashFlows.map((flow, month) =>
    month === rows.length && month > 0 ? flow + residualValue : flow,
  );
  const discountRateAnnualPercent = Math.max(
    0,
    toFiniteNumber(settings.discountRateAnnualPercent, DEFAULT_DISCOUNT_RATE_ANNUAL_PERCENT),
  );
  const netPresentValue = calculateNetPresentValue(valuationFlows, discountRateAnnualPercent);
  const internalRateOfReturn = calculateInternalRateOfReturn(valuationFlows);
  const productionCapacityUnits = dailyProduced * workingDaysPerMonth * monthCount;
  const capacityUtilization =
    productionCapacityUnits > 0
      ? totals.forecastSalesUnits / productionCapacityUnits
      : totals.forecastSalesUnits > 0
        ? null
        : 0;
  const maxChartValue = Math.max(1, ...rows.map((row) => Math.max(row.salesRevenue, row.totalCost, row.netIncome, 0)));
  const getPath = (field) =>
    rows
      .map((row, index) => {
        const x = rows.length <= 1 ? 36 : 36 + index * (434 / (rows.length - 1));
        const y = 210 - (Math.max(0, row[field]) / maxChartValue) * 170;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

  return {
    ...baseModel,
    costStructure: [
      { amount: totals.materialCost, id: "materialCost", label: "Raw materials and packaging" },
      { amount: totals.workforceCost, id: "workforceCost", label: "Salaries and labor" },
      { amount: totals.electricityCost, id: "electricityCost", label: "Electricity" },
      { amount: totals.depreciation, id: "otherProductionCost", label: "Depreciation" },
      { amount: totals.expiredWriteOffCost, id: "writeOffCost", label: "Returns write-off" },
      { amount: totals.channelCost, id: "channelCost", label: "Channel commission and acquisition" },
      { amount: totals.overheadCost, id: "recurringExtraCost", label: "Overhead and start-up costs" },
      { amount: totals.marketingCost, id: "marketingCost", label: "Marketing campaigns" },
      { amount: totals.incomeTax, id: "incomeTax", label: "Income tax" },
      { amount: totals.loanInterest, id: "loanInterest", label: "Loan interest" },
    ],
    extraCosts,
    incomeRows: [
      { amount: totals.revenue, id: "salesRevenue", kind: "income", label: "Net sales" },
      { amount: investmentGrantAmount, id: "investmentGrant", kind: "income", label: "Investment grant / subsidy" },
      {
        amount: totals.materialCost,
        costType: "recurring",
        id: "materialCost",
        kind: "cost",
        label: "Raw materials and packaging",
      },
      {
        amount: totals.workforceCost,
        costType: "recurring",
        id: "workforceCost",
        kind: "cost",
        label: "Salaries and labor",
      },
      {
        amount: totals.electricityCost,
        costType: "recurring",
        id: "electricityCost",
        kind: "cost",
        label: "Electricity",
      },
      {
        amount: totals.depreciation,
        costType: "recurring",
        id: "otherProductionCost",
        kind: "cost",
        label: "Depreciation",
      },
      {
        amount: totals.expiredWriteOffCost,
        costType: "recurring",
        id: "writeOffCost",
        kind: "cost",
        label: "Returns write-off",
      },
      {
        amount: totals.channelCost,
        costType: "recurring",
        id: "channelCost",
        kind: "cost",
        label: "Channel commission and acquisition",
      },
      {
        amount: totals.marketingCost,
        costType: "recurring",
        id: "marketingCost",
        kind: "cost",
        label: "Marketing campaigns",
      },
      {
        amount: machinePurchaseCost,
        costType: "initial",
        id: "machinePurchase",
        kind: "cost",
        label: "Machine investment",
      },
      {
        amount: equipmentPurchaseCost,
        costType: "initial",
        id: "equipmentPurchase",
        kind: "cost",
        label: "Equipment investment",
      },
      {
        amount: extraInitialCost,
        costType: "initial",
        id: "extraInitialCost",
        kind: "cost",
        label: "Initial extra costs",
      },
      {
        amount: peakWorkingCapital,
        costType: "initial",
        id: "workingCapital",
        kind: "cost",
        label: "Peak working capital",
      },
      { amount: totals.incomeTax, costType: "recurring", id: "incomeTax", kind: "cost", label: "Income tax" },
      { amount: totals.loanInterest, costType: "recurring", id: "loanInterest", kind: "cost", label: "Loan interest" },
    ],
    settings,
    summary: {
      ...emptyFinancialModel.summary,
      ...baseModel.summary,
      assetUsefulLifeYears: usefulLifeYears,
      averageNetPrice,
      breakEvenMonth,
      capacityUtilization,
      cashRunwayMonths,
      channelCost: totals.channelCost,
      costWarnings: costProfile.warnings,
      dailyProduction: dailyProduced,
      depreciation: totals.depreciation,
      discountCost: totals.discountCost,
      discountRateAnnualPercent,
      electricityCost: totals.electricityCost,
      endingCash: toFiniteNumber(lastRow.cashBalance),
      endingInventoryUnits: toFiniteNumber(lastRow.inventoryUnits),
      equipmentPurchaseCost,
      expiredWriteOffCost: totals.expiredWriteOffCost,
      expiredWriteOffUnits: totals.expiredWriteOffUnits,
      extraInitialCost,
      extraRecurringCost: extraRecurringCost * monthCount,
      firstMonthCashBalance: firstMonth.cashBalance || 0,
      forecastSalesUnits: totals.forecastSalesUnits,
      incomeTax: totals.incomeTax,
      initialCash,
      initialCashRequired: requiredOwnCash,
      initialInvestment,
      internalRateOfReturn,
      investmentGrantAmount,
      loanAmount,
      loanInterest: totals.loanInterest,
      loanPayment: monthlyLoanPayment,
      loanPaymentTotal: totals.loanPayment,
      loanRows,
      lowestCashBalance,
      machinePurchaseCost,
      marketingCost: totals.marketingCost,
      materialCost: totals.materialCost,
      minimumCashReserve,
      netIncome: totals.netIncome,
      netPresentValue,
      netSoldUnits: totals.netSoldUnits,
      otherProductionCost: totals.depreciation,
      overheadCost: totals.overheadCost,
      paybackMonth,
      planCount: activePlans.length,
      productionCapacityUnits,
      requiredMonthlySalesVolume,
      residualValue,
      retailerMarginCost: totals.channelCost,
      returnedUnits: totals.returnedUnits,
      salesRevenue: totals.revenue,
      totalCashFlow: totals.cashFlow,
      totalCost: totals.totalCost,
      totalProduced: totals.producedUnits,
      unitElectricityCost,
      unitMaterialCost,
      unitProductionCost,
      unitWorkforceCost,
      unsoldInventoryUnits: toFiniteNumber(lastRow.inventoryUnits),
      vatPayable: totals.vatPayable,
      weightedPaymentDelayDays: calculateChannelMonth(
        0,
        salesStrategy,
        operationsWorkspace,
        workingDaysPerMonth,
        settings,
      ).weightedPaymentDelayDays,
      workingCapitalRequirement: peakWorkingCapital,
      workingDaysPerMonth,
    },
    trendChart: {
      costPath: getPath("totalCost"),
      labels: rows,
      netPath: getPath("netIncome"),
      salesPath: getPath("salesRevenue"),
    },
    trendRows: rows,
  };
}

export const sensitivityCases = [
  { change: -0.1, key: "price", lever: "price" },
  { change: 0.1, key: "price", lever: "price" },
  { change: -0.2, key: "volume", lever: "volume" },
  { change: 0.2, key: "volume", lever: "volume" },
  { change: 0.1, key: "cost", lever: "cost" },
  { change: -0.1, key: "cost", lever: "cost" },
];

// Re-runs the full 5-year model (tax, VAT, stock, loans) with one lever
// moved at a time: price ±10%, sales volume ±20%, unit production cost ±10%.
export function buildSensitivityTable(baseModel, salesStrategy, settingsInput, operationsWorkspace, horizon = "5y") {
  const run = (sensitivity) => {
    const { summary } = buildFinancialFeasibilityModel(
      baseModel,
      salesStrategy,
      { ...settingsInput, sensitivity },
      operationsWorkspace,
      horizon,
    );
    return {
      decision: evaluateFeasibilityDecision(summary).status,
      lowestCashBalance: summary.lowestCashBalance,
      netIncome: summary.netIncome,
      netPresentValue: summary.netPresentValue,
      paybackMonth: summary.paybackMonth,
    };
  };
  const base = run({});

  return [
    { change: 0, lever: "base", ...base },
    ...sensitivityCases.map((item) => {
      const result = run({ [item.lever]: 1 + item.change });
      return { ...item, ...result, netPresentValueChange: result.netPresentValue - base.netPresentValue };
    }),
  ];
}
