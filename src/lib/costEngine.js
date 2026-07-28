export const employeeCostCoefficients = Object.freeze({
  Operatör: 1,
  Mühendis: 1.5,
  Usta: 2,
  Çırak: 0.8,
});

export class CostValidationError extends Error {
  constructor(field, message) {
    super(`${field}: ${message}`);
    this.name = "CostValidationError";
    this.field = field;
  }
}

/**
 * @typedef {Object} OperationCostResult
 * @property {number} unitCostEur
 * @property {number} orderCostEur
 * @property {number} unitCycleTimeSeconds
 * @property {number} [operationCount]
 * @property {number} [piecesPerOperation]
 * @property {Record<string, number>} breakdown
 * @property {Record<string, number>} intermediateValues
 */

const BREAKDOWN_KEYS = [
  "material",
  "consumables",
  "labor",
  "electricity",
  "depreciation",
  "maintenance",
  "mold",
];

function numberValue(input, field) {
  const value = Number(input?.[field]);
  if (!Number.isFinite(value)) {
    throw new CostValidationError(field, "sonlu bir sayı olmalıdır.");
  }
  return value;
}

function positive(input, field) {
  const value = numberValue(input, field);
  if (value <= 0) {
    throw new CostValidationError(field, "sıfırdan büyük olmalıdır.");
  }
  return value;
}

function nonNegative(input, field) {
  const value = numberValue(input, field);
  if (value < 0) {
    throw new CostValidationError(field, "negatif olamaz.");
  }
  return value;
}

function employeeCoefficient(input) {
  const group = String(input?.employeeGroup || "");
  if (!Object.prototype.hasOwnProperty.call(employeeCostCoefficients, group)) {
    throw new CostValidationError(
      "employeeGroup",
      `tanınmayan çalışan grubu "${group || "(boş)"}".`,
    );
  }
  return employeeCostCoefficients[group];
}

function commonValues(input) {
  const orderQuantity = positive(input, "orderQuantity");
  const tryPerEur = positive(input, "tryPerEur");
  const monthlyEmployeeCostTry = nonNegative(input, "monthlyEmployeeCostTry");
  const electricityPriceTryPerKwh = nonNegative(input, "electricityPriceTryPerKwh");
  const employeeCount = nonNegative(input, "employeeCount");
  const coefficient = employeeCoefficient(input);
  const usefulLifeYears = positive(input, "usefulLifeYears");
  const operatingHoursPerDay = positive(input, "operatingHoursPerDay");
  const operatingDaysPerYear = positive(input, "operatingDaysPerYear");
  const annualOperatingSeconds = operatingHoursPerDay * operatingDaysPerYear * 3600;
  const machineUsefulLifeSeconds = usefulLifeYears * annualOperatingSeconds;

  return {
    annualOperatingSeconds,
    electricityCostTryPerKwSecond: electricityPriceTryPerKwh / 3600,
    employeeCoefficient: coefficient,
    employeeCount,
    laborCostTryPerSecond: monthlyEmployeeCostTry / 225 / 3600,
    machineUsefulLifeSeconds,
    operatingDaysPerYear,
    operatingHoursPerDay,
    orderQuantity,
    tryPerEur,
    usefulLifeYears,
  };
}

function batchMachineCosts(input, common, totalCycleSeconds, piecesPerOperation) {
  const machinePowerKw = nonNegative(input, "machinePowerKw");
  const machinePurchasePriceEur = nonNegative(input, "machinePurchasePriceEur");
  const annualMaintenanceCostEur = nonNegative(input, "annualMaintenanceCostEur");
  const requiredOperationCount = common.orderQuantity / piecesPerOperation;
  const annualProductionCapacity =
    common.annualOperatingSeconds / totalCycleSeconds * piecesPerOperation;
  const electricityCostPerUnitEur =
    totalCycleSeconds *
    common.electricityCostTryPerKwSecond *
    machinePowerKw /
    common.tryPerEur /
    piecesPerOperation;
  const laborCostPerUnitEur =
    totalCycleSeconds *
    common.laborCostTryPerSecond /
    piecesPerOperation /
    common.tryPerEur *
    common.employeeCoefficient *
    common.employeeCount;
  const depreciationCostPerUnitEur =
    requiredOperationCount *
    totalCycleSeconds *
    machinePurchasePriceEur /
    common.machineUsefulLifeSeconds /
    common.orderQuantity;
  const maintenanceCostPerUnitEur =
    annualMaintenanceCostEur / annualProductionCapacity;

  return {
    annualProductionCapacity,
    depreciationCostPerUnitEur,
    electricityCostPerUnitEur,
    laborCostPerUnitEur,
    maintenanceCostPerUnitEur,
    requiredOperationCount,
  };
}

