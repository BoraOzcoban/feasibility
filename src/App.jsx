import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import {
  createDemoFinancialLoanRows,
  defaultFinancialSettings,
  emptyFinancialExtraCostForm,
  emptyFinancialModel,
  loadFinancialModel,
  requiredFinancialSettingFields,
  deleteFinancialExtraCost,
  saveFinancialExtraCost,
  saveFinancialModelSettings,
} from "./lib/financialService";
import {
  asObjectArray,
  buildFinancialFeasibilityModel,
  buildSensitivityTable,
  defaultExchangeRates,
  evaluateFeasibilityDecision,
  getFinancialLoanRows,
  getPlanProductId,
  getProjectionMonthCount,
  getSalesForecastForMonth,
  getSalesMultiplierPeriod,
  getTodayDateInputValue,
  hasUsableExchangeRates,
  toFiniteNumber,
} from "./lib/feasibilityModel";
import { getCurrentOperationPlans, hasViablePlanResult } from "./lib/operationsCalculations";
import { deleteOperationRecord, emptyOperationForms, emptyOperationPlan, emptyPlanRows, getRecordInUseCounts, loadOperationsWorkspace, saveOperationRecord, saveOperationResourcePlan } from "./lib/operationsService";
import { deleteSimulationVariantRecord, emptySalesStrategy, emptySimulationVariant, loadSalesStrategy, loadSimulationVariants, saveSalesStrategy, saveSimulationVariant } from "./lib/planningService";
import { buildFeasibilityReport, buildReportSheets } from "./lib/reportExport";
import { AppContext } from "./app/AppContext";
import AuthPage from "./pages/AuthPage";
import AuthorizationPage from "./pages/AuthorizationPage";
import ReportsPage from "./pages/ReportsPage";
import ProcessDefinitionPage from "./pages/ProcessDefinitionPage";
import OperationsOverviewPage from "./pages/OperationsOverviewPage";
import DashboardPage from "./pages/DashboardPage";
import LandingPage from "./pages/LandingPage";
import PrintableReportPage from "./pages/PrintableReportPage";
import FinancialModellingPage from "./pages/FinancialModellingPage";
import SimulationPage from "./pages/SimulationPage";
import SalesStrategyPage from "./pages/SalesStrategyPage";
import MachinesEquipmentPage from "./pages/MachinesEquipmentPage";
import ProductsPage from "./pages/ProductsPage";
import ResourcesPage from "./pages/ResourcesPage";
import ActiveProcessesPage from "./pages/ActiveProcessesPage";
import {
  buildWorkforceRowsFromOperationRows,
  emptyForm,
  emptyManagedUserForm,
  emptyRoleForm,
  isAdminRole,
} from "./lib/appDefaults";
import {
  formatLira,
  formatNumber,
  getCycleTimeMinutes,
  normalizeCycleTimeUnit,
} from "./lib/format";
import { createUnsavedWorkspaceSnapshot } from "./lib/unsavedChanges";
import { fetchExchangeRates, isMissingExchangeRatesTableError, loadLatestExchangeRatesFromSupabase, saveExchangeRatesToSupabase, withTryOperationWorkspace } from "./lib/exchangeRates";
import { text } from "./i18n/text";
import { isSignedInRoute, normalizeRoutePath } from "./lib/routes";

