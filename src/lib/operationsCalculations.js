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

function getPlanValue(plan = {}, key, fallback) {
  if (plan.input && plan.input[key] !== undefined) return plan.input[key];
  if (plan.result && plan.result[key] !== undefined) return plan.result[key];
  if (plan[key] !== undefined) return plan[key];
  return fallback;
}

function getMachinePlanHours(machineRows, machineId) {
  const matchingRow = machineRows.find((row) => row.machineId === machineId);
  return matchingRow ? Math.max(0, toFiniteNumber(matchingRow.dailyHours)) : 0;
}

function getTransferBatchSize(strategy, targetQuantity, batchSize, minimumTransferQuantity) {
  const safeTargetQuantity = Math.max(0, toFiniteNumber(targetQuantity));
  if (safeTargetQuantity <= 0) return 0;

  const safeMinimumTransferQuantity = Math.max(1, Math.min(safeTargetQuantity, toFiniteNumber(minimumTransferQuantity, 1)));
  if (strategy === "batch") return safeTargetQuantity;
  if (strategy === "parallel") return safeMinimumTransferQuantity;

  return Math.max(
    safeMinimumTransferQuantity,
    Math.min(safeTargetQuantity, toFiniteNumber(batchSize, safeMinimumTransferQuantity)),
  );
}

function normalizeOperationRows(operationRows, machines, machineRows, productCycleTimeMinutes) {
  return operationRows
    .map((row, index) => {
      const machine = machines.find((item) => item.id === row.machineId);
      if (!machine && !row.machineId) return null;

      const machinePlanHours = getMachinePlanHours(machineRows, row.machineId);
      const processTimeMinutes = Math.max(
        0.0001,
        toFiniteNumber(
          row.processTimeMinutes ?? row.processMinutesPerUnit ?? row.cycleTimeMinutes,
          productCycleTimeMinutes,
        ),
      );
      const capacity = Math.max(
        1,
        toFiniteNumber(row.capacity ?? row.concurrentCapacity ?? machine?.concurrent_capacity, 1),
      );
      const speedMultiplier = Math.max(
        0.0001,
        toFiniteNumber(row.speedMultiplier ?? row.speed_multiplier ?? machine?.speed_multiplier, 1),
      );
      const availabilityHours = Math.max(
        0,
        toFiniteNumber(row.dailyHours ?? row.availabilityHours ?? machine?.availability_hours, machinePlanHours || 8),
      );

      return {
        capacity,
        dailyHours: availabilityHours,
        failureProbabilityPercent: Math.max(
          0,
          toFiniteNumber(row.failureProbabilityPercent ?? machine?.failure_probability_percent),
        ),
        machineId: row.machineId || "",
        machineName: machine?.name || row.machineName || row.name || `Machine ${index + 1}`,
        operationId: row.operationId || row.id || `operation-${index + 1}`,
        operationName: row.operationName || row.name || `Operation ${index + 1}`,
        processTimeMinutes,
        setupMinutes: Math.max(0, toFiniteNumber(row.setupMinutes)),
        speedMultiplier,
      };
    })
    .filter(Boolean);
}

function getBatchGroups(targetQuantity, transferBatchSize) {
  const safeTargetQuantity = Math.max(0, toFiniteNumber(targetQuantity));
  const safeTransferBatchSize = Math.max(1, toFiniteNumber(transferBatchSize, safeTargetQuantity || 1));
  const batchCount = safeTargetQuantity > 0 ? Math.ceil(safeTargetQuantity / safeTransferBatchSize) : 0;

  return Array.from({ length: batchCount }, (_, index) => {
    const consumedQuantity = index * safeTransferBatchSize;
    return {
      index: index + 1,
      quantity: Math.min(safeTransferBatchSize, safeTargetQuantity - consumedQuantity),
    };
  }).filter((group) => group.quantity > 0);
}