function completeBreakdown(partial = {}) {
  return Object.fromEntries(BREAKDOWN_KEYS.map((key) => [key, Number(partial[key]) || 0]));
}

function result(input, unitCycleTimeSeconds, breakdown, intermediateValues, extras = {}) {
  const safeBreakdown = completeBreakdown(breakdown);
  const unitCostEur = Object.values(safeBreakdown).reduce((total, value) => total + value, 0);
  const orderQuantity = positive(input, "orderQuantity");
  const values = {
    unitCostEur,
    orderCostEur: unitCostEur * orderQuantity,
    unitCycleTimeSeconds,
    breakdown: safeBreakdown,
    intermediateValues,
    ...extras,
  };

  Object.entries({
    unitCostEur: values.unitCostEur,
    orderCostEur: values.orderCostEur,
    unitCycleTimeSeconds: values.unitCycleTimeSeconds,
    ...values.intermediateValues,
  }).forEach(([field, value]) => {
    if (!Number.isFinite(value)) {
      throw new CostValidationError(field, "hesaplama sonlu bir sonuç üretmedi.");
    }
  });

  return values;
}

export function calculateInjectionCost(input) {
  const common = commonValues(input);
  const dailyAvailableSeconds = 10.5 * 3600;
  const dailyPreparationSeconds = nonNegative(input, "dailyPreparationSeconds");
  const injectionCycleSeconds = positive(input, "injectionCycleSeconds");
  const moldCavityCount = positive(input, "moldCavityCount");
  const simultaneousMachineCount = positive(input, "simultaneousMachineCount");
  const totalGrossShotWeightGrams = positive(input, "totalGrossShotWeightGrams");
  const dailyRunnerWasteGrams = nonNegative(input, "dailyRunnerWasteGrams");
  const rawMaterialPriceEurPerKg = nonNegative(input, "rawMaterialPriceEurPerKg");
  const moldPurchasePriceEur = nonNegative(input, "moldPurchasePriceEur");
  const machinePowerKw = nonNegative(input, "machinePowerKw");
  const machinePurchasePriceEur = nonNegative(input, "machinePurchasePriceEur");
  const annualMachineMaintenanceCostEur = nonNegative(input, "annualMachineMaintenanceCostEur");
  const annualMoldMaintenanceCostEur = nonNegative(input, "annualMoldMaintenanceCostEur");

  if (dailyPreparationSeconds >= dailyAvailableSeconds) {
    throw new CostValidationError(
      "dailyPreparationSeconds",
      "günlük kullanılabilir süreden küçük olmalıdır.",
    );
  }

  const dailyShotCount =
    (dailyAvailableSeconds - dailyPreparationSeconds) / injectionCycleSeconds;
  const requiredShotCount = common.orderQuantity / moldCavityCount;
  const requiredProductionDays =
    requiredShotCount / dailyShotCount / simultaneousMachineCount;
  const preparationSecondsPerShot = dailyPreparationSeconds / dailyShotCount;
  const adjustedCycleSeconds = injectionCycleSeconds + preparationSecondsPerShot;
  const grossWeightPerUnitGrams = totalGrossShotWeightGrams / moldCavityCount;
  const totalRunnerWasteGrams = dailyRunnerWasteGrams * requiredProductionDays;
  const moldPurchaseCostPerUnit = moldPurchasePriceEur / common.orderQuantity;
  const materialCostPerUnitEur =
    rawMaterialPriceEurPerKg * grossWeightPerUnitGrams / 1000 +
    rawMaterialPriceEurPerKg * totalRunnerWasteGrams / 1000 / common.orderQuantity;
  const laborCostPerUnitEur =
    adjustedCycleSeconds *
    common.laborCostTryPerSecond /
    moldCavityCount /
    common.tryPerEur *
    common.employeeCoefficient *
    common.employeeCount;
  const electricityCostPerUnitEur =
    adjustedCycleSeconds *
    common.electricityCostTryPerKwSecond *
    machinePowerKw /
    moldCavityCount /
    common.tryPerEur;
  const depreciationCostPerUnitEur =
    requiredShotCount *
    adjustedCycleSeconds *
    machinePurchasePriceEur /
    common.machineUsefulLifeSeconds /
    common.orderQuantity;
  const annualProductionCapacity =
    common.annualOperatingSeconds / adjustedCycleSeconds * moldCavityCount;
  const machineMaintenanceCostPerUnitEur =
    annualMachineMaintenanceCostEur / annualProductionCapacity;
  const annualMoldProductionCapacity =
    common.annualOperatingSeconds / injectionCycleSeconds * moldCavityCount;
  const moldMaintenanceCostPerUnitEur =
    annualMoldMaintenanceCostEur / annualMoldProductionCapacity;
  const includedMoldPurchaseCostPerUnitEur = input.moldPurchaseRequired
    ? moldPurchaseCostPerUnit
    : 0;

  return result(
    input,
    adjustedCycleSeconds / moldCavityCount,
    {
      material: materialCostPerUnitEur,
      labor: laborCostPerUnitEur,
      electricity: electricityCostPerUnitEur,
      depreciation: depreciationCostPerUnitEur,
      maintenance: machineMaintenanceCostPerUnitEur,
      mold: moldMaintenanceCostPerUnitEur + includedMoldPurchaseCostPerUnitEur,
    },
    {
      adjustedCycleSeconds,
      annualMoldProductionCapacity,
      annualOperatingSeconds: common.annualOperatingSeconds,
      annualProductionCapacity,
      dailyAvailableSeconds,
      dailyShotCount,
      grossWeightPerUnitGrams,
      laborCostTryPerSecond: common.laborCostTryPerSecond,
      electricityCostTryPerKwSecond: common.electricityCostTryPerKwSecond,
      machineUsefulLifeSeconds: common.machineUsefulLifeSeconds,
      moldMaintenanceCostPerUnitEur,
      moldPurchaseCostPerUnit,
      preparationSecondsPerShot,
      requiredProductionDays,
      requiredShotCount,
      totalRunnerWasteGrams,
    },
    {
      operationCount: requiredShotCount,
      piecesPerOperation: moldCavityCount,
    },
  );
}

