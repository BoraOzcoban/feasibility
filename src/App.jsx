import React, { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import {
  defaultFinancialSettings,
  emptyFinancialExtraCostForm,
  emptyFinancialModel,
  generalFinancialAssumptionFields,
  inflationRevaluationFinancialFields,
  loadFinancialModel,
  optionalMacroFinancialSettingFields,
  requiredFinancialSettingFields,
  saveFinancialExtraCost,
  saveFinancialModelSettings,
} from "./lib/financialService";
import { getCurrentOperationPlans, hasViablePlanResult } from "./lib/operationsCalculations";
import { emptyOperationForms, emptyOperationPlan, emptyPlanRows, loadOperationsWorkspace, saveOperationRecord, saveOperationResourcePlan } from "./lib/operationsService";
import { deleteSimulationVariantRecord, emptySalesStrategy, emptySimulationVariant, loadSalesStrategy, loadSimulationVariants, saveSalesStrategy, saveSimulationVariant } from "./lib/planningService";
import logoUrl from "./assets/atera-logo.svg";

const emptyForm = {
  username: "",
  password: "",
  email: "",
  phoneNumber: "",
  company: "",
  department: "",
  accessLevel: "user",
  language: "en",
};

const emptyRoleForm = {
  name: "",
  description: "",
};

const emptyManagedUserForm = {
  username: "",
  email: "",
  password: "",
  phoneNumber: "",
  department: "",
  accessLevel: "user",
  language: "tr",
};

const simulationAlgorithms = {
  withTendency: "fbm_with_tendency",
  withoutTendency: "fbm_without_tendency",
};

function normalizeSimulationAlgorithm(value) {
  return value === simulationAlgorithms.withoutTendency
    ? simulationAlgorithms.withoutTendency
    : simulationAlgorithms.withTendency;
}

function isAdminRole(roleOrName) {
  const name = typeof roleOrName === "string" ? roleOrName : roleOrName?.name;
  return String(name || "").trim().toLowerCase() === "admin";
}

function formatNumber(value, maximumFractionDigits = 0) {
  const locale = document.documentElement.lang === "tr" ? "tr-TR" : "en-US";
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value || 0);
}

function formatLira(value, maximumFractionDigits = 0) {
  const locale = document.documentElement.lang === "tr" ? "tr-TR" : "en-US";
  return new Intl.NumberFormat(locale, {
    currency: "TRY",
    maximumFractionDigits,
    style: "currency",
  }).format(value || 0);
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toOptionalFiniteNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getOptionalPositiveNumber(value) {
  const number = toOptionalFiniteNumber(value);
  return number === null || number <= 0 ? null : number;
}

const cycleTimeUnits = {
  day: 1440,
  hour: 60,
  minute: 1,
};

function normalizeCycleTimeUnit(unit) {
  return Object.prototype.hasOwnProperty.call(cycleTimeUnits, unit) ? unit : "minute";
}

function getCycleTimeUnitLabel(unit, language = document.documentElement.lang) {
  const normalizedUnit = normalizeCycleTimeUnit(unit);
  const labels = {
    day: language === "tr" ? "gün" : "day",
    hour: language === "tr" ? "saat" : "hour",
    minute: language === "tr" ? "dk" : "min",
  };

  return labels[normalizedUnit];
}

function getCycleTimeMinutes(value, unit) {
  return Math.max(0.0001, toFiniteNumber(value, 1) * cycleTimeUnits[normalizeCycleTimeUnit(unit)]);
}

function getCycleTimeInputFromMinutes(minutes, preferredUnit = "minute") {
  const safeMinutes = Math.max(0.0001, toFiniteNumber(minutes, 1));
  const normalizedPreferredUnit = normalizeCycleTimeUnit(preferredUnit);
  const divisor = cycleTimeUnits[normalizedPreferredUnit] || 1;

  return {
    cycleTimeUnit: normalizedPreferredUnit,
    cycleTimeValue: safeMinutes / divisor,
  };
}

function formatCycleTime(minutes, preferredUnit, maximumFractionDigits = 2) {
  const { cycleTimeUnit, cycleTimeValue } = getCycleTimeInputFromMinutes(minutes, preferredUnit);
  return `${formatNumber(cycleTimeValue, maximumFractionDigits)} ${getCycleTimeUnitLabel(cycleTimeUnit)}`;
}

function getProjectionMonthCount(horizon) {
  if (horizon === "5y") return 60;
  if (horizon === "1y") return 12;
  return 6;
}

function getMonthlyLoanPayment(amount, annualInterestRate, termMonths) {
  const principal = Math.max(0, toFiniteNumber(amount));
  const term = Math.max(1, Math.round(toFiniteNumber(termMonths, 1)));
  const monthlyRate = Math.max(0, toFiniteNumber(annualInterestRate)) / 100 / 12;

  if (!principal) return 0;
  if (!monthlyRate) return principal / term;

  return principal * (monthlyRate * ((1 + monthlyRate) ** term)) / (((1 + monthlyRate) ** term) - 1);
}

function getMonthlyRateFromAnnualPercent(annualPercent) {
  const annualRate = Math.max(0, toFiniteNumber(annualPercent)) / 100;
  return ((1 + annualRate) ** (1 / 12)) - 1;
}

function getIncreaseFrequencyMonths(frequency) {
  if (frequency === "monthly") return 1;
  if (frequency === "quarterly") return 3;
  if (frequency === "annual") return 12;
  return 6;
}

function getPeriodicAnnualIncreaseMultiplier(annualPercent, monthIndex, frequency) {
  const annualRate = Math.max(0, toFiniteNumber(annualPercent)) / 100;
  if (!annualRate) return 1;

  const periodMonths = getIncreaseFrequencyMonths(frequency);
  const periodRate = ((1 + annualRate) ** (periodMonths / 12)) - 1;
  const elapsedPeriods = Math.floor(monthIndex / periodMonths);

  return (1 + periodRate) ** elapsedPeriods;
}

function getFinancialLoanRows(settings = {}) {
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
      const loanTermMonths = Math.max(1, Math.round(toFiniteNumber(row.loanTermMonths, 24)));
      const gracePeriodMonths = Math.min(
        loanTermMonths - 1,
        Math.max(0, Math.round(toFiniteNumber(row.gracePeriodMonths))),
      );
      const monthlyRate = annualInterestRate / 100 / 12;
      const principalAfterGrace = monthlyRate ? amount * ((1 + monthlyRate) ** gracePeriodMonths) : amount;
      const repaymentTermMonths = Math.max(1, loanTermMonths - gracePeriodMonths);

      return {
        amount,
        annualInterestRate,
        gracePeriodMonths,
        id: row.id || `loan-${index + 1}`,
        loanTermMonths,
        monthlyPayment: getMonthlyLoanPayment(principalAfterGrace, annualInterestRate, repaymentTermMonths),
        principalAfterGrace,
        repaymentTermMonths,
      };
    })
    .filter((row) => row.amount > 0);
}

function getSalesExpectationMultipliers(salesStrategy) {
  const company = salesStrategy.company || {};
  const source = Array.isArray(company.monthlyMultipliers)
    ? company.monthlyMultipliers
    : (Array.isArray(company.monthlyForecast) ? company.monthlyForecast : []);

  return Array.from({ length: 12 }, (_, index) => Math.max(0, toFiniteNumber(source[index], 1)));
}

function getSalesExpectationMultiplier(salesStrategy, monthIndex) {
  const multipliers = getSalesExpectationMultipliers(salesStrategy);
  return multipliers[monthIndex % multipliers.length] ?? 1;
}

function getChannelGrowthRate(channel, elapsedMonthIndex) {
  if (elapsedMonthIndex < 6) return Math.max(0, toFiniteNumber(channel.growthMonths1To6Percent)) / 100;
  if (elapsedMonthIndex < 18) return Math.max(0, toFiniteNumber(channel.growthMonths7To18Percent)) / 100;
  if (elapsedMonthIndex < 24) return Math.max(0, toFiniteNumber(channel.growthMonths19To24Percent)) / 100;
  return Math.max(0, toFiniteNumber(channel.growthYears3To5Percent)) / 100;
}

function getChannelGrowthMultiplier(channel, elapsedMonthIndex) {
  let multiplier = 1;

  for (let index = 1; index <= elapsedMonthIndex; index += 1) {
    multiplier *= 1 + getChannelGrowthRate(channel, index - 1);
  }

  return multiplier;
}

function getChannelSeasonalityMultiplier(channel, monthIndex) {
  const curve = Array.isArray(channel.seasonalityCurve) ? channel.seasonalityCurve : [];
  const value = getOptionalPositiveNumber(curve[monthIndex % 12]);
  return value ?? 1;
}

