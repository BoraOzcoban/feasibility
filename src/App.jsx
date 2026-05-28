import React, { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import { defaultFinancialSettings, emptyFinancialExtraCostForm, emptyFinancialModel, loadFinancialModel, saveFinancialExtraCost, saveFinancialModelSettings } from "./lib/financialService";
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

function getSalesForecastForMonth(salesStrategy, monthIndex) {
  const company = salesStrategy.company || {};
  const monthlyForecast = Array.isArray(company.monthlyForecast) ? company.monthlyForecast : [];
  const baseUnits = toFiniteNumber(monthlyForecast[monthIndex % Math.max(monthlyForecast.length, 1)], toFiniteNumber(company.monthlyTarget));
  const annualGrowth = toFiniteNumber(company.annualSalesGrowthPercent) / 100;
  const yearIndex = Math.floor(monthIndex / Math.max(monthlyForecast.length, 1));

  return Math.max(0, baseUnits * ((1 + annualGrowth) ** yearIndex));
}

function calculateChannelMonth(grossSoldUnits, salesStrategy) {
  const company = salesStrategy.company || {};
  const channels = Array.isArray(salesStrategy.channels) && salesStrategy.channels.length
    ? salesStrategy.channels
    : [{ price: company.baseSalesPrice, revenueShare: 100 }];
  const totalShare = channels.reduce((total, channel) => total + Math.max(0, toFiniteNumber(channel.revenueShare)), 0) || channels.length;

  return channels.reduce((totals, channel) => {
    const share = totalShare
      ? (Math.max(0, toFiniteNumber(channel.revenueShare, 100 / channels.length)) / totalShare)
      : (1 / channels.length);
    const channelUnits = grossSoldUnits * share;
    const price = Math.max(0, toFiniteNumber(channel.price, company.baseSalesPrice));
    const discountRate = Math.max(0, toFiniteNumber(channel.discountPercent)) / 100;
    const marginRate = Math.max(0, toFiniteNumber(channel.marginPercent)) / 100;
    const returnRate = Math.max(0, toFiniteNumber(channel.returnRatePercent)) / 100;
    const returnedUnits = channelUnits * returnRate;
    const netUnits = Math.max(0, channelUnits - returnedUnits);
    const discountedPrice = price * (1 - discountRate);
    const producerPrice = discountedPrice * (1 - marginRate);
    const revenue = netUnits * producerPrice;
    const delayMonths = Math.max(0, Math.ceil(toFiniteNumber(channel.paymentDelayDays) / 30));

    totals.channels.push({
      delayMonths,
      marginCost: channelUnits * discountedPrice * marginRate,
      revenue,
      returnedUnits,
      units: channelUnits,
    });
    totals.discountCost += channelUnits * price * discountRate;
    totals.marginCost += channelUnits * discountedPrice * marginRate;
    totals.netSoldUnits += netUnits;
    totals.returnedUnits += returnedUnits;
    totals.revenue += revenue;
    totals.weightedPaymentDelayDays += share * toFiniteNumber(channel.paymentDelayDays);

    return totals;
  }, {
    channels: [],
    discountCost: 0,
    marginCost: 0,
    netSoldUnits: 0,
    returnedUnits: 0,
    revenue: 0,
    weightedPaymentDelayDays: 0,
  });
}

function buildFinancialFeasibilityModel(baseModel, salesStrategy, settingsInput, operationsWorkspace, horizon) {
  const settings = {
    ...defaultFinancialSettings,
    ...(baseModel.settings || {}),
    ...(settingsInput || {}),
  };
  const monthCount = getProjectionMonthCount(horizon);
  const activePlans = operationsWorkspace.activePlans?.length
    ? operationsWorkspace.activePlans
    : (operationsWorkspace.latestPlan ? [operationsWorkspace.latestPlan] : []);
  const electricityPrice = Math.max(0, toFiniteNumber(settings.electricityPricePerKwh));
  const workingDaysPerMonth = Math.max(1, toFiniteNumber(settings.workingDaysPerMonth, 22));
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
  const unitMaterialCost = dailyProduced ? dailyMaterialCost / dailyProduced : 0;
  const unitWorkforceCost = dailyProduced ? dailyWorkforceCost / dailyProduced : 0;
  const unitElectricityCost = dailyProduced ? dailyElectricityCost / dailyProduced : 0;
  const unitProductionCost = unitMaterialCost + unitWorkforceCost + unitElectricityCost;
  const extraCosts = baseModel.extraCosts || [];
  const extraInitialCost = extraCosts.reduce((total, cost) => total + (cost.costType === "initial" ? Math.max(0, toFiniteNumber(cost.amount)) : 0), 0);
  const extraRecurringCost = extraCosts.reduce((total, cost) => total + (cost.costType === "recurring" ? Math.max(0, toFiniteNumber(cost.amount)) : 0), 0);
  const monthlyMaterialCost = dailyMaterialCost * workingDaysPerMonth;
  const monthlyWorkforceCost = dailyWorkforceCost * workingDaysPerMonth;
  const workingCapitalRequirement =
    (monthlyMaterialCost * Math.max(0, toFiniteNumber(settings.rawMaterialBufferMonths, 1))) +
    (monthlyWorkforceCost * Math.max(0, toFiniteNumber(settings.salaryBufferMonths, 1))) +
    (extraRecurringCost * Math.max(0, toFiniteNumber(settings.rentBufferMonths, 1)));
  const loanAmount = Math.max(0, toFiniteNumber(settings.loanAmount));
  const loanTermMonths = Math.max(1, Math.round(toFiniteNumber(settings.loanTermMonths, 24)));
  const annualInterestRate = Math.max(0, toFiniteNumber(settings.annualInterestRate));
  const monthlyLoanPayment = getMonthlyLoanPayment(loanAmount, annualInterestRate, loanTermMonths);
  const monthlyLoanRate = annualInterestRate / 100 / 12;
  const vatRate = Math.max(0, toFiniteNumber(settings.vatRate, 20)) / 100;
  const incomeTaxRate = Math.max(0, toFiniteNumber(settings.incomeTaxRate, 20)) / 100;
  const initialCash = Math.max(0, toFiniteNumber(settings.initialCash));
  const initialInvestment = machinePurchaseCost + extraInitialCost;
  const requiredOwnCash = Math.max(0, initialInvestment + workingCapitalRequirement - loanAmount);
  const cashReceipts = Array.from({ length: monthCount + 24 }, () => 0);
  const rows = [];
  let loanBalance = loanAmount;
  let cashBalance = initialCash + loanAmount - initialInvestment - workingCapitalRequirement;
  let cumulativePayback = -initialInvestment - workingCapitalRequirement + loanAmount;
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
    const producedUnits = dailyProduced * workingDaysPerMonth;
    const forecastUnits = getSalesForecastForMonth(salesStrategy, index);
    const grossSoldUnits = Math.min(forecastUnits, producedUnits);
    const channelMonth = calculateChannelMonth(grossSoldUnits, salesStrategy);
    const unsoldUnits = Math.max(0, producedUnits - grossSoldUnits);
    const spoilageRate = Math.max(0, toFiniteNumber(salesStrategy.company?.spoilageRate)) / 100;
    const expiredUnits = unsoldUnits * spoilageRate;
    const writeOffUnits = expiredUnits + channelMonth.returnedUnits;
    const writeOffCost = writeOffUnits * unitProductionCost;
    const cogsSold = channelMonth.netSoldUnits * unitProductionCost;
    const cashProductionCost = producedUnits * unitProductionCost;
    const materialCost = producedUnits * unitMaterialCost;
    const workforceCost = producedUnits * unitWorkforceCost;
    const electricityCost = producedUnits * unitElectricityCost;
    const loanPayment = index < loanTermMonths ? Math.min(monthlyLoanPayment, loanBalance + (loanBalance * monthlyLoanRate)) : 0;
    const loanInterest = index < loanTermMonths ? loanBalance * monthlyLoanRate : 0;
    const loanPrincipal = Math.max(0, loanPayment - loanInterest);

    loanBalance = Math.max(0, loanBalance - loanPrincipal);

    channelMonth.channels.forEach((channel) => {
      const receiptIndex = index + channel.delayMonths;
      if (receiptIndex < cashReceipts.length) {
        cashReceipts[receiptIndex] += channel.revenue;
      }
    });

    const cashIn = cashReceipts[index] || 0;
    const outputVat = channelMonth.revenue * vatRate;
    const inputVat = Math.max(0, (materialCost + electricityCost + extraRecurringCost) * vatRate);
    const vatPayable = Math.max(0, outputVat - inputVat);
    const profitBeforeTax = channelMonth.revenue - cogsSold - writeOffCost - extraRecurringCost - loanInterest;
    const incomeTax = Math.max(0, profitBeforeTax * incomeTaxRate);
    const netIncome = profitBeforeTax - incomeTax;
    const cashFlow = cashIn - cashProductionCost - extraRecurringCost - loanPayment - vatPayable - incomeTax;
    const totalCost = cogsSold + writeOffCost + extraRecurringCost + loanInterest + incomeTax;

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
  const averageNetPrice = totals.netSoldUnits ? totals.revenue / totals.netSoldUnits : toFiniteNumber(salesStrategy.company?.baseSalesPrice);
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
    ],
    extraCosts,
    incomeRows: [
      { amount: totals.revenue, id: "salesRevenue", kind: "income", label: "Sales revenue from monthly forecast" },
      { amount: totals.materialCost, costType: "recurring", id: "materialCost", kind: "cost", label: "Raw materials and packaging" },
      { amount: totals.workforceCost, costType: "recurring", id: "workforceCost", kind: "cost", label: "Salaries and labor" },
      { amount: totals.electricityCost, costType: "recurring", id: "electricityCost", kind: "cost", label: "Electricity" },
      { amount: totals.expiredWriteOffCost, costType: "recurring", id: "writeOffCost", kind: "cost", label: "Spoilage, returns and expired write-off" },
      { amount: machinePurchaseCost, costType: "initial", id: "machinePurchase", kind: "cost", label: "Machine investment" },
      { amount: extraInitialCost, costType: "initial", id: "extraInitialCost", kind: "cost", label: "Initial extra costs" },
      { amount: workingCapitalRequirement, costType: "initial", id: "workingCapital", kind: "cost", label: "Working capital requirement" },
      { amount: totals.vatPayable, costType: "recurring", id: "vatPayable", kind: "cost", label: "VAT payable" },
      { amount: totals.incomeTax, costType: "recurring", id: "incomeTax", kind: "cost", label: "Income tax" },
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
      expiredWriteOffCost: totals.expiredWriteOffCost,
      expiredWriteOffUnits: totals.expiredWriteOffUnits,
      extraInitialCost,
      extraRecurringCost: extraRecurringCost * monthCount,
      forecastSalesUnits: totals.forecastSalesUnits,
      incomeTax: totals.incomeTax,
      initialCash,
      initialCashRequired: requiredOwnCash,
      loanAmount,
      loanPayment: monthlyLoanPayment,
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
      weightedPaymentDelayDays: calculateChannelMonth(1, salesStrategy).weightedPaymentDelayDays,
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
    signup: "Create user",
    createUserLink: "Create a new user",
    backToLogin: "Back to login",
    who: "Who are we?",
    solutions: "Our solutions",
    references: "Our references",
    contact: "Contact",
    heroTitle: "Atera",
    heroCopy: "The operating logic behind tailor-made production planning.",
    goToLogin: "Go to log in",
    whoCopy: "Plan. Test. Decide. Scale. Atera brings production teams, finance, and operations into one practical hub where feasibility, cost, stock, and delivery scenarios can move from scattered assumptions to clear decisions.",
    solutionsCopy: "Scenario planning, production visibility, material tracking, cost analysis, and workflow tools will move here step by step as the migration from atera_v2 continues.",
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
    submitSignup: "Create account",
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
    signupSuccess: "Account created. Check email confirmation if your Supabase project requires it.",
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
    signup: "Kullanıcı oluştur",
    createUserLink: "Yeni kullanıcı oluştur",
    backToLogin: "Girişe dön",
    who: "Biz kimiz?",
    solutions: "Çözümlerimiz",
    references: "Referanslarımız",
    contact: "İletişim",
    heroTitle: "Atera",
    heroCopy: "Tailor-made üretim planlamasının arkasındaki operasyon mantığı.",
    goToLogin: "Girişe git",
    whoCopy: "Planla. Dene. Karar ver. Büyüt. Atera; üretim, finans ve operasyon ekiplerini fizibilite, maliyet, stok ve termin senaryolarını dağınık varsayımlardan net kararlara taşıyan pratik bir hub'da buluşturur.",
    solutionsCopy: "Senaryo planlama, üretim görünürlüğü, malzeme takibi, maliyet analizi ve iş akışı araçları atera_v2'den parça parça buraya taşınacak.",
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
    submitSignup: "Hesap oluştur",
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
    signupSuccess: "Hesap oluşturuldu. Supabase projeniz gerektiriyorsa e-posta onayını kontrol edin.",
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
  const [profileFile, setProfileFile] = useState(null);
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
  const [financeWindow, setFinanceWindow] = useState("today");
  const [financeDateRange, setFinanceDateRange] = useState({ start: "", end: "" });
  const [operationForms, setOperationForms] = useState(emptyOperationForms);
  const [operationPlan, setOperationPlan] = useState(emptyOperationPlan);
  const [operationPlanResult, setOperationPlanResult] = useState(null);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [operationsStatus, setOperationsStatus] = useState("");
  const [semiFinishedForm, setSemiFinishedForm] = useState({
    componentRows: [],
    name: "",
    pricePerUnit: 0,
    unit: "adet",
  });
  const [semiFinishedItems, setSemiFinishedItems] = useState([]);
  const [serviceForm, setServiceForm] = useState({
    initialCost: 0,
    monthlyCost: 0,
    name: "",
    price: 0,
  });
  const [serviceItems, setServiceItems] = useState([]);
  const [salesStrategy, setSalesStrategy] = useState(emptySalesStrategy);
  const [salesStatus, setSalesStatus] = useState("");
  const [salesLoading, setSalesLoading] = useState(false);
  const [simulationVariants, setSimulationVariants] = useState([emptySimulationVariant]);
  const [simulationStatus, setSimulationStatus] = useState("");
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [operationsWorkspace, setOperationsWorkspace] = useState({
    activePlans: [],
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
      const monthlyForecast = Array.isArray(current.company.monthlyForecast)
        ? [...current.company.monthlyForecast]
        : Array.from({ length: 12 }, () => 0);

      monthlyForecast[index] = value;

      return {
        ...current,
        company: {
          ...current.company,
          monthlyForecast,
          monthlyTarget: monthlyForecast.reduce((total, item) => total + toFiniteNumber(item), 0) / Math.max(monthlyForecast.length, 1),
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

  function addSalesItem(collection) {
    const nextId = `${collection}-${Date.now()}`;
    const templates = {
      campaigns: {
        budget: 0,
        channel: copy("New channel", "Yeni kanal"),
        durationWeeks: 4,
        goal: copy("Campaign objective", "Kampanya hedefi"),
        id: nextId,
        name: copy("New campaign", "Yeni kampanya"),
        successScore: 50,
        type: copy("Campaign type", "Kampanya tipi"),
      },
      channels: {
        budget: 0,
        conversionRate: 0,
        discountPercent: 0,
        id: nextId,
        marginPercent: 0,
        name: copy("New channel", "Yeni kanal"),
        note: copy("Channel notes", "Kanal notları"),
        paymentDelayDays: 30,
        price: salesStrategy.company.baseSalesPrice,
        revenueShare: 0,
        returnRatePercent: 0,
        successScore: 50,
        type: copy("Channel type", "Kanal tipi"),
      },
      competitors: {
        campaignType: copy("Manual campaign input", "Manuel kampanya girdisi"),
        id: nextId,
        marketShare: 0,
        marketingBudget: 0,
        name: copy("New competitor", "Yeni rakip"),
        reputationScore: 50,
        salesPrice: 0,
        strategy: copy("Competitor strategy notes", "Rakip strateji notları"),
        threatScore: 50,
      },
      personnel: {
        assignedChannel: copy("Assigned channel", "Atanan kanal"),
        id: nextId,
        monthlyTarget: 0,
        name: copy("New sales person", "Yeni satış personeli"),
        pipelineValue: 0,
        role: copy("Sales role", "Satış rolü"),
        successScore: 50,
        winRate: 0,
      },
    };

    setSalesStrategy((current) => ({
      ...current,
      [collection]: [...current[collection], templates[collection]],
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
        fixedCost: Math.round(toFiniteNumber(linkedSummary.extraRecurringCost)),
        grossMargin: linkedSummary.salesRevenue ? Math.max(0, Math.round((toFiniteNumber(linkedSummary.netIncome) / toFiniteNumber(linkedSummary.salesRevenue)) * 100)) : 0,
        marketShare: toFiniteNumber(salesStrategy.company?.marketShare),
        reputationScore: toFiniteNumber(salesStrategy.company?.reputationScore),
        timeHorizonMonths: getProjectionMonthCount(financialHorizon),
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
      setOperationsWorkspace(workspace);

      if (workspace.latestPlan) {
        const savedMachineRows = Array.isArray(workspace.latestPlan.input?.machineRows) ? workspace.latestPlan.input.machineRows : [];
        const savedMaterialRows = Array.isArray(workspace.latestPlan.input?.materialRows) ? workspace.latestPlan.input.materialRows : [];
        const savedWorkforceRows = Array.isArray(workspace.latestPlan.input?.workforceRows) ? workspace.latestPlan.input.workforceRows : [];
        const hasSimplePlanResult = workspace.latestPlan.result?.energyConsumptionKwh !== undefined;

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
        setOperationPlanResult(hasSimplePlanResult ? workspace.latestPlan.result : null);
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
      await saveOperationRecord(supabase, entity, {
        ...operationForms[entity],
        productId: operationPlan.productId || operationsWorkspace.product?.id,
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
      setFinancialModel(nextModel);
      setFinancialSettingsForm({
        ...defaultFinancialSettings,
        ...(nextModel.settings || {}),
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
        .select("id, username, email, phone_number, company_id, department, access_level, language, theme, profile_picture_url, company:companies(name)")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;

      setCurrentProfile(profile);
      if (profile?.profile_picture_url) setProfilePreview(profile.profile_picture_url);
      if (profile?.language && ["en", "tr"].includes(profile.language)) {
        setForm((current) => ({ ...current, language: profile.language }));
      }
      if (profile?.theme && ["light", "dark"].includes(profile.theme)) {
        setTheme(profile.theme);
      }

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

      setManagedUserForm({ ...emptyManagedUserForm, language: form.language });
      await loadAuthorizationData();
      setAuthorizationStatus(labels.userCreated);
    } catch (error) {
      setAuthorizationStatus(error.message);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  function onProfileFileChange(event) {
    const file = event.target.files?.[0];
    setProfileFile(file || null);
    setProfilePreview(file ? URL.createObjectURL(file) : "");
  }

  async function uploadProfilePicture(userId) {
    if (!profileFile) return null;

    const extension = profileFile.name.split(".").pop() || "jpg";
    const path = `${userId}/profile.${extension}`;

    const { error } = await supabase.storage
      .from("profile-pictures")
      .upload(path, profileFile, { upsert: true });

    if (error) throw error;

    const { data } = supabase.storage.from("profile-pictures").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSignup(event) {
    event.preventDefault();
    setStatus("");

    if (!supabase) {
      setStatus(labels.configure);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            username: form.username,
            phone_number: form.phoneNumber,
            company: form.company,
            department: form.department,
            access_level: form.accessLevel,
            language: form.language,
            theme,
          },
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error(labels.missingUser);

      if (data.session) {
        const profilePictureUrl = await uploadProfilePicture(data.user.id);

        const { error: profileError } = await supabase.from("profiles").update({
          profile_picture_url: profilePictureUrl,
        }).eq("id", data.user.id);

        if (profileError) throw profileError;
      }

      setStatus(labels.signupSuccess);
      goTo("/login", "login");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
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
      const { data: email, error: profileError } = await supabase.rpc("get_login_email", {
        p_username: form.username,
      });

      if (profileError || !email) throw new Error(labels.usernameNotFound);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: form.password,
      });

      if (error) throw error;

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("profile_picture_url, language, theme")
        .single();

      if (userProfile?.profile_picture_url) setProfilePreview(userProfile.profile_picture_url);
      if (userProfile?.language && ["en", "tr"].includes(userProfile.language)) {
        setForm((current) => ({ ...current, language: userProfile.language }));
      }
      if (userProfile?.theme && ["light", "dark"].includes(userProfile.theme)) {
        setTheme(userProfile.theme);
      }
      goTo("/dashboard", "login");
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
            {[
              ["productName", copy("New product name", "Yeni ürün adı"), "", "text"],
            ].map(([field, label, suffix, type = "number"]) => (
              <label key={field}>
                <span>{label}</span>
                <div>
                  <input
                    min="0"
                    step="1"
                    type={type}
                    value={operationPlan[field] ?? ""}
                    onChange={(event) => updateOperationPlan(field, event.target.value)}
                  />
                  {suffix && <small>{suffix}</small>}
                </div>
              </label>
            ))}
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
                <span>{copy("Cycle Time", "Çevrim Süresi")} <strong>{formatNumber(result.cycleTimeMinutes, 2)} {copy("min", "dk")}</strong></span>
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

  function updateSemiFinishedForm(field, value) {
    setSemiFinishedForm((current) => ({ ...current, [field]: value }));
  }

  function addSemiFinishedComponentRow() {
    const firstMaterial = operationsWorkspace.materials[0];

    setSemiFinishedForm((current) => ({
      ...current,
      componentRows: [
        ...(current.componentRows || []),
        {
          componentId: firstMaterial?.id || "",
          componentType: "material",
          quantityPerUnit: 0,
        },
      ],
    }));
  }

  function updateSemiFinishedComponentRow(index, field, value) {
    setSemiFinishedForm((current) => ({
      ...current,
      componentRows: (current.componentRows || []).map((row, rowIndex) => (
        rowIndex === index ? { ...row, [field]: value } : row
      )),
    }));
  }

  function removeSemiFinishedComponentRow(index) {
    setSemiFinishedForm((current) => ({
      ...current,
      componentRows: (current.componentRows || []).filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function handleSaveSemiFinished(event) {
    event.preventDefault();

    if (!semiFinishedForm.name.trim()) {
      setOperationsStatus(copy("Enter a semi-finished item name first.", "Önce yarı mamül adı girin."));
      return;
    }

    setSemiFinishedItems((current) => [
      ...current,
      {
        ...semiFinishedForm,
        id: `semi-${Date.now()}`,
        componentRows: [...(semiFinishedForm.componentRows || [])],
      },
    ]);
    setSemiFinishedForm({
      componentRows: [],
      name: "",
      pricePerUnit: 0,
      unit: "adet",
    });
    setOperationsStatus(copy("Semi-finished item was added locally.", "Yarı mamül yerel olarak eklendi."));
  }

  function updateServiceForm(field, value) {
    setServiceForm((current) => ({ ...current, [field]: value }));
  }

  function handleSaveService(event) {
    event.preventDefault();

    if (!serviceForm.name.trim()) {
      setOperationsStatus(copy("Enter a service name first.", "Önce hizmet adı girin."));
      return;
    }

    setServiceItems((current) => [
      ...current,
      {
        ...serviceForm,
        id: `service-${Date.now()}`,
      },
    ]);
    setServiceForm({
      initialCost: 0,
      monthlyCost: 0,
      name: "",
      price: 0,
    });
    setOperationsStatus(copy("Service was added locally.", "Hizmet yerel olarak eklendi."));
  }

  function renderResourcesPage() {
    const unitOptions = ["kg", "gr", "mg", "adet", "metre", "litre", "ml"];
    const semiComponentOptions = [
      ...operationsWorkspace.materials.map((material) => ({
        id: material.id,
        label: material.name,
        type: "material",
        unit: material.unit,
      })),
      ...semiFinishedItems.map((item) => ({
        id: item.id,
        label: item.name,
        type: "semi",
        unit: item.unit,
      })),
    ];

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

            <form className="operation-card resource-definition-card semi-finished-card" onSubmit={handleSaveSemiFinished}>
              <div className="operation-card-heading">
                <div>
                  <span>{copy("Add semi-finished item", "Yarı mamül ekle")}</span>
                  <h2>{copy("Semi-finished", "Yarı Mamül")}</h2>
                </div>
                <button type="button" onClick={addSemiFinishedComponentRow}>{copy("Add component", "Bileşen ekle")}</button>
              </div>
              <div className="operation-data-fields">
                <label>
                  <span>{copy("Name", "Ad")}</span>
                  <input type="text" value={semiFinishedForm.name} onChange={(event) => updateSemiFinishedForm("name", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Unit", "Birim")}</span>
                  <select value={semiFinishedForm.unit} onChange={(event) => updateSemiFinishedForm("unit", event.target.value)}>
                    {unitOptions.map((unit) => <option value={unit} key={unit}>{unit}</option>)}
                  </select>
                </label>
                <label>
                  <span>{copy("Unit price", "Birim fiyat")}</span>
                  <input min="0" step="0.01" type="number" value={semiFinishedForm.pricePerUnit} onChange={(event) => updateSemiFinishedForm("pricePerUnit", event.target.value)} />
                </label>
              </div>

              <div className="resource-section">
                <div className="resource-section-header">
                  <div>
                    <span>{copy("Inputs per semi-finished unit", "Yarı mamül birimi için girdiler")}</span>
                    <p>{copy("Select materials or other semi-finished items and define the amount needed for one unit.", "Bir birim için gereken malzeme veya diğer yarı mamülleri ve miktarlarını tanımlayın.")}</p>
                  </div>
                </div>
                <div className="resource-row-list">
                  {(semiFinishedForm.componentRows || []).length ? semiFinishedForm.componentRows.map((row, index) => {
                    const availableOptions = semiComponentOptions.filter((option) => option.type === row.componentType);
                    const selectedOption = availableOptions.find((option) => option.id === row.componentId);

                    return (
                      <div className="resource-row-grid material-plan-row" key={`semi-component-${index}`}>
                        <label>
                          <span>{copy("Type", "Tip")}</span>
                          <select
                            value={row.componentType}
                            onChange={(event) => {
                              const nextType = event.target.value;
                              const nextOptions = semiComponentOptions.filter((option) => option.type === nextType);
                              updateSemiFinishedComponentRow(index, "componentType", nextType);
                              updateSemiFinishedComponentRow(index, "componentId", nextOptions[0]?.id || "");
                            }}
                          >
                            <option value="material">{copy("Material", "Malzeme")}</option>
                            <option value="semi">{copy("Semi-finished", "Yarı Mamül")}</option>
                          </select>
                        </label>
                        <label>
                          <span>{copy("Item", "Kalem")}</span>
                          <select value={row.componentId || ""} onChange={(event) => updateSemiFinishedComponentRow(index, "componentId", event.target.value)}>
                            <option value="">{copy("Select item", "Kalem seç")}</option>
                            {availableOptions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
                          </select>
                        </label>
                        <label>
                          <span>{copy("Amount", "Miktar")}</span>
                          <input min="0" step="0.0001" type="number" value={row.quantityPerUnit ?? ""} onChange={(event) => updateSemiFinishedComponentRow(index, "quantityPerUnit", event.target.value)} />
                        </label>
                        <div className="resource-row-meta">
                          <strong>{selectedOption?.unit || "-"}</strong>
                          <small>{copy("per unit", "birim başına")}</small>
                        </div>
                        <button type="button" className="resource-remove-button" onClick={() => removeSemiFinishedComponentRow(index)}>
                          {copy("Delete", "Sil")}
                        </button>
                      </div>
                    );
                  }) : (
                    <p className="planner-empty-state">{copy("No input rows yet. Add a component to define the semi-finished recipe.", "Henüz girdi satırı yok. Yarı mamül reçetesini tanımlamak için bileşen ekleyin.")}</p>
                  )}
                </div>
              </div>

              <button className="submit-button planner-save-button" type="submit">{copy("Add Semi-finished", "Yarı Mamül Ekle")}</button>
            </form>

            <article className="operation-card resource-definition-card resource-list-card">
              <div className="operation-card-heading">
                <h2>{copy("Semi-finished records", "Yarı Mamül kayıtları")}</h2>
                <span>{semiFinishedItems.length} {copy("records", "kayıt")}</span>
              </div>
              <div className="compact-resource-list">
                {(semiFinishedItems.length ? semiFinishedItems : [{ id: "empty" }]).map((item) => (
                  <span key={item.id}>
                    <strong>{item.id === "empty" ? "-" : item.name}</strong>
                    <small>{item.id === "empty" ? "-" : `${formatLira(item.pricePerUnit, 2)} / ${item.unit} • ${(item.componentRows || []).length} ${copy("inputs", "girdi")}`}</small>
                  </span>
                ))}
              </div>
            </article>

            <form className="operation-card resource-definition-card service-card" onSubmit={handleSaveService}>
              <div className="operation-card-heading">
                <div>
                  <span>{copy("Add service", "Hizmet ekle")}</span>
                  <h2>{copy("Service", "Hizmet")}</h2>
                </div>
              </div>
              <div className="operation-data-fields">
                <label>
                  <span>{copy("Name", "Ad")}</span>
                  <input type="text" value={serviceForm.name} onChange={(event) => updateServiceForm("name", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Price", "Fiyat")}</span>
                  <input min="0" step="0.01" type="number" value={serviceForm.price} onChange={(event) => updateServiceForm("price", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Initial cost", "Başlangıç maliyeti")}</span>
                  <input min="0" step="0.01" type="number" value={serviceForm.initialCost} onChange={(event) => updateServiceForm("initialCost", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Monthly cost", "Aylık maliyet")}</span>
                  <input min="0" step="0.01" type="number" value={serviceForm.monthlyCost} onChange={(event) => updateServiceForm("monthlyCost", event.target.value)} />
                </label>
              </div>
              <button className="submit-button planner-save-button" type="submit">{copy("Add Service", "Hizmet Ekle")}</button>
            </form>

            <article className="operation-card resource-definition-card resource-list-card">
              <div className="operation-card-heading">
                <h2>{copy("Services", "Hizmetler")}</h2>
                <span>{serviceItems.length} {copy("records", "kayıt")}</span>
              </div>
              <div className="compact-resource-list">
                {(serviceItems.length ? serviceItems : [{ id: "empty" }]).map((service) => (
                  <span key={service.id}>
                    <strong>{service.id === "empty" ? "-" : service.name}</strong>
                    <small>{service.id === "empty" ? "-" : `${formatLira(service.price, 2)} • ${copy("Initial", "Başlangıç")}: ${formatLira(service.initialCost, 2)} • ${copy("Monthly", "Aylık")}: ${formatLira(service.monthlyCost, 2)}`}</small>
                  </span>
                ))}
              </div>
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
                  <input
                    min="0.0001"
                    step="0.01"
                    type="number"
                    value={operationForms.product.cycleTimeMinutes}
                    onChange={(event) => updateOperationForm("product", "cycleTimeMinutes", event.target.value)}
                  />
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
                          cycleTimeMinutes: product.cycle_time_minutes || 1,
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
                    <span>{product.id === "empty" ? "-" : `${formatNumber(product.cycle_time_minutes || 1, 2)} ${copy("min", "dk")}`}</span>
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
    const activePlans = operationsWorkspace.activePlans || [];

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
                    <span>{copy("Cycle", "Çevrim")} <strong>{formatNumber(result.cycleTimeMinutes, 2)} {copy("min", "dk")}</strong></span>
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
    const investmentTotal = (summary.machinePurchaseCost || 0) + (summary.extraInitialCost || 0) + (summary.workingCapitalRequirement || 0);
    const returnOnInvestment = investmentTotal ? `${formatNumber(((summary.netIncome || 0) / investmentTotal) * 100, 1)}%` : "-";
    const formatMonth = (month) => (month ? `${month}. ${copy("month", "ay")}` : "-");
    const financialRowLabels = {
      electricityCost: copy("Electricity", "Elektrik"),
      extraInitialCost: copy("Initial extra costs", "Başlangıç ek giderleri"),
      incomeTax: copy("Income tax", "Gelir vergisi"),
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
    const visibleIncomeRows = (model.incomeRows || []).filter((row) => {
      if (currentFinancialPage.key === "product-cost") return row.kind !== "income" && row.costType !== "initial";
      if (currentFinancialPage.key === "investment-cost") return row.costType === "initial" || row.id === "workingCapital";
      if (currentFinancialPage.key === "product-return") return row.costType !== "initial";
      return true;
    });

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

          {isCostPage && (
            <div className="financial-controls finance-input-panel">
              <form className="financial-assumption-form" onSubmit={handleSaveFinancialSettings}>
                {[
                  ["electricityPricePerKwh", copy("Electricity kWh price", "Elektrik kWh fiyatı"), "0.0001"],
                  ["workingDaysPerMonth", copy("Working days / month", "Aylık çalışma günü"), "1"],
                  ["initialCash", copy("Initial cash", "Başlangıç nakdi"), "1000"],
                  ["loanAmount", copy("Loan amount", "Kredi tutarı"), "1000"],
                  ["annualInterestRate", copy("Annual interest %", "Yıllık faiz %"), "0.01"],
                  ["loanTermMonths", copy("Loan term months", "Kredi vadesi ay"), "1"],
                  ["vatRate", copy("VAT %", "KDV %"), "0.01"],
                  ["incomeTaxRate", copy("Income tax %", "Gelir vergisi %"), "0.01"],
                  ["rawMaterialBufferMonths", copy("Material buffer months", "Malzeme tampon ay"), "0.1"],
                  ["salaryBufferMonths", copy("Salary buffer months", "Maaş tampon ay"), "0.1"],
                  ["rentBufferMonths", copy("Rent buffer months", "Kira tampon ay"), "0.1"],
                ].map(([field, label, step]) => (
                  <label key={field}>
                    <span>{label}</span>
                    <input
                      min="0"
                      step={step}
                      type="number"
                      value={financialSettingsForm[field] ?? ""}
                      onChange={(event) => setFinancialSettingsForm((current) => ({ ...current, [field]: event.target.value }))}
                    />
                  </label>
                ))}
                <button type="submit" disabled={financialLoading}>{copy("Save Assumptions", "Varsayımları Kaydet")}</button>
              </form>

              <form onSubmit={handleSaveFinancialExtraCost}>
                <label>
                  <span>{copy("Extra cost name", "Ek gider adı")}</span>
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
                <button type="submit" disabled={financialLoading}>{copy("Add Extra Cost", "Ek Gider Ekle")}</button>
              </form>
            </div>
          )}

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
              [copy("Unsold Inventory", "Satılmayan Stok"), formatNumber(summary.unsoldInventoryUnits), copy("production above sales forecast", "satış tahminini aşan üretim")],
              [copy("Write-off Value", "Fire / İade Değeri"), formatLira(summary.expiredWriteOffCost), copy("spoilage, returns and expired products", "bozulma, iade ve SKT ürünler")],
              [copy("Cash Runway", "Nakit Dayanma"), `${formatNumber(summary.cashRunwayMonths)} ${copy("months", "ay")}`, copy("with entered initial cash", "girilen başlangıç nakdiyle")],
              [copy("Break-even", "Başa Baş"), formatMonth(summary.breakEvenMonth), copy("first profitable operating month", "ilk kârlı operasyon ayı")],
              [copy("Payback", "Geri Dönüş"), formatMonth(summary.paybackMonth), copy("investment plus working capital", "yatırım ve işletme sermayesi")],
              [copy("Initial Cash Needed", "Gerekli Başlangıç Nakdi"), formatLira(summary.initialCashRequired), copy("own cash after loan", "kredi sonrası öz nakit")],
              [copy("Monthly Loan Payment", "Aylık Kredi Ödemesi"), formatLira(summary.loanPayment), copy("principal and interest", "anapara ve faiz")],
              [copy("Required Monthly Sales", "Gerekli Aylık Satış"), formatNumber(summary.requiredMonthlySalesVolume), copy("break-even volume estimate", "başa baş hacim tahmini")],
              [copy("Retailer Margin", "Kanal Marjı"), formatLira(summary.retailerMarginCost), copy("retailer/distributor deductions", "perakende/distribütör kesintileri")],
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
    const parameters = variant.parameters;
    const numberParam = (field) => Number(parameters[field]) || 0;
    const linkedFinancialModel = buildFinancialFeasibilityModel(financialModel, salesStrategy, financialSettingsForm, operationsWorkspace, financialHorizon);
    const linkedSummary = linkedFinancialModel.summary || emptyFinancialModel.summary;
    const baseRevenue = numberParam("baseRevenue");
    const priceEffect = numberParam("priceChange") / 100;
    const demandEffect = numberParam("demandChange") / 100;
    const campaignEffect = numberParam("campaignLift") / 100;
    const efficiencyEffect = numberParam("productionEfficiency") / 100;
    const competitorDrag = numberParam("competitorPressure") / 100;
    const volatility = numberParam("volatility") / 100;
    const costVolatility = numberParam("costVolatility") / 100;
    const fixedCost = numberParam("fixedCost");
    const marketingBudget = numberParam("marketingBudget");
    const variableCostRatio = numberParam("variableCostRatio") / 100;
    const grossMargin = numberParam("grossMargin") / 100;
    const currentPrice = Number(salesStrategy.company.baseSalesPrice) || 0;
    const trendAdjustedRevenue = baseRevenue * (1 + demandEffect + priceEffect + campaignEffect + efficiencyEffect * 0.42 - competitorDrag * 0.55);
    const projectedCost = trendAdjustedRevenue * Math.min(variableCostRatio + costVolatility * 0.22, 0.92) + fixedCost + marketingBudget;
    const mostLikelyNet = trendAdjustedRevenue * grossMargin - fixedCost - marketingBudget;
    const outcomeSpread = trendAdjustedRevenue * Math.max(volatility + costVolatility * 0.65 + competitorDrag * 0.35, 0.08);
    const buildOutcome = (key, percentile, label, tone, multiplier) => {
      const revenue = trendAdjustedRevenue + outcomeSpread * multiplier;
      const cost = projectedCost + outcomeSpread * (multiplier < 0 ? Math.abs(multiplier) * 0.45 : -multiplier * 0.18);
      const net = revenue * grossMargin - fixedCost - marketingBudget - (multiplier < 0 ? outcomeSpread * Math.abs(multiplier) * 0.28 : 0);
      return {
        breakEvenUnits: Math.max(0, Math.round((fixedCost + marketingBudget) / Math.max(currentPrice * (1 - variableCostRatio), 1))),
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
      [copy("Variable cost", "Değişken gider"), -(likelyOutcome.revenue * variableCostRatio)],
      [copy("Fixed cost", "Sabit gider"), -fixedCost],
      [copy("Marketing budget", "Pazarlama bütçesi"), -marketingBudget],
      [copy("Projected net", "Projeksiyon net"), likelyOutcome.net],
    ];
    const parameterGroups = [
      {
        fields: [
          ["demandChange", copy("Demand change (%)", "Talep değişimi (%)"), -30, 40, 1],
          ["priceChange", copy("Price change (%)", "Fiyat değişimi (%)"), -20, 30, 1],
          ["campaignLift", copy("Marketing campaign lift (%)", "Pazarlama kampanya etkisi (%)"), -10, 35, 1],
          ["productionEfficiency", copy("Production efficiency effect (%)", "Üretim verimliliği etkisi (%)"), -20, 30, 1],
          ["marketShare", copy("Market share (%)", "Pazar payı (%)"), 0, 100, 0.5],
          ["reputationScore", copy("Reputation score", "İtibar skoru"), 0, 100, 1],
        ],
        title: copy("Trend drivers", "Trend sürücüleri"),
      },
      {
        fields: [
          ["volatility", copy("Demand volatility (%)", "Talep oynaklığı (%)"), 0, 60, 1],
          ["costVolatility", copy("Cost volatility (%)", "Maliyet oynaklığı (%)"), 0, 60, 1],
          ["competitorPressure", copy("Competitor pressure (%)", "Rakip baskısı (%)"), 0, 50, 1],
        ],
        title: copy("Risk and uncertainty", "Risk ve belirsizlik"),
      },
      {
        fields: [
          ["baseRevenue", copy("Base revenue", "Baz gelir"), 0, 100000000, 100000],
          ["grossMargin", copy("Gross margin (%)", "Brüt marj (%)"), 0, 80, 1],
          ["variableCostRatio", copy("Variable cost ratio (%)", "Değişken gider oranı (%)"), 0, 95, 1],
          ["fixedCost", copy("Fixed cost", "Sabit gider"), 0, 50000000, 100000],
          ["marketingBudget", copy("Marketing budget", "Pazarlama bütçesi"), 0, 20000000, 50000],
          ["timeHorizonMonths", copy("Time horizon (months)", "Zaman ufku (ay)"), 1, 60, 1],
        ],
        title: copy("Financial base", "Finansal temel"),
      },
    ];
    const usedParameters = [
      [copy("Simulation paths", "Simülasyon yolu"), formatNumber(numberParam("simulationCount"))],
      [copy("Future algorithm", "Gelecek algoritma"), copy("Fractal Brownian motion", "Fractal Brownian motion")],
      [copy("Sales strategy input", "Satış stratejisi girdisi"), copy("Campaign lift, channel pressure, reputation", "Kampanya etkisi, kanal baskısı, itibar")],
      [copy("Operations input", "Operasyon girdisi"), copy("Efficiency, cost volatility, capacity sensitivity", "Verimlilik, maliyet oynaklığı, kapasite hassasiyeti")],
      [copy("Financial input", "Finansal girdi"), copy("Monthly sales forecast, write-off, cash runway", "Aylık satış tahmini, fire, nakit dayanma")],
      [copy("Linked cash runway", "Bağlı nakit dayanma"), `${formatNumber(linkedSummary.cashRunwayMonths)} ${copy("months", "ay")}`],
      [copy("Linked payback", "Bağlı geri dönüş"), linkedSummary.paybackMonth ? `${linkedSummary.paybackMonth}. ${copy("month", "ay")}` : "-"],
    ];

    return renderDashboardLayout(
      `simulation/${variant.id}`,
        <section className="simulation-workspace monte-carlo-workspace">
          <div className="simulation-header">
            <div>
              <span>{dashboardCompanyName} / {copy("Monte Carlo Simulation", "Monte Carlo Simülasyonu")}</span>
              <h1>{variant.id === "current-situation" ? copy("Current Situation", "Mevcut Durum") : variant.name}</h1>
              <p>{copy("Simulation parameters are saved in Supabase. When an assumption is missing, keep it as an editable input; the current output is recalculated from the saved operations, sales, and financial data available now.", "Simülasyon parametreleri Supabase'e kaydedilir. Eksik varsayım varsa düzenlenebilir girdi olarak kalır; mevcut çıktı kayıtlı operasyon, satış ve finans verilerinden yeniden hesaplanır.")}</p>
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
                  <h2>{copy("Parameters currently being used", "Şu anda kullanılan parametreler")}</h2>
                </div>
              </div>
              <label className="simulation-name-field">
                <span>{copy("Variant name", "Varyant adı")}</span>
                <input value={variant.name} onChange={(event) => updateSimulationVariant(variant.id, "name", event.target.value)} />
              </label>
              {parameterGroups.map((group) => (
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
                        value={parameters[field]}
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
                    <span>{copy("Inputs in use", "Kullanılan girdiler")}</span>
                    <h2>{copy("Parameter sources", "Parametre kaynakları")}</h2>
                  </div>
                </div>
                <div className="used-parameter-list">
                  {usedParameters.map(([label, value]) => (
                    <span key={label}>{label}<strong>{value}</strong></span>
                  ))}
                </div>
              </article>

              <article className="simulation-card path-preview-card">
                <div className="simulation-card-heading">
                  <div>
                    <span>{copy("Path preview", "Yol önizleme")}</span>
                    <h2>{copy("Future fBM trend adjustment", "Gelecek fBM trend ayarı")}</h2>
                  </div>
                </div>
                <svg className="monte-chart path-preview-chart" viewBox="0 0 420 220" aria-hidden="true">
                  <path className="chart-grid" d="M24 42 H396 M24 88 H396 M24 134 H396 M24 180 H396" />
                  <path className="percentile-band" d="M28 166 C76 144 118 154 162 126 S248 108 294 82 360 80 392 58 L392 128 C340 140 312 154 266 166 S178 174 128 188 62 196 28 202 Z" />
                  <path className="path-worst" d="M28 196 C74 184 118 190 164 176 S244 166 294 152 350 150 392 136" />
                  <path className="path-likely" d="M28 168 C82 148 124 158 168 128 S248 118 296 90 352 82 392 68" />
                  <path className="path-good" d="M28 142 C78 112 122 120 168 92 S248 74 296 54 350 46 392 34" />
                </svg>
                <p>{copy("The visual is a frontend placeholder. Later, 10,000 simulated fractal Brownian paths will drive these percentile bands.", "Bu görsel frontend placeholder. Daha sonra 10.000 fractal Brownian simülasyon yolu bu persentil bantlarını oluşturacak.")}</p>
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
    const company = salesStrategy.company;
    const average = (items, field) => {
      if (!items.length) return 0;
      return items.reduce((total, item) => total + (Number(item[field]) || 0), 0) / items.length;
    };
    const findHighest = (items, field) => items.reduce((best, item) => ((Number(item[field]) || 0) > (Number(best?.[field]) || 0) ? item : best), items[0] || {});
    const totalCampaignBudget = salesStrategy.campaigns.reduce((total, campaign) => total + (Number(campaign.budget) || 0), 0);
    const totalChannelBudget = salesStrategy.channels.reduce((total, channel) => total + (Number(channel.budget) || 0), 0);
    const averageCompetitorPrice = average(salesStrategy.competitors, "salesPrice");
    const priceGap = (Number(company.baseSalesPrice) || 0) - averageCompetitorPrice;
    const strongestChannel = findHighest(salesStrategy.channels, "successScore");
    const strongestCampaign = findHighest(salesStrategy.campaigns, "successScore");
    const strongestPerson = findHighest(salesStrategy.personnel, "successScore");
    const competitorToWatch = findHighest(salesStrategy.competitors, "threatScore");
    const channelScore = Math.round(average(salesStrategy.channels, "successScore"));
    const campaignScore = Math.round(average(salesStrategy.campaigns, "successScore"));
    const personnelScore = Math.round(average(salesStrategy.personnel, "successScore"));
    const reputationScore = Number(company.reputationScore) || 0;
    const scoreClass = (score) => (Number(score) >= 75 ? "strong" : Number(score) >= 60 ? "watch" : "risk");
    const monthlyForecast = Array.from({ length: 12 }, (_, index) => toFiniteNumber(company.monthlyForecast?.[index]));
    const totalForecastUnits = monthlyForecast.reduce((total, units) => total + units, 0);
    const averageMonthlyForecast = totalForecastUnits / Math.max(monthlyForecast.length, 1);
    const channelShareTotal = salesStrategy.channels.reduce((total, channel) => total + Math.max(0, toFiniteNumber(channel.revenueShare)), 0) || salesStrategy.channels.length || 1;
    const weightedChannelValue = (field) => salesStrategy.channels.reduce((total, channel) => {
      const share = Math.max(0, toFiniteNumber(channel.revenueShare, 100 / Math.max(salesStrategy.channels.length, 1))) / channelShareTotal;
      return total + (share * toFiniteNumber(channel[field]));
    }, 0);

    return renderDashboardLayout(
      "sales-strategy",
        <section className="sales-workspace">
          <div className="sales-header">
            <div>
              <span>{dashboardCompanyName} / {copy("Sales Strategy", "Satış Stratejisi")}</span>
              <h1>{copy("Sales Strategy", "Satış Stratejisi")}</h1>
              <p>{copy("Plan monthly sales volume, channel margins, discounts, returns, and payment delays. Financial Modelling uses these assumptions to calculate revenue, inventory risk, cash runway, and payback.", "Aylık satış hacmi, kanal marjları, indirimler, iadeler ve ödeme vadelerini planlayın. Finansal Modelleme bu varsayımları gelir, stok riski, nakit dayanma süresi ve geri dönüş için kullanır.")}</p>
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
              [copy("12M Sales Forecast", "12A Satış Tahmini"), formatNumber(totalForecastUnits), copy("monthly volume inputs", "aylık hacim girdileri")],
              [copy("Avg Monthly Volume", "Ort. Aylık Hacim"), formatNumber(averageMonthlyForecast), copy("feeds financial model", "finansal modeli besler")],
              [copy("Weighted Return", "Ağırlıklı İade"), `${formatNumber(weightedChannelValue("returnRatePercent"), 1)}%`, copy("channel return assumption", "kanal iade varsayımı")],
              [copy("Price vs Competitors", "Rakiplere Göre Fiyat"), averageCompetitorPrice ? `${priceGap >= 0 ? "+" : ""}${formatLira(priceGap)}` : "-", copy("average price gap", "ortalama fiyat farkı")],
            ].map(([label, value, detail]) => (
              <article className="sales-stat-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </div>

          <div className="sales-grid">
            <article className="sales-card company-position-card">
              <div className="sales-card-heading">
                <div>
                  <span>{copy("Company position", "Şirket pozisyonu")}</span>
                  <h2>{copy("Product, price, market share and reputation", "Ürün, fiyat, pazar payı ve itibar")}</h2>
                </div>
              </div>
              <div className="sales-form-grid">
                <label>
                  <span>{copy("Product", "Ürün")}</span>
                  <input value={company.productName} onChange={(event) => updateSalesCompany("productName", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Target segment", "Hedef segment")}</span>
                  <input value={company.targetSegment} onChange={(event) => updateSalesCompany("targetSegment", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Sales price", "Satış fiyatı")}</span>
                  <input min="0" step="0.01" type="number" value={company.baseSalesPrice} onChange={(event) => updateSalesCompany("baseSalesPrice", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Monthly sales target", "Aylık satış hedefi")}</span>
                  <input min="0" type="number" value={company.monthlyTarget} onChange={(event) => updateSalesCompany("monthlyTarget", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Annual sales growth (%)", "Yıllık satış büyümesi (%)")}</span>
                  <input min="-100" step="0.1" type="number" value={company.annualSalesGrowthPercent} onChange={(event) => updateSalesCompany("annualSalesGrowthPercent", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Spoilage / expiry (%)", "Bozulma / SKT fire (%)")}</span>
                  <input min="0" max="100" step="0.1" type="number" value={company.spoilageRate} onChange={(event) => updateSalesCompany("spoilageRate", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Market share (%)", "Pazar payı (%)")}</span>
                  <input min="0" max="100" step="0.1" type="number" value={company.marketShare} onChange={(event) => updateSalesCompany("marketShare", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Reputation score", "İtibar skoru")}</span>
                  <input min="0" max="100" type="number" value={company.reputationScore} onChange={(event) => updateSalesCompany("reputationScore", event.target.value)} />
                </label>
                <label className="wide-field">
                  <span>{copy("Positioning note", "Konumlandırma notu")}</span>
                  <textarea value={company.positioning} onChange={(event) => updateSalesCompany("positioning", event.target.value)} />
                </label>
              </div>
            </article>

            <article className="sales-card sales-forecast-card">
              <div className="sales-card-heading">
                <div>
                  <span>{copy("Monthly volume forecast", "Aylık hacim tahmini")}</span>
                  <h2>{copy("Sales units by month", "Aylara göre satış adedi")}</h2>
                </div>
              </div>
              <div className="sales-forecast-grid">
                {monthlyForecast.map((units, index) => (
                  <label key={`forecast-${index}`}>
                    <span>{copy("Month", "Ay")} {index + 1}</span>
                    <input
                      min="0"
                      step="1"
                      type="number"
                      value={units}
                      onChange={(event) => updateSalesForecast(index, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </article>

            <article className="sales-card sales-reflection-card">
              <div className="sales-card-heading">
                <div>
                  <span>{copy("Success reflection", "Başarı yansıması")}</span>
                  <h2>{copy("What looks strong right now", "Şu an güçlü görünenler")}</h2>
                </div>
              </div>
              <div className="sales-score-list">
                {[
                  [copy("Channel health", "Kanal sağlığı"), channelScore, strongestChannel.name],
                  [copy("Campaign traction", "Kampanya çekişi"), campaignScore, strongestCampaign.name],
                  [copy("Personnel performance", "Personel performansı"), personnelScore, strongestPerson.name],
                  [copy("Company reputation", "Şirket itibarı"), reputationScore, company.positioning],
                ].map(([label, score, detail]) => (
                  <div className={`sales-score-row ${scoreClass(score)}`} key={label}>
                    <span>{label}</span>
                    <strong>{formatNumber(score)}/100</strong>
                    <div className="sales-score-bar"><i style={{ width: `${Math.min(Number(score) || 0, 100)}%` }} /></div>
                    <small>{detail}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="sales-card channels-card">
              <div className="sales-card-heading">
                <div>
                  <span>{copy("Sales channels", "Satış kanalları")}</span>
                  <h2>{copy("Online, retail, distributor and direct sales routes", "Online, retail, distribütör ve direkt satış rotaları")}</h2>
                </div>
                <button type="button" onClick={() => addSalesItem("channels")}>{copy("Add Channel", "Kanal Ekle")}</button>
              </div>
              <div className="sales-channel-grid">
                {salesStrategy.channels.map((channel) => (
                  <div className="sales-edit-card" key={channel.id}>
                    <label><span>{copy("Channel name", "Kanal adı")}</span><input value={channel.name} onChange={(event) => updateSalesItem("channels", channel.id, "name", event.target.value)} /></label>
                    <label><span>{copy("Type", "Tip")}</span><input value={channel.type} onChange={(event) => updateSalesItem("channels", channel.id, "type", event.target.value)} /></label>
                    <label><span>{copy("Sales price", "Satış fiyatı")}</span><input min="0" step="0.01" type="number" value={channel.price} onChange={(event) => updateSalesItem("channels", channel.id, "price", event.target.value)} /></label>
                    <label><span>{copy("Channel budget", "Kanal bütçesi")}</span><input min="0" step="1000" type="number" value={channel.budget} onChange={(event) => updateSalesItem("channels", channel.id, "budget", event.target.value)} /></label>
                    <label><span>{copy("Revenue share (%)", "Ciro payı (%)")}</span><input min="0" max="100" type="number" value={channel.revenueShare} onChange={(event) => updateSalesItem("channels", channel.id, "revenueShare", event.target.value)} /></label>
                    <label><span>{copy("Conversion (%)", "Dönüşüm (%)")}</span><input min="0" max="100" type="number" value={channel.conversionRate} onChange={(event) => updateSalesItem("channels", channel.id, "conversionRate", event.target.value)} /></label>
                    <label><span>{copy("Retailer margin (%)", "Perakende marjı (%)")}</span><input min="0" max="100" step="0.1" type="number" value={channel.marginPercent} onChange={(event) => updateSalesItem("channels", channel.id, "marginPercent", event.target.value)} /></label>
                    <label><span>{copy("Discount (%)", "İndirim (%)")}</span><input min="0" max="100" step="0.1" type="number" value={channel.discountPercent} onChange={(event) => updateSalesItem("channels", channel.id, "discountPercent", event.target.value)} /></label>
                    <label><span>{copy("Returns (%)", "İade (%)")}</span><input min="0" max="100" step="0.1" type="number" value={channel.returnRatePercent} onChange={(event) => updateSalesItem("channels", channel.id, "returnRatePercent", event.target.value)} /></label>
                    <label><span>{copy("Payment delay days", "Ödeme vadesi gün")}</span><input min="0" step="1" type="number" value={channel.paymentDelayDays} onChange={(event) => updateSalesItem("channels", channel.id, "paymentDelayDays", event.target.value)} /></label>
                    <label><span>{copy("Success score", "Başarı skoru")}</span><input min="0" max="100" type="number" value={channel.successScore} onChange={(event) => updateSalesItem("channels", channel.id, "successScore", event.target.value)} /></label>
                    <label className="wide-field"><span>{copy("Channel note", "Kanal notu")}</span><textarea value={channel.note} onChange={(event) => updateSalesItem("channels", channel.id, "note", event.target.value)} /></label>
                  </div>
                ))}
              </div>
            </article>

            <article className="sales-card campaigns-card">
              <div className="sales-card-heading">
                <div>
                  <span>{copy("Marketing campaigns", "Pazarlama kampanyaları")}</span>
                  <h2>{copy("Budget, campaign type, duration and target channel", "Bütçe, kampanya tipi, süre ve hedef kanal")}</h2>
                </div>
                <button type="button" onClick={() => addSalesItem("campaigns")}>{copy("Add Campaign", "Kampanya Ekle")}</button>
              </div>
              <div className="sales-table">
                <div className="sales-table-row sales-table-head"><span>{copy("Campaign", "Kampanya")}</span><span>{copy("Type", "Tip")}</span><span>{copy("Channel", "Kanal")}</span><span>{copy("Budget", "Bütçe")}</span><span>{copy("Duration", "Süre")}</span><span>{copy("Success", "Başarı")}</span></div>
                {salesStrategy.campaigns.map((campaign) => (
                  <div className="sales-table-row campaign-row" key={campaign.id}>
                    <label><input value={campaign.name} onChange={(event) => updateSalesItem("campaigns", campaign.id, "name", event.target.value)} /></label>
                    <label><input value={campaign.type} onChange={(event) => updateSalesItem("campaigns", campaign.id, "type", event.target.value)} /></label>
                    <label><input value={campaign.channel} onChange={(event) => updateSalesItem("campaigns", campaign.id, "channel", event.target.value)} /></label>
                    <label><input min="0" step="1000" type="number" value={campaign.budget} onChange={(event) => updateSalesItem("campaigns", campaign.id, "budget", event.target.value)} /></label>
                    <label><input min="0" type="number" value={campaign.durationWeeks} onChange={(event) => updateSalesItem("campaigns", campaign.id, "durationWeeks", event.target.value)} /></label>
                    <label><input min="0" max="100" type="number" value={campaign.successScore} onChange={(event) => updateSalesItem("campaigns", campaign.id, "successScore", event.target.value)} /></label>
                    <textarea value={campaign.goal} onChange={(event) => updateSalesItem("campaigns", campaign.id, "goal", event.target.value)} />
                  </div>
                ))}
              </div>
            </article>

            <article className="sales-card competitors-card">
              <div className="sales-card-heading">
                <div>
                  <span>{copy("Competitor intelligence", "Rakip bilgisi")}</span>
                  <h2>{copy("Manual competitor price, campaign and strategy inputs", "Manuel rakip fiyat, kampanya ve strateji girdileri")}</h2>
                </div>
                <button type="button" onClick={() => addSalesItem("competitors")}>{copy("Add Competitor", "Rakip Ekle")}</button>
              </div>
              <div className="competitor-grid">
                {salesStrategy.competitors.map((competitor) => (
                  <div className="competitor-card" key={competitor.id}>
                    <div className="competitor-title">
                      <input value={competitor.name} onChange={(event) => updateSalesItem("competitors", competitor.id, "name", event.target.value)} />
                      <mark className={scoreClass(competitor.threatScore)}>{copy("Threat", "Tehdit")} {formatNumber(competitor.threatScore)}</mark>
                    </div>
                    <div className="sales-form-grid compact">
                      <label><span>{copy("Sales price", "Satış fiyatı")}</span><input min="0" step="0.01" type="number" value={competitor.salesPrice} onChange={(event) => updateSalesItem("competitors", competitor.id, "salesPrice", event.target.value)} /></label>
                      <label><span>{copy("Market share", "Pazar payı")}</span><input min="0" max="100" type="number" value={competitor.marketShare} onChange={(event) => updateSalesItem("competitors", competitor.id, "marketShare", event.target.value)} /></label>
                      <label><span>{copy("Reputation", "İtibar")}</span><input min="0" max="100" type="number" value={competitor.reputationScore} onChange={(event) => updateSalesItem("competitors", competitor.id, "reputationScore", event.target.value)} /></label>
                      <label><span>{copy("Marketing budget", "Pazarlama bütçesi")}</span><input min="0" step="1000" type="number" value={competitor.marketingBudget} onChange={(event) => updateSalesItem("competitors", competitor.id, "marketingBudget", event.target.value)} /></label>
                      <label><span>{copy("Threat score", "Tehdit skoru")}</span><input min="0" max="100" type="number" value={competitor.threatScore} onChange={(event) => updateSalesItem("competitors", competitor.id, "threatScore", event.target.value)} /></label>
                      <label><span>{copy("Campaign type", "Kampanya tipi")}</span><input value={competitor.campaignType} onChange={(event) => updateSalesItem("competitors", competitor.id, "campaignType", event.target.value)} /></label>
                      <label className="wide-field"><span>{copy("Strategy", "Strateji")}</span><textarea value={competitor.strategy} onChange={(event) => updateSalesItem("competitors", competitor.id, "strategy", event.target.value)} /></label>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="sales-card personnel-card">
              <div className="sales-card-heading">
                <div>
                  <span>{copy("Sales personnel", "Satış personeli")}</span>
                  <h2>{copy("Ownership, pipeline, target and performance", "Sahiplik, pipeline, hedef ve performans")}</h2>
                </div>
                <button type="button" onClick={() => addSalesItem("personnel")}>{copy("Add Person", "Personel Ekle")}</button>
              </div>
              <div className="sales-table personnel-table">
                <div className="sales-table-row sales-table-head"><span>{copy("Person", "Kişi")}</span><span>{copy("Role", "Rol")}</span><span>{copy("Channel", "Kanal")}</span><span>{copy("Target", "Hedef")}</span><span>{copy("Pipeline", "Pipeline")}</span><span>{copy("Win rate", "Kazanım")}</span><span>{copy("Success", "Başarı")}</span></div>
                {salesStrategy.personnel.map((person) => (
                  <div className="sales-table-row personnel-row" key={person.id}>
                    <label><input value={person.name} onChange={(event) => updateSalesItem("personnel", person.id, "name", event.target.value)} /></label>
                    <label><input value={person.role} onChange={(event) => updateSalesItem("personnel", person.id, "role", event.target.value)} /></label>
                    <label><input value={person.assignedChannel} onChange={(event) => updateSalesItem("personnel", person.id, "assignedChannel", event.target.value)} /></label>
                    <label><input min="0" type="number" value={person.monthlyTarget} onChange={(event) => updateSalesItem("personnel", person.id, "monthlyTarget", event.target.value)} /></label>
                    <label><input min="0" step="1000" type="number" value={person.pipelineValue} onChange={(event) => updateSalesItem("personnel", person.id, "pipelineValue", event.target.value)} /></label>
                    <label><input min="0" max="100" type="number" value={person.winRate} onChange={(event) => updateSalesItem("personnel", person.id, "winRate", event.target.value)} /></label>
                    <label><input min="0" max="100" type="number" value={person.successScore} onChange={(event) => updateSalesItem("personnel", person.id, "successScore", event.target.value)} /></label>
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
                <span>{copy("Best channel", "En iyi kanal")} <strong>{strongestChannel.name || "-"}</strong><small>{formatNumber(strongestChannel.successScore)}/100</small></span>
                <span>{copy("Best campaign", "En iyi kampanya")} <strong>{strongestCampaign.name || "-"}</strong><small>{formatLira(totalCampaignBudget)} {copy("total budget", "toplam bütçe")}</small></span>
                <span>{copy("Top salesperson", "En iyi satışçı")} <strong>{strongestPerson.name || "-"}</strong><small>{formatLira(strongestPerson.pipelineValue)} pipeline</small></span>
                <span>{copy("Competitor to watch", "Takip edilecek rakip")} <strong>{competitorToWatch.name || "-"}</strong><small>{competitorToWatch.campaignType || "-"}</small></span>
                <span>{copy("Channel deductions", "Kanal kesintileri")} <strong>{formatNumber(weightedChannelValue("marginPercent") + weightedChannelValue("discountPercent"), 1)}%</strong><small>{copy("margin plus discount", "marj artı indirim")}</small></span>
                <span>{copy("Monthly target", "Aylık hedef")} <strong>{formatNumber(averageMonthlyForecast)}</strong><small>{copy("average from monthly forecast", "aylık tahmin ortalaması")}</small></span>
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
    { key: "product-plus", path: "/product-plus", label: "Ürün +" },
    { key: "human-resources-plus", path: "/human-resources-plus", label: copy("Human Resources +", "İnsan Kaynağı +") },
    { key: "financial-modelling", path: "/financial-modelling", label: copy("Financial Modelling", "Finansal Modelleme") },
    { key: "sales-strategy", path: "/sales-strategy", label: copy("Sales Strategy", "Satış Stratejisi") },
    { key: "simulation", path: "/simulation", label: copy("Simulation", "Simülasyon") },
    { key: "ai-insights", path: "/ai-insights", label: copy("AI Insights", "AI İçgörüleri") },
    { key: "reports", path: "/reports", label: copy("Reports", "Raporlar") },
    { key: "settings", path: "/settings", label: copy("Settings", "Ayarlar") },
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
    { group: "Maliyet Hesaplama", key: "product-cost", path: "/financial-modelling/maliyet-hesaplama/urun-maliyeti", label: "Ürün Maliyeti" },
    { group: "Maliyet Hesaplama", key: "investment-cost", path: "/financial-modelling/maliyet-hesaplama/yatirim-maliyeti", label: "Yatırım Maliyeti" },
    { group: "Getiri Hesaplama", key: "product-return", path: "/financial-modelling/getiri-hesaplama/urun-getirisi", label: "Ürün Getirisi" },
    { group: "Getiri Hesaplama", key: "investment-return", path: "/financial-modelling/getiri-hesaplama/yatirim-getirisi", label: "Yatırım Getirisi" },
  ];

  const activeModule = dashboardModules.find((module) => module.path === path);
  const activeOperationsSubmodule = operationsSubmodules.find((module) => module.path === path);
  const activeProductPlusSubmodule = productPlusSubmodules.find((module) => module.path === path);
  const activeFinancialSubmodule = financialSubmodules.find((module) => module.path === path);
  const activeSimulationVariant = simulationVariants.find((variant) => variant.path === path);
  const isOperationsRoute = path === "/operations" || path.startsWith("/operations/");
  const isProductPlusRoute = path === "/product-plus" || path.startsWith("/product-plus/");
  const isFinancialRoute = path === "/financial-modelling" || path.startsWith("/financial-modelling/");
  const isSimulationRoute = path === "/simulation" || path.startsWith("/simulation/");
  const moduleLabelByKey = Object.fromEntries(dashboardModules.map((module) => [module.key, module.label]));
  const getModuleLabel = (module) => moduleLabelByKey[module.module_key] || module.name;
  const projectedFinancialModel = buildFinancialFeasibilityModel(financialModel, salesStrategy, financialSettingsForm, operationsWorkspace, financialHorizon);
  const financialSummary = projectedFinancialModel.summary || emptyFinancialModel.summary;
  const financialTrendRows = projectedFinancialModel.trendRows || [];
  const financialMonthCount = getProjectionMonthCount(financialHorizon);
  const activePlanResults = (operationsWorkspace.activePlans || []).map((plan) => plan.result || {}).filter(Boolean);
  const latestPlan = operationsWorkspace.latestPlan || operationsWorkspace.activePlans?.[0] || null;
  const latestPlanResult = operationPlanResult || latestPlan?.result || null;
  const totalDailyProduction = activePlanResults.reduce((total, result) => total + toFiniteNumber(result.producedQuantity), 0);
  const totalDailyTrackedCost = activePlanResults.reduce((total, result) => total + toFiniteNumber(result.totalTrackedDailyCost), 0);
  const totalDailyEnergy = activePlanResults.reduce((total, result) => total + toFiniteNumber(result.energyConsumptionKwh), 0);
  const dashboardProductName = operationsWorkspace.product?.name || salesStrategy.company?.productName || copy("Product input needed", "Ürün girdisi gerekli");
  const dashboardCompanyName = currentProfile?.company?.name || currentProfile?.company_id || "Atera";
  const dashboardProductContext = operationsWorkspace.product?.product_group || operationsWorkspace.product?.name || salesStrategy.company?.productName || copy("No product selected", "Ürün seçilmedi");
  const hasOperationData = Boolean(operationsWorkspace.products.length || operationsWorkspace.machines.length || operationsWorkspace.materials.length || operationsWorkspace.workforce.length || activePlanResults.length);
  const hasSalesForecast = (salesStrategy.company?.monthlyForecast || []).some((item) => toFiniteNumber(item) > 0);
  const hasFinancialSourceData = Boolean(activePlanResults.length && hasSalesForecast);
  const noDataValue = "-";
  const moneyOrMissing = (value) => (hasFinancialSourceData ? formatLira(value) : noDataValue);
  const monthlyRevenue = financialMonthCount ? toFiniteNumber(financialSummary.salesRevenue) / financialMonthCount : 0;
  const monthlyCost = financialMonthCount ? toFiniteNumber(financialSummary.totalCost) / financialMonthCount : 0;
  const monthlyNet = financialMonthCount ? toFiniteNumber(financialSummary.netIncome) / financialMonthCount : 0;
  const dashboardStats = [
    { label: copy("Daily Production", "Günlük Üretim"), value: activePlanResults.length ? `${formatNumber(totalDailyProduction, 2)} ${latestPlanResult?.productUnit || operationsWorkspace.product?.unit || copy("units", "adet")}` : noDataValue, delta: copy("Supabase", "Supabase"), detail: copy("active process result", "aktif süreç sonucu") },
    { label: copy("Active Plans", "Aktif Plan"), value: formatNumber(operationsWorkspace.activePlans.length), delta: copy("Supabase", "Supabase"), detail: copy("saved process plans", "kayıtlı süreç planları") },
    { label: copy("Monthly Revenue", "Aylık Ciro"), value: moneyOrMissing(monthlyRevenue), delta: copy("calculated", "hesaplandı"), detail: copy("from sales forecast", "satış tahmininden") },
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
  const operationUnitSalePrice = toFiniteNumber(latestPlanResult?.productPrice, toFiniteNumber(operationsWorkspace.product?.price, toFiniteNumber(salesStrategy.company?.baseSalesPrice)));
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
      ? { title: copy("Sales forecast loaded", "Satış tahmini yüklendi"), copy: `${formatNumber((salesStrategy.company.monthlyForecast || []).reduce((total, item) => total + toFiniteNumber(item), 0))} ${copy("units across 12 months", "adet / 12 ay")}`, tone: "teal" }
      : { title: copy("Sales forecast needed", "Satış tahmini gerekli"), copy: copy("Enter monthly sales volume in Sales Strategy to unlock revenue, inventory, and runway calculations.", "Ciro, stok ve nakit hesapları için Satış Stratejisi'nde aylık satış hacmi girin."), tone: "amber" },
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
      copy("12 month forecast", "12 aylık tahmin"),
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
                  onClick={() => goTo(module.key === "operations" ? "/operations/data-entry" : module.key === "product-plus" ? "/product-plus/product-tree" : module.key === "financial-modelling" ? "/financial-modelling/maliyet-hesaplama/urun-maliyeti" : module.key === "simulation" ? "/simulation/current-situation" : module.path, "login")}
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
              <strong>{hasOperationData || hasSalesForecast ? copy("Supabase data loaded", "Supabase verisi yüklendi") : copy("Input needed", "Girdi gerekli")}</strong>
            </div>
            <div className="command-user">
              <span>{currentProfile?.username || form.username || "Atera"}</span>
              <small>{currentProfile?.access_level || "-"}</small>
            </div>
            <button type="button" className="command-run-button" onClick={() => goTo("/simulation/current-situation", "login")}>{copy("Open Simulation", "Simülasyonu Aç")}</button>
          </div>

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
                <button type="button">{copy("Full screen", "Tam ekran")}</button>
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

          <section className="insight-strip" aria-label="AI insights">
            <div className="card-heading">
              <div>
                <span>{copy("AI insights", "AI içgörüleri")}</span>
                <h2>{copy("Live recommendations", "Canlı öneriler")}</h2>
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
                [copy("Profitability", "Karlılık"), hasFinancialSourceData ? `${copy("Monthly net estimate:", "Aylık net tahmin:")} ${formatLira(monthlyNet)}.` : copy("Enter monthly sales forecast and cost assumptions to calculate profitability.", "Karlılığı hesaplamak için aylık satış tahmini ve maliyet varsayımlarını girin.")],
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
      return renderOperationDataPage({
        columns: [
          { header: copy("Machine", "Makine"), render: (row) => row.name },
          { header: copy("Price", "Fiyat"), render: (row) => formatLira(row.price) },
          { header: copy("Hourly Energy", "Saatlik Enerji"), render: (row) => `${formatNumber(row.hourly_energy_consumption_kwh, 2)} kWh` },
        ],
        description: copy("Keep only the name, price, and hourly energy consumption for the machine selected in production.", "Sadece üretimde seçilecek makinenin adını, fiyatını ve saatlik enerji tüketimini tutun."),
        entity: "machine",
        fields: [
          { name: "name", label: copy("Machine name", "Makine adı") },
          { name: "price", label: copy("Machine price", "Makine fiyatı"), step: "0.01", type: "number" },
          { name: "hourlyEnergyConsumptionKwh", label: copy("Hourly energy consumption", "Saatlik enerji tüketimi"), step: "0.01", type: "number" },
        ],
        rows: operationsWorkspace.machines,
        title: copy("Machines & Equipment", "Makine & Ekipman"),
      });
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
                <button type="button">{copy("Back", "Geri")}</button>
                <button type="button">{copy("Copy", "Kopyala")}</button>
                <button type="button">{copy("Revision History", "Revizyon Geçmişi")}</button>
                <button type="button" className="primary">{copy("Edit", "Düzenle")}</button>
              </div>
            </div>

            <div className="operations-tabs" role="tablist" aria-label={copy("Operation detail tabs", "Operasyon detay sekmeleri")}>
              {[
                copy("General Information", "Genel Bilgiler"),
                copy("Technical Specs", "Teknik Özellikler"),
                copy("Materials & Components", "Malzeme & Bileşenler"),
                copy("Operation Sequence", "Operasyon Sırası"),
                copy("Process Flow", "Süreç Akışı"),
                copy("Quality", "Kalite"),
                copy("Documents", "Dokümanlar"),
                copy("Notes", "Notlar"),
              ].map((tab, index) => (
                <button type="button" className={index === 0 ? "active" : ""} key={tab}>{tab}</button>
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
                  <button type="button">{copy("New Note", "Yeni Not")}</button>
                </div>
                {(operationsWorkspace.notes.length ? operationsWorkspace.notes : [{ id: "empty", note: copy("No product note yet.", "Henüz ürün notu yok."), created_at: new Date().toISOString() }]).map((note) => (
                  <p key={note.id}>{new Date(note.created_at).toLocaleDateString(locale)}: {note.note}</p>
                ))}
              </article>
            </div>

            <article className="operation-card operation-flow">
              <div className="operation-card-heading">
                <h2>{copy("Operation Flow", "Operasyon Akışı")}</h2>
                <button type="button">{copy("View Flow Diagram", "Akış Diyagramını Gör")}</button>
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
      goTo("/financial-modelling/maliyet-hesaplama/urun-maliyeti", "login");
      return null;
    }

    if (isFinancialRoute && !activeFinancialSubmodule) {
      goTo("/financial-modelling/maliyet-hesaplama/urun-maliyeti", "login");
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
              {[copy("All Reports", "Tüm Raporlar"), copy("Production Reports", "Üretim Raporları"), copy("Financial Reports", "Finansal Raporlar"), copy("Sales Reports", "Satış Raporları"), copy("Capacity Reports", "Kapasite Raporları"), copy("Maintenance Reports", "Bakım Raporları"), copy("Custom Reports", "Özel Raporlar")].map((tab, index) => (
                <button type="button" className={index === 0 ? "active" : ""} key={tab}>{tab}</button>
              ))}
            </div>

            <div className="reports-controls">
              <label><span>{copy("Search reports", "Rapor ara")}</span><input placeholder={copy("Search reports...", "Rapor ara...")} /></label>
              <button type="button">{copy("Filters", "Filtreler")}</button>
              <select value={financialHorizon} onChange={(event) => loadFinancialData(event.target.value)}>
                <option value="6m">{copy("Next 6 months", "Gelecek 6 ay")}</option>
                <option value="1y">{copy("Next 12 months", "Gelecek 12 ay")}</option>
                <option value="5y">{copy("Next 60 months", "Gelecek 60 ay")}</option>
              </select>
              <button type="button" className="primary">{copy("Export", "Dışa Aktar")}</button>
            </div>

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
                <div className="reports-card-heading"><h2>{copy("Recent Reports", "Son Raporlar")}</h2><button type="button">{copy("View All", "Tümünü Gör")}</button></div>
                <div className="recent-report-table">
                  <div className="recent-report-row report-head"><span>{copy("Report Name", "Rapor Adı")}</span><span>{copy("Category", "Kategori")}</span><span>{copy("Created Date", "Oluşturulma Tarihi")}</span><span>{copy("Period", "Dönem")}</span><span>{copy("Created By", "Oluşturan")}</span><span>{copy("Actions", "İşlemler")}</span></div>
                  {(recentReports.length ? recentReports : [[copy("No report snapshots yet", "Henüz rapor anlık görünümü yok"), copy("Input required", "Girdi gerekli"), "-", "-", reportAuthor]]).map((report) => (
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
                    [copy("Monthly sales forecast", "Aylık satış tahmini"), hasSalesForecast ? copy("Ready", "Hazır") : copy("Needed", "Gerekli")],
                    [copy("Financial assumptions", "Finansal varsayımlar"), financialModel.settings ? copy("Ready", "Hazır") : copy("Needed", "Gerekli")],
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
                    {[copy("Production Report", "Üretim Raporu"), copy("Financial Summary", "Finansal Özet"), copy("Sales Analysis", "Satış Analizi"), copy("Capacity Analysis", "Kapasite Analizi"), copy("Custom Report", "Özel Rapor")].map((item) => (
                      <button type="button" key={item}>{item}</button>
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
                          {roles.map((role) => (
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
                      {roles.map((role) =>
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
          {mode === "signup" && (
            <label className="file-button">
              {labels.profilePicture}
              <input accept="image/*" type="file" onChange={onProfileFileChange} />
            </label>
          )}
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
          <form className="auth-form" onSubmit={mode === "login" ? handleLogin : handleSignup}>
            <label>
              <span>{labels.username}</span>
              <input
                autoComplete="username"
                required
                value={form.username}
                onChange={(event) => updateField("username", event.target.value)}
              />
            </label>

            <label>
              <span>{labels.password}</span>
              <div className="password-field">
                <input
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
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

            {mode === "signup" && (
              <label>
                <span>{labels.email}</span>
                <input
                  autoComplete="email"
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                />
              </label>
            )}

            {mode === "signup" && (
              <div className="signup-grid">
                <label>
                  <span>{labels.phoneNumber}</span>
                  <input
                    autoComplete="tel"
                    value={form.phoneNumber}
                    onChange={(event) => updateField("phoneNumber", event.target.value)}
                  />
                </label>

                <label>
                  <span>{labels.company}</span>
                  <input value={form.company} onChange={(event) => updateField("company", event.target.value)} />
                </label>

                <label>
                  <span>{labels.department}</span>
                  <input value={form.department} onChange={(event) => updateField("department", event.target.value)} />
                </label>

                <label>
                  <span>{labels.accessLevel}</span>
                  <select value={form.accessLevel} onChange={(event) => updateField("accessLevel", event.target.value)}>
                    <option value="user">{copy("User", "Kullanıcı")}</option>
                    <option value="manager">{copy("Manager", "Yönetici")}</option>
                    <option value="admin">{copy("Admin", "Admin")}</option>
                  </select>
                </label>
              </div>
            )}

            {mode === "login" && (
              <div className="form-options">
                <button type="button" className="link-button" onClick={handleForgotPassword}>
                  {labels.forgot}
                </button>
              </div>
            )}

            <button className="submit-button" disabled={loading} type="submit">
              {loading ? "..." : mode === "login" ? labels.submitLogin : labels.submitSignup}
            </button>
          </form>
        )}

        {status && <p className="status-message">{status}</p>}
      </section>
    </main>
  );
}

export default App;
