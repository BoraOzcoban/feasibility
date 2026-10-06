import React, { useEffect, useEffectEvent, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { supabase } from "./lib/supabaseClient";
import { defaultFinancialSettings, emptyFinancialExtraCostForm, emptyFinancialModel } from "./lib/financialService";
import { defaultExchangeRates } from "./lib/feasibilityModel";
import { emptyOperationPlan } from "./lib/operationsService";
import { emptySalesStrategy, emptySimulationVariant } from "./lib/planningService";
import { AppContext } from "./app/AppContext";
import { useWorkspaceSummary } from "./hooks/useWorkspaceSummary";
import { useUnsavedChanges } from "./hooks/useUnsavedChanges";
import { usePlanning } from "./hooks/usePlanning";
import { useOperations } from "./hooks/useOperations";
import { useFinancialModel } from "./hooks/useFinancialModel";
import { useAuthorization } from "./hooks/useAuthorization";
import { useAuth } from "./hooks/useAuth";
import { withTryOperationWorkspace } from "./lib/exchangeRates";
import { normalizeRoutePath } from "./lib/routes";
import { getNavigation } from "./lib/navigation";
import { workspaceSections } from "./lib/unsavedChanges";

function App() {
  const navigate = useNavigate();
  const routePath = normalizeRoutePath(useLocation().pathname);
  const {
    confirmPassword,
    copy,
    form,
    handleForgotPassword,
    handleLogin,
    handleLogout,
    handleResetPassword,
    labels,
    loading,
    locale,
    mode,
    session,
    setConfirmPassword,
    setForm,
    setMode,
    setShowConfirmPassword,
    setShowPassword,
    setStatus,
    setTheme,
    showConfirmPassword,
    showPassword,
    status,
    theme,
    toggleTheme,
    updateField,
  } = useAuth({ goTo });

  // Narrow screens start with the menu closed; it overlays the page when opened.
  const [dashboardSidebarOpen, setDashboardSidebarOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth > 1024,
  );
  // A counter per workspace section, bumped after that section loads or saves;
  // useUnsavedChanges then records the section's state as saved.
  const [workspaceCleanRequests, setWorkspaceCleanRequests] = useState({});

  const { dashboardModules, financialSubmodules, operationsSubmodules } = getNavigation(copy);
  const {
    authorizationAccess,
    authorizationLoading,
    authorizationStatus,
    authorizationTab,
    currentProfile,
    editableAuthorizationRoles,
    handleCreateManagedUser,
    handleCreateRole,
    managedUserForm,
    permissionTableColumns,
    permissionTableRows,
    profiles,
    roleForm,
    setAuthorizationTab,
    updateManagedUserForm,
    updateRoleForm,
    userTableColumns,
  } = useAuthorization({ copy, dashboardModules, form, labels, session, setForm, setTheme, theme });
  const {
    addFinancialLoanRow,
    exchangeRates,
    financialExtraCostForm,
    financialHorizon,
    financialLoading,
    financialModel,
    financialSettingsForm,
    financialStatementPeriod,
    financialStatus,
    handleDeleteFinancialExtraCost,
    handleFetchExchangeRates,
    handleSaveFinancialExtraCost,
    handleSaveFinancialSettings,
    loadFinancialData,
    removeFinancialLoanRow,
    setExchangeRates,
    setFinancialExtraCostForm,
    setFinancialHorizon,
    setFinancialModel,
    setFinancialSettingsForm,
    setFinancialStatementPeriod,
    setFinancialStatus,
    updateFinancialLoanRow,
  } = useFinancialModel({ copy, currentProfile, labels, markWorkspaceSnapshotClean });
  const {
    addProductMaterialRow,
    addProductProcessRow,
    buildProductOperationRows,
    copyOperationRecordToForm,
    getProductFlowDefaults,
    getProductProcessRows,
    getRecipeMaterialId,
    handleDashboardProductChange,
    handleDeleteOperationRecord,
    handleSaveOperationPlan,
    handleSaveOperationRecord,
    loadOperationsData,
    moveProductProcessRow,
    normalizeFlowStrategy,
    operationForms,
    operationPlan,
    operationPlanResult,
    operationsLoading,
    operationsStatus,
    operationsWorkspace,
    processDefinitionOpen,
    removeProductMaterialRow,
    removeProductProcessRow,
    setOperationForms,
    setOperationPlan,
    setOperationPlanResult,
    setOperationsStatus,
    setOperationsWorkspace,
    setProcessDefinitionOpen,
    updateOperationForm,
    updateOperationPlan,
    updateOperationPlanRow,
    updateOperationPlanRowFields,
    updateProductMaterialRow,
    updateProductProcessRow,
    updateProductProcessRowFields,
  } = useOperations({ copy, labels, loadFinancialData, markWorkspaceSnapshotClean, routePath });
  // Operations data with USD/EUR prices converted to TRY, and the settings the model reads.
  const operationsWorkspaceForFinance = withTryOperationWorkspace(operationsWorkspace, exchangeRates);
  const financialSettingsForModel = {
    ...financialSettingsForm,
    exchangeRates,
  };
  const {
    addSalesItem,
    addSimulationVariant,
    deleteSimulationVariant,
    handleSaveSalesStrategy,
    loadPlanningData,
    persistSimulationVariant,
    planningLoaded,
    removeSalesItem,
    salesLoading,
    salesStatus,
    salesStrategy,
    setSalesStatus,
    setPlanningLoaded,
    setSalesStrategy,
    setSimulationStatus,
    setSimulationVariants,
    simulationLoading,
    simulationStatus,
    simulationVariants,
    updateSalesChannelSeasonality,
    updateSalesCompany,
    updateSalesForecast,
    updateSalesItem,
    updateSimulationParameter,
    updateSimulationVariant,
  } = usePlanning({
    copy,
    currentProfile,
    financialHorizon,
    financialModel,
    financialSettingsForModel,
    goTo,
    labels,
    markWorkspaceSnapshotClean,
    operationsWorkspace,
    operationsWorkspaceForFinance,
    routePath,
  });

  const activeModule = dashboardModules.find((module) => module.path === routePath);
  const activeOperationsSubmodule = operationsSubmodules.find((module) => module.path === routePath);
  const activeFinancialSubmodule = financialSubmodules.find((module) => module.path === routePath);
  const activeSimulationVariant = simulationVariants.find((variant) => variant.path === routePath);
  const isOperationsRoute = routePath === "/operations" || routePath.startsWith("/operations/");
  const isFinancialRoute = routePath.startsWith("/financial-modelling/");
  const isSimulationRoute = routePath.startsWith("/simulation/");
  const { closeUnsavedPrompt, handleLeaveWithoutSaving, handleSaveUnsavedAndContinue, unsavedPrompt } =
    useUnsavedChanges({
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
    });
  const {
    activePlanResults,
    activeReportTab,
    buildExportReport,
    dashboardCompanyName,
    dashboardProductSelectLabel,
    dashboardRiskPriority,
    dashboardRiskRows,
    dashboardSelectedProductId,
    decisionBasis,
    decisionKpis,
    downloadReport,
    feasibilityChecklist,
    feasibilityVerdict,
    financialHorizonOptions,
    getSensitivityCaseLabel,
    hasFinancialAssumptions,
    hasFinancialSourceData,
    hasOperationData,
    hasSalesForecast,
    periodLabel,
    reportFormats,
    reportTabs,
    setReportsTab,
  } = useWorkspaceSummary({
    copy,
    currentProfile,
    financialHorizon,
    financialModel,
    financialSettingsForModel,
    financialSettingsForm,
    goTo,
    operationsWorkspace,
    operationsWorkspaceForFinance,
    salesStrategy,
  });

  // Loads every module's data when someone signs in and clears it when they sign out.
  const onSessionChange = useEffectEvent((session) => {
    if (!session || !supabase) {
      setOperationsWorkspace({
        activePlans: [],
        equipment: [],
        latestPlan: null,
        machines: [],
        materials: [],
        notes: [],
        product: null,
        products: [],
        workforce: [],
      });
      setOperationPlan(emptyOperationPlan);
      setOperationPlanResult(null);
      setFinancialModel(emptyFinancialModel);
      setFinancialSettingsForm(defaultFinancialSettings);
      setFinancialExtraCostForm(emptyFinancialExtraCostForm);
      setFinancialStatus("");
      setExchangeRates(defaultExchangeRates);
      setSalesStrategy(emptySalesStrategy);
      setPlanningLoaded(false);
      setSalesStatus("");
      setSimulationVariants([emptySimulationVariant]);
      setSimulationStatus("");
      return;
    }

    loadOperationsData();
    loadFinancialData();
    loadPlanningData();
  });

  useEffect(() => {
    onSessionChange(session);
  }, [session]);

  // With no sections named, every section is recorded.
  function markWorkspaceSnapshotClean(...sections) {
    setWorkspaceCleanRequests((current) => {
      const next = { ...current };
      for (const section of sections.length ? sections : workspaceSections) next[section] = (next[section] || 0) + 1;
      return next;
    });
  }

  // `force` skips the unsaved-changes guard, for moves the user just asked
  // for (opening a new variant, leaving a deleted one, signing out).
  function goTo(pathname, { force = false } = {}) {
    if (window.innerWidth <= 1024) setDashboardSidebarOpen(false);
    setMode("login");
    setStatus("");
    navigate(pathname, { state: force ? { force: true } : null });
  }

  const appContextValue = {
    activeFinancialSubmodule,
    activeModule,
    activeOperationsSubmodule,
    activePlanResults,
    activeReportTab,
    activeSimulationVariant,
    addFinancialLoanRow,
    addProductMaterialRow,
    addProductProcessRow,
    addSalesItem,
    addSimulationVariant,
    authorizationAccess,
    authorizationLoading,
    authorizationStatus,
    authorizationTab,
    buildExportReport,
    buildProductOperationRows,
    closeUnsavedPrompt,
    confirmPassword,
    copy,
    copyOperationRecordToForm,
    currentProfile,
    dashboardCompanyName,
    dashboardModules,
    dashboardProductSelectLabel,
    dashboardRiskPriority,
    dashboardRiskRows,
    dashboardSelectedProductId,
    dashboardSidebarOpen,
    decisionBasis,
    decisionKpis,
    deleteSimulationVariant,
    downloadReport,
    editableAuthorizationRoles,
    exchangeRates,
    feasibilityChecklist,
    feasibilityVerdict,
    financialExtraCostForm,
    financialHorizon,
    financialHorizonOptions,
    financialLoading,
    financialModel,
    financialSettingsForModel,
    financialSettingsForm,
    financialStatementPeriod,
    financialStatus,
    financialSubmodules,
    form,
    getProductFlowDefaults,
    getProductProcessRows,
    getRecipeMaterialId,
    getSensitivityCaseLabel,
    goTo,
    handleCreateManagedUser,
    handleCreateRole,
    handleDashboardProductChange,
    handleDeleteFinancialExtraCost,
    handleDeleteOperationRecord,
    handleFetchExchangeRates,
    handleForgotPassword,
    handleLeaveWithoutSaving,
    handleLogin,
    handleLogout,
    handleResetPassword,
    handleSaveFinancialExtraCost,
    handleSaveFinancialSettings,
    handleSaveOperationPlan,
    handleSaveOperationRecord,
    handleSaveSalesStrategy,
    handleSaveUnsavedAndContinue,
    hasFinancialAssumptions,
    hasFinancialSourceData,
    hasOperationData,
    hasSalesForecast,
    labels,
    loadFinancialData,
    loadOperationsData,
    loadPlanningData,
    loading,
    locale,
    managedUserForm,
    mode,
    moveProductProcessRow,
    normalizeFlowStrategy,
    operationForms,
    operationPlan,
    operationPlanResult,
    operationsLoading,
    operationsStatus,
    operationsSubmodules,
    operationsWorkspace,
    operationsWorkspaceForFinance,
    periodLabel,
    permissionTableColumns,
    permissionTableRows,
    persistSimulationVariant,
    planningLoaded,
    processDefinitionOpen,
    profiles,
    removeFinancialLoanRow,
    removeProductMaterialRow,
    removeProductProcessRow,
    removeSalesItem,
    reportFormats,
    reportTabs,
    roleForm,
    salesLoading,
    salesStatus,
    salesStrategy,
    session,
    setAuthorizationTab,
    setConfirmPassword,
    setDashboardSidebarOpen,
    setFinancialExtraCostForm,
    setFinancialHorizon,
    setFinancialSettingsForm,
    setFinancialStatementPeriod,
    setOperationForms,
    setOperationPlan,
    setOperationPlanResult,
    setOperationsStatus,
    setProcessDefinitionOpen,
    setReportsTab,
    setSalesStrategy,
    setShowConfirmPassword,
    setShowPassword,
    showConfirmPassword,
    showPassword,
    simulationLoading,
    simulationStatus,
    simulationVariants,
    status,
    theme,
    toggleTheme,
    unsavedPrompt,
    updateField,
    updateFinancialLoanRow,
    updateManagedUserForm,
    updateOperationForm,
    updateOperationPlan,
    updateOperationPlanRow,
    updateOperationPlanRowFields,
    updateProductMaterialRow,
    updateProductProcessRow,
    updateProductProcessRowFields,
    updateRoleForm,
    updateSalesChannelSeasonality,
    updateSalesCompany,
    updateSalesForecast,
    updateSalesItem,
    updateSimulationParameter,
    updateSimulationVariant,
    userTableColumns,
  };

  return (
    <AppContext.Provider value={appContextValue}>
      <Outlet />
    </AppContext.Provider>
  );
}

export default App;
