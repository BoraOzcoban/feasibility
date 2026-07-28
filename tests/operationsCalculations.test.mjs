import assert from "node:assert/strict";
import test from "node:test";
import { calculateCurrentPlanResult, getCurrentOperationPlans, hasViablePlanResult } from "../src/lib/operationsCalculations.js";

const workspace = {
  machines: [
    { hourly_energy_consumption_kwh: 2, id: "machine-1", name: "Press", price: 100000 },
  ],
  materials: [
    { id: "material-1", material_group: "Metal", name: "Steel", price_per_unit: 15, unit: "kg" },
  ],
  products: [
    {
      cycle_time_minutes: 2,
      id: "product-1",
      material_rows: [
        { material: { id: "material-1", material_group: "Metal", name: "Steel", price_per_unit: 15, unit: "kg" }, material_id: "material-1", quantity_per_unit: 3 },
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
  assert.equal(result.materialRows[0].materialGroup, "Metal");
  assert.equal("materialCost" in result, false);
  assert.equal("workforceCost" in result, false);
  assert.equal("totalTrackedDailyCost" in result, false);
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

test("pull starts from downstream demand and creates enough safety stock to eliminate material starvation", () => {
  const result = calculateCurrentPlanResult({
    input: {
      batchSize: 5,
      flowStrategy: "pull",
      inventoryCostPerUnitHour: 2,
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
  assert.equal(result.flowStrategy, "pull");
  assert.equal(result.transferBatchSize, 5);
  assert.equal(result.totalProductionTimeMinutes, 20);
  assert.equal(result.bottleneck.operationName, "Puree");
  assert.equal(result.safetyStockEnabled, true);
  assert.equal(result.safetyStockQuantity, 10);
  assert.equal(result.totalSafetyStockQuantity, 10);
  assert.equal(result.stockoutWaitTimeHours, 0);
  assert.equal(result.maxWipQuantity, 10);
  assert.equal(result.bufferRows[0].requiredSafetyStockQuantity, 10);
  assert.equal(result.inventoryCost, 2.5);
  assert.equal(result.optimization.recommendedBatchSize, 10);
  assert.equal(result.machineRows.length, 2);
});

test("uses product-process speed instead of a machine-wide speed", () => {
  const result = calculateCurrentPlanResult({
    input: {
      batchSize: 10,
      flowStrategy: "pull",
      operationRows: [
        { capacity: 1, dailyHours: 8, machineId: "machine-1", operationName: "Slow product", processTimeMinutes: 2, setupMinutes: 0 },
        { capacity: 1, dailyHours: 8, machineId: "machine-2", operationName: "Fast product", processTimeMinutes: 2, setupMinutes: 0, speedMultiplier: 2 },
      ],
      productId: "product-1",
      targetQuantity: 10,
    },
    product_id: "product-1",
  }, {
    ...workspace,
    machines: [
      { ...workspace.machines[0], speed_multiplier: 10 },
      { availability_hours: 8, concurrent_capacity: 1, id: "machine-2", name: "Packer", speed_multiplier: 10 },
    ],
  }, { optimize: false });

  assert.equal(result.operationRows[0].busyMinutes, 20);
  assert.equal(result.operationRows[1].busyMinutes, 10);
});

test("push sends the planned quantity forward without safety stock and can wait for inventory", () => {
  const result = calculateCurrentPlanResult({
    input: {
      batchSize: 2,
      flowStrategy: "push",
      minimumTransferQuantity: 1,
      safetyStockQuantity: 99,
      waitingCostPerHour: 60,
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
  assert.equal(result.flowStrategy, "push");
  assert.equal(result.operationRows[0].finishMinutes, 4);
  assert.equal(result.operationRows[1].startMinutes, 4);
  assert.equal(result.totalProductionTimeMinutes, 8);
  assert.equal(result.safetyStockEnabled, false);
  assert.equal(result.safetyStockQuantity, 0);
  assert.equal(result.totalSafetyStockQuantity, 0);
  assert.equal(result.stockoutWaitTimeHours, 4 / 60);
  assert.equal(result.waitingCost, 4);
  assert.equal(result.inventoryCost, 0);
  assert.equal(result.optimization, null);
  assert.equal(result.maxWipQuantity, 4);
});

test("legacy parallel plans migrate to pull semantics", () => {
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

  assert.equal(result.flowStrategy, "pull");
  assert.equal(result.transferBatchSize, 4);
  assert.equal(result.batchCount, 1);
  assert.equal(result.operationRows[0].finishMinutes, 4);
  assert.equal(result.totalProductionTimeMinutes, 4);
  assert.equal(result.safetyStockQuantity, 4);
  assert.equal(result.stockoutWaitTimeHours, 0);
});

test("uses product Pull and safety stock defaults when a plan omits flow settings", () => {
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
        default_flow_strategy: "pull",
        default_safety_stock_quantity: 8,
        minimum_transfer_quantity: 3,
      },
    ],
  });

  assert.equal(result.flowStrategy, "pull");
  assert.equal(result.minimumTransferQuantity, 3);
  assert.equal(result.transferBatchSize, 3);
  assert.equal(result.batchCount, 2);
  assert.equal(result.minimumSafetyStockQuantity, 8);
  assert.equal(result.safetyStockQuantity, 8);
});

test("legacy batch plans migrate to Push and ignore configured safety stock", () => {
  const result = calculateCurrentPlanResult({
    input: {
      flowStrategy: "batch",
      operationRows: [
        { capacity: 1, dailyHours: 8, machineId: "machine-1", operationName: "Puree", processTimeMinutes: 1 },
        { capacity: 1, dailyHours: 8, machineId: "machine-2", operationName: "Pack", processTimeMinutes: 1 },
      ],
      productId: "product-1",
      safetyStockQuantity: 50,
      targetQuantity: 5,
    },
    product_id: "product-1",
  }, {
    ...workspace,
    machines: [
      ...workspace.machines,
      { availability_hours: 8, concurrent_capacity: 1, hourly_energy_consumption_kwh: 1, id: "machine-2", name: "Packer", price: 50000, speed_multiplier: 1 },
    ],
  });

  assert.equal(result.flowStrategy, "push");
  assert.equal(result.safetyStockQuantity, 0);
  assert.equal(result.operationRows[1].startMinutes, 5);
});