function buildBatchCandidates(targetQuantity, minimumTransferQuantity, currentBatchSize) {
  const safeTargetQuantity = Math.max(1, Math.round(toFiniteNumber(targetQuantity, 1)));
  const safeMinimumTransferQuantity = Math.max(1, Math.round(toFiniteNumber(minimumTransferQuantity, 1)));
  const candidates = new Set([
    safeMinimumTransferQuantity,
    Math.max(safeMinimumTransferQuantity, Math.round(toFiniteNumber(currentBatchSize, safeMinimumTransferQuantity))),
    safeTargetQuantity,
  ]);
  const maxCandidateCount = 1000;
  const rawStep = safeTargetQuantity / safeMinimumTransferQuantity <= maxCandidateCount
    ? safeMinimumTransferQuantity
    : Math.ceil((safeTargetQuantity / maxCandidateCount) / safeMinimumTransferQuantity) * safeMinimumTransferQuantity;
  const step = Math.max(safeMinimumTransferQuantity, rawStep);

  for (let batch = safeMinimumTransferQuantity; batch <= safeTargetQuantity; batch += step) {
    candidates.add(batch);
  }

  return Array.from(candidates)
    .filter((batch) => batch >= safeMinimumTransferQuantity && batch <= safeTargetQuantity)
    .sort((a, b) => a - b);
}

