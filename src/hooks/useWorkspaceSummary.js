// Dashboard decision, report tabs and the XLSX/PDF export built from all modules.
import { useState } from "react";
import {
  buildFinancialFeasibilityModel,
  buildSensitivityTable,
  evaluateFeasibilityDecision,
  getPlanProductId,
  getProjectionMonthCount,
  toFiniteNumber,
} from "../lib/feasibilityModel";
import { emptyFinancialModel, requiredFinancialSettingFields } from "../lib/financialService";
import { formatLira, formatNumber } from "../lib/format";
import { getCurrentOperationPlans, hasViablePlanResult } from "../lib/operationsCalculations";
import { buildFeasibilityReport, buildReportSheets } from "../lib/reportExport";

export function useWorkspaceSummary({
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
}) {
  const [reportsTab, setReportsTab] = useState("all");

  // Decision text and KPIs for a 5-year model summary; the dashboard and the
  // report both use it so they never disagree.
  function describeFeasibilityDecision(summary) {
    const decision = evaluateFeasibilityDecision(summary);
    const failedChecks = new Set(decision.checks.filter((check) => !check.ok).map((check) => check.key));
    const reasons = [
      failedChecks.has("npv") &&
        copy(
          `Net present value is negative at a ${formatNumber(summary.discountRateAnnualPercent, 1)}% discount rate: the investment loses value.`,
          `Net bugünkü değer %${formatNumber(summary.discountRateAnnualPercent, 1)} iskonto oranıyla negatif: yatırım değer kaybettiriyor.`,
        ),
      failedChecks.has("payback") &&
        (summary.paybackMonth
          ? copy(
              `Payback takes ${formatNumber(summary.paybackMonth)} months; the limit is ${decision.thresholds.maxPaybackMonths}.`,
              `Geri dönüş ${formatNumber(summary.paybackMonth)} ay sürüyor; sınır ${decision.thresholds.maxPaybackMonths} ay.`,
            )
          : copy("The investment does not pay back within 5 years.", "Yatırım 5 yıl içinde geri dönmüyor.")),
      failedChecks.has("cash") &&
        copy(
          `Cash falls to ${formatLira(summary.lowestCashBalance)}: about ${formatLira(-summary.lowestCashBalance)} more funding is needed.`,
          `Nakit ${formatLira(summary.lowestCashBalance)} seviyesine düşüyor: yaklaşık ${formatLira(-summary.lowestCashBalance)} ek finansman gerekiyor.`,
        ),
      failedChecks.has("capacity") &&
        (summary.capacityUtilization === null
          ? copy("There is demand but no production capacity.", "Talep var ama üretim kapasitesi yok.")
          : copy(
              `Demand is ${formatNumber(summary.capacityUtilization * 100)}% of capacity: some sales cannot be produced.`,
              `Talep kapasitenin %${formatNumber(summary.capacityUtilization * 100)}'i: satışların bir kısmı üretilemiyor.`,
            )),
    ].filter(Boolean);
    const verdictByStatus = {
      feasible: {
        action: copy("Open report pack", "Rapor paketini aç"),
        copy: copy(
          "The investment creates value, pays back in time, cash never runs out and capacity covers demand.",
          "Yatırım değer yaratıyor, zamanında geri dönüyor, nakit hiç tükenmiyor ve kapasite talebi karşılıyor.",
        ),
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
        detail: copy(
          `limit ${decision.thresholds.maxPaybackMonths} months`,
          `sınır ${decision.thresholds.maxPaybackMonths} ay`,
        ),
        key: "payback",
        label: copy("Payback", "Geri dönüş süresi"),
        value: summary.paybackMonth
          ? `${formatNumber(summary.paybackMonth)} ${copy("mo", "ay")}`
          : copy("Over 5 years", "5 yıldan uzun"),
      },
      {
        detail:
          summary.internalRateOfReturn === null
            ? copy(
                `at ${formatNumber(summary.discountRateAnnualPercent, 1)}% discount rate`,
                `%${formatNumber(summary.discountRateAnnualPercent, 1)} iskonto oranıyla`,
              )
            : copy(
                `IRR ${formatNumber(summary.internalRateOfReturn, 1)}% / year`,
                `İç verim oranı yıllık %${formatNumber(summary.internalRateOfReturn, 1)}`,
              ),
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
    const lever = {
      cost: copy("Unit cost", "Birim maliyet"),
      price: copy("Price", "Fiyat"),
      volume: copy("Sales volume", "Satış hacmi"),
    }[row.lever];
    return `${lever} ${row.change > 0 ? "+" : "−"}%${formatNumber(Math.abs(row.change * 100))}`;
  }

  function buildExportReport() {
    const exportModel = buildFinancialFeasibilityModel(
      financialModel,
      salesStrategy,
      financialSettingsForModel,
      operationsWorkspaceForFinance,
      "5y",
    );

    return buildFeasibilityReport({
      companyName: dashboardCompanyName,
      model: exportModel,
      operationsWorkspace: operationsWorkspaceForFinance,
      productName: dashboardProductName,
      risks: dashboardRiskRows.map((risk) => ({ detail: risk.detail, title: risk.title })),
      salesStrategy,
      sensitivity: buildSensitivityTable(
        financialModel,
        salesStrategy,
        financialSettingsForModel,
        operationsWorkspaceForFinance,
      ).map((row) => ({ ...row, label: getSensitivityCaseLabel(row) })),
      settings: financialSettingsForModel,
      t: copy,
      verdict: hasFinancialSourceData ? describeFeasibilityDecision(exportModel.summary).verdict : feasibilityVerdict,
    });
  }

  async function downloadReport(pack, format) {
    if (format.key === "pdf") {
      goTo(`/reports/print/${pack.key}`);
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

  const dashboardSelectedProduct = operationsWorkspace.product || operationsWorkspace.products[0] || null;
  const dashboardSelectedProductId = dashboardSelectedProduct?.id || "";

  const dashboardScopedActivePlans = dashboardSelectedProductId
    ? operationsWorkspaceForFinance.activePlans.filter((plan) => getPlanProductId(plan) === dashboardSelectedProductId)
    : operationsWorkspaceForFinance.activePlans;

  const dashboardScopedLatestPlan = dashboardSelectedProductId
    ? dashboardScopedActivePlans.find((plan) => plan.id === operationsWorkspaceForFinance.latestPlan?.id) ||
      dashboardScopedActivePlans[0] ||
      null
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
        channels: salesStrategy.channels.filter(
          (channel) => (channel.productId || channel.product_id) === dashboardSelectedProductId,
        ),
      }
    : salesStrategy;

  const projectedFinancialModel = buildFinancialFeasibilityModel(
    financialModel,
    dashboardSalesStrategy,
    financialSettingsForModel,
    dashboardOperationsWorkspace,
    financialHorizon,
  );

  const financialSummary = projectedFinancialModel.summary || emptyFinancialModel.summary;

  // The decision always looks five years ahead, whatever horizon the screen shows.
  const decisionSummary =
    financialHorizon === "5y"
      ? financialSummary
      : buildFinancialFeasibilityModel(
          financialModel,
          dashboardSalesStrategy,
          financialSettingsForModel,
          dashboardOperationsWorkspace,
          "5y",
        ).summary || emptyFinancialModel.summary;

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

  const hasOperationData = Boolean(
    operationsWorkspace.products.length ||
    operationsWorkspace.machines.length ||
    operationsWorkspace.materials.length ||
    operationsWorkspace.workforce.length ||
    activePlanResults.length,
  );

  const hasSalesForecast = dashboardSalesStrategy.channels.some(
    (channel) => channel.productId && toFiniteNumber(channel.monthlySalesUnits) > 0,
  );

  const hasFinancialSourceData = Boolean(activePlanResults.length && hasSalesForecast && financialModel.settingsSaved);
  const monthlyNet = financialMonthCount ? toFiniteNumber(financialSummary.netIncome) / financialMonthCount : 0;

  const financialHorizonOptions = [
    ["6m", copy("Next 6 months", "Gelecek 6 ay")],
    ["1y", copy("Next 12 months", "Gelecek 12 ay")],
    ["5y", copy("Next 60 months", "Gelecek 60 ay")],
  ];

  const periodLabel =
    financialHorizonOptions.find(([value]) => value === financialHorizon)?.[1] || financialHorizonOptions[0][1];

  const dashboardProductSelectLabel = dashboardSelectedProduct
    ? dashboardSelectedProduct.name || dashboardSelectedProduct.product_code || copy("Unnamed product", "İsimsiz ürün")
    : copy("No products yet", "Henüz ürün yok");

  const reportTabs = [
    {
      detail: copy(
        "A concise decision pack for investors, founders, and management meetings.",
        "Yatırımcı, kurucu ve yönetim toplantıları için kısa karar paketi.",
      ),
      includes: [
        copy("Executive overview", "Yönetici özeti"),
        copy("Cost & return", "Maliyet & getiri"),
        copy("Scenario signals", "Senaryo sinyalleri"),
      ],
      key: "executive",
      label: copy("Executive Decision Pack", "Yönetici Karar Paketi"),
      tone: "blue",
    },
    {
      detail: copy(
        "Financial assumptions, income-expense projection, cash needs, ROI, and payback.",
        "Finansal varsayımlar, gelir-gider projeksiyonu, nakit ihtiyacı, ROI ve geri dönüş.",
      ),
      includes: [
        copy("Income / expense", "Gelir / gider"),
        copy("Cash flow", "Nakit akışı"),
        copy("Investment return", "Yatırım getirisi"),
      ],
      key: "financial",
      label: copy("Financial Export", "Finansal Export"),
      tone: "violet",
    },
    {
      detail: copy(
        "Production capacity, resource plan, process outputs, cycle time, and tracked cost.",
        "Üretim kapasitesi, kaynak planı, süreç çıktıları, çevrim süresi ve takip edilen maliyet.",
      ),
      includes: [
        copy("Process plan", "Süreç planı"),
        copy("Capacity", "Kapasite"),
        copy("Tracked cost", "Takip edilen maliyet"),
      ],
      key: "operations",
      label: copy("Operations Export", "Operasyon Export"),
      tone: "teal",
    },
    {
      detail: copy(
        "Sales channels, forecast, campaign inputs, market assumptions, and revenue quality.",
        "Satış kanalları, tahmin, kampanya girdileri, pazar varsayımları ve gelir kalitesi.",
      ),
      includes: [
        copy("Sales forecast", "Satış tahmini"),
        copy("Channels", "Kanallar"),
        copy("Revenue quality", "Gelir kalitesi"),
      ],
      key: "sales",
      label: copy("Sales Export", "Satış Export"),
      tone: "lime",
    },
    {
      detail: copy(
        "A full model export that combines operations, sales, finance, and simulation outputs.",
        "Operasyon, satış, finans ve simülasyon çıktılarını birleştiren tam model exportu.",
      ),
      includes: [copy("Full model", "Tam model"), copy("All modules", "Tüm modüller"), copy("Appendix", "Ekler")],
      key: "full",
      label: copy("Full Feasibility Pack", "Tam Fizibilite Paketi"),
      tone: "pink",
    },
  ];

  const activeReportTab = reportTabs.find((tab) => tab.key === reportsTab) || reportTabs[0];

  const reportFormats = [
    {
      extension: "pdf",
      key: "pdf",
      label: "PDF",
      mime: "application/pdf",
      note: copy("print-ready report", "yazdırmaya hazır rapor"),
    },
    {
      extension: "xlsx",
      key: "xlsx",
      label: "XLSX",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      note: copy("spreadsheet model extract", "tablo model çıktısı"),
    },
  ];

  const hasFinancialAssumptions =
    Boolean(financialModel.settingsSaved) &&
    requiredFinancialSettingFields.every(
      (field) =>
        financialSettingsForm[field] !== "" &&
        financialSettingsForm[field] !== null &&
        financialSettingsForm[field] !== undefined &&
        Number.isFinite(Number(financialSettingsForm[field])),
    );

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
        copy: copy(
          "Complete the basic product, process, sales, and finance inputs before using this as a decision report.",
          "Bunu karar raporu olarak kullanmadan önce temel ürün, süreç, satış ve finans girdilerini tamamlayın.",
        ),
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
      detail: copy(
        "Without product price and recipe, cost and revenue are not decision-grade.",
        "Ürün fiyatı ve reçete olmadan maliyet ve ciro karar seviyesinde değildir.",
      ),
      path: "/operations/products",
      priority: dashboardRiskPriority.high,
      readinessItem: true,
      severity: copy("Blocker", "Engel"),
      tone: "risk-high",
      title: copy("Product definition missing", "Ürün tanımı eksik"),
    },
    !activePlanResults.length && {
      action: copy("Save process", "Süreç kaydet"),
      detail: copy(
        "Capacity, labor, material, and energy must come from a saved daily process plan.",
        "Kapasite, işçilik, malzeme ve enerji kayıtlı günlük süreç planından gelmeli.",
      ),
      path: "/operations/data-entry",
      priority: dashboardRiskPriority.high,
      readinessItem: true,
      severity: copy("Blocker", "Engel"),
      tone: "risk-high",
      title: copy("Production plan missing", "Üretim planı eksik"),
    },
    !hasSalesForecast && {
      action: copy("Add sales forecast", "Satış tahmini ekle"),
      detail: copy(
        "Demand, revenue, unmet sales, and inventory risk require product-linked sales channels.",
        "Talep, ciro, karşılanmayan satış ve stok riski ürüne bağlı satış kanalları ister.",
      ),
      path: "/sales-strategy",
      priority: dashboardRiskPriority.high,
      readinessItem: true,
      severity: copy("Blocker", "Engel"),
      tone: "risk-high",
      title: copy("Sales forecast missing", "Satış tahmini eksik"),
    },
    !hasFinancialAssumptions && {
      action: copy("Complete finance", "Finansı tamamla"),
      detail: copy(
        "Cash runway, payback, taxes, and working capital need saved financial assumptions.",
        "Nakit dayanma, geri dönüş, vergiler ve işletme sermayesi kayıtlı finans varsayımları ister.",
      ),
      path: "/financial-modelling/girdiler",
      priority: dashboardRiskPriority.high,
      readinessItem: true,
      severity: copy("High", "Yüksek"),
      tone: "risk-high",
      title: copy("Financial assumptions incomplete", "Finans varsayımları eksik"),
    },
    activePlanResults.length > 0 &&
      missingCostInputs.length > 0 && {
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
        .map(
          (plan) =>
            `${plan.planName}: ${formatNumber(plan.output)} / ${formatNumber(plan.target)} ${copy("units per day fit machine hours", "adet/gün makine süresine sığıyor")}`,
        )
        .join(" · "),
      path: "/operations/active-processes",
      priority: dashboardRiskPriority.high,
      severity: copy("High", "Yüksek"),
      tone: "risk-high",
      title: copy("Plan exceeds machine time", "Plan makine süresini aşıyor"),
    },
    hasFinancialSourceData &&
      unmetForecastUnits > 0 && {
        action: copy("Fix capacity", "Kapasiteyi düzelt"),
        detail: `${formatNumber(unmetForecastUnits)} ${copy("units of forecast demand cannot be produced.", "adet tahmini talep üretilemiyor.")}`,
        path: "/operations/data-entry",
        priority: dashboardRiskPriority.high,
        severity: copy("High", "Yüksek"),
        tone: "risk-high",
        title: copy("Capacity gap", "Kapasite açığı"),
      },
    hasFinancialSourceData &&
      financialSummary.unsoldInventoryUnits > 0 && {
        action: copy("Balance output", "Çıktıyı dengele"),
        detail: `${formatNumber(financialSummary.unsoldInventoryUnits)} ${copy("units remain unsold in the selected horizon.", "adet seçilen ufukta satılmadan kalıyor.")}`,
        path: "/sales-strategy",
        priority: dashboardRiskPriority.medium,
        severity: copy("Medium", "Orta"),
        tone: "risk-medium",
        title: copy("Inventory risk", "Stok riski"),
      },
    hasFinancialSourceData &&
      monthlyNet <= 0 && {
        action: copy("Repair margin", "Marjı düzelt"),
        detail: copy(
          "Current pricing, cost, or channel assumptions do not produce positive monthly net.",
          "Mevcut fiyat, maliyet veya kanal varsayımları pozitif aylık net üretmiyor.",
        ),
        path: "/financial-modelling/analiz",
        priority: dashboardRiskPriority.high,
        severity: copy("High", "Yüksek"),
        tone: "risk-high",
        title: copy("Weak profitability", "Zayıf karlılık"),
      },
    hasFinancialSourceData &&
      financialSummary.cashRunwayMonths < Math.min(financialMonthCount, 3) && {
        action: copy("Improve cash", "Nakti iyileştir"),
        detail: copy(
          "Starting cash, financing timing, or non-critical spend should be reviewed.",
          "Başlangıç nakdi, finansman zamanı veya kritik olmayan harcamalar gözden geçirilmeli.",
        ),
        path: "/financial-modelling/girdiler",
        priority: dashboardRiskPriority.high,
        severity: copy("High", "Yüksek"),
        tone: "risk-high",
        title: copy("Short cash runway", "Kısa nakit dayanma"),
      },
  ]
    .filter(Boolean)
    .sort((left, right) => left.priority - right.priority)
    .slice(0, 5);

  return {
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
  };
}
