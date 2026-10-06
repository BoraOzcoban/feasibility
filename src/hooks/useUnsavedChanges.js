// Tracks edits across pages and asks before navigation would drop them.
import { useEffect, useMemo, useRef, useState } from "react";
import { toFiniteNumber } from "../lib/feasibilityModel";
import { emptyOperationForms } from "../lib/operationsService";
import { createUnsavedWorkspaceSnapshot } from "../lib/unsavedChanges";

export function useUnsavedChanges({
  activeSimulationVariant,
  copy,
  financialExtraCostForm,
  financialLoading,
  financialSettingsForm,
  goTo,
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
  workspaceCleanRequest,
}) {
  const [savedWorkspaceSnapshot, setSavedWorkspaceSnapshot] = useState("");

  const [unsavedPrompt, setUnsavedPrompt] = useState({
    message: "",
    open: false,
    pendingNavigation: null,
    saving: false,
  });

  const workspaceSnapshotRef = useRef("");

  const editableWorkspaceSnapshot = useMemo(
    () =>
      createUnsavedWorkspaceSnapshot({
        financialExtraCostForm,
        financialSettingsForm,
        operationForms,
        operationPlan,
        salesStrategy,
        simulationVariants,
      }),
    [financialExtraCostForm, financialSettingsForm, operationForms, operationPlan, salesStrategy, simulationVariants],
  );

  const hasUnsavedChanges = Boolean(
    session && savedWorkspaceSnapshot && editableWorkspaceSnapshot !== savedWorkspaceSnapshot,
  );

  useEffect(() => {
    workspaceSnapshotRef.current = editableWorkspaceSnapshot;
  }, [editableWorkspaceSnapshot]);

  useEffect(() => {
    if (workspaceCleanRequest) setSavedWorkspaceSnapshot(workspaceSnapshotRef.current);
  }, [workspaceCleanRequest]);

  useEffect(() => {
    if (!session) {
      setSavedWorkspaceSnapshot("");
      setUnsavedPrompt((current) =>
        current.open ? { message: "", open: false, pendingNavigation: null, saving: false } : current,
      );
      return;
    }

    if (savedWorkspaceSnapshot) return;
    if (operationsLoading || financialLoading || salesLoading || simulationLoading) return;

    setSavedWorkspaceSnapshot(editableWorkspaceSnapshot);
  }, [
    editableWorkspaceSnapshot,
    financialLoading,
    operationsLoading,
    salesLoading,
    savedWorkspaceSnapshot,
    session,
    simulationLoading,
  ]);

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

      markWorkspaceSnapshotClean();
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

    setUnsavedPrompt((current) => ({
      ...current,
      message: getUnsavedManualSaveMessage(),
    }));
    return false;
  }

  function closeUnsavedPrompt() {
    setUnsavedPrompt({
      message: "",
      open: false,
      pendingNavigation: null,
      saving: false,
    });
  }

  function continuePendingNavigation() {
    const pendingNavigation = unsavedPrompt.pendingNavigation;
    closeUnsavedPrompt();

    if (pendingNavigation) {
      goTo(pendingNavigation.pathname, pendingNavigation.nextMode, { force: true });
    }
  }

  async function handleSaveUnsavedAndContinue() {
    setUnsavedPrompt((current) => ({ ...current, message: "", saving: true }));
    const saved = await saveCurrentWorkspaceChanges();

    if (!saved) {
      setUnsavedPrompt((current) => ({
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

    markWorkspaceSnapshotClean();
    continuePendingNavigation();
  }

  function handleLeaveWithoutSaving() {
    setSavedWorkspaceSnapshot(editableWorkspaceSnapshot);
    continuePendingNavigation();
  }

  return {
    closeUnsavedPrompt,
    handleLeaveWithoutSaving,
    handleSaveUnsavedAndContinue,
    hasUnsavedChanges,
    setUnsavedPrompt,
    unsavedPrompt,
  };
}