function runOperationSchedule(operationRows, options = {}) {
  const targetQuantity = Math.max(0, toFiniteNumber(options.targetQuantity));
  const transferBatchSize = getTransferBatchSize(
    options.flowStrategy,
    targetQuantity,
    options.batchSize,
    options.minimumTransferQuantity,
  );
  const groups = getBatchGroups(targetQuantity, transferBatchSize);
  const machineStates = new Map();
  const operationTimings = [];
  const eventSample = [];
  let previousFinishes = groups.map(() => 0);
  let makespanMinutes = 0;
  let totalQueueWaitMinutes = 0;
  let totalProcessingTimeMinutes = 0;

  operationRows.forEach((operation, operationIndex) => {
    const machineKey = operation.machineId || operation.operationId;
    const machineState = machineStates.get(machineKey) || {
      availabilityHours: operation.dailyHours,
      busyMinutes: 0,
      machineId: operation.machineId,
      machineName: operation.machineName,
      machinePrice: Math.max(0, toFiniteNumber(operation.machinePrice)),
      priceCurrency: operation.priceCurrency || "TRY",
      availableAt: 0,
    };
    machineState.availabilityHours = Math.max(machineState.availabilityHours, operation.dailyHours);

    const currentTimings = [];
    const currentFinishes = [];
    let operationBusyMinutes = 0;
    let operationWaitMinutes = 0;
    let firstStartMinutes = null;
    let lastFinishMinutes = 0;

    groups.forEach((group, groupIndex) => {
      const precedenceReadyMinutes = operationIndex === 0 ? 0 : previousFinishes[groupIndex] || 0;
      const startMinutes = Math.max(machineState.availableAt, precedenceReadyMinutes);
      const setupMinutes = groupIndex === 0 ? operation.setupMinutes : 0;
      const processMinutes = (Math.ceil(group.quantity / operation.capacity) * operation.processTimeMinutes) / operation.speedMultiplier;
      const durationMinutes = setupMinutes + processMinutes;
      const finishMinutes = startMinutes + durationMinutes;
      const waitMinutes = Math.max(0, startMinutes - precedenceReadyMinutes);

      machineState.availableAt = finishMinutes;
      machineState.busyMinutes += durationMinutes;
      operationBusyMinutes += durationMinutes;
      operationWaitMinutes += waitMinutes;
      totalQueueWaitMinutes += waitMinutes;
      totalProcessingTimeMinutes += durationMinutes;
      makespanMinutes = Math.max(makespanMinutes, finishMinutes);
      firstStartMinutes = firstStartMinutes === null ? startMinutes : Math.min(firstStartMinutes, startMinutes);
      lastFinishMinutes = Math.max(lastFinishMinutes, finishMinutes);
      currentFinishes[groupIndex] = finishMinutes;

      const timing = {
        batchIndex: group.index,
        durationMinutes,
        finishMinutes,
        operationIndex,
        operationName: operation.operationName,
        quantity: group.quantity,
        startMinutes,
        waitMinutes,
      };
      currentTimings.push(timing);

      if (eventSample.length < 80) {
        eventSample.push({
          batchIndex: group.index,
          event: "start",
          operationName: operation.operationName,
          quantity: group.quantity,
          timeMinutes: startMinutes,
        });
        eventSample.push({
          batchIndex: group.index,
          event: "finish",
          operationName: operation.operationName,
          quantity: group.quantity,
          timeMinutes: finishMinutes,
        });
      }
    });

    operationTimings.push(currentTimings);
    previousFinishes = currentFinishes;
    machineStates.set(machineKey, machineState);

    operationRows[operationIndex] = {
      ...operation,
      busyMinutes: operationBusyMinutes,
      finishMinutes: lastFinishMinutes,
      idleBeforeMinutes: Math.max(0, firstStartMinutes || 0),
      startMinutes: firstStartMinutes || 0,
      totalWaitMinutes: operationWaitMinutes,
    };
  });

  const bufferRows = [];
  let totalWipUnitMinutes = 0;
  let maxWipQuantity = 0;

  for (let operationIndex = 0; operationIndex < operationTimings.length - 1; operationIndex += 1) {
    const fromTimings = operationTimings[operationIndex] || [];
    const toTimings = operationTimings[operationIndex + 1] || [];
    const events = [];
    let waitingUnitMinutes = 0;

    fromTimings.forEach((timing, index) => {
      const nextTiming = toTimings[index];
      events.push({ delta: timing.quantity, priority: 0, timeMinutes: timing.finishMinutes });
      if (nextTiming) {
        events.push({ delta: -timing.quantity, priority: 1, timeMinutes: nextTiming.startMinutes });
        waitingUnitMinutes += timing.quantity * Math.max(0, nextTiming.startMinutes - timing.finishMinutes);
      }
    });

    events.sort((a, b) => a.timeMinutes - b.timeMinutes || a.priority - b.priority);

    let level = 0;
    let lastTimeMinutes = 0;
    let bufferArea = 0;
    let bufferMaxWip = 0;

    for (let eventIndex = 0; eventIndex < events.length;) {
      const eventTimeMinutes = events[eventIndex].timeMinutes;
      let delta = 0;

      bufferArea += Math.max(0, eventTimeMinutes - lastTimeMinutes) * level;

      while (eventIndex < events.length && events[eventIndex].timeMinutes === eventTimeMinutes) {
        delta += events[eventIndex].delta;
        eventIndex += 1;
      }

      level = Math.max(0, level + delta);
      bufferMaxWip = Math.max(bufferMaxWip, level);
      lastTimeMinutes = eventTimeMinutes;
    }

    totalWipUnitMinutes += bufferArea;
    maxWipQuantity = Math.max(maxWipQuantity, bufferMaxWip);
    bufferRows.push({
      averageWip: makespanMinutes ? bufferArea / makespanMinutes : 0,
      bufferLimitBreached: toFiniteNumber(options.bufferMaxQuantity) > 0
        ? bufferMaxWip > toFiniteNumber(options.bufferMaxQuantity)
        : false,
      bufferMaxQuantity: Math.max(0, toFiniteNumber(options.bufferMaxQuantity)),
      fromOperationName: operationRows[operationIndex]?.operationName || `Operation ${operationIndex + 1}`,
      maxWip: bufferMaxWip,
      toOperationName: operationRows[operationIndex + 1]?.operationName || `Operation ${operationIndex + 2}`,
      waitingUnitHours: waitingUnitMinutes / 60,
    });
  }

  const waitingCost = (totalQueueWaitMinutes / 60) * Math.max(0, toFiniteNumber(options.waitingCostPerHour));
  const inventoryCost = (totalWipUnitMinutes / 60) * Math.max(0, toFiniteNumber(options.inventoryCostPerUnitHour));
  const scheduleWindowMinutes = Math.max(...operationRows.map((row) => Math.max(0, toFiniteNumber(row.dailyHours)) * 60), 0);
  const delayMinutes = Math.max(0, makespanMinutes - scheduleWindowMinutes);
  const delayCost = (delayMinutes / 60) * Math.max(0, toFiniteNumber(options.delayCostPerHour));
  let totalIdleTimeHours = 0;

  const machineRows = Array.from(machineStates.values()).map((state) => {
    const machine = options.machines.find((item) => item.id === state.machineId) || {};
    const busyHours = state.busyMinutes / 60;
    const availabilityMinutes = Math.max(makespanMinutes, Math.max(0, toFiniteNumber(state.availabilityHours)) * 60);
    const idleHours = Math.max(0, availabilityMinutes - state.busyMinutes) / 60;
    totalIdleTimeHours += idleHours;

    return {
      availabilityHours: Math.max(0, toFiniteNumber(state.availabilityHours)),
      dailyHours: busyHours,
      energyConsumptionKwh: busyHours * Math.max(0, toFiniteNumber(machine.hourly_energy_consumption_kwh)),
      hourlyEnergyConsumptionKwh: machine.hourly_energy_consumption_kwh,
      idleHours,
      machineId: state.machineId,
      name: machine.name || state.machineName,
      price: Math.max(0, toFiniteNumber(machine.price)),
      priceCurrency: machine.price_currency || "TRY",
      utilizationPercent: availabilityMinutes ? (state.busyMinutes / availabilityMinutes) * 100 : 0,
    };
  });

  const capacityLossCost = totalIdleTimeHours * Math.max(0, toFiniteNumber(options.capacityLossCostPerHour));
  const bottleneckOperation = operationRows.reduce((current, operation) => (
    !current || toFiniteNumber(operation.busyMinutes) > toFiniteNumber(current.busyMinutes) ? operation : current
  ), null);
  const objectiveScore = makespanMinutes + waitingCost + inventoryCost + delayCost + capacityLossCost;

  return {
    batchCount: groups.length,
    bufferRows,
    capacityLossCost,
    delayCost,
    delayMinutes,
    eventSample: eventSample.sort((a, b) => a.timeMinutes - b.timeMinutes),
    effectiveCycleTimeMinutes: targetQuantity ? makespanMinutes / targetQuantity : 0,
    flowStrategy: options.flowStrategy,
    inventoryCost,
    machineRows,
    maxWipQuantity,
    objectiveScore,
    operationRows,
    producedQuantity: targetQuantity,
    recommendedBufferQuantity: maxWipQuantity,
    totalIdleTimeHours,
    totalProcessingTimeMinutes,
    totalProductionTimeMinutes: makespanMinutes,
    transferBatchSize,
    waitingCost,
    waitingTimeHours: totalQueueWaitMinutes / 60,
    wipUnitHours: totalWipUnitMinutes / 60,
    bottleneck: bottleneckOperation
      ? {
          machineId: bottleneckOperation.machineId,
          machineName: bottleneckOperation.machineName,
          operationName: bottleneckOperation.operationName,
          processingTimeMinutes: bottleneckOperation.busyMinutes,
        }
      : null,
  };
}

