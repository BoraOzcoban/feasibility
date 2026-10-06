// Empty form states and small app-wide constants.

import { asObjectArray, toFiniteNumber } from "./feasibilityModel";
import { emptyPlanRows } from "./operationsService";

export const emptyForm = {
  username: "",
  password: "",
  email: "",
  phoneNumber: "",
  company: "",
  department: "",
  accessLevel: "user",
  language: "en",
};

export const emptyRoleForm = {
  name: "",
  description: "",
};

export const emptyManagedUserForm = {
  username: "",
  email: "",
  password: "",
  phoneNumber: "",
  department: "",
  accessLevel: "user",
  language: "tr",
};

export const simulationAlgorithms = {
  withTendency: "fbm_with_tendency",
  withoutTendency: "fbm_without_tendency",
};

export function normalizeSimulationAlgorithm(value) {
  return value === simulationAlgorithms.withoutTendency
    ? simulationAlgorithms.withoutTendency
    : simulationAlgorithms.withTendency;
}

export function isAdminRole(roleOrName) {
  const name = typeof roleOrName === "string" ? roleOrName : roleOrName?.name;
  return String(name || "").trim().toLowerCase() === "admin";
}

export const operationCurrencyOptions = ["TRY", "USD", "EUR"];

export function buildWorkforceRowsFromOperationRows(operationRows) {
  return asObjectArray(operationRows)
    .map((row) => {
      const workforceId = row.workforceId || row.workforce_id || "";
      const peopleAssigned = Math.max(0, toFiniteNumber(row.peopleAssigned, 1));
      const dailyHours = Math.max(0, toFiniteNumber(row.workforceDailyHours ?? row.workforceHours ?? row.dailyHours, 8));

      if (!workforceId || peopleAssigned <= 0 || dailyHours <= 0) return null;

      return {
        ...emptyPlanRows.workforce,
        dailyHours,
        peopleAssigned,
        workforceId,
      };
    })
    .filter(Boolean);
}