function getProjectedChannelSalesUnits(channel, monthIndex, salesStrategy) {
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

function getBaseMonthlySalesUnits(salesStrategy) {
  const channels = Array.isArray(salesStrategy.channels) ? salesStrategy.channels : [];
  return channels.reduce((total, channel) => total + Math.max(0, toFiniteNumber(channel.monthlySalesUnits)), 0);
}

function getSalesForecastForMonth(salesStrategy, monthIndex) {
  const channels = Array.isArray(salesStrategy.channels) ? salesStrategy.channels : [];
  return channels.reduce((total, channel) => total + getProjectedChannelSalesUnits(channel, monthIndex, salesStrategy), 0);
}

function getPlanProductId(plan) {
  return plan?.product_id || plan?.product?.id || plan?.input?.productId || "";
}

function getMonthlyProductProductionMap(operationsWorkspace, workingDaysPerMonth = 22) {
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

function getOperationProductMap(operationsWorkspace) {
  return new Map((operationsWorkspace.products || []).map((product) => [product.id, product]));
}

function calculateChannelMonth(monthIndex, salesStrategy, operationsWorkspace = {}, workingDaysPerMonth = 22, settingsInput = {}) {
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
    const price = Math.max(0, toFiniteNumber(product.price)) * priceIncreaseMultiplier;
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

function buildFinancialFeasibilityModel(baseModel, salesStrategy, settingsInput, operationsWorkspace, horizon) {
  const settings = {
    ...defaultFinancialSettings,
    ...(baseModel.settings || {}),
    ...(settingsInput || {}),
  };
  const monthCount = getProjectionMonthCount(horizon);
  const activePlans = getCurrentOperationPlans(operationsWorkspace).filter((plan) => hasViablePlanResult(plan.result));
  const electricityPrice = Math.max(0, toFiniteNumber(settings.electricityPricePerKwh));
  const workingDaysPerMonth = Math.max(1, toFiniteNumber(settings.workingDaysPerMonth, 22));
  const investmentGrantAmount = Math.max(0, toFiniteNumber(settings.investmentGrantAmount));
  const initialCapacityUnits = Math.max(0, toFiniteNumber(settings.initialCapacityUnits));
  const dailyProduced = activePlans.reduce((total, plan) => total + Math.max(0, toFiniteNumber(plan.result?.producedQuantity)), 0);
  const dailyMaterialCost = activePlans.reduce((total, plan) => total + Math.max(0, toFiniteNumber(plan.result?.materialCost)), 0);
  const dailyWorkforceCost = activePlans.reduce((total, plan) => total + Math.max(0, toFiniteNumber(plan.result?.workforceCost)), 0);
  const dailyElectricityCost = activePlans.reduce((total, plan) => total + Math.max(0, toFiniteNumber(plan.result?.energyConsumptionKwh)) * electricityPrice, 0);
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
  const unitMaterialCost = dailyProduced ? dailyMaterialCost / dailyProduced : 0;
  const unitWorkforceCost = dailyProduced ? dailyWorkforceCost / dailyProduced : 0;
  const unitElectricityCost = dailyProduced ? dailyElectricityCost / dailyProduced : 0;
  const unitProductionCost = unitMaterialCost + unitWorkforceCost + unitElectricityCost;
  const extraCosts = baseModel.extraCosts || [];
  const extraInitialCost = extraCosts.reduce((total, cost) => total + (cost.costType === "initial" ? Math.max(0, toFiniteNumber(cost.amount)) : 0), 0);
  const extraRecurringCost = extraCosts.reduce((total, cost) => total + (cost.costType === "recurring" ? Math.max(0, toFiniteNumber(cost.amount)) : 0), 0);
  const monthlyMaterialCost = dailyMaterialCost * workingDaysPerMonth;
  const monthlyWorkforceCost = dailyWorkforceCost * workingDaysPerMonth;
  const loanRows = getFinancialLoanRows(settings);
  const loanAmount = loanRows.reduce((total, row) => total + row.amount, 0);
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
  const requiredOwnCash = Math.max(0, initialInvestment + adjustedWorkingCapitalRequirement - loanAmount - investmentGrantAmount);
  const cashReceipts = Array.from({ length: monthCount + 24 }, () => 0);
  const taxPayments = Array.from({ length: monthCount + taxPaymentDelayMonths + 24 }, () => 0);
  const rows = [];
  const loanBalances = loanRows.map((row) => row.amount);
  let cashBalance = initialCash + loanAmount + investmentGrantAmount - initialInvestment - adjustedWorkingCapitalRequirement;
  let cumulativePayback = -initialInvestment - adjustedWorkingCapitalRequirement + loanAmount + investmentGrantAmount;
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
    const monthlyUnitProductionCost = monthlyUnitMaterialCost + monthlyUnitWorkforceCost + monthlyUnitElectricityCost;
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
    const loanMonth = loanRows.reduce((total, loan, loanIndex) => {
      const balance = loanBalances[loanIndex] || 0;
      const monthlyRate = loan.annualInterestRate / 100 / 12;
      const interest = index < loan.loanTermMonths ? balance * monthlyRate : 0;
      const isGraceMonth = index < loan.gracePeriodMonths;
      const payment = index < loan.loanTermMonths && !isGraceMonth ? Math.min(loan.monthlyPayment, balance + interest) : 0;
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

    const cashIn = cashReceipts[index] || 0;
    const outputVat = channelMonth.revenue * salesVatRate;
    const inputVat = Math.max(0, (materialCost + electricityCost + monthlyExtraRecurringCost) * expenseVatRate);
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
      forecastUnits,
      netIncome,
      netSoldUnits: channelMonth.netSoldUnits,
      period: index + 1,
      producedUnits,
      salesRevenue: channelMonth.revenue,
      totalCost,
      unsoldUnits,
      vatPayable,
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

const text = {
  en: {
    language: "Language",
    themeLight: "Light mode",
    themeDark: "Dark mode",
    showPassword: "Show password",
    hidePassword: "Hide password",
    show: "Show",
    hide: "Hide",
    light: "Light",
    dark: "Dark",
    dataSync: "Data Sync",
    live: "Live",
    login: "Log in",
    adminProvisionedAccess: "Accounts are created by your company admin in Authorization.",
    who: "Who are we?",
    solutions: "Our solutions",
    references: "Our references",
    contact: "Contact",
    heroTitle: "Atera",
    heroCopy: "Check whether a new factory plan can produce, sell, and pay back before you commit capital.",
    goToLogin: "Go to log in",
    whoCopy: "Plan. Test. Decide. Scale. Atera brings production, sales, finance, and operations into one practical hub so a factory leader can see capacity, cost, cash, and delivery risk before making the next commitment.",
    solutionsCopy: "Define the product, resources, production plan, sales channels, financial assumptions, and scenarios in one flow. The goal is simple: see if the operation is feasible and what to improve first.",
    farmerPersona: "Planning team",
    factoryOwnerPersona: "Production lead",
    entrepreneurPersona: "Finance team",
    exporterPersona: "Operations owner",
    farmerNeed: "Need: See whether a new order is feasible before committing capacity.",
    farmerBenefit: "Benefit: Compare material, labor, and timing scenarios in one calm workspace.",
    farmerDifference: "Atera's difference: Tailor-made planning without enterprise software weight.",
    factoryOwnerNeed: "Need: Understand which production route protects margin and delivery time.",
    factoryOwnerBenefit: "Benefit: Make faster calls with clearer cost and stock visibility.",
    factoryOwnerDifference: "Atera's difference: Built around the way your team actually works.",
    entrepreneurNeed: "Need: Turn scattered spreadsheets into a shared operating view.",
    entrepreneurBenefit: "Benefit: Keep decisions, assumptions, and feasibility notes together.",
    entrepreneurDifference: "Atera's difference: Practical, budget-friendly structure that can grow step by step.",
    exporterNeed: "Need: Check price, currency, stock, and shipment promises before quoting.",
    exporterBenefit: "Benefit: Reduce surprises between sales, production, and delivery.",
    exporterDifference: "Atera's difference: Friendly planning tools for real-world tradeoffs.",
    referencesCopy: "Reference stories and customer examples will live here as the product grows.",
    contactCopy: "You can reach us for access, onboarding, and project questions.",
    contactPhone: "",
    contactEmail: "hello@atera.app",
    contactLocation: "Istanbul, Turkiye",
    username: "Username",
    loginEmail: "Email",
    password: "Password",
    email: "Mail address",
    phoneNumber: "Phone number",
    company: "Company",
    department: "Department",
    accessLevel: "Access level",
    profilePicture: "Profile picture",
    forgot: "I forgot my password",
    resetPassword: "Set new password",
    confirmPassword: "Confirm password",
    submitLogin: "Log in",
    logout: "Log out",
    signedIn: "Signed in",
    dashboard: "Dashboard",
    dashboardCopy: "This area will become the main workspace for planning, feasibility, and operational tools.",
    authorizationPage: "Authorization Page",
    authorizationCopy: "Authorization tools and user access controls live here.",
    authorizationLocked: "Authorization is locked for your current role.",
    authorizationLockedCopy: "Your company role does not have read or write permission for this module yet.",
    roleDefinition: "Role definition",
    userDefinition: "User definition",
    userDefinitionCopy: "Create company users and save their profile records through Supabase.",
    managedUsers: "Defined users",
    createManagedUser: "Create user",
    userCreated: "User was created and saved to profiles.",
    newRole: "New role",
    roleName: "Role name",
    roleDescription: "Role description",
    createRole: "Create role",
    permissions: "Permissions",
    module: "Module",
    readPermission: "Read",
    writePermission: "Write",
    readOnlyMode: "Read-only mode",
    writeAccess: "Write access",
    noCompany: "Your profile is not connected to a company yet.",
    loadAuthorizationError: "Authorization data could not be loaded.",
    backToDashboard: "Back to dashboard",
    configure: "Add your Supabase URL and anon key to .env, then restart npm run dev.",
    resetSent: "Password reset email sent.",
    needEmail: "Enter your mail address first.",
    forgotEmailPrompt: "Enter your mail address for password reset.",
    passwordMismatch: "Passwords do not match.",
    passwordTooShort: "Password must be at least 6 characters.",
    passwordUpdated: "Password updated. You can log in now.",
    usernameNotFound: "Username was not found.",
    missingUser: "Supabase did not return a user.",
  },
  tr: {
    language: "Dil",
    themeLight: "Aydınlık mod",
    themeDark: "Karanlık mod",
    showPassword: "Şifreyi göster",
    hidePassword: "Şifreyi gizle",
    show: "Göster",
    hide: "Gizle",
    light: "Aydınlık",
    dark: "Karanlık",
    dataSync: "Veri Senkronu",
    live: "Canlı",
    login: "Giriş yap",
    adminProvisionedAccess: "Hesaplar şirket admini tarafından Yetkilendirme ekranında oluşturulur.",
    who: "Biz kimiz?",
    solutions: "Çözümlerimiz",
    references: "Referanslarımız",
    contact: "İletişim",
    heroTitle: "Atera",
    heroCopy: "Yeni bir fabrika planının üretip satıp yatırımını geri ödeyip ödeyemeyeceğini sermaye bağlamadan önce kontrol edin.",
    goToLogin: "Girişe git",
    whoCopy: "Planla. Dene. Karar ver. Büyüt. Atera; üretim, satış, finans ve operasyonu tek pratik alanda toplar. Böylece fabrika yöneticisi kapasiteyi, maliyeti, nakdi ve termin riskini bir sonraki karardan önce görebilir.",
    solutionsCopy: "Ürünü, kaynakları, üretim planını, satış kanallarını, finansal varsayımları ve senaryoları tek akışta tanımlayın. Amaç basit: operasyon fizibl mi ve önce ne iyileştirilmeli?",
    farmerPersona: "Planlama ekibi",
    factoryOwnerPersona: "Üretim sorumlusu",
    entrepreneurPersona: "Finans ekibi",
    exporterPersona: "Operasyon sahibi",
    farmerNeed: "İhtiyaç: Yeni bir siparişe söz vermeden önce üretim fizibilitesini görmek.",
    farmerBenefit: "Fayda: Malzeme, işçilik ve termin senaryolarını tek sakin alanda karşılaştırmak.",
    farmerDifference: "Atera'nın farkı: Kurumsal yazılım ağırlığı olmadan tailor-made planlama.",
    factoryOwnerNeed: "İhtiyaç: Hangi üretim yolunun marjı ve teslimatı koruduğunu anlamak.",
    factoryOwnerBenefit: "Fayda: Maliyet ve stok görünürlüğüyle daha hızlı karar almak.",
    factoryOwnerDifference: "Atera'nın farkı: Ekibinizin gerçek çalışma şekline göre şekillenmesi.",
    entrepreneurNeed: "İhtiyaç: Dağılan Excel'leri ortak bir operasyon görünümüne çevirmek.",
    entrepreneurBenefit: "Fayda: Kararları, varsayımları ve fizibilite notlarını birlikte tutmak.",
    entrepreneurDifference: "Atera'nın farkı: Adım adım büyüyebilen pratik ve bütçe dostu yapı.",
    exporterNeed: "İhtiyaç: Teklif vermeden önce fiyat, kur, stok ve sevkiyat sözünü kontrol etmek.",
    exporterBenefit: "Fayda: Satış, üretim ve teslimat arasındaki sürprizleri azaltmak.",
    exporterDifference: "Atera'nın farkı: Gerçek hayattaki trade-off'lar için samimi planlama araçları.",
    referencesCopy: "Ürün büyüdükçe referans hikayeleri ve müşteri örnekleri burada yer alacak.",
    contactCopy: "Erişim, onboarding ve proje soruları için bize ulaşabilirsiniz.",
    contactPhone: "",
    contactEmail: "hello@atera.app",
    contactLocation: "Istanbul, Turkiye",
    username: "Kullanıcı adı",
    loginEmail: "E-posta",
    password: "Şifre",
    email: "Mail adresi",
    phoneNumber: "Telefon numarası",
    company: "Şirket",
    department: "Departman",
    accessLevel: "Yetki seviyesi",
    profilePicture: "Profil fotoğrafı",
    forgot: "Şifremi unuttum",
    resetPassword: "Yeni şifre belirle",
    confirmPassword: "Şifreyi onayla",
    submitLogin: "Giriş yap",
    logout: "Çıkış yap",
    signedIn: "Giriş yapıldı",
    dashboard: "Dashboard",
    dashboardCopy: "Bu alan planlama, fizibilite ve operasyon araçları için ana çalışma alanına dönüşecek.",
    authorizationPage: "Yetkilendirme Sayfası",
    authorizationCopy: "Yetkilendirme araçları ve kullanıcı erişim kontrolleri burada yer alır.",
    authorizationLocked: "Yetkilendirme mevcut yetkiniz için kilitli.",
    authorizationLockedCopy: "Şirketinizdeki yetkinizin bu modül için okuma veya yazma izni yok.",
    roleDefinition: "Yetki tanımlama",
    userDefinition: "Kullanıcı tanımlama",
    userDefinitionCopy: "Şirket kullanıcıları oluşturun ve profil kayıtlarını Supabase'e kaydedin.",
    managedUsers: "Tanımlı kullanıcılar",
    createManagedUser: "Kullanıcı oluştur",
    userCreated: "Kullanıcı oluşturuldu ve profiles tablosuna kaydedildi.",
    newRole: "Yeni yetki",
    roleName: "Yetki adı",
    roleDescription: "Yetki açıklaması",
    createRole: "Yetki yarat",
    permissions: "İzinler",
    module: "Modül",
    readPermission: "Okuma",
    writePermission: "Yazma",
    readOnlyMode: "Sadece okuma",
    writeAccess: "Yazma erişimi",
    noCompany: "Profiliniz henüz bir şirkete bağlı değil.",
    loadAuthorizationError: "Yetkilendirme verisi yüklenemedi.",
    backToDashboard: "Dashboard'a dön",
    configure: ".env dosyasına Supabase URL ve anon key ekleyip npm run dev'i yeniden başlat.",
    resetSent: "Şifre sıfırlama e-postası gönderildi.",
    needEmail: "Önce mail adresini gir.",
    forgotEmailPrompt: "Şifre sıfırlama için mail adresini gir.",
    passwordMismatch: "Şifreler eşleşmiyor.",
    passwordTooShort: "Şifre en az 6 karakter olmalı.",
    passwordUpdated: "Şifre güncellendi. Artık giriş yapabilirsiniz.",
    usernameNotFound: "Kullanıcı adı bulunamadı.",
    missingUser: "Supabase kullanıcı bilgisi döndürmedi.",
  },
};

function PersonaAvatar({ type, title }) {
  const palette = {
    planning: { shirt: "#2f9fbd", hair: "#173b41", accent: "#d99a24", skin: "#f1c19d" },
    production: { shirt: "#187565", hair: "#102b32", accent: "#d99a24", skin: "#d99f78" },
    finance: { shirt: "#9d5b3f", hair: "#3f2b24", accent: "#2f9fbd", skin: "#e7b58e" },
    operations: { shirt: "#173b41", hair: "#6f4937", accent: "#187565", skin: "#c98d68" },
  }[type];

  return (
    <svg className="persona-avatar" viewBox="0 0 160 160" role="img" aria-label={title}>
      <rect className="avatar-card-bg" x="8" y="8" width="144" height="144" rx="22" />
      <circle cx="80" cy="68" r="34" fill={palette.skin} />
      <path d="M47 66c4-26 19-40 43-38 19 2 31 14 33 36-15-7-32-9-48-6-11 2-20 5-28 8Z" fill={palette.hair} />
      <circle cx="68" cy="72" r="4" fill="#102b32" />
      <circle cx="92" cy="72" r="4" fill="#102b32" />
      <path d="M70 88c7 6 15 6 22 0" fill="none" stroke="#102b32" strokeLinecap="round" strokeWidth="4" />
      <path d="M42 137c4-24 19-36 38-36s34 12 38 36H42Z" fill={palette.shirt} />
      {type === "planning" && (
        <>
          <circle cx="40" cy="116" r="14" fill="#f1c19d" />
          <circle cx="120" cy="116" r="14" fill="#d99f78" />
          <path d="M26 140c2-12 8-18 14-18s12 6 14 18H26Z" fill="#173b41" />
          <path d="M106 140c2-12 8-18 14-18s12 6 14 18h-28Z" fill="#d99a24" />
          <path d="M112 36h22v18h-22zM117 44h12" fill="none" stroke={palette.accent} strokeLinecap="round" strokeWidth="4" />
        </>
      )}
      {type === "production" && (
        <>
          <path d="M46 54c5-21 17-31 34-31s29 10 34 31H46Z" fill={palette.accent} />
          <path d="M45 55h70" stroke="#102b32" strokeLinecap="round" strokeWidth="5" />
          <path d="M116 106h20v28h-20zM122 112h8M122 121h8M122 130h8" fill="none" stroke="#102b32" strokeLinecap="round" strokeWidth="4" />
        </>
      )}
      {type === "finance" && (
        <>
          <rect x="108" y="98" width="30" height="38" rx="6" fill="#f9faf6" stroke="#102b32" strokeWidth="4" />
          <path d="M115 108h16M116 119h4M124 119h4M132 119h1M116 128h4M124 128h4M132 128h1" stroke={palette.accent} strokeLinecap="round" strokeWidth="3" />
          <path d="M50 44c10-16 31-19 48-6" fill="none" stroke={palette.hair} strokeLinecap="round" strokeWidth="10" />
        </>
      )}
      {type === "operations" && (
        <>
          <path d="M47 73c0-23 14-42 33-42s33 19 33 42" fill="none" stroke={palette.accent} strokeLinecap="round" strokeWidth="7" />
          <rect x="39" y="68" width="12" height="22" rx="5" fill="#102b32" />
          <rect x="109" y="68" width="12" height="22" rx="5" fill="#102b32" />
          <path d="M116 91c-4 15-13 22-27 22" fill="none" stroke="#102b32" strokeLinecap="round" strokeWidth="4" />
          <circle cx="87" cy="113" r="4" fill="#102b32" />
        </>
      )}
    </svg>
  );
}

function App() {
  const initialPath = window.location.pathname;
  const [mode, setMode] = useState("login");
  const [path, setPath] = useState(window.location.pathname);
  const [form, setForm] = useState(emptyForm);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [theme, setTheme] = useState("light");
  const [profilePreview, setProfilePreview] = useState("");
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [authorizationLoading, setAuthorizationLoading] = useState(false);
  const [authorizationStatus, setAuthorizationStatus] = useState("");
  const [authorizationTab, setAuthorizationTab] = useState("roles");
  const [authorizationAccess, setAuthorizationAccess] = useState({ read: false, write: false });
  const [modules, setModules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [managedUserForm, setManagedUserForm] = useState(emptyManagedUserForm);
  const [financialExtraCostForm, setFinancialExtraCostForm] = useState(emptyFinancialExtraCostForm);
  const [financialHorizon, setFinancialHorizon] = useState("6m");
  const [financialModel, setFinancialModel] = useState(emptyFinancialModel);
  const [financialSettingsForm, setFinancialSettingsForm] = useState(defaultFinancialSettings);
  const [financialStatus, setFinancialStatus] = useState("");
  const [financialLoading, setFinancialLoading] = useState(false);
  const [financialOverviewWidgets, setFinancialOverviewWidgets] = useState([]);
  const [financeWindow, setFinanceWindow] = useState("today");
  const [financeDateRange, setFinanceDateRange] = useState({ start: "", end: "" });
  const [reportsFilterOpen, setReportsFilterOpen] = useState(false);
  const [reportsSearch, setReportsSearch] = useState("");
  const [reportsTab, setReportsTab] = useState("all");
  const [productPlusTab, setProductPlusTab] = useState("general");
  const [operationForms, setOperationForms] = useState(emptyOperationForms);
  const [operationPlan, setOperationPlan] = useState(emptyOperationPlan);
  const [operationPlanResult, setOperationPlanResult] = useState(null);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [operationsStatus, setOperationsStatus] = useState("");
  const [salesStrategy, setSalesStrategy] = useState(emptySalesStrategy);
  const [salesStatus, setSalesStatus] = useState("");
  const [salesLoading, setSalesLoading] = useState(false);
  const [simulationVariants, setSimulationVariants] = useState([emptySimulationVariant]);
  const [simulationStatus, setSimulationStatus] = useState("");
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [operationsWorkspace, setOperationsWorkspace] = useState({
    activePlans: [],
    equipment: [],
    latestPlan: null,
    machines: [],
    materials: [],
    notes: [],
    product: null,
    products: [],
    workforce: [],
  });

  const labels = text[form.language] || text.en;
  const copy = (en, tr) => (form.language === "tr" ? tr : en);
  const locale = form.language === "tr" ? "tr-TR" : "en-US";

  const initials = useMemo(() => {
    const source = form.username || form.email || "A";
    return source.slice(0, 2).toUpperCase();
  }, [form.email, form.username]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = form.language;
  }, [form.language]);

  useEffect(() => {
    if (!supabase) return;

    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    if (params.get("type") === "recovery") {
      setMode("reset");
    } else {
      setMode("login");
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handlePopState() {
      const nextPath = window.location.pathname;
      setPath(nextPath);
      setStatus("");
      setMode("login");
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!session || !supabase) {
      setCurrentProfile(null);
      setAuthorizationAccess({ read: false, write: false });
      setModules([]);
      setRoles([]);
      setProfiles([]);
      return;
    }

    loadAuthorizationData();
  }, [session]);

  useEffect(() => {
    if (!session || !supabase) {
      setOperationsWorkspace({
        activePlans: [],
        equipment: [],
        latestPlan: null,
        machines: [],
        materials: [],
        notes: [],
        product: null,
        products: [],
        workforce: [],
      });
      setOperationPlan(emptyOperationPlan);
      setOperationPlanResult(null);
      setFinancialModel(emptyFinancialModel);
      setFinancialSettingsForm(defaultFinancialSettings);
      setFinancialExtraCostForm(emptyFinancialExtraCostForm);
      setFinancialStatus("");
      setFinancialOverviewWidgets([]);
      setSalesStrategy(emptySalesStrategy);
      setSalesStatus("");
      setSimulationVariants([emptySimulationVariant]);
      setSimulationStatus("");
      return;
    }

    loadOperationsData();
    loadFinancialData();
    loadPlanningData();
  }, [session]);

  function goTo(pathname, nextMode) {
    window.history.pushState({}, "", pathname);
    setPath(pathname);
    setMode(nextMode);
    setStatus("");
  }

  function updateField(field, value) {
    if (field === "language") {
      if (supabase && session?.user?.id) {
        supabase.from("profiles").update({ language: value }).eq("id", session.user.id).then(({ error }) => {
          if (error) console.warn("Language preference could not be saved.", error);
        });
      }
    }
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateSalesCompany(field, value) {
    setSalesStrategy((current) => ({
      ...current,
      company: { ...current.company, [field]: value },
    }));
  }

  function updateSalesForecast(index, value) {
    setSalesStrategy((current) => {
      const monthlyMultipliers = Array.isArray(current.company.monthlyMultipliers)
        ? [...current.company.monthlyMultipliers]
        : Array.from({ length: 12 }, () => 1);

      monthlyMultipliers[index] = value;

      return {
        ...current,
        company: {
          ...current.company,
          monthlyMultipliers,
        },
      };
    });
  }

  function updateSalesItem(collection, id, field, value) {
    setSalesStrategy((current) => ({
      ...current,
      [collection]: current[collection].map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  }

  function updateSalesChannelSeasonality(id, index, value) {
    setSalesStrategy((current) => ({
      ...current,
      channels: current.channels.map((channel) => {
        if (channel.id !== id) return channel;
        const seasonalityCurve = Array.isArray(channel.seasonalityCurve)
          ? [...channel.seasonalityCurve]
          : Array.from({ length: 12 }, () => "");

        seasonalityCurve[index] = value;
        return { ...channel, seasonalityCurve };
      }),
    }));
  }

  function removeSalesItem(collection, id) {
    setSalesStrategy((current) => ({
      ...current,
      [collection]: current[collection].filter((item) => item.id !== id),
    }));
  }

  function addSalesItem(collection) {
    const nextId = `${collection}-${Date.now()}`;
    const defaultProduct = operationsWorkspace.products[0];
    const templates = {
      campaigns: {
        budget: 0,
        channel: "",
        durationDays: 30,
        goal: copy("Campaign objective", "Kampanya hedefi"),
        id: nextId,
        name: copy("New campaign", "Yeni kampanya"),
        typeId: salesStrategy.campaignTypes?.[0]?.id || "digital",
      },
      channels: {
        advancedOpen: true,
        basketSize: "",
        capacityLimit: "",
        churnRatePercent: "",
        commissionPercent: 0,
        conversionRatePercent: "",
        collectionDays: 30,
        customerAcquisitionCost: 0,
        discountRatePercent: "",
        failureProbabilityPercent: "",
        growthMonths1To6Percent: 0,
        growthMonths7To18Percent: 0,
        growthMonths19To24Percent: 0,
        growthYears3To5Percent: 0,
        id: nextId,
        launchFee: "",
        moqMonthly: "",
        monthlySalesUnits: 0,
        name: copy("New channel", "Yeni kanal"),
        productId: defaultProduct?.id || "",
        productName: defaultProduct?.name || "",
        rampUpMonths: "",
        repeatRatePercent: "",
        returnRatePercent: "",
        seasonalityCurve: Array.from({ length: 12 }, () => ""),
        startMonth: 1,
        trafficScore: "",
        typeId: salesStrategy.channelTypes?.[0]?.id || "direct",
      },
      personnel: {
        assignedChannel: "",
        id: nextId,
        monthlyTarget: 0,
        name: copy("New sales person", "Yeni satış personeli"),
        realizedSalesUnits: 0,
        role: copy("Sales role", "Satış rolü"),
      },
    };

    if (!templates[collection]) return;

    setSalesStrategy((current) => ({
      ...current,
      [collection]: [...current[collection], templates[collection]],
    }));
  }

  function hasRequiredNumber(value) {
    if (value === "" || value === null || value === undefined) return false;
    return Number.isFinite(Number(value));
  }

  function validateSalesStrategy() {
    for (let index = 0; index < salesStrategy.channels.length; index += 1) {
      const channel = salesStrategy.channels[index];
      const label = channel.name?.trim() || `${copy("Channel", "Kanal")} ${index + 1}`;
      const requiredNumbers = [
        [channel.startMonth, copy("Start month", "Başlangıç ayı"), 1],
        [channel.monthlySalesUnits, copy("First month sales", "İlk ay satış"), 0],
        [channel.growthMonths1To6Percent, copy("Growth (1-6 months)", "Büyüme (1-6 ay)"), 0],
        [channel.growthMonths7To18Percent, copy("Growth (7-18 months)", "Büyüme (7-18 ay)"), 0],
        [channel.growthMonths19To24Percent, copy("Growth (19-24 months)", "Büyüme (19-24 ay)"), 0],
        [channel.growthYears3To5Percent, copy("Year 3-5 growth", "Yıl 3-5 büyüme"), 0],
        [channel.collectionDays, copy("Collection days", "Tahsilat günü"), 0],
        [channel.customerAcquisitionCost, copy("Unit marketing CAC", "Birim pazarlama CAC"), 0],
        [channel.commissionPercent, copy("Channel commission", "Kanal komisyonu"), 0],
      ];

      if (!channel.name?.trim()) {
        return copy(`Channel ${index + 1}: channel name is required.`, `Kanal ${index + 1}: kanal adı zorunlu.`);
      }

      if (!channel.typeId) {
        return copy(`${label}: channel type is required.`, `${label}: kanal tipi zorunlu.`);
      }

      if (!channel.productId) {
        return copy(`${label}: product to sell is required.`, `${label}: satılacak ürün zorunlu.`);
      }

      for (const [value, fieldLabel, minimum] of requiredNumbers) {
        if (!hasRequiredNumber(value) || Number(value) < minimum) {
          return copy(`${label}: ${fieldLabel} must be filled.`, `${label}: ${fieldLabel} doldurulmalı.`);
        }
      }
    }

    return "";
  }

  function addFinancialLoanRow() {
    setFinancialSettingsForm((current) => ({
      ...current,
      loanRows: [
        ...(Array.isArray(current.loanRows) ? current.loanRows : []),
        {
          amount: "",
          annualInterestRate: "",
          gracePeriodMonths: 0,
          id: `loan-${Date.now()}`,
          loanTermMonths: "",
        },
      ],
    }));
  }

  function updateFinancialLoanRow(index, field, value) {
    setFinancialSettingsForm((current) => {
      const loanRows = Array.isArray(current.loanRows) ? [...current.loanRows] : [];
      loanRows[index] = { ...loanRows[index], [field]: value };

      return { ...current, loanRows };
    });
  }

  function removeFinancialLoanRow(index) {
    setFinancialSettingsForm((current) => ({
      ...current,
      loanRows: (Array.isArray(current.loanRows) ? current.loanRows : []).filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function updateSimulationVariant(id, field, value) {
    setSimulationVariants((current) => current.map((variant) => {
      if (variant.id !== id) return variant;
      const nextVariant = { ...variant, [field]: value };
      if (field === "name") {
        nextVariant.label = value || variant.label;
      }
      return nextVariant;
    }));
  }

  function updateSimulationParameter(id, field, value) {
    setSimulationVariants((current) => current.map((variant) => (
      variant.id === id
        ? { ...variant, parameters: { ...variant.parameters, [field]: value } }
        : variant
    )));
  }

  function addSimulationVariant() {
    const linkedFinancialModel = buildFinancialFeasibilityModel(financialModel, salesStrategy, financialSettingsForm, operationsWorkspace, financialHorizon);
    const linkedSummary = linkedFinancialModel.summary || emptyFinancialModel.summary;
    const horizonMonths = Math.max(1, getProjectionMonthCount(financialHorizon));
    const monthlySalesUnits = Math.round(
      toFiniteNumber(linkedSummary.netSoldUnits) / horizonMonths ||
      getSalesForecastForMonth(salesStrategy, 0),
    );
    const monthlyProductionUnits = Math.max(
      monthlySalesUnits,
      Math.round(toFiniteNumber(linkedSummary.totalProduced) / horizonMonths),
    );
    const unitSalesPrice = toFiniteNumber(
      linkedSummary.averageNetPrice,
      toFiniteNumber(operationsWorkspace.product?.price, toFiniteNumber(operationsWorkspace.products[0]?.price)),
    );
    const nextIndex = simulationVariants.length + 1;
    const nextId = `variant-${Date.now()}`;
    const nextVariant = {
      ...emptySimulationVariant,
      id: nextId,
      label: copy("Variant", "Varyant") + ` ${nextIndex}`,
      name: copy("Variant", "Varyant") + ` ${nextIndex}`,
      path: `/simulation/${nextId}`,
      parameters: {
        ...emptySimulationVariant.parameters,
        baseRevenue: Math.round(toFiniteNumber(linkedSummary.salesRevenue)),
        discountPercent: 0,
        fixedCost: Math.round(toFiniteNumber(linkedSummary.extraRecurringCost)),
        grossMargin: linkedSummary.salesRevenue ? Math.max(0, Math.round((toFiniteNumber(linkedSummary.netIncome) / toFiniteNumber(linkedSummary.salesRevenue)) * 100)) : 0,
        marketShare: 0,
        reputationScore: 0,
        marketingBudget: 0,
        productionUnits: monthlyProductionUnits,
        returnRatePercent: 0,
        salesUnits: monthlySalesUnits,
        spoilagePercent: 0,
        timeHorizonMonths: horizonMonths,
        unitSalesPrice,
        variableCostRatio: linkedSummary.salesRevenue ? Math.min(95, Math.round((toFiniteNumber(linkedSummary.totalCost) / toFiniteNumber(linkedSummary.salesRevenue)) * 100)) : 0,
      },
    };

    setSimulationVariants((current) => [...current, nextVariant]);
    goTo(nextVariant.path, "login");
  }

  async function deleteSimulationVariant(id) {
    if (id === "current-situation") return;

    setSimulationStatus("");

    if (supabase && currentProfile?.company_id) {
      setSimulationLoading(true);

      try {
        await deleteSimulationVariantRecord(supabase, currentProfile.company_id, id);
        setSimulationStatus(copy("Simulation variant was deleted from Supabase.", "Simülasyon varyantı Supabase'ten silindi."));
      } catch (error) {
        setSimulationStatus(error.message);
      } finally {
        setSimulationLoading(false);
      }
    }

    setSimulationVariants((current) => current.filter((variant) => variant.id !== id));
    if (path === `/simulation/${id}`) goTo("/simulation/current-situation", "login");
  }

  function toggleTheme() {
    setTheme((current) => {
      const nextTheme = current === "dark" ? "light" : "dark";

      if (supabase && session?.user?.id) {
        supabase.from("profiles").update({ theme: nextTheme }).eq("id", session.user.id).then(({ error }) => {
          if (error) console.warn("Theme preference could not be saved.", error);
        });
      }

      return nextTheme;
    });
  }

  function ThemeToggle() {
    const isDark = theme === "dark";

    return (
      <button
        type="button"
        className="theme-toggle"
        aria-label={isDark ? labels.themeLight : labels.themeDark}
        onClick={toggleTheme}
      >
        <span>{isDark ? labels.light : labels.dark}</span>
      </button>
    );
  }

  function updateRoleForm(field, value) {
    setRoleForm((current) => ({ ...current, [field]: value }));
  }

  function updateManagedUserForm(field, value) {
    setManagedUserForm((current) => ({ ...current, [field]: value }));
  }

  function updateFinanceDateRange(field, value) {
    setFinanceDateRange((current) => ({ ...current, [field]: value }));
    setFinanceWindow("custom");
  }

  function updateOperationPlan(field, value) {
    setOperationPlan((current) => ({ ...current, [field]: value }));
  }

  function updateOperationPlanRow(collection, index, field, value) {
    setOperationPlan((current) => ({
      ...current,
      [collection]: (current[collection] || []).map((row, rowIndex) => (
        rowIndex === index ? { ...row, [field]: value } : row
      )),
    }));
  }

  function addOperationPlanRow(collection, row) {
    setOperationPlan((current) => ({
      ...current,
      [collection]: [...(current[collection] || []), row],
    }));
  }

  function removeOperationPlanRow(collection, index) {
    setOperationPlan((current) => ({
      ...current,
      [collection]: (current[collection] || []).filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function updateOperationForm(entity, field, value) {
    setOperationForms((current) => ({
      ...current,
      [entity]: {
        ...current[entity],
        [field]: value,
      },
    }));
  }

  function addProductMaterialRow() {
    setOperationForms((current) => ({
      ...current,
      product: {
        ...current.product,
        materialRows: [
          ...(current.product.materialRows || []),
          {
            materialId: operationsWorkspace.materials[0]?.id || "",
            quantityPerUnit: 0,
          },
        ],
      },
    }));
  }

  function updateProductMaterialRow(index, field, value) {
    setOperationForms((current) => ({
      ...current,
      product: {
        ...current.product,
        materialRows: (current.product.materialRows || []).map((row, rowIndex) => (
          rowIndex === index ? { ...row, [field]: value } : row
        )),
      },
    }));
  }

  function removeProductMaterialRow(index) {
    setOperationForms((current) => ({
      ...current,
      product: {
        ...current.product,
        materialRows: (current.product.materialRows || []).filter((_, rowIndex) => rowIndex !== index),
      },
    }));
  }

  async function loadOperationsData() {
    if (!supabase) return;

    setOperationsLoading(true);
    setOperationsStatus("");

    try {
      const workspace = await loadOperationsWorkspace(supabase);
      const currentPlans = getCurrentOperationPlans(workspace);
      const currentLatestPlan = currentPlans.find((plan) => plan.id === workspace.latestPlan?.id) || currentPlans[0] || null;
      setOperationsWorkspace(workspace);

      if (workspace.latestPlan) {
        const savedMachineRows = Array.isArray(workspace.latestPlan.input?.machineRows) ? workspace.latestPlan.input.machineRows : [];
        const savedMaterialRows = Array.isArray(workspace.latestPlan.input?.materialRows) ? workspace.latestPlan.input.materialRows : [];
        const savedWorkforceRows = Array.isArray(workspace.latestPlan.input?.workforceRows) ? workspace.latestPlan.input.workforceRows : [];
        const hasSimplePlanResult = currentLatestPlan?.result?.energyConsumptionKwh !== undefined;

        setOperationPlan({
          ...emptyOperationPlan,
          ...workspace.latestPlan.input,
          machineRows: savedMachineRows.length
            ? savedMachineRows.map((row) => ({
                dailyHours: row.dailyHours || 0,
                machineId: row.machineId || "",
              }))
            : (workspace.machines[0]
                ? [{ ...emptyPlanRows.machine, machineId: workspace.machines[0].id }]
                : []),
          materialRows: savedMaterialRows.length
            ? savedMaterialRows.map((row) => ({
                dailyQuantity: row.dailyQuantity ?? row.quantityPerUnit ?? 0,
                materialId: row.materialId || "",
              }))
            : workspace.materials.slice(0, 2).map((material) => ({
                dailyQuantity: 0,
                materialId: material.id,
              })),
          productId: workspace.latestPlan.input?.productId || workspace.product?.id || "",
          productName: workspace.latestPlan.input?.productName || workspace.product?.name || "",
          workforceRows: savedWorkforceRows.length
            ? savedWorkforceRows
            : (workspace.workforce[0]
                ? [{ ...emptyPlanRows.workforce, workforceId: workspace.workforce[0].id }]
                : []),
        });
        setOperationPlanResult(hasSimplePlanResult ? currentLatestPlan.result : null);
      } else if (workspace.product) {
        setOperationPlan((current) => ({
          ...current,
          machineRows: workspace.machines[0]
            ? [{ ...emptyPlanRows.machine, machineId: workspace.machines[0].id }]
            : [],
          materialRows: workspace.materials.length
            ? workspace.materials.slice(0, 2).map((material) => ({
                dailyQuantity: 0,
                materialId: material.id,
              }))
            : [],
          productId: workspace.product.id,
          productName: workspace.product.name || "",
          workforceRows: workspace.workforce[0]
            ? [{ ...emptyPlanRows.workforce, workforceId: workspace.workforce[0].id }]
            : [],
        }));
        setOperationPlanResult(null);
      }
    } catch (error) {
      setOperationsStatus(`${copy("Operations data could not be loaded:", "Operations verisi yüklenemedi:")} ${error.message}`);
    } finally {
      setOperationsLoading(false);
    }
  }

  async function handleSaveOperationPlan(event) {
    event.preventDefault();
    setOperationsStatus("");

    if (!supabase) {
      setOperationsStatus(labels.configure);
      return;
    }

    const selectedProduct = operationsWorkspace.products.find((product) => product.id === operationPlan.productId);
    const hasPositiveMachineHours = (operationPlan.machineRows || []).some((row) => row.machineId && toFiniteNumber(row.dailyHours) > 0);

    if (!selectedProduct) {
      setOperationsStatus(copy("Select a saved product with a recipe before calculating feasibility.", "Fizibilite hesaplamadan önce reçetesi olan kayıtlı bir ürün seçin."));
      return;
    }

    if (!Array.isArray(selectedProduct.material_rows) || !selectedProduct.material_rows.some((row) => toFiniteNumber(row.quantity_per_unit) > 0)) {
      setOperationsStatus(copy("Add at least one material with a positive quantity to the selected product recipe before saving a process plan.", "Süreç planını kaydetmeden önce seçili ürün reçetesine pozitif miktarlı en az bir malzeme ekleyin."));
      return;
    }

    if (!hasPositiveMachineHours) {
      setOperationsStatus(copy("Add at least one machine with daily hours greater than zero.", "Günlük saati sıfırdan büyük en az bir makine ekleyin."));
      return;
    }

    setOperationsLoading(true);

    try {
      const savedPlan = await saveOperationResourcePlan(supabase, {
        ...operationPlan,
      });

      setOperationPlan({ ...emptyOperationPlan, ...savedPlan.input });
      setOperationPlanResult(savedPlan.result);
      setOperationsStatus(copy(
        "Resource plan was saved to Supabase and calculated by the backend function.",
        "Kaynak planı Supabase veritabanına kaydedildi ve backend fonksiyonunda hesaplandı.",
      ));
      await loadOperationsData();
      await loadFinancialData();
    } catch (error) {
      setOperationsStatus(error.message);
    } finally {
      setOperationsLoading(false);
    }
  }

  async function handleSaveOperationRecord(entity, event) {
    event.preventDefault();
    setOperationsStatus("");

    if (!supabase) {
      setOperationsStatus(labels.configure);
      return;
    }

    setOperationsLoading(true);

    try {
      const formInput = operationForms[entity];
      const recordInput = entity === "product"
        ? {
            ...formInput,
            cycleTimeMinutes: getCycleTimeMinutes(formInput.cycleTimeValue, formInput.cycleTimeUnit),
            cycleTimeUnit: normalizeCycleTimeUnit(formInput.cycleTimeUnit),
            productId: formInput.id || "",
          }
        : formInput;

      await saveOperationRecord(supabase, entity, {
        ...recordInput,
        productId: entity === "product" ? recordInput.productId : operationPlan.productId || operationsWorkspace.product?.id,
      });

      setOperationForms((current) => ({ ...current, [entity]: emptyOperationForms[entity] }));
      setOperationsStatus(copy("Operations record was saved to Supabase.", "Operations kaydı Supabase veritabanına kaydedildi."));
      await loadOperationsData();
    } catch (error) {
      setOperationsStatus(error.message);
    } finally {
      setOperationsLoading(false);
    }
  }

  async function loadFinancialData(nextHorizon = financialHorizon) {
    if (!supabase) return;

    setFinancialHorizon(nextHorizon);
    setFinancialLoading(true);
    setFinancialStatus("");

    try {
      const nextModel = await loadFinancialModel(supabase, nextHorizon);
      const nextSettings = {
        ...defaultFinancialSettings,
        ...(nextModel.settings || {}),
      };
      setFinancialModel(nextModel);
      setFinancialSettingsForm({
        ...nextSettings,
        loanRows: Array.isArray(nextSettings.loanRows) && nextSettings.loanRows.length
          ? nextSettings.loanRows
          : getFinancialLoanRows(nextSettings),
      });
    } catch (error) {
      setFinancialStatus(`${copy("Financial model could not be loaded:", "Finansal model yüklenemedi:")} ${error.message}`);
    } finally {
      setFinancialLoading(false);
    }
  }

  async function handleSaveFinancialSettings(event) {
    event.preventDefault();
    setFinancialStatus("");

    if (!supabase) {
      setFinancialStatus(labels.configure);
      return;
    }

    setFinancialLoading(true);

    try {
      await saveFinancialModelSettings(supabase, financialSettingsForm);
      setFinancialStatus(copy("Financial assumptions were saved to Supabase.", "Finansal varsayımlar Supabase'e kaydedildi."));
      await loadFinancialData();
    } catch (error) {
      setFinancialStatus(error.message);
    } finally {
      setFinancialLoading(false);
    }
  }

  function toggleFinancialOverviewWidget(widgetId) {
    setFinancialOverviewWidgets((current) => (
      current.includes(widgetId)
        ? current.filter((id) => id !== widgetId)
        : [...current, widgetId]
    ));
  }

  async function saveFinancialOverviewScreen() {
    setFinancialStatus("");

    if (!supabase || !session?.user?.id) {
      setFinancialStatus(labels.configure);
      return;
    }

    setFinancialLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ financial_overview_widgets: financialOverviewWidgets })
        .eq("id", session.user.id);

      if (error) throw error;

      setCurrentProfile((current) => current ? { ...current, financial_overview_widgets: financialOverviewWidgets } : current);
      setFinancialStatus(copy("Financial analysis screen was saved.", "Finansal analiz ekranı kaydedildi."));
    } catch (error) {
      setFinancialStatus(error.message);
    } finally {
      setFinancialLoading(false);
    }
  }

  async function handleSaveFinancialExtraCost(event) {
    event.preventDefault();
    setFinancialStatus("");

    if (!supabase) {
      setFinancialStatus(labels.configure);
      return;
    }

    setFinancialLoading(true);

    try {
      await saveFinancialExtraCost(supabase, financialExtraCostForm);
      setFinancialExtraCostForm(emptyFinancialExtraCostForm);
      setFinancialStatus(copy("Extra financial cost was saved to Supabase.", "Ek finansal gider Supabase'e kaydedildi."));
      await loadFinancialData();
    } catch (error) {
      setFinancialStatus(error.message);
    } finally {
      setFinancialLoading(false);
    }
  }

  async function loadPlanningData() {
    if (!supabase) return;

    setSalesLoading(true);
    setSimulationLoading(true);
    setSalesStatus("");
    setSimulationStatus("");

    try {
      const [nextSalesStrategy, nextSimulationVariants] = await Promise.all([
        loadSalesStrategy(supabase),
        loadSimulationVariants(supabase),
      ]);

      setSalesStrategy(nextSalesStrategy);
      setSimulationVariants(nextSimulationVariants);
    } catch (error) {
      setSalesStatus(`${copy("Planning data could not be loaded:", "Planlama verisi yüklenemedi:")} ${error.message}`);
      setSimulationStatus(`${copy("Planning data could not be loaded:", "Planlama verisi yüklenemedi:")} ${error.message}`);
    } finally {
      setSalesLoading(false);
      setSimulationLoading(false);
    }
  }

  async function handleSaveSalesStrategy() {
    setSalesStatus("");

    if (!supabase) {
      setSalesStatus(labels.configure);
      return;
    }

    if (!currentProfile?.company_id) {
      setSalesStatus(copy("Company profile is still loading.", "Şirket profili henüz yükleniyor."));
      return;
    }

    const validationMessage = validateSalesStrategy();
    if (validationMessage) {
      setSalesStatus(validationMessage);
      return;
    }

    setSalesLoading(true);

    try {
      await saveSalesStrategy(supabase, currentProfile.company_id, salesStrategy);
      await loadPlanningData();
      setSalesStatus(copy("Sales strategy was saved to Supabase.", "Satış stratejisi Supabase'e kaydedildi."));
    } catch (error) {
      setSalesStatus(error.message);
    } finally {
      setSalesLoading(false);
    }
  }

  async function persistSimulationVariant(variant) {
    setSimulationStatus("");

    if (!supabase) {
      setSimulationStatus(labels.configure);
      return;
    }

    if (!currentProfile?.company_id) {
      setSimulationStatus(copy("Company profile is still loading.", "Şirket profili henüz yükleniyor."));
      return;
    }

    setSimulationLoading(true);

    try {
      await saveSimulationVariant(supabase, currentProfile.company_id, variant);
      await loadPlanningData();
      setSimulationStatus(copy("Simulation variant was saved to Supabase.", "Simülasyon varyantı Supabase'e kaydedildi."));
    } catch (error) {
      setSimulationStatus(error.message);
    } finally {
      setSimulationLoading(false);
    }
  }

  async function handleCreateOperationNote() {
    setOperationsStatus("");

    if (!supabase) {
      setOperationsStatus(labels.configure);
      return;
    }

    if (!operationsWorkspace.product?.id) {
      setOperationsStatus(copy("Select or create a product before adding notes.", "Not eklemeden önce bir ürün seçin veya oluşturun."));
      return;
    }

    const note = window.prompt(copy("New product note", "Yeni ürün notu"))?.trim();
    if (!note) return;

    setOperationsLoading(true);
    try {
      const { error } = await supabase.from("operation_notes").insert({
        created_by: session?.user?.id,
        note,
        product_id: operationsWorkspace.product.id,
      });

      if (error) throw error;
      await loadOperationsData();
      setOperationsStatus(copy("Product note was saved.", "Ürün notu kaydedildi."));
    } catch (error) {
      setOperationsStatus(error.message);
    } finally {
      setOperationsLoading(false);
    }
  }

  function openFactoryMapFullscreen() {
    const target = document.querySelector(".factory-map-card");
    if (target?.requestFullscreen) {
      target.requestFullscreen().catch((error) => setOperationsStatus(error.message));
    }
  }

  function focusOperationFlow() {
    document.querySelector(".operation-flow")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function exportReportsCsv(rows) {
    const reportRows = rows.length ? rows : [[copy("No report snapshots yet", "Henüz rapor anlık görünümü yok"), copy("Input required", "Girdi gerekli"), "-", "-", currentProfile?.username || currentProfile?.email || "Atera"]];
    const header = [copy("Report Name", "Rapor Adı"), copy("Category", "Kategori"), copy("Created Date", "Oluşturulma Tarihi"), copy("Period", "Dönem"), copy("Created By", "Oluşturan")];
    const escapeCell = (cell) => `"${String(cell ?? "").replaceAll("\"", "\"\"")}"`;
    const csv = [header, ...reportRows].map((row) => row.map(escapeCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `atera-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function normalizeRole(role) {
    const permissions = {};

    for (const permission of role.role_permissions || []) {
      const moduleKey = permission.module?.module_key;
      if (!moduleKey) continue;

      permissions[moduleKey] = {
        id: permission.id,
        moduleId: permission.module_id,
        canRead: permission.can_read,
        canWrite: permission.can_write,
      };
    }

    return { ...role, permissions };
  }

  async function loadAuthorizationData() {
    if (!supabase || !session) return;

    setAuthorizationLoading(true);
    setAuthorizationStatus("");

    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*, company:companies(name)")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;

      setCurrentProfile(profile);
      setProfilePreview(profile?.profile_picture_url ? await resolveProfilePicturePreview(profile.profile_picture_url) : "");
      if (profile?.language && ["en", "tr"].includes(profile.language)) {
        setForm((current) => ({ ...current, language: profile.language }));
      }
      if (profile?.theme && ["light", "dark"].includes(profile.theme)) {
        setTheme(profile.theme);
      }
      setFinancialOverviewWidgets(Array.isArray(profile?.financial_overview_widgets) ? profile.financial_overview_widgets : []);

      const [{ data: canRead }, { data: canWrite }] = await Promise.all([
        supabase.rpc("has_module_permission", { p_module_key: "authorization", p_permission: "read" }),
        supabase.rpc("has_module_permission", { p_module_key: "authorization", p_permission: "write" }),
      ]);

      const nextAccess = { read: Boolean(canRead), write: Boolean(canWrite) };
      setAuthorizationAccess(nextAccess);

      if (!nextAccess.read) {
        setModules([]);
        setRoles([]);
        setProfiles([]);
        return;
      }

      const [
        { data: moduleRows, error: modulesError },
        { data: roleRows, error: rolesError },
        { data: profileRows, error: profilesError },
      ] = await Promise.all([
        supabase.from("app_modules").select("id, module_key, name").order("name"),
        supabase
          .from("company_roles")
          .select("id, name, description, is_system, role_permissions(id, module_id, can_read, can_write, module:app_modules(id, module_key, name))")
          .order("is_system", { ascending: false })
          .order("name"),
        supabase
          .from("profiles")
          .select("id, username, email, phone_number, department, access_level, language, theme, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (modulesError) throw modulesError;
      if (rolesError) throw rolesError;
      if (profilesError) throw profilesError;

      setModules(moduleRows || []);
      setRoles((roleRows || []).map(normalizeRole));
      setProfiles(profileRows || []);
    } catch (error) {
      setAuthorizationStatus(`${labels.loadAuthorizationError} ${error.message}`);
      setAuthorizationAccess({ read: false, write: false });
      setModules([]);
      setRoles([]);
      setProfiles([]);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  async function handleCreateRole(event) {
    event.preventDefault();
    setAuthorizationStatus("");

    if (!supabase || !currentProfile?.company_id || !authorizationAccess.write) return;

    const nextName = roleForm.name.trim().toLowerCase();
    if (!nextName) return;
    if (isAdminRole(nextName)) {
      setAuthorizationStatus(copy("Admin role is managed by the system and cannot be recreated or edited here.", "Admin rolü sistem tarafından yönetilir; burada yeniden oluşturulamaz veya düzenlenemez."));
      return;
    }

    setAuthorizationLoading(true);
    try {
      const { data: role, error: roleError } = await supabase
        .from("company_roles")
        .insert({
          company_id: currentProfile.company_id,
          name: nextName,
          description: roleForm.description.trim() || null,
        })
        .select("id")
        .single();

      if (roleError) throw roleError;

      if (modules.length) {
        const { error: permissionError } = await supabase.from("role_permissions").insert(
          modules.map((module) => ({
            role_id: role.id,
            module_id: module.id,
            can_read: false,
            can_write: false,
          })),
        );

        if (permissionError) throw permissionError;
      }

      setRoleForm(emptyRoleForm);
      await loadAuthorizationData();
    } catch (error) {
      setAuthorizationStatus(error.message);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  async function updatePermission(role, module, field, checked) {
    if (!supabase || !authorizationAccess.write) return;
    if (isAdminRole(role)) return;

    const existing = role.permissions[module.module_key];
    const nextPermission = {
      can_read: field === "can_read" ? checked : Boolean(existing?.canRead),
      can_write: field === "can_write" ? checked : Boolean(existing?.canWrite),
    };

    setAuthorizationLoading(true);
    setAuthorizationStatus("");

    try {
      const payload = {
        role_id: role.id,
        module_id: module.id,
        ...nextPermission,
      };

      const query = existing?.id
        ? supabase.from("role_permissions").update(nextPermission).eq("id", existing.id)
        : supabase.from("role_permissions").insert(payload);

      const { error } = await query;
      if (error) throw error;

      await loadAuthorizationData();
    } catch (error) {
      setAuthorizationStatus(error.message);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  async function handleCreateManagedUser(event) {
    event.preventDefault();
    setAuthorizationStatus("");

    if (!supabase || !currentProfile?.company?.name || !authorizationAccess.write) return;

    setAuthorizationLoading(true);
    try {
      const adminSession = session;
      const { data, error } = await supabase.auth.signUp({
        email: managedUserForm.email.trim(),
        password: managedUserForm.password,
        options: {
          data: {
            username: managedUserForm.username.trim(),
            phone_number: managedUserForm.phoneNumber.trim(),
            company: currentProfile.company.name,
            department: managedUserForm.department.trim(),
            access_level: managedUserForm.accessLevel,
            language: managedUserForm.language,
            theme,
          },
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error(labels.missingUser);

      if (data.session && adminSession?.access_token && adminSession?.refresh_token) {
        const { error: restoreError } = await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });

        if (restoreError) throw restoreError;
        setSession(adminSession);
      }

      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({
          access_level: managedUserForm.accessLevel,
          department: managedUserForm.department.trim(),
          language: managedUserForm.language,
          phone_number: managedUserForm.phoneNumber.trim(),
          theme,
        })
        .eq("id", data.user.id);

      if (profileUpdateError) throw profileUpdateError;

      setManagedUserForm({ ...emptyManagedUserForm, language: form.language });
      await loadAuthorizationData();
      setAuthorizationStatus(labels.userCreated);
    } catch (error) {
      setAuthorizationStatus(error.message);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  async function resolveProfilePicturePreview(storageValue) {
    if (!storageValue || !supabase) return "";
    if (/^https?:\/\//i.test(storageValue)) return storageValue;

    const { data, error } = await supabase.storage
      .from("profile-pictures")
      .createSignedUrl(storageValue, 60 * 60);

    if (error) {
      console.warn("Profile picture preview could not be signed.", error);
      return "";
    }

    return data?.signedUrl || "";
  }

  async function handleLogin(event) {
    event.preventDefault();
    setStatus("");

    if (!supabase) {
      setStatus(labels.configure);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });

      if (error) throw error;

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("profile_picture_url, language, theme")
        .single();

      setProfilePreview(userProfile?.profile_picture_url ? await resolveProfilePicturePreview(userProfile.profile_picture_url) : "");
      if (userProfile?.language && ["en", "tr"].includes(userProfile.language)) {
        setForm((current) => ({ ...current, language: userProfile.language }));
      }
      if (userProfile?.theme && ["light", "dark"].includes(userProfile.theme)) {
        setTheme(userProfile.theme);
      }
      goTo(path && !["/", "/login"].includes(path) ? path : "/dashboard", "login");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setStatus("");

    if (!supabase) {
      setStatus(labels.configure);
      return;
    }

    const resetEmail = form.email || window.prompt(labels.forgotEmailPrompt)?.trim();

    if (!resetEmail) {
      setStatus(labels.needEmail);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/login`,
    });

    setStatus(error ? error.message : labels.resetSent);
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setStatus("");

    if (!supabase) {
      setStatus(labels.configure);
      return;
    }

    if (form.password.length < 6) {
      setStatus(labels.passwordTooShort);
      return;
    }

    if (form.password !== confirmPassword) {
      setStatus(labels.passwordMismatch);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: form.password });
    setLoading(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus(labels.passwordUpdated);
    goTo("/login", "login");
    updateField("password", "");
    setConfirmPassword("");
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    goTo("/login", "login");
  }

  function renderOperationPlanner() {
    const result = operationPlanResult;
    const latestProcess = operationsWorkspace.activePlans?.[0] || operationsWorkspace.latestPlan;
    const latestProcessName = latestProcess?.plan_name || latestProcess?.input?.planName || result?.planName || "";
    const machineRows = operationPlan.machineRows || [];
    const workforceRows = operationPlan.workforceRows || [];
    const selectedProduct = operationsWorkspace.products.find((product) => product.id === operationPlan.productId);
    const selectedProductMaterials = selectedProduct?.material_rows || [];
    const defaultMachineRow = {
      ...emptyPlanRows.machine,
      machineId: operationsWorkspace.machines[0]?.id || "",
    };
    const defaultWorkforceRow = {
      ...emptyPlanRows.workforce,
      workforceId: operationsWorkspace.workforce[0]?.id || "",
    };

    return (
      <section className="operation-planner" aria-label={copy("Resource planning calculator", "Kaynak planlama hesaplayıcı")}>
        <form className="operation-card planner-input-card" onSubmit={handleSaveOperationPlan}>
          <div className="operation-card-heading">
            <div>
              <span>{copy("Process Definition", "Süreç Tanımlama")}</span>
              <h2>{copy("Simple daily production cost", "Basit günlük üretim maliyeti")}</h2>
            </div>
            <button
              type="button"
              onClick={() => setOperationPlan({
                ...emptyOperationPlan,
                machineRows: defaultMachineRow.machineId ? [defaultMachineRow] : [],
                productId: operationsWorkspace.product?.id || "",
                productName: operationsWorkspace.product?.name || "",
                workforceRows: defaultWorkforceRow.workforceId ? [defaultWorkforceRow] : [],
              })}
            >
              {copy("Load Default", "Varsayılanı Yükle")}
            </button>
          </div>
          <div className="planner-fields">
            <label>
              <span>{copy("Plan name", "Plan adı")}</span>
              <div>
                <input
                  type="text"
                  value={operationPlan.planName ?? ""}
                  onChange={(event) => updateOperationPlan("planName", event.target.value)}
                />
              </div>
            </label>
            <label>
              <span>{copy("Product", "Ürün")}</span>
              <div>
                <select
                  value={operationPlan.productId || ""}
                  onChange={(event) => {
                    const product = operationsWorkspace.products.find((item) => item.id === event.target.value);
                    setOperationPlan((current) => ({
                      ...current,
                      productId: product?.id || "",
                      productName: product?.name || "",
                    }));
                  }}
                >
                  <option value="">{copy("Select product", "Ürün seç")}</option>
                  {operationsWorkspace.products.map((product) => (
                    <option value={product.id} key={product.id}>{product.name}</option>
                  ))}
                </select>
                <small>{selectedProduct ? `${formatLira(selectedProduct.price, 2)} / ${selectedProduct.unit || copy("pcs", "adet")}` : copy("Select a record from the Products screen", "Ürünler ekranından kayıt seçin")}</small>
              </div>
            </label>
          </div>

          <div className="resource-section">
            <div className="resource-section-header">
              <div>
                <span>{copy("Machine selection", "Makine seçimi")}</span>
                <p>{copy("Enter which machine will be used and how many hours per day it will run for the product.", "Ürünü üretirken hangi makinenin günde kaç saat kullanılacağını girin.")}</p>
              </div>
              <button type="button" onClick={() => addOperationPlanRow("machineRows", defaultMachineRow)}>
                {copy("Add Machine", "Makine Ekle")}
              </button>
            </div>
            <div className="resource-row-list">
              {machineRows.length ? machineRows.map((row, index) => {
                const selectedMachine = operationsWorkspace.machines.find((machine) => machine.id === row.machineId);

                return (
                  <div className="resource-row-grid machine-plan-row" key={`machine-${index}`}>
                    <label>
                      <span>{copy("Machine", "Makine")}</span>
                      <select value={row.machineId || ""} onChange={(event) => updateOperationPlanRow("machineRows", index, "machineId", event.target.value)}>
                        <option value="">{copy("Select machine", "Makine seç")}</option>
                        {operationsWorkspace.machines.map((machine) => (
                          <option value={machine.id} key={machine.id}>
                            {machine.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>{copy("Daily hours", "Günlük saat")}</span>
                      <input
                        min="0"
                        step="0.25"
                        type="number"
                        value={row.dailyHours ?? ""}
                        onChange={(event) => updateOperationPlanRow("machineRows", index, "dailyHours", event.target.value)}
                      />
                    </label>
                    <div className="resource-row-meta">
                      <strong>{selectedMachine ? `${formatNumber(selectedMachine.hourly_energy_consumption_kwh, 2)} ${copy("kWh/hour", "kWh/saat")}` : "-"}</strong>
                      <small>{selectedMachine ? `${copy("Machine price", "Makine fiyatı")} ${formatLira(selectedMachine.price)}` : copy("No record selected", "Kayıt seçilmedi")}</small>
                    </div>
                    <button type="button" className="resource-remove-button" onClick={() => removeOperationPlanRow("machineRows", index)}>
                      {copy("Delete", "Sil")}
                    </button>
                  </div>
                );
              }) : (
                <p className="planner-empty-state">{copy("No machine records yet. Add a real machine from Machines & Equipment first.", "Makine kaydı yok. Önce Makine & Ekipman ekranından gerçek makine ekleyin.")}</p>
              )}
            </div>
          </div>

          <div className="resource-section">
            <div className="resource-section-header">
              <div>
                <span>{copy("Workforce selection", "İşgücü seçimi")}</span>
                <p>{copy("Enter how many people from each role will work and for how many hours per day.", "Hangi rolden kaç kişinin günde kaç saat çalışacağını girin.")}</p>
              </div>
              <button type="button" onClick={() => addOperationPlanRow("workforceRows", defaultWorkforceRow)}>
                {copy("Add Workforce", "İşgücü Ekle")}
              </button>
            </div>
            <div className="resource-row-list">
              {workforceRows.length ? workforceRows.map((row, index) => {
                const selectedWorkforce = operationsWorkspace.workforce.find((workforce) => workforce.id === row.workforceId);

                return (
                  <div className="resource-row-grid workforce-plan-row" key={`workforce-${index}`}>
                    <label>
                      <span>{copy("Role", "Rol")}</span>
                      <select value={row.workforceId || ""} onChange={(event) => updateOperationPlanRow("workforceRows", index, "workforceId", event.target.value)}>
                        <option value="">{copy("Select role", "Rol seç")}</option>
                        {operationsWorkspace.workforce.map((workforce) => (
                          <option value={workforce.id} key={workforce.id}>
                            {workforce.role_name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>{copy("People", "Kişi")}</span>
                      <input
                        min="0"
                        step="1"
                        type="number"
                        value={row.peopleAssigned ?? ""}
                        onChange={(event) => updateOperationPlanRow("workforceRows", index, "peopleAssigned", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>{copy("Daily hours", "Günlük saat")}</span>
                      <input
                        min="0"
                        step="0.25"
                        type="number"
                        value={row.dailyHours ?? ""}
                        onChange={(event) => updateOperationPlanRow("workforceRows", index, "dailyHours", event.target.value)}
                      />
                    </label>
                    <div className="resource-row-meta">
                      <strong>{selectedWorkforce ? `${formatLira(selectedWorkforce.hourly_cost)} / ${copy("hour", "saat")}` : "-"}</strong>
                      <small>{selectedWorkforce ? copy("Hourly cost is read from the Supabase record", "Saatlik maliyet Supabase kaydından okunur") : copy("No record selected", "Kayıt seçilmedi")}</small>
                    </div>
                    <button type="button" className="resource-remove-button" onClick={() => removeOperationPlanRow("workforceRows", index)}>
                      {copy("Delete", "Sil")}
                    </button>
                  </div>
                );
              }) : (
                <p className="planner-empty-state">{copy("No workforce records yet. Add a role from Human Resources first.", "İşgücü kaydı yok. Önce İnsan Kaynağı ekranından rol ekleyin.")}</p>
              )}
            </div>
          </div>

          <div className="resource-section">
            <div className="resource-section-header">
              <div>
                <span>{copy("Product materials", "Ürün malzemeleri")}</span>
                <p>{copy("Material quantities are calculated automatically from the selected product recipe and produced quantity.", "Malzeme miktarları seçilen ürün reçetesinden ve hesaplanan üretim adedinden otomatik hesaplanır.")}</p>
              </div>
            </div>
            <div className="resource-row-list">
              {selectedProductMaterials.length ? selectedProductMaterials.map((row) => (
                  <div className="resource-row-grid material-plan-row" key={row.id || row.material_id}>
                    <div className="resource-row-meta">
                      <strong>{row.material?.name || "-"}</strong>
                      <small>{formatNumber(row.quantity_per_unit, 4)} {row.material?.unit || ""} / {selectedProduct.unit || copy("pcs", "adet")}</small>
                    </div>
                    <div className="resource-row-meta">
                      <strong>{formatLira(row.material?.price_per_unit, 2)}</strong>
                      <small>{copy("Unit price", "Birim fiyat")}</small>
                    </div>
                  </div>
                )) : (
                <p className="planner-empty-state">{copy("This product has no recipe yet. Add required materials on the Products screen first.", "Bu ürün için reçete yok. Önce Ürünler ekranında gerekli malzemeleri ekleyin.")}</p>
              )}
            </div>
          </div>

          <button className="submit-button planner-save-button" disabled={operationsLoading} type="submit">
            {operationsLoading ? copy("Saving...", "Kaydediliyor...") : copy("Save to Supabase and Calculate", "Supabase'e Kaydet ve Hesapla")}
          </button>
          {operationsStatus && <p className="status-message">{operationsStatus}</p>}
        </form>

        <article className="operation-card planner-result-card">
          <div className="operation-card-heading">
            <div>
              <span>{latestProcessName || copy("Waiting for backend result", "Backend sonucu bekleniyor")}</span>
              <h2>{copy("Daily cost summary", "Günlük maliyet özeti")}</h2>
            </div>
            <mark className={result ? "ok" : "bad"}>
              {result ? `${formatNumber(result.energyConsumptionKwh, 2)} kWh` : copy("No calculation", "Hesap yok")}
            </mark>
          </div>
          {!result ? (
            <p className="planner-empty-state">
              {copy("When you save the inputs, the calculation will run in the Supabase RPC function and write the result to the operation_resource_plans table.", "Girdileri kaydettiğinizde hesap Supabase RPC fonksiyonunda yapılacak ve sonuç operation_resource_plans tablosuna yazılacak.")}
            </p>
          ) : (
            <>
              <div className="planner-summary-grid">
                <span>{copy("Product", "Ürün")} <strong>{result.productName || "-"}</strong></span>
                <span>{copy("Unit Price", "Birim Fiyat")} <strong>{formatLira(result.productPrice, 2)} / {result.productUnit || copy("pcs", "adet")}</strong></span>
                <span>{copy("Quantity to Produce", "Üretilecek Miktar")} <strong>{formatNumber(result.producedQuantity, 2)} {result.productUnit || copy("pcs", "adet")}</strong></span>
                <span>{copy("Cycle Time", "Çevrim Süresi")} <strong>{formatCycleTime(result.cycleTimeMinutes, selectedProduct?.cycle_time_unit || "minute")}</strong></span>
                <span>{copy("Electricity Consumption", "Elektrik Tüketimi")} <strong>{formatNumber(result.energyConsumptionKwh, 2)} kWh</strong></span>
                <span>{copy("Material Cost", "Malzeme Maliyeti")} <strong>{formatLira(result.materialCost)}</strong></span>
                <span>{copy("Workforce Cost", "İşgücü Maliyeti")} <strong>{formatLira(result.workforceCost)}</strong></span>
              </div>
              <div className="allocation-grid">
                <span>{copy("Machine Hours", "Makine Saati")} <strong>{formatNumber(result.machineHoursUsed, 1)} {copy("hours", "saat")}</strong></span>
                <span>{copy("Workforce Hours", "İşgücü Saati")} <strong>{formatNumber(result.workforceHoursUsed, 1)} {copy("hours", "saat")}</strong></span>
                <span>{copy("Selected Machine Value", "Seçili Makine Değeri")} <strong>{formatLira(result.selectedMachineValue)}</strong></span>
              </div>
              <div className="cost-breakdown">
                <span>{copy("Tracked Daily Cost", "Takip Edilen Günlük Maliyet")} <strong>{formatLira(result.totalTrackedDailyCost)}</strong></span>
                <span>{copy("Saved Product", "Kayıtlı Ürün")} <strong>{result.productName || "-"}</strong></span>
              </div>
              <div className="selected-resource-results">
                <div>
                  <h3>{copy("Machine breakdown", "Makine kırılımı")}</h3>
                  {(result.machineRows || []).map((row) => (
                    <span key={row.machineId}>
                      {row.name} <strong>{formatNumber(row.energyConsumptionKwh, 2)} kWh</strong>
                    </span>
                  ))}
                </div>
                <div>
                  <h3>{copy("Workforce breakdown", "İşgücü kırılımı")}</h3>
                  {(result.workforceRows || []).map((row) => (
                    <span key={row.workforceId}>
                      {row.roleName} <strong>{formatLira(row.cost)}</strong>
                    </span>
                  ))}
                </div>
                <div>
                  <h3>{copy("Material breakdown", "Malzeme kırılımı")}</h3>
                  {(result.materialRows || []).map((row) => (
                    <span key={row.materialId}>
                      {row.name} <strong>{formatLira(row.cost)}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </article>
      </section>
    );
  }

  function renderOperationRecordForm(entity, fields) {
    return (
      <form className="operation-card operation-data-form" onSubmit={(event) => handleSaveOperationRecord(entity, event)}>
        <div className="operation-data-fields">
          {fields.map((field) => (
            <label key={field.name}>
              <span>{field.label}</span>
              {field.type === "select" ? (
                <select value={operationForms[entity][field.name]} onChange={(event) => updateOperationForm(entity, field.name, event.target.value)}>
                  {field.options.map((option) => (
                    <option value={option} key={option}>{option}</option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea value={operationForms[entity][field.name]} onChange={(event) => updateOperationForm(entity, field.name, event.target.value)} />
              ) : (
                <input
                  min={field.min ?? 0}
                  step={field.step || "1"}
                  type={field.type || "text"}
                  value={operationForms[entity][field.name]}
                  onChange={(event) => updateOperationForm(entity, field.name, event.target.value)}
                />
              )}
            </label>
          ))}
        </div>
        <button className="submit-button planner-save-button" disabled={operationsLoading} type="submit">
          {operationsLoading ? copy("Saving...", "Kaydediliyor...") : copy("Save to Supabase", "Supabase'e Kaydet")}
        </button>
      </form>
    );
  }

  function renderResourcesPage() {
    const unitOptions = ["kg", "gr", "mg", "adet", "metre", "litre", "ml"];

    return renderDashboardLayout(
      "operations/resources",
        <section className="operations-workspace operations-modern">
          <div className="operations-header">
            <div>
              <span>Operations / {copy("Resources", "Kaynak")}</span>
              <h1>{copy("Resources", "Kaynak")}</h1>
              <p>{copy("Add materials, semi-finished items, and services used by production and costing workflows.", "Üretim ve maliyet akışlarında kullanılan malzeme, yarı mamül ve hizmetleri ekleyin.")}</p>
            </div>
            <div className="operations-actions">
              <button type="button" onClick={loadOperationsData}>{copy("Refresh Data", "Verileri Yenile")}</button>
            </div>
          </div>

          <div className="resource-definition-grid">
            <form className="operation-card operation-data-form resource-definition-card" onSubmit={(event) => handleSaveOperationRecord("material", event)}>
              <div className="operation-card-heading">
                <div>
                  <span>{copy("Add material", "Malzeme ekle")}</span>
                  <h2>{copy("Material", "Malzeme")}</h2>
                </div>
              </div>
              <div className="operation-data-fields">
                <label>
                  <span>{copy("Material name", "Malzeme adı")}</span>
                  <input type="text" value={operationForms.material.name} onChange={(event) => updateOperationForm("material", "name", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Unit", "Birim")}</span>
                  <select value={operationForms.material.unit} onChange={(event) => updateOperationForm("material", "unit", event.target.value)}>
                    {unitOptions.map((unit) => <option value={unit} key={unit}>{unit}</option>)}
                  </select>
                </label>
                <label>
                  <span>{copy("Unit price", "Birim fiyat")}</span>
                  <input min="0" step="0.01" type="number" value={operationForms.material.pricePerUnit} onChange={(event) => updateOperationForm("material", "pricePerUnit", event.target.value)} />
                </label>
              </div>
              <button className="submit-button planner-save-button" disabled={operationsLoading} type="submit">
                {operationsLoading ? copy("Saving...", "Kaydediliyor...") : copy("Add Material", "Malzeme Ekle")}
              </button>
            </form>

            <article className="operation-card resource-definition-card resource-list-card">
              <div className="operation-card-heading">
                <h2>{copy("Materials", "Malzemeler")}</h2>
                <span>{operationsWorkspace.materials.length} {copy("records", "kayıt")}</span>
              </div>
              <div className="compact-resource-list">
                {(operationsWorkspace.materials.length ? operationsWorkspace.materials : [{ id: "empty" }]).map((material) => (
                  <span key={material.id}>
                    <strong>{material.id === "empty" ? "-" : material.name}</strong>
                    <small>{material.id === "empty" ? "-" : `${formatLira(material.price_per_unit, 2)} / ${material.unit}`}</small>
                  </span>
                ))}
              </div>
            </article>

            <form className="operation-card operation-data-form resource-definition-card" onSubmit={(event) => handleSaveOperationRecord("workforce", event)}>
              <div className="operation-card-heading">
                <div>
                  <span>{copy("Add human resource", "İnsan kaynağı ekle")}</span>
                  <h2>{copy("Human Resources", "İnsan Kaynağı")}</h2>
                </div>
              </div>
              <div className="operation-data-fields">
                <label>
                  <span>{copy("Role", "Rol")}</span>
                  <input type="text" value={operationForms.workforce.roleName} onChange={(event) => updateOperationForm("workforce", "roleName", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Hourly cost", "Saatlik maliyet")}</span>
                  <input min="0" step="1" type="number" value={operationForms.workforce.hourlyCost} onChange={(event) => updateOperationForm("workforce", "hourlyCost", event.target.value)} />
                </label>
              </div>
              <button className="submit-button planner-save-button" disabled={operationsLoading} type="submit">
                {operationsLoading ? copy("Saving...", "Kaydediliyor...") : copy("Add Human Resource", "İnsan Kaynağı Ekle")}
              </button>
            </form>

            <article className="operation-card resource-definition-card resource-list-card">
              <div className="operation-card-heading">
                <h2>{copy("Human Resources", "İnsan Kaynağı")}</h2>
                <span>{operationsWorkspace.workforce.length} {copy("records", "kayıt")}</span>
              </div>
              <div className="compact-resource-list">
                {(operationsWorkspace.workforce.length ? operationsWorkspace.workforce : [{ id: "empty" }]).map((workforce) => (
                  <span key={workforce.id}>
                    <strong>{workforce.id === "empty" ? "-" : workforce.role_name}</strong>
                    <small>{workforce.id === "empty" ? "-" : `${formatLira(workforce.hourly_cost, 2)} / ${copy("hour", "saat")}`}</small>
                  </span>
                ))}
              </div>
            </article>

            <article className="operation-card resource-definition-card resource-guidance-card">
              <div className="operation-card-heading">
                <div>
                  <span>{copy("Semi-finished items", "Yarı mamüller")}</span>
                  <h2>{copy("Use a material record for now", "Şimdilik malzeme kaydı kullanın")}</h2>
                </div>
              </div>
              <p className="planner-empty-state">
                {copy(
                  "Semi-finished recipe nesting is not persisted yet. Add the semi-finished item as a material with a real unit price, then use it in the product recipe.",
                  "Yarı mamül reçete kırılımı henüz kalıcı değil. Yarı mamülü gerçek birim fiyatıyla malzeme olarak ekleyin, sonra ürün reçetesinde kullanın.",
                )}
              </p>
            </article>

            <article className="operation-card resource-definition-card resource-guidance-card">
              <div className="operation-card-heading">
                <div>
                  <span>{copy("Services", "Hizmetler")}</span>
                  <h2>{copy("Persist service cost in finance", "Hizmet maliyetini finansta kaydedin")}</h2>
                </div>
                <button type="button" onClick={() => goTo("/financial-modelling/girdiler", "login")}>
                  {copy("Open Financial Inputs", "Finans Girdilerini Aç")}
                </button>
              </div>
              <p className="planner-empty-state">
                {copy(
                  "Service costs affect feasibility through optional financial expenses. Use initial or recurring expense rows so they are saved in Supabase and included in the model.",
                  "Hizmet maliyetleri fizibiliteyi opsiyonel finans giderleri üzerinden etkiler. Supabase'e kaydedilip modele dahil olması için başlangıç veya tekrarlayan gider satırlarını kullanın.",
                )}
              </p>
            </article>
          </div>
          {operationsStatus && <p className="status-message">{operationsStatus}</p>}
        </section>,
    );
  }

  function renderProductDataPage() {
    const productMaterialRows = operationForms.product.materialRows || [];

    return renderDashboardLayout(
      `operations/${activeOperationsSubmodule.key}`,
        <section className="operations-workspace operations-modern">
          <div className="operations-header">
            <div>
              <span>Operations / {copy("Products", "Ürünler")}</span>
              <h1>{copy("Products", "Ürünler")}</h1>
              <p>{copy("Keep the product recipe, unit, price, and cycle time used in process definition calculations.", "Süreç tanımlama hesaplamasında kullanılacak ürün reçetesini, birimini, fiyatını ve çevrim süresini tutun.")}</p>
            </div>
            <div className="operations-actions">
              <button type="button" onClick={loadOperationsData}>{copy("Refresh Data", "Verileri Yenile")}</button>
            </div>
          </div>

          <div className="operation-data-grid">
            <form className="operation-card operation-data-form" onSubmit={(event) => handleSaveOperationRecord("product", event)}>
              <div className="operation-data-fields">
                <label>
                  <span>{copy("Product name", "Ürün adı")}</span>
                  <input
                    type="text"
                    value={operationForms.product.name}
                    onChange={(event) => updateOperationForm("product", "name", event.target.value)}
                  />
                </label>
                <label>
                  <span>{copy("Unit", "Birim")}</span>
                  <select
                    value={operationForms.product.unit}
                    onChange={(event) => updateOperationForm("product", "unit", event.target.value)}
                  >
                    {["adet", "kg", "gr", "mg", "metre", "litre", "ml"].map((unit) => (
                      <option value={unit} key={unit}>{unit}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{copy("Price", "Fiyat")}</span>
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={operationForms.product.price}
                    onChange={(event) => updateOperationForm("product", "price", event.target.value)}
                  />
                </label>
                <label>
                  <span>{copy("Cycle time", "Çevrim süresi")}</span>
                  <div className="cycle-time-control">
                    <input
                      min="0.0001"
                      step="0.01"
                      type="number"
                      value={operationForms.product.cycleTimeValue}
                      onChange={(event) => updateOperationForm("product", "cycleTimeValue", event.target.value)}
                    />
                    <select
                      aria-label={copy("Cycle time unit", "Çevrim süresi birimi")}
                      value={operationForms.product.cycleTimeUnit}
                      onChange={(event) => updateOperationForm("product", "cycleTimeUnit", event.target.value)}
                    >
                      <option value="minute">{copy("Minute", "Dakika")}</option>
                      <option value="hour">{copy("Hour", "Saat")}</option>
                      <option value="day">{copy("Day", "Gün")}</option>
                    </select>
                  </div>
                </label>
              </div>

              <div className="resource-section">
                <div className="resource-section-header">
                  <div>
                    <span>{copy("Required materials", "Gerekli malzemeler")}</span>
                    <p>{copy("Enter the materials and quantities required to produce one product unit.", "Bir ürün birimi üretmek için gereken malzemeleri ve miktarları girin.")}</p>
                  </div>
                  <button type="button" onClick={addProductMaterialRow}>{copy("Add Material", "Malzeme Ekle")}</button>
                </div>
                <div className="resource-row-list">
                  {productMaterialRows.length ? productMaterialRows.map((row, index) => {
                    const selectedMaterial = operationsWorkspace.materials.find((material) => material.id === row.materialId);

                    return (
                      <div className="resource-row-grid material-plan-row" key={`product-material-${index}`}>
                        <label>
                          <span>{copy("Material", "Malzeme")}</span>
                          <select value={row.materialId || ""} onChange={(event) => updateProductMaterialRow(index, "materialId", event.target.value)}>
                            <option value="">{copy("Select material", "Malzeme seç")}</option>
                            {operationsWorkspace.materials.map((material) => (
                              <option value={material.id} key={material.id}>{material.name}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>{copy("Quantity per unit", "Birim başına miktar")}</span>
                          <input
                            min="0"
                            step="0.0001"
                            type="number"
                            value={row.quantityPerUnit ?? ""}
                            onChange={(event) => updateProductMaterialRow(index, "quantityPerUnit", event.target.value)}
                          />
                        </label>
                        <div className="resource-row-meta">
                          <strong>{selectedMaterial?.unit || "-"}</strong>
                          <small>{selectedMaterial ? `${formatLira(selectedMaterial.price_per_unit, 2)} / ${selectedMaterial.unit}` : copy("No record selected", "Kayıt seçilmedi")}</small>
                        </div>
                        <button type="button" className="resource-remove-button" onClick={() => removeProductMaterialRow(index)}>
                          {copy("Delete", "Sil")}
                        </button>
                      </div>
                    );
                  }) : (
                    <p className="planner-empty-state">{copy("No recipe materials yet. Add materials on Material Definitions first, then connect them to the product here.", "Henüz reçete malzemesi yok. Önce Malzeme Tanımları ekranında malzeme ekleyin, sonra buradan ürüne bağlayın.")}</p>
                  )}
                </div>
              </div>

              <button className="submit-button planner-save-button" disabled={operationsLoading} type="submit">
                {operationsLoading ? copy("Saving...", "Kaydediliyor...") : copy("Save to Supabase", "Supabase'e Kaydet")}
              </button>
            </form>

            <article className="operation-card operation-data-table-card">
              <div className="operation-card-heading">
                <h2>{copy("Records", "Kayıtlar")}</h2>
                <span>{operationsWorkspace.products.length} {copy("records", "kayıt")}</span>
              </div>
              <div className="operation-data-table">
                <div className="operation-data-row operation-data-head" style={{ gridTemplateColumns: "1.2fr 0.7fr 0.8fr 0.8fr 1.4fr" }}>
                  <span>{copy("Product", "Ürün")}</span>
                  <span>{copy("Unit", "Birim")}</span>
                  <span>{copy("Price", "Fiyat")}</span>
                  <span>{copy("Cycle", "Çevrim")}</span>
                  <span>{copy("Materials", "Malzemeler")}</span>
                </div>
                {(operationsWorkspace.products.length ? operationsWorkspace.products : [{ id: "empty" }]).map((product) => (
                  <button
                    type="button"
                    className="operation-data-row operation-data-button-row"
                    style={{ gridTemplateColumns: "1.2fr 0.7fr 0.8fr 0.8fr 1.4fr" }}
                    key={product.id}
                    onClick={() => {
                      if (product.id === "empty") return;

                      setOperationForms((current) => ({
                        ...current,
                        product: {
                          ...getCycleTimeInputFromMinutes(product.cycle_time_minutes || 1, product.cycle_time_unit || "minute"),
                          id: product.id,
                          materialRows: (product.material_rows || []).map((row) => ({
                            materialId: row.material_id,
                            quantityPerUnit: row.quantity_per_unit,
                          })),
                          name: product.name || "",
                          price: product.price || 0,
                          unit: product.unit || "adet",
                        },
                      }));
                    }}
                  >
                    <span>{product.id === "empty" ? "-" : product.name}</span>
                    <span>{product.id === "empty" ? "-" : product.unit || "adet"}</span>
                    <span>{product.id === "empty" ? "-" : formatLira(product.price, 2)}</span>
                    <span>{product.id === "empty" ? "-" : formatCycleTime(product.cycle_time_minutes || 1, product.cycle_time_unit || "minute")}</span>
                    <span>{product.id === "empty" ? "-" : (product.material_rows || []).map((row) => `${row.material?.name || "-"}: ${formatNumber(row.quantity_per_unit, 4)} ${row.material?.unit || ""}`).join(", ") || "-"}</span>
                  </button>
                ))}
              </div>
            </article>
          </div>
          {operationsStatus && <p className="status-message">{operationsStatus}</p>}
        </section>,
    );
  }

  function renderActiveProcessesPage() {
    const activePlans = getCurrentOperationPlans(operationsWorkspace);

    return renderDashboardLayout(
      `operations/${activeOperationsSubmodule.key}`,
        <section className="operations-workspace operations-modern">
          <div className="operations-header">
            <div>
              <span>Operations / {copy("Active Processes", "Mevcut Süreçler")}</span>
              <h1>{copy("Active Processes", "Mevcut Süreçler")}</h1>
              <p>{copy("Track production plans saved to Supabase and their calculated production/cost results.", "Supabase'e kaydedilen üretim planlarını ve hesaplanan üretim/maliyet sonuçlarını takip edin.")}</p>
            </div>
            <div className="operations-actions">
              <button type="button" onClick={loadOperationsData}>{copy("Refresh Data", "Verileri Yenile")}</button>
              <button type="button" className="primary" onClick={() => goTo("/operations/data-entry", "login")}>{copy("New Plan", "Yeni Plan")}</button>
            </div>
          </div>

          <div className="process-summary-grid">
            <article className="operation-card process-summary-card">
              <span>{copy("Active Plan", "Aktif Plan")}</span>
              <strong>{activePlans.length}</strong>
            </article>
            <article className="operation-card process-summary-card">
              <span>{copy("Total Production", "Toplam Üretim")}</span>
              <strong>{formatNumber(activePlans.reduce((total, plan) => total + (Number(plan.result?.producedQuantity) || 0), 0), 2)}</strong>
            </article>
            <article className="operation-card process-summary-card">
              <span>{copy("Tracked Cost", "Takip Edilen Maliyet")}</span>
              <strong>{formatLira(activePlans.reduce((total, plan) => total + (Number(plan.result?.totalTrackedDailyCost) || 0), 0))}</strong>
            </article>
          </div>

          <div className="process-list">
            {activePlans.length ? activePlans.map((plan) => {
              const result = plan.result || {};
              const productName = plan.product?.name || result.productName || plan.input?.productName || "-";
              const productUnit = result.productUnit || plan.product?.unit || copy("pcs", "adet");
              const machineRows = Array.isArray(result.machineRows) ? result.machineRows : [];
              const materialRows = Array.isArray(result.materialRows) ? result.materialRows : [];

              return (
                <article className="operation-card process-card" key={plan.id}>
                  <div className="operation-card-heading">
                    <div>
                      <span>{new Date(plan.created_at).toLocaleString(locale)}</span>
                      <h2>{plan.plan_name || copy("Daily production plan", "Günlük üretim planı")}</h2>
                    </div>
                    <mark className="ok">{copy("Active", "Aktif")}</mark>
                  </div>

                  <div className="process-metrics">
                    <span>{copy("Product", "Ürün")} <strong>{productName}</strong></span>
                    <span>{copy("Quantity to Produce", "Üretilecek Miktar")} <strong>{formatNumber(result.producedQuantity, 2)} {productUnit}</strong></span>
                    <span>{copy("Cycle", "Çevrim")} <strong>{formatCycleTime(result.cycleTimeMinutes, plan.product?.cycle_time_unit || "minute")}</strong></span>
                    <span>{copy("Main Machine Hours", "Ana Makine Saati")} <strong>{formatNumber(result.primaryMachineDailyHours, 2)} {copy("hours", "saat")}</strong></span>
                    <span>{copy("Energy", "Enerji")} <strong>{formatNumber(result.energyConsumptionKwh, 2)} kWh</strong></span>
                    <span>{copy("Cost", "Maliyet")} <strong>{formatLira(result.totalTrackedDailyCost)}</strong></span>
                  </div>

                  <div className="process-detail-grid">
                    <div>
                      <h3>{copy("Machines", "Makineler")}</h3>
                      {(machineRows.length ? machineRows : [{ machineId: "empty", name: "-", dailyHours: 0 }]).map((row) => (
                        <span key={row.machineId}>
                          {row.name} <strong>{formatNumber(row.dailyHours, 2)} {copy("hours", "saat")}</strong>
                        </span>
                      ))}
                    </div>
                    <div>
                      <h3>{copy("Material Usage", "Malzeme Kullanımı")}</h3>
                      {(materialRows.length ? materialRows : [{ materialId: "empty", name: "-", dailyQuantity: 0, unit: "" }]).map((row) => (
                        <span key={row.materialId}>
                          {row.name} <strong>{formatNumber(row.dailyQuantity, 4)} {row.unit || ""}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            }) : (
              <article className="operation-card process-card">
                <p className="planner-empty-state">{copy("No production plans saved to Supabase yet. Save a plan from the process definition screen and it will appear here.", "Henüz Supabase'e kaydedilmiş üretim planı yok. Süreç tanımlama ekranından plan kaydedince burada görünecek.")}</p>
              </article>
            )}
          </div>

          {operationsStatus && <p className="status-message">{operationsStatus}</p>}
        </section>,
    );
  }

  function renderFinancialModellingPage() {
    const model = buildFinancialFeasibilityModel(financialModel, salesStrategy, financialSettingsForm, operationsWorkspace, financialHorizon);
    const summary = model.summary || emptyFinancialModel.summary;
    const chart = model.trendChart || emptyFinancialModel.trendChart;
    const currentFinancialPage = activeFinancialSubmodule || financialSubmodules[0];
    const investmentTotal = (summary.machinePurchaseCost || 0) + (summary.equipmentPurchaseCost || 0) + (summary.extraInitialCost || 0) + (summary.workingCapitalRequirement || 0);
    const returnOnInvestment = investmentTotal ? `${formatNumber(((summary.netIncome || 0) / investmentTotal) * 100, 1)}%` : "-";
    const formatMonth = (month) => (month ? `${month}. ${copy("month", "ay")}` : "-");
    const financialRowLabels = {
      electricityCost: copy("Electricity", "Elektrik"),
      equipmentPurchase: copy("Equipment investment", "Ekipman yatırımı"),
      extraInitialCost: copy("Initial extra costs", "Başlangıç ek giderleri"),
      incomeTax: copy("Income tax", "Gelir vergisi"),
      investmentGrant: copy("Investment grant / subsidy", "Yatırım / hibe"),
      loanAmount: copy("Loan financing", "Kredi finansmanı"),
      loanInterest: copy("Loan interest", "Kredi faizi"),
      loanPaymentTotal: copy("Loan payments", "Kredi ödemeleri"),
      machinePurchase: copy("Machine investment", "Makine yatırımı"),
      materialCost: copy("Raw materials and packaging", "Hammadde ve paketleme"),
      recurringExtraCost: copy("Recurring overhead", "Tekrarlayan genel gider"),
      salesRevenue: copy("Sales revenue from monthly forecast", "Aylık tahminden satış geliri"),
      vatPayable: copy("VAT payable", "Ödenecek KDV"),
      workforceCost: copy("Salaries and labor", "Maaş ve işçilik"),
      workingCapital: copy("Working capital requirement", "İşletme sermayesi ihtiyacı"),
      writeOffCost: copy("Spoilage, returns and expired write-off", "Bozulma, iade ve SKT fireleri"),
    };
    const getFinancialRowLabel = (row) => financialRowLabels[row.id] || row.label;
    const financialPageMeta = {
      inputs: {
        description: copy("Enter financial assumptions and extra costs used by the feasibility model.", "Fizibilite modelinde kullanılacak finansal varsayımları ve ek giderleri girin."),
        title: "Girdiler",
      },
      overview: {
        description: copy("Review all financial rows and the income-expense projection. Add only the widgets you want to keep on your saved screen.", "Tüm finansal satırları ve gelir-gider projeksiyonunu inceleyin. Kayıtlı ekranınızda tutmak istediğiniz widgetları ayrıca ekleyin."),
        title: copy("Cost & Return Analysis", "Maliyet & Getiri Analizi"),
      },
      loans: {
        description: copy("Add financing loans separately from optional expenses. Each loan needs its own amount, annual interest, and term.", "Finansman kredilerini opsiyonel giderlerden ayrı girin. Her kredinin tutarı, yıllık faizi ve vadesi ayrı olmalıdır."),
        title: copy("Loans", "Krediler"),
      },
      "product-cost": {
        description: copy("Product cost is calculated from active operation plans, product recipes, machine energy, workforce, materials, and recurring extra costs.", "Ürün maliyeti; aktif operasyon planları, ürün reçeteleri, makine enerjisi, işgücü, malzeme ve tekrarlayan ek giderlerden hesaplanır."),
        title: "Ürün Maliyeti",
      },
      "investment-cost": {
        description: copy("Investment cost combines machine purchase cost and initial extra costs coming from the financial model.", "Yatırım maliyeti; finansal modelden gelen makine satın alma maliyeti ve başlangıç ek giderlerini birleştirir."),
        title: "Yatırım Maliyeti",
      },
      "product-return": {
        description: copy("Product return compares operation-based sales revenue with tracked production expenses and net income.", "Ürün getirisi; operasyon bazlı satış kazançlarını takip edilen üretim giderleri ve net kazançla karşılaştırır."),
        title: "Ürün Getirisi",
      },
      "investment-return": {
        description: copy("Investment return compares net income with the current machine and initial-cost investment base.", "Yatırım getirisi; net kazancı mevcut makine ve başlangıç maliyeti yatırım tabanıyla karşılaştırır."),
        title: "Yatırım Getirisi",
      },
    }[currentFinancialPage.key];
    const metricRowsByPage = {
      "product-cost": [
        [copy("Active Process", "Mevcut Süreç"), summary.planCount],
        [copy("Working Days", "Çalışma Günü"), formatNumber(summary.workingDaysPerMonth, 1)],
        [copy("Material Cost", "Malzeme Maliyeti"), formatLira(summary.materialCost)],
        [copy("Total Expense", "Toplam Gider"), formatLira(summary.totalCost)],
      ],
      "investment-cost": [
        [copy("Initial Cash Needed", "Gerekli Başlangıç Nakit"), formatLira(summary.initialCashRequired)],
        [copy("Working Capital", "İşletme Sermayesi"), formatLira(summary.workingCapitalRequirement)],
        [copy("Loan Amount", "Kredi Tutarı"), formatLira(summary.loanAmount)],
        [copy("Total Investment", "Toplam Yatırım"), formatLira(investmentTotal)],
      ],
      "product-return": [
        [copy("Sales Revenue", "Satış Kazançları"), formatLira(summary.salesRevenue)],
        [copy("Net Sold", "Net Satılan"), formatNumber(summary.netSoldUnits)],
        [copy("Net Income", "Net Kazanç"), formatLira(summary.netIncome)],
        [copy("Required Monthly Sales", "Gerekli Aylık Satış"), formatNumber(summary.requiredMonthlySalesVolume)],
      ],
      "investment-return": [
        [copy("Net Income", "Net Kazanç"), formatLira(summary.netIncome)],
        [copy("Cash Runway", "Nakit Dayanma Süresi"), `${formatNumber(summary.cashRunwayMonths)} ${copy("mo", "ay")}`],
        [copy("Payback", "Geri Ödeme"), formatMonth(summary.paybackMonth)],
        [copy("ROI", "Yatırım Getirisi"), returnOnInvestment],
      ],
    };
    const isCostPage = currentFinancialPage.key.includes("cost");
    const isInvestmentPage = currentFinancialPage.key.includes("investment");
    const costBreakdownRows = (model.costStructure || []).filter((item) => toFiniteNumber(item.amount) > 0);
    const investmentBreakdownRows = [
      { amount: summary.machinePurchaseCost, id: "machinePurchase", label: copy("Machine investment", "Makine yatırımı") },
      { amount: summary.equipmentPurchaseCost, id: "equipmentPurchase", label: copy("Equipment investment", "Ekipman yatırımı") },
      { amount: summary.extraInitialCost, id: "extraInitialCost", label: copy("Initial extra costs", "Başlangıç ek giderleri") },
      { amount: summary.workingCapitalRequirement, id: "workingCapital", label: copy("Working capital requirement", "İşletme sermayesi ihtiyacı") },
    ].filter((item) => toFiniteNumber(item.amount) > 0);
    const returnBreakdownRows = [
      { amount: summary.salesRevenue, id: "salesRevenue", label: copy("Sales revenue", "Satış geliri"), tone: "income" },
      { amount: summary.netIncome, id: "netIncome", label: copy("Net income", "Net kazanç"), tone: "net" },
      { amount: summary.totalCashFlow, id: "cashFlow", label: copy("Total cash flow", "Toplam nakit akışı"), tone: "cash" },
    ];
    const maxCostBreakdownAmount = Math.max(1, ...costBreakdownRows.map((item) => toFiniteNumber(item.amount)));
    const maxInvestmentBreakdownAmount = Math.max(1, ...investmentBreakdownRows.map((item) => toFiniteNumber(item.amount)));
    const maxReturnBreakdownAmount = Math.max(1, ...returnBreakdownRows.map((item) => Math.abs(toFiniteNumber(item.amount))));
    const renderBreakdownBars = (rows, maxAmount, emptyLabel, tone = "cost") => (
      <div className="financial-bar-list">
        {(rows.length ? rows : [{ amount: 0, id: "empty", label: emptyLabel, tone }]).map((item) => {
          const amount = toFiniteNumber(item.amount);
          const width = item.id === "empty" ? 0 : Math.max(4, Math.min(100, (Math.abs(amount) / maxAmount) * 100));

          return (
            <div className={`financial-bar-row ${item.tone || tone}`} key={item.id || item.label}>
              <div>
                <span>{getFinancialRowLabel(item)}</span>
                <strong>{item.id === "empty" ? "-" : formatLira(amount)}</strong>
              </div>
              <i style={{ width: `${width}%` }} />
            </div>
          );
        })}
      </div>
    );
    const financialInputConfig = {
      assetValueIncreaseAnnualPercent: { label: copy("Asset value increase % / year", "Varlık değer artışı (% yıllık)"), min: "0", step: "0.01" },
      cogsInflationAnnualPercent: { label: copy("COGS inflation % / year", "SMM enflasyonu (% yıllık)"), min: "0", step: "0.01" },
      electricityPricePerKwh: { label: copy("Electricity kWh price", "Elektrik kWh fiyatı"), min: "0", step: "0.0001" },
      expenseVatRate: { label: copy("Average expense VAT %", "Ortalama gider KDV oranı (%)"), min: "0", step: "0.01" },
      incomeTaxRate: { label: copy("Corporate tax %", "Kurumlar vergisi oranı"), min: "0", step: "0.01" },
      increaseFrequency: {
        label: copy("Increase frequency", "Artış sıklığı"),
        options: [
          ["monthly", copy("Monthly", "Aylık")],
          ["quarterly", copy("Quarterly", "3 Ayda Bir")],
          ["semiannual", copy("Every 6 months", "6 Ayda Bir")],
          ["annual", copy("Annual", "Yıllık")],
        ],
        type: "select",
      },
      initialCash: { label: copy("Initial cash", "Başlangıç nakdi"), min: "0", step: "1000" },
      initialCapacityUnits: { label: copy("Initial capacity (month 1)", "Başlangıç kapasitesi (Ay 1)"), min: "0", step: "1" },
      investmentGrantAmount: { label: copy("Investment / grant to receive", "Alınacak yatırım / hibe"), min: "0", step: "1000" },
      monthlyCurrencyIncreasePercent: { label: copy("Monthly FX increase %", "Aylık döviz artışı %"), min: "0", step: "0.01" },
      monthlyEnergyPriceIncreasePercent: { label: copy("Monthly energy price increase %", "Aylık enerji fiyat artışı %"), min: "0", step: "0.01" },
      monthlyInflationPercent: { label: copy("Monthly inflation %", "Aylık enflasyon %"), min: "0", step: "0.01" },
      monthlyWageIncreasePercent: { label: copy("Monthly wage increase %", "Aylık ücret artışı %"), min: "0", step: "0.01" },
      opexInflationAnnualPercent: { label: copy("OpEx inflation % / year", "OpEx enflasyonu (% yıllık)"), min: "0", step: "0.01" },
      priceIncreaseAnnualPercent: { label: copy("Price increase policy % / year", "Fiyat artış politikası (% yıllık)"), min: "0", step: "0.01" },
      rawMaterialBufferMonths: { label: copy("Material buffer months", "Malzeme tampon ay"), min: "0", step: "0.1" },
      rawMaterialStockDays: { label: copy("Raw material stock holding days", "Hammadde stok tutma süresi (gün)"), min: "0", step: "1" },
      receivablesCollectionDays: { label: copy("Receivables collection days", "Alacak tahsil süresi (gün)"), min: "0", step: "1" },
      rentBufferMonths: { label: copy("Rent buffer months", "Kira tampon ay"), min: "0", step: "0.1" },
      salaryBufferMonths: { label: copy("Salary buffer months", "Maaş tampon ay"), min: "0", step: "0.1" },
      salesVatRate: { label: copy("Average sales VAT %", "Ortalama satış KDV oranı (%)"), min: "0", step: "0.01" },
      supplierPaymentDays: { label: copy("Supplier payment days", "Tedarikçi ödeme süresi (gün)"), min: "0", step: "1" },
      taxPaymentDelayMonths: { label: copy("Tax payment delay months", "Vergi ödeme gecikmesi (ay)"), min: "0", step: "1" },
      workingDaysPerMonth: { label: copy("Working days / month", "Aylık çalışma günü"), min: "1", step: "1" },
    };
    const renderFinancialField = (field, isRequired) => {
      const config = financialInputConfig[field];

      return (
        <label className={isRequired ? "required-financial-field" : "optional-financial-field"} key={field}>
          <span>
            {config.label}
            <small>{isRequired ? copy("Required", "Zorunlu") : copy("Optional", "Opsiyonel")}</small>
          </span>
          {config.type === "select" ? (
            <select
              aria-required={isRequired}
              required={isRequired}
              value={financialSettingsForm[field] ?? ""}
              onChange={(event) => setFinancialSettingsForm((current) => ({ ...current, [field]: event.target.value }))}
            >
              {config.options.map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          ) : (
            <input
              aria-required={isRequired}
              min={config.min}
              required={isRequired}
              step={config.step}
              type="number"
              value={financialSettingsForm[field] ?? ""}
              onChange={(event) => setFinancialSettingsForm((current) => ({ ...current, [field]: event.target.value }))}
            />
          )}
        </label>
      );
    };
    const renderFinancialInputs = () => (
      <div className="financial-controls finance-input-panel">
        <form className="financial-assumption-form" onSubmit={handleSaveFinancialSettings}>
          <section className="financial-input-section">
            <div className="financial-input-section-heading">
              <div>
                <span>{copy("Required inputs", "Zorunlu girdiler")}</span>
                <p>{copy("These assumptions must be present for the financial model to be saved.", "Finansal modelin kaydedilmesi için bu varsayımlar girilmelidir.")}</p>
              </div>
              <strong>{requiredFinancialSettingFields.length}</strong>
            </div>
            <div className="financial-input-grid">
              {requiredFinancialSettingFields.map((field) => renderFinancialField(field, true))}
            </div>
          </section>

          <section className="financial-input-section general-financial-assumptions">
            <div className="financial-input-section-heading">
              <div>
                <span>{copy("General financial assumptions", "Genel finansal varsayımlar")}</span>
                <p>{copy("Grant, tax, VAT, collection, supplier payment, stock holding and starting capacity assumptions.", "Yatırım/hibe, vergi, KDV, tahsilat, tedarikçi ödeme, stok tutma ve başlangıç kapasitesi varsayımları.")}</p>
              </div>
              <strong>{generalFinancialAssumptionFields.length}</strong>
            </div>
            <div className="financial-input-grid">
              {generalFinancialAssumptionFields.map((field) => renderFinancialField(field, true))}
            </div>
          </section>

          <section className="financial-input-section optional-macro-section">
            <div className="financial-input-section-heading">
              <div>
                <span>{copy("Optional macro assumptions", "Opsiyonel makro varsayımlar")}</span>
                <p>{copy("These percentages can inflate material, wage, energy and overhead projections month by month. Leave empty or zero to ignore.", "Bu yüzdeler malzeme, ücret, enerji ve genel gider projeksiyonlarını aylık artırabilir. Dikkate almak istemiyorsanız boş veya sıfır bırakın.")}</p>
              </div>
              <strong>{optionalMacroFinancialSettingFields.length}</strong>
            </div>
            <div className="financial-input-grid">
              {optionalMacroFinancialSettingFields.map((field) => renderFinancialField(field, false))}
            </div>
          </section>

          <section className="financial-input-section inflation-revaluation-section">
            <div className="financial-input-section-heading">
              <div>
                <span>{copy("Inflation and revaluation", "Enflasyon ve yeniden değerleme")}</span>
                <p>{copy("Annual COGS, OpEx, price increase and asset value policies. Frequency controls how annual increases step through the projection.", "Yıllık SMM, OpEx, fiyat artışı ve varlık değer politikaları. Artış sıklığı yıllık artışların projeksiyona nasıl dağıtılacağını belirler.")}</p>
              </div>
              <strong>{inflationRevaluationFinancialFields.length}</strong>
            </div>
            <div className="financial-input-grid">
              {inflationRevaluationFinancialFields.map((field) => renderFinancialField(field, true))}
            </div>
          </section>

          <button type="submit" disabled={financialLoading}>{copy("Save Assumptions", "Varsayımları Kaydet")}</button>
        </form>

        <form onSubmit={handleSaveFinancialExtraCost}>
          <label>
            <span>{copy("Optional expense name", "Opsiyonel gider adı")}</span>
            <input
              type="text"
              value={financialExtraCostForm.name}
              onChange={(event) => setFinancialExtraCostForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label>
            <span>{copy("Type", "Tip")}</span>
            <select
              value={financialExtraCostForm.costType}
              onChange={(event) => setFinancialExtraCostForm((current) => ({ ...current, costType: event.target.value }))}
            >
              <option value="initial">{copy("Initial", "Başlangıç")}</option>
              <option value="recurring">{copy("Recurring", "Tekrarlayan")}</option>
            </select>
          </label>
          <label>
            <span>{copy("Amount", "Tutar")}</span>
            <input
              min="0"
              step="0.01"
              type="number"
              value={financialExtraCostForm.amount}
              onChange={(event) => setFinancialExtraCostForm((current) => ({ ...current, amount: event.target.value }))}
            />
          </label>
          <button type="submit" disabled={financialLoading}>{copy("Add Optional Expense", "Opsiyonel Gider Ekle")}</button>
        </form>
      </div>
    );
    const financialLoanRows = Array.isArray(financialSettingsForm.loanRows) ? financialSettingsForm.loanRows : [];
    const calculatedLoanRows = getFinancialLoanRows(financialSettingsForm);
    const totalLoanAmount = calculatedLoanRows.reduce((total, loan) => total + loan.amount, 0);
    const totalMonthlyLoanPayment = calculatedLoanRows.reduce((total, loan) => total + loan.monthlyPayment, 0);
    const longestLoanTerm = calculatedLoanRows.reduce((longestTerm, loan) => Math.max(longestTerm, loan.loanTermMonths), 0);
    const longestGracePeriod = calculatedLoanRows.reduce((longestGrace, loan) => Math.max(longestGrace, loan.gracePeriodMonths), 0);
    const estimatedLoanInterest = calculatedLoanRows.reduce((total, loan) => (
      total + Math.max(0, (loan.monthlyPayment * loan.repaymentTermMonths) - loan.amount)
    ), 0);
    const renderFinancialLoans = () => (
      <form className="financial-loan-form" onSubmit={handleSaveFinancialSettings}>
        <section className="financial-loan-hero">
          <div>
            <span>{copy("Financing plan", "Finansman planı")}</span>
            <h2>{copy("Loans", "Krediler")}</h2>
            <p>{copy("Add each loan separately, including its no-payment grace period. The feasibility model starts cash payments after the grace months.", "Her krediyi ayrı ekleyin; ilk kaç ay ödeme olmayacağını belirtin. Fizibilite modeli nakit ödemeleri ödemesiz aylar bittikten sonra başlatır.")}</p>
          </div>
          <button type="button" onClick={addFinancialLoanRow}>{copy("Add Loan", "Kredi Ekle")}</button>
        </section>

        <section className="financial-loan-summary-grid">
          {[
            [copy("Total loan", "Toplam kredi"), formatLira(totalLoanAmount), copy("financing amount", "finansman tutarı")],
            [copy("Monthly payment", "Aylık ödeme"), formatLira(totalMonthlyLoanPayment), copy("after grace periods", "ödemesiz aylar sonrası")],
            [copy("Longest term", "En uzun vade"), `${formatNumber(longestLoanTerm)} ${copy("mo", "ay")}`, copy("including grace", "ödemesiz ay dahil")],
            [copy("Longest grace", "En uzun ödemesiz"), `${formatNumber(longestGracePeriod)} ${copy("mo", "ay")}`, copy("no cash payment", "nakit ödeme yok")],
            [copy("Estimated interest", "Tahmini faiz"), formatLira(estimatedLoanInterest), copy("based on current terms", "mevcut koşullara göre")],
          ].map(([label, value, detail]) => (
            <article className="financial-loan-summary-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{detail}</small>
            </article>
          ))}
        </section>

        <section className="financial-input-section optional financial-loan-section">
          <div className="financial-input-section-heading">
            <div>
              <span>{copy("Loan records", "Kredi kayıtları")}</span>
              <p>{copy("Every loan row must include amount, annual interest, grace period, and term. Leave this page empty if there is no loan.", "Her kredi satırında tutar, yıllık faiz, ödemesiz ay ve vade girilmelidir. Kredi yoksa bu sayfayı boş bırakabilirsiniz.")}</p>
            </div>
            <strong>{financialLoanRows.length}</strong>
          </div>
          <div className="financial-loan-list">
            {financialLoanRows.length ? financialLoanRows.map((loan, index) => {
              const calculatedLoan = calculatedLoanRows.find((row) => row.id === loan.id) || calculatedLoanRows[index] || {};

              return (
                <article className="financial-loan-card" key={loan.id || `loan-${index}`}>
                  <div className="financial-loan-card-heading">
                    <div>
                      <span>{copy("Loan", "Kredi")} {index + 1}</span>
                      <h3>{formatLira(toFiniteNumber(loan.amount))}</h3>
                    </div>
                    <button type="button" className="resource-remove-button" onClick={() => removeFinancialLoanRow(index)}>
                      x
                    </button>
                  </div>
                  <div className="financial-loan-row">
                    <label className="optional-financial-field">
                      <span>
                        {copy("Loan amount", "Kredi tutarı")}
                        <small>{copy("Required", "Zorunlu")}</small>
                      </span>
                      <input
                        min="0.01"
                        required
                        step="1000"
                        type="number"
                        value={loan.amount ?? ""}
                        onChange={(event) => updateFinancialLoanRow(index, "amount", event.target.value)}
                      />
                    </label>
                    <label className="optional-financial-field">
                      <span>
                        {copy("Annual interest %", "Yıllık faiz %")}
                        <small>{copy("Required", "Zorunlu")}</small>
                      </span>
                      <input
                        min="0"
                        required
                        step="0.01"
                        type="number"
                        value={loan.annualInterestRate ?? ""}
                        onChange={(event) => updateFinancialLoanRow(index, "annualInterestRate", event.target.value)}
                      />
                    </label>
                    <label className="optional-financial-field">
                      <span>
                        {copy("Grace period months", "Ödemesiz ay")}
                        <small>{copy("Required", "Zorunlu")}</small>
                      </span>
                      <input
                        min="0"
                        required
                        step="1"
                        type="number"
                        value={loan.gracePeriodMonths ?? 0}
                        onChange={(event) => updateFinancialLoanRow(index, "gracePeriodMonths", event.target.value)}
                      />
                    </label>
                    <label className="optional-financial-field">
                      <span>
                        {copy("Loan term months", "Kredi vadesi ay")}
                        <small>{copy("Required", "Zorunlu")}</small>
                      </span>
                      <input
                        min="1"
                        required
                        step="1"
                        type="number"
                        value={loan.loanTermMonths ?? ""}
                        onChange={(event) => updateFinancialLoanRow(index, "loanTermMonths", event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="financial-loan-card-metrics">
                    <span>{copy("Payment starts", "Ödeme başlangıcı")}<strong>{formatNumber((calculatedLoan.gracePeriodMonths || 0) + 1)}. {copy("month", "ay")}</strong></span>
                    <span>{copy("Repayment term", "Ödeme vadesi")}<strong>{formatNumber(calculatedLoan.repaymentTermMonths || 0)} {copy("mo", "ay")}</strong></span>
                    <span>{copy("Monthly payment", "Aylık ödeme")}<strong>{formatLira(calculatedLoan.monthlyPayment || 0)}</strong></span>
                  </div>
                </article>
              );
            }) : (
              <p className="planner-empty-state loan-empty-state">{copy("No loan added. The model will use zero loan.", "Kredi eklenmedi. Model sıfır kredi kullanacak.")}</p>
            )}
          </div>
          <div className="financial-loan-actions">
            <button type="button" onClick={addFinancialLoanRow}>{copy("Add Loan", "Kredi Ekle")}</button>
            <button type="submit" disabled={financialLoading}>{copy("Save Loans", "Kredileri Kaydet")}</button>
          </div>
        </section>
      </form>
    );
    const renderFinancialTrendCard = () => (
      <article className="financial-card financial-overview-wide">
        <div className="financial-card-heading">
          <h2>{copy("Income, Expense and Net Projection", "Gelir, Gider ve Net Projeksiyonu")}</h2>
          <div className="mini-tabs">
            {[
              ["6m", copy("6 Months", "6 Ay")],
              ["1y", copy("1 Year", "1 Yıl")],
              ["5y", copy("5 Years", "5 Yıl")],
            ].map(([value, label]) => (
              <button
                type="button"
                className={financialHorizon === value ? "active" : ""}
                onClick={() => {
                  setFinancialHorizon(value);
                  loadFinancialData(value);
                }}
                key={value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="chart-legend" aria-label={copy("Chart color legend", "Grafik renk açıklaması")}>
          <span className="legend-sales">{copy("Income", "Gelir")}</span>
          <span className="legend-costs">{copy("Expense", "Gider")}</span>
          <span className="legend-net">{copy("Net", "Net")}</span>
        </div>
        <svg className="trend-chart finance-model-chart" viewBox="0 0 560 280" role="img" aria-label={copy("Income, expense, and net projection chart", "Gelir, gider ve net projeksiyon grafiği")}>
          <text className="axis-label axis-label-y" x="-162" y="18" transform="rotate(-90)">{copy("Amount (TRY)", "Tutar (TRY)")}</text>
          <text className="axis-label axis-label-x" x="272" y="262">{copy("Projection period", "Projeksiyon dönemi")}</text>
          <path className="chart-grid" d="M30 40 H500 M30 82.5 H500 M30 125 H500 M30 167.5 H500 M30 210 H500" />
          <path className="chart-axis" d="M30 30 V210 H500" />
          <text className="chart-tick" x="30" y="214">0</text>
          <text className="chart-tick" x="24" y="44">{copy("High", "Yüksek")}</text>
          <text className="chart-tick" x="30" y="232">{copy("Start", "Başlangıç")}</text>
          <text className="chart-tick chart-tick-end" x="500" y="232">{copy("End", "Bitiş")}</text>
          {chart.salesPath && <path className="trend-line sales" d={chart.salesPath} />}
          {chart.costPath && <path className="trend-line costs" d={chart.costPath} />}
          {chart.netPath && <path className="trend-line net" d={chart.netPath} />}
        </svg>
      </article>
    );
    const overviewFinancialRows = [
      { amount: summary.salesRevenue, id: "salesRevenue", source: copy("Sales Strategy", "Satış Stratejisi"), tone: "income", type: copy("Return", "Getiri") },
      { amount: summary.investmentGrantAmount, id: "investmentGrant", source: copy("Financial inputs", "Finansal girdiler"), tone: "financing", type: copy("Grant / subsidy", "Hibe / teşvik") },
      { amount: summary.materialCost, id: "materialCost", source: copy("Operations material plans", "Operations malzeme planları"), tone: "cost", type: copy("Operating input", "Operasyon girdisi") },
      { amount: summary.workforceCost, id: "workforceCost", source: copy("Operations workforce plan", "Operations işgücü planı"), tone: "cost", type: copy("Operating input", "Operasyon girdisi") },
      { amount: summary.electricityCost, id: "electricityCost", source: copy("Operations energy x input price", "Operations enerji x girdi fiyatı"), tone: "cost", type: copy("Operating input", "Operasyon girdisi") },
      { amount: summary.expiredWriteOffCost, id: "writeOffCost", source: copy("Sales returns and spoilage", "Satış iadesi ve fire"), tone: "cost", type: copy("Risk cost", "Risk gideri") },
      { amount: summary.machinePurchaseCost, id: "machinePurchase", source: copy("Operations machines", "Operations makineleri"), tone: "investment", type: copy("Investment input", "Yatırım girdisi") },
      { amount: summary.equipmentPurchaseCost, id: "equipmentPurchase", source: copy("Operations equipment", "Operations ekipmanları"), tone: "investment", type: copy("Investment input", "Yatırım girdisi") },
      { amount: summary.extraInitialCost, id: "extraInitialCost", source: copy("Optional expenses input", "Opsiyonel gider girdisi"), tone: "investment", type: copy("Initial expense", "Başlangıç gideri") },
      { amount: summary.extraRecurringCost, id: "recurringExtraCost", source: copy("Optional expenses input", "Opsiyonel gider girdisi"), tone: "cost", type: copy("Recurring expense", "Tekrarlayan gider") },
      { amount: summary.workingCapitalRequirement, id: "workingCapital", source: copy("Financial inputs", "Finansal girdiler"), tone: "investment", type: copy("Working capital", "İşletme sermayesi") },
      { amount: summary.loanAmount, id: "loanAmount", source: copy("Loans page", "Krediler sayfası"), tone: "financing", type: copy("Financing input", "Finansman girdisi") },
      { amount: summary.loanInterest, id: "loanInterest", source: copy("Loans page", "Krediler sayfası"), tone: "cost", type: copy("Financing cost", "Finansman gideri") },
      { amount: summary.loanPaymentTotal, id: "loanPaymentTotal", source: copy("Loans page", "Krediler sayfası"), tone: "cash", type: copy("Cash outflow", "Nakit çıkışı") },
      { amount: summary.vatPayable, id: "vatPayable", source: copy("Tax inputs", "Vergi girdileri"), tone: "cost", type: copy("Tax", "Vergi") },
      { amount: summary.incomeTax, id: "incomeTax", source: copy("Tax inputs", "Vergi girdileri"), tone: "cost", type: copy("Tax", "Vergi") },
      { amount: summary.netIncome, id: "netIncome", label: copy("Net return", "Net getiri"), source: copy("Calculated", "Hesaplanan"), tone: "net", type: copy("Result", "Sonuç") },
      { amount: summary.totalCashFlow, id: "cashFlow", label: copy("Total cash flow", "Toplam nakit akışı"), source: copy("Calculated", "Hesaplanan"), tone: "cash", type: copy("Result", "Sonuç") },
    ];
    const renderOverviewFinancialRows = () => (
      <article className="financial-card income-card financial-overview-wide">
        <div className="financial-card-heading">
          <h2>{copy("Financial Rows", "Finansal Satırlar")}</h2>
          <span className="financial-row-count">{overviewFinancialRows.length} {copy("rows", "satır")}</span>
        </div>
        <div className="income-table overview-income-table">
          <div className="income-row income-head">
            <span>{copy("Item", "Kalem")}</span>
            <span>{copy("Source", "Kaynak")}</span>
            <span>{copy("Type", "Tip")}</span>
            <span>{copy("Amount", "Tutar")}</span>
          </div>
          {overviewFinancialRows.map((row, index) => (
            <div className={`income-row ${row.tone || ""}`} key={`${row.id}-${index}`}>
              <strong>{row.label || getFinancialRowLabel(row)}</strong>
              <span>{row.source}</span>
              <span>{row.type}</span>
              <span>{formatLira(row.amount)}</span>
            </div>
          ))}
        </div>
      </article>
    );
    const renderWidgetMetric = (label, value, detail) => (
      <div className="financial-widget-metric">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    );
    const renderWidgetScenarioList = (rows, emptyLabel) => (
      <div className="scenario-list">
        {(rows.length ? rows : [{ id: "empty", name: emptyLabel, costType: "-", amount: 0 }]).map((item) => (
          <div className="scenario-row" key={item.id || item.name}>
            <div>
              <strong>{item.name || getFinancialRowLabel(item)}</strong>
              <span>{item.costType === "initial" ? copy("Initial expense", "Başlangıç gideri") : item.costType === "recurring" ? copy("Recurring expense", "Tekrarlayan gider") : item.costType || "-"}</span>
            </div>
            <strong>{item.id === "empty" ? "-" : formatLira(item.amount)}</strong>
          </div>
        ))}
      </div>
    );
    const financialWidgetCatalog = [
      {
        detail: copy("Liquidity after current inputs", "Mevcut girdilerle likidite"),
        id: "cashRunway",
        render: () => renderWidgetMetric(copy("Cash Runway", "Nakit Dayanma"), `${formatNumber(summary.cashRunwayMonths)} ${copy("months", "ay")}`, copy("Uses initial cash, loans and monthly cash flow", "Başlangıç nakdi, krediler ve aylık nakit akışını kullanır")),
        title: copy("Cash Runway", "Nakit Dayanma"),
      },
      {
        detail: copy("First profitable operating month", "İlk kârlı operasyon ayı"),
        id: "breakEven",
        render: () => renderWidgetMetric(copy("Break-even", "Başa Baş"), formatMonth(summary.breakEvenMonth), copy("Revenue minus operating cost and taxes", "Gelir eksi operasyon maliyeti ve vergiler")),
        title: copy("Break-even", "Başa Baş"),
      },
      {
        detail: copy("Investment recovery estimate", "Yatırım geri dönüş tahmini"),
        id: "payback",
        render: () => renderWidgetMetric(copy("Payback", "Geri Dönüş"), formatMonth(summary.paybackMonth), copy("Investment, working capital and loan effect included", "Yatırım, işletme sermayesi ve kredi etkisi dahil")),
        title: copy("Payback", "Geri Dönüş"),
      },
      {
        detail: copy("Break-even sales volume", "Başa baş satış hacmi"),
        id: "requiredSales",
        render: () => renderWidgetMetric(copy("Required Monthly Sales", "Gerekli Aylık Satış"), formatNumber(summary.requiredMonthlySalesVolume), copy("Based on contribution per unit", "Birim katkı payına göre")),
        title: copy("Required Sales", "Gerekli Satış"),
      },
      {
        detail: copy("Forecast not sold", "Satışa dönüşmeyen tahmin"),
        id: "inventoryRisk",
        render: () => renderWidgetMetric(copy("Unsold Inventory", "Satılmayan Stok"), `${formatNumber(summary.unsoldInventoryUnits)} ${copy("units", "adet")}`, copy("Production above channel sales plan", "Kanal satış planını aşan üretim")),
        title: copy("Inventory Risk", "Stok Riski"),
      },
      {
        detail: copy("Spoilage and return write-off", "Fire ve iade maliyeti"),
        id: "writeOff",
        render: () => renderWidgetMetric(copy("Write-off Value", "Fire / İade Değeri"), formatLira(summary.expiredWriteOffCost), copy("Sales strategy return and spoilage inputs", "Satış stratejisi iade ve fire girdileri")),
        title: copy("Write-off", "Fire / İade"),
      },
      {
        detail: copy("VAT and income tax", "KDV ve gelir vergisi"),
        id: "taxLoad",
        render: () => renderWidgetMetric(copy("Tax Load", "Vergi Yükü"), formatLira(summary.vatPayable + summary.incomeTax), copy("Tax inputs from financial assumptions", "Finansal varsayımlardan gelen vergi girdileri")),
        title: copy("Tax Load", "Vergi Yükü"),
      },
      {
        detail: copy("Loan payment impact", "Kredi ödeme etkisi"),
        id: "loanSummary",
        render: () => (
          <div className="financial-widget-pair">
            {renderWidgetMetric(copy("Monthly Payment", "Aylık Ödeme"), formatLira(summary.loanPayment), copy("Current active installments", "Mevcut aktif taksitler"))}
            {renderWidgetMetric(copy("Total Loan", "Toplam Kredi"), formatLira(summary.loanAmount), copy("Saved in Loans page", "Krediler sayfasında kayıtlı"))}
          </div>
        ),
        title: copy("Loan Summary", "Kredi Özeti"),
      },
      {
        detail: copy("Operations and input cost mix", "Operasyon ve girdi maliyet karması"),
        id: "costTypes",
        render: () => renderBreakdownBars(costBreakdownRows, maxCostBreakdownAmount, copy("No cost data yet", "Henüz maliyet verisi yok"), "cost"),
        title: copy("Cost Types", "Maliyet Türleri"),
      },
      {
        detail: copy("Revenue, net and cash return", "Gelir, net ve nakit getiri"),
        id: "returnTypes",
        render: () => renderBreakdownBars(returnBreakdownRows, maxReturnBreakdownAmount, copy("No return data yet", "Henüz getiri verisi yok"), "income"),
        title: copy("Return Types", "Getiri Türleri"),
      },
      {
        detail: copy("Machine, equipment and working capital", "Makine, ekipman ve işletme sermayesi"),
        id: "investmentBreakdown",
        render: () => renderBreakdownBars(investmentBreakdownRows, maxInvestmentBreakdownAmount, copy("No investment data yet", "Henüz yatırım verisi yok"), "investment"),
        title: copy("Investment Breakdown", "Yatırım Kırılımı"),
      },
      {
        detail: copy("User-entered optional expenses", "Kullanıcının girdiği opsiyonel giderler"),
        id: "optionalExpenses",
        render: () => renderWidgetScenarioList(model.extraCosts || [], copy("No optional expense yet", "Henüz opsiyonel gider yok")),
        title: copy("Optional Expenses", "Opsiyonel Giderler"),
      },
    ];
    const selectedFinancialWidgets = financialOverviewWidgets
      .map((widgetId) => financialWidgetCatalog.find((widget) => widget.id === widgetId))
      .filter(Boolean);
    const renderOverviewWidget = (widget) => (
      <article className="financial-card financial-widget-card" key={widget.id}>
        <div className="financial-card-heading">
          <div>
            <h2>{widget.title}</h2>
            <p>{widget.detail}</p>
          </div>
          <button type="button" className="widget-remove-button" onClick={() => toggleFinancialOverviewWidget(widget.id)}>
            x
          </button>
        </div>
        {widget.render()}
      </article>
    );
    const renderWidgetSelector = () => (
      <article className="financial-card financial-widget-selector">
        <div className="financial-card-heading">
          <div>
            <h2>{copy("Add widgets to this screen", "Bu ekrana widget ekle")}</h2>
            <p>{copy("Default view stays focused on financial rows and the projection chart. Pick the metrics you want to keep on your saved screen.", "Varsayılan görünüm finansal satırlar ve projeksiyon grafiğine odaklı kalır. Kayıtlı ekranında görmek istediğin metrikleri seç.")}</p>
          </div>
          <button type="button" className="primary" onClick={saveFinancialOverviewScreen} disabled={financialLoading}>
            {copy("Save Screen", "Ekranı Kaydet")}
          </button>
        </div>
        <div className="financial-widget-picker">
          {financialWidgetCatalog.map((widget) => {
            const isSelected = financialOverviewWidgets.includes(widget.id);

            return (
              <button
                type="button"
                className={isSelected ? "selected" : ""}
                onClick={() => toggleFinancialOverviewWidget(widget.id)}
                key={widget.id}
              >
                <strong>{widget.title}</strong>
                <span>{widget.detail}</span>
              </button>
            );
          })}
        </div>
      </article>
    );
    const visibleIncomeRows = (model.incomeRows || []).filter((row) => {
      if (currentFinancialPage.key === "product-cost") return row.kind !== "income" && row.costType !== "initial";
      if (currentFinancialPage.key === "investment-cost") return row.costType === "initial" || row.id === "workingCapital";
      if (currentFinancialPage.key === "product-return") return row.costType !== "initial";
      return true;
    });

    if (currentFinancialPage.key === "inputs") {
      return renderDashboardLayout(
        `financial-modelling/${currentFinancialPage.key}`,
          <section className="financial-workspace">
            <div className="financial-header">
              <div>
                <span>{currentFinancialPage.group} / {copy("Financial assumptions", "Finansal varsayımlar")}</span>
                <h1>{financialPageMeta.title}</h1>
                <p>{financialPageMeta.description}</p>
              </div>
              <button type="button" className="primary" onClick={() => loadFinancialData()}>
                {financialLoading ? copy("Loading...", "Yükleniyor...") : copy("Update Data", "Verileri Güncelle")}
              </button>
            </div>

            {renderFinancialInputs()}
            {financialStatus && <p className="status-message">{financialStatus}</p>}

            <div className="financial-grid">
              <article className="financial-card scenario-card">
                <div className="financial-card-heading"><h2>{copy("Saved Optional Expenses", "Kayıtlı Opsiyonel Giderler")}</h2></div>
                <div className="scenario-list">
                  {(model.extraCosts?.length ? model.extraCosts : [{ id: "empty", name: copy("No extra cost yet", "Henüz ek gider yok"), costType: "-", amount: 0 }]).map((cost) => (
                    <div className="scenario-row" key={cost.id}>
                      <div>
                        <strong>{cost.name}</strong>
                        <span>{cost.costType === "initial" ? copy("Initial expense", "Başlangıç gideri") : cost.costType === "recurring" ? copy("Recurring expense", "Tekrarlayan gider") : "-"}</span>
                      </div>
                      <strong>{cost.id === "empty" ? "-" : formatLira(cost.amount)}</strong>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>,
      );
    }

    if (currentFinancialPage.key === "loans") {
      return renderDashboardLayout(
        `financial-modelling/${currentFinancialPage.key}`,
          <section className="financial-workspace">
            <div className="financial-header">
              <div>
                <span>{currentFinancialPage.group} / {copy("Financing inputs", "Finansman girdileri")}</span>
                <h1>{financialPageMeta.title}</h1>
                <p>{financialPageMeta.description}</p>
              </div>
              <button type="button" className="primary" onClick={() => loadFinancialData()}>
                {financialLoading ? copy("Loading...", "Yükleniyor...") : copy("Update Data", "Verileri Güncelle")}
              </button>
            </div>

            {financialStatus && <p className="status-message">{financialStatus}</p>}

            <div className="finance-metric-grid">
              {[
                [copy("Loan Count", "Kredi Sayısı"), formatNumber(financialLoanRows.length), copy("separate financing records", "ayrı finansman kaydı")],
                [copy("Total Loan Amount", "Toplam Kredi Tutarı"), formatLira(totalLoanAmount), copy("included in initial cash", "başlangıç nakdine eklenir")],
                [copy("Monthly Loan Payment", "Aylık Kredi Ödemesi"), formatLira(totalMonthlyLoanPayment), copy("sum of active installments", "aktif taksitlerin toplamı")],
                [copy("Longest Term", "En Uzun Vade"), longestLoanTerm ? `${formatNumber(longestLoanTerm)} ${copy("months", "ay")}` : "-", copy("used for repayment schedule", "ödeme planında kullanılır")],
              ].map(([label, value, detail]) => (
                <article className="finance-metric-card" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>{detail}</small>
                </article>
              ))}
            </div>

            {renderFinancialLoans()}
          </section>,
      );
    }

    if (currentFinancialPage.key === "overview") {
      return renderDashboardLayout(
        `financial-modelling/${currentFinancialPage.key}`,
          <section className="financial-workspace">
            <div className="financial-header">
              <div>
                <span>{currentFinancialPage.group} / {copy("Model connected to Operations data", "Operations verisine bağlı model")}</span>
                <h1>{financialPageMeta.title}</h1>
                <p>{financialPageMeta.description}</p>
              </div>
              <button type="button" className="primary" onClick={() => loadFinancialData()}>
                {financialLoading ? copy("Loading...", "Yükleniyor...") : copy("Update Data", "Verileri Güncelle")}
              </button>
            </div>

            {financialStatus && <p className="status-message">{financialStatus}</p>}

            {renderWidgetSelector()}

            <div className="financial-overview-grid">
              {renderOverviewFinancialRows()}
              {renderFinancialTrendCard()}
            </div>

            {selectedFinancialWidgets.length > 0 && (
              <div className="financial-widget-grid">
                {selectedFinancialWidgets.map(renderOverviewWidget)}
              </div>
            )}
          </section>,
      );
    }

    return renderDashboardLayout(
      `financial-modelling/${currentFinancialPage.key}`,
        <section className="financial-workspace">
          <div className="financial-header">
            <div>
              <span>{currentFinancialPage.group} / {copy("Model connected to Operations data", "Operations verisine bağlı model")}</span>
              <h1>{financialPageMeta.title}</h1>
              <p>{financialPageMeta.description}</p>
            </div>
            <button type="button" className="primary" onClick={() => loadFinancialData()}>
              {financialLoading ? copy("Loading...", "Yükleniyor...") : copy("Update Data", "Verileri Güncelle")}
            </button>
          </div>

          {financialStatus && <p className="status-message">{financialStatus}</p>}

          <div className="finance-metric-grid">
            {metricRowsByPage[currentFinancialPage.key].map(([label, value]) => (
              <article className="finance-metric-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{copy("Feasibility model result", "Fizibilite model sonucu")}</small>
              </article>
            ))}
          </div>

          <div className="financial-feasibility-grid">
            {[
              [copy("Forecast Sales", "Tahmini Satış"), formatNumber(summary.forecastSalesUnits), copy("from Sales Strategy monthly inputs", "Satış Stratejisi aylık girdilerinden")],
              [copy("Unsold Inventory", "Satılmayan Stok"), formatNumber(summary.unsoldInventoryUnits), copy("production above channel sales plan", "kanal satış planını aşan üretim")],
              [copy("Write-off Value", "Fire / İade Değeri"), formatLira(summary.expiredWriteOffCost), copy("spoilage, returns and expired products", "bozulma, iade ve SKT ürünler")],
              [copy("Cash Runway", "Nakit Dayanma"), `${formatNumber(summary.cashRunwayMonths)} ${copy("months", "ay")}`, copy("with entered initial cash", "girilen başlangıç nakdiyle")],
              [copy("Break-even", "Başa Baş"), formatMonth(summary.breakEvenMonth), copy("first profitable operating month", "ilk kârlı operasyon ayı")],
              [copy("Payback", "Geri Dönüş"), formatMonth(summary.paybackMonth), copy("investment plus working capital", "yatırım ve işletme sermayesi")],
              [copy("Initial Cash Needed", "Gerekli Başlangıç Nakdi"), formatLira(summary.initialCashRequired), copy("own cash after loan", "kredi sonrası öz nakit")],
              [copy("Monthly Loan Payment", "Aylık Kredi Ödemesi"), formatLira(summary.loanPayment), copy("principal and interest", "anapara ve faiz")],
              [copy("Required Monthly Sales", "Gerekli Aylık Satış"), formatNumber(summary.requiredMonthlySalesVolume), copy("break-even volume estimate", "başa baş hacim tahmini")],
              [copy("Channel Commission", "Kanal Komisyonu"), formatLira(summary.retailerMarginCost), copy("commission deducted from channel sales", "kanal satışlarından düşülen komisyon")],
              [copy("Payment Delay", "Ödeme Vadesi"), `${formatNumber(summary.weightedPaymentDelayDays, 1)} ${copy("days", "gün")}`, copy("weighted channel delay", "ağırlıklı kanal vadesi")],
              [copy("VAT + Tax", "KDV + Vergi"), formatLira(summary.vatPayable + summary.incomeTax), copy("basic tax handling", "temel vergi hesabı")],
            ].map(([label, value, detail]) => (
              <article className="financial-feasibility-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </div>

          <div className="financial-grid">
            <article className="financial-card income-card">
              <div className="financial-card-heading"><h2>{isCostPage ? copy("Cost Calculation Rows", "Maliyet Hesap Satırları") : copy("Return Calculation Rows", "Getiri Hesap Satırları")}</h2></div>
              <div className="income-table simplified-income-table">
                <div className="income-row income-head"><span>{copy("Item", "Kalem")}</span><span>{copy("Type", "Tip")}</span><span>{copy("Amount", "Tutar")}</span></div>
                {visibleIncomeRows.map((row, index) => (
                  <div className="income-row" key={`${row.label}-${index}`}>
                    <strong>{getFinancialRowLabel(row)}</strong>
                    <span>{row.kind === "income" ? copy("Income", "Gelir") : row.costType === "initial" ? copy("Initial expense", "Başlangıç gideri") : copy("Expense", "Gider")}</span>
                    <span>{formatLira(row.amount)}</span>
                  </div>
                ))}
                <div className="income-row income-total">
                  <strong>{isCostPage ? copy("Selected cost total", "Seçili maliyet toplamı") : copy("Net income", "Net kazanç")}</strong>
                  <span>{isCostPage ? currentFinancialPage.group : copy("Income - expense", "Gelir - gider")}</span>
                  <span>{isCostPage ? formatLira(isInvestmentPage ? investmentTotal : summary.totalCost) : formatLira(summary.netIncome)}</span>
                </div>
              </div>
            </article>

            <article className="financial-card trend-card">
            <div className="financial-card-heading">
              <h2>{copy("Financial Trends", "Finansal Trendler")}</h2>
              <div className="mini-tabs">
                {[
                  ["6m", copy("6 Months", "6 Ay")],
                  ["1y", copy("1 Year", "1 Yıl")],
                  ["5y", copy("5 Years", "5 Yıl")],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    className={financialHorizon === value ? "active" : ""}
                    onClick={() => {
                      setFinancialHorizon(value);
                      loadFinancialData(value);
                    }}
                    key={value}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="chart-legend" aria-label={copy("Chart color legend", "Grafik renk açıklaması")}>
              <span className="legend-sales">{copy("Sales revenue", "Satış kazançları")}</span>
              <span className="legend-costs">{copy("Expenses", "Giderler")}</span>
              <span className="legend-net">{copy("Net income", "Net kazanç")}</span>
            </div>
              <svg className="trend-chart finance-model-chart" viewBox="0 0 560 280" role="img" aria-label={copy("Sales revenue, expenses, and net income projection chart", "Satış kazançları, giderler ve net kazanç projeksiyon grafiği")}>
                <text className="axis-label axis-label-y" x="-162" y="18" transform="rotate(-90)">{copy("Amount (TRY)", "Tutar (TRY)")}</text>
                <text className="axis-label axis-label-x" x="272" y="262">{copy("Projection period", "Projeksiyon dönemi")}</text>
                <path className="chart-grid" d="M30 40 H500 M30 82.5 H500 M30 125 H500 M30 167.5 H500 M30 210 H500" />
                <path className="chart-axis" d="M30 30 V210 H500" />
                <text className="chart-tick" x="30" y="214">0</text>
                <text className="chart-tick" x="24" y="44">{copy("High", "Yüksek")}</text>
                <text className="chart-tick" x="30" y="232">{copy("Start", "Başlangıç")}</text>
                <text className="chart-tick chart-tick-end" x="500" y="232">{copy("End", "Bitiş")}</text>
                {chart.salesPath && <path className="trend-line sales" d={chart.salesPath} />}
                {chart.costPath && <path className="trend-line costs" d={chart.costPath} />}
                {chart.netPath && <path className="trend-line net" d={chart.netPath} />}
              </svg>
            </article>

            <article className="financial-card cost-card">
              <h2>{isInvestmentPage ? copy("Investment Structure", "Yatırım Yapısı") : copy("Cost Structure", "Maliyet Yapısı")}</h2>
              <div className="cost-body">
                <div className="donut-chart cost-donut" aria-hidden="true"><span>{formatLira(isInvestmentPage ? investmentTotal : summary.totalCost)}</span></div>
                <div className="cost-list">
                  {(isInvestmentPage
                    ? [
                        { amount: summary.machinePurchaseCost, label: copy("Machine investment", "Makine yatırımı") },
                        { amount: summary.extraInitialCost, label: copy("Initial extra costs", "Başlangıç ek giderleri") },
                      ]
                    : (model.costStructure || [])
                  ).map((item) => (
                    <span key={item.id || item.label}>{getFinancialRowLabel(item)}<strong>{formatLira(item.amount)}</strong></span>
                  ))}
                </div>
              </div>
            </article>

            <article className="financial-card scenario-card">
              <div className="financial-card-heading"><h2>{isCostPage ? copy("Extra Costs", "Ek Giderler") : copy("Return Notes", "Getiri Notları")}</h2></div>
              <div className="scenario-list">
                {(isCostPage
                  ? (model.extraCosts?.length ? model.extraCosts : [{ id: "empty", name: copy("No extra cost yet", "Henüz ek gider yok"), costType: "-", amount: 0 }])
                  : [
                      { amount: summary.salesRevenue, costType: "income", id: "sales", name: copy("Sales revenue from monthly forecast", "Aylık tahminden satış geliri") },
                      { amount: summary.netIncome, costType: "income", id: "net", name: copy("Net return after tracked costs", "Takip edilen maliyetlerden sonra net getiri") },
                      { amount: summary.expiredWriteOffCost, costType: "income", id: "writeoff-note", name: copy("Spoilage and return write-off", "Bozulma ve iade fire maliyeti") },
                      { amount: summary.vatPayable + summary.incomeTax, costType: "income", id: "tax-note", name: copy("VAT and income tax", "KDV ve gelir vergisi") },
                    ]
                ).map((cost) => (
                  <div className="scenario-row" key={cost.id}>
                    <div>
                      <strong>{cost.name}</strong>
                      <span>{cost.costType === "initial" ? copy("Initial expense", "Başlangıç gideri") : cost.costType === "recurring" ? copy("Recurring expense", "Tekrarlayan gider") : cost.costType === "income" ? copy("Calculated return", "Hesaplanan getiri") : "-"}</span>
                    </div>
                    <strong>{cost.id === "empty" ? "-" : formatLira(cost.amount)}</strong>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>,
    );
  }

  function renderSimulationPage() {
    const variant = activeSimulationVariant || simulationVariants[0];
    const parameters = variant.parameters || {};
    const numberParam = (field) => Number(parameters[field]) || 0;
    const positiveParam = (field, fallback = 0) => {
      const value = Number(parameters[field]);
      return Number.isFinite(value) && value > 0 ? value : fallback;
    };
    const finiteParam = (field, fallback = 0) => {
      const value = Number(parameters[field]);
      return Number.isFinite(value) ? value : fallback;
    };
    const linkedFinancialModel = buildFinancialFeasibilityModel(financialModel, salesStrategy, financialSettingsForm, operationsWorkspace, financialHorizon);
    const linkedSummary = linkedFinancialModel.summary || emptyFinancialModel.summary;
    const defaultHorizonMonths = Math.max(1, getProjectionMonthCount(financialHorizon));
    const timeHorizonMonths = Math.max(1, Math.round(positiveParam("timeHorizonMonths", defaultHorizonMonths)));
    const productMap = getOperationProductMap(operationsWorkspace);
    const firstChannelProduct = salesStrategy.channels.map((channel) => productMap.get(channel.productId) || channel.product).find(Boolean);
    const defaultSalesUnits = Math.round(
      toFiniteNumber(linkedSummary.netSoldUnits) / timeHorizonMonths ||
      getSalesForecastForMonth(salesStrategy, 0),
    );
    const defaultUnitSalesPrice = toFiniteNumber(
      linkedSummary.averageNetPrice,
      toFiniteNumber(firstChannelProduct?.price, toFiniteNumber(operationsWorkspace.product?.price, toFiniteNumber(operationsWorkspace.products[0]?.price))),
    );
    const scenarioSalesUnits = Math.max(0, positiveParam("salesUnits", defaultSalesUnits));
    const scenarioUnitSalesPrice = Math.max(0, positiveParam("unitSalesPrice", defaultUnitSalesPrice));
    const scenarioProductionUnits = Math.max(
      scenarioSalesUnits,
      positiveParam("productionUnits", Math.round(toFiniteNumber(linkedSummary.totalProduced) / timeHorizonMonths) || scenarioSalesUnits),
    );
    const discountPercent = Math.min(100, Math.max(0, finiteParam("discountPercent", 0)));
    const returnRatePercent = Math.min(100, Math.max(0, finiteParam("returnRatePercent", 0)));
    const spoilagePercent = Math.min(100, Math.max(0, finiteParam("spoilagePercent", 0)));
    const discountRate = discountPercent / 100;
    const returnRate = returnRatePercent / 100;
    const spoilageRate = spoilagePercent / 100;
    const netSellableUnits = scenarioSalesUnits * Math.max(0, 1 - returnRate - spoilageRate);
    const scenarioMonthlyRevenue = netSellableUnits * scenarioUnitSalesPrice * Math.max(0, 1 - discountRate);
    const scenarioRevenueTotal = scenarioMonthlyRevenue * timeHorizonMonths;
    const unitProductionCost = Math.max(0, toFiniteNumber(linkedSummary.unitProductionCost));
    const scenarioProductionCost = scenarioProductionUnits * unitProductionCost * timeHorizonMonths;
    const baseRevenue = scenarioRevenueTotal || positiveParam("baseRevenue", toFiniteNumber(linkedSummary.salesRevenue));
    const priceEffect = numberParam("priceChange") / 100;
    const demandEffect = numberParam("demandChange") / 100;
    const campaignEffect = numberParam("campaignLift") / 100;
    const efficiencyEffect = numberParam("productionEfficiency") / 100;
    const competitorDrag = numberParam("competitorPressure") / 100;
    const simulationAlgorithm = normalizeSimulationAlgorithm(parameters.simulationAlgorithm);
    const simulationAlgorithmOptions = [
      [simulationAlgorithms.withTendency, copy("FBM Monte Carlo + bull/bear tendency", "FBM Monte Carlo + boğa/ayı eğilimi")],
      [simulationAlgorithms.withoutTendency, copy("FBM Monte Carlo without tendency", "FBM Monte Carlo eğilimsiz")],
    ];
    const simulationAlgorithmLabel = simulationAlgorithmOptions.find(([value]) => value === simulationAlgorithm)?.[1] || simulationAlgorithmOptions[0][1];
    const volatility = numberParam("volatility") / 100;
    const costVolatility = numberParam("costVolatility") / 100;
    const fixedCost = Math.max(0, positiveParam("fixedCost", toFiniteNumber(linkedSummary.extraRecurringCost)));
    const marketingBudget = Math.max(0, finiteParam("marketingBudget", 0)) * timeHorizonMonths;
    const derivedVariableCostRatio = baseRevenue ? Math.min(95, (scenarioProductionCost / baseRevenue) * 100) : 0;
    const variableCostRatio = Math.min(0.95, Math.max(0, finiteParam("variableCostRatio", derivedVariableCostRatio) / 100));
    const tendencyEffect = demandEffect + priceEffect + campaignEffect + efficiencyEffect * 0.42 - competitorDrag * 0.55;
    const appliedTendencyEffect = simulationAlgorithm === simulationAlgorithms.withoutTendency ? 0 : tendencyEffect;
    const trendAdjustedRevenue = baseRevenue * Math.max(0, 1 + appliedTendencyEffect);
    const projectedVariableCost = scenarioProductionCost || (trendAdjustedRevenue * Math.min(variableCostRatio + costVolatility * 0.22, 0.92));
    const outcomeSpread = trendAdjustedRevenue * Math.max(volatility + costVolatility * 0.65 + competitorDrag * 0.35, 0.08);
    const contributionPerUnit = Math.max(0, (scenarioUnitSalesPrice * Math.max(0, 1 - discountRate)) - unitProductionCost);
    const buildOutcome = (key, percentile, label, tone, multiplier) => {
      const revenue = trendAdjustedRevenue + outcomeSpread * multiplier;
      const variableCost = projectedVariableCost * (revenue / Math.max(trendAdjustedRevenue, 1));
      const tailCost = outcomeSpread * (multiplier < 0 ? Math.abs(multiplier) * 0.45 : -multiplier * 0.18);
      const cost = variableCost + fixedCost + marketingBudget + tailCost;
      const net = revenue - cost;
      return {
        breakEvenUnits: Math.max(0, Math.round((fixedCost + marketingBudget) / Math.max(contributionPerUnit, 1))),
        cost,
        key,
        label,
        net,
        percentile,
        revenue,
        tone,
      };
    };
    const outcomes = [
      buildOutcome("worst", "Worst 5%", copy("Highly Risky Scenario", "Çok Riskli Senaryo"), "danger", -1.32),
      buildOutcome("bad", "20th", copy("Bad Scenario", "Kötü Senaryo"), "bad", -0.72),
      buildOutcome("likely", "50th", copy("Most Likely Scenario", "En Olası Senaryo"), "likely", 0),
      buildOutcome("good", "80th", copy("Good Scenario", "İyi Senaryo"), "good", 0.78),
    ];
    const likelyOutcome = outcomes.find((outcome) => outcome.key === "likely");
    const maxRevenue = Math.max(...outcomes.map((outcome) => outcome.revenue), 1);
    const maxNetAbs = Math.max(...outcomes.map((outcome) => Math.abs(outcome.net)), 1);
    const incomeRows = [
      [copy("Sales revenue", "Satış geliri"), likelyOutcome.revenue],
      [copy("Production cost", "Üretim maliyeti"), -projectedVariableCost],
      [copy("Fixed cost", "Sabit gider"), -fixedCost],
      [copy("Marketing budget", "Pazarlama bütçesi"), -marketingBudget],
      [copy("Projected net", "Projeksiyon net"), likelyOutcome.net],
    ];
    const editableVariantGroups = [
      {
        fields: [
          ["salesUnits", copy("Monthly sales units", "Aylık satış adedi"), 0, 100000000, 1],
          ["unitSalesPrice", copy("Unit sales price", "Birim satış fiyatı"), 0, 100000000, 0.01],
          ["productionUnits", copy("Monthly production units", "Aylık üretim adedi"), 0, 100000000, 1],
        ],
        title: copy("Product and sales", "Ürün ve satış"),
      },
      {
        fields: [
          ["discountPercent", copy("Discount (%)", "İndirim (%)"), 0, 100, 0.1],
          ["returnRatePercent", copy("Returns (%)", "İade (%)"), 0, 100, 0.1],
          ["spoilagePercent", copy("Spoilage (%)", "Fire (%)"), 0, 100, 0.1],
          ["marketingBudget", copy("Monthly marketing budget", "Aylık pazarlama bütçesi"), 0, 20000000, 50000],
        ],
        title: copy("Sales conditions", "Satış koşulları"),
      },
    ];
    const visibleAssumptions = [
      [copy("Product", "Ürün"), firstChannelProduct?.name || operationsWorkspace.product?.name || "-"],
      [copy("Algorithm", "Algoritma"), simulationAlgorithmLabel],
      [copy("Monthly sales", "Aylık satış"), `${formatNumber(scenarioSalesUnits)} ${copy("units", "adet")}`],
      [copy("Net sellable units", "Net satılabilir adet"), `${formatNumber(netSellableUnits)} ${copy("units", "adet")}`],
      [copy("Unit price", "Birim fiyat"), formatLira(scenarioUnitSalesPrice, 2)],
      [copy("Unit production cost", "Birim üretim maliyeti"), unitProductionCost ? formatLira(unitProductionCost, 2) : "-"],
      [copy("Projection horizon", "Projeksiyon ufku"), `${formatNumber(timeHorizonMonths)} ${copy("months", "ay")}`],
    ];
    return renderDashboardLayout(
      `simulation/${variant.id}`,
        <section className="simulation-workspace monte-carlo-workspace">
          <div className="simulation-header">
            <div>
              <span>{dashboardCompanyName} / {copy("Monte Carlo Simulation", "Monte Carlo Simülasyonu")}</span>
              <h1>{variant.id === "current-situation" ? copy("Current Situation", "Mevcut Durum") : variant.name}</h1>
              <p>{copy("Variants are saved with simple product and sales assumptions. Outputs are recalculated from the saved operations, sales, and financial data available now.", "Varyantlar basit ürün ve satış varsayımlarıyla kaydedilir. Çıktılar kayıtlı operasyon, satış ve finans verilerinden yeniden hesaplanır.")}</p>
            </div>
            <div className="simulation-header-actions">
              <button type="button" onClick={loadPlanningData} disabled={simulationLoading}>
                {copy("Refresh Data", "Verileri Yenile")}
              </button>
              <button type="button" onClick={() => persistSimulationVariant(variant)} disabled={simulationLoading}>
                {simulationLoading ? copy("Saving...", "Kaydediliyor...") : copy("Save Variant", "Varyantı Kaydet")}
              </button>
              <button type="button" className="primary" onClick={addSimulationVariant}>{copy("Add Variant", "Varyant Ekle")}</button>
            </div>
          </div>

          {simulationStatus && <p className="status-message">{simulationStatus}</p>}

          <div className="simulation-variant-strip" role="tablist" aria-label={copy("Simulation variants", "Simülasyon varyantları")}>
            {simulationVariants.map((item) => (
              <div className={variant.id === item.id ? "simulation-variant-pill active" : "simulation-variant-pill"} key={item.id}>
                <button
                  type="button"
                  onClick={() => goTo(item.path, "login")}
                >
                  {item.id === "current-situation" ? copy("Current Situation", "Mevcut Durum") : item.name || item.label}
                </button>
                {item.id !== "current-situation" && (
                  <button
                    type="button"
                    className="variant-delete-button"
                    aria-label={copy("Delete variant", "Varyantı sil")}
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteSimulationVariant(item.id);
                    }}
                  >
                    x
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="monte-carlo-summary">
            {[
              [copy("Most likely net", "En olası net"), formatLira(likelyOutcome.net), copy("50th percentile", "50. persentil")],
              [copy("Break-even point", "Başa baş noktası"), `${formatNumber(likelyOutcome.breakEvenUnits)} ${copy("units", "adet")}`, copy("current price basis", "mevcut fiyat bazlı")],
              [copy("Worst 5% net", "En kötü %5 net"), formatLira(outcomes[0].net), copy("highly risky scenario", "çok riskli senaryo")],
              [copy("Revenue range", "Gelir aralığı"), `${formatLira(outcomes[1].revenue)} - ${formatLira(outcomes[3].revenue)}`, copy("20th to 80th percentile", "20-80 persentil")],
            ].map(([label, value, detail]) => (
              <article className="monte-carlo-stat" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </div>

          <div className="monte-carlo-grid">
            <aside className="simulation-card simulation-parameter-panel">
              <div className="simulation-card-heading">
                <div>
                  <span>{copy("Variant setup", "Varyant kurulumu")}</span>
                  <h2>{copy("Algorithm and sales assumptions", "Algoritma ve satış varsayımları")}</h2>
                </div>
              </div>
              <label className="simulation-name-field">
                <span>{copy("Variant name", "Varyant adı")}</span>
                <input value={variant.name} onChange={(event) => updateSimulationVariant(variant.id, "name", event.target.value)} />
              </label>
              <label className="simulation-name-field">
                <span>{copy("Simulation algorithm", "Simülasyon algoritması")}</span>
                <select
                  value={simulationAlgorithm}
                  onChange={(event) => updateSimulationParameter(variant.id, "simulationAlgorithm", event.target.value)}
                >
                  {simulationAlgorithmOptions.map(([value, label]) => (
                    <option value={value} key={value}>{label}</option>
                  ))}
                </select>
              </label>
              {editableVariantGroups.map((group) => (
                <div className="parameter-group" key={group.title}>
                  <h3>{group.title}</h3>
                  {group.fields.map(([field, label, min, max, step]) => (
                    <label className="sim-input-row" key={field}>
                      <span>{label}</span>
                      <input
                        min={min}
                        max={max}
                        step={step}
                        type="number"
                        value={parameters[field] ?? ""}
                        onChange={(event) => updateSimulationParameter(variant.id, field, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </aside>

            <main className="monte-carlo-main">
              <article className="simulation-card percentile-card">
                <div className="simulation-card-heading">
                  <div>
                    <span>{copy("Percentile outcomes", "Persentil çıktıları")}</span>
                    <h2>{copy("Bad, most likely, good and worst 5% scenarios", "Kötü, en olası, iyi ve en kötü %5 senaryolar")}</h2>
                  </div>
                </div>
                <div className="percentile-grid">
                  {outcomes.map((outcome) => (
                    <article className={`percentile-outcome ${outcome.tone}`} key={outcome.key}>
                      <span>{outcome.percentile}</span>
                      <h3>{outcome.label}</h3>
                      <strong>{formatLira(outcome.net)}</strong>
                      <p>{copy("Revenue", "Gelir")}: {formatLira(outcome.revenue)}</p>
                      <p>{copy("Break-even", "Başa baş")}: {formatNumber(outcome.breakEvenUnits)} {copy("units", "adet")}</p>
                    </article>
                  ))}
                </div>
              </article>

              <article className="simulation-card monte-chart-card">
                <div className="simulation-card-heading">
                  <div>
                    <span>{copy("Break-even graph", "Başa baş grafiği")}</span>
                    <h2>{copy("Revenue, cost and break-even estimate", "Gelir, gider ve başa baş tahmini")}</h2>
                  </div>
                </div>
                <svg className="monte-chart break-even-chart" viewBox="0 0 620 280" role="img" aria-label={copy("Break-even chart", "Başa baş grafiği")}>
                  <path className="chart-grid" d="M42 40 H580 M42 90 H580 M42 140 H580 M42 190 H580 M42 240 H580" />
                  <path className="chart-axis" d="M42 28 V240 H585" />
                  <path className="break-even-cost" d="M50 218 L130 202 L210 184 L290 166 L370 148 L450 130 L570 104" />
                  <path className="break-even-revenue" d="M50 232 L130 206 L210 178 L290 150 L370 122 L450 94 L570 52" />
                  <line className="break-even-marker" x1="285" x2="285" y1="42" y2="240" />
                  <text className="chart-tick" x="294" y="68">{copy("Break-even", "Başa baş")}</text>
                  <text className="chart-tick" x="48" y="262">{copy("Volume", "Hacim")}</text>
                  <text className="chart-tick chart-tick-end" x="502" y="262">{copy("Projected sales", "Projeksiyon satış")}</text>
                </svg>
                <div className="chart-legend">
                  <span className="legend-sales">{copy("Revenue", "Gelir")}</span>
                  <span className="legend-costs">{copy("Cost", "Gider")}</span>
                  <span className="legend-net">{copy("Break-even point", "Başa baş noktası")}</span>
                </div>
              </article>

              <article className="simulation-card income-simulation-card">
                <div className="simulation-card-heading">
                  <div>
                    <span>{copy("Income statement", "Gelir gider tablosu")}</span>
                    <h2>{copy("Projected gelir gider table and graph", "Projeksiyon gelir gider tablosu ve grafiği")}</h2>
                  </div>
                </div>
                <div className="sim-income-layout">
                  <div className="sim-income-table">
                    {incomeRows.map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{formatLira(value)}</strong>
                      </div>
                    ))}
                  </div>
                  <svg className="monte-chart income-bars-chart" viewBox="0 0 520 250" aria-hidden="true">
                    <path className="chart-grid" d="M34 35 H500 M34 85 H500 M34 135 H500 M34 185 H500" />
                    {incomeRows.map(([label, value], index) => {
                      const height = Math.max(14, (Math.abs(value) / Math.max(maxRevenue, maxNetAbs)) * 165);
                      const x = 58 + index * 88;
                      const y = value >= 0 ? 202 - height : 202;
                      return (
                        <React.Fragment key={label}>
                          <rect className={value >= 0 ? "income-positive" : "income-negative"} x={x} y={y} width="46" height={height} rx="6" />
                          <text className="chart-tick" x={x - 8} y="230">{index + 1}</text>
                        </React.Fragment>
                      );
                    })}
                    <path className="chart-axis" d="M34 22 V202 H500" />
                  </svg>
                </div>
              </article>
            </main>

            <aside className="simulation-side">
              <article className="simulation-card simulation-used-params">
                <div className="simulation-card-heading">
                  <div>
                    <span>{copy("Scenario summary", "Senaryo özeti")}</span>
                    <h2>{copy("Visible assumptions", "Görünen varsayımlar")}</h2>
                  </div>
                </div>
                <div className="used-parameter-list">
                  {visibleAssumptions.map(([label, value]) => (
                    <span key={label}>{label}<strong>{value}</strong></span>
                  ))}
                </div>
              </article>

              <article className="simulation-card path-preview-card">
                <div className="simulation-card-heading">
                  <div>
                    <span>{copy("Sales path", "Satış yolu")}</span>
                    <h2>{copy("Revenue sensitivity preview", "Gelir hassasiyeti önizlemesi")}</h2>
                  </div>
                </div>
                <svg className="monte-chart path-preview-chart" viewBox="0 0 420 220" aria-hidden="true">
                  <path className="chart-grid" d="M24 42 H396 M24 88 H396 M24 134 H396 M24 180 H396" />
                  <path className="percentile-band" d="M28 166 C76 144 118 154 162 126 S248 108 294 82 360 80 392 58 L392 128 C340 140 312 154 266 166 S178 174 128 188 62 196 28 202 Z" />
                  <path className="path-worst" d="M28 196 C74 184 118 190 164 176 S244 166 294 152 350 150 392 136" />
                  <path className="path-likely" d="M28 168 C82 148 124 158 168 128 S248 118 296 90 352 82 392 68" />
                  <path className="path-good" d="M28 142 C78 112 122 120 168 92 S248 74 296 54 350 46 392 34" />
                </svg>
                <p>{copy("This preview shows how the selected sales assumptions can move revenue across low, likely, and high outcomes.", "Bu önizleme seçilen satış varsayımlarının geliri düşük, olası ve yüksek çıktılarda nasıl oynatabileceğini gösterir.")}</p>
              </article>

              <article className="simulation-card risk-card">
                <h2>{copy("Highly risky scenario", "Çok riskli senaryo")}</h2>
                <p>{copy("The worst 5% outcome is displayed separately because it represents the tail-risk case that can threaten margin, cash flow, and break-even timing.", "En kötü %5 çıktı ayrı gösterilir; marjı, nakit akışını ve başa baş zamanlamasını tehdit edebilecek kuyruk riskini temsil eder.")}</p>
                <strong>{formatLira(outcomes[0].net)}</strong>
              </article>
            </aside>
          </div>
        </section>,
    );
  }

  function renderSalesStrategyPage() {
    const monthlyMultipliers = getSalesExpectationMultipliers(salesStrategy);
    const workingDaysPerMonth = Math.max(1, toFiniteNumber(financialSettingsForm.workingDaysPerMonth, 22));
    const monthlyProductionByProduct = getMonthlyProductProductionMap(operationsWorkspace, workingDaysPerMonth);
    const productMap = getOperationProductMap(operationsWorkspace);
    const baseMonthlySalesUnits = getBaseMonthlySalesUnits(salesStrategy);
    const expectedAnnualSalesUnits = monthlyMultipliers.reduce((total, _multiplier, index) => total + getSalesForecastForMonth(salesStrategy, index), 0);
    const averageMultiplier = monthlyMultipliers.reduce((total, multiplier) => total + multiplier, 0) / Math.max(monthlyMultipliers.length, 1);
    const totalCampaignBudget = salesStrategy.campaigns.reduce((total, campaign) => total + (Number(campaign.budget) || 0), 0);
    const realizedSalesTotal = salesStrategy.personnel.reduce((total, person) => total + toFiniteNumber(person.realizedSalesUnits), 0);
    const personnelTargetTotal = salesStrategy.personnel.reduce((total, person) => total + toFiniteNumber(person.monthlyTarget), 0);
    const getProductAvailability = (productId) => {
      const monthlyProduced = Math.max(0, monthlyProductionByProduct.get(productId) || 0);
      const plannedSales = salesStrategy.channels.reduce((total, channel) => (
        channel.productId === productId ? total + Math.max(0, toFiniteNumber(channel.monthlySalesUnits)) : total
      ), 0);

      return {
        monthlyProduced,
        plannedSales,
        remaining: monthlyProduced - plannedSales,
      };
    };
    const totalReadyUnits = operationsWorkspace.products.reduce((total, product) => total + Math.max(0, getProductAvailability(product.id).remaining), 0);
    const totalMonthlyCommission = salesStrategy.channels.reduce((total, channel) => {
      const product = productMap.get(channel.productId) || channel.product || {};
      const grossRevenue = Math.max(0, toFiniteNumber(channel.monthlySalesUnits)) * Math.max(0, toFiniteNumber(product.price));
      return total + (grossRevenue * Math.max(0, toFiniteNumber(channel.commissionPercent)) / 100);
    }, 0);
    const activeProductCount = new Set(salesStrategy.channels.map((channel) => channel.productId).filter(Boolean)).size;
    const salesChannelTypeOptions = salesStrategy.channelTypes?.length ? salesStrategy.channelTypes : [
      { averageCommissionPercent: 0, averageCustomerAcquisitionRate: 18, descriptionEn: "Direct sales owned by the company.", descriptionTr: "Şirketin doğrudan yönettiği satış.", id: "direct", nameEn: "Direct sales", nameTr: "Direkt satış" },
      { averageCommissionPercent: 8, averageCustomerAcquisitionRate: 8, descriptionEn: "Digital storefront or online flow.", descriptionTr: "Dijital mağaza veya online akış.", id: "online", nameEn: "Online", nameTr: "Online" },
      { averageCommissionPercent: 20, averageCustomerAcquisitionRate: 5, descriptionEn: "Retail shelf or store channel.", descriptionTr: "Perakende raf veya mağaza kanalı.", id: "retail", nameEn: "Retail", nameTr: "Perakende" },
      { averageCommissionPercent: 25, averageCustomerAcquisitionRate: 4, descriptionEn: "Distributor-led sales route.", descriptionTr: "Distribütör üzerinden satış rotası.", id: "distributor", nameEn: "Distributor", nameTr: "Distribütör" },
      { averageCommissionPercent: 15, averageCustomerAcquisitionRate: 7, descriptionEn: "Marketplace platform channel.", descriptionTr: "Pazaryeri platform kanalı.", id: "marketplace", nameEn: "Marketplace", nameTr: "Pazaryeri" },
    ];
    const campaignTypeOptions = salesStrategy.campaignTypes?.length ? salesStrategy.campaignTypes : [
      { averageConversionRate: 3, averageCustomerAcquisitionRate: 6, averageDurationDays: 30, descriptionEn: "Paid digital acquisition campaign.", descriptionTr: "Ücretli dijital müşteri kazanım kampanyası.", id: "digital", nameEn: "Digital advertising", nameTr: "Dijital reklam" },
      { averageConversionRate: 2.5, averageCustomerAcquisitionRate: 5, averageDurationDays: 21, descriptionEn: "Organic and paid social campaign.", descriptionTr: "Organik ve ücretli sosyal medya kampanyası.", id: "social", nameEn: "Social media", nameTr: "Sosyal medya" },
      { averageConversionRate: 4, averageCustomerAcquisitionRate: 7, averageDurationDays: 14, descriptionEn: "Creator or influencer-led campaign.", descriptionTr: "İçerik üretici veya influencer odaklı kampanya.", id: "influencer", nameEn: "Influencer", nameTr: "Influencer" },
      { averageConversionRate: 5, averageCustomerAcquisitionRate: 4, averageDurationDays: 30, descriptionEn: "Trade promotion for partners.", descriptionTr: "Ticari iş ortakları için promosyon.", id: "trade", nameEn: "Trade promotion", nameTr: "Ticari promosyon" },
      { averageConversionRate: 6, averageCustomerAcquisitionRate: 3, averageDurationDays: 7, descriptionEn: "Event, fair, or field activation.", descriptionTr: "Etkinlik, fuar veya saha aktivasyonu.", id: "event", nameEn: "Event / fair", nameTr: "Etkinlik / fuar" },
      { averageConversionRate: 2, averageCustomerAcquisitionRate: 4, averageDurationDays: 14, descriptionEn: "Email and CRM lifecycle campaign.", descriptionTr: "E-posta ve CRM yaşam döngüsü kampanyası.", id: "email", nameEn: "Email / CRM", nameTr: "E-posta / CRM" },
    ];
    const getSalesTypeLabel = (type) => (form.language === "tr" ? type.nameTr || type.nameEn : type.nameEn || type.nameTr) || type.id;
    const getSalesTypeDescription = (type) => (form.language === "tr" ? type.descriptionTr || type.descriptionEn : type.descriptionEn || type.descriptionTr) || "";
    const salesChannelRequiredFields = [
      { field: "startMonth", label: copy("Start month", "Başlangıç Ayı"), min: 1, step: "1" },
      { field: "monthlySalesUnits", label: copy("First month sales (units)", "İlk Ay Satış (Adet)"), min: 0, step: "1" },
      { field: "growthMonths1To6Percent", label: copy("Growth (1-6 mo) (%)", "Büyüme (1-6 Ay) (%)"), min: 0, step: "0.01" },
      { field: "growthMonths7To18Percent", label: copy("Growth (7-18 mo) (%)", "Büyüme (7-18 Ay) (%)"), min: 0, step: "0.01" },
      { field: "growthMonths19To24Percent", label: copy("Growth (19-24 mo) (%)", "Büyüme (19-24 Ay) (%)"), min: 0, step: "0.01" },
      { field: "growthYears3To5Percent", label: copy("Year 3-5 growth (%)", "Yıl 3-5 Büyüme (%)"), min: 0, step: "0.01" },
      { field: "collectionDays", label: copy("Collection (days)", "Tahsilat (Gün)"), min: 0, step: "1" },
      { field: "customerAcquisitionCost", label: copy("Unit marketing (CAC) TL", "Birim Pazarlama (CAC) TL"), min: 0, step: "0.01" },
      { field: "commissionPercent", label: copy("Channel commission (%)", "Kanal Komisyonu (%)"), max: 100, min: 0, step: "0.1" },
    ];
    const advancedChannelFields = [
      { field: "basketSize", label: copy("Basket Size", "Sepet Büyüklüğü"), min: 0, step: "0.01" },
      { field: "conversionRatePercent", label: copy("Conversion Rate (%)", "Dönüşüm Oranı (%)"), min: 0, step: "0.001" },
      { field: "trafficScore", label: copy("Traffic Score", "Trafik Skoru"), min: 0, step: "0.01" },
      { field: "repeatRatePercent", label: copy("Repeat Rate (%)", "Tekrar Oranı (%)"), min: 0, step: "0.001" },
      { field: "churnRatePercent", label: copy("Churn Rate (%)", "Kayıp Oranı (%)"), min: 0, step: "0.001" },
      { field: "discountRatePercent", label: copy("Discount Rate (%)", "İndirim Oranı (%)"), min: 0, step: "0.01" },
      { field: "returnRatePercent", label: copy("Return Rate (%)", "İade Oranı (%)"), min: 0, step: "0.001" },
      { field: "capacityLimit", label: copy("Capacity Limit", "Kapasite Limiti"), min: 0, step: "1" },
      { field: "launchFee", label: copy("Launch Fee", "Lansman Bedeli"), min: 0, step: "0.01" },
      { field: "moqMonthly", label: copy("MOQ Monthly", "Aylık MOQ"), min: 0, step: "1" },
      { field: "failureProbabilityPercent", label: copy("Failure Prob. (%)", "Başarısızlık Olas. (%)"), min: 0, step: "0.001" },
      { field: "rampUpMonths", label: copy("Ramp-Up Months", "Ramp-Up Ayı"), min: 0, step: "1" },
    ];
    const seasonalityMonthLabels = form.language === "tr"
      ? ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"]
      : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return renderDashboardLayout(
      "sales-strategy",
        <section className="sales-workspace">
          <div className="sales-header">
            <div>
              <span>{dashboardCompanyName} / {copy("Sales Strategy", "Satış Stratejisi")}</span>
              <h1>{copy("Sales Strategy", "Satış Stratejisi")}</h1>
              <p>{copy("Plan sales channels by product, monthly sales quantity, commission, campaign duration, and monthly expectation multipliers. Financial Modelling reads these product-linked quantities directly.", "Satış kanallarını ürün, aylık satış adedi, komisyon, kampanya süresi ve aylık beklenti çarpanlarıyla planlayın. Finansal Modelleme bu ürün bağlantılı adetleri doğrudan kullanır.")}</p>
            </div>
            <div className="sales-header-actions">
              <button type="button" onClick={loadPlanningData} disabled={salesLoading}>
                {copy("Refresh Data", "Verileri Yenile")}
              </button>
              <button type="button" className="primary" onClick={handleSaveSalesStrategy} disabled={salesLoading}>
                {salesLoading ? copy("Saving...", "Kaydediliyor...") : copy("Save Strategy", "Stratejiyi Kaydet")}
              </button>
            </div>
          </div>

          {salesStatus && <p className="status-message">{salesStatus}</p>}

          <div className="sales-stat-grid">
            {[
              [copy("Monthly channel plan", "Aylık kanal planı"), formatNumber(baseMonthlySalesUnits), copy("sum of channel quantities", "kanal adetleri toplamı")],
              [copy("12M expected units", "12A beklenen adet"), formatNumber(expectedAnnualSalesUnits), copy("channel plan x monthly multipliers", "kanal planı x aylık çarpanlar")],
              [copy("Ready to sell", "Satmaya hazır"), formatNumber(totalReadyUnits), copy("remaining after channel quantities", "kanal adetlerinden sonra kalan")],
              [copy("Monthly commission", "Aylık komisyon"), formatLira(totalMonthlyCommission), copy("based on product prices", "ürün fiyatlarına göre")],
            ].map(([label, value, detail]) => (
              <article className="sales-stat-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </div>

          <div className="sales-grid">
            <article className="sales-card sales-forecast-card">
              <div className="sales-card-heading">
                <div>
                  <span>{copy("Monthly expectation multipliers", "Aylık beklenti çarpanları")}</span>
                  <h2>{copy("Sales expectation multipliers", "Satış beklentisi çarpanları")}</h2>
                </div>
              </div>
              <div className="sales-forecast-grid">
                {monthlyMultipliers.map((multiplier, index) => (
                  <label key={`forecast-${index}`}>
                    <span>{copy("Month", "Ay")} {index + 1}</span>
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      value={multiplier}
                      onChange={(event) => updateSalesForecast(index, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </article>

            <article className="sales-card channels-card">
              <div className="sales-card-heading">
                <div>
                  <span>{copy("Sales channels", "Satış kanalları")}</span>
                  <h2>{copy("Product, monthly quantity and commission", "Ürün, aylık adet ve komisyon")}</h2>
                </div>
                <button type="button" onClick={() => addSalesItem("channels")}>{copy("Add Channel", "Kanal Ekle")}</button>
              </div>
              <div className="sales-channel-grid">
                {salesStrategy.channels.map((channel) => (
                  <div className="sales-edit-card" key={channel.id}>
                    <div className="sales-channel-title wide-field">
                      <label><span>{copy("Channel name", "Kanal adı")} *</span><input required value={channel.name} onChange={(event) => updateSalesItem("channels", channel.id, "name", event.target.value)} /></label>
                      <button type="button" aria-label={copy("Delete channel", "Kanalı sil")} onClick={() => removeSalesItem("channels", channel.id)}>-</button>
                    </div>
                    <label>
                      <span>{copy("Channel type", "Kanal tipi")} *</span>
                      <select required value={channel.typeId || "direct"} onChange={(event) => updateSalesItem("channels", channel.id, "typeId", event.target.value)}>
                        {salesChannelTypeOptions.map((type) => (
                          <option value={type.id} key={type.id}>{getSalesTypeLabel(type)}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>{copy("Product to sell", "Satılacak ürün")} *</span>
                      <select
                        required
                        value={channel.productId || ""}
                        onChange={(event) => {
                          const product = operationsWorkspace.products.find((item) => item.id === event.target.value);
                          setSalesStrategy((current) => ({
                            ...current,
                            channels: current.channels.map((item) => (
                              item.id === channel.id
                                ? { ...item, product: product || null, productId: product?.id || "", productName: product?.name || "" }
                                : item
                            )),
                          }));
                        }}
                      >
                        <option value="">{copy("Select product", "Ürün seç")}</option>
                        {operationsWorkspace.products.map((product) => (
                          <option value={product.id} key={product.id}>{product.name}</option>
                        ))}
                      </select>
                    </label>
                    {salesChannelRequiredFields.map((field) => (
                      <label key={field.field}>
                        <span>{field.label} *</span>
                        <input
                          max={field.max}
                          min={field.min}
                          required
                          step={field.step}
                          type="number"
                          value={channel[field.field] ?? ""}
                          onChange={(event) => updateSalesItem("channels", channel.id, field.field, event.target.value)}
                        />
                      </label>
                    ))}
                    <details
                      className="advanced-channel-panel wide-field"
                      open={channel.advancedOpen ?? true}
                      onToggle={(event) => updateSalesItem("channels", channel.id, "advancedOpen", event.currentTarget.open)}
                    >
                      <summary>{copy("Advanced Channel Parameters", "Gelişmiş Kanal Parametreleri")}</summary>
                      <div className="advanced-channel-grid">
                        {advancedChannelFields.map((field) => (
                          <label key={field.field}>
                            <span>{field.label}</span>
                            <input
                              min={field.min}
                              step={field.step}
                              type="number"
                              value={channel[field.field] ?? ""}
                              onChange={(event) => updateSalesItem("channels", channel.id, field.field, event.target.value)}
                            />
                          </label>
                        ))}
                        <div className="seasonality-inputs">
                          <strong>{copy("Seasonality Curve (Jan-Dec multipliers):", "Sezonluk Eğri (Oca-Ara çarpanları):")}</strong>
                          <div>
                            {seasonalityMonthLabels.map((month, index) => (
                              <label key={`${channel.id}-season-${month}`}>
                                <span>{month}</span>
                                <input
                                  min="0"
                                  step="0.01"
                                  type="number"
                                  value={(Array.isArray(channel.seasonalityCurve) ? channel.seasonalityCurve[index] : "") ?? ""}
                                  onChange={(event) => updateSalesChannelSeasonality(channel.id, index, event.target.value)}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </details>
                    {(() => {
                      const product = productMap.get(channel.productId) || channel.product || {};
                      const availability = getProductAvailability(channel.productId);
                      const unit = product.unit || copy("units", "adet");

                      return (
                        <div className="sales-channel-capacity wide-field">
                          <span>{copy("Monthly produced", "Aylık üretilen")}<strong>{formatNumber(availability.monthlyProduced, 2)} {unit}</strong></span>
                          <span>{copy("Planned in channels", "Kanallarda planlanan")}<strong>{formatNumber(availability.plannedSales, 2)} {unit}</strong></span>
                          <span>{copy("Ready to sell remaining", "Satmaya hazır kalan")}<strong>{formatNumber(Math.max(0, availability.remaining), 2)} {unit}</strong></span>
                        </div>
                      );
                    })()}
                    {(() => {
                      const selectedType = salesChannelTypeOptions.find((type) => type.id === (channel.typeId || "direct"));

                      return selectedType ? (
                        <div className="sales-type-info wide-field">
                          <span>{copy("Avg acquisition", "Ort. müşteri kazanımı")}<strong>{formatNumber(selectedType.averageCustomerAcquisitionRate, 1)}%</strong></span>
                          <span>{copy("Avg commission", "Ort. komisyon")}<strong>{formatNumber(selectedType.averageCommissionPercent, 1)}%</strong></span>
                          <small>{getSalesTypeDescription(selectedType)}</small>
                        </div>
                      ) : null;
                    })()}
                  </div>
                ))}
              </div>
            </article>

            <article className="sales-card campaigns-card">
              <div className="sales-card-heading">
                <div>
                  <span>{copy("Marketing campaigns", "Pazarlama kampanyaları")}</span>
                  <h2>{copy("Budget, campaign type, duration in days and target channel", "Bütçe, kampanya tipi, gün bazlı süre ve hedef kanal")}</h2>
                </div>
                <button type="button" onClick={() => addSalesItem("campaigns")}>{copy("Add Campaign", "Kampanya Ekle")}</button>
              </div>
              <div className="sales-table">
                <div className="sales-table-row sales-table-head campaign-row-layout"><span>{copy("Campaign", "Kampanya")}</span><span>{copy("Type", "Tip")}</span><span>{copy("Channel", "Kanal")}</span><span>{copy("Budget", "Bütçe")}</span><span>{copy("Duration days", "Süre gün")}</span></div>
                {salesStrategy.campaigns.map((campaign) => (
                  <div className="sales-table-row campaign-row campaign-row-layout" key={campaign.id}>
                    <label><input value={campaign.name} onChange={(event) => updateSalesItem("campaigns", campaign.id, "name", event.target.value)} /></label>
                    <label>
                      <select value={campaign.typeId || "digital"} onChange={(event) => updateSalesItem("campaigns", campaign.id, "typeId", event.target.value)}>
                        {campaignTypeOptions.map((type) => (
                          <option value={type.id} key={type.id}>{getSalesTypeLabel(type)}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <select value={campaign.channel || ""} onChange={(event) => updateSalesItem("campaigns", campaign.id, "channel", event.target.value)}>
                        <option value="">{copy("Select channel", "Kanal seç")}</option>
                        {salesStrategy.channels.map((channel) => (
                          <option value={channel.name || channel.id} key={channel.id}>{channel.name || channel.id}</option>
                        ))}
                      </select>
                    </label>
                    <label><input min="0" step="1000" type="number" value={campaign.budget} onChange={(event) => updateSalesItem("campaigns", campaign.id, "budget", event.target.value)} /></label>
                    <label><input min="0" step="1" type="number" value={campaign.durationDays} onChange={(event) => updateSalesItem("campaigns", campaign.id, "durationDays", event.target.value)} /></label>
                    {(() => {
                      const selectedType = campaignTypeOptions.find((type) => type.id === (campaign.typeId || "digital"));

                      return selectedType ? (
                        <div className="sales-type-info campaign-type-info">
                          <span>{copy("Avg acquisition", "Ort. müşteri kazanımı")}<strong>{formatNumber(selectedType.averageCustomerAcquisitionRate, 1)}%</strong></span>
                          <span>{copy("Avg conversion", "Ort. dönüşüm")}<strong>{formatNumber(selectedType.averageConversionRate, 1)}%</strong></span>
                          <span>{copy("Avg duration", "Ort. süre")}<strong>{formatNumber(selectedType.averageDurationDays, 0)} {copy("days", "gün")}</strong></span>
                          <small>{getSalesTypeDescription(selectedType)}</small>
                        </div>
                      ) : null;
                    })()}
                    <textarea value={campaign.goal} onChange={(event) => updateSalesItem("campaigns", campaign.id, "goal", event.target.value)} />
                  </div>
                ))}
              </div>
            </article>

            <article className="sales-card personnel-card">
              <div className="sales-card-heading">
                <div>
                  <span>{copy("Sales personnel", "Satış personeli")}</span>
                  <h2>{copy("Ownership, target and realized sales quantity", "Sahiplik, hedef ve gerçekleşen satış adedi")}</h2>
                </div>
                <button type="button" onClick={() => addSalesItem("personnel")}>{copy("Add Person", "Personel Ekle")}</button>
              </div>
              <div className="sales-table personnel-table">
                <div className="sales-table-row sales-table-head personnel-row-layout"><span>{copy("Person", "Kişi")}</span><span>{copy("Role", "Rol")}</span><span>{copy("Channel", "Kanal")}</span><span>{copy("Target", "Hedef")}</span><span>{copy("Realized sales", "Gerçekleşen satış")}</span></div>
                {salesStrategy.personnel.map((person) => (
                  <div className="sales-table-row personnel-row personnel-row-layout" key={person.id}>
                    <label><input value={person.name} onChange={(event) => updateSalesItem("personnel", person.id, "name", event.target.value)} /></label>
                    <label><input value={person.role} onChange={(event) => updateSalesItem("personnel", person.id, "role", event.target.value)} /></label>
                    <label>
                      <select value={person.assignedChannel || ""} onChange={(event) => updateSalesItem("personnel", person.id, "assignedChannel", event.target.value)}>
                        <option value="">{copy("Select channel", "Kanal seç")}</option>
                        {salesStrategy.channels.map((channel) => (
                          <option value={channel.name || channel.id} key={channel.id}>{channel.name || channel.id}</option>
                        ))}
                      </select>
                    </label>
                    <label><input min="0" type="number" value={person.monthlyTarget} onChange={(event) => updateSalesItem("personnel", person.id, "monthlyTarget", event.target.value)} /></label>
                    <label><input min="0" step="1" type="number" value={person.realizedSalesUnits ?? ""} onChange={(event) => updateSalesItem("personnel", person.id, "realizedSalesUnits", event.target.value)} /></label>
                  </div>
                ))}
              </div>
            </article>

            <article className="sales-card sales-decision-card">
              <div className="sales-card-heading">
                <div>
                  <span>{copy("Strategy readout", "Strateji okuması")}</span>
                  <h2>{copy("Manual inputs translated into decision signals", "Manuel girdilerden karar sinyalleri")}</h2>
                </div>
              </div>
              <div className="sales-signal-grid">
                <span>{copy("Products in channels", "Kanallardaki ürün")} <strong>{formatNumber(activeProductCount)}</strong><small>{copy("selected from Operations products", "Operations ürünlerinden seçildi")}</small></span>
                <span>{copy("Campaign budget", "Kampanya bütçesi")} <strong>{formatLira(totalCampaignBudget)}</strong><small>{copy("total planned marketing spend", "toplam planlanan pazarlama bütçesi")}</small></span>
                <span>{copy("Personnel target", "Personel hedefi")} <strong>{formatNumber(personnelTargetTotal)}</strong><small>{copy("monthly target units", "aylık hedef adet")}</small></span>
                <span>{copy("Realized sales", "Gerçekleşen satış")} <strong>{formatNumber(realizedSalesTotal)}</strong><small>{copy("entered by sales personnel", "satış personeli tarafından girildi")}</small></span>
                <span>{copy("Average multiplier", "Ortalama çarpan")} <strong>{formatNumber(averageMultiplier, 2)}x</strong><small>{copy("across 12 months", "12 ay genelinde")}</small></span>
                <span>{copy("Ready remaining", "Hazır kalan")} <strong>{formatNumber(totalReadyUnits)}</strong><small>{copy("after planned channel quantities", "planlanan kanal adetlerinden sonra")}</small></span>
              </div>
            </article>
          </div>
        </section>,
    );
  }

  function renderOperationDataPage({ columns, description, entity, fields, rows, title }) {
    return renderDashboardLayout(
      `operations/${activeOperationsSubmodule.key}`,
        <section className="operations-workspace operations-modern">
          <div className="operations-header">
            <div>
              <span>Operations / {activeOperationsSubmodule.label}</span>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            <div className="operations-actions">
              <button type="button" onClick={loadOperationsData}>{copy("Refresh Data", "Verileri Yenile")}</button>
            </div>
          </div>

          <div className="operation-data-grid">
            {renderOperationRecordForm(entity, fields)}
            <article className="operation-card operation-data-table-card">
              <div className="operation-card-heading">
                <h2>{copy("Records", "Kayıtlar")}</h2>
                <span>{rows.length} {copy("records", "kayıt")}</span>
              </div>
              <div className="operation-data-table">
                <div className="operation-data-row operation-data-head" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr))` }}>
                  {columns.map((column) => <span key={column.header}>{column.header}</span>)}
                </div>
                {(rows.length ? rows : [{ id: "empty" }]).map((row) => (
                  <div className="operation-data-row" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr))` }} key={row.id}>
                    {columns.map((column) => (
                      <span key={column.header}>{row.id === "empty" ? "-" : column.render(row)}</span>
                    ))}
                  </div>
                ))}
              </div>
            </article>
          </div>
          {operationsStatus && <p className="status-message">{operationsStatus}</p>}
        </section>,
    );
  }

  function renderMachinesEquipmentPage() {
    const machineFields = [
      { name: "name", label: copy("Machine name", "Makine adı") },
      { name: "price", label: copy("Machine price", "Makine fiyatı"), step: "0.01", type: "number" },
      { name: "hourlyEnergyConsumptionKwh", label: copy("Hourly energy consumption", "Saatlik enerji tüketimi"), step: "0.01", type: "number" },
    ];
    const equipmentFields = [
      { name: "name", label: copy("Equipment name", "Ekipman adı") },
      { name: "price", label: copy("Equipment price", "Ekipman fiyatı"), step: "0.01", type: "number" },
      { name: "quantity", label: copy("Equipment quantity", "Ekipman miktarı"), step: "1", type: "number" },
    ];
    const machineColumns = [
      { header: copy("Machine", "Makine"), render: (row) => row.name },
      { header: copy("Price", "Fiyat"), render: (row) => formatLira(row.price) },
      { header: copy("Hourly Energy", "Saatlik Enerji"), render: (row) => `${formatNumber(row.hourly_energy_consumption_kwh, 2)} kWh` },
    ];
    const equipmentColumns = [
      { header: copy("Equipment", "Ekipman"), render: (row) => row.name },
      { header: copy("Price", "Fiyat"), render: (row) => formatLira(row.price) },
      { header: copy("Quantity", "Miktar"), render: (row) => formatNumber(row.quantity) },
    ];

    return renderDashboardLayout(
      `operations/${activeOperationsSubmodule.key}`,
        <section className="operations-workspace operations-modern">
          <div className="operations-header">
            <div>
              <span>Operations / {copy("Machines & Equipment", "Makine & Ekipman")}</span>
              <h1>{copy("Machines & Equipment", "Makine & Ekipman")}</h1>
              <p>{copy("Keep machines used in production plans separate from simple equipment records.", "Üretim planlarında kullanılacak makineleri sade ekipman kayıtlarından ayrı tutun.")}</p>
            </div>
            <div className="operations-actions">
              <button type="button" onClick={loadOperationsData}>{copy("Refresh Data", "Verileri Yenile")}</button>
            </div>
          </div>

          <div className="machine-equipment-grid">
            <div className="operation-data-grid compact">
              {renderOperationRecordForm("machine", machineFields)}
              <article className="operation-card operation-data-table-card">
                <div className="operation-card-heading">
                  <h2>{copy("Machines", "Makineler")}</h2>
                  <span>{operationsWorkspace.machines.length} {copy("records", "kayıt")}</span>
                </div>
                <div className="operation-data-table">
                  <div className="operation-data-row operation-data-head" style={{ gridTemplateColumns: `repeat(${machineColumns.length}, minmax(120px, 1fr))` }}>
                    {machineColumns.map((column) => <span key={column.header}>{column.header}</span>)}
                  </div>
                  {(operationsWorkspace.machines.length ? operationsWorkspace.machines : [{ id: "empty" }]).map((row) => (
                    <div className="operation-data-row" style={{ gridTemplateColumns: `repeat(${machineColumns.length}, minmax(120px, 1fr))` }} key={row.id}>
                      {machineColumns.map((column) => (
                        <span key={column.header}>{row.id === "empty" ? "-" : column.render(row)}</span>
                      ))}
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <div className="operation-data-grid compact">
              {renderOperationRecordForm("equipment", equipmentFields)}
              <article className="operation-card operation-data-table-card">
                <div className="operation-card-heading">
                  <h2>{copy("Equipment", "Ekipman")}</h2>
                  <span>{(operationsWorkspace.equipment || []).length} {copy("records", "kayıt")}</span>
                </div>
                <div className="operation-data-table">
                  <div className="operation-data-row operation-data-head" style={{ gridTemplateColumns: `repeat(${equipmentColumns.length}, minmax(120px, 1fr))` }}>
                    {equipmentColumns.map((column) => <span key={column.header}>{column.header}</span>)}
                  </div>
                  {((operationsWorkspace.equipment || []).length ? operationsWorkspace.equipment : [{ id: "empty" }]).map((row) => (
                    <div className="operation-data-row" style={{ gridTemplateColumns: `repeat(${equipmentColumns.length}, minmax(120px, 1fr))` }} key={row.id}>
                      {equipmentColumns.map((column) => (
                        <span key={column.header}>{row.id === "empty" ? "-" : column.render(row)}</span>
                      ))}
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>
          {operationsStatus && <p className="status-message">{operationsStatus}</p>}
        </section>,
    );
  }

  const references = [];

  const personas = [
    {
      avatarType: "planning",
      title: labels.farmerPersona,
      need: labels.farmerNeed,
      benefit: labels.farmerBenefit,
      difference: labels.farmerDifference,
    },
    {
      avatarType: "production",
      title: labels.factoryOwnerPersona,
      need: labels.factoryOwnerNeed,
      benefit: labels.factoryOwnerBenefit,
      difference: labels.factoryOwnerDifference,
    },
    {
      avatarType: "finance",
      title: labels.entrepreneurPersona,
      need: labels.entrepreneurNeed,
      benefit: labels.entrepreneurBenefit,
      difference: labels.entrepreneurDifference,
    },
    {
      avatarType: "operations",
      title: labels.exporterPersona,
      need: labels.exporterNeed,
      benefit: labels.exporterBenefit,
      difference: labels.exporterDifference,
    },
  ];

  const dashboardModules = [
    { key: "operations", path: "/operations", label: "Operations" },
    { key: "sales-strategy", path: "/sales-strategy", label: copy("Sales Strategy", "Satış Stratejisi") },
    { key: "financial-modelling", path: "/financial-modelling", label: copy("Financial Modelling", "Finansal Modelleme") },
    { key: "simulation", path: "/simulation", label: copy("Simulation", "Simülasyon") },
    { key: "reports", path: "/reports", label: copy("Reports", "Raporlar") },
  ];
  const operationsSubmodules = [
    { key: "resources", path: "/operations/resources", label: copy("Resources", "Kaynak") },
    { key: "products", path: "/operations/products", label: copy("Products", "Ürünler") },
    { key: "machines-equipment", path: "/operations/machines-equipment", label: copy("Machines & Equipment", "Makine & Ekipman") },
    { key: "data-entry", path: "/operations/data-entry", label: copy("Process Definition", "Süreç Tanımlama") },
    { key: "active-processes", path: "/operations/active-processes", label: copy("Active Processes", "Mevcut Süreçler") },
  ];
  const productPlusSubmodules = [
    { key: "product-tree", path: "/product-plus/product-tree", label: copy("Product Tree", "Ürün Ağacı") },
  ];
  const financialSubmodules = [
    { group: "Girdiler", key: "inputs", path: "/financial-modelling/girdiler", label: "Girdiler" },
    { group: "Krediler", key: "loans", path: "/financial-modelling/krediler", label: "Krediler" },
    { group: "Analiz", key: "overview", path: "/financial-modelling/analiz", label: "Maliyet & Getiri" },
  ];

  const activeModule = dashboardModules.find((module) => module.path === path);
  const activeOperationsSubmodule = operationsSubmodules.find((module) => module.path === path);
  const activeProductPlusSubmodule = productPlusSubmodules.find((module) => module.path === path);
  const activeFinancialSubmodule = financialSubmodules.find((module) => module.path === path);
  const isLegacyFinancialDetailPath = [
    "/financial-modelling/maliyet-hesaplama/urun-maliyeti",
    "/financial-modelling/maliyet-hesaplama/yatirim-maliyeti",
    "/financial-modelling/getiri-hesaplama/urun-getirisi",
    "/financial-modelling/getiri-hesaplama/yatirim-getirisi",
  ].includes(path);
  const activeSimulationVariant = simulationVariants.find((variant) => variant.path === path);
  const isOperationsRoute = path === "/operations" || path.startsWith("/operations/");
  const isProductPlusRoute = path === "/product-plus" || path.startsWith("/product-plus/");
  const isFinancialRoute = path === "/financial-modelling" || path.startsWith("/financial-modelling/");
  const isSimulationRoute = path === "/simulation" || path.startsWith("/simulation/");
  const editableAuthorizationRoles = roles.filter((role) => !isAdminRole(role));
  const moduleLabelByKey = Object.fromEntries(dashboardModules.map((module) => [module.key, module.label]));
  const getModuleLabel = (module) => moduleLabelByKey[module.module_key] || module.name;
  const projectedFinancialModel = buildFinancialFeasibilityModel(financialModel, salesStrategy, financialSettingsForm, operationsWorkspace, financialHorizon);
  const financialSummary = projectedFinancialModel.summary || emptyFinancialModel.summary;
  const financialTrendRows = projectedFinancialModel.trendRows || [];
  const financialMonthCount = getProjectionMonthCount(financialHorizon);
  const currentOperationPlans = getCurrentOperationPlans(operationsWorkspace);
  const activePlanResults = currentOperationPlans.map((plan) => plan.result || {}).filter(hasViablePlanResult);
  const latestPlan = currentOperationPlans[0] || operationsWorkspace.latestPlan || null;
  const latestPlanResult = operationPlanResult || latestPlan?.result || null;
  const totalDailyProduction = activePlanResults.reduce((total, result) => total + toFiniteNumber(result.producedQuantity), 0);
  const totalDailyTrackedCost = activePlanResults.reduce((total, result) => total + toFiniteNumber(result.totalTrackedDailyCost), 0);
  const totalDailyEnergy = activePlanResults.reduce((total, result) => total + toFiniteNumber(result.energyConsumptionKwh), 0);
  const dashboardProductName = operationsWorkspace.product?.name || operationsWorkspace.products[0]?.name || copy("Product input needed", "Ürün girdisi gerekli");
  const dashboardCompanyName = currentProfile?.company?.name || currentProfile?.company_id || "Atera";
  const dashboardProductContext = operationsWorkspace.product?.product_group || operationsWorkspace.product?.name || operationsWorkspace.products[0]?.name || copy("No product selected", "Ürün seçilmedi");
  const hasOperationData = Boolean(operationsWorkspace.products.length || operationsWorkspace.machines.length || operationsWorkspace.materials.length || operationsWorkspace.workforce.length || activePlanResults.length);
  const dashboardMonthlyMultipliers = getSalesExpectationMultipliers(salesStrategy);
  const dashboardBaseMonthlySalesUnits = getBaseMonthlySalesUnits(salesStrategy);
  const dashboardExpectedSalesUnits = dashboardMonthlyMultipliers.reduce((total, multiplier) => total + (dashboardBaseMonthlySalesUnits * multiplier), 0);
  const hasSalesForecast = salesStrategy.channels.some((channel) => channel.productId && toFiniteNumber(channel.monthlySalesUnits) > 0);
  const hasFinancialSourceData = Boolean(activePlanResults.length && hasSalesForecast && financialModel.settingsSaved);
  const noDataValue = "-";
  const moneyOrMissing = (value) => (hasFinancialSourceData ? formatLira(value) : noDataValue);
  const monthlyRevenue = financialMonthCount ? toFiniteNumber(financialSummary.salesRevenue) / financialMonthCount : 0;
  const monthlyCost = financialMonthCount ? toFiniteNumber(financialSummary.totalCost) / financialMonthCount : 0;
  const monthlyNet = financialMonthCount ? toFiniteNumber(financialSummary.netIncome) / financialMonthCount : 0;
  const dashboardStats = [
    { label: copy("Daily Production", "Günlük Üretim"), value: activePlanResults.length ? `${formatNumber(totalDailyProduction, 2)} ${latestPlanResult?.productUnit || operationsWorkspace.product?.unit || copy("units", "adet")}` : noDataValue, delta: copy("Supabase", "Supabase"), detail: copy("active process result", "aktif süreç sonucu") },
    { label: copy("Active Plans", "Aktif Plan"), value: formatNumber(operationsWorkspace.activePlans.length), delta: copy("Supabase", "Supabase"), detail: copy("saved process plans", "kayıtlı süreç planları") },
    { label: copy("Monthly Revenue", "Aylık Ciro"), value: moneyOrMissing(monthlyRevenue), delta: copy("calculated", "hesaplandı"), detail: copy("from channel sales plan", "kanal satış planından") },
    { label: copy("Cash Runway", "Nakit Dayanma"), value: hasFinancialSourceData ? `${formatNumber(financialSummary.cashRunwayMonths)} ${copy("mo", "ay")}` : noDataValue, delta: copy("calculated", "hesaplandı"), detail: copy("from current cash", "mevcut nakitten") },
  ];
  const factoryLines = operationsWorkspace.machines.slice(0, 5).map((machine, index) => ({
    name: machine.name,
    status: `${formatLira(machine.price)} / ${formatNumber(machine.hourly_energy_consumption_kwh, 2)} kWh`,
    tone: ["teal", "cyan", "amber", "navy", "green"][index % 5],
  }));
  const factoryMetrics = [
    [copy("Machines", "Makine"), formatNumber(operationsWorkspace.machines.length)],
    [copy("Materials", "Malzeme"), formatNumber(operationsWorkspace.materials.length)],
    [copy("Workforce Roles", "İş Gücü Rolü"), formatNumber(operationsWorkspace.workforce.length)],
    [copy("Daily Energy", "Günlük Enerji"), activePlanResults.length ? `${formatNumber(totalDailyEnergy, 2)} kWh` : noDataValue],
  ];
  const dashboardFinanceKpis = [
    [copy("Estimated Revenue", "Tahmini Ciro"), moneyOrMissing(monthlyRevenue)],
    [copy("Estimated Cost", "Tahmini Maliyet"), moneyOrMissing(monthlyCost)],
    [copy("Net Profit", "Net Kâr"), moneyOrMissing(monthlyNet)],
  ];
  const dashboardFinancialRisks = [
    [copy("Unsold inventory", "Satılmayan stok"), hasFinancialSourceData ? `${formatNumber(financialSummary.unsoldInventoryUnits)} ${copy("units", "adet")}` : noDataValue],
    [copy("Spoilage / returns", "Fire / iade"), hasFinancialSourceData ? formatLira(financialSummary.expiredWriteOffCost) : noDataValue],
    [copy("Working capital", "İşletme sermayesi"), hasFinancialSourceData ? formatLira(financialSummary.workingCapitalRequirement) : noDataValue],
  ];
  const operationUnitSalePrice = toFiniteNumber(latestPlanResult?.productPrice, toFiniteNumber(operationsWorkspace.product?.price, toFiniteNumber(operationsWorkspace.products[0]?.price)));
  const operationUnitCost = toFiniteNumber(latestPlanResult?.producedQuantity)
    ? toFiniteNumber(latestPlanResult.totalTrackedDailyCost) / toFiniteNumber(latestPlanResult.producedQuantity)
    : toFiniteNumber(financialSummary.unitProductionCost);
  const operationUnitProfit = operationUnitSalePrice - operationUnitCost;
  const operationProfitMargin = operationUnitSalePrice ? (operationUnitProfit / operationUnitSalePrice) * 100 : 0;
  const technicalSpecs = [
    [copy("Weight", "Ağırlık"), operationsWorkspace.product?.weight_kg ? `${formatNumber(operationsWorkspace.product.weight_kg, 2)} kg` : noDataValue],
    [copy("Dimensions", "Boyut"), operationsWorkspace.product?.dimensions || noDataValue],
    [copy("Material", "Malzeme"), operationsWorkspace.product?.material_name || noDataValue],
    [copy("Quality", "Kalite"), operationsWorkspace.product?.quality_grade || noDataValue],
    [copy("Cycle Time", "Çevrim"), operationsWorkspace.product?.cycle_time_seconds ? `${formatNumber(operationsWorkspace.product.cycle_time_seconds, 2)} ${copy("sec", "sn")}` : noDataValue],
    [copy("Labor / Unit", "İşçilik / Birim"), operationsWorkspace.product?.labor_minutes_per_unit ? `${formatNumber(operationsWorkspace.product.labor_minutes_per_unit, 2)} ${copy("min", "dk")}` : noDataValue],
    [copy("Material / Unit", "Malzeme / Birim"), operationsWorkspace.product?.material_kg_per_unit ? `${formatNumber(operationsWorkspace.product.material_kg_per_unit, 2)} kg` : noDataValue],
    [copy("Scrap Rate", "Fire Oranı"), operationsWorkspace.product?.scrap_rate ? `${formatNumber(operationsWorkspace.product.scrap_rate, 2)}%` : noDataValue],
  ];
  const operationFlowSteps = [
    ...(latestPlanResult?.machineRows || []).map((row) => ({
      id: `machine-${row.machineId}`,
      name: row.name,
      station: `${formatNumber(row.dailyHours, 2)} ${copy("hours", "saat")} / ${formatNumber(row.energyConsumptionKwh, 2)} kWh`,
    })),
    ...(latestPlanResult?.workforceRows || []).map((row) => ({
      id: `workforce-${row.workforceId}`,
      name: row.roleName,
      station: `${formatNumber(row.peopleAssigned)} ${copy("people", "kişi")} / ${formatLira(row.cost)}`,
    })),
    ...(latestPlanResult?.materialRows || []).map((row) => ({
      id: `material-${row.materialId}`,
      name: row.name,
      station: `${formatNumber(row.dailyQuantity, 2)} ${row.unit || ""} / ${formatLira(row.cost)}`,
    })),
  ];
  const dashboardInsights = [
    operationsWorkspace.product
      ? { title: copy("Product data loaded", "Ürün verisi yüklendi"), copy: `${operationsWorkspace.product.product_code || "-"} / ${operationsWorkspace.product.name || "-"}`, tone: "teal" }
      : { title: copy("Product input needed", "Ürün girdisi gerekli"), copy: copy("Add a product in Operations so feasibility can use a real item.", "Fizibilitenin gerçek ürün kullanması için Operations'a ürün ekleyin."), tone: "amber" },
    activePlanResults.length
      ? { title: copy("Process result loaded", "Süreç sonucu yüklendi"), copy: `${formatNumber(totalDailyProduction, 2)} ${latestPlanResult?.productUnit || copy("units", "adet")} / ${formatLira(totalDailyTrackedCost)}`, tone: "cyan" }
      : { title: copy("Process result needed", "Süreç sonucu gerekli"), copy: copy("Save a process plan so production and cost numbers are calculated from Supabase.", "Üretim ve maliyet sayıları Supabase'ten hesaplansın diye süreç planı kaydedin."), tone: "amber" },
    hasSalesForecast
      ? { title: copy("Sales plan loaded", "Satış planı yüklendi"), copy: `${formatNumber(dashboardExpectedSalesUnits)} ${copy("expected units across 12 months", "12 ay beklenen adet")}`, tone: "teal" }
      : { title: copy("Sales plan needed", "Satış planı gerekli"), copy: copy("Add product-linked channel quantities in Sales Strategy to unlock revenue, inventory, and runway calculations.", "Ciro, stok ve nakit hesapları için Satış Stratejisi'nde ürüne bağlı kanal adetleri girin."), tone: "amber" },
    hasFinancialSourceData
      ? { title: copy("Payback signal", "Geri dönüş sinyali"), copy: financialSummary.paybackMonth ? `${financialSummary.paybackMonth}. ${copy("month", "ay")}` : copy("Payback is not reached in the selected horizon.", "Seçilen ufukta geri dönüş oluşmuyor."), tone: financialSummary.paybackMonth ? "teal" : "clay" }
      : { title: copy("Financial inputs needed", "Finansal girdi gerekli"), copy: copy("Complete operations, sales, and financial assumptions for real feasibility output.", "Gerçek fizibilite çıktısı için operasyon, satış ve finans varsayımlarını tamamlayın."), tone: "clay" },
  ];
  const reportAuthor = currentProfile?.username || currentProfile?.email || copy("Current user", "Mevcut kullanıcı");
  const periodLabel = financialHorizon === "5y" ? copy("Next 60 months", "Gelecek 60 ay") : financialHorizon === "1y" ? copy("Next 12 months", "Gelecek 12 ay") : copy("Next 6 months", "Gelecek 6 ay");
  const recentReports = [
    operationsWorkspace.product && [
      copy("Product Definition Snapshot", "Ürün Tanımı Anlık Görünümü"),
      copy("Production Reports", "Üretim Raporları"),
      new Date(operationsWorkspace.product.updated_at || operationsWorkspace.product.created_at).toLocaleString(locale),
      operationsWorkspace.product.product_code || "-",
      reportAuthor,
    ],
    latestPlan && [
      latestPlan.plan_name || copy("Latest Process Plan", "Son Süreç Planı"),
      copy("Production Reports", "Üretim Raporları"),
      new Date(latestPlan.created_at).toLocaleString(locale),
      latestPlanResult?.productName || dashboardProductName,
      reportAuthor,
    ],
    hasFinancialSourceData && [
      copy("Financial Feasibility Snapshot", "Finansal Fizibilite Anlık Görünümü"),
      copy("Financial Reports", "Finansal Raporlar"),
      new Date().toLocaleString(locale),
      periodLabel,
      reportAuthor,
    ],
    hasSalesForecast && [
      copy("Sales Strategy Snapshot", "Satış Stratejisi Anlık Görünümü"),
      copy("Sales Reports", "Satış Raporları"),
      new Date().toLocaleString(locale),
      copy("12 month sales plan", "12 aylık satış planı"),
      reportAuthor,
    ],
  ].filter(Boolean);
  const reportCategoryCounts = recentReports.reduce((counts, report) => {
    counts[report[1]] = (counts[report[1]] || 0) + 1;
    return counts;
  }, {});
  const reportCategories = Object.entries(reportCategoryCounts).map(([category, count]) => [
    category,
    recentReports.length ? Math.round((count / recentReports.length) * 100) : 0,
  ]);
  const reportTabs = [
    { key: "all", label: copy("All Reports", "Tüm Raporlar") },
    { category: copy("Production Reports", "Üretim Raporları"), key: "production", label: copy("Production Reports", "Üretim Raporları") },
    { category: copy("Financial Reports", "Finansal Raporlar"), key: "financial", label: copy("Financial Reports", "Finansal Raporlar") },
    { category: copy("Sales Reports", "Satış Raporları"), key: "sales", label: copy("Sales Reports", "Satış Raporları") },
    { category: copy("Capacity Reports", "Kapasite Raporları"), key: "capacity", label: copy("Capacity Reports", "Kapasite Raporları") },
  ];
  const activeReportTab = reportTabs.find((tab) => tab.key === reportsTab) || reportTabs[0];
  const normalizedReportSearch = reportsSearch.trim().toLocaleLowerCase(locale);
  const visibleRecentReports = recentReports.filter((report) => {
    const matchesTab = !activeReportTab.category || report[1] === activeReportTab.category;
    const matchesSearch = !normalizedReportSearch || report.join(" ").toLocaleLowerCase(locale).includes(normalizedReportSearch);
    return matchesTab && matchesSearch;
  });
  const reportStats = [
    [copy("Available Snapshots", "Mevcut Anlık Rapor"), formatNumber(recentReports.length), copy("derived from Supabase data", "Supabase verisinden türetildi")],
    [copy("Products", "Ürünler"), formatNumber(operationsWorkspace.products.length), copy("operation product records", "operasyon ürün kayıtları")],
    [copy("Process Plans", "Süreç Planları"), formatNumber(operationsWorkspace.activePlans.length), copy("saved backend results", "kayıtlı backend sonuçları")],
    [copy("Sales Channels", "Satış Kanalları"), formatNumber(salesStrategy.channels.length), copy("strategy records", "strateji kayıtları")],
    [copy("Latest Snapshot", "Son Anlık Rapor"), recentReports[0]?.[0] || noDataValue, recentReports[0]?.[2] || copy("No data yet", "Henüz veri yok")],
  ];
  const financeWindowLabel =
    financeWindow === "custom"
      ? `${financeDateRange.start || copy("Start", "Başlangıç")} - ${financeDateRange.end || copy("End", "Bitiş")}`
      : {
          today: copy("Today", "Bugün"),
          tomorrow: copy("Tomorrow", "Yarın"),
          week: copy("This week", "Bu hafta"),
          month: copy("This month", "Bu ay"),
        }[financeWindow];
  const hasFinancialAssumptions = Boolean(financialModel.settingsSaved) && requiredFinancialSettingFields.every((field) => (
    financialSettingsForm[field] !== "" &&
    financialSettingsForm[field] !== null &&
    financialSettingsForm[field] !== undefined &&
    Number.isFinite(Number(financialSettingsForm[field]))
  ));
  const feasibilityChecklist = [
    {
      action: copy("Add Product", "Ürün Ekle"),
      done: operationsWorkspace.products.length > 0,
      label: copy("Product, price, and recipe", "Ürün, fiyat ve reçete"),
      path: "/operations/products",
    },
    {
      action: copy("Save Process Plan", "Süreç Planı Kaydet"),
      done: activePlanResults.length > 0,
      label: copy("Daily production capacity and cost", "Günlük üretim kapasitesi ve maliyeti"),
      path: "/operations/data-entry",
    },
    {
      action: copy("Add Sales Channel", "Satış Kanalı Ekle"),
      done: hasSalesForecast,
      label: copy("Product-linked sales forecast", "Ürüne bağlı satış tahmini"),
      path: "/sales-strategy",
    },
    {
      action: copy("Review Finance", "Finansı Kontrol Et"),
      done: hasFinancialAssumptions,
      label: copy("Cash, tax, stock, and payment assumptions", "Nakit, vergi, stok ve ödeme varsayımları"),
      path: "/financial-modelling/girdiler",
    },
  ];
  const missingFeasibilityItem = feasibilityChecklist.find((item) => !item.done);
  const feasibilityReadyCount = feasibilityChecklist.filter((item) => item.done).length;
  const unmetForecastUnits = hasFinancialSourceData
    ? Math.max(0, toFiniteNumber(financialSummary.forecastSalesUnits) - toFiniteNumber(financialSummary.netSoldUnits))
    : 0;
  const hasPositiveNet = hasFinancialSourceData && monthlyNet > 0;
  const hasEnoughRunway = hasFinancialSourceData && financialSummary.cashRunwayMonths >= Math.min(financialMonthCount, 6);
  const hasNoCapacityGap = hasFinancialSourceData && unmetForecastUnits <= 0;
  const feasibilityVerdict = !hasFinancialSourceData
    ? {
        action: missingFeasibilityItem?.action || copy("Complete Inputs", "Girdileri Tamamla"),
        copy: copy("Complete the basic product, process, sales, and finance inputs before using this as a decision report.", "Bunu karar raporu olarak kullanmadan önce temel ürün, süreç, satış ve finans girdilerini tamamlayın."),
        label: copy("Not decision-ready", "Karar için hazır değil"),
        path: missingFeasibilityItem?.path || "/operations/products",
        tone: "amber",
      }
    : (hasPositiveNet && hasEnoughRunway && hasNoCapacityGap)
        ? {
            action: copy("Open Simulation", "Simülasyonu Aç"),
            copy: copy("The current plan covers the sales forecast, keeps cash alive in the selected horizon, and shows positive monthly net.", "Mevcut plan satış tahminini karşılıyor, seçilen ufukta nakdi taşıyor ve pozitif aylık net gösteriyor."),
            label: copy("Looks feasible", "Fizibl görünüyor"),
            path: "/simulation/current-situation",
            tone: "teal",
          }
        : hasPositiveNet
          ? {
              action: copy("Review Risks", "Riskleri İncele"),
              copy: copy("The plan can make money, but capacity, cash runway, or inventory risk needs attention before committing.", "Plan para kazanabilir; fakat kapasite, nakit dayanma veya stok riski karar öncesi kontrol edilmeli."),
              label: copy("Feasible with watchouts", "Dikkatle fizibl"),
              path: "/financial-modelling/analiz",
              tone: "amber",
            }
          : {
              action: copy("Improve Plan", "Planı İyileştir"),
              copy: copy("The current assumptions do not yet support a healthy production decision. Start with price, cost, capacity, or cash.", "Mevcut varsayımlar sağlıklı bir üretim kararını henüz desteklemiyor. Fiyat, maliyet, kapasite veya nakitten başlayın."),
              label: copy("High risk", "Yüksek risk"),
              path: "/financial-modelling/analiz",
              tone: "clay",
            };
  const improvementFocus = [
    !operationsWorkspace.products.length && copy("Add the product price and recipe so cost is based on a real item.", "Maliyet gerçek ürüne dayansın diye ürün fiyatını ve reçetesini ekleyin."),
    !activePlanResults.length && copy("Save one daily process plan to calculate capacity, labor, material, and energy.", "Kapasite, işçilik, malzeme ve enerjiyi hesaplamak için bir günlük süreç planı kaydedin."),
    !hasSalesForecast && copy("Link sales channels to products so revenue and stock risk become visible.", "Ciro ve stok riski görünsün diye satış kanallarını ürünlere bağlayın."),
    hasFinancialSourceData && unmetForecastUnits > 0 && copy("Sales demand is above available production. Increase capacity or reduce the promise.", "Satış talebi mevcut üretimin üstünde. Kapasiteyi artırın ya da satış sözünü düşürün."),
    hasFinancialSourceData && financialSummary.unsoldInventoryUnits > 0 && copy("Production is above sales. Reduce output, add demand, or plan stock financing.", "Üretim satışın üstünde. Çıktıyı düşürün, talep ekleyin veya stok finansmanı planlayın."),
    hasFinancialSourceData && monthlyNet <= 0 && copy("Net result is weak. Recheck price, material cost, labor hours, and channel commissions.", "Net sonuç zayıf. Fiyatı, malzeme maliyetini, işçilik saatini ve kanal komisyonlarını kontrol edin."),
    hasFinancialSourceData && financialSummary.cashRunwayMonths < Math.min(financialMonthCount, 3) && copy("Cash runway is short. Add starting cash, financing, or delay non-critical spend.", "Nakit dayanma kısa. Başlangıç nakdi/finansman ekleyin ya da kritik olmayan harcamayı erteleyin."),
  ].filter(Boolean).slice(0, 3);

  function renderDashboardLayout(activePage, children) {
    return (
      <main className="dashboard-shell">
        <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
          <div className="dashboard-brand-block">
            <button type="button" className="landing-brand dashboard-brand" onClick={() => goTo("/dashboard", "login")}>
              <img src={logoUrl} alt="Atera logo" />
              <strong>Atera</strong>
            </button>

            <div className="dashboard-controls">
              <label className="language-picker">
                <span>{labels.language}</span>
                <select value={form.language} onChange={(event) => updateField("language", event.target.value)}>
                  <option value="en">EN</option>
                  <option value="tr">TR</option>
                </select>
              </label>
              <ThemeToggle />
            </div>
          </div>

          <nav className="dashboard-nav">
            <button
              type="button"
              className={activePage.startsWith("dashboard") ? "active" : ""}
              onClick={() => goTo("/dashboard", "login")}
            >
              {labels.dashboard}
            </button>
            {dashboardModules.map((module) => (
              <React.Fragment key={module.key}>
                <button
                  type="button"
                  className={activePage === module.key || (module.key === "operations" && activePage.startsWith("operations/")) || (module.key === "product-plus" && activePage.startsWith("product-plus/")) || (module.key === "financial-modelling" && activePage.startsWith("financial-modelling/")) || (module.key === "simulation" && activePage.startsWith("simulation/")) ? "active" : ""}
                  onClick={() => goTo(module.key === "operations" ? "/operations/data-entry" : module.key === "product-plus" ? "/product-plus/product-tree" : module.key === "financial-modelling" ? "/financial-modelling/girdiler" : module.key === "simulation" ? "/simulation/current-situation" : module.path, "login")}
                >
                  {module.label}
                </button>
                {module.key === "operations" && (activePage === "operations" || activePage.startsWith("operations/")) && (
                  <div className="dashboard-subnav" aria-label="Operations submodules">
                    {operationsSubmodules.map((submodule) => (
                      <button
                        type="button"
                        className={activePage === `operations/${submodule.key}` ? "active" : ""}
                        onClick={() => goTo(submodule.path, "login")}
                        key={submodule.key}
                      >
                        {submodule.label}
                      </button>
                    ))}
                  </div>
                )}
                {module.key === "product-plus" && (activePage === "product-plus" || activePage.startsWith("product-plus/")) && (
                  <div className="dashboard-subnav" aria-label="Ürün + submodules">
                    {productPlusSubmodules.map((submodule) => (
                      <button
                        type="button"
                        className={activePage === `product-plus/${submodule.key}` ? "active" : ""}
                        onClick={() => goTo(submodule.path, "login")}
                        key={submodule.key}
                      >
                        {submodule.label}
                      </button>
                    ))}
                  </div>
                )}
                {module.key === "financial-modelling" && (activePage === "financial-modelling" || activePage.startsWith("financial-modelling/")) && (
                  <div className="dashboard-subnav" aria-label="Finansal Modelleme submodules">
                    {[...new Set(financialSubmodules.map((submodule) => submodule.group))].map((group) => (
                      <React.Fragment key={group}>
                        <span className="dashboard-subnav-label">{group}</span>
                        {financialSubmodules.filter((submodule) => submodule.group === group).map((submodule) => (
                          <button
                            type="button"
                            className={activePage === `financial-modelling/${submodule.key}` ? "active" : ""}
                            onClick={() => goTo(submodule.path, "login")}
                            key={submodule.key}
                          >
                            {submodule.label}
                          </button>
                        ))}
                      </React.Fragment>
                    ))}
                  </div>
                )}
                {module.key === "simulation" && (activePage === "simulation" || activePage.startsWith("simulation/")) && (
                  <div className="dashboard-subnav" aria-label={copy("Simulation variants", "Simülasyon varyantları")}>
                    {simulationVariants.map((variant) => (
                      <div className="simulation-subnav-item" key={variant.id}>
                        <button
                          type="button"
                          className={activePage === `simulation/${variant.id}` ? "active" : ""}
                          onClick={() => goTo(variant.path, "login")}
                        >
                          {variant.id === "current-situation" ? copy("Current Situation", "Mevcut Durum") : variant.name || variant.label}
                        </button>
                        {variant.id !== "current-situation" && (
                          <button
                            type="button"
                            className="variant-delete-button"
                            aria-label={copy("Delete variant", "Varyantı sil")}
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteSimulationVariant(variant.id);
                            }}
                          >
                            x
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={addSimulationVariant}>
                      + {copy("Add Variant", "Varyant Ekle")}
                    </button>
                  </div>
                )}
              </React.Fragment>
            ))}
            {authorizationAccess.read && (
              <button
                type="button"
                className={activePage === "authorization" ? "active" : ""}
                onClick={() => goTo("/authorization", "login")}
              >
                {labels.authorizationPage}
              </button>
            )}
          </nav>

          <div className="sidebar-footer">
            <div className="sync-status-card" role="status" aria-label="Data synchronization status">
              <span className="live-dot" />
              <div>
                <strong>{labels.dataSync}</strong>
                <small>{labels.live}</small>
              </div>
            </div>
            <button type="button" className="link-button dashboard-logout" onClick={handleLogout}>
              {labels.logout}
            </button>
          </div>
        </aside>

        <section className="dashboard-content">{children}</section>
      </main>
    );
  }

  if (path === "/") {
    return (
      <main className="landing-page">
        <header className="landing-header">
          <button type="button" className="landing-brand" onClick={() => goTo("/", "login")}>
            <img src={logoUrl} alt="Atera logo" />
            <strong>Atera</strong>
          </button>

          <nav className="landing-nav" aria-label="Landing page sections">
            <a href="#who">{labels.who}</a>
            <a href="#solutions">{labels.solutions}</a>
            <a href="#references">{labels.references}</a>
            <a href="#contact">{labels.contact}</a>
          </nav>

          <div className="landing-controls">
            <label className="language-picker">
              <span>{labels.language}</span>
              <select value={form.language} onChange={(event) => updateField("language", event.target.value)}>
                <option value="en">EN</option>
                <option value="tr">TR</option>
              </select>
            </label>
            <ThemeToggle />
          </div>
        </header>

        <section className="landing-hero">
          <div className="landing-hero-content">
            <h1>{labels.heroTitle}</h1>
            <p>{labels.heroCopy}</p>
            <button type="button" className="submit-button landing-login" onClick={() => goTo("/login", "login")}>
              {labels.goToLogin}
            </button>
          </div>
        </section>

        <section className="landing-sections" aria-label="Atera information">
          <article id="who" className="landing-section">
            <div>
              <span>{labels.who}</span>
              <h2>{labels.who}</h2>
            </div>
            <div className="who-content">
              <p>{labels.whoCopy}</p>
            </div>
            <div className="who-orbit" aria-hidden="true">
              <div className="who-core">Atera</div>
              <span className="who-node node-plan">{copy("Plan", "Planla")}</span>
              <span className="who-node node-test">{copy("Test", "Dene")}</span>
              <span className="who-node node-decide">{copy("Decide", "Karar ver")}</span>
              <span className="who-node node-scale">{copy("Scale", "Büyüt")}</span>
            </div>
          </article>

          <article id="solutions" className="landing-section solutions-section">
            <div>
              <span>{labels.solutions}</span>
              <h2>{labels.solutions}</h2>
            </div>
            <div className="solutions-content">
              <p>{labels.solutionsCopy}</p>
              <div className="persona-carousel" aria-label="Solution personas">
                <div className="persona-track">
                  {[...personas, ...personas].map((persona, index) => (
                    <article className="persona-card" key={`${persona.title}-${index}`}>
                      <PersonaAvatar type={persona.avatarType} title={persona.title} />
                      <div>
                        <h3>{persona.title}</h3>
                        <p>{persona.need}</p>
                        <p>{persona.benefit}</p>
                        <p>{persona.difference}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article id="references" className="landing-section references-section">
            <div>
              <span>{labels.references}</span>
              <h2>{labels.references}</h2>
            </div>
            <div className="references-content">
              <p>{labels.referencesCopy}</p>
              <div className="reference-carousel" aria-label="Reference company logos">
                <div className="reference-track">
                  {references.length ? (
                    [...references, ...references].map((reference, index) => (
                      <article className={`reference-logo-card ${reference.tone}`} key={`${reference.name}-${index}`}>
                        <div className="reference-mark">{reference.mark}</div>
                        <strong>{reference.name}</strong>
                      </article>
                    ))
                  ) : (
                    <article className="reference-logo-card teal">
                      <div className="reference-mark">DB</div>
                      <strong>{copy("No reference records yet", "Henüz referans kaydı yok")}</strong>
                    </article>
                  )}
                </div>
              </div>
            </div>
          </article>

          <article id="contact" className="landing-section contact-section">
            <div>
              <span>{labels.contact}</span>
              <h2>{labels.contact}</h2>
            </div>
            <div className="contact-content">
              <p>{labels.contactCopy}</p>
              <address className="contact-details">
                {labels.contactPhone && <a href={`tel:${labels.contactPhone.replaceAll(" ", "")}`}>{labels.contactPhone}</a>}
                <a href={`mailto:${labels.contactEmail}`}>{labels.contactEmail}</a>
                <span>{labels.contactLocation}</span>
              </address>
            </div>
          </article>
        </section>
      </main>
    );
  }

  if (session && path === "/dashboard") {
    return renderDashboardLayout(
      "dashboard/overview",
        <section className="command-dashboard" aria-label="Atera command dashboard">
          <div className="command-topbar">
            <div className="command-context">
              <strong>{dashboardCompanyName}</strong>
              <span>{dashboardProductContext}</span>
            </div>
            <div className="command-live">
              <span className="live-dot" />
              <strong>{hasOperationData || hasSalesForecast ? copy("Workspace data loaded", "Çalışma alanı verisi yüklendi") : copy("Input needed", "Girdi gerekli")}</strong>
            </div>
            <div className="command-user">
              <span>{currentProfile?.username || form.username || "Atera"}</span>
              <small>{currentProfile?.access_level || "-"}</small>
            </div>
            <button type="button" className="command-run-button" onClick={() => goTo("/simulation/current-situation", "login")}>{copy("Open Simulation", "Simülasyonu Aç")}</button>
          </div>

          <section className={`feasibility-snapshot ${feasibilityVerdict.tone}`} aria-label={copy("Feasibility snapshot", "Fizibilite özeti")}>
            <article className="command-card feasibility-verdict-card">
              <span>{copy("Feasibility snapshot", "Fizibilite özeti")}</span>
              <h1>{feasibilityVerdict.label}</h1>
              <p>{feasibilityVerdict.copy}</p>
              <button type="button" onClick={() => goTo(feasibilityVerdict.path, "login")}>
                {feasibilityVerdict.action}
              </button>
            </article>

            <article className="command-card feasibility-metrics-card">
              <div className="card-heading">
                <div>
                  <span>{copy("Decision signals", "Karar sinyalleri")}</span>
                  <h2>{copy("What the current plan says", "Mevcut plan ne söylüyor")}</h2>
                </div>
                <strong>{feasibilityReadyCount}/{feasibilityChecklist.length}</strong>
              </div>
              <div className="feasibility-metrics">
                {[
                  [copy("Monthly net", "Aylık net"), hasFinancialSourceData ? formatLira(monthlyNet) : noDataValue],
                  [copy("Cash runway", "Nakit dayanma"), hasFinancialSourceData ? `${formatNumber(financialSummary.cashRunwayMonths)} ${copy("mo", "ay")}` : noDataValue],
                  [copy("Unmet sales", "Karşılanmayan satış"), hasFinancialSourceData ? `${formatNumber(unmetForecastUnits)} ${copy("units", "adet")}` : noDataValue],
                  [copy("Unsold stock", "Satılmayan stok"), hasFinancialSourceData ? `${formatNumber(financialSummary.unsoldInventoryUnits)} ${copy("units", "adet")}` : noDataValue],
                ].map(([label, value]) => (
                  <span key={label}>{label}<strong>{value}</strong></span>
                ))}
              </div>
            </article>

            <article className="command-card feasibility-checklist-card">
              <div className="card-heading">
                <div>
                  <span>{copy("Next inputs", "Sıradaki girdiler")}</span>
                  <h2>{copy("Keep it decision-ready", "Karara hazır tut")}</h2>
                </div>
              </div>
              <div className="feasibility-checklist">
                {feasibilityChecklist.map((item) => (
                  <button type="button" className={item.done ? "done" : ""} onClick={() => goTo(item.path, "login")} key={item.label}>
                    <i>{item.done ? "OK" : "!"}</i>
                    <span>{item.label}</span>
                    <strong>{item.done ? copy("Ready", "Hazır") : item.action}</strong>
                  </button>
                ))}
              </div>
            </article>
          </section>

          <div className="command-stat-grid">
            {dashboardStats.map((stat, index) => (
              <article className={`command-card stat-card stat-card-${index + 1}`} key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <small>{stat.delta} {stat.detail}</small>
                <svg viewBox="0 0 120 42" aria-hidden="true">
                  <path d="M4 34 L22 26 L36 30 L52 18 L70 22 L88 10 L116 6" />
                </svg>
              </article>
            ))}
          </div>

          <div className="command-main-grid">
            <article className="command-card factory-map-card">
              <div className="card-heading">
                <div>
                  <span>{copy("Digital Factory Map", "Dijital Fabrika Haritası")}</span>
                  <h2>{copy("Production floor", "Üretim sahası")}</h2>
                </div>
                <button type="button" onClick={openFactoryMapFullscreen}>{copy("Full screen", "Tam ekran")}</button>
              </div>
              <div className="factory-map" aria-label={copy("Digital factory map", "Dijital fabrika haritası")}>
                {(factoryLines.length ? factoryLines : [{ name: copy("Add machines", "Makine ekleyin"), status: copy("Operations input", "Operations girdisi"), tone: "amber" }]).map((line, index) => (
                  <div className={`factory-node ${line.tone} node-${index + 1}`} key={line.name}>
                    <strong>{line.name}</strong>
                    <span>{line.status}</span>
                  </div>
                ))}
                <div className="factory-building building-a">{copy("Cutting", "Kesim")}</div>
                <div className="factory-building building-b">{copy("Press", "Pres")}</div>
                <div className="factory-building building-c">{copy("Packaging", "Paketleme")}</div>
              </div>
              <div className="factory-metrics">
                {factoryMetrics.map(([label, value]) => (
                  <span key={label}>{label} <strong>{value}</strong></span>
                ))}
              </div>
            </article>

            <article className="command-card finance-card">
              <div className="card-heading">
                <div>
                  <span>{copy("Financial Impact Panel", "Finansal Etki Paneli")}</span>
                  <h2>{financeWindowLabel} {copy("impact", "etkisi")}</h2>
                </div>
                <div className="finance-date-controls" aria-label={copy("Financial impact date range", "Finansal etki tarih aralığı")}>
                  <select value={financeWindow} onChange={(event) => setFinanceWindow(event.target.value)}>
                    <option value="today">{copy("Today", "Bugün")}</option>
                    <option value="tomorrow">{copy("Tomorrow", "Yarın")}</option>
                    <option value="week">{copy("This week", "Bu hafta")}</option>
                    <option value="month">{copy("This month", "Bu ay")}</option>
                    <option value="custom">{copy("Custom range", "Özel aralık")}</option>
                  </select>
                  <input
                    aria-label={copy("Start date", "Başlangıç tarihi")}
                    type="date"
                    value={financeDateRange.start}
                    onChange={(event) => updateFinanceDateRange("start", event.target.value)}
                  />
                  <input
                    aria-label={copy("End date", "Bitiş tarihi")}
                    type="date"
                    value={financeDateRange.end}
                    onChange={(event) => updateFinanceDateRange("end", event.target.value)}
                  />
                </div>
              </div>
              <div className="finance-kpis">
                {dashboardFinanceKpis.map(([label, value]) => (
                  <span key={label}>{label} <strong>{value}</strong></span>
                ))}
              </div>
              <div className="finance-chart" aria-hidden="true">
                <svg viewBox="0 0 520 250">
                  <path className="chart-grid" d="M30 40 H500 M30 92 H500 M30 144 H500 M30 196 H500" />
                  <path className="chart-line" d={projectedFinancialModel.trendChart?.salesPath || ""} />
                  <path className="chart-dash" d={projectedFinancialModel.trendChart?.netPath || ""} />
                </svg>
              </div>
              <div className="risk-list">
                {dashboardFinancialRisks.map(([label, value]) => (
                  <span key={label}>{label} <strong>{value}</strong></span>
                ))}
              </div>
            </article>
          </div>

          <section className="insight-strip" aria-label={copy("Decision insights", "Karar içgörüleri")}>
            <div className="card-heading">
              <div>
                <span>{copy("Decision insights", "Karar içgörüleri")}</span>
                <h2>{copy("What to improve first", "Önce ne iyileştirilmeli")}</h2>
              </div>
              {authorizationAccess.read && (
                <button type="button" onClick={() => goTo("/authorization", "login")}>
                  {labels.authorizationPage}
                </button>
              )}
            </div>
            <div className="insight-grid">
              {dashboardInsights.map((item) => (
                <article className={`insight-card ${item.tone}`} key={item.title}>
                  <strong>{item.title}</strong>
                  <p>{item.copy}</p>
                  <span>{copy("Review details", "Detayları incele")}</span>
                </article>
              ))}
              {(improvementFocus.length ? improvementFocus : [copy("The core workflow is complete. Use Simulation to test a conservative and optimistic variant.", "Ana akış tamam. Simülasyon ile temkinli ve iyimser bir varyantı test edin.")]).map((item, index) => (
                <article className={`insight-card ${index === 0 ? feasibilityVerdict.tone : "cyan"}`} key={item}>
                  <strong>{index === 0 ? copy("Recommended move", "Önerilen adım") : copy("Next check", "Sonraki kontrol")}</strong>
                  <p>{item}</p>
                  <span>{copy("Use before committing", "Karardan önce kullan")}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-detail-page dashboard-section-block" aria-label="Risk, profitability, and current status">
            <div className="detail-heading">
              <span>{copy("Risk and margin control", "Risk ve marj kontrolü")}</span>
              <h1>Riskler, karlılık ve mevcut durum</h1>
              <p>{copy("A focused view for the risks that can affect delivery promises, margin, and today's production health.", "Termin sözünü, marjı ve bugünün üretim sağlığını etkileyebilecek riskler için odaklanmış görünüm.")}</p>
            </div>

            <div className="command-stat-grid">
              {[
                { label: copy("Open Inputs", "Eksik Girdi"), value: formatNumber([!operationsWorkspace.product, !activePlanResults.length, !hasSalesForecast, !financialSummary.initialCash].filter(Boolean).length), delta: copy("needed", "gerekli"), detail: copy("for full feasibility", "tam fizibilite için") },
                { label: copy("Net Profit", "Net Kâr"), value: moneyOrMissing(monthlyNet), delta: copy("monthly", "aylık"), detail: copy("forecast basis", "tahmin bazlı") },
                { label: copy("Inventory Risk", "Stok Riski"), value: hasFinancialSourceData ? formatNumber(financialSummary.unsoldInventoryUnits) : noDataValue, delta: copy("units", "adet"), detail: copy("unsold forecast", "satılmayan tahmin") },
                { label: copy("Current Status", "Mevcut Durum"), value: activePlanResults.length ? formatNumber(activePlanResults.length) : noDataValue, delta: copy("plans", "plan"), detail: copy("saved in backend", "backend'de kayıtlı") },
              ].map((stat, index) => (
                <article className={`command-card stat-card stat-card-${index + 1}`} key={stat.label}>
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                  <small>{stat.delta} {stat.detail}</small>
                </article>
              ))}
            </div>

            <div className="command-main-grid">
              <article className="command-card risk-focus-card">
                <div className="card-heading">
                  <div>
                    <span>{copy("Risk register", "Risk kayıtları")}</span>
                    <h2>{copy("Priority watchlist", "Öncelikli takip listesi")}</h2>
                  </div>
                </div>
                <div className="risk-list risk-detail-list">
                  {dashboardInsights.slice(0, 4).map((item) => (
                    <span key={item.title}>
                      {item.title}
                      <strong>{item.tone === "clay" ? copy("High", "Yüksek") : item.tone === "amber" ? copy("Medium", "Orta") : copy("Controlled", "Kontrollü")}</strong>
                    </span>
                  ))}
                </div>
              </article>

              <article className="command-card finance-card">
                <div className="card-heading">
                  <div>
                    <span>{copy("Profitability", "Karlılık")}</span>
                    <h2>{copy("Today's margin bridge", "Bugünün marj köprüsü")}</h2>
                  </div>
                </div>
                <div className="finance-kpis">
                  {dashboardFinanceKpis.map(([label, value]) => (
                    <span key={label}>{label} <strong>{value}</strong></span>
                  ))}
                </div>
                <div className="risk-list">
                  {dashboardFinancialRisks.map(([label, value]) => (
                    <span key={label}>{label} <strong>{value}</strong></span>
                  ))}
                </div>
              </article>
            </div>
          </section>

          <section className="dashboard-detail-page dashboard-section-block" aria-label="Short summary">
            <div className="detail-heading">
              <span>{copy("Executive snapshot", "Yönetici özeti")}</span>
              <h1>Kısa özet</h1>
              <p>{copy("The few signals worth reading before the next production or finance decision.", "Bir sonraki üretim ya da finans kararından önce okunması gereken kısa sinyaller.")}</p>
            </div>

            <div className="summary-grid">
              {[
                [copy("Production", "Üretim"), activePlanResults.length ? `${formatNumber(totalDailyProduction, 2)} ${latestPlanResult?.productUnit || copy("units", "adet")} ${copy("daily output is calculated from saved process plans.", "günlük çıktı kayıtlı süreç planlarından hesaplandı.")}` : copy("Save a process plan to calculate daily output from backend data.", "Günlük çıktıyı backend verisinden hesaplamak için süreç planı kaydedin.")],
                [copy("Profitability", "Karlılık"), hasFinancialSourceData ? `${copy("Monthly net estimate:", "Aylık net tahmin:")} ${formatLira(monthlyNet)}.` : copy("Enter product-linked sales channels and cost assumptions to calculate profitability.", "Karlılığı hesaplamak için ürüne bağlı satış kanallarını ve maliyet varsayımlarını girin.")],
                [copy("Risk", "Risk"), hasFinancialSourceData ? `${copy("Unsold inventory:", "Satılmayan stok:")} ${formatNumber(financialSummary.unsoldInventoryUnits)} ${copy("units", "adet")}.` : copy("Inventory and write-off risk appears after sales and production data exist.", "Stok ve fire riski satış ve üretim verisi oluşunca görünür.")],
                [copy("Recommendation", "Öneri"), hasFinancialSourceData ? copy("Review cash runway, working capital, and payback before committing investment.", "Yatırıma girmeden önce nakit dayanma, işletme sermayesi ve geri dönüşü kontrol edin.") : copy("Complete missing inputs before treating the feasibility result as decision-ready.", "Fizibilite sonucunu karar seviyesinde kullanmadan önce eksik girdileri tamamlayın.")],
              ].map(([title, summary]) => (
                <article className="command-card summary-card" key={title}>
                  <span>{title}</span>
                  <p>{summary}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="dashboard-logo-row" aria-label={copy("Company and Atera logos", "Şirket ve Atera logoları")}>
            <div className="customer-logo-mark" aria-label={copy("Company logo", "Şirket logosu")}>
              <strong>{dashboardCompanyName.slice(0, 2).toUpperCase()}</strong>
              <span>{dashboardCompanyName}</span>
            </div>
            <div className="atera-logo-mark" aria-label="Atera logo">
              <img src={logoUrl} alt="" />
              <span>Atera</span>
            </div>
          </div>
        </section>,
    );
  }

  if (session && path === "/dashboard/riskler-karlilik-mevcut-durum") {
    goTo("/dashboard", "login");
    return null;
  }

  if (session && path === "/dashboard/kisa-ozet") {
    goTo("/dashboard", "login");
    return null;
  }

  if (session && (activeModule || isOperationsRoute || isProductPlusRoute || isFinancialRoute || isSimulationRoute)) {
    if (path === "/operations") {
      goTo("/operations/data-entry", "login");
      return null;
    }

    if (isOperationsRoute && !activeOperationsSubmodule) {
      goTo(["/operations/material-definitions", "/operations/human-resources"].includes(path) ? "/operations/resources" : "/operations/data-entry", "login");
      return null;
    }

    if (path === "/product-plus") {
      goTo("/product-plus/product-tree", "login");
      return null;
    }

    if (isProductPlusRoute && !activeProductPlusSubmodule) {
      goTo("/product-plus/product-tree", "login");
      return null;
    }

    if (activeOperationsSubmodule?.key === "data-entry") {
      return renderDashboardLayout(
        `operations/${activeOperationsSubmodule.key}`,
          <section className="operations-workspace operations-modern">
            <div className="operations-header">
              <div>
                <span>Operations / {copy("Process Definition", "Süreç Tanımlama")}</span>
                <h1>{copy("Process Definition", "Süreç Tanımlama")}</h1>
              </div>
              <div className="operations-actions">
                <button type="button" onClick={loadOperationsData}>{copy("Refresh Data", "Verileri Yenile")}</button>
              </div>
            </div>
            {renderOperationPlanner()}
          </section>,
      );
    }

    if (activeOperationsSubmodule?.key === "resources") {
      return renderResourcesPage();
    }

    if (activeOperationsSubmodule?.key === "active-processes") {
      return renderActiveProcessesPage();
    }

    if (activeOperationsSubmodule?.key === "machines-equipment") {
      return renderMachinesEquipmentPage();
    }

    if (activeOperationsSubmodule?.key === "products") {
      return renderProductDataPage();
    }

    if (activeProductPlusSubmodule?.key === "product-tree") {
      return renderDashboardLayout(
        `product-plus/${activeProductPlusSubmodule.key}`,
          <section className="operations-workspace">
            <div className="operations-header">
              <div>
                <span>{copy("Product Tree / Product Detail", "Ürün Ağacı / Ürün Detayı")}</span>
                <h1>{operationsWorkspace.product?.name || copy("Operational Definition", "Operasyonel Tanımlama")}</h1>
              </div>
              <div className="operations-actions">
                <button type="button" onClick={() => goTo("/dashboard", "login")}>{copy("Back", "Geri")}</button>
                <button type="button" className="primary" onClick={() => goTo("/operations/products", "login")}>{copy("Edit Product", "Ürünü Düzenle")}</button>
              </div>
            </div>

            <div className="operations-tabs" role="tablist" aria-label={copy("Operation detail tabs", "Operasyon detay sekmeleri")}>
              {[
                ["general", copy("General Information", "Genel Bilgiler")],
                ["technical", copy("Technical Specs", "Teknik Özellikler")],
                ["materials", copy("Materials & Components", "Malzeme & Bileşenler")],
                ["flow", copy("Process Flow", "Süreç Akışı")],
                ["notes", copy("Notes", "Notlar")],
              ].map(([key, tab]) => (
                <button type="button" className={productPlusTab === key ? "active" : ""} onClick={() => setProductPlusTab(key)} key={key}>{tab}</button>
              ))}
            </div>

            <div className="operations-grid">
              <article className="operation-card part-visual-card">
                <div className="part-blueprint" aria-label={copy("Gasket technical visual", "Conta teknik görseli")}>
                  <div className="gasket-shape">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <div className="part-status-row">
                  <span>{copy("Weight", "Ağırlık")} <strong>{operationsWorkspace.product?.weight_kg || "-"}kg</strong></span>
                  <span>{copy("Size", "Boyut")} <strong>{operationsWorkspace.product?.dimensions || "-"}</strong></span>
                  <span>{copy("Material", "Malzeme")} <strong>{operationsWorkspace.product?.material_name || "-"}</strong></span>
                  <span>{copy("Quality", "Kalite")} <strong>{operationsWorkspace.product?.quality_grade || "-"}</strong></span>
                  <span>{copy("Cycle", "Çevrim")} <strong>{operationsWorkspace.product?.cycle_time_seconds || "-"} {copy("sec", "sn")}</strong></span>
                </div>
              </article>

              <article className="operation-card part-info-card">
                <div className="part-title">
                  <span>{operationsWorkspace.product?.status || noDataValue}</span>
                  <h2>{operationsWorkspace.product?.product_code || noDataValue}</h2>
                </div>
                <dl>
                  <div><dt>{copy("Product Code", "Ürün Kodu")}</dt><dd>{operationsWorkspace.product?.product_code || "-"}</dd></div>
                  <div><dt>{copy("Product Name", "Ürün Adı")}</dt><dd>{operationsWorkspace.product?.name || "-"}</dd></div>
                  <div><dt>{copy("Product Group", "Ürün Grubu")}</dt><dd>{operationsWorkspace.product?.product_group || "-"}</dd></div>
                  <div><dt>{copy("Revision", "Revizyon")}</dt><dd>{operationsWorkspace.product?.revision || "-"}</dd></div>
                  <div><dt>{copy("Status", "Durum")}</dt><dd>{operationsWorkspace.product?.status || "-"}</dd></div>
                  <div><dt>{copy("Created Date", "Oluşturma Tarihi")}</dt><dd>{operationsWorkspace.product?.created_at ? new Date(operationsWorkspace.product.created_at).toLocaleDateString(locale) : "-"}</dd></div>
                  <div><dt>{copy("Last Update", "Son Güncelleme")}</dt><dd>{operationsWorkspace.product?.updated_at ? new Date(operationsWorkspace.product.updated_at).toLocaleString(locale) : "-"}</dd></div>
                  <div><dt>{copy("Description", "Açıklama")}</dt><dd>{operationsWorkspace.product?.description || "-"}</dd></div>
                </dl>
              </article>

              <article className="operation-card machine-card">
                <div className="operation-card-heading">
                  <h2>{copy("Machine Pool", "Makine Havuzu")}</h2>
                  <span>{copy("Machine pool", "Makine havuzu")}</span>
                </div>
                <div className="machine-table">
                  <div className="machine-row machine-head"><span>{copy("Machine", "Makine")}</span><span>{copy("Price", "Fiyat")}</span><span>{copy("Energy", "Enerji")}</span><span>{copy("Status", "Durum")}</span></div>
                  {operationsWorkspace.machines.map((machine) => (
                    <div className="machine-row" key={machine.id}>
                      <strong>{machine.name}</strong>
                      <span>{formatLira(machine.price)}</span>
                      <span>{formatNumber(machine.hourly_energy_consumption_kwh, 2)} {copy("kWh/hour", "kWh/saat")}</span>
                      <mark className="ok">{copy("Defined", "Tanımlı")}</mark>
                    </div>
                  ))}
                </div>
              </article>

              <article className="operation-card technical-card">
                <h2>{copy("Technical Specs", "Teknik Özellikler")}</h2>
                <div className="technical-grid">
                  {technicalSpecs.map(([label, value]) => (
                    <div key={label}><span>{label}</span><strong>{value}</strong></div>
                  ))}
                </div>
              </article>

              <article className="operation-card finance-impact-card">
                <div className="operation-card-heading">
                  <h2>{copy("Financial Impact", "Finansal Etki")}</h2>
                  <select value={financialHorizon} onChange={(event) => loadFinancialData(event.target.value)}>
                    <option value="6m">{copy("Next 6 months", "Gelecek 6 ay")}</option>
                    <option value="1y">{copy("Next 12 months", "Gelecek 12 ay")}</option>
                    <option value="5y">{copy("Next 60 months", "Gelecek 60 ay")}</option>
                  </select>
                </div>
                <div className="impact-kpis">
                  <span>{copy("Unit Sale Price", "Birim Satış Fiyatı")} <strong>{operationUnitSalePrice ? formatLira(operationUnitSalePrice, 2) : noDataValue}</strong></span>
                  <span>{copy("Daily Cost", "Günlük Maliyet")} <strong>{latestPlanResult ? formatLira(latestPlanResult.totalTrackedDailyCost) : noDataValue}</strong></span>
                  <span>{copy("Unit Profit", "Birim Kâr")} <strong>{operationUnitSalePrice && operationUnitCost ? formatLira(operationUnitProfit, 2) : noDataValue}</strong></span>
                  <span>{copy("Profit Margin", "Kâr Marjı")} <strong>{operationUnitSalePrice && operationUnitCost ? `${formatNumber(operationProfitMargin, 1)}%` : noDataValue}</strong></span>
                </div>
                <div className="impact-body">
                  <div className="donut-chart" aria-hidden="true"><span>{latestPlanResult ? formatLira(latestPlanResult.totalTrackedDailyCost) : noDataValue}</span></div>
                  <div className="monthly-impact">
                    <span>{copy("Product", "Ürün")} <strong>{latestPlanResult?.productName || operationsWorkspace.product?.name || noDataValue}</strong></span>
                    <span>{copy("Estimated Revenue", "Tahmini Ciro")} <strong>{moneyOrMissing(monthlyRevenue)}</strong></span>
                    <span>{copy("Estimated Cost", "Tahmini Maliyet")} <strong>{moneyOrMissing(monthlyCost)}</strong></span>
                    <span>{copy("Net Profit Margin", "Net Kâr Marjı")} <strong>{hasFinancialSourceData && monthlyRevenue ? `${formatNumber((monthlyNet / monthlyRevenue) * 100, 1)}%` : noDataValue}</strong></span>
                  </div>
                </div>
              </article>

              <article className="operation-card notes-card">
                <div className="operation-card-heading">
                  <h2>{copy("Notes", "Notlar")}</h2>
                  <button type="button" onClick={handleCreateOperationNote} disabled={operationsLoading}>{copy("New Note", "Yeni Not")}</button>
                </div>
                {(operationsWorkspace.notes.length ? operationsWorkspace.notes : [{ id: "empty", note: copy("No product note yet.", "Henüz ürün notu yok."), created_at: new Date().toISOString() }]).map((note) => (
                  <p key={note.id}>{new Date(note.created_at).toLocaleDateString(locale)}: {note.note}</p>
                ))}
              </article>
            </div>

            <article className="operation-card operation-flow">
              <div className="operation-card-heading">
                <h2>{copy("Operation Flow", "Operasyon Akışı")}</h2>
                <button type="button" onClick={focusOperationFlow}>{copy("View Flow Diagram", "Akış Diyagramını Gör")}</button>
              </div>
              <div className="flow-steps">
                {(operationFlowSteps.length ? operationFlowSteps : [{ id: "empty", name: copy("Save a process plan", "Süreç planı kaydedin"), station: copy("Backend result needed", "Backend sonucu gerekli") }]).map((step, index) => ({ ...step, step_order: index + 1 })).map((step) => (
                  <div className="flow-step" key={step.id}>
                    <span>{step.step_order}</span>
                    <strong>{step.name}</strong>
                    <small>{step.station}</small>
                  </div>
                ))}
              </div>
            </article>
          </section>,
      );
    }

    if (activeOperationsSubmodule) {
      return renderDashboardLayout(
        `operations/${activeOperationsSubmodule.key}`,
          <section className="module-placeholder">
            <div>
              <span>{copy("Operations placeholder", "Operations boş durum")}</span>
              <h1>{activeOperationsSubmodule.label}</h1>
              <p>{copy("This subpage is prepared under the Operations module. Content and business logic will be added later.", "Bu alt sayfa Operations modülü altında hazırlandı. İçerik ve iş mantığı daha sonra eklenecek.")}</p>
            </div>
            <div className="placeholder-grid">
              <article>
                <strong>{copy("Submodule", "Alt Modül")}</strong>
                <p>{copy("The screen structure for", "Ekran yapısı")} {activeOperationsSubmodule.label} {copy("will be developed here.", "için burada geliştirilecek.")}</p>
              </article>
              <article>
                <strong>{copy("Status", "Durum")}</strong>
                <p>{copy("For now, only frontend routing and the empty state screen are available.", "Şimdilik sadece frontend routing ve boş durum ekranı mevcut.")}</p>
              </article>
            </div>
          </section>,
      );
    }

    if (path === "/financial-modelling") {
      goTo("/financial-modelling/girdiler", "login");
      return null;
    }

    if (isFinancialRoute && !activeFinancialSubmodule) {
      goTo(isLegacyFinancialDetailPath ? "/financial-modelling/analiz" : "/financial-modelling/girdiler", "login");
      return null;
    }

    if (activeModule?.key === "financial-modelling" || activeFinancialSubmodule) {
      return renderFinancialModellingPage();
    }

    if (isSimulationRoute) {
      if (path === "/simulation" || !activeSimulationVariant) {
        goTo("/simulation/current-situation", "login");
        return null;
      }

      return renderSimulationPage();
    }

    if (activeModule?.key === "sales-strategy") {
      return renderSalesStrategyPage();
    }

    if (activeModule.key === "reports") {
      return renderDashboardLayout(
        activeModule.key,
          <section className="reports-workspace">
            <div className="reports-header">
              <div>
                <span>{dashboardCompanyName} / {dashboardProductContext}</span>
                <h1>{copy("Reports", "Raporlar")}</h1>
                <p>{copy("Reports here are generated from Supabase records already loaded into Operations, Sales Strategy, and Financial Modelling.", "Buradaki raporlar Operations, Satış Stratejisi ve Finansal Modelleme'de Supabase'ten gelen kayıtlardan oluşturulur.")}</p>
              </div>
            </div>

            <div className="reports-tabs" role="tablist" aria-label={copy("Report types", "Rapor türleri")}>
              {reportTabs.map((tab) => (
                <button type="button" className={reportsTab === tab.key ? "active" : ""} onClick={() => setReportsTab(tab.key)} key={tab.key}>{tab.label}</button>
              ))}
            </div>

            <div className="reports-controls">
              <label><span>{copy("Search reports", "Rapor ara")}</span><input placeholder={copy("Search reports...", "Rapor ara...")} value={reportsSearch} onChange={(event) => setReportsSearch(event.target.value)} /></label>
              <button type="button" className={reportsFilterOpen ? "active" : ""} onClick={() => setReportsFilterOpen((current) => !current)}>{copy("Filters", "Filtreler")}</button>
              <select value={financialHorizon} onChange={(event) => loadFinancialData(event.target.value)}>
                <option value="6m">{copy("Next 6 months", "Gelecek 6 ay")}</option>
                <option value="1y">{copy("Next 12 months", "Gelecek 12 ay")}</option>
                <option value="5y">{copy("Next 60 months", "Gelecek 60 ay")}</option>
              </select>
              <button type="button" className="primary" onClick={() => exportReportsCsv(visibleRecentReports)}>{copy("Export", "Dışa Aktar")}</button>
            </div>
            {reportsFilterOpen && (
              <div className="reports-filter-summary">
                {copy("Showing", "Gösterilen")} <strong>{activeReportTab.label}</strong>
                {reportsSearch ? ` / ${copy("search", "arama")}: ${reportsSearch}` : ""}
              </div>
            )}

            <div className="report-stat-grid">
              {reportStats.map(([label, value, detail]) => (
                <article className="report-stat-card" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>{detail}</small>
                </article>
              ))}
            </div>

            <div className="reports-grid">
              <article className="reports-card distribution-card">
                <h2>{copy("Distribution by Report Category", "Rapor Kategorilerine Göre Dağılım")}</h2>
                <div className="distribution-body">
                  <div className="donut-chart report-donut" aria-hidden="true"><span>{formatNumber(recentReports.length)}<small>{copy("Total", "Toplam")}</small></span></div>
                  <div className="report-category-list">
                    {(reportCategories.length ? reportCategories : [[copy("No report data yet", "Henüz rapor verisi yok"), 0]]).map(([item, percent]) => (
                      <span key={item}>{item}<strong>{percent}%</strong></span>
                    ))}
                  </div>
                </div>
              </article>

              <article className="reports-card usage-card">
                <div className="reports-card-heading"><h2>{copy("Report Usage Trend", "Rapor Kullanım Trendi")}</h2><select defaultValue="daily"><option value="daily">{copy("Daily", "Günlük")}</option><option value="weekly">{copy("Weekly", "Haftalık")}</option></select></div>
                <svg className="reports-trend" viewBox="0 0 620 230" aria-hidden="true">
                  <path className="chart-grid" d="M30 42 H590 M30 92 H590 M30 142 H590 M30 192 H590" />
                  <path className="trend-line sales" d={projectedFinancialModel.trendChart?.salesPath || ""} />
                  <path className="trend-line gross" d={projectedFinancialModel.trendChart?.costPath || ""} />
                  <path className="trend-line net" d={projectedFinancialModel.trendChart?.netPath || ""} />
                </svg>
              </article>

              <article className="reports-card recent-reports-card">
                <div className="reports-card-heading"><h2>{copy("Recent Reports", "Son Raporlar")}</h2><button type="button" onClick={() => { setReportsTab("all"); setReportsSearch(""); }}>{copy("View All", "Tümünü Gör")}</button></div>
                <div className="recent-report-table">
                  <div className="recent-report-row report-head"><span>{copy("Report Name", "Rapor Adı")}</span><span>{copy("Category", "Kategori")}</span><span>{copy("Created Date", "Oluşturulma Tarihi")}</span><span>{copy("Period", "Dönem")}</span><span>{copy("Created By", "Oluşturan")}</span><span>{copy("Actions", "İşlemler")}</span></div>
                  {(visibleRecentReports.length ? visibleRecentReports : [[copy("No report snapshots match the current filter", "Geçerli filtreyle eşleşen rapor yok"), copy("Input required", "Girdi gerekli"), "-", "-", reportAuthor]]).map((report) => (
                    <div className="recent-report-row" key={report[0]}>
                      {report.map((cell, index) => index === 0 ? <strong key={cell}>{cell}</strong> : <span key={`${report[0]}-${index}`}>{cell}</span>)}
                      <span className="report-actions">-</span>
                    </div>
                  ))}
                </div>
              </article>

              <aside className="reports-side">
                <article className="reports-card schedule-card">
                  <div className="reports-card-heading"><h2>{copy("Data Readiness", "Veri Hazırlığı")}</h2><button type="button" onClick={loadPlanningData}>{copy("Refresh", "Yenile")}</button></div>
                  {[
                    [copy("Product record", "Ürün kaydı"), operationsWorkspace.product ? copy("Ready", "Hazır") : copy("Needed", "Gerekli")],
                    [copy("Process backend result", "Süreç backend sonucu"), activePlanResults.length ? copy("Ready", "Hazır") : copy("Needed", "Gerekli")],
                    [copy("Channel sales plan", "Kanal satış planı"), hasSalesForecast ? copy("Ready", "Hazır") : copy("Needed", "Gerekli")],
                    [copy("Financial assumptions", "Finansal varsayımlar"), hasFinancialAssumptions ? copy("Ready", "Hazır") : copy("Needed", "Gerekli")],
                  ].map(([item, state]) => (
                    <div className="schedule-row" key={item}>
                      <strong>{item}</strong>
                      <span>{copy("Stored in Supabase", "Supabase'te kayıtlı")}</span>
                      <mark>{state}</mark>
                    </div>
                  ))}
                </article>

                <article className="reports-card quick-report-card">
                  <h2>{copy("Create Quick Report", "Hızlı Rapor Oluştur")}</h2>
                  <div className="quick-report-grid">
                    {[
                      [copy("Production Report", "Üretim Raporu"), "production"],
                      [copy("Financial Summary", "Finansal Özet"), "financial"],
                      [copy("Sales Analysis", "Satış Analizi"), "sales"],
                      [copy("Capacity Analysis", "Kapasite Analizi"), "capacity"],
                      [copy("Custom Report", "Özel Rapor"), "all"],
                    ].map(([item, tabKey]) => (
                      <button type="button" onClick={() => { setReportsTab(tabKey); setReportsSearch(""); }} key={item}>{item}</button>
                    ))}
                  </div>
                </article>
              </aside>
            </div>
          </section>,
      );
    }

    if (activeModule.key === "human-resources-plus") {
      return renderDashboardLayout(
        activeModule.key,
          <section className="module-placeholder">
            <div>
              <span>{copy("Workforce module", "İnsan kaynağı modülü")}</span>
              <h1>{activeModule.label}</h1>
              <p>{copy("This workspace is ready for workforce definitions, skills, labor capacity, and planning across operations.", "Bu çalışma alanı iş gücü tanımları, yetkinlikler, işçilik kapasitesi ve operasyon geneli planlama için hazırlandı.")}</p>
            </div>
            <div className="placeholder-grid">
              <article>
                <strong>{copy("Workforce Planning", "İş Gücü Planlama")}</strong>
                <p>{copy("Connect roles, operators, and capacity needs to production workflows.", "Rolleri, operatörleri ve kapasite ihtiyaçlarını üretim iş akışlarına bağlayın.")}</p>
              </article>
              <article>
                <strong>{copy("Status", "Durum")}</strong>
                <p>{copy("Frontend routing is active; data tables and business logic can be added next.", "Frontend routing aktif; veri tabloları ve iş mantığı sonraki adımda eklenebilir.")}</p>
              </article>
            </div>
          </section>,
      );
    }

    return renderDashboardLayout(
      activeModule.key,
        <section className="module-placeholder">
          <div>
            <span>{copy("Module placeholder", "Modül boş durumu")}</span>
            <h1>{activeModule.label}</h1>
            <p>{copy("This module is visible in the dashboard navigation and is ready for its frontend workflow.", "Bu modül dashboard navigasyonunda görünür ve frontend iş akışı için hazırdır.")}</p>
          </div>
          <div className="placeholder-grid">
            <article>
              <strong>{copy("Workspace", "Çalışma Alanı")}</strong>
              <p>{copy("Empty state for upcoming tools, tables, and decision screens.", "Yakında eklenecek araçlar, tablolar ve karar ekranları için boş durum.")}</p>
            </article>
            <article>
              <strong>{copy("Status", "Durum")}</strong>
              <p>{copy("This module will stay empty until its Supabase-backed workflow is added.", "Bu modül Supabase bağlantılı iş akışı eklenene kadar boş kalır.")}</p>
            </article>
          </div>
        </section>,
    );
  }

  if (session && path === "/authorization") {
    return renderDashboardLayout(
      "authorization",
        <section className="authorization-page">
          <div className="authorization-heading">
            <span>{labels.dashboard}</span>
            <h1>{labels.authorizationPage}</h1>
            <p>{authorizationAccess.read ? labels.authorizationCopy : labels.authorizationLockedCopy}</p>
          </div>

          {!authorizationAccess.read ? (
            <div className="authorization-locked">
              <strong>{labels.authorizationLocked}</strong>
              <p>{labels.authorizationLockedCopy}</p>
            </div>
          ) : (
            <>
              <div className="authorization-tabs" role="tablist" aria-label={labels.authorizationPage}>
                <button
                  type="button"
                  className={authorizationTab === "roles" ? "active" : ""}
                  onClick={() => setAuthorizationTab("roles")}
                >
                  {labels.roleDefinition}
                </button>
                <button
                  type="button"
                  className={authorizationTab === "users" ? "active" : ""}
                  onClick={() => setAuthorizationTab("users")}
                >
                  {labels.userDefinition}
                </button>
              </div>

              {authorizationTab === "users" ? (
                <div className="authorization-grid user-definition-grid">
                  <form className="authorization-card user-definition-form" onSubmit={handleCreateManagedUser}>
                    <h2>{labels.userDefinition}</h2>
                    <p>{labels.userDefinitionCopy}</p>
                    <label>
                      <span>{labels.username}</span>
                      <input
                        disabled={!authorizationAccess.write || authorizationLoading}
                        required
                        value={managedUserForm.username}
                        onChange={(event) => updateManagedUserForm("username", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>{labels.email}</span>
                      <input
                        disabled={!authorizationAccess.write || authorizationLoading}
                        required
                        type="email"
                        value={managedUserForm.email}
                        onChange={(event) => updateManagedUserForm("email", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>{labels.password}</span>
                      <input
                        disabled={!authorizationAccess.write || authorizationLoading}
                        minLength="6"
                        required
                        type="password"
                        value={managedUserForm.password}
                        onChange={(event) => updateManagedUserForm("password", event.target.value)}
                      />
                    </label>
                    <div className="user-definition-fields">
                      <label>
                        <span>{labels.phoneNumber}</span>
                        <input
                          disabled={!authorizationAccess.write || authorizationLoading}
                          value={managedUserForm.phoneNumber}
                          onChange={(event) => updateManagedUserForm("phoneNumber", event.target.value)}
                        />
                      </label>
                      <label>
                        <span>{labels.department}</span>
                        <input
                          disabled={!authorizationAccess.write || authorizationLoading}
                          value={managedUserForm.department}
                          onChange={(event) => updateManagedUserForm("department", event.target.value)}
                        />
                      </label>
                      <label>
                        <span>{labels.accessLevel}</span>
                        <select
                          disabled={!authorizationAccess.write || authorizationLoading}
                          value={managedUserForm.accessLevel}
                          onChange={(event) => updateManagedUserForm("accessLevel", event.target.value)}
                        >
                          {editableAuthorizationRoles.map((role) => (
                            <option value={role.name} key={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>{labels.language}</span>
                        <select
                          disabled={!authorizationAccess.write || authorizationLoading}
                          value={managedUserForm.language}
                          onChange={(event) => updateManagedUserForm("language", event.target.value)}
                        >
                          <option value="en">EN</option>
                          <option value="tr">TR</option>
                        </select>
                      </label>
                    </div>
                    <button className="submit-button" disabled={!authorizationAccess.write || authorizationLoading} type="submit">
                      {authorizationLoading ? "..." : labels.createManagedUser}
                    </button>
                    <p className="authorization-note">
                      {authorizationAccess.write ? labels.writeAccess : labels.readOnlyMode}
                    </p>
                  </form>

                  <div className="authorization-card users-card">
                    <div className="permissions-header">
                      <h2>{labels.managedUsers}</h2>
                      {currentProfile?.company?.name && <span>{currentProfile.company.name}</span>}
                    </div>
                    <div className="users-table">
                      <div className="users-row users-row-head">
                        <span>{labels.username}</span>
                        <span>{labels.email}</span>
                        <span>{labels.department}</span>
                        <span>{labels.accessLevel}</span>
                      </div>
                      {profiles.map((profile) => (
                        <div className="users-row" key={profile.id}>
                          <strong>{profile.username}</strong>
                          <span>{profile.email}</span>
                          <span>{profile.department || "-"}</span>
                          <span>{profile.access_level}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="authorization-grid">
                  <form className="authorization-card role-form" onSubmit={handleCreateRole}>
                    <h2>{labels.newRole}</h2>
                    <label>
                      <span>{labels.roleName}</span>
                      <input
                        disabled={!authorizationAccess.write || authorizationLoading}
                        value={roleForm.name}
                        onChange={(event) => updateRoleForm("name", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>{labels.roleDescription}</span>
                      <input
                        disabled={!authorizationAccess.write || authorizationLoading}
                        value={roleForm.description}
                        onChange={(event) => updateRoleForm("description", event.target.value)}
                      />
                    </label>
                    <button className="submit-button" disabled={!authorizationAccess.write || authorizationLoading} type="submit">
                      {labels.createRole}
                    </button>
                    <p className="authorization-note">
                      {authorizationAccess.write ? labels.writeAccess : labels.readOnlyMode}
                    </p>
                  </form>

                  <div className="authorization-card permissions-card">
                    <div className="permissions-header">
                      <h2>{labels.permissions}</h2>
                      {currentProfile?.company?.name && <span>{currentProfile.company.name}</span>}
                    </div>
                    <div className="permissions-table">
                      <div className="permissions-row permissions-row-head">
                        <span>{labels.accessLevel}</span>
                        <span>{labels.module}</span>
                        <span>{labels.readPermission}</span>
                        <span>{labels.writePermission}</span>
                      </div>
                      {editableAuthorizationRoles.map((role) =>
                        modules.map((module) => {
                          const permission = role.permissions[module.module_key] || {};
                          return (
                            <div className="permissions-row" key={`${role.id}-${module.id}`}>
                              <strong>{role.name}</strong>
                              <span>{getModuleLabel(module)}</span>
                              <label className="permission-check">
                                <input
                                  checked={Boolean(permission.canRead)}
                                  disabled={!authorizationAccess.write || authorizationLoading}
                                  type="checkbox"
                                  onChange={(event) => updatePermission(role, module, "can_read", event.target.checked)}
                                />
                                <span>{labels.readPermission}</span>
                              </label>
                              <label className="permission-check">
                                <input
                                  checked={Boolean(permission.canWrite)}
                                  disabled={!authorizationAccess.write || authorizationLoading}
                                  type="checkbox"
                                  onChange={(event) => updatePermission(role, module, "can_write", event.target.checked)}
                                />
                                <span>{labels.writePermission}</span>
                              </label>
                            </div>
                          );
                        }),
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {authorizationStatus && <p className="status-message">{authorizationStatus}</p>}
        </section>,
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-label="Atera authentication">
        <header className="brand-bar">
          <div className="brand-mark">
            <img src={logoUrl} alt="Atera logo" />
            <div>
              <strong>Atera</strong>
              <span>{copy("Commodity Workspace", "Emtia Çalışma Alanı")}</span>
            </div>
          </div>

          <div className="auth-controls">
            <label className="language-picker">
              <span>{labels.language}</span>
              <select value={form.language} onChange={(event) => updateField("language", event.target.value)}>
                <option value="en">EN</option>
                <option value="tr">TR</option>
              </select>
            </label>
            <ThemeToggle />
          </div>
        </header>

        <div className="avatar-zone">
          <div className="avatar">
            {profilePreview ? <img src={profilePreview} alt={copy("Profile preview", "Profil önizlemesi")} /> : <span>{initials}</span>}
          </div>
        </div>

        {session ? (
          <div className="signed-in">
            <p>{labels.signedIn}</p>
            <button type="button" onClick={handleLogout}>
              {labels.logout}
            </button>
          </div>
        ) : mode === "reset" ? (
          <form className="auth-form" onSubmit={handleResetPassword}>
            <label>
              <span>{labels.resetPassword}</span>
              <div className="password-field">
                <input
                  autoComplete="new-password"
                  required
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => updateField("password", event.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? labels.hidePassword : labels.showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? labels.hide : labels.show}
                </button>
              </div>
            </label>
            <label>
              <span>{labels.confirmPassword}</span>
              <div className="password-field">
                <input
                  autoComplete="new-password"
                  required
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showConfirmPassword ? labels.hidePassword : labels.showPassword}
                  onClick={() => setShowConfirmPassword((current) => !current)}
                >
                  {showConfirmPassword ? labels.hide : labels.show}
                </button>
              </div>
            </label>
            <button className="submit-button" disabled={loading} type="submit">
              {loading ? "..." : labels.resetPassword}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              <span>{labels.loginEmail}</span>
              <input
                autoComplete="email"
                required
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </label>

            <label>
              <span>{labels.password}</span>
              <div className="password-field">
                <input
                  autoComplete="current-password"
                  required
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => updateField("password", event.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? labels.hidePassword : labels.showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? labels.hide : labels.show}
                </button>
              </div>
            </label>

            <div className="form-options">
              <span>{labels.adminProvisionedAccess}</span>
              <button type="button" className="link-button" onClick={handleForgotPassword}>
                {labels.forgot}
              </button>
            </div>

            <button className="submit-button" disabled={loading} type="submit">
              {loading ? "..." : labels.submitLogin}
            </button>
          </form>
        )}

        {status && <p className="status-message">{status}</p>}
      </section>
    </main>
  );
}

export default App;
