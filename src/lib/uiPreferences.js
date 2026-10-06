// Which dashboard / sales sections a user chose to show, and the unsaved-work snapshot.

export const dashboardStorageKey = "atera-dashboard-visible-sections";

export const salesStrategyStorageKey = "atera-sales-visible-sections";

export const defaultDashboardVisibleSections = {
  assumptions: ["monthlyCapacity", "averageMonthlyDemand", "unitMargin"],
  business: ["verdict", "netResult", "cashRunway", "payback", "capacityDemand", "initialCash"],
  details: ["monthlyRevenue", "monthlyCost", "netMargin", "breakEven", "workingCapital", "unsoldInventory", "unmetSales", "unitProductionCost"],
};

export const defaultSalesVisibleSections = {
  optional: ["expectationMultipliers", "advancedChannelParameters"],
  readout: ["productsInChannels", "campaignBudget", "averageMultiplier", "readyRemaining"],
};

export const allowedSalesVisibleSections = {
  optional: ["expectationMultipliers", "advancedChannelParameters"],
  readout: ["productsInChannels", "campaignBudget", "averageMultiplier", "readyRemaining", "monthlyChannelPlan", "expectedAnnualUnits", "monthlyCommission"],
};

export function cloneDashboardVisibleSections(sections = defaultDashboardVisibleSections) {
  return Object.fromEntries(
    Object.entries(sections).map(([group, keys]) => [group, [...keys]]),
  );
}

export function cloneSalesVisibleSections(sections = defaultSalesVisibleSections) {
  return Object.fromEntries(
    Object.entries(sections).map(([group, keys]) => [group, [...keys]]),
  );
}

export function normalizeDashboardVisibleSections(value = {}) {
  const source = value && typeof value === "object" ? value : {};

  return Object.fromEntries(
    Object.entries(defaultDashboardVisibleSections).map(([group, defaultKeys]) => {
      const selectedKeys = source[group];

      if (!Array.isArray(selectedKeys)) {
        return [group, [...defaultKeys]];
      }

      return [
        group,
        [...new Set(selectedKeys.filter((key) => defaultKeys.includes(key)))],
      ];
    }),
  );
}

export function normalizeSalesVisibleSections(value = {}) {
  const source = value && typeof value === "object" ? value : {};

  return Object.fromEntries(
    Object.entries(defaultSalesVisibleSections).map(([group, defaultKeys]) => {
      const selectedKeys = source[group];
      const allowedKeys = allowedSalesVisibleSections[group] || defaultKeys;

      if (!Array.isArray(selectedKeys)) {
        return [group, [...defaultKeys]];
      }

      return [
        group,
        [...new Set(selectedKeys.filter((key) => allowedKeys.includes(key)))],
      ];
    }),
  );
}

export function getStoredDashboardVisibleSections() {
  if (typeof window === "undefined") {
    return cloneDashboardVisibleSections();
  }

  try {
    const storedValue = window.localStorage.getItem(dashboardStorageKey);
    return storedValue
      ? normalizeDashboardVisibleSections(JSON.parse(storedValue))
      : cloneDashboardVisibleSections();
  } catch {
    return cloneDashboardVisibleSections();
  }
}

export function getStoredSalesVisibleSections() {
  if (typeof window === "undefined") {
    return cloneSalesVisibleSections();
  }

  try {
    const storedValue = window.localStorage.getItem(salesStrategyStorageKey);
    return storedValue
      ? normalizeSalesVisibleSections(JSON.parse(storedValue))
      : cloneSalesVisibleSections();
  } catch {
    return cloneSalesVisibleSections();
  }
}

export function createUnsavedWorkspaceSnapshot({
  financialExtraCostForm,
  financialSettingsForm,
  operationForms,
  operationPlan,
  salesStrategy,
  simulationVariants,
}) {
  return JSON.stringify({
    financialExtraCostForm,
    financialSettingsForm,
    operationForms,
    operationPlan,
    salesStrategy,
    simulationVariants,
  });
}
