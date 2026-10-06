import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCampaignSpendSchedule,
  buildFinancialFeasibilityModel,
  calculateInternalRateOfReturn,
  calculateNetPresentValue,
  buildSensitivityTable,
  calculatePlanDailyCost,
  evaluateFeasibilityDecision,
} from "../src/lib/feasibilityModel.js";
import { defaultFinancialSettings, emptyFinancialModel } from "../src/lib/financialService.js";

const approx = (actual, expected, tolerance = 1e-6) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected}, got ${actual}`);
};

const workspace = {
  equipment: [],
  machines: [{ availability_hours: 8, id: "mixer", name: "Mixer", price: 100000, price_currency: "TRY" }],
  materials: [
    { id: "water", name: "Water", price_per_unit: 2, unit: "lt" },
    { id: "bottle", name: "Bottle", price_per_unit: 5, unit: "adet" },
  ],
  products: [{ id: "drink", name: "Drink", price: 50 }],
  workforce: [{ hourly_cost: 200, id: "operator", role_name: "Operator" }],
};

const planResult = {
  energyConsumptionKwh: 40,
  machineRows: [{ dailyHours: 5, energyConsumptionKwh: 40, machineId: "mixer", price: 100000, priceCurrency: "TRY" }],
  materialRows: [
    { dailyQuantity: 50, materialId: "water" },
    { dailyQuantity: 100, materialId: "bottle" },
  ],
  producedQuantity: 100,
  workforceRows: [{ dailyHours: 5, hoursUsed: 10, peopleAssigned: 2, workforceId: "operator" }],
};

test("prices a plan from recipe materials, workforce hours and machine energy", () => {
  const cost = calculatePlanDailyCost(planResult, workspace, { electricityPricePerKwh: 3 });

  approx(cost.daily.material, 50 * 2 + 100 * 5);
  approx(cost.daily.labor, 10 * 200);
  approx(cost.daily.energy, 40 * 3);
  approx(cost.unit.total, (600 + 2000 + 120) / 100);
  assert.deepEqual(cost.missingMaterialPrices, []);
  assert.equal(cost.missingElectricityPrice, false);
});

test("reports inputs that are missing a price instead of silently costing them at zero", () => {
  const cost = calculatePlanDailyCost(
    planResult,
    { ...workspace, materials: [{ id: "water", name: "Water", price_per_unit: 0 }], workforce: [] },
    { electricityPricePerKwh: 0 },
  );

  assert.deepEqual(cost.missingMaterialPrices, ["Water", "bottle"]);
  assert.deepEqual(cost.missingWorkforceRates, ["operator"]);
  assert.equal(cost.missingElectricityPrice, true);
});

test("spreads each campaign budget evenly over its duration", () => {
  const schedule = buildCampaignSpendSchedule(
    [
      { budget: 90000, durationDays: 90 },
      { budget: 12000, durationDays: 14 },
      { budget: 0, durationDays: 30 },
    ],
    6,
  );

  assert.deepEqual(schedule, [42000, 30000, 30000, 0, 0, 0]);
});

test("the financial model uses the user's cost data and campaign spend", () => {
  const salesStrategy = {
    campaigns: [{ budget: 6000, durationDays: 30 }],
    channels: [
      {
        collectionDays: 0,
        commissionPercent: 0,
        growthMonths1To6Percent: 0,
        id: "direct",
        monthlySalesUnits: 2200,
        productId: "drink",
        startMonth: 1,
        unitSalesPrice: 50,
      },
    ],
    company: { monthlyMultipliers: Array.from({ length: 12 }, () => 1) },
  };
  const model = buildFinancialFeasibilityModel(
    emptyFinancialModel,
    salesStrategy,
    { ...defaultFinancialSettings, electricityPricePerKwh: 3, workingDaysPerMonth: 22 },
    { ...workspace, activePlans: [{ id: "plan", product_id: "drink", result: planResult }] },
    "6m",
  );

  approx(model.summary.unitMaterialCost, 6);
  approx(model.summary.unitWorkforceCost, 20);
  approx(model.summary.unitElectricityCost, 1.2);
  approx(model.summary.unitProductionCost, 27.2);
  approx(model.summary.marketingCost, 6000);
  approx(model.trendRows[0].materialCost, 2200 * 6);
  approx(model.trendRows[0].workforceCost, 2200 * 20);
  approx(model.summary.machinePurchaseCost, 100000);
});

const baseSettings = {
  ...defaultFinancialSettings,
  electricityPricePerKwh: 3,
  expenseVatRate: 20,
  incomeTaxRate: 25,
  initialCash: 500000,
  rawMaterialBufferMonths: 0,
  rawMaterialStockDays: 0,
  receivablesCollectionDays: 0,
  rentBufferMonths: 0,
  salaryBufferMonths: 0,
  salesVatRate: 20,
  supplierPaymentDays: 0,
  taxPaymentDelayMonths: 3,
  workingDaysPerMonth: 20,
};

const channel = (overrides = {}) => ({
  collectionDays: 0,
  commissionPercent: 0,
  id: "direct",
  monthlySalesUnits: 2000,
  productId: "drink",
  startMonth: 1,
  unitSalesPrice: 50,
  ...overrides,
});

const runModel = ({
  settings = {},
  channels = [channel()],
  campaigns = [],
  extraCosts = [],
  horizon = "5y",
  plan = planResult,
  ws = workspace,
} = {}) =>
  buildFinancialFeasibilityModel(
    { ...emptyFinancialModel, extraCosts },
    { campaigns, channels, company: { monthlyMultipliers: Array.from({ length: 12 }, () => 1) } },
    { ...baseSettings, ...settings },
    { ...ws, activePlans: [{ id: "plan", product_id: "drink", result: plan }] },
    horizon,
  );

test("the balance sheet balances every month", () => {
  const model = runModel({
    campaigns: [{ budget: 30000, durationDays: 60 }],
    channels: [
      channel({
        collectionDays: 45,
        commissionPercent: 10,
        returnRatePercent: 2,
        seasonalityCurve: [1, 0.5, 1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      }),
      channel({ collectionDays: 90, discountRatePercent: 5, id: "retail", monthlySalesUnits: 400, unitSalesPrice: 45 }),
    ],
    extraCosts: [
      { amount: 80000, costType: "initial", name: "Launch" },
      { amount: 15000, costType: "recurring", name: "Rent" },
    ],
    settings: {
      loanRows: [
        {
          amount: 200000,
          annualInterestRate: 30,
          currency: "TRY",
          gracePeriodMonths: 3,
          loanTermMonths: 24,
          receivedDate: new Date().toISOString().slice(0, 10),
        },
      ],
      monthlyInflationPercent: 1,
      rawMaterialBufferMonths: 1,
      supplierPaymentDays: 45,
    },
  });

  model.trendRows.forEach((row) => {
    approx(row.totalAssets, row.totalLiabilitiesAndEquity, 1e-4);
  });
});

test("VAT never reaches the income statement", () => {
  const withVat = runModel({ settings: { expenseVatRate: 20, salesVatRate: 20 } });
  const withoutVat = runModel({ settings: { expenseVatRate: 0, salesVatRate: 0 } });

  approx(withVat.summary.netIncome, withoutVat.summary.netIncome, 1e-4);
  approx(withVat.summary.salesRevenue, withoutVat.summary.salesRevenue, 1e-4);
  assert.ok(withVat.summary.vatPayable > 0);
});

test("unsold units stay in stock and are sold in later months", () => {
  // 2,000 units are produced each month; demand is 1,000 then 3,000.
  const model = runModel({
    channels: [channel({ monthlySalesUnits: 1000, seasonalityCurve: [1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] })],
    horizon: "6m",
  });

  approx(model.trendRows[0].netSoldUnits, 1000);
  approx(model.trendRows[0].inventoryUnits, 1000);
  approx(model.trendRows[1].netSoldUnits, 3000);
  approx(model.trendRows[1].inventoryUnits, 0);
  approx(model.trendRows[1].materialCost, 3000 * 6);
});

test("losses from earlier years reduce later income tax", () => {
  const model = runModel({ extraCosts: [{ amount: 1500000, costType: "initial", name: "Start-up" }] });
  const yearProfit = (year) =>
    model.trendRows.slice(year * 12, (year + 1) * 12).reduce((total, row) => total + row.profitBeforeTax, 0);
  const yearTax = (year) =>
    model.trendRows.slice(year * 12, (year + 1) * 12).reduce((total, row) => total + row.incomeTax, 0);
  const firstYear = yearProfit(0);
  const secondYear = yearProfit(1);

  assert.ok(firstYear < 0, "year 1 should be a loss");
  approx(yearTax(0), 0, 1e-6);
  approx(yearTax(1), Math.max(0, secondYear + firstYear) * 0.25, 1e-4);
});

test("depreciation is expensed but does not leave cash", () => {
  const model = runModel({ horizon: "1y" });

  approx(model.summary.depreciation, 100000 / 10);
  approx(model.trendRows[0].depreciation, 100000 / 120);
  const cashMovement = model.trendRows.reduce((total, row) => total + row.cashFlow, 0);
  approx(model.summary.endingCash, 500000 - 100000 + cashMovement, 1e-4);
});

test("a plan that needs more machine time than available is scaled down", () => {
  const model = runModel({
    horizon: "6m",
    plan: { ...planResult, totalProductionTimeMinutes: 600 },
  });

  approx(model.summary.dailyProduction, 100 * (480 / 600));
  assert.equal(model.summary.costWarnings.capacityLimitedPlans.length, 1);
  // The fixed daily shift is spread over fewer units.
  approx(model.summary.unitWorkforceCost, 2000 / 80);
});

test("own cash requirement counts the capital spend once, without a duplicate working-capital reserve", () => {
  const model = runModel({ horizon: "1y" });

  approx(model.summary.initialCashRequired, 100000, 1e-6);
});

test("break-even is the first month cumulative net income turns positive", () => {
  const model = runModel({ extraCosts: [{ amount: 200000, costType: "initial", name: "Start-up" }], horizon: "1y" });
  let cumulative = 0;
  const expected =
    model.trendRows.findIndex((row) => {
      cumulative += row.netIncome;
      return cumulative >= 0;
    }) + 1;

  assert.ok(expected > 1);
  assert.equal(model.summary.breakEvenMonth, expected);
});

test("each cost line inflates with a single rate", () => {
  const model = runModel({
    channels: [channel({ monthlySalesUnits: 2000 })],
    horizon: "5y",
    settings: {
      cogsInflationAnnualPercent: 35,
      monthlyCurrencyIncreasePercent: 1.5,
      monthlyEnergyPriceIncreasePercent: 2,
      monthlyInflationPercent: 2.5,
      monthlyWageIncreasePercent: 2,
    },
  });
  const month = 24;
  const row = model.trendRows[month];

  // TRY-priced materials follow COGS inflation only; FX drift and general inflation are not stacked on top.
  approx(row.materialCost / row.netSoldUnits, 6 * 1.35 ** (month / 12), 1e-6);
  approx(row.electricityCost / row.netSoldUnits, 1.2 * 1.02 ** month, 1e-6);
  approx(row.workforceCost / row.netSoldUnits, 20 * 1.02 ** month, 1e-6);
});

test("FX drift applies to materials priced in foreign currency", () => {
  const model = runModel({
    horizon: "1y",
    settings: { cogsInflationAnnualPercent: 0, monthlyCurrencyIncreasePercent: 2, monthlyInflationPercent: 0 },
    ws: {
      ...workspace,
      materials: [
        { id: "water", name: "Water", price_currency_original: "TRY", price_per_unit: 2 },
        { id: "bottle", name: "Bottle", price_currency_original: "EUR", price_per_unit: 5 },
      ],
    },
  });
  const row = model.trendRows[6];

  approx(row.materialCost / row.netSoldUnits, 1 + 5 * 1.02 ** 6, 1e-6);
});

test("NPV discounts monthly flows at the monthly equivalent of the annual rate", () => {
  // 12 months at 10% a year: one year of discounting exactly.
  const flows = [-1000, ...Array.from({ length: 11 }, () => 0), 1100];
  approx(calculateNetPresentValue(flows, 10), 0, 1e-9);
  approx(calculateNetPresentValue([-1000, 0, 0], 0), -1000);
});

test("IRR is the annual rate where NPV is zero, or null without a sign change", () => {
  const flows = [-1000, ...Array.from({ length: 11 }, () => 0), 1100];
  approx(calculateInternalRateOfReturn(flows), 10, 1e-6);
  assert.equal(calculateInternalRateOfReturn([100, 200]), null);
  assert.equal(calculateInternalRateOfReturn([-100, -200]), null);

  const monthly = [-50000, ...Array.from({ length: 24 }, () => 3000)];
  const irr = calculateInternalRateOfReturn(monthly);
  approx(calculateNetPresentValue(monthly, irr), 0, 1e-4);
});

test("the model values the project from its unlevered cash flows plus residual value", () => {
  const model = runModel({ horizon: "1y", settings: { discountRateAnnualPercent: 20 } });
  const { summary, trendRows } = model;
  const last = trendRows[trendRows.length - 1];
  const flows = [-summary.machinePurchaseCost, ...trendRows.map((row) => row.operatingCashFlow)];
  flows[flows.length - 1] += last.fixedAssets + last.workingCapital;

  approx(summary.residualValue, last.fixedAssets + last.workingCapital);
  approx(summary.netPresentValue, calculateNetPresentValue(flows, 20), 1e-6);
  approx(summary.internalRateOfReturn, calculateInternalRateOfReturn(flows), 1e-6);
  assert.equal(summary.discountRateAnnualPercent, 20);

  // A loan changes cash, not the project's value.
  const withLoan = runModel({
    horizon: "1y",
    settings: {
      discountRateAnnualPercent: 20,
      loanRows: [{ amount: 200000, annualInterestRate: 0, loanTermMonths: 6, receivedDate: "2000-01-01" }],
    },
  });
  assert.ok(withLoan.summary.lowestCashBalance > summary.lowestCashBalance);
});

test("lowest cash and capacity use come from the projection", () => {
  const model = runModel({ horizon: "1y" });
  const lowest = Math.min(
    baseSettings.initialCash - model.summary.machinePurchaseCost,
    ...model.trendRows.map((row) => row.cashBalance),
  );

  approx(model.summary.lowestCashBalance, lowest);
  approx(
    model.summary.capacityUtilization,
    model.summary.forecastSalesUnits / (model.summary.dailyProduction * 20 * 12),
  );

  const short = runModel({ channels: [channel({ monthlySalesUnits: 1e6 })], horizon: "1y" });
  assert.ok(short.summary.capacityUtilization > 1);
});

test("the decision is risky without value or payback, waits on a failed check, else feasible", () => {
  const good = { capacityUtilization: 0.8, lowestCashBalance: 10, netPresentValue: 1, paybackMonth: 12 };

  assert.equal(evaluateFeasibilityDecision(good).status, "feasible");
  assert.equal(evaluateFeasibilityDecision({ ...good, netPresentValue: -1 }).status, "risky");
  assert.equal(evaluateFeasibilityDecision({ ...good, paybackMonth: null }).status, "risky");
  assert.equal(evaluateFeasibilityDecision({ ...good, paybackMonth: 48 }).status, "wait");
  assert.equal(evaluateFeasibilityDecision({ ...good, lowestCashBalance: -5 }).status, "wait");
  assert.equal(evaluateFeasibilityDecision({ ...good, capacityUtilization: 1.2 }).status, "wait");
  assert.equal(evaluateFeasibilityDecision({ ...good, capacityUtilization: null }).status, "wait");
  assert.deepEqual(
    evaluateFeasibilityDecision({ ...good, paybackMonth: 48 })
      .checks.filter((check) => !check.ok)
      .map((check) => check.key),
    ["payback"],
  );
});

test("sensitivity moves one lever at a time through the full model", () => {
  const args = [
    { ...emptyFinancialModel, extraCosts: [] },
    {
      campaigns: [],
      channels: [channel({ monthlySalesUnits: 1500 })],
      company: { monthlyMultipliers: Array.from({ length: 12 }, () => 1) },
    },
    { ...baseSettings },
    { ...workspace, activePlans: [{ id: "plan", product_id: "drink", result: planResult }] },
    "1y",
  ];
  const rows = buildSensitivityTable(...args);
  const byCase = (lever, change) => rows.find((row) => row.lever === lever && row.change === change);
  const base = rows[0];

  assert.equal(rows.length, 7);
  assert.equal(base.lever, "base");
  approx(base.netPresentValue, buildFinancialFeasibilityModel(...args).summary.netPresentValue);
  assert.ok(byCase("price", 0.1).netPresentValue > base.netPresentValue);
  assert.ok(byCase("price", -0.1).netPresentValue < base.netPresentValue);
  assert.ok(byCase("volume", -0.2).netIncome < base.netIncome);
  assert.ok(byCase("cost", 0.1).netPresentValue < base.netPresentValue);
  assert.ok(byCase("cost", -0.1).netPresentValue > base.netPresentValue);
  approx(byCase("cost", 0.1).netPresentValueChange, byCase("cost", 0.1).netPresentValue - base.netPresentValue);

  // A 10% price cut on sold units lowers net sales by 10% when nothing else moves.
  const priceModel = buildFinancialFeasibilityModel(
    args[0],
    args[1],
    { ...args[2], sensitivity: { price: 0.9 } },
    args[3],
    args[4],
  );
  approx(priceModel.summary.salesRevenue, buildFinancialFeasibilityModel(...args).summary.salesRevenue * 0.9, 1e-6);
});
