import assert from "node:assert/strict";
import test from "node:test";
import {
  createUnsavedWorkspaceSnapshots,
  findUnsavedSections,
  recordSavedSections,
  workspaceSections,
} from "../src/lib/unsavedChanges.js";

const workspace = {
  financialExtraCostForm: { amount: "", name: "" },
  financialSettingsForm: { initialCash: 100 },
  operationForms: { material: { name: "" } },
  operationPlan: { rows: [] },
  salesStrategy: { channels: [{ quantity: 10 }] },
  simulationVariants: [{ id: "current-situation" }],
};

test("nothing is unsaved before any section has loaded", () => {
  assert.deepEqual(findUnsavedSections({}, createUnsavedWorkspaceSnapshots(workspace)), []);
});

test("an edit is unsaved only in its own section", () => {
  const saved = recordSavedSections({}, createUnsavedWorkspaceSnapshots(workspace));
  const edited = createUnsavedWorkspaceSnapshots({ ...workspace, salesStrategy: { channels: [{ quantity: 11 }] } });
  assert.deepEqual(findUnsavedSections(saved, edited), ["sales"]);
});

test("another section finishing its load does not mark an edit as saved", () => {
  // The sales edit is made while the financial data is still loading.
  let saved = recordSavedSections({}, createUnsavedWorkspaceSnapshots(workspace));
  const loaded = {
    ...workspace,
    financialSettingsForm: { initialCash: 250 },
    salesStrategy: { channels: [{ quantity: 11 }] },
  };
  saved = recordSavedSections(saved, createUnsavedWorkspaceSnapshots(loaded), ["financial"]);
  assert.deepEqual(findUnsavedSections(saved, createUnsavedWorkspaceSnapshots(loaded)), ["sales"]);
});

test("recording without naming sections records them all", () => {
  const edited = createUnsavedWorkspaceSnapshots({ ...workspace, operationPlan: { rows: [1] } });
  const saved = recordSavedSections({}, edited);
  assert.deepEqual(Object.keys(saved).sort(), [...workspaceSections].sort());
  assert.deepEqual(findUnsavedSections(saved, edited), []);
});