export function calculateRoughDeflashingCost(input) {
  const common = commonValues(input);
  const processedClusterCount = positive(input, "processedClusterCount");
  const moldCavityCount = positive(input, "moldCavityCount");
  const loadingUnloadingSeconds = nonNegative(input, "loadingUnloadingSeconds");
  const machineProcessingSeconds = nonNegative(input, "machineProcessingSeconds");
  const piecesPerOperation = processedClusterCount * moldCavityCount;
  const totalCycleSeconds = loadingUnloadingSeconds + machineProcessingSeconds;
  if (totalCycleSeconds <= 0) {
    throw new CostValidationError("totalCycleSeconds", "sıfırdan büyük olmalıdır.");
  }
  const machineCosts = batchMachineCosts(input, common, totalCycleSeconds, piecesPerOperation);

  return result(
    input,
    totalCycleSeconds / piecesPerOperation,
    {
      electricity: machineCosts.electricityCostPerUnitEur,
      labor: machineCosts.laborCostPerUnitEur,
      depreciation: machineCosts.depreciationCostPerUnitEur,
      maintenance: machineCosts.maintenanceCostPerUnitEur,
    },
    {
      annualOperatingSeconds: common.annualOperatingSeconds,
      annualProductionCapacity: machineCosts.annualProductionCapacity,
      electricityCostTryPerKwSecond: common.electricityCostTryPerKwSecond,
      laborCostTryPerSecond: common.laborCostTryPerSecond,
      machineUsefulLifeSeconds: common.machineUsefulLifeSeconds,
      requiredOperationCount: machineCosts.requiredOperationCount,
      totalCycleSeconds,
    },
    {
      operationCount: machineCosts.requiredOperationCount,
      piecesPerOperation,
    },
  );
}

