import { defaultFinancialSettings, emptyFinancialModel } from "./financialService.js";
import { getCurrentOperationPlans, hasViablePlanResult } from "./operationsCalculations.js";

function getDocumentLanguage() {
  return typeof document === "undefined" ? "en" : document.documentElement.lang;
}

export function normalizeCurrencyCode(value) {
  const currency = String(value || "TRY").trim().toUpperCase();
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
  return ((endDate.getFullYear() - startDate.getFullYear()) * 12) + (endDate.getMonth() - startDate.getMonth());
}

export function getMonthlyLoanPayment(amount, annualInterestRate, termMonths) {
  const principal = Math.max(0, toFiniteNumber(amount));
  const term = Math.max(1, Math.round(toFiniteNumber(termMonths, 1)));
  const monthlyRate = Math.max(0, toFiniteNumber(annualInterestRate)) / 100 / 12;

  if (!principal) return 0;
  if (!monthlyRate) return principal / term;

  return principal * (monthlyRate * ((1 + monthlyRate) ** term)) / (((1 + monthlyRate) ** term) - 1);
}

export function getMonthlyRateFromAnnualPercent(annualPercent) {
  const annualRate = Math.max(0, toFiniteNumber(annualPercent)) / 100;
  return ((1 + annualRate) ** (1 / 12)) - 1;
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
  const periodRate = ((1 + annualRate) ** (periodMonths / 12)) - 1;
  const elapsedPeriods = Math.floor(monthIndex / periodMonths);

  return (1 + periodRate) ** elapsedPeriods;
}

export function getFinancialLoanRows(settings = {}) {
  const sourceRows = Array.isArray(settings.loanRows) ? settings.loanRows : [];
  const rows = sourceRows.length
    ? sourceRows
    : (toFiniteNumber(settings.loanAmount) > 0
        ? [{
            amount: settings.loanAmount,
            annualInterestRate: settings.annualInterestRate,
            gracePeriodMonths: settings.gracePeriodMonths,
            id: "legacy-loan",
            loanTermMonths: settings.loanTermMonths,
          }]
        : []);

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
      const principalAfterGrace = monthlyRate ? amount * ((1 + monthlyRate) ** gracePeriodMonths) : amount;
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
    : (Array.isArray(company.monthlyForecast) ? company.monthlyForecast : []);

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
    const quarterValues = Array.from({ length: 3 }, (_, offset) => Math.max(0, toFiniteNumber(rows[(quarterIndex * 3) + offset], 1)));
    return quarterValues.reduce((total, value) => total + value, 0) / quarterValues.length;
  });
}

export function getSalesExpectationInputMultipliers(salesStrategy) {
  const company = salesStrategy.company || {};
  const source = Array.isArray(company.monthlyMultipliers)
    ? company.monthlyMultipliers
    : (Array.isArray(company.monthlyForecast) ? company.monthlyForecast : []);

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
  let units = Math.max(0, toFiniteNumber(channel.monthlySalesUnits)) *
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
  return channels.reduce((total, channel) => total + getProjectedChannelSalesUnits(channel, monthIndex, salesStrategy), 0);
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

    const monthlyProduced = Math.max(0, toFiniteNumber(plan.result?.producedQuantity)) * Math.max(1, toFiniteNumber(workingDaysPerMonth, 22));
    productionByProduct.set(productId, (productionByProduct.get(productId) || 0) + monthlyProduced);
  });

  return productionByProduct;
}

export function getOperationProductMap(operationsWorkspace) {
  return new Map((operationsWorkspace.products || []).map((product) => [product.id, product]));
}