function App() {
  const [mode, setMode] = useState("login");
  const [path, setPath] = useState(() => normalizeRoutePath(window.location.pathname));
  const [form, setForm] = useState(emptyForm);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [theme, setTheme] = useState("light");
  const [profilePreview, setProfilePreview] = useState("");
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(null);
  // Narrow screens start with the menu closed; it overlays the page when opened.
  const [dashboardSidebarOpen, setDashboardSidebarOpen] = useState(() => typeof window === "undefined" || window.innerWidth > 1024);
  const [savedWorkspaceSnapshot, setSavedWorkspaceSnapshot] = useState("");
  const [unsavedPrompt, setUnsavedPrompt] = useState({
    message: "",
    open: false,
    pendingNavigation: null,
    saving: false,
  });
  const [authorizationLoading, setAuthorizationLoading] = useState(false);
  const [authorizationStatus, setAuthorizationStatus] = useState("");
  const [authorizationTab, setAuthorizationTab] = useState("roles");
  const [authorizationAccess, setAuthorizationAccess] = useState({ read: false, write: false });
  const [modules, setModules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [managedUserForm, setManagedUserForm] = useState(emptyManagedUserForm);
  const [financialExtraCostForm, setFinancialExtraCostForm] = useState(emptyFinancialExtraCostForm);
  const [financialHorizon, setFinancialHorizon] = useState("5y");
  const [financialStatementPeriod, setFinancialStatementPeriod] = useState("quarterly");
  const [financialModel, setFinancialModel] = useState(emptyFinancialModel);
  const [financialSettingsForm, setFinancialSettingsForm] = useState(defaultFinancialSettings);
  const [financialStatus, setFinancialStatus] = useState("");
  const [financialLoading, setFinancialLoading] = useState(false);
  const [exchangeRates, setExchangeRates] = useState(defaultExchangeRates);
  const [reportsTab, setReportsTab] = useState("all");
  const [operationForms, setOperationForms] = useState(emptyOperationForms);
  const [operationPlan, setOperationPlan] = useState(emptyOperationPlan);
  const [operationPlanResult, setOperationPlanResult] = useState(null);
  const [processDefinitionOpen, setProcessDefinitionOpen] = useState(false);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [operationsStatus, setOperationsStatus] = useState("");
  const [salesStrategy, setSalesStrategy] = useState(emptySalesStrategy);
  const [salesStatus, setSalesStatus] = useState("");
  const [salesLoading, setSalesLoading] = useState(false);
  const [simulationVariants, setSimulationVariants] = useState([emptySimulationVariant]);
  const [simulationStatus, setSimulationStatus] = useState("");
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [operationsWorkspace, setOperationsWorkspace] = useState({
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

  const labels = text[form.language] || text.en;
  const copy = (en, tr) => (form.language === "tr" ? tr : en);
  const locale = form.language === "tr" ? "tr-TR" : "en-US";
  const workspaceSnapshotRef = useRef("");
  // Bumped after a load or save; the effect below then records the snapshot
  // of the state that load or save produced as the saved one.
  const [workspaceCleanRequest, setWorkspaceCleanRequest] = useState(0);

  const editableWorkspaceSnapshot = useMemo(() => createUnsavedWorkspaceSnapshot({
    financialExtraCostForm,
    financialSettingsForm,
    operationForms,
    operationPlan,
    salesStrategy,
    simulationVariants,
  }), [
    financialExtraCostForm,
    financialSettingsForm,
    operationForms,
    operationPlan,
    salesStrategy,
    simulationVariants,
  ]);
  const hasUnsavedChanges = Boolean(session && savedWorkspaceSnapshot && editableWorkspaceSnapshot !== savedWorkspaceSnapshot);

  useEffect(() => {
    const nextPath = normalizeRoutePath(window.location.pathname);

    if (nextPath !== window.location.pathname) {
      window.history.replaceState({}, "", nextPath);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = form.language;
  }, [form.language]);

  useEffect(() => {
    workspaceSnapshotRef.current = editableWorkspaceSnapshot;
  }, [editableWorkspaceSnapshot]);

  useEffect(() => {
    if (workspaceCleanRequest) setSavedWorkspaceSnapshot(workspaceSnapshotRef.current);
  }, [workspaceCleanRequest]);

  useEffect(() => {
    if (!session) {
      setSavedWorkspaceSnapshot("");
      setUnsavedPrompt((current) => (current.open ? { message: "", open: false, pendingNavigation: null, saving: false } : current));
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

  useEffect(() => {
    if (path === "/operations/data-entry") {
      setProcessDefinitionOpen(false);
    }
  }, [path]);

  useEffect(() => {
    if (!supabase) return;

    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    if (params.get("type") === "recovery") {
      setMode("reset");
    } else {
      setMode("login");
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
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
  }, [hasUnsavedChanges, path]);

  useEffect(() => {
    if (!session || !supabase) {
      setCurrentProfile(null);
      setAuthorizationAccess({ read: false, write: false });
      setModules([]);
      setRoles([]);
      setProfiles([]);
      return;
    }

    loadAuthorizationData();
  }, [session]);

  useEffect(() => {
    // Signed-in users on /login or on a URL no page handles (such as the
    // removed /product-plus pages) go to the dashboard instead of the login form.
    if (session && path !== "/" && mode !== "reset") {
      if (path === "/login" || !isSignedInRoute(normalizeRoutePath(path))) goTo("/dashboard", "login", { replace: true });
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

  useEffect(() => {
    if (!supabase || !currentProfile?.company_id) return;

    let isCurrent = true;
    const controller = new AbortController();

    async function loadExchangeRates() {
      try {
        const latestRates = await loadLatestExchangeRatesFromSupabase(supabase, currentProfile.company_id);

        if (!isCurrent) return;

        if (hasUsableExchangeRates(latestRates)) {
          setExchangeRates(latestRates);
          return;
        }

        setExchangeRates((current) => ({ ...current, error: "", status: "loading" }));

        const nextRates = await fetchExchangeRates(controller.signal);

        if (!isCurrent) return;

        let sourceDetail = "";
        try {
          await saveExchangeRatesToSupabase(supabase, currentProfile.company_id, nextRates);
        } catch (saveError) {
          sourceDetail = isMissingExchangeRatesTableError(saveError) ? "" : `${nextRates.source}, ${copy("could not be saved", "kaydedilemedi")}: ${saveError.message}`;
        }

        setExchangeRates({
          ...nextRates,
          sourceDetail,
        });
      } catch (error) {
        if (!isCurrent || error.name === "AbortError") return;
        setExchangeRates((current) => ({
          ...current,
          error: error.message,
          status: current.status === "idle" ? "error" : current.status,
        }));
      }
    }

    loadExchangeRates();

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [currentProfile?.company_id]);

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

  function handleUseAtera() {
    goTo(session ? "/dashboard" : "/login", "login");
  }

  function updateField(field, value) {
    if (field === "language") {
      if (supabase && session?.user?.id) {
        supabase.from("profiles").update({ language: value }).eq("id", session.user.id).then(({ error }) => {
          if (error) console.warn("Language preference could not be saved.", error);
        });
      }
    }
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateSalesCompany(field, value) {
    setSalesStrategy((current) => ({
      ...current,
      company: { ...(current.company || {}), [field]: value },
    }));
  }

  function updateSalesForecast(index, value) {
    setSalesStrategy((current) => {
      const multiplierPeriod = getSalesMultiplierPeriod(current);
      const monthlyMultipliers = Array.isArray(current.company?.monthlyMultipliers)
        ? [...current.company.monthlyMultipliers]
        : Array.from({ length: 12 }, () => 1);

      if (multiplierPeriod === "quarterly") {
        const startIndex = index * 3;
        for (let offset = 0; offset < 3; offset += 1) {
          monthlyMultipliers[startIndex + offset] = value;
        }
      } else {
        monthlyMultipliers[index] = value;
      }

      return {
        ...current,
        company: {
          ...(current.company || {}),
          monthlyMultipliers,
        },
      };
    });
  }

  function updateSalesItem(collection, id, field, value) {
    setSalesStrategy((current) => ({
      ...current,
      [collection]: current[collection].map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  }

  function updateSalesChannelSeasonality(id, index, value) {
    setSalesStrategy((current) => ({
      ...current,
      channels: current.channels.map((channel) => {
        if (channel.id !== id) return channel;
        const seasonalityCurve = Array.isArray(channel.seasonalityCurve)
          ? [...channel.seasonalityCurve]
          : Array.from({ length: 12 }, () => "");

        seasonalityCurve[index] = value;
        return { ...channel, seasonalityCurve };
      }),
    }));
  }

  function removeSalesItem(collection, id) {
    setSalesStrategy((current) => ({
      ...current,
      [collection]: current[collection].filter((item) => item.id !== id),
    }));
  }

  function addSalesItem(collection) {
    const nextId = `${collection}-${Date.now()}`;
    const defaultProduct = operationsWorkspace.products[0];
    const templates = {
      campaigns: {
        budget: 0,
        channel: "",
        durationDays: 30,
        goal: copy("Campaign objective", "Kampanya hedefi"),
        id: nextId,
        name: copy("New campaign", "Yeni kampanya"),
        typeId: salesStrategy.campaignTypes?.[0]?.id || "digital",
      },
      channels: {
        advancedOpen: false,
        basketSize: "",
        capacityLimit: "",
        churnRatePercent: "",
        commissionPercent: 0,
        conversionRatePercent: "",
        collectionDays: 30,
        customerAcquisitionCost: 0,
        discountRatePercent: "",
        failureProbabilityPercent: "",
        growthMonths1To6Percent: 0,
        growthMonths7To18Percent: 0,
        growthMonths19To24Percent: 0,
        growthYears3To5Percent: 0,
        id: nextId,
        launchFee: "",
        moqMonthly: "",
        monthlySalesUnits: 0,
        name: copy("New channel", "Yeni kanal"),
        productId: defaultProduct?.id || "",
        productName: defaultProduct?.name || "",
        rampUpMonths: "",
        repeatRatePercent: "",
        returnRatePercent: "",
        seasonalityCurve: Array.from({ length: 12 }, () => ""),
        startMonth: 1,
        trafficScore: "",
        typeId: salesStrategy.channelTypes?.[0]?.id || "direct",
        unitSalesPrice: "",
      },
    };

    if (!templates[collection]) return;

    setSalesStrategy((current) => ({
      ...current,
      [collection]: [...current[collection], templates[collection]],
    }));
  }

  function hasRequiredNumber(value) {
    if (value === "" || value === null || value === undefined) return false;
    return Number.isFinite(Number(value));
  }

  function validateSalesStrategy() {
    for (let index = 0; index < salesStrategy.channels.length; index += 1) {
      const channel = salesStrategy.channels[index];
      const label = channel.name?.trim() || `${copy("Channel", "Kanal")} ${index + 1}`;
      const requiredNumbers = [
        [channel.startMonth, copy("Start month", "Başlangıç ayı"), 1],
        [channel.monthlySalesUnits, copy("First month sales", "İlk ay satış"), 0],
        [channel.growthMonths1To6Percent, copy("Growth (1-6 months)", "Büyüme (1-6 ay)"), 0],
        [channel.growthMonths7To18Percent, copy("Growth (7-18 months)", "Büyüme (7-18 ay)"), 0],
        [channel.growthMonths19To24Percent, copy("Growth (19-24 months)", "Büyüme (19-24 ay)"), 0],
        [channel.growthYears3To5Percent, copy("Year 3-5 growth", "Yıl 3-5 büyüme"), 0],
        [channel.collectionDays, copy("Collection days", "Tahsilat günü"), 0],
        [channel.customerAcquisitionCost, copy("Unit marketing CAC", "Birim pazarlama CAC"), 0],
        [channel.commissionPercent, copy("Channel commission", "Kanal komisyonu"), 0],
      ];

      if (!channel.name?.trim()) {
        return copy(`Channel ${index + 1}: channel name is required.`, `Kanal ${index + 1}: kanal adı zorunlu.`);
      }

      if (!channel.typeId) {
        return copy(`${label}: channel type is required.`, `${label}: kanal tipi zorunlu.`);
      }

      if (!channel.productId) {
        return copy(`${label}: product to sell is required.`, `${label}: satılacak ürün zorunlu.`);
      }

      for (const [value, fieldLabel, minimum] of requiredNumbers) {
        if (!hasRequiredNumber(value) || Number(value) < minimum) {
          return copy(`${label}: ${fieldLabel} must be filled.`, `${label}: ${fieldLabel} doldurulmalı.`);
        }
      }
    }

    return "";
  }

  function addFinancialLoanRow() {
    setFinancialSettingsForm((current) => ({
      ...current,
      loanRows: [
        ...(Array.isArray(current.loanRows) ? current.loanRows : []),
        {
          amount: "",
          annualInterestRate: "",
          currency: "TRY",
          gracePeriodMonths: 0,
          id: `loan-${Date.now()}`,
          loanTermMonths: "",
          name: "",
          receivedDate: getTodayDateInputValue(),
        },
      ],
    }));
  }

  function updateFinancialLoanRow(index, field, value) {
    setFinancialSettingsForm((current) => {
      const loanRows = Array.isArray(current.loanRows) ? [...current.loanRows] : [];
      loanRows[index] = { ...loanRows[index], [field]: value };

      return { ...current, loanRows };
    });
  }

  function removeFinancialLoanRow(index) {
    setFinancialSettingsForm((current) => ({
      ...current,
      loanRows: (Array.isArray(current.loanRows) ? current.loanRows : []).filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function updateSimulationVariant(id, field, value) {
    setSimulationVariants((current) => current.map((variant) => {
      if (variant.id !== id) return variant;
      const nextVariant = { ...variant, [field]: value };
      if (field === "name") {
        nextVariant.label = value || variant.label;
      }
      return nextVariant;
    }));
  }

  function updateSimulationParameter(id, field, value) {
    setSimulationVariants((current) => current.map((variant) => (
      variant.id === id
        ? { ...variant, parameters: { ...variant.parameters, [field]: value } }
        : variant
    )));
  }

  function addSimulationVariant() {
    const linkedFinancialModel = buildFinancialFeasibilityModel(financialModel, salesStrategy, financialSettingsForModel, operationsWorkspaceForFinance, financialHorizon);
    const linkedSummary = linkedFinancialModel.summary || emptyFinancialModel.summary;
    const horizonMonths = Math.max(1, getProjectionMonthCount(financialHorizon));
    const monthlySalesUnits = Math.round(
      toFiniteNumber(linkedSummary.netSoldUnits) / horizonMonths ||
      getSalesForecastForMonth(salesStrategy, 0),
    );
    const monthlyProductionUnits = Math.max(
      monthlySalesUnits,
      Math.round(toFiniteNumber(linkedSummary.totalProduced) / horizonMonths),
    );
    const unitSalesPrice = toFiniteNumber(
      linkedSummary.averageNetPrice,
      toFiniteNumber(operationsWorkspaceForFinance.product?.price, toFiniteNumber(operationsWorkspaceForFinance.products[0]?.price)),
    );
    const nextIndex = simulationVariants.length + 1;
    const nextId = `variant-${Date.now()}`;
    const nextVariant = {
      ...emptySimulationVariant,
      id: nextId,
      label: copy("Variant", "Varyant") + ` ${nextIndex}`,
      name: copy("Variant", "Varyant") + ` ${nextIndex}`,
      path: `/simulation/${nextId}`,
      parameters: {
        ...emptySimulationVariant.parameters,
        baseRevenue: Math.round(toFiniteNumber(linkedSummary.salesRevenue)),
        discountPercent: 0,
        fixedCost: Math.round(toFiniteNumber(linkedSummary.extraRecurringCost)),
        grossMargin: linkedSummary.salesRevenue ? Math.max(0, Math.round((toFiniteNumber(linkedSummary.netIncome) / toFiniteNumber(linkedSummary.salesRevenue)) * 100)) : 0,
        marketShare: 0,
        reputationScore: 0,
        marketingBudget: 0,
        productionUnits: monthlyProductionUnits,
        returnRatePercent: 0,
        salesUnits: monthlySalesUnits,
        spoilagePercent: 0,
        timeHorizonMonths: horizonMonths,
        unitSalesPrice,
        variableCostRatio: linkedSummary.salesRevenue ? Math.min(95, Math.round((toFiniteNumber(linkedSummary.totalCost) / toFiniteNumber(linkedSummary.salesRevenue)) * 100)) : 0,
      },
    };

    setSimulationVariants((current) => [...current, nextVariant]);
    goTo(nextVariant.path, "login", { force: true });
  }

  async function deleteSimulationVariant(id) {
    if (id === "current-situation") return;

    setSimulationStatus("");

    if (supabase && currentProfile?.company_id) {
      setSimulationLoading(true);

      try {
        await deleteSimulationVariantRecord(supabase, currentProfile.company_id, id);
        setSimulationStatus(copy("Simulation variant was deleted.", "Simülasyon varyantı silindi."));
      } catch (error) {
        setSimulationStatus(error.message);
      } finally {
        setSimulationLoading(false);
      }
    }

    setSimulationVariants((current) => current.filter((variant) => variant.id !== id));
    if (path === `/simulation/${id}`) goTo("/simulation/current-situation", "login", { force: true });
  }

  function toggleTheme() {
    setTheme((current) => {
      const nextTheme = current === "dark" ? "light" : "dark";

      if (supabase && session?.user?.id) {
        supabase.from("profiles").update({ theme: nextTheme }).eq("id", session.user.id).then(({ error }) => {
          if (error) console.warn("Theme preference could not be saved.", error);
        });
      }

      return nextTheme;
    });
  }

  function updateRoleForm(field, value) {
    setRoleForm((current) => ({ ...current, [field]: value }));
  }

  function updateManagedUserForm(field, value) {
    setManagedUserForm((current) => ({ ...current, [field]: value }));
  }

  function handleDashboardProductChange(productId) {
    const nextProduct = operationsWorkspace.products.find((product) => product.id === productId) || operationsWorkspace.products[0] || null;
    const nextLatestPlan = nextProduct
      ? operationsWorkspace.activePlans.find((plan) => getPlanProductId(plan) === nextProduct.id) || null
      : null;

    setOperationsWorkspace((current) => ({
      ...current,
      latestPlan: nextLatestPlan || current.latestPlan,
      product: nextProduct,
    }));
    setOperationPlan((plan) => ({
      ...plan,
      ...getProductFlowDefaults(nextProduct),
      operationRows: buildProductOperationRows(nextProduct),
      productId: nextProduct?.id || "",
      productName: nextProduct?.name || "",
    }));
    setOperationPlanResult(nextLatestPlan?.result || null);
  }

  async function handleFetchExchangeRates() {
    setExchangeRates((current) => ({ ...current, error: "", status: "loading" }));

    try {
      const nextRates = await fetchExchangeRates();
      let sourceDetail = "";
      if (supabase && currentProfile?.company_id) {
        try {
          await saveExchangeRatesToSupabase(supabase, currentProfile.company_id, nextRates);
        } catch (saveError) {
          sourceDetail = isMissingExchangeRatesTableError(saveError) ? "" : `${nextRates.source}, ${copy("could not be saved", "kaydedilemedi")}: ${saveError.message}`;
        }
      }
      setExchangeRates({
        ...nextRates,
        sourceDetail,
      });
    } catch (error) {
      setExchangeRates((current) => ({
        ...current,
        error: error.message,
        status: "error",
      }));
    }
  }

  function updateOperationPlan(field, value) {
    setOperationPlan((current) => ({ ...current, [field]: value }));
  }

  function normalizeFlowStrategy(value) {
    if (value === "push" || value === "batch") return "push";
    if (value === "pull" || value === "flow" || value === "parallel") return "pull";
    return "pull";
  }

  function getProductFlowDefaults(product) {
    const minimumTransferQuantity = Math.max(
      1,
      toFiniteNumber(product?.minimum_transfer_quantity ?? product?.minimumTransferQuantity, 1),
    );
    const defaultBatchSize = Math.max(
      minimumTransferQuantity,
      toFiniteNumber(product?.default_batch_size ?? product?.defaultBatchSize, minimumTransferQuantity),
    );
    const defaultSafetyStockQuantity = Math.max(
      0,
      toFiniteNumber(product?.default_safety_stock_quantity ?? product?.defaultSafetyStockQuantity, 0),
    );

    return {
      batchSize: defaultBatchSize,
      flowStrategy: normalizeFlowStrategy(product?.default_flow_strategy ?? product?.defaultFlowStrategy),
      minimumTransferQuantity,
      safetyStockQuantity: defaultSafetyStockQuantity,
    };
  }

  function getOperationMachineDefaults(machineId, sourceMachines = operationsWorkspace.machines) {
    const machine = sourceMachines.find((item) => item.id === machineId);

    return {
      capacity: Math.max(1, toFiniteNumber(machine?.concurrent_capacity, 1)),
      dailyHours: Math.max(0, toFiniteNumber(machine?.availability_hours, 8)),
      failureProbabilityPercent: Math.max(0, toFiniteNumber(machine?.failure_probability_percent, 0)),
    };
  }

  function getRecipeMaterialId(row) {
    return row?.material_id || row?.materialId || row?.material?.id || "";
  }

  function getProductProcessRows(product) {
    return asObjectArray(product?.process_rows ?? product?.processRows)
      .slice()
      .sort((a, b) => (
        toFiniteNumber(a.step_order ?? a.stepOrder) - toFiniteNumber(b.step_order ?? b.stepOrder)
      ))
      .map((row, index) => ({
        capacity: Math.max(1, toFiniteNumber(row.capacity, 1)),
        dailyHours: Math.max(0, toFiniteNumber(row.daily_hours ?? row.dailyHours, 8)),
        equipmentId: row.equipment_id ?? row.equipmentId ?? "",
        machineId: row.machine_id ?? row.machineId ?? "",
        materialId: row.material_id ?? row.materialId ?? "",
        materialQuantityPerUnit: Math.max(0, toFiniteNumber(row.material_quantity_per_unit ?? row.materialQuantityPerUnit, 0)),
        operationId: row.id || row.operationId || `${product?.id || "product"}-process-${index + 1}`,
        operationName: row.operation_name ?? row.operationName ?? "",
        peopleAssigned: Math.max(0, toFiniteNumber(row.people_assigned ?? row.peopleAssigned, 1)),
        processTimeMinutes: Math.max(0.0001, toFiniteNumber(row.process_time_minutes ?? row.processTimeMinutes, 1)),
        setupMinutes: Math.max(0, toFiniteNumber(row.setup_minutes ?? row.setupMinutes, 0)),
        speedMultiplier: Math.max(0.0001, toFiniteNumber(row.speed_multiplier ?? row.speedMultiplier, 1)),
        stepOrder: index + 1,
        workforceDailyHours: Math.max(0, toFiniteNumber(row.workforce_daily_hours ?? row.workforceDailyHours, 8)),
        workforceId: row.workforce_id ?? row.workforceId ?? "",
      }));
  }

  function buildProductOperationRows(product) {
    if (!product) return [];

    return getProductProcessRows(product);
  }

  function updateOperationPlanRow(collection, index, field, value) {
    setOperationPlan((current) => ({
      ...current,
      [collection]: (current[collection] || []).map((row, rowIndex) => (
        rowIndex === index
          ? {
              ...row,
              ...(collection === "operationRows" && field === "machineId" ? getOperationMachineDefaults(value) : {}),
              [field]: value,
            }
          : row
      )),
    }));
  }

  function updateOperationPlanRowFields(collection, index, fields) {
    setOperationPlan((current) => ({
      ...current,
      [collection]: (current[collection] || []).map((row, rowIndex) => (
        rowIndex === index ? { ...row, ...fields } : row
      )),
    }));
  }

  function updateOperationForm(entity, field, value) {
    setOperationForms((current) => ({
      ...current,
      [entity]: {
        ...current[entity],
        [field]: value,
      },
    }));
  }

  function copyOperationRecordToForm(entity, row) {
    if (!row || row.id === "empty") return;

    const nextForm = {
      machine: {
        ...emptyOperationForms.machine,
        availabilityHours: row.availability_hours ?? emptyOperationForms.machine.availabilityHours,
        concurrentCapacity: row.concurrent_capacity ?? emptyOperationForms.machine.concurrentCapacity,
        failureProbabilityPercent: row.failure_probability_percent ?? emptyOperationForms.machine.failureProbabilityPercent,
        hourlyEnergyConsumptionKwh: row.hourly_energy_consumption_kwh ?? emptyOperationForms.machine.hourlyEnergyConsumptionKwh,
        name: row.name || "",
        price: row.price ?? emptyOperationForms.machine.price,
        priceCurrency: row.price_currency || emptyOperationForms.machine.priceCurrency,
      },
      equipment: {
        ...emptyOperationForms.equipment,
        name: row.name || "",
        price: row.price ?? emptyOperationForms.equipment.price,
        priceCurrency: row.price_currency || emptyOperationForms.equipment.priceCurrency,
        quantity: row.quantity ?? emptyOperationForms.equipment.quantity,
      },
      material: {
        ...emptyOperationForms.material,
        materialGroup: row.material_group || emptyOperationForms.material.materialGroup,
        name: row.name || "",
        pricePerUnit: row.price_per_unit ?? emptyOperationForms.material.pricePerUnit,
        priceCurrency: row.price_currency || emptyOperationForms.material.priceCurrency,
        unit: row.unit || emptyOperationForms.material.unit,
      },
      workforce: {
        ...emptyOperationForms.workforce,
        hourlyCost: row.hourly_cost ?? emptyOperationForms.workforce.hourlyCost,
        hourlyCostCurrency: row.hourly_cost_currency || emptyOperationForms.workforce.hourlyCostCurrency,
        roleName: row.role_name || "",
      },
    }[entity];

    if (!nextForm) return;

    setOperationForms((current) => ({
      ...current,
      [entity]: nextForm,
    }));
    setOperationsStatus(copy("Record values were copied into the form. Edit and save to create a new record.", "Kayıt değerleri forma kopyalandı. Yeni kayıt oluşturmak için düzenleyip kaydedin."));
  }

  function addProductMaterialRow() {
    setOperationForms((current) => ({
      ...current,
      product: {
        ...current.product,
        materialRows: [
          ...(current.product.materialRows || []),
          {
            materialId: operationsWorkspace.materials[0]?.id || "",
            quantityPerUnit: 0,
          },
        ],
      },
    }));
  }

  function updateProductMaterialRow(index, field, value) {
    setOperationForms((current) => ({
      ...current,
      product: {
        ...current.product,
        materialRows: (current.product.materialRows || []).map((row, rowIndex) => (
          rowIndex === index ? { ...row, [field]: value } : row
        )),
      },
    }));
  }

  function removeProductMaterialRow(index) {
    setOperationForms((current) => {
      const removedMaterialId = current.product.materialRows?.[index]?.materialId;

      return {
        ...current,
        product: {
          ...current.product,
          materialRows: (current.product.materialRows || []).filter((_, rowIndex) => rowIndex !== index),
          processRows: (current.product.processRows || []).map((row) => (
            row.materialId === removedMaterialId
              ? { ...row, materialId: "", materialQuantityPerUnit: 0 }
              : row
          )),
        },
      };
    });
  }

  function addProductProcessRow() {
    setOperationForms((current) => {
      const processRows = current.product.processRows || [];
      const selectedMachine = operationsWorkspace.machines[processRows.length] || operationsWorkspace.machines[0];
      const machineDefaults = getOperationMachineDefaults(selectedMachine?.id);

      return {
        ...current,
        product: {
          ...current.product,
          processRows: [
            ...processRows,
            {
              ...emptyPlanRows.operation,
              ...machineDefaults,
              equipmentId: "",
              machineId: selectedMachine?.id || "",
              materialId: current.product.materialRows?.[0]?.materialId || "",
              materialQuantityPerUnit: current.product.materialRows?.[0]?.quantityPerUnit || 0,
              operationName: `${copy("Process", "Süreç")} ${processRows.length + 1}`,
              peopleAssigned: 1,
              speedMultiplier: 1,
              workforceDailyHours: 8,
              workforceId: operationsWorkspace.workforce[0]?.id || "",
            },
          ],
        },
      };
    });
  }

  function updateProductProcessRow(index, field, value) {
    setOperationForms((current) => ({
      ...current,
      product: {
        ...current.product,
        processRows: (current.product.processRows || []).map((row, rowIndex) => (
          rowIndex === index
            ? {
                ...row,
                ...(field === "machineId" ? getOperationMachineDefaults(value) : {}),
                [field]: value,
              }
            : row
        )),
      },
    }));
  }

  function updateProductProcessRowFields(index, fields) {
    setOperationForms((current) => ({
      ...current,
      product: {
        ...current.product,
        processRows: (current.product.processRows || []).map((row, rowIndex) => (
          rowIndex === index ? { ...row, ...fields } : row
        )),
      },
    }));
  }

  function moveProductProcessRow(index, direction) {
    setOperationForms((current) => {
      const processRows = [...(current.product.processRows || [])];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= processRows.length) return current;
      [processRows[index], processRows[targetIndex]] = [processRows[targetIndex], processRows[index]];

      return {
        ...current,
        product: {
          ...current.product,
          processRows,
        },
      };
    });
  }

  function removeProductProcessRow(index) {
    setOperationForms((current) => ({
      ...current,
      product: {
        ...current.product,
        processRows: (current.product.processRows || []).filter((_, rowIndex) => rowIndex !== index),
      },
    }));
  }

  async function loadOperationsData() {
    if (!supabase) return;

    setOperationsLoading(true);
    setOperationsStatus("");

    try {
      const workspace = await loadOperationsWorkspace(supabase);
      const currentPlans = getCurrentOperationPlans(workspace);
      const currentLatestPlan = currentPlans.find((plan) => plan.id === workspace.latestPlan?.id) || currentPlans[0] || null;
      setOperationsWorkspace(workspace);

      if (workspace.latestPlan) {
        const productFlowDefaults = getProductFlowDefaults(workspace.product);
        const savedMachineRows = asObjectArray(workspace.latestPlan.input?.machineRows);
        const savedMaterialRows = asObjectArray(workspace.latestPlan.input?.materialRows);
        const savedWorkforceRows = asObjectArray(workspace.latestPlan.input?.workforceRows);
        const hasSimplePlanResult = currentLatestPlan?.result?.energyConsumptionKwh !== undefined;

        setOperationPlan({
          ...emptyOperationPlan,
          ...productFlowDefaults,
          ...workspace.latestPlan.input,
          flowStrategy: normalizeFlowStrategy(
            workspace.latestPlan.input?.flowStrategy ?? productFlowDefaults.flowStrategy,
          ),
          machineRows: savedMachineRows.length
            ? savedMachineRows.map((row) => ({
                dailyHours: row.dailyHours || 0,
                machineId: row.machineId || "",
              }))
            : (workspace.machines[0]
                ? [{ ...emptyPlanRows.machine, machineId: workspace.machines[0].id }]
                : []),
          materialRows: savedMaterialRows.length
            ? savedMaterialRows.map((row) => ({
                dailyQuantity: row.dailyQuantity ?? row.quantityPerUnit ?? 0,
                materialId: row.materialId || "",
              }))
            : workspace.materials.slice(0, 2).map((material) => ({
                dailyQuantity: 0,
                materialId: material.id,
              })),
          productId: workspace.latestPlan.input?.productId || workspace.product?.id || "",
          productName: workspace.latestPlan.input?.productName || workspace.product?.name || "",
          safetyStockQuantity: Math.max(
            0,
            toFiniteNumber(
              workspace.latestPlan.input?.safetyStockQuantity,
              productFlowDefaults.safetyStockQuantity,
            ),
          ),
          operationRows: buildProductOperationRows(workspace.product, workspace),
          workforceRows: savedWorkforceRows.length
            ? savedWorkforceRows
            : (workspace.workforce[0]
                ? [{ ...emptyPlanRows.workforce, workforceId: workspace.workforce[0].id }]
                : []),
        });
        setOperationPlanResult(hasSimplePlanResult ? currentLatestPlan.result : null);
      } else if (workspace.product) {
        setOperationPlan((current) => ({
          ...current,
          ...getProductFlowDefaults(workspace.product),
          machineRows: workspace.machines[0]
            ? [{ ...emptyPlanRows.machine, machineId: workspace.machines[0].id }]
            : [],
          materialRows: workspace.materials.length
            ? workspace.materials.slice(0, 2).map((material) => ({
                dailyQuantity: 0,
                materialId: material.id,
              }))
            : [],
          productId: workspace.product.id,
          productName: workspace.product.name || "",
          operationRows: buildProductOperationRows(workspace.product, workspace),
          workforceRows: workspace.workforce[0]
            ? [{ ...emptyPlanRows.workforce, workforceId: workspace.workforce[0].id }]
            : [],
        }));
        setOperationPlanResult(null);
      }
      markWorkspaceSnapshotClean();
    } catch (error) {
      setOperationsStatus(`${copy("Operations data could not be loaded:", "Operasyon verisi yüklenemedi:")} ${error.message}`);
    } finally {
      setOperationsLoading(false);
    }
  }

  async function handleSaveOperationPlan(event) {
    event?.preventDefault?.();
    setOperationsStatus("");

    if (!supabase) {
      setOperationsStatus(labels.configure);
      return false;
    }

    const selectedProduct = operationsWorkspace.products.find((product) => product.id === operationPlan.productId);
    const machineRows = asObjectArray(operationPlan.machineRows);
    const operationRows = buildProductOperationRows(selectedProduct);
    const operationWorkforceRows = buildWorkforceRowsFromOperationRows(operationRows);
    const effectiveWorkforceRows = operationWorkforceRows.length
      ? operationWorkforceRows
      : asObjectArray(operationPlan.workforceRows);
    const productRecipeRows = asObjectArray(selectedProduct?.material_rows);
    const hasPositiveMachineHours = machineRows.some((row) => row.machineId && toFiniteNumber(row.dailyHours) > 0);
    const hasSchedulableOperationRows = operationRows.some((row) => (
      row.machineId &&
      toFiniteNumber(row.processTimeMinutes) > 0 &&
      toFiniteNumber(row.capacity, 1) > 0
    ));

    if (!selectedProduct) {
      setOperationsStatus(copy("Select a saved product with a recipe before calculating feasibility.", "Fizibilite hesaplamadan önce reçetesi olan kayıtlı bir ürün seçin."));
      return false;
    }

    if (!productRecipeRows.some((row) => toFiniteNumber(row.quantity_per_unit) > 0)) {
      setOperationsStatus(copy("Add at least one material with a positive quantity to the selected product recipe before saving a process plan.", "Süreç planını kaydetmeden önce seçili ürün reçetesine pozitif miktarlı en az bir malzeme ekleyin."));
      return false;
    }

    if (!operationRows.length) {
      setOperationsStatus(copy(
        "Define and save the product's ordered process template on the Products screen before creating a process plan.",
        "Süreç planı oluşturmadan önce Ürünler ekranında ürünün sıralı süreç şablonunu tanımlayıp kaydedin.",
      ));
      return false;
    }

    if (!hasPositiveMachineHours && !hasSchedulableOperationRows) {
      setOperationsStatus(copy("Add at least one machine with daily hours, or define an operation step with a machine and process time.", "Günlük saati olan en az bir makine ekleyin ya da makine ve işlem süresi olan bir operasyon adımı tanımlayın."));
      return false;
    }

    if (hasSchedulableOperationRows && toFiniteNumber(operationPlan.targetQuantity) <= 0) {
      setOperationsStatus(copy("Enter a production quantity greater than zero for the operation flow.", "Operasyon akışı için sıfırdan büyük üretim miktarı girin."));
      return false;
    }

    setOperationsLoading(true);

    try {
      const normalizedFlowStrategy = normalizeFlowStrategy(operationPlan.flowStrategy);
      const savedPlan = await saveOperationResourcePlan(supabase, {
        ...operationPlan,
        flowStrategy: normalizedFlowStrategy,
        operationRows,
        safetyStockQuantity: normalizedFlowStrategy === "pull"
          ? Math.max(0, toFiniteNumber(operationPlan.safetyStockQuantity))
          : 0,
        workforceRows: effectiveWorkforceRows,
      });

      setOperationPlan({
        ...emptyOperationPlan,
        ...savedPlan.input,
        flowStrategy: normalizeFlowStrategy(savedPlan.input?.flowStrategy),
      });
      setOperationPlanResult(savedPlan.result);
      await loadOperationsData();
      await loadFinancialData();
      setOperationsStatus(copy(
        "Resource plan was saved and calculated.",
        "Kaynak planı kaydedildi ve hesaplandı.",
      ));
      markWorkspaceSnapshotClean();
      return true;
    } catch (error) {
      setOperationsStatus(error.message);
      return false;
    } finally {
      setOperationsLoading(false);
    }
  }

  async function handleSaveOperationRecord(entity, event) {
    event?.preventDefault?.();
    setOperationsStatus("");

    if (!supabase) {
      setOperationsStatus(labels.configure);
      return false;
    }

    setOperationsLoading(true);

    try {
      const formInput = operationForms[entity];
      const productProcessRows = entity === "product" ? asObjectArray(formInput.processRows) : [];

      if (entity === "product" && !productProcessRows.length) {
        throw new Error(copy(
          "Add at least one ordered process before saving the product.",
          "Ürünü kaydetmeden önce en az bir sıralı süreç ekleyin.",
        ));
      }

      if (entity === "product" && productProcessRows.some((row) => (
        !String(row.operationName || "").trim()
        || !row.machineId
        || toFiniteNumber(row.processTimeMinutes) <= 0
      ))) {
        throw new Error(copy(
          "Every product process needs a name, machine, and positive processing time.",
          "Her ürün sürecinde süreç adı, makine ve pozitif işlem süresi bulunmalıdır.",
        ));
      }

      const recordInput = entity === "product"
        ? {
            ...formInput,
            cycleTimeMinutes: getCycleTimeMinutes(formInput.cycleTimeValue, formInput.cycleTimeUnit),
            cycleTimeUnit: normalizeCycleTimeUnit(formInput.cycleTimeUnit),
            defaultFlowStrategy: normalizeFlowStrategy(formInput.defaultFlowStrategy),
            defaultSafetyStockQuantity: normalizeFlowStrategy(formInput.defaultFlowStrategy) === "pull"
              ? Math.max(0, toFiniteNumber(formInput.defaultSafetyStockQuantity))
              : 0,
            processRows: productProcessRows.map((row, index) => ({
              ...row,
              stepOrder: index + 1,
            })),
            productId: formInput.id || "",
          }
        : formInput;

      await saveOperationRecord(supabase, entity, {
        ...recordInput,
        productId: entity === "product" ? recordInput.productId : operationPlan.productId || operationsWorkspace.product?.id,
      });

      setOperationForms((current) => ({ ...current, [entity]: emptyOperationForms[entity] }));
      await loadOperationsData();
      setOperationsStatus(copy("Operations record was saved.", "Operasyon kaydı kaydedildi."));
      markWorkspaceSnapshotClean();
      return true;
    } catch (error) {
      setOperationsStatus(error.message);
      return false;
    } finally {
      setOperationsLoading(false);
    }
  }

  async function loadFinancialData(nextHorizon = financialHorizon) {
    if (!supabase) return;

    setFinancialHorizon(nextHorizon);
    setFinancialLoading(true);
    setFinancialStatus("");

    try {
      const nextModel = await loadFinancialModel(supabase, nextHorizon);
      const nextSettings = {
        ...defaultFinancialSettings,
        ...(nextModel.settings || {}),
      };
      const loadedLoanRows = Array.isArray(nextSettings.loanRows) && nextSettings.loanRows.length
        ? nextSettings.loanRows
        : getFinancialLoanRows(nextSettings);
      const loanRowsForForm = loadedLoanRows.length ? loadedLoanRows : createDemoFinancialLoanRows();

      setFinancialModel(nextModel);
      setFinancialSettingsForm({
        ...nextSettings,
        loanRows: loanRowsForForm,
      });
      markWorkspaceSnapshotClean();
    } catch (error) {
      setFinancialStatus(`${copy("Financial model could not be loaded:", "Finansal model yüklenemedi:")} ${error.message}`);
    } finally {
      setFinancialLoading(false);
    }
  }

  async function handleSaveFinancialSettings(event) {
    event?.preventDefault?.();
    setFinancialStatus("");

    if (!supabase) {
      setFinancialStatus(labels.configure);
      return false;
    }

    setFinancialLoading(true);

    try {
      await saveFinancialModelSettings(supabase, financialSettingsForm);
      await loadFinancialData();
      // After the reload, which clears the status line.
      setFinancialStatus(copy("Financial assumptions were saved.", "Finansal varsayımlar kaydedildi."));
      markWorkspaceSnapshotClean();
      return true;
    } catch (error) {
      setFinancialStatus(error.message);
      return false;
    } finally {
      setFinancialLoading(false);
    }
  }

  async function handleDeleteOperationRecord(entity, row) {
    const name = row.name || row.role_name || "";
    const question = entity === "product"
      ? copy(`Delete "${name}"? Its recipe, process steps and saved plans are deleted too.`, `"${name}" silinsin mi? Reçetesi, süreç adımları ve kayıtlı planları da silinir.`)
      : copy(`Delete "${name}"?`, `"${name}" silinsin mi?`);
    if (!supabase || !window.confirm(question)) return;

    setOperationsLoading(true);
    try {
      await deleteOperationRecord(supabase, entity, row.id);
      await loadOperationsData();
      await loadFinancialData();
      setOperationsStatus(copy(`"${name}" was deleted.`, `"${name}" silindi.`));
    } catch (error) {
      const inUse = getRecordInUseCounts(error);
      setOperationsStatus(inUse
        ? copy(
          `"${name}" is still used (${inUse.recipes} recipes, ${inUse.processes} process steps, ${inUse.plans} saved plans). Remove it there first.`,
          `"${name}" hâlâ kullanılıyor (${inUse.recipes} reçete, ${inUse.processes} süreç adımı, ${inUse.plans} kayıtlı plan). Önce oradan çıkarın.`,
        )
        : error.message);
    } finally {
      setOperationsLoading(false);
    }
  }

  async function handleDeleteFinancialExtraCost(cost) {
    if (!supabase || !window.confirm(copy(`Delete "${cost.name}"?`, `"${cost.name}" silinsin mi?`))) return;

    setFinancialLoading(true);
    try {
      await deleteFinancialExtraCost(supabase, cost.id);
      await loadFinancialData();
      setFinancialStatus(copy(`"${cost.name}" was deleted.`, `"${cost.name}" silindi.`));
    } catch (error) {
      setFinancialStatus(error.message);
    } finally {
      setFinancialLoading(false);
    }
  }

  async function handleSaveFinancialExtraCost(event) {
    event?.preventDefault?.();
    setFinancialStatus("");

    if (!supabase) {
      setFinancialStatus(labels.configure);
      return false;
    }

    setFinancialLoading(true);

    try {
      await saveFinancialExtraCost(supabase, financialExtraCostForm);
      setFinancialExtraCostForm(emptyFinancialExtraCostForm);
      await loadFinancialData();
      setFinancialStatus(copy("Extra financial cost was saved.", "Ek finansal gider kaydedildi."));
      markWorkspaceSnapshotClean();
      return true;
    } catch (error) {
      setFinancialStatus(error.message);
      return false;
    } finally {
      setFinancialLoading(false);
    }
  }

  async function loadPlanningData() {
    if (!supabase) return;

    setSalesLoading(true);
    setSimulationLoading(true);
    setSalesStatus("");
    setSimulationStatus("");

    try {
      const [nextSalesStrategy, nextSimulationVariants] = await Promise.all([
        loadSalesStrategy(supabase),
        loadSimulationVariants(supabase),
      ]);

      setSalesStrategy(nextSalesStrategy);
      setSimulationVariants(nextSimulationVariants);
      markWorkspaceSnapshotClean();
    } catch (error) {
      setSalesStatus(`${copy("Planning data could not be loaded:", "Planlama verisi yüklenemedi:")} ${error.message}`);
      setSimulationStatus(`${copy("Planning data could not be loaded:", "Planlama verisi yüklenemedi:")} ${error.message}`);
    } finally {
      setSalesLoading(false);
      setSimulationLoading(false);
    }
  }

  async function handleSaveSalesStrategy() {
    setSalesStatus("");

    if (!supabase) {
      setSalesStatus(labels.configure);
      return false;
    }

    if (!currentProfile?.company_id) {
      setSalesStatus(copy("Company profile is still loading.", "Şirket profili henüz yükleniyor."));
      return false;
    }

    const validationMessage = validateSalesStrategy();
    if (validationMessage) {
      setSalesStatus(validationMessage);
      return false;
    }

    setSalesLoading(true);

    try {
      await saveSalesStrategy(supabase, currentProfile.company_id, salesStrategy);
      await loadPlanningData();
      setSalesStatus(copy("Sales strategy was saved.", "Satış stratejisi kaydedildi."));
      markWorkspaceSnapshotClean();
      return true;
    } catch (error) {
      setSalesStatus(error.message);
      return false;
    } finally {
      setSalesLoading(false);
    }
  }

  async function persistSimulationVariant(variant) {
    setSimulationStatus("");

    if (!supabase) {
      setSimulationStatus(labels.configure);
      return false;
    }

    if (!currentProfile?.company_id) {
      setSimulationStatus(copy("Company profile is still loading.", "Şirket profili henüz yükleniyor."));
      return false;
    }

    setSimulationLoading(true);

    try {
      await saveSimulationVariant(supabase, currentProfile.company_id, variant);
      await loadPlanningData();
      setSimulationStatus(copy("Simulation variant was saved.", "Simülasyon varyantı kaydedildi."));
      markWorkspaceSnapshotClean();
      return true;
    } catch (error) {
      setSimulationStatus(error.message);
      return false;
    } finally {
      setSimulationLoading(false);
    }
  }

  // Decision text and KPIs for a 5-year model summary; the dashboard and the
  // report both use it so they never disagree.
  function describeFeasibilityDecision(summary) {
    const decision = evaluateFeasibilityDecision(summary);
    const failedChecks = new Set(decision.checks.filter((check) => !check.ok).map((check) => check.key));
    const reasons = [
      failedChecks.has("npv") && copy(
        `Net present value is negative at a ${formatNumber(summary.discountRateAnnualPercent, 1)}% discount rate: the investment loses value.`,
        `Net bugünkü değer %${formatNumber(summary.discountRateAnnualPercent, 1)} iskonto oranıyla negatif: yatırım değer kaybettiriyor.`,
      ),
      failedChecks.has("payback") && (summary.paybackMonth
        ? copy(
          `Payback takes ${formatNumber(summary.paybackMonth)} months; the limit is ${decision.thresholds.maxPaybackMonths}.`,
          `Geri dönüş ${formatNumber(summary.paybackMonth)} ay sürüyor; sınır ${decision.thresholds.maxPaybackMonths} ay.`,
        )
        : copy("The investment does not pay back within 5 years.", "Yatırım 5 yıl içinde geri dönmüyor.")),
      failedChecks.has("cash") && copy(
        `Cash falls to ${formatLira(summary.lowestCashBalance)}: about ${formatLira(-summary.lowestCashBalance)} more funding is needed.`,
        `Nakit ${formatLira(summary.lowestCashBalance)} seviyesine düşüyor: yaklaşık ${formatLira(-summary.lowestCashBalance)} ek finansman gerekiyor.`,
      ),
      failedChecks.has("capacity") && (summary.capacityUtilization === null
        ? copy("There is demand but no production capacity.", "Talep var ama üretim kapasitesi yok.")
        : copy(
          `Demand is ${formatNumber(summary.capacityUtilization * 100)}% of capacity: some sales cannot be produced.`,
          `Talep kapasitenin %${formatNumber(summary.capacityUtilization * 100)}'i: satışların bir kısmı üretilemiyor.`,
        )),
    ].filter(Boolean);
    const verdictByStatus = {
      feasible: {
        action: copy("Open report pack", "Rapor paketini aç"),
        copy: copy("The investment creates value, pays back in time, cash never runs out and capacity covers demand.", "Yatırım değer yaratıyor, zamanında geri dönüyor, nakit hiç tükenmiyor ve kapasite talebi karşılıyor."),
        label: copy("Feasible", "Uygun"),
        path: "/reports",
        status: "feasible",
        tone: "teal",
      },
      risky: {
        action: copy("Improve plan", "Planı iyileştir"),
        copy: reasons.join(" "),
        label: copy("Risky", "Riskli"),
        path: "/financial-modelling/analiz",
        status: "risky",
        tone: "clay",
      },
      wait: {
        action: copy("Review risks", "Riskleri incele"),
        copy: reasons.join(" "),
        label: copy("Wait", "Beklenmeli"),
        path: "/financial-modelling/analiz",
        status: "wait",
        tone: "amber",
      },
    };
    const kpis = [
      {
        detail: copy(`limit ${decision.thresholds.maxPaybackMonths} months`, `sınır ${decision.thresholds.maxPaybackMonths} ay`),
        key: "payback",
        label: copy("Payback", "Geri dönüş süresi"),
        value: summary.paybackMonth ? `${formatNumber(summary.paybackMonth)} ${copy("mo", "ay")}` : copy("Over 5 years", "5 yıldan uzun"),
      },
      {
        detail: summary.internalRateOfReturn === null
          ? copy(`at ${formatNumber(summary.discountRateAnnualPercent, 1)}% discount rate`, `%${formatNumber(summary.discountRateAnnualPercent, 1)} iskonto oranıyla`)
          : copy(`IRR ${formatNumber(summary.internalRateOfReturn, 1)}% / year`, `İç verim oranı yıllık %${formatNumber(summary.internalRateOfReturn, 1)}`),
        key: "npv",
        label: copy("Net present value", "Net bugünkü değer"),
        value: formatLira(summary.netPresentValue),
      },
      {
        detail: copy("5-year demand / production capacity", "5 yıllık talep / üretim kapasitesi"),
        key: "capacity",
        label: copy("Capacity use", "Kapasite kullanımı"),
        value: summary.capacityUtilization === null ? "-" : `${formatNumber(summary.capacityUtilization * 100)}%`,
      },
      {
        detail: copy("with the entered starting cash", "girilen başlangıç nakdiyle"),
        key: "cash",
        label: copy("Lowest cash", "En düşük nakit"),
        value: formatLira(summary.lowestCashBalance),
      },
    ].map((kpi) => ({ ...kpi, ok: !failedChecks.has(kpi.key) }));

    return { decision, kpis, verdict: verdictByStatus[decision.status] };
  }

  function getSensitivityCaseLabel(row) {
    if (row.lever === "base") return copy("Your plan", "Mevcut plan");
    const lever = { cost: copy("Unit cost", "Birim maliyet"), price: copy("Price", "Fiyat"), volume: copy("Sales volume", "Satış hacmi") }[row.lever];
    return `${lever} ${row.change > 0 ? "+" : "−"}%${formatNumber(Math.abs(row.change * 100))}`;
  }

  function buildExportReport() {
    const exportModel = buildFinancialFeasibilityModel(financialModel, salesStrategy, financialSettingsForModel, operationsWorkspaceForFinance, "5y");

    return buildFeasibilityReport({
      companyName: dashboardCompanyName,
      model: exportModel,
      operationsWorkspace: operationsWorkspaceForFinance,
      productName: dashboardProductName,
      risks: dashboardRiskRows.map((risk) => ({ detail: risk.detail, title: risk.title })),
      salesStrategy,
      sensitivity: buildSensitivityTable(financialModel, salesStrategy, financialSettingsForModel, operationsWorkspaceForFinance).map((row) => ({ ...row, label: getSensitivityCaseLabel(row) })),
      settings: financialSettingsForModel,
      t: copy,
      verdict: hasFinancialSourceData ? describeFeasibilityDecision(exportModel.summary).verdict : feasibilityVerdict,
    });
  }

  async function downloadReport(pack, format) {
    if (format.key === "pdf") {
      goTo(`/reports/print/${pack.key}`, "login");
      return;
    }

    try {
      const { default: writeXlsxFile } = await import("write-excel-file/browser");
      const fileName = `atera-${pack.key}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      await writeXlsxFile(buildReportSheets(buildExportReport(), pack.key, copy)).toFile(fileName);
    } catch (error) {
      window.alert(`${copy("The spreadsheet could not be created:", "Tablo oluşturulamadı:")} ${error.message}`);
    }
  }

  function normalizeRole(role) {
    const permissions = {};

    for (const permission of role.role_permissions || []) {
      const moduleKey = permission.module?.module_key;
      if (!moduleKey) continue;

      permissions[moduleKey] = {
        id: permission.id,
        moduleId: permission.module_id,
        canRead: permission.can_read,
        canWrite: permission.can_write,
      };
    }

    return { ...role, permissions };
  }

  async function loadAuthorizationData() {
    if (!supabase || !session) return;

    setAuthorizationLoading(true);
    setAuthorizationStatus("");

    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*, company:companies(name)")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;

      setCurrentProfile(profile);
      setProfilePreview(profile?.profile_picture_url ? await resolveProfilePicturePreview(profile.profile_picture_url) : "");
      if (profile?.language && ["en", "tr"].includes(profile.language)) {
        setForm((current) => ({ ...current, language: profile.language }));
      }
      if (profile?.theme && ["light", "dark"].includes(profile.theme)) {
        setTheme(profile.theme);
      }

      const [{ data: canRead }, { data: canWrite }] = await Promise.all([
        supabase.rpc("has_module_permission", { p_module_key: "authorization", p_permission: "read" }),
        supabase.rpc("has_module_permission", { p_module_key: "authorization", p_permission: "write" }),
      ]);

      const nextAccess = { read: Boolean(canRead), write: Boolean(canWrite) };
      setAuthorizationAccess(nextAccess);

      if (!nextAccess.read) {
        setModules([]);
        setRoles([]);
        setProfiles([]);
        return;
      }

      const [
        { data: moduleRows, error: modulesError },
        { data: roleRows, error: rolesError },
        { data: profileRows, error: profilesError },
      ] = await Promise.all([
        supabase.from("app_modules").select("id, module_key, name").order("name"),
        supabase
          .from("company_roles")
          .select("id, name, description, is_system, role_permissions(id, module_id, can_read, can_write, module:app_modules(id, module_key, name))")
          .order("is_system", { ascending: false })
          .order("name"),
        supabase
          .from("profiles")
          .select("id, username, email, phone_number, department, access_level, language, theme, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (modulesError) throw modulesError;
      if (rolesError) throw rolesError;
      if (profilesError) throw profilesError;

      setModules(moduleRows || []);
      setRoles((roleRows || []).map(normalizeRole));
      setProfiles(profileRows || []);
    } catch (error) {
      setAuthorizationStatus(`${labels.loadAuthorizationError} ${error.message}`);
      setAuthorizationAccess({ read: false, write: false });
      setModules([]);
      setRoles([]);
      setProfiles([]);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  async function handleCreateRole(event) {
    event.preventDefault();
    setAuthorizationStatus("");

    if (!supabase || !currentProfile?.company_id || !authorizationAccess.write) return;

    const nextName = roleForm.name.trim().toLowerCase();
    if (!nextName) return;
    if (isAdminRole(nextName)) {
      setAuthorizationStatus(copy("Admin role is managed by the system and cannot be recreated or edited here.", "Admin rolü sistem tarafından yönetilir; burada yeniden oluşturulamaz veya düzenlenemez."));
      return;
    }

    setAuthorizationLoading(true);
    try {
      const { data: role, error: roleError } = await supabase
        .from("company_roles")
        .insert({
          company_id: currentProfile.company_id,
          name: nextName,
          description: roleForm.description.trim() || null,
        })
        .select("id")
        .single();

      if (roleError) throw roleError;

      if (modules.length) {
        const { error: permissionError } = await supabase.from("role_permissions").insert(
          modules.map((module) => ({
            role_id: role.id,
            module_id: module.id,
            can_read: false,
            can_write: false,
          })),
        );

        if (permissionError) throw permissionError;
      }

      setRoleForm(emptyRoleForm);
      await loadAuthorizationData();
    } catch (error) {
      setAuthorizationStatus(error.message);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  async function updatePermission(role, module, field, checked) {
    if (!supabase || !authorizationAccess.write) return;
    if (isAdminRole(role)) return;

    const existing = role.permissions[module.module_key];
    const nextPermission = {
      can_read: field === "can_read" ? checked : Boolean(existing?.canRead),
      can_write: field === "can_write" ? checked : Boolean(existing?.canWrite),
    };

    setAuthorizationLoading(true);
    setAuthorizationStatus("");

    try {
      const payload = {
        role_id: role.id,
        module_id: module.id,
        ...nextPermission,
      };

      const query = existing?.id
        ? supabase.from("role_permissions").update(nextPermission).eq("id", existing.id)
        : supabase.from("role_permissions").insert(payload);

      const { error } = await query;
      if (error) throw error;

      await loadAuthorizationData();
    } catch (error) {
      setAuthorizationStatus(error.message);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  async function handleCreateManagedUser(event) {
    event.preventDefault();
    setAuthorizationStatus("");

    if (!supabase || !currentProfile?.company_id || !authorizationAccess.write) return;

    setAuthorizationLoading(true);
    try {
      // Users are created server-side so the company comes from the caller's
      // profile, never from sign-up metadata the browser controls.
      const { data, error } = await supabase.functions.invoke("create-company-user", {
        body: {
          accessLevel: managedUserForm.accessLevel,
          department: managedUserForm.department.trim(),
          email: managedUserForm.email.trim(),
          language: managedUserForm.language,
          password: managedUserForm.password,
          phoneNumber: managedUserForm.phoneNumber.trim(),
          theme,
          username: managedUserForm.username.trim(),
        },
      });

      if (error) {
        const detail = await error.context?.json?.().catch(() => null);
        throw new Error(detail?.error || error.message);
      }
      if (!data?.userId) throw new Error(labels.missingUser);

      setManagedUserForm({ ...emptyManagedUserForm, language: form.language });
      await loadAuthorizationData();
      setAuthorizationStatus(labels.userCreated);
    } catch (error) {
      setAuthorizationStatus(error.message);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  async function resolveProfilePicturePreview(storageValue) {
    if (!storageValue || !supabase) return "";
    if (/^https?:\/\//i.test(storageValue)) return storageValue;

    const { data, error } = await supabase.storage
      .from("profile-pictures")
      .createSignedUrl(storageValue, 60 * 60);

    if (error) {
      console.warn("Profile picture preview could not be signed.", error);
      return "";
    }

    return data?.signedUrl || "";
  }

  async function handleLogin(event) {
    event.preventDefault();
    setStatus("");

    if (!supabase) {
      setStatus(labels.configure);
      return;
    }

    setLoading(true);
    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });

      if (error) throw error;

      // Admins can read every profile in their company, so filter to our own.
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("profile_picture_url, language, theme")
        .eq("id", signInData.user.id)
        .maybeSingle();

      setProfilePreview(userProfile?.profile_picture_url ? await resolveProfilePicturePreview(userProfile.profile_picture_url) : "");
      if (userProfile?.language && ["en", "tr"].includes(userProfile.language)) {
        setForm((current) => ({ ...current, language: userProfile.language }));
      }
      if (userProfile?.theme && ["light", "dark"].includes(userProfile.theme)) {
        setTheme(userProfile.theme);
      }
      goTo(path && !["/", "/login"].includes(path) ? path : "/dashboard", "login");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setStatus("");

    if (!supabase) {
      setStatus(labels.configure);
      return;
    }

    const resetEmail = form.email || window.prompt(labels.forgotEmailPrompt)?.trim();

    if (!resetEmail) {
      setStatus(labels.needEmail);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/login`,
    });

    setStatus(error ? error.message : labels.resetSent);
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setStatus("");

    if (!supabase) {
      setStatus(labels.configure);
      return;
    }

    if (form.password.length < 6) {
      setStatus(labels.passwordTooShort);
      return;
    }

    if (form.password !== confirmPassword) {
      setStatus(labels.passwordMismatch);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: form.password });
    setLoading(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus(labels.passwordUpdated);
    goTo("/login", "login");
    updateField("password", "");
    setConfirmPassword("");
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    goTo("/login", "login");
  }

  const references = [
    { name: copy("Production Planning", "Üretim Planlama"), mark: "PP", tone: "teal" },
    { name: copy("Feasibility Model", "Fizibilite Modeli"), mark: "FM", tone: "cyan" },
    { name: copy("Cash Scenario", "Nakit Senaryosu"), mark: "CS", tone: "amber" },
    { name: copy("Sales Route", "Satış Rotası"), mark: "SR", tone: "green" },
    { name: copy("Risk Review", "Risk Analizi"), mark: "RR", tone: "clay" },
  ];

  const personas = [
    {
      avatarType: "planning",
      title: labels.farmerPersona,
      need: labels.farmerNeed,
      benefit: labels.farmerBenefit,
      difference: labels.farmerDifference,
    },
    {
      avatarType: "production",
      title: labels.factoryOwnerPersona,
      need: labels.factoryOwnerNeed,
      benefit: labels.factoryOwnerBenefit,
      difference: labels.factoryOwnerDifference,
    },
    {
      avatarType: "finance",
      title: labels.entrepreneurPersona,
      need: labels.entrepreneurNeed,
      benefit: labels.entrepreneurBenefit,
      difference: labels.entrepreneurDifference,
    },
    {
      avatarType: "operations",
      title: labels.exporterPersona,
      need: labels.exporterNeed,
      benefit: labels.exporterBenefit,
      difference: labels.exporterDifference,
    },
  ];

  const dashboardModules = [
    { key: "operations", path: "/operations", label: copy("Operations", "Operasyon"), category: copy("Production", "Üretim"), tone: "operations" },
    { key: "sales-strategy", path: "/sales-strategy", label: copy("Sales Strategy", "Satış Stratejisi"), category: copy("Market", "Pazar"), tone: "sales" },
    { key: "financial-modelling", path: "/financial-modelling", label: copy("Financial Modelling", "Finansal Modelleme"), category: copy("Finance", "Finans"), tone: "finance" },
    { key: "simulation", path: "/simulation", label: copy("Simulation", "Simülasyon"), category: copy("Decision", "Karar"), tone: "decision" },
    { key: "reports", path: "/reports", label: copy("Reports", "Raporlar"), category: copy("Output", "Çıktı"), tone: "reports" },
  ];
  const operationsSubmodules = [
    { key: "resources", path: "/operations/resources", label: copy("Resources", "Kaynak") },
    { key: "products", path: "/operations/products", label: copy("Products", "Ürünler") },
    { key: "machines-equipment", path: "/operations/machines-equipment", label: copy("Machines & Equipment", "Makine & Ekipman") },
    { key: "data-entry", path: "/operations/data-entry", label: copy("Process Definition", "Süreç Tanımlama") },
    { key: "active-processes", path: "/operations/active-processes", label: copy("Active Processes", "Mevcut Süreçler") },
  ];
  const financialSubmodules = [
    { group: copy("Inputs", "Girdiler"), key: "inputs", path: "/financial-modelling/girdiler", label: copy("Inputs", "Girdiler") },
    { group: copy("Loans", "Krediler"), key: "loans", path: "/financial-modelling/krediler", label: copy("Loans", "Krediler") },
    { group: copy("Analysis", "Analiz"), key: "overview", path: "/financial-modelling/analiz", label: copy("Cost & Return", "Maliyet & Getiri") },
  ];

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
        ? (["/operations/material-definitions", "/operations/human-resources"].includes(routePath) ? "/operations/resources" : "/operations")
        : routePath === "/financial-modelling"
          ? "/financial-modelling/girdiler"
          : isFinancialRoute && !activeFinancialSubmodule
            ? (isLegacyFinancialDetailPath ? "/financial-modelling/analiz" : "/financial-modelling/girdiler")
            : isSimulationRoute && (routePath === "/simulation" || !activeSimulationVariant)
              ? "/simulation/current-situation"
              : null;

  useEffect(() => {
    if (routeRedirect) goTo(routeRedirect, "login", { force: true, replace: true });
    // goTo is recreated every render; the redirect target is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeRedirect]);

  const editableAuthorizationRoles = roles.filter((role) => !isAdminRole(role));
  const moduleLabelByKey = Object.fromEntries(dashboardModules.map((module) => [module.key, module.label]));
  const getModuleLabel = (module) => moduleLabelByKey[module.module_key] || module.name;
  const userTableColumns = [
    { header: labels.username, key: "username", render: (row) => row.username, value: (row) => row.username },
    { header: labels.email, key: "email", render: (row) => row.email, value: (row) => row.email },
    { header: labels.department, key: "department", render: (row) => row.department || "-", value: (row) => row.department || "" },
    { header: labels.accessLevel, key: "access-level", render: (row) => row.access_level, value: (row) => row.access_level },
  ];
  const permissionTableRows = editableAuthorizationRoles.flatMap((role) => modules.map((module) => {
    const permission = role.permissions[module.module_key] || {};
    return {
      canRead: Boolean(permission.canRead),
      canWrite: Boolean(permission.canWrite),
      id: `${role.id}-${module.id}`,
      module,
      moduleLabel: getModuleLabel(module),
      role,
      roleName: role.name,
    };
  }));
  const permissionTableColumns = [
    { header: labels.accessLevel, key: "role", render: (row) => row.roleName, value: (row) => row.roleName },
    { header: labels.module, key: "module", render: (row) => row.moduleLabel, value: (row) => row.moduleLabel },
    {
      header: labels.readPermission,
      key: "read",
      render: (row) => (
        <label className="permission-check">
          <input
            checked={row.canRead}
            disabled={!authorizationAccess.write || authorizationLoading}
            type="checkbox"
            onChange={(event) => updatePermission(row.role, row.module, "can_read", event.target.checked)}
          />
          <span>{labels.readPermission}</span>
        </label>
      ),
      sortValue: (row) => (row.canRead ? 1 : 0),
      filterValue: (row) => (row.canRead ? labels.readPermission : copy("No read", "Okuma yok")),
    },
    {
      header: labels.writePermission,
      key: "write",
      render: (row) => (
        <label className="permission-check">
          <input
            checked={row.canWrite}
            disabled={!authorizationAccess.write || authorizationLoading}
            type="checkbox"
            onChange={(event) => updatePermission(row.role, row.module, "can_write", event.target.checked)}
          />
          <span>{labels.writePermission}</span>
        </label>
      ),
      sortValue: (row) => (row.canWrite ? 1 : 0),
      filterValue: (row) => (row.canWrite ? labels.writePermission : copy("No write", "Yazma yok")),
    },
  ];
  const operationsWorkspaceForFinance = withTryOperationWorkspace(operationsWorkspace, exchangeRates);
  const dashboardSelectedProduct = operationsWorkspace.product || operationsWorkspace.products[0] || null;
  const dashboardSelectedProductId = dashboardSelectedProduct?.id || "";
  const dashboardScopedActivePlans = dashboardSelectedProductId
    ? operationsWorkspaceForFinance.activePlans.filter((plan) => getPlanProductId(plan) === dashboardSelectedProductId)
    : operationsWorkspaceForFinance.activePlans;
  const dashboardScopedLatestPlan = dashboardSelectedProductId
    ? dashboardScopedActivePlans.find((plan) => plan.id === operationsWorkspaceForFinance.latestPlan?.id) || dashboardScopedActivePlans[0] || null
    : operationsWorkspaceForFinance.latestPlan;
  const dashboardOperationsWorkspace = {
    ...operationsWorkspaceForFinance,
    activePlans: dashboardScopedActivePlans,
    latestPlan: dashboardScopedLatestPlan,
    product: dashboardSelectedProduct,
  };
  const dashboardSalesStrategy = dashboardSelectedProductId
    ? {
        ...salesStrategy,
        channels: salesStrategy.channels.filter((channel) => (channel.productId || channel.product_id) === dashboardSelectedProductId),
      }
    : salesStrategy;
  const financialSettingsForModel = {
    ...financialSettingsForm,
    exchangeRates,
  };
  const projectedFinancialModel = buildFinancialFeasibilityModel(financialModel, dashboardSalesStrategy, financialSettingsForModel, dashboardOperationsWorkspace, financialHorizon);
  const financialSummary = projectedFinancialModel.summary || emptyFinancialModel.summary;
  // The decision always looks five years ahead, whatever horizon the screen shows.
  const decisionSummary = financialHorizon === "5y"
    ? financialSummary
    : (buildFinancialFeasibilityModel(financialModel, dashboardSalesStrategy, financialSettingsForModel, dashboardOperationsWorkspace, "5y").summary || emptyFinancialModel.summary);
  const financialCostWarnings = financialSummary.costWarnings || {};
  const missingCostInputs = [
    ...(financialCostWarnings.missingMaterialPrices || []),
    ...(financialCostWarnings.missingWorkforceRates || []),
    ...(financialCostWarnings.missingElectricityPrice ? [copy("electricity price", "elektrik fiyatı")] : []),
  ];
  const financialMonthCount = getProjectionMonthCount(financialHorizon);
  const currentOperationPlans = getCurrentOperationPlans(dashboardOperationsWorkspace);
  const activePlanResults = currentOperationPlans.map((plan) => plan.result || {}).filter(hasViablePlanResult);
  const dashboardProductName = dashboardSelectedProduct?.name || copy("Product input needed", "Ürün girdisi gerekli");
  const dashboardCompanyName = currentProfile?.company?.name || currentProfile?.company_id || "Atera";
  const hasOperationData = Boolean(operationsWorkspace.products.length || operationsWorkspace.machines.length || operationsWorkspace.materials.length || operationsWorkspace.workforce.length || activePlanResults.length);
  const hasSalesForecast = dashboardSalesStrategy.channels.some((channel) => channel.productId && toFiniteNumber(channel.monthlySalesUnits) > 0);
  const hasFinancialSourceData = Boolean(activePlanResults.length && hasSalesForecast && financialModel.settingsSaved);
  const monthlyNet = financialMonthCount ? toFiniteNumber(financialSummary.netIncome) / financialMonthCount : 0;
  const financialHorizonOptions = [
    ["6m", copy("Next 6 months", "Gelecek 6 ay")],
    ["1y", copy("Next 12 months", "Gelecek 12 ay")],
    ["5y", copy("Next 60 months", "Gelecek 60 ay")],
  ];
  const periodLabel = financialHorizonOptions.find(([value]) => value === financialHorizon)?.[1] || financialHorizonOptions[0][1];
  const dashboardProductSelectLabel = dashboardSelectedProduct
    ? dashboardSelectedProduct.name || dashboardSelectedProduct.product_code || copy("Unnamed product", "İsimsiz ürün")
    : copy("No products yet", "Henüz ürün yok");
  const reportTabs = [
    {
      detail: copy("A concise decision pack for investors, founders, and management meetings.", "Yatırımcı, kurucu ve yönetim toplantıları için kısa karar paketi."),
      includes: [copy("Executive overview", "Yönetici özeti"), copy("Cost & return", "Maliyet & getiri"), copy("Scenario signals", "Senaryo sinyalleri")],
      key: "executive",
      label: copy("Executive Decision Pack", "Yönetici Karar Paketi"),
      tone: "blue",
    },
    {
      detail: copy("Financial assumptions, income-expense projection, cash needs, ROI, and payback.", "Finansal varsayımlar, gelir-gider projeksiyonu, nakit ihtiyacı, ROI ve geri dönüş."),
      includes: [copy("Income / expense", "Gelir / gider"), copy("Cash flow", "Nakit akışı"), copy("Investment return", "Yatırım getirisi")],
      key: "financial",
      label: copy("Financial Export", "Finansal Export"),
      tone: "violet",
    },
    {
      detail: copy("Production capacity, resource plan, process outputs, cycle time, and tracked cost.", "Üretim kapasitesi, kaynak planı, süreç çıktıları, çevrim süresi ve takip edilen maliyet."),
      includes: [copy("Process plan", "Süreç planı"), copy("Capacity", "Kapasite"), copy("Tracked cost", "Takip edilen maliyet")],
      key: "operations",
      label: copy("Operations Export", "Operasyon Export"),
      tone: "teal",
    },
    {
      detail: copy("Sales channels, forecast, campaign inputs, market assumptions, and revenue quality.", "Satış kanalları, tahmin, kampanya girdileri, pazar varsayımları ve gelir kalitesi."),
      includes: [copy("Sales forecast", "Satış tahmini"), copy("Channels", "Kanallar"), copy("Revenue quality", "Gelir kalitesi")],
      key: "sales",
      label: copy("Sales Export", "Satış Export"),
      tone: "lime",
    },
    {
      detail: copy("A full model export that combines operations, sales, finance, and simulation outputs.", "Operasyon, satış, finans ve simülasyon çıktılarını birleştiren tam model exportu."),
      includes: [copy("Full model", "Tam model"), copy("All modules", "Tüm modüller"), copy("Appendix", "Ekler")],
      key: "full",
      label: copy("Full Feasibility Pack", "Tam Fizibilite Paketi"),
      tone: "pink",
    },
  ];
  const activeReportTab = reportTabs.find((tab) => tab.key === reportsTab) || reportTabs[0];
  const reportFormats = [
    { extension: "pdf", key: "pdf", label: "PDF", mime: "application/pdf", note: copy("print-ready report", "yazdırmaya hazır rapor") },
    { extension: "xlsx", key: "xlsx", label: "XLSX", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", note: copy("spreadsheet model extract", "tablo model çıktısı") },
  ];
  const reportStats = [
    [copy("Selected pack", "Seçili paket"), activeReportTab.label, copy("choose one report type", "tek rapor türü seçin")],
    [copy("Output formats", "Çıktı formatları"), "PDF / XLSX", copy("built from current data", "güncel veriden üretilir")],
    [copy("Storage", "Kayıt"), copy("Local file", "Lokal dosya"), copy("not archived", "arşivlenmez")],
    [copy("Period", "Dönem"), periodLabel, copy("uses current horizon", "mevcut ufku kullanır")],
  ];
  const hasFinancialAssumptions = Boolean(financialModel.settingsSaved) && requiredFinancialSettingFields.every((field) => (
    financialSettingsForm[field] !== "" &&
    financialSettingsForm[field] !== null &&
    financialSettingsForm[field] !== undefined &&
    Number.isFinite(Number(financialSettingsForm[field]))
  ));
  const feasibilityChecklist = [
    {
      action: copy("Add Product", "Ürün Ekle"),
      done: operationsWorkspace.products.length > 0,
      label: copy("Product, price, and recipe", "Ürün, fiyat ve reçete"),
      path: "/operations/products",
    },
    {
      action: copy("Save Process Plan", "Süreç Planı Kaydet"),
      done: activePlanResults.length > 0,
      label: copy("Daily production capacity and cost", "Günlük üretim kapasitesi ve maliyeti"),
      path: "/operations/data-entry",
    },
    {
      action: copy("Add Sales Channel", "Satış Kanalı Ekle"),
      done: hasSalesForecast,
      label: copy("Product-linked sales forecast", "Ürüne bağlı satış tahmini"),
      path: "/sales-strategy",
    },
    {
      action: copy("Review Finance", "Finansı Kontrol Et"),
      done: hasFinancialAssumptions,
      label: copy("Cash, tax, stock, and payment assumptions", "Nakit, vergi, stok ve ödeme varsayımları"),
      path: "/financial-modelling/girdiler",
    },
  ];
  const missingFeasibilityItem = feasibilityChecklist.find((item) => !item.done);
  const unmetForecastUnits = hasFinancialSourceData
    ? Math.max(0, toFiniteNumber(financialSummary.forecastSalesUnits) - toFiniteNumber(financialSummary.netSoldUnits))
    : 0;
  const { kpis: decisionKpis, verdict: decisionVerdict } = describeFeasibilityDecision(decisionSummary);
  const feasibilityVerdict = !hasFinancialSourceData
    ? {
        action: missingFeasibilityItem?.action || copy("Complete Inputs", "Girdileri Tamamla"),
        copy: copy("Complete the basic product, process, sales, and finance inputs before using this as a decision report.", "Bunu karar raporu olarak kullanmadan önce temel ürün, süreç, satış ve finans girdilerini tamamlayın."),
        label: copy("Not decision-ready", "Karar için hazır değil"),
        path: missingFeasibilityItem?.path || "/operations/products",
        status: "pending",
        tone: "amber",
      }
    : decisionVerdict;
  const decisionBasis = copy(
    `5-year projection, ${formatNumber(decisionSummary.discountRateAnnualPercent, 1)}% discount rate`,
    `5 yıllık projeksiyon, %${formatNumber(decisionSummary.discountRateAnnualPercent, 1)} iskonto oranı`,
  );
  const dashboardRiskPriority = {
    high: 1,
    medium: 2,
    low: 3,
    controlled: 4,
  };
  const dashboardRiskRows = [
    !operationsWorkspace.products.length && {
      action: copy("Add product", "Ürün ekle"),
      detail: copy("Without product price and recipe, cost and revenue are not decision-grade.", "Ürün fiyatı ve reçete olmadan maliyet ve ciro karar seviyesinde değildir."),
      path: "/operations/products",
      priority: dashboardRiskPriority.high,
      readinessItem: true,
      severity: copy("Blocker", "Engel"),
      tone: "risk-high",
      title: copy("Product definition missing", "Ürün tanımı eksik"),
    },
    !activePlanResults.length && {
      action: copy("Save process", "Süreç kaydet"),
      detail: copy("Capacity, labor, material, and energy must come from a saved daily process plan.", "Kapasite, işçilik, malzeme ve enerji kayıtlı günlük süreç planından gelmeli."),
      path: "/operations/data-entry",
      priority: dashboardRiskPriority.high,
      readinessItem: true,
      severity: copy("Blocker", "Engel"),
      tone: "risk-high",
      title: copy("Production plan missing", "Üretim planı eksik"),
    },
    !hasSalesForecast && {
      action: copy("Add sales forecast", "Satış tahmini ekle"),
      detail: copy("Demand, revenue, unmet sales, and inventory risk require product-linked sales channels.", "Talep, ciro, karşılanmayan satış ve stok riski ürüne bağlı satış kanalları ister."),
      path: "/sales-strategy",
      priority: dashboardRiskPriority.high,
      readinessItem: true,
      severity: copy("Blocker", "Engel"),
      tone: "risk-high",
      title: copy("Sales forecast missing", "Satış tahmini eksik"),
    },
    !hasFinancialAssumptions && {
      action: copy("Complete finance", "Finansı tamamla"),
      detail: copy("Cash runway, payback, taxes, and working capital need saved financial assumptions.", "Nakit dayanma, geri dönüş, vergiler ve işletme sermayesi kayıtlı finans varsayımları ister."),
      path: "/financial-modelling/girdiler",
      priority: dashboardRiskPriority.high,
      readinessItem: true,
      severity: copy("High", "Yüksek"),
      tone: "risk-high",
      title: copy("Financial assumptions incomplete", "Finans varsayımları eksik"),
    },
    activePlanResults.length > 0 && missingCostInputs.length > 0 && {
      action: copy("Complete prices", "Fiyatları tamamla"),
      detail: `${copy("Counted as zero cost:", "Sıfır maliyetle hesaplanıyor:")} ${missingCostInputs.join(", ")}`,
      path: "/operations/resources",
      priority: dashboardRiskPriority.high,
      severity: copy("High", "Yüksek"),
      tone: "risk-high",
      title: copy("Cost data missing", "Maliyet verisi eksik"),
    },
    (financialCostWarnings.capacityLimitedPlans || []).length > 0 && {
      action: copy("Review process plan", "Süreç planını gözden geçir"),
      detail: (financialCostWarnings.capacityLimitedPlans || [])
        .map((plan) => `${plan.planName}: ${formatNumber(plan.output)} / ${formatNumber(plan.target)} ${copy("units per day fit machine hours", "adet/gün makine süresine sığıyor")}`)
        .join(" · "),
      path: "/operations/active-processes",
      priority: dashboardRiskPriority.high,
      severity: copy("High", "Yüksek"),
      tone: "risk-high",
      title: copy("Plan exceeds machine time", "Plan makine süresini aşıyor"),
    },
    hasFinancialSourceData && unmetForecastUnits > 0 && {
      action: copy("Fix capacity", "Kapasiteyi düzelt"),
      detail: `${formatNumber(unmetForecastUnits)} ${copy("units of forecast demand cannot be produced.", "adet tahmini talep üretilemiyor.")}`,
      path: "/operations/data-entry",
      priority: dashboardRiskPriority.high,
      severity: copy("High", "Yüksek"),
      tone: "risk-high",
      title: copy("Capacity gap", "Kapasite açığı"),
    },
    hasFinancialSourceData && financialSummary.unsoldInventoryUnits > 0 && {
      action: copy("Balance output", "Çıktıyı dengele"),
      detail: `${formatNumber(financialSummary.unsoldInventoryUnits)} ${copy("units remain unsold in the selected horizon.", "adet seçilen ufukta satılmadan kalıyor.")}`,
      path: "/sales-strategy",
      priority: dashboardRiskPriority.medium,
      severity: copy("Medium", "Orta"),
      tone: "risk-medium",
      title: copy("Inventory risk", "Stok riski"),
    },
    hasFinancialSourceData && monthlyNet <= 0 && {
      action: copy("Repair margin", "Marjı düzelt"),
      detail: copy("Current pricing, cost, or channel assumptions do not produce positive monthly net.", "Mevcut fiyat, maliyet veya kanal varsayımları pozitif aylık net üretmiyor."),
      path: "/financial-modelling/analiz",
      priority: dashboardRiskPriority.high,
      severity: copy("High", "Yüksek"),
      tone: "risk-high",
      title: copy("Weak profitability", "Zayıf karlılık"),
    },
    hasFinancialSourceData && financialSummary.cashRunwayMonths < Math.min(financialMonthCount, 3) && {
      action: copy("Improve cash", "Nakti iyileştir"),
      detail: copy("Starting cash, financing timing, or non-critical spend should be reviewed.", "Başlangıç nakdi, finansman zamanı veya kritik olmayan harcamalar gözden geçirilmeli."),
      path: "/financial-modelling/girdiler",
      priority: dashboardRiskPriority.high,
      severity: copy("High", "Yüksek"),
      tone: "risk-high",
      title: copy("Short cash runway", "Kısa nakit dayanma"),
    },
  ].filter(Boolean).sort((left, right) => left.priority - right.priority).slice(0, 5);



  function getDirtyOperationFormEntities() {
    return Object.keys(emptyOperationForms).filter((entity) => (
      JSON.stringify(operationForms[entity]) !== JSON.stringify(emptyOperationForms[entity])
    ));
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
        String(financialExtraCostForm.name || "").trim() ||
        toFiniteNumber(financialExtraCostForm.amount) > 0,
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
        message: current.message || copy("Changes could not be saved yet. Please review the current page.", "Değişiklikler henüz kaydedilemedi. Lütfen mevcut sayfayı kontrol edin."),
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
    handleUseAtera,
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
    personas,
    processDefinitionOpen,
    profilePreview,
    profiles,
    references,
    removeFinancialLoanRow,
    removeProductMaterialRow,
    removeProductProcessRow,
    removeSalesItem,
    reportFormats,
    reportStats,
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
      {renderRoute()}
    </AppContext.Provider>
  );

  function renderRoute() {
    if (path === "/") {
      return <LandingPage />;
    }

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
