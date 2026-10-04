import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCampaignSpendSchedule,
  buildFinancialFeasibilityModel,
  calculatePlanDailyCost,
} from "../src/lib/feasibilityModel.js";
import { defaultFinancialSettings, emptyFinancialModel } from "../src/lib/financialService.js";

const approx = (actual, expected, tolerance = 1e-6) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected}, got ${actual}`);
};

const workspace = {
  equipment: [],
  machines: [
    { availability_hours: 8, id: "mixer", name: "Mixer", price: 100000, price_currency: "TRY" },
  ],
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

  approx(cost.daily.material, (50 * 2) + (100 * 5));
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
  const schedule = buildCampaignSpendSchedule([
    { budget: 90000, durationDays: 90 },
    { budget: 12000, durationDays: 14 },
    { budget: 0, durationDays: 30 },
  ], 6);

  assert.deepEqual(schedule, [42000, 30000, 30000, 0, 0, 0]);
});

test("the financial model uses the user's cost data and campaign spend", () => {
  const salesStrategy = {
    campaigns: [{ budget: 6000, durationDays: 30 }],
    channels: [{
      collectionDays: 0,
      commissionPercent: 0,
      growthMonths1To6Percent: 0,
      id: "direct",
      monthlySalesUnits: 2200,
      productId: "drink",
      startMonth: 1,
      unitSalesPrice: 50,
    }],
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
