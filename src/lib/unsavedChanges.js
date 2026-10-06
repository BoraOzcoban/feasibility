// Snapshots of the editable workspace, compared to detect unsaved changes.
//
// Each section is recorded as saved on its own, when its data loads or saves.
// One snapshot for everything let a load in one module mark edits made in
// another, meanwhile, as saved, so leaving the page dropped them silently.

export const workspaceSections = ["financial", "operations", "sales", "simulation"];

export function createUnsavedWorkspaceSnapshots({
  financialExtraCostForm,
  financialSettingsForm,
  operationForms,
  operationPlan,
  salesStrategy,
  simulationVariants,
}) {
  return {
    financial: JSON.stringify({ financialExtraCostForm, financialSettingsForm }),
    operations: JSON.stringify({ operationForms, operationPlan }),
    sales: JSON.stringify(salesStrategy),
    simulation: JSON.stringify(simulationVariants),
  };
}

// Sections whose current state differs from the state last recorded as saved.
// A section with nothing recorded yet has not loaded, so it cannot have edits.
export function findUnsavedSections(savedSnapshots, editableSnapshots) {
  return workspaceSections.filter(
    (section) => savedSnapshots[section] !== undefined && savedSnapshots[section] !== editableSnapshots[section],
  );
}

// Records the given sections (all of them when none are named) as saved.
export function recordSavedSections(savedSnapshots, editableSnapshots, sections = workspaceSections) {
  const next = { ...savedSnapshots };
  for (const section of sections) next[section] = editableSnapshots[section];
  return next;
}