export function calculateNitrogenDeflashingCost(input) {
  const common = commonValues(input);
  const netWeightPerUnitGrams = positive(input, "netWeightPerUnitGrams");
  const grossWeightMultiplier = positive(input, "grossWeightMultiplier");
  const totalProcessedWeightGrams = positive(input, "totalProcessedWeightGrams");
  const benchCoolingSeconds = nonNegative(input, "benchCoolingSeconds");
  const machineProcessingSeconds = nonNegative(input, "machineProcessingSeconds");
  const loadingUnloadingSeconds = nonNegative(input, "loadingUnloadingSeconds");
  const startupCoolingSeconds = nonNegative(input, "startupCoolingSeconds");
  const operationsPerDay = positive(input, "operationsPerDay");
  const tankCapacityLiters = nonNegative(input, "tankCapacityLiters");
  const nitrogenUsagePercentage = nonNegative(input, "nitrogenUsagePercentage");
  const nitrogenPriceTryPerLiter = nonNegative(input, "nitrogenPriceTryPerLiter");
  const stoneConsumptionKgPerReferencePeriod =
    nonNegative(input, "stoneConsumptionKgPerReferencePeriod");
  const stoneConsumptionReferenceSeconds =
    positive(input, "stoneConsumptionReferenceSeconds");
  const stonePriceTryPerKg = nonNegative(input, "stonePriceTryPerKg");
  const grossWeightPerUnitGrams = netWeightPerUnitGrams * grossWeightMultiplier;
  const totalCycleSeconds =
    benchCoolingSeconds +
    machineProcessingSeconds +
    loadingUnloadingSeconds +
    startupCoolingSeconds / operationsPerDay;
  if (totalCycleSeconds <= 0) {
    throw new CostValidationError("totalCycleSeconds", "sıfırdan büyük olmalıdır.");
  }
  const piecesPerOperation = totalProcessedWeightGrams / grossWeightPerUnitGrams;
  const machineCosts = batchMachineCosts(input, common, totalCycleSeconds, piecesPerOperation);
  const nitrogenLitersPerOperation = tankCapacityLiters * nitrogenUsagePercentage;
  const nitrogenLitersPerUnit = nitrogenLitersPerOperation / piecesPerOperation;
  const nitrogenCostPerUnitEur =
    nitrogenLitersPerUnit * nitrogenPriceTryPerLiter / common.tryPerEur;
  const stoneKgPerOperation =
    stoneConsumptionKgPerReferencePeriod *
    totalCycleSeconds /
    stoneConsumptionReferenceSeconds;
  const stoneKgPerUnit = stoneKgPerOperation / piecesPerOperation;
  const stoneCostPerUnitEur =
    stoneKgPerUnit * stonePriceTryPerKg / common.tryPerEur;

  return result(
    input,
    totalCycleSeconds / piecesPerOperation,
    {
      consumables: nitrogenCostPerUnitEur + stoneCostPerUnitEur,
      labor: machineCosts.laborCostPerUnitEur,
      electricity: machineCosts.electricityCostPerUnitEur,
      depreciation: machineCosts.depreciationCostPerUnitEur,
      maintenance: machineCosts.maintenanceCostPerUnitEur,
    },
    {
      annualOperatingSeconds: common.annualOperatingSeconds,
      annualProductionCapacity: machineCosts.annualProductionCapacity,
      electricityCostTryPerKwSecond: common.electricityCostTryPerKwSecond,
      grossWeightPerUnitGrams,
      laborCostTryPerSecond: common.laborCostTryPerSecond,
      machineUsefulLifeSeconds: common.machineUsefulLifeSeconds,
      nitrogenCostPerUnitEur,
      nitrogenLitersPerOperation,
      nitrogenLitersPerUnit,
      requiredOperationCount: machineCosts.requiredOperationCount,
      stoneCostPerUnitEur,
      stoneKgPerOperation,
      stoneKgPerUnit,
      totalCycleSeconds,
    },
    {
      operationCount: machineCosts.requiredOperationCount,
      piecesPerOperation,
    },
  );
}

