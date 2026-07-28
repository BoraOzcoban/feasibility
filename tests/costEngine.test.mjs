import assert from "node:assert/strict";
import test from "node:test";
import {
  CostValidationError,
  calculateCompressionSetCost,
  calculateInjectionCost,
  calculatePostCuringCost,
  calculateRoughDeflashingCost,
  calculateTotalProductionCost,
} from "../src/lib/costEngine.js";
import {
  excelOperationCostRegressionInput,
  expectedExcelOperationCosts,
} from "../src/lib/costEngineRegressionFixture.js";

const tolerance = 1e-9;
const closeTo = (actual, expected) => {
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

function cloneRegressionInput() {
  return structuredClone(excelOperationCostRegressionInput);
}

test("reproduces the Excel operation-cost regression totals", () => {
  const result = calculateTotalProductionCost(cloneRegressionInput());

  closeTo(result.operations.injection.unitCostEur, expectedExcelOperationCosts.injection);
  closeTo(
    result.operations.roughDeflashing.unitCostEur,
    expectedExcelOperationCosts.roughDeflashing,
  );
  closeTo(
    result.operations.nitrogenDeflashing.unitCostEur,
    expectedExcelOperationCosts.nitrogenDeflashing,
  );
  closeTo(result.operations.postCuring.unitCostEur, expectedExcelOperationCosts.postCuring);
  closeTo(result.operations.washing.unitCostEur, expectedExcelOperationCosts.washing);
  closeTo(
    result.operations.compressionSet.unitCostEur,
    expectedExcelOperationCosts.compressionSet,
  );
  closeTo(result.totalUnitCostEur, expectedExcelOperationCosts.totalUnitCost);
  closeTo(result.totalOrderCostEur, expectedExcelOperationCosts.totalOrderCost);
  closeTo(result.totalOrderCostEur, result.totalUnitCostEur * result.orderQuantity);
});

test("calculates batch electricity, labor, depreciation, and maintenance independently", () => {
  const result = calculateRoughDeflashingCost({
    annualMaintenanceCostEur: 360,
    electricityPriceTryPerKwh: 4,
    employeeCount: 2,
    employeeGroup: "Mühendis",
    loadingUnloadingSeconds: 20,
    machinePowerKw: 9,
    machineProcessingSeconds: 40,
    machinePurchasePriceEur: 100_000,
    moldCavityCount: 5,
    monthlyEmployeeCostTry: 81_000,
    operatingDaysPerYear: 200,
    operatingHoursPerDay: 10,
    orderQuantity: 10_000,
    processedClusterCount: 4,
    tryPerEur: 40,
    usefulLifeYears: 5,
  });

  const piecesPerOperation = 20;
  const totalCycleSeconds = 60;
  const annualOperatingSeconds = 200 * 10 * 3600;
  closeTo(result.breakdown.electricity, 60 * (4 / 3600) * 9 / 40 / piecesPerOperation);
  closeTo(
    result.breakdown.labor,
    60 * (81_000 / 225 / 3600) / piecesPerOperation / 40 * 1.5 * 2,
  );
  closeTo(
    result.breakdown.depreciation,
    (10_000 / piecesPerOperation) * 60 * 100_000 /
      (5 * annualOperatingSeconds) /
      10_000,
  );
  closeTo(
    result.breakdown.maintenance,
    360 / (annualOperatingSeconds / totalCycleSeconds * piecesPerOperation),
  );
  closeTo(result.unitCycleTimeSeconds, totalCycleSeconds / piecesPerOperation);
  closeTo(result.orderCostEur, result.unitCostEur * 10_000);
});

test("converts injection weights from grams to kilograms and adds mold purchase only when required", () => {
  const input = {
    annualMachineMaintenanceCostEur: 0,
    annualMoldMaintenanceCostEur: 0,
    dailyPreparationSeconds: 0,
    dailyRunnerWasteGrams: 1_000,
    electricityPriceTryPerKwh: 0,
    employeeCount: 0,
    employeeGroup: "Operatör",
    injectionCycleSeconds: 10,
    machinePowerKw: 0,
    machinePurchasePriceEur: 0,
    moldCavityCount: 10,
    moldPurchasePriceEur: 1_000,
    moldPurchaseRequired: true,
    monthlyEmployeeCostTry: 0,
    operatingDaysPerYear: 200,
    operatingHoursPerDay: 10,
    orderQuantity: 1_000,
    rawMaterialPriceEurPerKg: 10,
    simultaneousMachineCount: 1,
    totalGrossShotWeightGrams: 100,
    tryPerEur: 40,
    usefulLifeYears: 5,
  };
  const result = calculateInjectionCost(input);
  const dailyShotCount = (10.5 * 3600) / 10;
  const requiredProductionDays = (1_000 / 10) / dailyShotCount;
  const expectedMaterial =
    10 * (100 / 10) / 1_000 +
    10 * (1_000 * requiredProductionDays) / 1_000 / 1_000;

  closeTo(result.breakdown.material, expectedMaterial);
  closeTo(result.breakdown.mold, 1);

  const withoutMoldPurchase = calculateInjectionCost({
    ...input,
    moldPurchaseRequired: false,
  });
  closeTo(withoutMoldPurchase.breakdown.mold, 0);
});

test("post-curing maintenance uses annual maintenance rather than machine purchase price", () => {
  const result = calculatePostCuringCost({
    annualMaintenanceCostEur: 0,
    electricityPriceTryPerKwh: 0,
    employeeCount: 0,
    employeeGroup: "Operatör",
    grossWeightMultiplier: 1.2,
    loadingUnloadingSeconds: 10,
    machinePowerKw: 0,
    machineProcessingSeconds: 50,
    machinePurchasePriceEur: 900_000,
    monthlyEmployeeCostTry: 0,
    netWeightPerUnitGrams: 10,
    operatingDaysPerYear: 200,
    operatingHoursPerDay: 10,
    orderQuantity: 10_000,
    totalProcessedWeightGrams: 1_000,
    tryPerEur: 40,
    usefulLifeYears: 5,
  });

  closeTo(result.breakdown.maintenance, 0);
  assert.ok(result.breakdown.depreciation > 0);
});

test("keeps compression-set waiting time out of labor and main production lead time", () => {
  const input = cloneRegressionInput();
  input.compressionSet.loadingUnloadingSeconds = 10;
  input.compressionSet.machineProcessingSeconds = 10_000;
  input.compressionSet.resultReviewSeconds = 20;
  input.compressionSet.employeeCount = 1;
  input.compressionSet.monthlyEmployeeCostTry = 81_000;
  input.compressionSet.tryPerEur = 40;
  input.compressionSet.repeatCount = 2;

  const operation = calculateCompressionSetCost({
    ...input.common,
    ...input.compressionSet,
    orderQuantity: input.orderQuantity,
  });
  const total = calculateTotalProductionCost(input);
  const expectedLaborSeconds = 30;

  closeTo(
    operation.breakdown.labor,
    expectedLaborSeconds * (81_000 / 225 / 3600) / 5_000_000 / 40,
  );
  assert.equal(operation.intermediateValues.qualityControlTimeSeconds, 20_020);
  assert.equal(total.qualityControlTimeSeconds, 20_020);
  assert.ok(total.productionLeadTimeSeconds < total.qualityControlTimeSeconds);
});

test("rejects invalid divisors and unknown employee groups before calculation", () => {
  const invalidCases = [
    ["orderQuantity", (input) => { input.orderQuantity = 0; }],
    ["moldCavityCount", (input) => { input.injection.moldCavityCount = 0; }],
    ["tryPerEur", (input) => { input.common.tryPerEur = 0; }],
    ["injectionCycleSeconds", (input) => { input.injection.injectionCycleSeconds = 0; }],
    ["totalProcessedWeightGrams", (input) => {
      input.nitrogenDeflashing.totalProcessedWeightGrams = 0;
    }],
    ["netWeightPerUnitGrams", (input) => { input.washing.netWeightPerUnitGrams = 0; }],
    ["simultaneousMachineCount", (input) => {
      input.injection.simultaneousMachineCount = 0;
    }],
    ["usefulLifeYears", (input) => { input.postCuring.usefulLifeYears = 0; }],
    ["employeeGroup", (input) => { input.roughDeflashing.employeeGroup = "Uzman"; }],
  ];

  invalidCases.forEach(([field, mutate]) => {
    const input = cloneRegressionInput();
    mutate(input);
    assert.throws(
      () => calculateTotalProductionCost(input),
      (error) => error instanceof CostValidationError && error.field === field,
    );
  });
});

test("never returns NaN or Infinity for a valid model", () => {
  const result = calculateTotalProductionCost(cloneRegressionInput());
  const numericValues = [
    result.totalUnitCostEur,
    result.totalOrderCostEur,
    result.productionLeadTimeSeconds,
    result.qualityControlTimeSeconds,
    ...Object.values(result.operations).flatMap((operation) => [
      operation.unitCostEur,
      operation.orderCostEur,
      operation.unitCycleTimeSeconds,
      ...Object.values(operation.breakdown),
      ...Object.values(operation.intermediateValues),
    ]),
  ];

  assert.equal(numericValues.every(Number.isFinite), true);
});