export function calculateChannelMonth(monthIndex, salesStrategy, operationsWorkspace = {}, workingDaysPerMonth = 22, settingsInput = {}) {
  const channels = Array.isArray(salesStrategy.channels) ? salesStrategy.channels : [];
  const productionByProduct = getMonthlyProductProductionMap(operationsWorkspace, workingDaysPerMonth);
  const productMap = getOperationProductMap(operationsWorkspace);
  const priceIncreaseMultiplier = getPeriodicAnnualIncreaseMultiplier(settingsInput.priceIncreaseAnnualPercent, monthIndex, settingsInput.increaseFrequency);

  const totals = channels.reduce((currentTotals, channel) => {
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
    const launchFee = monthIndex + 1 === Math.max(1, Math.round(toFiniteNumber(channel.startMonth, 1)))
      ? Math.max(0, toFiniteNumber(channel.launchFee))
      : 0;
    const grossRevenue = netUnits * price * Math.max(0, 1 - discountRate);
    const acquisitionCost = netUnits * Math.max(0, toFiniteNumber(channel.customerAcquisitionCost));
    const commissionCost = grossRevenue * commissionRate;
    const channelCost = commissionCost + acquisitionCost + launchFee;
    const revenue = Math.max(0, grossRevenue - channelCost);
    const collectionDays = toOptionalFiniteNumber(channel.collectionDays) ?? toFiniteNumber(settingsInput.receivablesCollectionDays, 30);
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
  }, {
    channels: [],
    delayWeight: 0,
    discountCost: 0,
    forecastUnits: 0,
    marginCost: 0,
    netSoldUnits: 0,
    returnedUnits: 0,
    revenue: 0,
    weightedPaymentDelayDays: 0,
  });

  return {
    ...totals,
    weightedPaymentDelayDays: totals.delayWeight ? totals.weightedPaymentDelayDays / totals.delayWeight : 0,
  };
}

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
  const dailyProduced = activePlans.reduce((total, plan) => total + Math.max(0, toFiniteNumber(plan.result?.producedQuantity)), 0);
  const operationCostResult = settings.operationCostResult || null;
  const eurToTry =
    getCurrencyRateToTry(settings.exchangeRates, "EUR") ||
    Math.max(0, toFiniteNumber(operationCostResult?.assumptions?.common?.tryPerEur));
  const costBreakdownEur = operationCostResult?.breakdown || {};
  const unitMaterialCost = operationCostResult
    ? (toFiniteNumber(costBreakdownEur.material) + toFiniteNumber(costBreakdownEur.consumables)) * eurToTry
    : 0;
  const unitWorkforceCost = operationCostResult
    ? toFiniteNumber(costBreakdownEur.labor) * eurToTry
    : 0;
  const unitElectricityCost = operationCostResult
    ? toFiniteNumber(costBreakdownEur.electricity) * eurToTry
    : 0;
  const unitOtherProductionCost = operationCostResult
    ? (
        toFiniteNumber(costBreakdownEur.depreciation) +
        toFiniteNumber(costBreakdownEur.maintenance) +
        toFiniteNumber(costBreakdownEur.mold)
      ) * eurToTry
    : 0;
  const unitProductionCost = operationCostResult
    ? toFiniteNumber(operationCostResult.totalUnitCostEur) * eurToTry
    : 0;
  const dailyMaterialCost = dailyProduced * unitMaterialCost;
  const dailyWorkforceCost = dailyProduced * unitWorkforceCost;
  const dailyElectricityCost = dailyProduced * unitElectricityCost;
  const uniqueMachines = new Map();

  activePlans.forEach((plan) => {
    (plan.result?.machineRows || []).forEach((row) => {
      if (row.machineId && !uniqueMachines.has(row.machineId)) {
        uniqueMachines.set(row.machineId, Math.max(0, toFiniteNumber(row.price)));
      }
    });
  });

  const machinePurchaseCost = Array.from(uniqueMachines.values()).reduce((total, price) => total + price, 0) || toFiniteNumber(baseModel.summary?.machinePurchaseCost);
  const equipmentPurchaseCost = (operationsWorkspace.equipment || []).reduce(
    (total, equipment) => total + (Math.max(0, toFiniteNumber(equipment.price)) * Math.max(0, toFiniteNumber(equipment.quantity, 1))),
    0,
  );
  const extraCosts = baseModel.extraCosts || [];
  const extraInitialCost = extraCosts.reduce((total, cost) => total + (cost.costType === "initial" ? Math.max(0, toFiniteNumber(cost.amount)) : 0), 0);
  const extraRecurringCost = extraCosts.reduce((total, cost) => total + (cost.costType === "recurring" ? Math.max(0, toFiniteNumber(cost.amount)) : 0), 0);
  const monthlyMaterialCost = dailyMaterialCost * workingDaysPerMonth;
  const monthlyWorkforceCost = dailyWorkforceCost * workingDaysPerMonth;
  const projectionStartMonth = getMonthStart(new Date());
  const loanRows = getFinancialLoanRows(settings).map((loan) => ({
    ...loan,
    amount: convertMoneyToTry(loan.amount, loan.currency, settings.exchangeRates),
    currency: "TRY",
    monthlyPayment: convertMoneyToTry(loan.monthlyPayment, loan.currency, settings.exchangeRates),
    originalAmount: loan.amount,
    originalCurrency: loan.currency,
    originalMonthlyPayment: loan.monthlyPayment,
  })).map((loan) => {
    const receivedMonth = getMonthStart(parseDateInput(loan.receivedDate) || projectionStartMonth);
    const receivedMonthIndex = Math.max(0, getMonthDifference(projectionStartMonth, receivedMonth));

    return {
      ...loan,
      receivedMonthIndex,
    };
  });
  const loanAmount = loanRows.reduce((total, row) => total + row.amount, 0);
  const initialLoanFunding = loanRows.reduce((total, row) => (row.receivedMonthIndex === 0 ? total + row.amount : total), 0);
  const monthlyLoanPayment = loanRows.reduce((total, row) => total + row.monthlyPayment, 0);
  const monthlyCurrencyIncreaseRate = Math.max(0, toFiniteNumber(settings.monthlyCurrencyIncreasePercent)) / 100;
  const monthlyEnergyPriceIncreaseRate = Math.max(0, toFiniteNumber(settings.monthlyEnergyPriceIncreasePercent)) / 100;
  const monthlyInflationRate = Math.max(0, toFiniteNumber(settings.monthlyInflationPercent)) / 100;
  const monthlyWageIncreaseRate = Math.max(0, toFiniteNumber(settings.monthlyWageIncreasePercent)) / 100;
  const monthlyCogsInflationRate = getMonthlyRateFromAnnualPercent(settings.cogsInflationAnnualPercent);
  const monthlyOpexInflationRate = getMonthlyRateFromAnnualPercent(settings.opexInflationAnnualPercent);
  const compoundMonthlyRate = (rate, monthIndex) => ((1 + rate) ** monthIndex);
  const salesVatRate = Math.max(0, toFiniteNumber(settings.salesVatRate, settings.vatRate ?? 20)) / 100;
  const expenseVatRate = Math.max(0, toFiniteNumber(settings.expenseVatRate, settings.vatRate ?? 20)) / 100;
  const incomeTaxRate = Math.max(0, toFiniteNumber(settings.incomeTaxRate, 25)) / 100;
  const taxPaymentDelayMonths = Math.max(0, Math.round(toFiniteNumber(settings.taxPaymentDelayMonths, 0)));
  const initialCash = Math.max(0, toFiniteNumber(settings.initialCash));
  const initialInvestment = machinePurchaseCost + equipmentPurchaseCost + extraInitialCost;
  const receivablesWorkingCapital = Math.max(0, calculateChannelMonth(0, salesStrategy, operationsWorkspace, workingDaysPerMonth, settings).revenue) *
    (Math.max(0, toFiniteNumber(settings.receivablesCollectionDays, 30)) / 30);
  const materialStockMonths = Math.max(0, toFiniteNumber(settings.rawMaterialStockDays)) / 30;
  const supplierCreditMonths = Math.max(0, toFiniteNumber(settings.supplierPaymentDays)) / 30;
  const materialWorkingCapital = monthlyMaterialCost * Math.max(0, Math.max(0, toFiniteNumber(settings.rawMaterialBufferMonths, 1)) + materialStockMonths - supplierCreditMonths);
  const adjustedWorkingCapitalRequirement =
    materialWorkingCapital +
    receivablesWorkingCapital +
    (monthlyWorkforceCost * Math.max(0, toFiniteNumber(settings.salaryBufferMonths, 1))) +
    (extraRecurringCost * Math.max(0, toFiniteNumber(settings.rentBufferMonths, 1)));
  const workingCapitalRequirement = adjustedWorkingCapitalRequirement;
  const requiredOwnCash = Math.max(0, initialInvestment + adjustedWorkingCapitalRequirement - initialLoanFunding - investmentGrantAmount);
  const cashReceipts = Array.from({ length: monthCount + 24 }, () => 0);
  const loanReceipts = Array.from({ length: monthCount + 24 }, () => 0);
  loanRows.forEach((loan) => {
    if (loan.receivedMonthIndex > 0 && loan.receivedMonthIndex < loanReceipts.length) {
      loanReceipts[loan.receivedMonthIndex] += loan.amount;
    }
  });
  const taxPayments = Array.from({ length: monthCount + taxPaymentDelayMonths + 24 }, () => 0);
  const rows = [];
  const loanBalances = loanRows.map((row) => row.amount);
  let cashBalance = initialCash + initialLoanFunding + investmentGrantAmount - initialInvestment - adjustedWorkingCapitalRequirement;
  let cumulativePayback = -initialInvestment - adjustedWorkingCapitalRequirement + initialLoanFunding + investmentGrantAmount;
  let cashRunwayMonths = cashBalance < 0 ? 0 : monthCount;
  let breakEvenMonth = null;
  let paybackMonth = null;
  const totals = {
    cashFlow: 0,
    discountCost: 0,
    electricityCost: 0,
    expiredWriteOffCost: 0,
    expiredWriteOffUnits: 0,
    forecastSalesUnits: 0,
    incomeTax: 0,
    loanInterest: 0,
    loanPayment: 0,
    materialCost: 0,
    netIncome: 0,
    otherProductionCost: 0,
    netSoldUnits: 0,
    producedUnits: 0,
    retailerMarginCost: 0,
    returnedUnits: 0,
    revenue: 0,
    totalCost: 0,
    unsoldInventoryUnits: 0,
    vatPayable: 0,
    workforceCost: 0,
  };

  for (let index = 0; index < monthCount; index += 1) {
    const cogsCostMultiplier = compoundMonthlyRate(monthlyCogsInflationRate, index);
    const opexCostMultiplier = compoundMonthlyRate(monthlyOpexInflationRate, index);
    const materialCostMultiplier = compoundMonthlyRate(monthlyCurrencyIncreaseRate, index) * compoundMonthlyRate(monthlyInflationRate, index) * cogsCostMultiplier;
    const workforceCostMultiplier = compoundMonthlyRate(monthlyWageIncreaseRate || monthlyInflationRate, index);
    const electricityCostMultiplier = compoundMonthlyRate(monthlyEnergyPriceIncreaseRate || monthlyInflationRate, index) * cogsCostMultiplier;
    const overheadCostMultiplier = compoundMonthlyRate(monthlyInflationRate, index) * opexCostMultiplier;
    const monthlyUnitMaterialCost = unitMaterialCost * materialCostMultiplier;
    const monthlyUnitWorkforceCost = unitWorkforceCost * workforceCostMultiplier;
    const monthlyUnitElectricityCost = unitElectricityCost * electricityCostMultiplier;
    const monthlyUnitOtherProductionCost = unitOtherProductionCost * cogsCostMultiplier;
    const monthlyUnitProductionCost =
      monthlyUnitMaterialCost +
      monthlyUnitWorkforceCost +
      monthlyUnitElectricityCost +
      monthlyUnitOtherProductionCost;
    const monthlyExtraRecurringCost = extraRecurringCost * overheadCostMultiplier;
    const plannedProducedUnits = dailyProduced * workingDaysPerMonth;
    const producedUnits = index === 0 && initialCapacityUnits > 0
      ? Math.min(plannedProducedUnits, initialCapacityUnits)
      : plannedProducedUnits;
    const forecastUnits = getSalesForecastForMonth(salesStrategy, index);
    const channelMonth = calculateChannelMonth(index, salesStrategy, operationsWorkspace, workingDaysPerMonth, settings);
    const grossSoldUnits = channelMonth.netSoldUnits;
    const unsoldUnits = Math.max(0, producedUnits - grossSoldUnits);
    const spoilageRate = 0;
    const expiredUnits = unsoldUnits * spoilageRate;
    const writeOffUnits = expiredUnits + channelMonth.returnedUnits;
    const writeOffCost = writeOffUnits * monthlyUnitProductionCost;
    const cogsSold = channelMonth.netSoldUnits * monthlyUnitProductionCost;
    const cashProductionCost = producedUnits * monthlyUnitProductionCost;
    const materialCost = producedUnits * monthlyUnitMaterialCost;
    const workforceCost = producedUnits * monthlyUnitWorkforceCost;
    const electricityCost = producedUnits * monthlyUnitElectricityCost;
    const otherProductionCost = producedUnits * monthlyUnitOtherProductionCost;
    const loanMonth = loanRows.reduce((total, loan, loanIndex) => {
      const monthsSinceReceived = index - loan.receivedMonthIndex;
      if (monthsSinceReceived < 0 || monthsSinceReceived >= loan.loanTermMonths) {
        return total;
      }

      const balance = loanBalances[loanIndex] || 0;
      const monthlyRate = loan.annualInterestRate / 100 / 12;
      const interest = balance * monthlyRate;
      const isGraceMonth = monthsSinceReceived < loan.gracePeriodMonths;
      const payment = !isGraceMonth ? Math.min(loan.monthlyPayment, balance + interest) : 0;
      const principal = Math.max(0, payment - interest);

      loanBalances[loanIndex] = isGraceMonth
        ? Math.max(0, balance + interest)
        : Math.max(0, balance - principal);

      return {
        interest: total.interest + interest,
        payment: total.payment + payment,
        principal: total.principal + principal,
      };
    }, { interest: 0, payment: 0, principal: 0 });
    const loanPayment = loanMonth.payment;
    const loanInterest = loanMonth.interest;

    channelMonth.channels.forEach((channel) => {
      const receiptIndex = index + channel.delayMonths;
      if (receiptIndex < cashReceipts.length) {
        cashReceipts[receiptIndex] += channel.revenue;
      }
    });

    const cashIn = (cashReceipts[index] || 0) + (loanReceipts[index] || 0);
    const outputVat = channelMonth.revenue * salesVatRate;
    const inputVat = Math.max(
      0,
      (materialCost + electricityCost + otherProductionCost + monthlyExtraRecurringCost) *
        expenseVatRate,
    );
    const vatPayable = Math.max(0, outputVat - inputVat);
    const profitBeforeTax = channelMonth.revenue - cogsSold - writeOffCost - monthlyExtraRecurringCost - loanInterest;
    const incomeTax = Math.max(0, profitBeforeTax * incomeTaxRate);
    const netIncome = profitBeforeTax - incomeTax;
    const taxPaymentIndex = index + taxPaymentDelayMonths;
    if (taxPaymentIndex < taxPayments.length) {
      taxPayments[taxPaymentIndex] += vatPayable + incomeTax;
    }
    const taxCashOut = taxPayments[index] || 0;
    const cashFlow = cashIn - cashProductionCost - monthlyExtraRecurringCost - loanPayment - taxCashOut;
    const totalCost = cogsSold + writeOffCost + monthlyExtraRecurringCost + loanInterest + incomeTax;

    cashBalance += cashFlow;
    cumulativePayback += cashFlow;

    if (cashBalance < 0 && cashRunwayMonths === monthCount) {
      cashRunwayMonths = index;
    }

    if (breakEvenMonth === null && netIncome >= 0) {
      breakEvenMonth = index + 1;
    }

    if (paybackMonth === null && cumulativePayback >= 0) {
      paybackMonth = index + 1;
    }

    totals.cashFlow += cashFlow;
    totals.discountCost += channelMonth.discountCost;
    totals.electricityCost += electricityCost;
    totals.expiredWriteOffCost += writeOffCost;
    totals.expiredWriteOffUnits += writeOffUnits;
    totals.forecastSalesUnits += forecastUnits;
    totals.incomeTax += incomeTax;
    totals.loanInterest += loanInterest;
    totals.loanPayment += loanPayment;
    totals.materialCost += materialCost;
    totals.netIncome += netIncome;
    totals.otherProductionCost += otherProductionCost;
    totals.netSoldUnits += channelMonth.netSoldUnits;
    totals.producedUnits += producedUnits;
    totals.retailerMarginCost += channelMonth.marginCost;
    totals.returnedUnits += channelMonth.returnedUnits;
    totals.revenue += channelMonth.revenue;
    totals.totalCost += totalCost;
    totals.unsoldInventoryUnits += unsoldUnits;
    totals.vatPayable += vatPayable;
    totals.workforceCost += workforceCost;

    rows.push({
      cashBalance,
      cashFlow,
      cashIn,
      electricityCost,
      forecastUnits,
      incomeTax,
      loanInterest,
      materialCost,
      netIncome,
      netSoldUnits: channelMonth.netSoldUnits,
      otherProductionCost,
      period: index + 1,
      producedUnits,
      salesRevenue: channelMonth.revenue,
      totalCost,
      unsoldUnits,
      vatPayable,
      workforceCost,
      writeOffCost,
      writeOffUnits,
    });
  }

  const firstMonth = rows[0] || {};
  const averageNetPrice = totals.netSoldUnits ? totals.revenue / totals.netSoldUnits : toFiniteNumber(operationsWorkspace.products?.[0]?.price);
  const contributionPerUnit = Math.max(0, averageNetPrice - unitProductionCost);
  const requiredMonthlySalesVolume = contributionPerUnit
    ? (extraRecurringCost + Math.min(monthlyLoanPayment, loanAmount || monthlyLoanPayment)) / contributionPerUnit
    : 0;
  const maxChartValue = Math.max(
    1,
    ...rows.map((row) => Math.max(row.salesRevenue, row.totalCost, row.netIncome, 0)),
  );
  const getPath = (field) => rows.map((row, index) => {
    const x = rows.length <= 1 ? 36 : 36 + (index * (434 / (rows.length - 1)));
    const y = 210 - ((Math.max(0, row[field]) / maxChartValue) * 170);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");

  return {
    ...baseModel,
    costStructure: [
      { amount: totals.materialCost, id: "materialCost", label: "Raw materials and packaging" },
      { amount: totals.workforceCost, id: "workforceCost", label: "Salaries and labor" },
      { amount: totals.electricityCost, id: "electricityCost", label: "Electricity" },
      { amount: totals.otherProductionCost, id: "otherProductionCost", label: "Depreciation, maintenance and mold" },
      { amount: totals.expiredWriteOffCost, id: "writeOffCost", label: "Spoilage, returns and expired write-off" },
      { amount: extraRecurringCost * monthCount, id: "recurringExtraCost", label: "Recurring overhead" },
      { amount: totals.vatPayable, id: "vatPayable", label: "VAT payable" },
      { amount: totals.incomeTax, id: "incomeTax", label: "Income tax" },
      { amount: totals.loanInterest, id: "loanInterest", label: "Loan interest" },
    ],
    extraCosts,
    incomeRows: [
      { amount: totals.revenue, id: "salesRevenue", kind: "income", label: "Sales revenue from monthly forecast" },
      { amount: investmentGrantAmount, id: "investmentGrant", kind: "income", label: "Investment grant / subsidy" },
      { amount: totals.materialCost, costType: "recurring", id: "materialCost", kind: "cost", label: "Raw materials and packaging" },
      { amount: totals.workforceCost, costType: "recurring", id: "workforceCost", kind: "cost", label: "Salaries and labor" },
      { amount: totals.electricityCost, costType: "recurring", id: "electricityCost", kind: "cost", label: "Electricity" },
      { amount: totals.otherProductionCost, costType: "recurring", id: "otherProductionCost", kind: "cost", label: "Depreciation, maintenance and mold" },
      { amount: totals.expiredWriteOffCost, costType: "recurring", id: "writeOffCost", kind: "cost", label: "Spoilage, returns and expired write-off" },
      { amount: machinePurchaseCost, costType: "initial", id: "machinePurchase", kind: "cost", label: "Machine investment" },
      { amount: equipmentPurchaseCost, costType: "initial", id: "equipmentPurchase", kind: "cost", label: "Equipment investment" },
      { amount: extraInitialCost, costType: "initial", id: "extraInitialCost", kind: "cost", label: "Initial extra costs" },
      { amount: workingCapitalRequirement, costType: "initial", id: "workingCapital", kind: "cost", label: "Working capital requirement" },
      { amount: totals.vatPayable, costType: "recurring", id: "vatPayable", kind: "cost", label: "VAT payable" },
      { amount: totals.incomeTax, costType: "recurring", id: "incomeTax", kind: "cost", label: "Income tax" },
      { amount: totals.loanInterest, costType: "recurring", id: "loanInterest", kind: "cost", label: "Loan interest" },
    ],
    settings,
    summary: {
      ...emptyFinancialModel.summary,
      ...baseModel.summary,
      averageNetPrice,
      breakEvenMonth,
      cashRunwayMonths,
      discountCost: totals.discountCost,
      electricityCost: totals.electricityCost,
      equipmentPurchaseCost,
      expiredWriteOffCost: totals.expiredWriteOffCost,
      expiredWriteOffUnits: totals.expiredWriteOffUnits,
      extraInitialCost,
      extraRecurringCost: extraRecurringCost * monthCount,
      forecastSalesUnits: totals.forecastSalesUnits,
      incomeTax: totals.incomeTax,
      initialCash,
      investmentGrantAmount,
      initialCashRequired: requiredOwnCash,
      loanAmount,
      loanInterest: totals.loanInterest,
      loanPayment: monthlyLoanPayment,
      loanPaymentTotal: totals.loanPayment,
      loanRows,
      machinePurchaseCost,
      materialCost: totals.materialCost,
      netIncome: totals.netIncome,
      netSoldUnits: totals.netSoldUnits,
      operationCostResult,
      otherProductionCost: totals.otherProductionCost,
      paybackMonth,
      planCount: activePlans.length,
      requiredMonthlySalesVolume,
      retailerMarginCost: totals.retailerMarginCost,
      returnedUnits: totals.returnedUnits,
      salesRevenue: totals.revenue,
      totalCashFlow: totals.cashFlow,
      totalCost: totals.totalCost,
      totalProduced: totals.producedUnits,
      unitProductionCost,
      unsoldInventoryUnits: totals.unsoldInventoryUnits,
      vatPayable: totals.vatPayable,
      weightedPaymentDelayDays: calculateChannelMonth(0, salesStrategy, operationsWorkspace, workingDaysPerMonth, settings).weightedPaymentDelayDays,
      workingCapitalRequirement,
      workingDaysPerMonth,
      firstMonthCashBalance: firstMonth.cashBalance || 0,
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