export function calculatePostCuringCost(input) {
  const common = commonValues(input);
  const netWeightPerUnitGrams = positive(input, "netWeightPerUnitGrams");
  const grossWeightMultiplier = positive(input, "grossWeightMultiplier");
  const totalProcessedWeightGrams = positive(input, "totalProcessedWeightGrams");
  const loadingUnloadingSeconds = nonNegative(input, "loadingUnloadingSeconds");
  const machineProcessingSeconds = nonNegative(input, "machineProcessingSeconds");
  const piecesPerOperation = totalProcessedWeightGrams / netWeightPerUnitGrams;
  const totalCycleSeconds = loadingUnloadingSeconds + machineProcessingSeconds;
  if (totalCycleSeconds <= 0) {
    throw new CostValidationError("totalCycleSeconds", "sıfırdan büyük olmalıdır.");
  }
  const machineCosts = batchMachineCosts(input, common, totalCycleSeconds, piecesPerOperation);

  return result(
    input,
    totalCycleSeconds / piecesPerOperation,
    {
      electricity: machineCosts.electricityCostPerUnitEur,
      labor: machineCosts.laborCostPerUnitEur,
      depreciation: machineCosts.depreciationCostPerUnitEur,
      maintenance: machineCosts.maintenanceCostPerUnitEur,
    },
    {
      annualOperatingSeconds: common.annualOperatingSeconds,
      annualProductionCapacity: machineCosts.annualProductionCapacity,
      electricityCostTryPerKwSecond: common.electricityCostTryPerKwSecond,
      grossWeightPerUnitGrams: netWeightPerUnitGrams * grossWeightMultiplier,
      laborCostTryPerSecond: common.laborCostTryPerSecond,
      machineUsefulLifeSeconds: common.machineUsefulLifeSeconds,
      requiredOperationCount: machineCosts.requiredOperationCount,
      totalCycleSeconds,
    },
    {
      operationCount: machineCosts.requiredOperationCount,
      piecesPerOperation,
    },
  );
}

export function calculateWashingCost(input) {
  const common = commonValues(input);
  const netWeightPerUnitGrams = positive(input, "netWeightPerUnitGrams");
  const totalProcessedWeightGrams = positive(input, "totalProcessedWeightGrams");
  const loadingUnloadingSeconds = nonNegative(input, "loadingUnloadingSeconds");
  const machineProcessingSeconds = nonNegative(input, "machineProcessingSeconds");
  const detergentReferenceCostEur = nonNegative(input, "detergentReferenceCostEur");
  const detergentReferenceDurationSeconds =
    positive(input, "detergentReferenceDurationSeconds");
  const piecesPerOperation = totalProcessedWeightGrams / netWeightPerUnitGrams;
  const totalCycleSeconds = loadingUnloadingSeconds + machineProcessingSeconds;
  if (totalCycleSeconds <= 0) {
    throw new CostValidationError("totalCycleSeconds", "sıfırdan büyük olmalıdır.");
  }
  const machineCosts = batchMachineCosts(input, common, totalCycleSeconds, piecesPerOperation);
  const detergentCostPerOperationEur =
    detergentReferenceCostEur *
    totalCycleSeconds /
    detergentReferenceDurationSeconds;
  const detergentCostPerUnitEur =
    detergentCostPerOperationEur / piecesPerOperation;

  return result(
    input,
    totalCycleSeconds / piecesPerOperation,
    {
      consumables: detergentCostPerUnitEur,
      electricity: machineCosts.electricityCostPerUnitEur,
      labor: machineCosts.laborCostPerUnitEur,
      depreciation: machineCosts.depreciationCostPerUnitEur,
      maintenance: machineCosts.maintenanceCostPerUnitEur,
    },
    {
      annualOperatingSeconds: common.annualOperatingSeconds,
      annualProductionCapacity: machineCosts.annualProductionCapacity,
      detergentCostPerOperationEur,
      detergentCostPerUnitEur,
      electricityCostTryPerKwSecond: common.electricityCostTryPerKwSecond,
      laborCostTryPerSecond: common.laborCostTryPerSecond,
      machineUsefulLifeSeconds: common.machineUsefulLifeSeconds,
      requiredOperationCount: machineCosts.requiredOperationCount,
      totalCycleSeconds,
    },
    {
      operationCount: machineCosts.requiredOperationCount,
      piecesPerOperation,
    },
  );
}

