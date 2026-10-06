// Snapshot of the editable workspace, compared to detect unsaved changes.

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
