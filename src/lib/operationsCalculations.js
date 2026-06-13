export function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asObjectArray(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function getPlanProductId(plan = {}) {
  const safePlan = plan || {};
  return safePlan.product_id || safePlan.product?.id || safePlan.input?.productId || "";
}

function getRowsFromInputOrResult(plan = {}, inputKey, resultKey, mapper) {
  const safePlan = plan || {};
  const inputRows = asObjectArray(safePlan.input?.[inputKey]);
  if (inputRows.length) return inputRows;

  const resultRows = asObjectArray(safePlan.result?.[resultKey]);
  return resultRows.map(mapper);
}

export function calculateCurrentPlanResult(plan = {}, workspace = {}) {
  plan = plan || {};
  workspace = workspace || {};

  const products = Array.isArray(workspace.products) ? workspace.products : [];
  const machines = Array.isArray(workspace.machines) ? workspace.machines : [];
  const materials = Array.isArray(workspace.materials) ? workspace.materials : [];
  const workforce = Array.isArray(workspace.workforce) ? workspace.workforce : [];
  const productId = getPlanProductId(plan);
  const product = products.find((item) => item.id === productId) || plan.product || {};
  const machineRows = getRowsFromInputOrResult(plan, "machineRows", "machineRows", (row) => ({
    dailyHours: row.dailyHours,
    machineId: row.machineId,
  }));
  const workforceRows = getRowsFromInputOrResult(plan, "workforceRows", "workforceRows", (row) => ({
    dailyHours: row.dailyHours,
    peopleAssigned: row.peopleAssigned,
    workforceId: row.workforceId,
  }));
  const manualMaterialRows = getRowsFromInputOrResult(plan, "materialRows", "materialRows", (row) => ({
    dailyQuantity: row.dailyQuantity,
    materialId: row.materialId,
  }));
  const productCycleTimeMinutes = Math.max(0.0001, toFiniteNumber(product.cycle_time_minutes, toFiniteNumber(plan.result?.cycleTimeMinutes, 1)));
  let machineHoursUsed = 0;
  let primaryMachineDailyHours = 0;
  let energyConsumptionKwh = 0;
  let selectedMachineValue = 0;

  const machineSummary = machineRows
    .map((row) => {
      const machine = machines.find((item) => item.id === row.machineId);
      if (!machine) return null;

      const dailyHours = Math.max(0, toFiniteNumber(row.dailyHours));
      const machinePrice = Math.max(0, toFiniteNumber(machine.price));
      machineHoursUsed += dailyHours;
      primaryMachineDailyHours = Math.max(primaryMachineDailyHours, dailyHours);
      energyConsumptionKwh += dailyHours * Math.max(0, toFiniteNumber(machine.hourly_energy_consumption_kwh));
      selectedMachineValue += machinePrice;

      return {
        dailyHours,
        energyConsumptionKwh: dailyHours * Math.max(0, toFiniteNumber(machine.hourly_energy_consumption_kwh)),
        hourlyEnergyConsumptionKwh: machine.hourly_energy_consumption_kwh,
        machineId: machine.id,
        name: machine.name,
        price: machinePrice,
        priceCurrency: machine.price_currency || "TRY",
      };
    })
    .filter(Boolean);

  const producedQuantity = (primaryMachineDailyHours * 60) / productCycleTimeMinutes;
  let materialCost = 0;
  const recipeRows = asObjectArray(product.material_rows);
  const materialSummary = (recipeRows.length ? recipeRows : manualMaterialRows)
    .map((row) => {
      const materialId = row.material_id || row.materialId;
      const material = row.material || materials.find((item) => item.id === materialId);
      if (!material) return null;

      const quantityPerUnit = toFiniteNumber(row.quantity_per_unit ?? row.quantityPerUnit);
      const dailyQuantity = recipeRows.length
        ? producedQuantity * Math.max(0, quantityPerUnit)
        : Math.max(0, toFiniteNumber(row.dailyQuantity));
      const pricePerUnit = Math.max(0, toFiniteNumber(material.price_per_unit));
      const cost = dailyQuantity * pricePerUnit;
      materialCost += cost;

      return {
        cost,
        dailyQuantity,
        materialId: material.id,
        name: material.name,
        priceCurrency: material.price_currency || "TRY",
        pricePerUnit,
        producedQuantity,
        quantityPerUnit: recipeRows.length ? quantityPerUnit : undefined,
        unit: material.unit,
      };
    })
    .filter(Boolean);

  let workforceCost = 0;
  let workforceHoursUsed = 0;
  const workforceSummary = workforceRows
    .map((row) => {
      const resource = workforce.find((item) => item.id === row.workforceId);
      if (!resource) return null;

      const peopleAssigned = Math.max(0, toFiniteNumber(row.peopleAssigned));
      const dailyHours = Math.max(0, toFiniteNumber(row.dailyHours));
      const hoursUsed = peopleAssigned * dailyHours;
      const hourlyCost = Math.max(0, toFiniteNumber(resource.hourly_cost));
      const cost = hoursUsed * hourlyCost;
      workforceCost += cost;
      workforceHoursUsed += hoursUsed;

      return {
        cost,
        dailyHours,
        hourlyCost,
        hourlyCostCurrency: resource.hourly_cost_currency || "TRY",
        hoursUsed,
        peopleAssigned,
        roleName: resource.role_name,
        workforceId: resource.id,
      };
    })
    .filter(Boolean);

  return {
    ...(plan.result || {}),
    cycleTimeMinutes: productCycleTimeMinutes,
    energyConsumptionKwh,
    machineHoursUsed,
    machineRows: machineSummary,
    materialCost,
    materialRows: materialSummary,
    primaryMachineDailyHours,
    producedQuantity,
    productName: product.name || plan.result?.productName || plan.input?.productName || "",
    productPrice: toFiniteNumber(product.price, toFiniteNumber(plan.result?.productPrice)),
    productPriceCurrency: product.price_currency || "TRY",
    productUnit: product.unit || plan.result?.productUnit || "adet",
    selectedMachineValue,
    totalTrackedDailyCost: materialCost + workforceCost,
    workforceCost,
    workforceHoursUsed,
    workforceRows: workforceSummary,
  };
}

export function getCurrentOperationPlans(workspace = {}) {
  const sourcePlans = Array.isArray(workspace.activePlans) && workspace.activePlans.length
    ? workspace.activePlans
    : (workspace.latestPlan ? [workspace.latestPlan] : []);

  return sourcePlans
    .filter((plan) => plan && typeof plan === "object")
    .map((plan) => ({
      ...plan,
      result: calculateCurrentPlanResult(plan, workspace),
    }));
}

export function hasViablePlanResult(result = {}) {
  return (
    toFiniteNumber(result.producedQuantity) > 0 &&
    Array.isArray(result.machineRows) &&
    result.machineRows.some((row) => toFiniteNumber(row.dailyHours) > 0) &&
    Array.isArray(result.materialRows) &&
    result.materialRows.some((row) => toFiniteNumber(row.dailyQuantity) > 0)
  );
}
