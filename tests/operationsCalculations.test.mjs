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

test("uses saved active plan results without expensive recalculation by default", () => {
  const plans = getCurrentOperationPlans({
    ...workspace,
    activePlans: [
      {
        input: {
          machineRows: [{ dailyHours: 8, machineId: "machine-1" }],
          productId: "product-1",
        },
        product_id: "product-1",
        result: {
          machineRows: [{ dailyHours: 1, machineId: "machine-1" }],
          materialRows: [{ dailyQuantity: 1, materialId: "material-1" }],
          producedQuantity: 12,
        },
      },
    ],
  });

  assert.equal(plans.length, 1);
  assert.equal(plans[0].result.producedQuantity, 12);
});

test("can still force active plan recalculation when needed", () => {
  const plans = getCurrentOperationPlans({
    ...workspace,
    activePlans: [
      {
        input: {
          machineRows: [{ dailyHours: 8, machineId: "machine-1" }],
          productId: "product-1",
        },
        product_id: "product-1",
        result: {
          machineRows: [{ dailyHours: 1, machineId: "machine-1" }],
          materialRows: [{ dailyQuantity: 1, materialId: "material-1" }],
          producedQuantity: 12,
        },
      },
    ],
  }, { recalculate: true });

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

test("simulates operation precedence with flow batches", () => {
  const result = calculateCurrentPlanResult({
    input: {
      batchSize: 5,
      flowStrategy: "flow",
      minimumTransferQuantity: 1,
      operationRows: [
        { capacity: 1, dailyHours: 8, machineId: "machine-1", operationName: "Puree", processTimeMinutes: 2, setupMinutes: 0, speedMultiplier: 1 },
        { capacity: 1, dailyHours: 8, machineId: "machine-2", operationName: "Pack", processTimeMinutes: 1, setupMinutes: 0, speedMultiplier: 1 },
      ],
      productId: "product-1",
      targetQuantity: 10,
    },
    product_id: "product-1",
  }, {
    ...workspace,
    machines: [
      ...workspace.machines,
      { availability_hours: 8, concurrent_capacity: 1, hourly_energy_consumption_kwh: 1, id: "machine-2", name: "Packer", price: 50000, speed_multiplier: 1 },
    ],
  });

  assert.equal(result.producedQuantity, 10);
  assert.equal(result.transferBatchSize, 5);
  assert.equal(result.totalProductionTimeMinutes, 25);
  assert.equal(result.bottleneck.operationName, "Puree");
  assert.equal(result.maxWipQuantity, 5);
  assert.equal(result.optimization.recommendedBatchSize, 1);
  assert.equal(result.materialCost, 450);
  assert.equal(result.machineRows.length, 2);
});

test("batch strategy waits for the full quantity before the next operation starts", () => {
  const result = calculateCurrentPlanResult({
    input: {
      batchSize: 2,
      flowStrategy: "batch",
      minimumTransferQuantity: 1,
      operationRows: [
        { capacity: 2, dailyHours: 8, machineId: "machine-1", operationName: "Puree", processTimeMinutes: 2, setupMinutes: 0, speedMultiplier: 1 },
        { capacity: 1, dailyHours: 8, machineId: "machine-2", operationName: "Pack", processTimeMinutes: 1, setupMinutes: 0, speedMultiplier: 1 },
      ],
      productId: "product-1",
      targetQuantity: 4,
    },
    product_id: "product-1",
  }, {
    ...workspace,
    machines: [
      ...workspace.machines,
      { availability_hours: 8, concurrent_capacity: 1, hourly_energy_consumption_kwh: 1, id: "machine-2", name: "Packer", price: 50000, speed_multiplier: 1 },
    ],
  });

  assert.equal(result.transferBatchSize, 4);
  assert.equal(result.batchCount, 1);
  assert.equal(result.operationRows[0].finishMinutes, 4);
  assert.equal(result.operationRows[1].startMinutes, 4);
  assert.equal(result.totalProductionTimeMinutes, 8);
  assert.equal(result.maxWipQuantity, 4);
});

test("parallel simulation uses product-level events and honors machine capacity", () => {
  const result = calculateCurrentPlanResult({
    input: {
      batchSize: 4,
      flowStrategy: "parallel",
      minimumTransferQuantity: 4,
      operationRows: [
        { capacity: 2, dailyHours: 8, machineId: "machine-1", operationName: "Puree", processTimeMinutes: 2, setupMinutes: 0, speedMultiplier: 1 },
        { capacity: 1, dailyHours: 8, machineId: "machine-2", operationName: "Pack", processTimeMinutes: 1, setupMinutes: 0, speedMultiplier: 1 },
      ],
      productId: "product-1",
      targetQuantity: 4,
    },
    product_id: "product-1",
  }, {
    ...workspace,
    machines: [
      ...workspace.machines,
      { availability_hours: 8, concurrent_capacity: 1, hourly_energy_consumption_kwh: 1, id: "machine-2", name: "Packer", price: 50000, speed_multiplier: 1 },
    ],
  });

  assert.equal(result.transferBatchSize, 1);
  assert.equal(result.batchCount, 4);
  assert.equal(result.operationRows[0].finishMinutes, 4);
  assert.equal(result.totalProductionTimeMinutes, 6);
  assert.equal(result.maxWipQuantity, 2);
});

test("uses product transfer defaults when a plan omits flow settings", () => {
  const result = calculateCurrentPlanResult({
    input: {
      operationRows: [
        { capacity: 1, dailyHours: 8, machineId: "machine-1", operationName: "Puree", processTimeMinutes: 2, setupMinutes: 0, speedMultiplier: 1 },
        { capacity: 1, dailyHours: 8, machineId: "machine-2", operationName: "Pack", processTimeMinutes: 1, setupMinutes: 0, speedMultiplier: 1 },
      ],
      productId: "product-1",
      targetQuantity: 6,
    },
    product_id: "product-1",
  }, {
    ...workspace,
    machines: [
      ...workspace.machines,
      { availability_hours: 8, concurrent_capacity: 1, hourly_energy_consumption_kwh: 1, id: "machine-2", name: "Packer", price: 50000, speed_multiplier: 1 },
    ],
    products: [
      {
        ...workspace.products[0],
        default_batch_size: 3,
        default_flow_strategy: "flow",
        minimum_transfer_quantity: 3,
      },
    ],
  });

  assert.equal(result.flowStrategy, "flow");
  assert.equal(result.minimumTransferQuantity, 3);
  assert.equal(result.transferBatchSize, 3);
  assert.equal(result.batchCount, 2);
});
