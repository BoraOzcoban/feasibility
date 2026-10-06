// Tracks edits across pages and asks before navigation would drop them.
import { useEffect, useMemo, useRef, useState } from "react";
import { useBlocker } from "react-router";
import { toFiniteNumber } from "../lib/feasibilityModel";
import { emptyOperationForms } from "../lib/operationsService";
import { normalizeRoutePath } from "../lib/routes";
import {
  createUnsavedWorkspaceSnapshots,
  findUnsavedSections,
  recordSavedSections,
  workspaceSections,
} from "../lib/unsavedChanges";

export function useUnsavedChanges({
  activeSimulationVariant,
  copy,
  financialExtraCostForm,
  financialLoading,
  financialSettingsForm,
  handleSaveFinancialExtraCost,
  handleSaveFinancialSettings,
  handleSaveOperationPlan,
  handleSaveOperationRecord,
  handleSaveSalesStrategy,
  isFinancialRoute,
  isOperationsRoute,
  isSimulationRoute,
  markWorkspaceSnapshotClean,
  operationForms,
  operationPlan,
  operationsLoading,
  persistSimulationVariant,
  routePath,
  salesLoading,
  salesStrategy,
  session,
  simulationLoading,
  simulationVariants,
  workspaceCleanRequests,
}) {
  // Per section: the state last loaded or saved. See lib/unsavedChanges.js.
  const [savedSnapshots, setSavedSnapshots] = useState({});

  const [promptState, setPromptState] = useState({ message: "", saving: false });

  const workspaceSnapshotRef = useRef({});
  const handledCleanRequests = useRef({});

  const editableSnapshots = useMemo(
    () =>
      createUnsavedWorkspaceSnapshots({
        financialExtraCostForm,
        financialSettingsForm,
        operationForms,
        operationPlan,
        salesStrategy,
        simulationVariants,
      }),
    [financialExtraCostForm, financialSettingsForm, operationForms, operationPlan, salesStrategy, simulationVariants],
  );

  const hasUnsavedChanges = Boolean(session) && findUnsavedSections(savedSnapshots, editableSnapshots).length > 0;

  // Holds any move to another page, including Back and Forward, while there
  // are unsaved edits. The prompt is open for as long as a move is held.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges &&
      !nextLocation.state?.force &&
      normalizeRoutePath(nextLocation.pathname) !== normalizeRoutePath(currentLocation.pathname),
  );
  const unsavedPrompt = { ...promptState, open: blocker.state === "blocked" };

  useEffect(() => {
    workspaceSnapshotRef.current = editableSnapshots;
  }, [editableSnapshots]);

  // Records the sections a load or save asked for, as they are after that load or save.
  useEffect(() => {
    const sections = workspaceSections.filter(
      (section) => workspaceCleanRequests[section] !== handledCleanRequests.current[section],
    );
    handledCleanRequests.current = workspaceCleanRequests;
    if (sections.length) {
      setSavedSnapshots((current) => recordSavedSections(current, workspaceSnapshotRef.current, sections));
    }
  }, [workspaceCleanRequests]);

  // A section with nothing recorded (not loaded yet, or its load failed) is
  // recorded as it is whenever nothing is loading, so its edits count from then on.
  useEffect(() => {
    if (!session) {
      setSavedSnapshots({});
      return;
    }
    if (operationsLoading || financialLoading || salesLoading || simulationLoading) return;

    const unrecorded = workspaceSections.filter((section) => savedSnapshots[section] === undefined);
    if (unrecorded.length) setSavedSnapshots((current) => recordSavedSections(current, editableSnapshots, unrecorded));
  }, [
    editableSnapshots,
    financialLoading,
    operationsLoading,
    salesLoading,
    savedSnapshots,
    session,
    simulationLoading,
  ]);

  useEffect(() => {
    if (!session && blocker.state === "blocked") blocker.reset();
  }, [blocker, session]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  function getDirtyOperationFormEntities() {
    return Object.keys(emptyOperationForms).filter(
      (entity) => JSON.stringify(operationForms[entity]) !== JSON.stringify(emptyOperationForms[entity]),
    );
  }

  function getUnsavedManualSaveMessage() {
    return copy(
      "This screen has form-specific save buttons. Stay on the page and use the relevant save button, or leave without saving.",
      "Bu ekranda form bazlı kayıt butonları var. Sayfada kalıp ilgili Kaydet butonunu kullanabilir veya kaydetmeden çıkabilirsiniz.",
    );
  }

  // The section the current page edits; the save handlers record their own
  // section too, this only covers a page whose edits needed no save call.
  function getCurrentSections() {
    if (routePath === "/sales-strategy") return ["sales"];
    if (isSimulationRoute) return ["simulation"];
    if (isOperationsRoute) return ["operations"];
    if (isFinancialRoute) return ["financial"];
    return [];
  }

  async function saveCurrentWorkspaceChanges() {
    if (routePath === "/sales-strategy") {
      return handleSaveSalesStrategy();
    }

    if (isSimulationRoute && activeSimulationVariant) {
      return persistSimulationVariant(activeSimulationVariant);
    }

    if (routePath === "/operations/data-entry") {
      return handleSaveOperationPlan();
    }

    if (isOperationsRoute) {
      const dirtyEntities = getDirtyOperationFormEntities();

      if (dirtyEntities.length) {
        for (const entity of dirtyEntities) {
          const saved = await handleSaveOperationRecord(entity);
          if (!saved) return false;
        }
        return true;
      }

      markWorkspaceSnapshotClean("operations");
      return true;
    }

    if (isFinancialRoute) {
      const shouldSaveExtraCost = Boolean(
        String(financialExtraCostForm.name || "").trim() || toFiniteNumber(financialExtraCostForm.amount) > 0,
      );
      const settingsSaved = await handleSaveFinancialSettings();

      if (!settingsSaved) return false;
      if (shouldSaveExtraCost) return handleSaveFinancialExtraCost();

      return true;
    }

    if (routePath === "/dashboard" || routePath === "/reports") {
      markWorkspaceSnapshotClean();
      return true;
    }

    setPromptState((current) => ({
      ...current,
      message: getUnsavedManualSaveMessage(),
    }));
    return false;
  }

  function closeUnsavedPrompt() {
    setPromptState({ message: "", saving: false });
    if (blocker.state === "blocked") blocker.reset();
  }

  function continuePendingNavigation() {
    setPromptState({ message: "", saving: false });
    if (blocker.state === "blocked") blocker.proceed();
  }

  async function handleSaveUnsavedAndContinue() {
    setPromptState((current) => ({ ...current, message: "", saving: true }));
    const saved = await saveCurrentWorkspaceChanges();

    if (!saved) {
      setPromptState((current) => ({
        ...current,
        message:
          current.message ||
          copy(
            "Changes could not be saved yet. Please review the current page.",
            "Değişiklikler henüz kaydedilemedi. Lütfen mevcut sayfayı kontrol edin.",
          ),
        saving: false,
      }));
      return;
    }

    markWorkspaceSnapshotClean(...getCurrentSections());
    continuePendingNavigation();
  }

  function handleLeaveWithoutSaving() {
    setSavedSnapshots((current) => recordSavedSections(current, editableSnapshots));
    continuePendingNavigation();
  }

  return {
    closeUnsavedPrompt,
    handleLeaveWithoutSaving,
    handleSaveUnsavedAndContinue,
    unsavedPrompt,
  };
}
