// Which sales sections a user chose to show, and the unsaved-work snapshot.

export const salesStrategyStorageKey = "atera-sales-visible-sections";

export const defaultSalesVisibleSections = {
  optional: ["expectationMultipliers", "advancedChannelParameters"],
  readout: ["productsInChannels", "campaignBudget", "averageMultiplier", "readyRemaining"],
};

export const allowedSalesVisibleSections = {
  optional: ["expectationMultipliers", "advancedChannelParameters"],
  readout: ["productsInChannels", "campaignBudget", "averageMultiplier", "readyRemaining", "monthlyChannelPlan", "expectedAnnualUnits", "monthlyCommission"],
};

export function cloneSalesVisibleSections(sections = defaultSalesVisibleSections) {
  return Object.fromEntries(
    Object.entries(sections).map(([group, keys]) => [group, [...keys]]),
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
