import assert from "node:assert/strict";
import test from "node:test";
import { calculateCurrentPlanResult, getCurrentOperationPlans, hasViablePlanResult } from "../src/lib/operationsCalculations.js";

const workspace = {
  machines: [
    { hourly_energy_consumption_kwh: 2, id: "machine-1", name: "Press", price: 100000 },
  ],
  materials: [
    { id: "material-1", name: "Steel", price_per_unit: 15, unit: "kg" },
  ],
  products: [
    {
      cycle_time_minutes: 2,
      id: "product-1",
      material_rows: [
        { material: { id: "material-1", name: "Steel", price_per_unit: 15, unit: "kg" }, material_id: "material-1", quantity_per_unit: 3 },
      ],
      name: "Bracket",
      price: 120,
      unit: "adet",
    },
  ],
  workforce: [
    { hourly_cost: 200, id: "workforce-1", role_name: "Operator" },
  ],
};

test("recalculates an active plan from current operation records", () => {
  const result = calculateCurrentPlanResult({
    input: {
      machineRows: [{ dailyHours: 8, machineId: "machine-1" }],
      productId: "product-1",
      workforceRows: [{ dailyHours: 8, peopleAssigned: 1, workforceId: "workforce-1" }],
    },
    product_id: "product-1",
    result: {
      materialCost: 1,
      producedQuantity: 1,
    },
  }, workspace);

  assert.equal(result.producedQuantity, 240);
  assert.equal(result.materialCost, 10800);
  assert.equal(result.workforceCost, 1600);
  assert.equal(result.totalTrackedDailyCost, 12400);
  assert.equal(hasViablePlanResult(result), true);
});

test("does not treat zero-output plans as viable", () => {
  const result = calculateCurrentPlanResult({
    input: {
      machineRows: [{ dailyHours: 0, machineId: "machine-1" }],
      productId: "product-1",
    },
    product_id: "product-1",
  }, workspace);

  assert.equal(result.producedQuantity, 0);
  assert.equal(hasViablePlanResult(result), false);
});

test("ignores malformed active plan rows", () => {
  const plans = getCurrentOperationPlans({
    ...workspace,
    activePlans: [
      null,
      {
        input: {
          machineRows: [{ dailyHours: 8, machineId: "machine-1" }],
          productId: "product-1",
        },
        product_id: "product-1",
      },
    ],
  });

  assert.equal(plans.length, 1);
  assert.equal(plans[0].result.producedQuantity, 240);
});

test("ignores malformed nested plan rows", () => {
  const result = calculateCurrentPlanResult({
    input: {
      machineRows: [null, "bad", { dailyHours: 8, machineId: "machine-1" }],
      productId: "product-1",
      workforceRows: [undefined, { dailyHours: 8, peopleAssigned: 1, workforceId: "workforce-1" }],
    },
    product_id: "product-1",
    result: {
      materialRows: [null],
    },
  }, workspace);

  assert.equal(result.producedQuantity, 240);
  assert.equal(result.machineRows.length, 1);
  assert.equal(result.workforceRows.length, 1);
});