export function calculateCompressionSetCost(input) {
  const common = commonValues(input);
  const loadingUnloadingSeconds = nonNegative(input, "loadingUnloadingSeconds");
  const machineProcessingSeconds = nonNegative(input, "machineProcessingSeconds");
  const resultReviewSeconds = nonNegative(input, "resultReviewSeconds");
  const repeatCount = positive(input, "repeatCount");
  const machinePowerKw = nonNegative(input, "machinePowerKw");
  const machinePurchasePriceEur = nonNegative(input, "machinePurchasePriceEur");
  const annualMaintenanceCostEur = nonNegative(input, "annualMaintenanceCostEur");
  const totalCycleSeconds = loadingUnloadingSeconds + machineProcessingSeconds;
  if (totalCycleSeconds <= 0) {
    throw new CostValidationError("totalCycleSeconds", "sıfırdan büyük olmalıdır.");
  }
  const electricityCostPerUnitEur =
    totalCycleSeconds *
    repeatCount *
    common.electricityCostTryPerKwSecond *
    machinePowerKw /
    common.tryPerEur /
    common.orderQuantity;
  const laborSeconds = loadingUnloadingSeconds + resultReviewSeconds;
  const laborCostPerUnitEur =
    laborSeconds *
    common.laborCostTryPerSecond /
    common.orderQuantity /
    common.tryPerEur *
    common.employeeCount *
    common.employeeCoefficient;
  const depreciationCostPerUnitEur =
    repeatCount *
    totalCycleSeconds *
    machinePurchasePriceEur /
    common.machineUsefulLifeSeconds /
    common.orderQuantity;
  const maintenanceCostPerUnitEur =
    annualMaintenanceCostEur *
    repeatCount *
    totalCycleSeconds /
    common.annualOperatingSeconds /
    common.orderQuantity;

  return result(
    input,
    totalCycleSeconds * repeatCount / common.orderQuantity,
    {
      electricity: electricityCostPerUnitEur,
      labor: laborCostPerUnitEur,
      depreciation: depreciationCostPerUnitEur,
      maintenance: maintenanceCostPerUnitEur,
    },
    {
      annualOperatingSeconds: common.annualOperatingSeconds,
      electricityCostTryPerKwSecond: common.electricityCostTryPerKwSecond,
      laborCostTryPerSecond: common.laborCostTryPerSecond,
      laborSeconds,
      machineUsefulLifeSeconds: common.machineUsefulLifeSeconds,
      qualityControlTimeSeconds: totalCycleSeconds * repeatCount,
      totalCycleSeconds,
    },
    {
      operationCount: repeatCount,
      piecesPerOperation: common.orderQuantity,
    },
  );
}

export function calculateTotalProductionCost(input) {
  const orderQuantity = positive(input, "orderQuantity");
  const common = { ...(input.common || {}), orderQuantity };
  const operations = {
    injection: calculateInjectionCost({ ...common, ...(input.injection || {}) }),
    roughDeflashing: calculateRoughDeflashingCost({
      ...common,
      ...(input.roughDeflashing || {}),
    }),
    nitrogenDeflashing: calculateNitrogenDeflashingCost({
      ...common,
      ...(input.nitrogenDeflashing || {}),
    }),
    postCuring: calculatePostCuringCost({ ...common, ...(input.postCuring || {}) }),
    washing: calculateWashingCost({ ...common, ...(input.washing || {}) }),
    compressionSet: calculateCompressionSetCost({
      ...common,
      ...(input.compressionSet || {}),
    }),
  };
  const totalUnitCostEur = Object.values(operations)
    .reduce((total, operation) => total + operation.unitCostEur, 0);
  const totalOrderCostEur = totalUnitCostEur * orderQuantity;
  const productionLeadTimeSeconds = [
    operations.injection,
    operations.roughDeflashing,
    operations.nitrogenDeflashing,
    operations.postCuring,
    operations.washing,
  ].reduce((total, operation) => total + operation.unitCycleTimeSeconds, 0);
  const qualityControlTimeSeconds =
    operations.compressionSet.intermediateValues.qualityControlTimeSeconds;
  const breakdown = completeBreakdown();

  Object.values(operations).forEach((operation) => {
    BREAKDOWN_KEYS.forEach((key) => {
      breakdown[key] += operation.breakdown[key];
    });
  });

  return {
    assumptions: structuredClone(input),
    breakdown,
    operations,
    orderQuantity,
    productionLeadTimeSeconds,
    qualityControlTimeSeconds,
    totalOrderCostEur,
    totalUnitCostEur,
  };
}
