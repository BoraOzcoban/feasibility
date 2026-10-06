import React from "react";
import { GlossaryTip } from "../components/InfoTip";
import { normalizeSimulationAlgorithm, simulationAlgorithms } from "../lib/appDefaults";
import {
  buildFinancialFeasibilityModel,
  buildSensitivityTable,
  getOperationProductMap,
  getProjectionMonthCount,
  getSalesForecastForMonth,
  toFiniteNumber,
} from "../lib/feasibilityModel";
import { emptyFinancialModel } from "../lib/financialService";
import { formatLira, formatNumber } from "../lib/format";
import { useAppContext } from "../app/AppContext";
import SensitivityTable from "../components/SensitivityTable";
import DashboardLayout from "../components/DashboardLayout";

export default function SimulationPage() {
  const {
    activeSimulationVariant,
    addSimulationVariant,
    copy,
    dashboardCompanyName,
    deleteSimulationVariant,
    financialHorizon,
    financialModel,
    financialSettingsForModel,
    form,
    goTo,
    hasFinancialSourceData,
    loadPlanningData,
    operationsWorkspace,
    operationsWorkspaceForFinance,
    persistSimulationVariant,
    salesStrategy,
    simulationLoading,
    simulationStatus,
    simulationVariants,
    updateSimulationParameter,
    updateSimulationVariant,
  } = useAppContext();

  const variant = activeSimulationVariant || simulationVariants[0];
  const parameters = variant.parameters || {};
  const numberParam = (field) => Number(parameters[field]) || 0;
  const positiveParam = (field, fallback = 0) => {
    const value = Number(parameters[field]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  const finiteParam = (field, fallback = 0) => {
    const value = Number(parameters[field]);
    return Number.isFinite(value) ? value : fallback;
  };
  const linkedFinancialModel = buildFinancialFeasibilityModel(
    financialModel,
    salesStrategy,
    financialSettingsForModel,
    operationsWorkspaceForFinance,
    financialHorizon,
  );
  const linkedSummary = linkedFinancialModel.summary || emptyFinancialModel.summary;
  const defaultHorizonMonths = Math.max(1, getProjectionMonthCount(financialHorizon));
  const timeHorizonMonths = Math.max(1, Math.round(positiveParam("timeHorizonMonths", defaultHorizonMonths)));
  const productMap = getOperationProductMap(operationsWorkspaceForFinance);
  const firstChannelProduct = salesStrategy.channels
    .map((channel) => productMap.get(channel.productId) || channel.product)
    .find(Boolean);
  // The linked model covers the financial horizon; turn its totals into
  // monthly values before applying the variant's own horizon.
  const defaultSalesUnits = Math.round(
    toFiniteNumber(linkedSummary.netSoldUnits) / defaultHorizonMonths || getSalesForecastForMonth(salesStrategy, 0),
  );
  const defaultUnitSalesPrice = toFiniteNumber(
    linkedSummary.averageNetPrice,
    toFiniteNumber(
      firstChannelProduct?.price,
      toFiniteNumber(
        operationsWorkspaceForFinance.product?.price,
        toFiniteNumber(operationsWorkspaceForFinance.products[0]?.price),
      ),
    ),
  );
  const scenarioSalesUnits = Math.max(0, positiveParam("salesUnits", defaultSalesUnits));
  const scenarioUnitSalesPrice = Math.max(0, positiveParam("unitSalesPrice", defaultUnitSalesPrice));
  const scenarioProductionUnits = Math.max(
    scenarioSalesUnits,
    positiveParam(
      "productionUnits",
      Math.round(toFiniteNumber(linkedSummary.totalProduced) / defaultHorizonMonths) || scenarioSalesUnits,
    ),
  );
  const discountPercent = Math.min(100, Math.max(0, finiteParam("discountPercent", 0)));
  const returnRatePercent = Math.min(100, Math.max(0, finiteParam("returnRatePercent", 0)));
  const spoilagePercent = Math.min(100, Math.max(0, finiteParam("spoilagePercent", 0)));
  const discountRate = discountPercent / 100;
  const returnRate = returnRatePercent / 100;
  const spoilageRate = spoilagePercent / 100;
  const netSellableUnits = scenarioSalesUnits * Math.max(0, 1 - returnRate - spoilageRate);
  const scenarioMonthlyRevenue = netSellableUnits * scenarioUnitSalesPrice * Math.max(0, 1 - discountRate);
  const scenarioRevenueTotal = scenarioMonthlyRevenue * timeHorizonMonths;
  const unitProductionCost = Math.max(0, toFiniteNumber(linkedSummary.unitProductionCost));
  const scenarioProductionCost = scenarioProductionUnits * unitProductionCost * timeHorizonMonths;
  const baseRevenue = scenarioRevenueTotal || positiveParam("baseRevenue", toFiniteNumber(linkedSummary.salesRevenue));
  const priceEffect = numberParam("priceChange") / 100;
  const demandEffect = numberParam("demandChange") / 100;
  const campaignEffect = numberParam("campaignLift") / 100;
  const efficiencyEffect = numberParam("productionEfficiency") / 100;
  const competitorDrag = numberParam("competitorPressure") / 100;
  const simulationAlgorithm = normalizeSimulationAlgorithm(parameters.simulationAlgorithm);
  const simulationAlgorithmOptions = [
    [simulationAlgorithms.withTendency, copy("Apply assumption changes", "Varsayım değişikliklerini uygula")],
    [simulationAlgorithms.withoutTendency, copy("Base plan only", "Yalnız baz plan")],
  ];
  const simulationAlgorithmLabel =
    simulationAlgorithmOptions.find(([value]) => value === simulationAlgorithm)?.[1] ||
    simulationAlgorithmOptions[0][1];
  const volatility = numberParam("volatility") / 100;
  const costVolatility = numberParam("costVolatility") / 100;
  const fixedCost = Math.max(
    0,
    positiveParam(
      "fixedCost",
      (toFiniteNumber(linkedSummary.extraRecurringCost) / defaultHorizonMonths) * timeHorizonMonths,
    ),
  );
  const marketingBudget = Math.max(0, finiteParam("marketingBudget", 0)) * timeHorizonMonths;
  const derivedVariableCostRatio = baseRevenue ? Math.min(95, (scenarioProductionCost / baseRevenue) * 100) : 0;
  const variableCostRatio = Math.min(
    0.95,
    Math.max(0, finiteParam("variableCostRatio", derivedVariableCostRatio) / 100),
  );
  const tendencyEffect = demandEffect + priceEffect + campaignEffect + efficiencyEffect * 0.42 - competitorDrag * 0.55;
  const appliedTendencyEffect = simulationAlgorithm === simulationAlgorithms.withoutTendency ? 0 : tendencyEffect;
  const trendAdjustedRevenue = baseRevenue * Math.max(0, 1 + appliedTendencyEffect);
  const projectedVariableCost =
    scenarioProductionCost || trendAdjustedRevenue * Math.min(variableCostRatio + costVolatility * 0.22, 0.92);
  const outcomeSpread =
    trendAdjustedRevenue * Math.max(volatility + costVolatility * 0.65 + competitorDrag * 0.35, 0.08);
  const contributionPerUnit = Math.max(0, scenarioUnitSalesPrice * Math.max(0, 1 - discountRate) - unitProductionCost);
  const buildOutcome = (key, shiftLabel, label, tone, multiplier) => {
    const revenue = trendAdjustedRevenue + outcomeSpread * multiplier;
    const variableCost = projectedVariableCost * (revenue / Math.max(trendAdjustedRevenue, 1));
    const tailCost = outcomeSpread * (multiplier < 0 ? Math.abs(multiplier) * 0.45 : -multiplier * 0.18);
    const cost = variableCost + fixedCost + marketingBudget + tailCost;
    const net = revenue - cost;
    return {
      breakEvenUnits: Math.max(0, Math.round((fixedCost + marketingBudget) / Math.max(contributionPerUnit, 1))),
      cost,
      key,
      label,
      net,
      revenue,
      shiftLabel,
      tone,
    };
  };
  // Deterministic scenarios: base revenue shifted by a fixed share of the
  // volatility spread. These are sensitivity cases, not probabilities.
  const scenarioShiftLabel = (multiplier) => {
    const shift = trendAdjustedRevenue ? (outcomeSpread * multiplier) / trendAdjustedRevenue : 0;
    if (Math.abs(shift) < 0.0005) return copy("Base revenue", "Baz gelir");
    return `${copy("Revenue", "Gelir")} ${shift > 0 ? "+" : "−"}%${formatNumber(Math.abs(shift) * 100, 1)}`;
  };
  const outcomes = [
    buildOutcome("worst", scenarioShiftLabel(-1.32), copy("Pessimistic", "Kötümser"), "danger", -1.32),
    buildOutcome("bad", scenarioShiftLabel(-0.72), copy("Cautious", "Temkinli"), "bad", -0.72),
    buildOutcome("likely", scenarioShiftLabel(0), copy("Base case", "Baz senaryo"), "likely", 0),
    buildOutcome("good", scenarioShiftLabel(0.78), copy("Optimistic", "İyimser"), "good", 0.78),
  ];
  const netUnitPrice = scenarioUnitSalesPrice * Math.max(0, 1 - discountRate);
  const breakEvenFixedCost = fixedCost + marketingBudget;
  const breakEvenVolume = contributionPerUnit > 0 ? breakEvenFixedCost / contributionPerUnit : null;
  const projectedVolume = scenarioSalesUnits * timeHorizonMonths;
  const chartVolumeMax = Math.max(1, projectedVolume * 1.2, (breakEvenVolume || 0) * 1.5);
  const chartMoneyMax = Math.max(
    1,
    netUnitPrice * chartVolumeMax,
    breakEvenFixedCost + unitProductionCost * chartVolumeMax,
  );
  const chartX = (volume) => 50 + (volume / chartVolumeMax) * 520;
  const chartY = (money) => 240 - (money / chartMoneyMax) * 198;
  const likelyOutcome = outcomes.find((outcome) => outcome.key === "likely");
  const maxRevenue = Math.max(...outcomes.map((outcome) => outcome.revenue), 1);
  const maxNetAbs = Math.max(...outcomes.map((outcome) => Math.abs(outcome.net)), 1);
  const incomeRows = [
    [copy("Sales revenue", "Satış geliri"), likelyOutcome.revenue],
    [copy("Production cost", "Üretim maliyeti"), -projectedVariableCost],
    [copy("Fixed cost", "Sabit gider"), -fixedCost],
    [copy("Marketing budget", "Pazarlama bütçesi"), -marketingBudget],
    [copy("Projected net", "Projeksiyon net"), likelyOutcome.net],
  ];
  // These three fall back to the linked plan when left at 0; show the value
  // actually used instead of a misleading 0.
  const linkedFieldDefaults = {
    productionUnits: scenarioProductionUnits,
    salesUnits: scenarioSalesUnits,
    unitSalesPrice: scenarioUnitSalesPrice,
  };
  const editableVariantGroups = [
    {
      fields: [
        ["salesUnits", copy("Monthly sales units", "Aylık satış adedi"), 0, 100000000, 1],
        ["unitSalesPrice", copy("Unit sales price", "Birim satış fiyatı"), 0, 100000000, 0.01],
        ["productionUnits", copy("Monthly production units", "Aylık üretim adedi"), 0, 100000000, 1],
      ],
      title: copy("Product and sales", "Ürün ve satış"),
    },
    {
      fields: [
        ["discountPercent", copy("Discount (%)", "İndirim (%)"), 0, 100, 0.1],
        ["returnRatePercent", copy("Returns (%)", "İade (%)"), 0, 100, 0.1],
        ["spoilagePercent", copy("Spoilage (%)", "Fire (%)"), 0, 100, 0.1],
        ["marketingBudget", copy("Monthly marketing budget", "Aylık pazarlama bütçesi"), 0, 20000000, 50000],
      ],
      title: copy("Sales conditions", "Satış koşulları"),
    },
  ];
  const visibleAssumptions = [
    [copy("Product", "Ürün"), firstChannelProduct?.name || operationsWorkspace.product?.name || "-"],
    [copy("Algorithm", "Algoritma"), simulationAlgorithmLabel],
    [copy("Monthly sales", "Aylık satış"), `${formatNumber(scenarioSalesUnits)} ${copy("units", "adet")}`],
    [copy("Net sellable units", "Net satılabilir adet"), `${formatNumber(netSellableUnits)} ${copy("units", "adet")}`],
    [copy("Unit price", "Birim fiyat"), formatLira(scenarioUnitSalesPrice, 2)],
    [
      copy("Unit production cost", "Birim üretim maliyeti"),
      unitProductionCost ? formatLira(unitProductionCost, 2) : "-",
    ],
    [copy("Projection horizon", "Projeksiyon ufku"), `${formatNumber(timeHorizonMonths)} ${copy("months", "ay")}`],
  ];
  const simulationHasSalesForecast = salesStrategy.channels.some(
    (channel) => channel.productId && toFiniteNumber(channel.monthlySalesUnits) > 0,
  );
  const simulationSourceReady = Boolean(
    toFiniteNumber(linkedSummary.planCount) && simulationHasSalesForecast && financialModel.settingsSaved,
  );
  const positiveOutcomeCount = outcomes.filter((outcome) => outcome.net > 0).length;
  const simulationConfidencePercent = Math.round((positiveOutcomeCount / outcomes.length) * 100);
  const simulationReadinessItems = [
    {
      done: toFiniteNumber(linkedSummary.planCount) > 0,
      label: copy("Operations", "Operasyon"),
      path: "/operations/data-entry",
    },
    { done: simulationHasSalesForecast, label: copy("Sales", "Satış"), path: "/sales-strategy" },
    { done: financialModel.settingsSaved, label: copy("Finance", "Finans"), path: "/financial-modelling/analiz" },
    {
      done: scenarioSalesUnits > 0 && scenarioUnitSalesPrice > 0,
      label: copy("Variant", "Varyant"),
      path: variant.path || `/simulation/${variant.id}`,
    },
  ];
  const simulationReadinessPercent = Math.round(
    (simulationReadinessItems.filter((item) => item.done).length / simulationReadinessItems.length) * 100,
  );
  const simulationWorstNet = outcomes[0].net;
  const simulationDownsideGap = likelyOutcome.net - simulationWorstNet;
  const simulationUpsideGap = outcomes[3].net - likelyOutcome.net;
  const simulationRiskTone = !simulationSourceReady
    ? "amber"
    : likelyOutcome.net <= 0
      ? "clay"
      : simulationWorstNet < 0
        ? "amber"
        : "teal";
  const simulationHeadline = !simulationSourceReady
    ? copy("Connect the source data before trusting the scenario", "Senaryoya güvenmeden önce kaynak veriyi bağlayın")
    : simulationRiskTone === "teal"
      ? copy("The upside holds across the tested range", "Test edilen aralıkta yukarı potansiyel korunuyor")
      : simulationRiskTone === "amber"
        ? copy("Profitable base case, visible downside", "Kârlı baz senaryo, görünür aşağı risk")
        : copy("Scenario needs margin repair", "Senaryonun marj onarımına ihtiyacı var");
  const simulationBrief = !simulationSourceReady
    ? copy(
        "Simulation is most useful after Operations, Sales and Finance data are saved. Missing inputs are marked on the right.",
        "Simülasyon; Operations, Satış ve Finans verisi kaydedildikten sonra en anlamlı hale gelir. Eksik girdiler sağda işaretli.",
      )
    : copy(
        `Base-case net is ${formatLira(likelyOutcome.net)}, the pessimistic case is ${formatLira(simulationWorstNet)}, and ${positiveOutcomeCount} of ${outcomes.length} scenarios stay positive.`,
        `Baz senaryo net ${formatLira(likelyOutcome.net)}, kötümser senaryo ${formatLira(simulationWorstNet)}; ${outcomes.length} senaryonun ${positiveOutcomeCount} tanesi pozitif kalıyor.`,
      );
  const simulationSignalRows = [
    {
      detail: copy(
        `${positiveOutcomeCount}/${outcomes.length} scenarios with positive net`,
        `${outcomes.length} senaryonun ${positiveOutcomeCount} tanesi pozitif`,
      ),
      label: copy("Positive scenarios", "Pozitif senaryolar"),
      tone: positiveOutcomeCount >= 3 ? "good" : positiveOutcomeCount >= 2 ? "watch" : "risk",
      value: `${simulationConfidencePercent}%`,
    },
    {
      detail: copy("base case minus pessimistic", "baz eksi kötümser"),
      label: copy("Downside gap", "Aşağı fark"),
      tone: simulationWorstNet >= 0 ? "good" : "risk",
      value: formatLira(simulationDownsideGap),
    },
    {
      detail: copy("optimistic minus base case", "iyimser eksi baz"),
      label: copy("Upside room", "Yukarı alan"),
      tone: "good",
      value: formatLira(simulationUpsideGap),
    },
    {
      detail:
        simulationAlgorithm === simulationAlgorithms.withoutTendency
          ? copy("assumption changes ignored", "varsayım değişiklikleri yok sayılıyor")
          : copy("assumption changes applied", "varsayım değişiklikleri uygulanıyor"),
      label: copy("Mode", "Mod"),
      tone: "neutral",
      value:
        simulationAlgorithm === simulationAlgorithms.withoutTendency ? copy("Base", "Baz") : copy("Adjusted", "Ayarlı"),
    },
  ];
  return (
    <DashboardLayout activePage={`simulation/${variant.id}`}>
      <section className="simulation-workspace monte-carlo-workspace">
        <div className="simulation-header">
          <div>
            <span>
              {dashboardCompanyName} / {copy("Scenario Analysis", "Senaryo Analizi")}
            </span>
            <h1>{variant.id === "current-situation" ? copy("Current Situation", "Mevcut Durum") : variant.name}</h1>
            <p>
              {copy(
                "Variants are saved with simple product and sales assumptions. Outputs are recalculated from the saved operations, sales, and financial data available now.",
                "Varyantlar basit ürün ve satış varsayımlarıyla kaydedilir. Çıktılar kayıtlı operasyon, satış ve finans verilerinden yeniden hesaplanır.",
              )}
            </p>
          </div>
          <div className="simulation-header-actions">
            <button type="button" onClick={loadPlanningData} disabled={simulationLoading}>
              {copy("Refresh Data", "Verileri Yenile")}
            </button>
            <button type="button" onClick={() => persistSimulationVariant(variant)} disabled={simulationLoading}>
              {simulationLoading ? copy("Saving...", "Kaydediliyor...") : copy("Save Variant", "Varyantı Kaydet")}
            </button>
            <button type="button" className="primary" onClick={addSimulationVariant}>
              {copy("Add Variant", "Varyant Ekle")}
            </button>
          </div>
        </div>

        {simulationStatus && <p className="status-message">{simulationStatus}</p>}

        <div
          className="simulation-variant-strip"
          role="tablist"
          aria-label={copy("Simulation variants", "Simülasyon varyantları")}
        >
          {simulationVariants.map((item) => (
            <div
              className={variant.id === item.id ? "simulation-variant-pill active" : "simulation-variant-pill"}
              key={item.id}
            >
              <button
                type="button"
                role="tab"
                aria-selected={variant.id === item.id}
                onClick={() => goTo(item.path, "login")}
              >
                {item.id === "current-situation" ? copy("Current Situation", "Mevcut Durum") : item.name || item.label}
              </button>
              {item.id !== "current-situation" && (
                <button
                  type="button"
                  className="variant-delete-button"
                  aria-label={copy("Delete variant", "Varyantı sil")}
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteSimulationVariant(item.id);
                  }}
                >
                  x
                </button>
              )}
            </div>
          ))}
        </div>

        <section className={`simulation-command-hero ${simulationRiskTone}`}>
          <div className="simulation-command-copy">
            <span>{copy("Scenario command center", "Senaryo komuta merkezi")}</span>
            <h2>{simulationHeadline}</h2>
            <p>{simulationBrief}</p>
            <div className="simulation-command-actions">
              <button
                type="button"
                className="primary"
                onClick={() => persistSimulationVariant(variant)}
                disabled={simulationLoading}
              >
                {simulationLoading ? copy("Saving...", "Kaydediliyor...") : copy("Save Variant", "Varyantı Kaydet")}
              </button>
              <button type="button" className="secondary" onClick={() => goTo("/financial-modelling/analiz", "login")}>
                {copy("Open finance model", "Finans modelini aç")}
              </button>
            </div>
          </div>
          <div
            className="simulation-confidence-panel"
            aria-label={copy("Simulation readiness", "Simülasyon hazırlığı")}
          >
            <div className="readiness-ring" style={{ "--readiness": `${simulationReadinessPercent}%` }}>
              <strong>{simulationReadinessPercent}%</strong>
              <span>{copy("Ready", "Hazır")}</span>
            </div>
            <div className="simulation-source-list">
              {simulationReadinessItems.map((item) => (
                <button
                  type="button"
                  className={item.done ? "done" : ""}
                  onClick={() => goTo(item.path, "login")}
                  key={item.label}
                >
                  <span>{item.label}</span>
                  <strong>{item.done ? copy("Done", "Tamam") : copy("Needed", "Gerekli")}</strong>
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="simulation-signal-grid" aria-label={copy("Scenario risk signals", "Senaryo risk sinyalleri")}>
          {simulationSignalRows.map((signal) => (
            <article className={`simulation-signal-card ${signal.tone}`} key={signal.label}>
              <span>{signal.label}</span>
              <strong>{signal.value}</strong>
              <small>{signal.detail}</small>
            </article>
          ))}
        </div>

        <div className="monte-carlo-summary">
          {[
            [copy("Base-case net", "Baz senaryo net"), formatLira(likelyOutcome.net), scenarioShiftLabel(0)],
            [
              copy("Break-even point", "Başa baş noktası"),
              `${formatNumber(likelyOutcome.breakEvenUnits)} ${copy("units", "adet")}`,
              copy("current price basis", "mevcut fiyat bazlı"),
            ],
            [copy("Pessimistic net", "Kötümser net"), formatLira(outcomes[0].net), outcomes[0].shiftLabel],
            [
              copy("Revenue range", "Gelir aralığı"),
              `${formatLira(outcomes[1].revenue)} - ${formatLira(outcomes[3].revenue)}`,
              copy("cautious to optimistic", "temkinliden iyimsere"),
            ],
          ].map(([label, value, detail]) => (
            <article className="monte-carlo-stat" key={label}>
              <span className="label-with-info">
                {label}
                <GlossaryTip language={form.language} term={label} />
              </span>
              <strong>{value}</strong>
              <small>{detail}</small>
            </article>
          ))}
        </div>

        <div className="monte-carlo-grid">
          <aside className="simulation-card simulation-parameter-panel">
            <div className="simulation-card-heading">
              <div>
                <span>{copy("Variant setup", "Varyant kurulumu")}</span>
                <h2>{copy("Algorithm and sales assumptions", "Algoritma ve satış varsayımları")}</h2>
              </div>
            </div>
            <label className="simulation-name-field">
              <span>{copy("Variant name", "Varyant adı")}</span>
              <input
                value={variant.name}
                onChange={(event) => updateSimulationVariant(variant.id, "name", event.target.value)}
              />
            </label>
            <label className="simulation-name-field">
              <span>{copy("Simulation algorithm", "Simülasyon algoritması")}</span>
              <select
                value={simulationAlgorithm}
                onChange={(event) => updateSimulationParameter(variant.id, "simulationAlgorithm", event.target.value)}
              >
                {simulationAlgorithmOptions.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {editableVariantGroups.map((group) => (
              <div className="parameter-group" key={group.title}>
                <h3>{group.title}</h3>
                {group.fields.map(([field, label, min, max, step]) => {
                  const linkedDefault = linkedFieldDefaults[field];
                  const usesLinkedDefault = linkedDefault !== undefined && !(Number(parameters[field]) > 0);

                  return (
                    <label className="sim-input-row" key={field}>
                      <span>{label}</span>
                      <input
                        min={min}
                        max={max}
                        step={step}
                        type="number"
                        placeholder={
                          usesLinkedDefault
                            ? `${formatNumber(linkedDefault, 2)} (${copy("from plan", "plandan")})`
                            : undefined
                        }
                        value={usesLinkedDefault ? "" : (parameters[field] ?? "")}
                        onChange={(event) => updateSimulationParameter(variant.id, field, event.target.value)}
                      />
                    </label>
                  );
                })}
              </div>
            ))}
          </aside>

          <main className="monte-carlo-main">
            <article className="simulation-card percentile-card">
              <div className="simulation-card-heading">
                <div>
                  <span>{copy("Sensitivity scenarios", "Duyarlılık senaryoları")}</span>
                  <h2>
                    {copy(
                      "Pessimistic, cautious, base and optimistic cases",
                      "Kötümser, temkinli, baz ve iyimser senaryolar",
                    )}
                  </h2>
                  <p>
                    {copy(
                      "Each case shifts base revenue by a fixed share of the volatility you enter (at least 8%). They show sensitivity, not probability.",
                      "Her senaryo baz geliri, girdiğiniz oynaklığın (en az %8) sabit bir katı kadar kaydırır. Olasılık değil, duyarlılık gösterir.",
                    )}
                  </p>
                </div>
              </div>
              <div className="percentile-grid">
                {outcomes.map((outcome) => (
                  <article className={`percentile-outcome ${outcome.tone}`} key={outcome.key}>
                    <span>{outcome.shiftLabel}</span>
                    <h3>{outcome.label}</h3>
                    <strong>{formatLira(outcome.net)}</strong>
                    <p>
                      {copy("Revenue", "Gelir")}: {formatLira(outcome.revenue)}
                    </p>
                    <p>
                      {copy("Break-even", "Başa baş")}: {formatNumber(outcome.breakEvenUnits)} {copy("units", "adet")}
                    </p>
                  </article>
                ))}
              </div>
            </article>

            <article className="simulation-card monte-chart-card simulation-trend-card">
              <div className="simulation-card-heading">
                <div>
                  <span>{copy("Break-even graph", "Başa baş grafiği")}</span>
                  <h2>{copy("Revenue, cost and break-even estimate", "Gelir, gider ve başa baş tahmini")}</h2>
                </div>
              </div>
              <div className="simulation-chart-stage">
                <svg
                  className="monte-chart break-even-chart"
                  viewBox="0 0 620 280"
                  role="img"
                  aria-label={copy("Break-even chart", "Başa baş grafiği")}
                >
                  <path className="chart-grid" d="M42 40 H580 M42 90 H580 M42 140 H580 M42 190 H580 M42 240 H580" />
                  <path className="chart-axis" d="M42 28 V240 H585" />
                  <path
                    className="break-even-cost"
                    d={`M${chartX(0)} ${chartY(breakEvenFixedCost)} L${chartX(chartVolumeMax)} ${chartY(breakEvenFixedCost + unitProductionCost * chartVolumeMax)}`}
                  />
                  <path
                    className="break-even-revenue"
                    d={`M${chartX(0)} ${chartY(0)} L${chartX(chartVolumeMax)} ${chartY(netUnitPrice * chartVolumeMax)}`}
                  />
                  {breakEvenVolume !== null && breakEvenVolume <= chartVolumeMax ? (
                    <>
                      <line
                        className="break-even-marker"
                        x1={chartX(breakEvenVolume)}
                        x2={chartX(breakEvenVolume)}
                        y1="42"
                        y2="240"
                      />
                      <text className="chart-tick" x={chartX(breakEvenVolume) + 8} y="68">
                        {copy("Break-even", "Başa baş")}: {formatNumber(breakEvenVolume)} {copy("units", "adet")}
                      </text>
                    </>
                  ) : (
                    <text className="chart-tick" x="60" y="68">
                      {copy(
                        "No break-even: price does not cover unit cost",
                        "Başa baş yok: fiyat birim maliyeti karşılamıyor",
                      )}
                    </text>
                  )}
                  <text className="chart-tick" x="48" y="262">
                    {copy("Units over the horizon", "Ufuk boyunca adet")}
                  </text>
                  <text className="chart-tick chart-tick-end" x="570" y="262" textAnchor="end">
                    {copy("Projected sales", "Projeksiyon satış")}: {formatNumber(projectedVolume)}
                  </text>
                </svg>
              </div>
              <div className="chart-legend">
                <span className="legend-sales">{copy("Revenue", "Gelir")}</span>
                <span className="legend-costs">{copy("Cost", "Gider")}</span>
                <span className="legend-net">{copy("Break-even point", "Başa baş noktası")}</span>
              </div>
            </article>

            <article className="simulation-card income-simulation-card simulation-trend-card">
              <div className="simulation-card-heading">
                <div>
                  <span>{copy("Income statement", "Gelir gider tablosu")}</span>
                  <h2>{copy("Projected gelir gider table and graph", "Projeksiyon gelir gider tablosu ve grafiği")}</h2>
                </div>
              </div>
              <div className="sim-income-layout">
                <div className="sim-income-table">
                  {incomeRows.map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{formatLira(value)}</strong>
                    </div>
                  ))}
                </div>
                <div className="simulation-chart-stage">
                  <svg className="monte-chart income-bars-chart" viewBox="0 0 520 250" aria-hidden="true">
                    <path className="chart-grid" d="M34 35 H500 M34 85 H500 M34 135 H500 M34 185 H500" />
                    {incomeRows.map(([label, value], index) => {
                      const height = Math.max(14, (Math.abs(value) / Math.max(maxRevenue, maxNetAbs)) * 165);
                      const x = 58 + index * 88;
                      const y = value >= 0 ? 202 - height : 202;
                      return (
                        <React.Fragment key={label}>
                          <rect
                            className={value >= 0 ? "income-positive" : "income-negative"}
                            x={x}
                            y={y}
                            width="46"
                            height={height}
                            rx="6"
                          />
                          <text className="chart-tick" x={x - 8} y="230">
                            {index + 1}
                          </text>
                        </React.Fragment>
                      );
                    })}
                    <path className="chart-axis" d="M34 22 V202 H500" />
                  </svg>
                </div>
              </div>
            </article>
          </main>

          <aside className="simulation-side">
            <article className="simulation-card simulation-used-params">
              <div className="simulation-card-heading">
                <div>
                  <span>{copy("Scenario summary", "Senaryo özeti")}</span>
                  <h2>{copy("Visible assumptions", "Görünen varsayımlar")}</h2>
                </div>
              </div>
              <div className="used-parameter-list">
                {visibleAssumptions.map(([label, value]) => (
                  <span key={label}>
                    {label}
                    <strong>{value}</strong>
                  </span>
                ))}
              </div>
            </article>

            <article className="simulation-card risk-card">
              <h2>{copy("Pessimistic scenario", "Kötümser senaryo")}</h2>
              <p>
                {copy(
                  "The pessimistic case is shown separately: if it is negative, check margin, cash and break-even timing before committing capital.",
                  "Kötümser senaryo ayrıca gösterilir: negatifse sermaye bağlamadan önce marjı, nakdi ve başa baş zamanlamasını kontrol edin.",
                )}
              </p>
              <strong>{formatLira(outcomes[0].net)}</strong>
            </article>
          </aside>
        </div>

        {hasFinancialSourceData && (
          <article className="simulation-card sensitivity-card">
            <div className="simulation-card-heading">
              <div>
                <span>{copy("Sensitivity", "Duyarlılık")}</span>
                <h2>{copy("What if one assumption is wrong?", "Bir varsayım tutmazsa ne olur?")}</h2>
              </div>
            </div>
            <p>
              {copy(
                "Each row re-runs the full 5-year model (tax, VAT, stock and loans) with one lever moved and everything else kept as planned.",
                "Her satır, tek bir kaldıraç değiştirilip diğer her şey plandaki gibi tutularak tam 5 yıllık modeli (vergi, KDV, stok ve krediler) yeniden çalıştırır.",
              )}
            </p>
            <div className="sensitivity-table-wrap">
              {
                <SensitivityTable
                  rows={buildSensitivityTable(
                    financialModel,
                    salesStrategy,
                    financialSettingsForModel,
                    operationsWorkspaceForFinance,
                  )}
                  className="sensitivity-table"
                />
              }
            </div>
          </article>
        )}
      </section>
    </DashboardLayout>
  );
}