function simulateOperationFlow(operationRows, plan, workspace, machineRows, productCycleTimeMinutes) {
  const flowStrategy = String(getPlanValue(plan, "flowStrategy", "flow") || "flow");
  const targetQuantity = Math.max(0, toFiniteNumber(getPlanValue(plan, "targetQuantity", 0)));
  const minimumTransferQuantity = Math.max(1, toFiniteNumber(getPlanValue(plan, "minimumTransferQuantity", 1)));
  const batchSize = Math.max(minimumTransferQuantity, toFiniteNumber(getPlanValue(plan, "batchSize", minimumTransferQuantity)));
  const normalizedRows = normalizeOperationRows(operationRows, workspace.machines || [], machineRows, productCycleTimeMinutes);

  if (!normalizedRows.length || targetQuantity <= 0) return null;

  const scheduleOptions = {
    batchSize,
    bufferMaxQuantity: Math.max(0, toFiniteNumber(getPlanValue(plan, "bufferMaxQuantity", 0))),
    capacityLossCostPerHour: Math.max(0, toFiniteNumber(getPlanValue(plan, "capacityLossCostPerHour", 0))),
    delayCostPerHour: Math.max(0, toFiniteNumber(getPlanValue(plan, "delayCostPerHour", 0))),
    flowStrategy,
    inventoryCostPerUnitHour: Math.max(0, toFiniteNumber(getPlanValue(plan, "inventoryCostPerUnitHour", 0))),
    machines: workspace.machines || [],
    minimumTransferQuantity,
    targetQuantity,
    waitingCostPerHour: Math.max(0, toFiniteNumber(getPlanValue(plan, "waitingCostPerHour", 0))),
  };
  const schedule = runOperationSchedule(normalizedRows.map((row) => ({ ...row })), scheduleOptions);
  const candidates = buildBatchCandidates(targetQuantity, minimumTransferQuantity, batchSize);
  const optimal = candidates
    .map((candidateBatchSize) => runOperationSchedule(
      normalizedRows.map((row) => ({ ...row })),
      { ...scheduleOptions, batchSize: candidateBatchSize, flowStrategy: "flow" },
    ))
    .reduce((best, candidate) => (
      !best || candidate.objectiveScore < best.objectiveScore ? candidate : best
    ), null);

  return {
    ...schedule,
    batchSize,
    flowStrategy,
    minimumTransferQuantity,
    optimization: optimal
      ? {
          objectiveScore: optimal.objectiveScore,
          recommendedBatchSize: optimal.transferBatchSize,
          totalProductionTimeMinutes: optimal.totalProductionTimeMinutes,
          waitingCost: optimal.waitingCost,
          inventoryCost: optimal.inventoryCost,
        }
      : null,
    targetQuantity,
  };
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
  const operationRows = getRowsFromInputOrResult(plan, "operationRows", "operationRows", (row) => ({
    capacity: row.capacity,
    dailyHours: row.dailyHours ?? row.availabilityHours,
    machineId: row.machineId,
    operationId: row.operationId,
    operationName: row.operationName,
    processTimeMinutes: row.processTimeMinutes,
    setupMinutes: row.setupMinutes,
    speedMultiplier: row.speedMultiplier,
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
  const flowSimulation = simulateOperationFlow(operationRows, plan, workspace, machineRows, productCycleTimeMinutes);
  let machineHoursUsed = 0;
  let primaryMachineDailyHours = 0;
  let energyConsumptionKwh = 0;
  let selectedMachineValue = 0;

  let machineSummary = machineRows
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

  if (flowSimulation) {
    machineHoursUsed = 0;
    primaryMachineDailyHours = 0;
    energyConsumptionKwh = 0;
    selectedMachineValue = 0;
    machineSummary = flowSimulation.machineRows.map((row) => {
      machineHoursUsed += toFiniteNumber(row.dailyHours);
      primaryMachineDailyHours = Math.max(primaryMachineDailyHours, toFiniteNumber(row.dailyHours));
      energyConsumptionKwh += toFiniteNumber(row.energyConsumptionKwh);
      selectedMachineValue += toFiniteNumber(row.price);
      return row;
    });
  }

  const producedQuantity = flowSimulation?.producedQuantity ?? ((primaryMachineDailyHours * 60) / productCycleTimeMinutes);
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

  const flowCost = flowSimulation
    ? toFiniteNumber(flowSimulation.waitingCost) +
      toFiniteNumber(flowSimulation.inventoryCost) +
      toFiniteNumber(flowSimulation.delayCost) +
      toFiniteNumber(flowSimulation.capacityLossCost)
    : 0;

  return {
    ...(plan.result || {}),
    ...(flowSimulation || {}),
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
    totalTrackedDailyCost: materialCost + workforceCost + flowCost,
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
