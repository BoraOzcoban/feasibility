// Sales strategy and simulation variants built on the financial model.
import { useState } from "react";
import {
  buildFinancialFeasibilityModel,
  getProjectionMonthCount,
  getSalesForecastForMonth,
  getSalesMultiplierPeriod,
  toFiniteNumber,
} from "../lib/feasibilityModel";
import { emptyFinancialModel } from "../lib/financialService";
import {
  deleteSimulationVariantRecord,
  emptySalesStrategy,
  emptySimulationVariant,
  loadSalesStrategy,
  loadSimulationVariants,
  saveSalesStrategy,
  saveSimulationVariant,
} from "../lib/planningService";
import { supabase } from "../lib/supabaseClient";

export function usePlanning({
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
}) {
  const [salesStrategy, setSalesStrategy] = useState(emptySalesStrategy);
  const [salesStatus, setSalesStatus] = useState("");
  const [salesLoading, setSalesLoading] = useState(false);
  const [simulationVariants, setSimulationVariants] = useState([emptySimulationVariant]);
  const [simulationStatus, setSimulationStatus] = useState("");
  const [simulationLoading, setSimulationLoading] = useState(false);
  // Set once the saved variants have been read, so unknown variant URLs can be told apart.
  const [planningLoaded, setPlanningLoaded] = useState(false);

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

  function updateSimulationVariant(id, field, value) {
    setSimulationVariants((current) =>
      current.map((variant) => {
        if (variant.id !== id) return variant;
        const nextVariant = { ...variant, [field]: value };
        if (field === "name") {
          nextVariant.label = value || variant.label;
        }
        return nextVariant;
      }),
    );
  }

  function updateSimulationParameter(id, field, value) {
    setSimulationVariants((current) =>
      current.map((variant) =>
        variant.id === id ? { ...variant, parameters: { ...variant.parameters, [field]: value } } : variant,
      ),
    );
  }

  function addSimulationVariant() {
    const linkedFinancialModel = buildFinancialFeasibilityModel(
      financialModel,
      salesStrategy,
      financialSettingsForModel,
      operationsWorkspaceForFinance,
      financialHorizon,
    );
    const linkedSummary = linkedFinancialModel.summary || emptyFinancialModel.summary;
    const horizonMonths = Math.max(1, getProjectionMonthCount(financialHorizon));
    const monthlySalesUnits = Math.round(
      toFiniteNumber(linkedSummary.netSoldUnits) / horizonMonths || getSalesForecastForMonth(salesStrategy, 0),
    );
    const monthlyProductionUnits = Math.max(
      monthlySalesUnits,
      Math.round(toFiniteNumber(linkedSummary.totalProduced) / horizonMonths),
    );
    const unitSalesPrice = toFiniteNumber(
      linkedSummary.averageNetPrice,
      toFiniteNumber(
        operationsWorkspaceForFinance.product?.price,
        toFiniteNumber(operationsWorkspaceForFinance.products[0]?.price),
      ),
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
        grossMargin: linkedSummary.salesRevenue
          ? Math.max(
              0,
              Math.round((toFiniteNumber(linkedSummary.netIncome) / toFiniteNumber(linkedSummary.salesRevenue)) * 100),
            )
          : 0,
        marketShare: 0,
        reputationScore: 0,
        marketingBudget: 0,
        productionUnits: monthlyProductionUnits,
        returnRatePercent: 0,
        salesUnits: monthlySalesUnits,
        spoilagePercent: 0,
        timeHorizonMonths: horizonMonths,
        unitSalesPrice,
        variableCostRatio: linkedSummary.salesRevenue
          ? Math.min(
              95,
              Math.round((toFiniteNumber(linkedSummary.totalCost) / toFiniteNumber(linkedSummary.salesRevenue)) * 100),
            )
          : 0,
      },
    };

    setSimulationVariants((current) => [...current, nextVariant]);
    goTo(nextVariant.path, { force: true });
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
    if (routePath === `/simulation/${id}`) goTo("/simulation/current-situation", { force: true });
  }

  async function loadPlanningData() {
    if (!supabase) {
      setPlanningLoaded(true);
      return;
    }

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
      markWorkspaceSnapshotClean("sales", "simulation");
    } catch (error) {
      setSalesStatus(`${copy("Planning data could not be loaded:", "Planlama verisi yüklenemedi:")} ${error.message}`);
      setSimulationStatus(
        `${copy("Planning data could not be loaded:", "Planlama verisi yüklenemedi:")} ${error.message}`,
      );
    } finally {
      setSalesLoading(false);
      setSimulationLoading(false);
      setPlanningLoaded(true);
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
      markWorkspaceSnapshotClean("sales");
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
      markWorkspaceSnapshotClean("simulation");
      return true;
    } catch (error) {
      setSimulationStatus(error.message);
      return false;
    } finally {
      setSimulationLoading(false);
    }
  }

  return {
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
    setPlanningLoaded,
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
  };
}
