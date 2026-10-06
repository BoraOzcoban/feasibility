import React, { useEffect, useState } from "react";
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
import AuthPage from "./pages/AuthPage";
import AuthorizationPage from "./pages/AuthorizationPage";
import ReportsPage from "./pages/ReportsPage";
import ProcessDefinitionPage from "./pages/ProcessDefinitionPage";
import OperationsOverviewPage from "./pages/OperationsOverviewPage";
import DashboardPage from "./pages/DashboardPage";
import PrintableReportPage from "./pages/PrintableReportPage";
import FinancialModellingPage from "./pages/FinancialModellingPage";
import SimulationPage from "./pages/SimulationPage";
import SalesStrategyPage from "./pages/SalesStrategyPage";
import MachinesEquipmentPage from "./pages/MachinesEquipmentPage";
import ProductsPage from "./pages/ProductsPage";
import ResourcesPage from "./pages/ResourcesPage";
import ActiveProcessesPage from "./pages/ActiveProcessesPage";
import { withTryOperationWorkspace } from "./lib/exchangeRates";
import { isSignedInRoute, normalizeRoutePath } from "./lib/routes";
import { getNavigation } from "./lib/navigation";

function App() {
  const [path, setPath] = useState(() => normalizeRoutePath(window.location.pathname));
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
  } = useAuth({ goTo, path });

  // Narrow screens start with the menu closed; it overlays the page when opened.
  const [dashboardSidebarOpen, setDashboardSidebarOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth > 1024,
  );
  // Bumped after a load or save; useUnsavedChanges then records the snapshot of
  // the state that load or save produced as the saved one.
  const [workspaceCleanRequest, setWorkspaceCleanRequest] = useState(0);

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
  } = useOperations({ copy, labels, loadFinancialData, markWorkspaceSnapshotClean, path });
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
    removeSalesItem,
    salesLoading,
    salesStatus,
    salesStrategy,
    setSalesStatus,
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
    path,
  });

  const routePath = normalizeRoutePath(path);
  const activeModule = dashboardModules.find((module) => module.path === routePath);
  const activeOperationsSubmodule = operationsSubmodules.find((module) => module.path === routePath);
  const activeFinancialSubmodule = financialSubmodules.find((module) => module.path === routePath);
  const isLegacyFinancialDetailPath = [
    "/financial-modelling/maliyet-hesaplama/urun-maliyeti",
    "/financial-modelling/maliyet-hesaplama/yatirim-maliyeti",
    "/financial-modelling/getiri-hesaplama/urun-getirisi",
    "/financial-modelling/getiri-hesaplama/yatirim-getirisi",
  ].includes(routePath);
  const activeSimulationVariant = simulationVariants.find((variant) => variant.path === routePath);
  const isOperationsRoute = routePath === "/operations" || routePath.startsWith("/operations/");
  const isFinancialRoute = routePath === "/financial-modelling" || routePath.startsWith("/financial-modelling/");
  const isSimulationRoute = routePath === "/simulation" || routePath.startsWith("/simulation/");
  // Bare module URLs and old links point somewhere else. Worked out here and
  // applied in an effect, so rendering never navigates.
  const routeRedirect = !session
    ? null
    : ["/dashboard/riskler-karlilik-mevcut-durum", "/dashboard/kisa-ozet"].includes(routePath)
      ? "/dashboard"
      : isOperationsRoute && routePath !== "/operations" && !activeOperationsSubmodule
        ? ["/operations/material-definitions", "/operations/human-resources"].includes(routePath)
          ? "/operations/resources"
          : "/operations"
        : routePath === "/financial-modelling"
          ? "/financial-modelling/girdiler"
          : isFinancialRoute && !activeFinancialSubmodule
            ? isLegacyFinancialDetailPath
              ? "/financial-modelling/analiz"
              : "/financial-modelling/girdiler"
            : isSimulationRoute && (routePath === "/simulation" || !activeSimulationVariant)
              ? "/simulation/current-situation"
              : null;
  const {
    closeUnsavedPrompt,
    handleLeaveWithoutSaving,
    handleSaveUnsavedAndContinue,
    hasUnsavedChanges,
    setUnsavedPrompt,
    unsavedPrompt,
  } = useUnsavedChanges({
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

  useEffect(() => {
    const nextPath = normalizeRoutePath(window.location.pathname);

    if (nextPath !== window.location.pathname) {
      window.history.replaceState({}, "", nextPath);
    }
  }, []);

  useEffect(() => {
    function handlePopState() {
      const currentPath = window.location.pathname;
      const nextPath = normalizeRoutePath(currentPath);

      if (nextPath !== currentPath) {
        window.history.replaceState({}, "", nextPath);
      }

      if (hasUnsavedChanges && nextPath !== path) {
        window.history.pushState({}, "", path);
        setUnsavedPrompt({
          message: "",
          open: true,
          pendingNavigation: { nextMode: "login", pathname: nextPath },
          saving: false,
        });
        return;
      }

      setPath(nextPath);
      setStatus("");
      setMode("login");
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [hasUnsavedChanges, path, setMode, setStatus, setUnsavedPrompt]);

  useEffect(() => {
    // The app opens on the login screen; the marketing page lives outside the
    // app. Signed-in users on /, /login or a URL no page handles (such as the
    // removed /product-plus pages) go to the dashboard.
    if (mode === "reset") return;
    if (session) {
      if (path === "/" || path === "/login" || !isSignedInRoute(normalizeRoutePath(path))) {
        goTo("/dashboard", "login", { replace: true });
      }
    } else if (path === "/") {
      goTo("/login", "login", { replace: true });
    }
  }, [session, path, mode]);

  useEffect(() => {
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
      setSalesStatus("");
      setSimulationVariants([emptySimulationVariant]);
      setSimulationStatus("");
      return;
    }

    loadOperationsData();
    loadFinancialData();
    loadPlanningData();
  }, [session]);

  function markWorkspaceSnapshotClean() {
    setWorkspaceCleanRequest((count) => count + 1);
  }

  function goTo(pathname, nextMode, options = {}) {
    const nextPath = normalizeRoutePath(pathname);
    if (!options.force && hasUnsavedChanges && nextPath !== path) {
      setUnsavedPrompt({
        message: "",
        open: true,
        pendingNavigation: { nextMode, pathname: nextPath },
        saving: false,
      });
      return;
    }

    // Redirects replace the history entry so Back does not bounce into them again.
    window.history[options.replace ? "replaceState" : "pushState"]({}, "", nextPath);
    if (window.innerWidth <= 1024) setDashboardSidebarOpen(false);
    setPath(nextPath);
    setMode(nextMode);
    setStatus("");
  }

  useEffect(() => {
    if (routeRedirect) goTo(routeRedirect, "login", { force: true, replace: true });
    // goTo is recreated every render; the redirect target is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeRedirect]);

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

  return <AppContext.Provider value={appContextValue}>{renderRoute()}</AppContext.Provider>;

  function renderRoute() {
    if (session && routePath.startsWith("/reports/print/")) {
      return <PrintableReportPage packKey={routePath.split("/")[3]} />;
    }

    if (session && routePath === "/dashboard") {
      return <DashboardPage />;
    }

    if (routeRedirect) return null;

    if (session && (activeModule || isOperationsRoute || isFinancialRoute || isSimulationRoute)) {
      if (routePath === "/operations") {
        return <OperationsOverviewPage />;
      }

      if (activeOperationsSubmodule?.key === "data-entry") {
        return <ProcessDefinitionPage />;
      }

      if (activeOperationsSubmodule?.key === "resources") {
        return <ResourcesPage />;
      }

      if (activeOperationsSubmodule?.key === "active-processes") {
        return <ActiveProcessesPage />;
      }

      if (activeOperationsSubmodule?.key === "machines-equipment") {
        return <MachinesEquipmentPage />;
      }

      if (activeOperationsSubmodule?.key === "products") {
        return <ProductsPage />;
      }

      if (activeModule?.key === "financial-modelling" || activeFinancialSubmodule) {
        return <FinancialModellingPage />;
      }

      if (isSimulationRoute) {
        return <SimulationPage />;
      }

      if (activeModule?.key === "sales-strategy") {
        return <SalesStrategyPage />;
      }

      if (activeModule?.key === "reports") {
        return <ReportsPage />;
      }

      // Every module and sub-page above is handled; anything else was redirected.
      return null;
    }

    if (session && routePath === "/authorization") {
      return <AuthorizationPage />;
    }

    return <AuthPage />;
  }
}

export default App;
