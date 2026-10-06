import React from "react";
import { GlossaryTip, InfoTip } from "../components/InfoTip";
import { buildFinancialLoanPaymentCalendar, buildIncomeExpenseTrendChart } from "../lib/charts";
import {
  buildFinancialFeasibilityModel,
  convertMoneyToTry,
  getFinancialLoanRows,
  getMonthStart,
  getProjectionMonthCount,
  getTodayDateInputValue,
  hasUsableExchangeRates,
  normalizeCurrencyCode,
  parseDateInput,
  toFiniteNumber,
} from "../lib/feasibilityModel";
import {
  emptyFinancialModel,
  financialLoanCurrencyOptions,
  generalFinancialAssumptionFields,
  inflationRevaluationFinancialFields,
  optionalMacroFinancialSettingFields,
  requiredFinancialSettingFields,
  valuationFinancialSettingFields,
} from "../lib/financialService";
import { formatCurrencyAmount, formatLira, formatMonthLabel, formatNumber, formatTrendAxisAmount } from "../lib/format";
import { useAppContext } from "../app/AppContext";
import DashboardLayout from "../components/DashboardLayout";

export default function FinancialModellingPage() {
  const {
    activeFinancialSubmodule,
    addFinancialLoanRow,
    copy,
    exchangeRates,
    financialExtraCostForm,
    financialHorizon,
    financialLoading,
    financialModel,
    financialOverviewWidgets,
    financialSettingsForModel,
    financialSettingsForm,
    financialStatementPeriod,
    financialStatus,
    financialSubmodules,
    form,
    handleDeleteFinancialExtraCost,
    handleFetchExchangeRates,
    handleSaveFinancialExtraCost,
    handleSaveFinancialSettings,
    loadFinancialData,
    locale,
    operationsWorkspaceForFinance,
    removeFinancialLoanRow,
    salesStrategy,
    saveFinancialOverviewScreen,
    setFinancialExtraCostForm,
    setFinancialHorizon,
    setFinancialSettingsForm,
    setFinancialStatementPeriod,
    toggleFinancialOverviewWidget,
    updateFinancialLoanRow,
  } = useAppContext();

  const model = buildFinancialFeasibilityModel(
    financialModel,
    salesStrategy,
    financialSettingsForModel,
    operationsWorkspaceForFinance,
    financialHorizon,
  );
  const statementProjectionModel =
    financialHorizon === "5y"
      ? model
      : buildFinancialFeasibilityModel(
          financialModel,
          salesStrategy,
          financialSettingsForModel,
          operationsWorkspaceForFinance,
          "5y",
        );
  const summary = model.summary || emptyFinancialModel.summary;
  const incomeExpenseTrendChart = buildIncomeExpenseTrendChart(model.trendRows || []);
  const currentFinancialPage = activeFinancialSubmodule || financialSubmodules[0];
  const investmentTotal =
    (summary.machinePurchaseCost || 0) +
    (summary.equipmentPurchaseCost || 0) +
    (summary.extraInitialCost || 0) +
    (summary.workingCapitalRequirement || 0);
  const formatMonth = (month) => (month ? `${month}. ${copy("month", "ay")}` : "-");
  const financialRowLabels = {
    electricityCost: copy("Electricity", "Elektrik"),
    equipmentPurchase: copy("Equipment investment", "Ekipman yatırımı"),
    extraInitialCost: copy("Initial extra costs", "Başlangıç ek giderleri"),
    incomeTax: copy("Income tax", "Gelir vergisi"),
    investmentGrant: copy("Investment grant / subsidy", "Yatırım / hibe"),
    loanAmount: copy("Loan financing", "Kredi finansmanı"),
    loanInterest: copy("Loan interest", "Kredi faizi"),
    loanPaymentTotal: copy("Loan payments", "Kredi ödemeleri"),
    machinePurchase: copy("Machine investment", "Makine yatırımı"),
    materialCost: copy("Raw materials and packaging", "Hammadde ve paketleme"),
    otherProductionCost: copy("Depreciation, maintenance and mold", "Amortisman, bakım ve kalıp"),
    recurringExtraCost: copy("Recurring overhead", "Tekrarlayan genel gider"),
    salesRevenue: copy("Sales revenue from monthly forecast", "Aylık tahminden satış geliri"),
    vatPayable: copy("VAT payable", "Ödenecek KDV"),
    workforceCost: copy("Salaries and labor", "Maaş ve işçilik"),
    workingCapital: copy("Working capital requirement", "İşletme sermayesi ihtiyacı"),
    writeOffCost: copy("Spoilage, returns and expired write-off", "Bozulma, iade ve SKT fireleri"),
  };
  const getFinancialRowLabel = (row) => financialRowLabels[row.id] || row.label;
  const renderIncomeExpenseTrendSvg = (ariaLabel) => {
    const revenuePoints = incomeExpenseTrendChart.revenuePoints || [];
    const costPoints = incomeExpenseTrendChart.costPoints || [];
    const latestRevenuePoint = revenuePoints[revenuePoints.length - 1];
    const latestCostPoint = costPoints[costPoints.length - 1];
    const chartToken = [
      "income-expense",
      financialHorizon,
      revenuePoints.length,
      Math.round(latestRevenuePoint?.value || 0),
      Math.round(latestCostPoint?.value || 0),
    ].join("-");
    const incomeSurfaceId = `${chartToken}-income-surface`;
    const expenseSurfaceId = `${chartToken}-expense-surface`;
    const incomeStrokeId = `${chartToken}-income-stroke`;
    const expenseStrokeId = `${chartToken}-expense-stroke`;
    const trendGlowId = `${chartToken}-soft-glow`;
    const badgeHeight = 34;
    const badgeMinGap = 8;
    const badgeTop = 36;
    const badgeBottom = 200;
    const badgeX = 454;
    const clampBadgeY = (value) => Math.min(badgeBottom, Math.max(badgeTop, value));
    let revenueBadgeY = latestRevenuePoint ? clampBadgeY(latestRevenuePoint.y - badgeHeight / 2) : 0;
    let costBadgeY = latestCostPoint ? clampBadgeY(latestCostPoint.y - badgeHeight / 2) : 0;

    if (latestRevenuePoint && latestCostPoint && Math.abs(revenueBadgeY - costBadgeY) < badgeHeight + badgeMinGap) {
      const midpoint = clampBadgeY((revenueBadgeY + costBadgeY) / 2 - badgeHeight / 2);
      const revenueIsAbove = latestRevenuePoint.y <= latestCostPoint.y;

      revenueBadgeY = revenueIsAbove ? midpoint : midpoint + badgeHeight + badgeMinGap;
      costBadgeY = revenueIsAbove ? midpoint + badgeHeight + badgeMinGap : midpoint;

      const lowestBadgeY = Math.max(revenueBadgeY, costBadgeY);
      const highestBadgeY = Math.min(revenueBadgeY, costBadgeY);

      if (lowestBadgeY > badgeBottom) {
        const overflow = lowestBadgeY - badgeBottom;
        revenueBadgeY -= overflow;
        costBadgeY -= overflow;
      }

      if (highestBadgeY < badgeTop) {
        const underflow = badgeTop - highestBadgeY;
        revenueBadgeY += underflow;
        costBadgeY += underflow;
      }
    }

    return (
      <div className="financial-trend-stage" key={chartToken}>
        <svg className="trend-chart finance-model-chart" viewBox="0 0 560 280" role="img" aria-label={ariaLabel}>
          <defs>
            <linearGradient id={incomeSurfaceId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-cyan)" stopOpacity="0.34" />
              <stop offset="70%" stopColor="var(--color-teal)" stopOpacity="0.08" />
              <stop offset="100%" stopColor="var(--color-cyan)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={expenseSurfaceId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-amber)" stopOpacity="0.3" />
              <stop offset="72%" stopColor="var(--color-clay)" stopOpacity="0.07" />
              <stop offset="100%" stopColor="var(--color-amber)" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id={incomeStrokeId}
              x1={incomeExpenseTrendChart.plot.left}
              x2={incomeExpenseTrendChart.plot.right}
              y1="0"
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="var(--color-teal)" />
              <stop offset="45%" stopColor="var(--color-cyan)" />
              <stop offset="100%" stopColor="#7c5cff" />
            </linearGradient>
            <linearGradient
              id={expenseStrokeId}
              x1={incomeExpenseTrendChart.plot.left}
              x2={incomeExpenseTrendChart.plot.right}
              y1="0"
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#d99a24" />
              <stop offset="52%" stopColor="var(--color-amber)" />
              <stop offset="100%" stopColor="#ff5a8a" />
            </linearGradient>
            <filter id={trendGlowId} x="-20%" y="-35%" width="140%" height="170%">
              <feGaussianBlur stdDeviation="3.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect className="chart-panel" x="50" y="20" width="490" height="224" rx="18" />
          <text className="axis-label axis-label-y chart-axis-title" x={incomeExpenseTrendChart.plot.left} y="18">
            {copy("Amount (TRY)", "Tutar (TRY)")}
          </text>
          <text className="axis-label axis-label-x" x="260" y="266">
            {copy("Date", "Tarih")}
          </text>
          <path className="chart-grid" d={incomeExpenseTrendChart.gridPath} />
          {incomeExpenseTrendChart.xTicks.map((tick) => (
            <line
              className="chart-x-guide"
              x1={tick.x}
              x2={tick.x}
              y1={incomeExpenseTrendChart.plot.top}
              y2={incomeExpenseTrendChart.plot.bottom}
              key={`guide-${tick.x}`}
            />
          ))}
          <path className="chart-axis" d={incomeExpenseTrendChart.axisPath} />
          {incomeExpenseTrendChart.yTicks.map((tick) => (
            <text
              className="chart-tick chart-tick-y"
              x={incomeExpenseTrendChart.plot.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              key={tick.value}
            >
              {tick.label}
            </text>
          ))}
          {incomeExpenseTrendChart.xTicks.map((tick) => (
            <text
              className="chart-tick chart-tick-x"
              x={tick.x}
              y="235"
              textAnchor="middle"
              key={`${tick.x}-${tick.label}`}
            >
              {tick.label}
            </text>
          ))}
          {incomeExpenseTrendChart.revenueAreaPath && (
            <path
              className="trend-area sales chart-area-fill"
              d={incomeExpenseTrendChart.revenueAreaPath}
              style={{ fill: `url(#${incomeSurfaceId})` }}
            />
          )}
          {incomeExpenseTrendChart.costAreaPath && (
            <path
              className="trend-area costs chart-area-fill"
              d={incomeExpenseTrendChart.costAreaPath}
              style={{ fill: `url(#${expenseSurfaceId})` }}
            />
          )}
          <line className="chart-badge-rail" x1="448" x2="448" y1="34" y2="218" />
          {incomeExpenseTrendChart.revenuePath && (
            <path
              className="trend-line-glow sales chart-draw-line"
              d={incomeExpenseTrendChart.revenuePath}
              filter={`url(#${trendGlowId})`}
              pathLength="1"
              style={{ stroke: `url(#${incomeStrokeId})` }}
            />
          )}
          {incomeExpenseTrendChart.costPath && (
            <path
              className="trend-line-glow costs chart-draw-line"
              d={incomeExpenseTrendChart.costPath}
              filter={`url(#${trendGlowId})`}
              pathLength="1"
              style={{ stroke: `url(#${expenseStrokeId})` }}
            />
          )}
          {incomeExpenseTrendChart.revenuePath && (
            <path
              className="trend-line sales chart-draw-line"
              d={incomeExpenseTrendChart.revenuePath}
              pathLength="1"
              style={{ stroke: `url(#${incomeStrokeId})` }}
            />
          )}
          {incomeExpenseTrendChart.costPath && (
            <path
              className="trend-line costs chart-draw-line"
              d={incomeExpenseTrendChart.costPath}
              pathLength="1"
              style={{ stroke: `url(#${expenseStrokeId})` }}
            />
          )}
          {revenuePoints.map((point, index) => (
            <circle
              className="trend-point sales"
              cx={point.x}
              cy={point.y}
              r={index === revenuePoints.length - 1 ? 4.8 : 3.2}
              style={{ animationDelay: `${760 + index * 36}ms` }}
              key={`sales-${index}`}
            />
          ))}
          {costPoints.map((point, index) => (
            <circle
              className="trend-point costs"
              cx={point.x}
              cy={point.y}
              r={index === costPoints.length - 1 ? 4.8 : 3.2}
              style={{ animationDelay: `${820 + index * 36}ms` }}
              key={`cost-${index}`}
            />
          ))}
          {latestRevenuePoint && (
            <>
              <path
                className="chart-badge-connector sales"
                d={`M${latestRevenuePoint.x + 7} ${latestRevenuePoint.y} C${latestRevenuePoint.x + 28} ${latestRevenuePoint.y}, ${badgeX - 18} ${revenueBadgeY + 17}, ${badgeX} ${revenueBadgeY + 17}`}
                pathLength="1"
              />
              <g className="chart-value-badge sales" transform={`translate(${badgeX} ${revenueBadgeY})`}>
                <rect width="86" height={badgeHeight} rx="8" />
                <text className="chart-value-badge-label" x="12" y="13">
                  {copy("Income", "Gelir")}
                </text>
                <text className="chart-value-badge-amount" x="12" y="27">
                  {formatTrendAxisAmount(latestRevenuePoint.value)}
                </text>
              </g>
            </>
          )}
          {latestCostPoint && (
            <>
              <path
                className="chart-badge-connector costs"
                d={`M${latestCostPoint.x + 7} ${latestCostPoint.y} C${latestCostPoint.x + 28} ${latestCostPoint.y}, ${badgeX - 18} ${costBadgeY + 17}, ${badgeX} ${costBadgeY + 17}`}
                pathLength="1"
              />
              <g className="chart-value-badge costs" transform={`translate(${badgeX} ${costBadgeY})`}>
                <rect width="86" height={badgeHeight} rx="8" />
                <text className="chart-value-badge-label" x="12" y="13">
                  {copy("Expense", "Gider")}
                </text>
                <text className="chart-value-badge-amount" x="12" y="27">
                  {formatTrendAxisAmount(latestCostPoint.value)}
                </text>
              </g>
            </>
          )}
        </svg>
      </div>
    );
  };
  const financialPageMeta = {
    inputs: {
      description: copy(
        "Enter financial assumptions and extra costs used by the feasibility model.",
        "Fizibilite modelinde kullanılacak finansal varsayımları ve ek giderleri girin.",
      ),
      title: copy("Inputs", "Girdiler"),
    },
    overview: {
      description: copy(
        "Review all financial rows and the income-expense projection. Add only the widgets you want to keep on your saved screen.",
        "Tüm finansal satırları ve gelir-gider projeksiyonunu inceleyin. Kayıtlı ekranınızda tutmak istediğiniz widgetları ayrıca ekleyin.",
      ),
      title: copy("Cost & Return Analysis", "Maliyet & Getiri Analizi"),
    },
    loans: {
      description: copy(
        "Add financing loans separately from optional expenses. Each loan needs its own amount, annual interest, and term.",
        "Finansman kredilerini opsiyonel giderlerden ayrı girin. Her kredinin tutarı, yıllık faizi ve vadesi ayrı olmalıdır.",
      ),
      title: copy("Loans", "Krediler"),
    },
  }[currentFinancialPage.key];
  const costBreakdownRows = (model.costStructure || []).filter((item) => toFiniteNumber(item.amount) > 0);
  const investmentBreakdownRows = [
    {
      amount: summary.machinePurchaseCost,
      id: "machinePurchase",
      label: copy("Machine investment", "Makine yatırımı"),
    },
    {
      amount: summary.equipmentPurchaseCost,
      id: "equipmentPurchase",
      label: copy("Equipment investment", "Ekipman yatırımı"),
    },
    {
      amount: summary.extraInitialCost,
      id: "extraInitialCost",
      label: copy("Initial extra costs", "Başlangıç ek giderleri"),
    },
    {
      amount: summary.workingCapitalRequirement,
      id: "workingCapital",
      label: copy("Working capital requirement", "İşletme sermayesi ihtiyacı"),
    },
  ].filter((item) => toFiniteNumber(item.amount) > 0);
  const returnBreakdownRows = [
    { amount: summary.salesRevenue, id: "salesRevenue", label: copy("Sales revenue", "Satış geliri"), tone: "income" },
    { amount: summary.netIncome, id: "netIncome", label: copy("Net income", "Net kazanç"), tone: "net" },
    {
      amount: summary.totalCashFlow,
      id: "cashFlow",
      label: copy("Total cash flow", "Toplam nakit akışı"),
      tone: "cash",
    },
  ];
  const maxCostBreakdownAmount = Math.max(1, ...costBreakdownRows.map((item) => toFiniteNumber(item.amount)));
  const maxInvestmentBreakdownAmount = Math.max(
    1,
    ...investmentBreakdownRows.map((item) => toFiniteNumber(item.amount)),
  );
  const maxReturnBreakdownAmount = Math.max(
    1,
    ...returnBreakdownRows.map((item) => Math.abs(toFiniteNumber(item.amount))),
  );
  const renderBreakdownBars = (rows, maxAmount, emptyLabel, tone = "cost") => (
    <div className="financial-bar-list">
      {(rows.length ? rows : [{ amount: 0, id: "empty", label: emptyLabel, tone }]).map((item) => {
        const amount = toFiniteNumber(item.amount);
        const width = item.id === "empty" ? 0 : Math.max(4, Math.min(100, (Math.abs(amount) / maxAmount) * 100));

        return (
          <div className={`financial-bar-row ${item.tone || tone}`} key={item.id || item.label}>
            <div>
              <span>{getFinancialRowLabel(item)}</span>
              <strong>{item.id === "empty" ? "-" : formatLira(amount)}</strong>
            </div>
            <i style={{ width: `${width}%` }} />
          </div>
        );
      })}
    </div>
  );
  const financialInputConfig = {
    cogsInflationAnnualPercent: {
      label: copy("COGS inflation % / year", "SMM enflasyonu (% yıllık)"),
      min: "0",
      step: "0.01",
    },
    discountRateAnnualPercent: {
      info: copy(
        "The yearly return you would expect from this money elsewhere, used to discount future cash flows for net present value. For TRY projects, the policy rate plus a risk premium is a common starting point.",
        "Bu parayı başka yerde değerlendirseniz bekleyeceğiniz yıllık getiri; net bugünkü değer hesabında gelecekteki nakit akışlarını indirgemek için kullanılır. TL projelerde politika faizi + risk primi yaygın bir başlangıç noktasıdır.",
      ),
      label: copy("Discount rate % / year", "İskonto oranı (% yıllık)"),
      min: "0",
      step: "0.01",
    },
    electricityPricePerKwh: { label: copy("Electricity kWh price", "Elektrik kWh fiyatı"), min: "0", step: "0.0001" },
    expenseVatRate: { label: copy("Average expense VAT %", "Ortalama gider KDV oranı (%)"), min: "0", step: "0.01" },
    incomeTaxRate: { label: copy("Corporate tax %", "Kurumlar vergisi oranı"), min: "0", step: "0.01" },
    increaseFrequency: {
      label: copy("Increase frequency", "Artış sıklığı"),
      options: [
        ["monthly", copy("Monthly", "Aylık")],
        ["quarterly", copy("Quarterly", "3 Ayda Bir")],
        ["semiannual", copy("Every 6 months", "6 Ayda Bir")],
        ["annual", copy("Annual", "Yıllık")],
      ],
      type: "select",
    },
    initialCash: {
      info: copy(
        "Cash available at the start of the model. Loans and grants are added separately, so do not include them here unless they are already in the bank.",
        "Model başlangıcındaki hazır nakit. Krediler ve hibeler ayrıca eklenir; bankada hazır değilse burada tekrar yazmayın.",
      ),
      label: copy("Initial cash", "Başlangıç nakdi"),
      min: "0",
      step: "1000",
    },
    initialCapacityUnits: {
      label: copy("Initial capacity (month 1)", "Başlangıç kapasitesi (Ay 1)"),
      min: "0",
      step: "1",
    },
    investmentGrantAmount: {
      info: copy(
        "Non-loan funding that enters cash as support. It reduces required own cash but does not create monthly repayments.",
        "Kredi olmayan destek/hibe/yatırım girişi. Gerekli öz kaynağı azaltır ama aylık ödeme oluşturmaz.",
      ),
      label: copy("Investment / grant to receive", "Alınacak yatırım / hibe"),
      min: "0",
      step: "1000",
    },
    monthlyCurrencyIncreasePercent: {
      info: copy(
        "Applied as a monthly multiplier to currency-sensitive material costs. Example: 2% means next month is cost x 1.02 before other inflation assumptions.",
        "Dövize hassas malzeme maliyetlerine aylık çarpan olarak uygulanır. Örn. %2, sonraki ay diğer enflasyon varsayımlarından önce maliyet x 1,02 demektir.",
      ),
      label: copy("Monthly FX increase %", "Aylık döviz artışı %"),
      min: "0",
      step: "0.01",
    },
    monthlyEnergyPriceIncreasePercent: {
      info: copy(
        "Raises electricity cost month by month. If left at zero, the model falls back to the general monthly inflation assumption.",
        "Elektrik maliyetini aylık artırır. Sıfır kalırsa model genel aylık enflasyon varsayımını kullanır.",
      ),
      label: copy("Monthly energy price increase %", "Aylık enerji fiyat artışı %"),
      min: "0",
      step: "0.01",
    },
    monthlyInflationPercent: {
      info: copy(
        "General monthly cost pressure used for overheads and fallback cost increases. It compounds over the selected projection horizon.",
        "Genel aylık maliyet baskısıdır; genel giderlerde ve yedek maliyet artışlarında kullanılır. Seçilen projeksiyon dönemi boyunca bileşik işler.",
      ),
      label: copy("Monthly inflation %", "Aylık enflasyon %"),
      min: "0",
      step: "0.01",
    },
    monthlyWageIncreasePercent: {
      label: copy("Monthly wage increase %", "Aylık ücret artışı %"),
      min: "0",
      step: "0.01",
    },
    opexInflationAnnualPercent: {
      label: copy("OpEx inflation % / year", "OpEx enflasyonu (% yıllık)"),
      min: "0",
      step: "0.01",
    },
    priceIncreaseAnnualPercent: {
      label: copy("Price increase policy % / year", "Fiyat artış politikası (% yıllık)"),
      min: "0",
      step: "0.01",
    },
    rawMaterialBufferMonths: { label: copy("Material buffer months", "Malzeme tampon ay"), min: "0", step: "0.1" },
    rawMaterialStockDays: {
      info: copy(
        "Extra days of material held before sale. More stock days increase working capital need.",
        "Satıştan önce elde tutulan ek hammadde günü. Gün arttıkça işletme sermayesi ihtiyacı yükselir.",
      ),
      label: copy("Raw material stock holding days", "Hammadde stok tutma süresi (gün)"),
      min: "0",
      step: "1",
    },
    receivablesCollectionDays: {
      info: copy(
        "Average delay before sales cash is collected. 45 days means revenue usually enters cash roughly two model months later.",
        "Satış nakdinin ortalama tahsil gecikmesi. 45 gün, cironun nakde yaklaşık iki model ayı sonra girmesi demektir.",
      ),
      label: copy("Receivables collection days", "Alacak tahsil süresi (gün)"),
      min: "0",
      step: "1",
    },
    rentBufferMonths: { label: copy("Rent buffer months", "Kira tampon ay"), min: "0", step: "0.1" },
    salaryBufferMonths: { label: copy("Salary buffer months", "Maaş tampon ay"), min: "0", step: "0.1" },
    salesVatRate: { label: copy("Average sales VAT %", "Ortalama satış KDV oranı (%)"), min: "0", step: "0.01" },
    supplierPaymentDays: { label: copy("Supplier payment days", "Tedarikçi ödeme süresi (gün)"), min: "0", step: "1" },
    taxPaymentDelayMonths: {
      label: copy("Tax payment delay months", "Vergi ödeme gecikmesi (ay)"),
      min: "0",
      step: "1",
    },
    workingDaysPerMonth: {
      info: copy(
        "Daily production and daily costs are multiplied by this number to create monthly production capacity and monthly operating cost.",
        "Günlük üretim ve günlük maliyetler bu değerle çarpılarak aylık kapasite ve aylık operasyon maliyeti hesaplanır.",
      ),
      label: copy("Working days / month", "Aylık çalışma günü"),
      min: "1",
      step: "1",
    },
  };
  const renderFinancialField = (field, isRequired) => {
    const config = financialInputConfig[field];

    return (
      <label className={isRequired ? "required-financial-field" : "optional-financial-field"} key={field}>
        <span>
          <span className="label-with-info">
            {config.label}
            {config.info && <InfoTip label={`${config.label} ${copy("info", "bilgi")}`} text={config.info} />}
          </span>
          <small>{isRequired ? copy("Required", "Zorunlu") : copy("Optional", "Opsiyonel")}</small>
        </span>
        {config.type === "select" ? (
          <select
            aria-required={isRequired}
            required={isRequired}
            value={financialSettingsForm[field] ?? ""}
            onChange={(event) => setFinancialSettingsForm((current) => ({ ...current, [field]: event.target.value }))}
          >
            {config.options.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          <input
            aria-required={isRequired}
            min={config.min}
            required={isRequired}
            step={config.step}
            type="number"
            value={financialSettingsForm[field] ?? ""}
            onChange={(event) => setFinancialSettingsForm((current) => ({ ...current, [field]: event.target.value }))}
          />
        )}
      </label>
    );
  };
  const renderExchangeRatePanel = () => (
    <details className="financial-input-section exchange-rate-section progressive-input-box">
      <summary className="financial-input-section-heading progressive-section-summary">
        <div>
          <span className="heading-with-info">
            {copy("TCMB FX rates", "TCMB döviz kurları")}
            <InfoTip
              label={copy("FX rate calculation info", "Döviz kuru hesaplama bilgisi")}
              text={copy(
                "USD/EUR amounts are converted to TRY with amount x current USD/TRY or EUR/TRY. TRY amounts stay unchanged.",
                "USD/EUR tutarlar TL'ye tutar x güncel USD/TRY veya EUR/TRY olarak çevrilir. TL tutarlar aynen kalır.",
              )}
            />
          </span>
          <p>
            {exchangeRates.status === "loading"
              ? copy("USD/TRY and EUR/TRY are being refreshed from TCMB.", "USD/TRY ve EUR/TRY TCMB'den yenileniyor.")
              : exchangeRates.error
                ? `${copy("Rates could not be refreshed:", "Kurlar yenilenemedi:")} ${exchangeRates.error}`
                : exchangeRates.status === "ready"
                  ? `${copy("Rates loaded from", "Kurlar şu kaynaktan alındı")}: ${exchangeRates.sourceDetail || exchangeRates.source}. ${copy("Operations prices entered in USD/EUR are converted to TRY in financial analysis.", "Operasyon tarafında USD/EUR girilen fiyatlar finansal analizde TL'ye çevrilir.")}`
                  : copy(
                      "The last saved rates appear here first. Click fetch prices to refresh USD/TRY and EUR/TRY from TCMB and save them.",
                      "Önce son kaydedilen kurlar burada görünür. USD/TRY ve EUR/TRY değerlerini TCMB'den yenileyip kaydetmek için fiyatları çek butonuna basın.",
                    )}
          </p>
        </div>
        <div className="exchange-rate-actions">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleFetchExchangeRates();
            }}
            disabled={exchangeRates.status === "loading"}
          >
            {exchangeRates.status === "loading"
              ? copy("Fetching...", "Çekiliyor...")
              : copy("Fetch Prices", "Fiyatları Çek")}
          </button>
          <strong>
            {exchangeRates.status === "ready"
              ? exchangeRates.source
              : exchangeRates.status === "loading"
                ? copy("Loading", "Yükleniyor")
                : copy("Manual", "Manuel")}
          </strong>
        </div>
      </summary>
      <div className="exchange-rate-grid">
        {[
          ["USD", exchangeRates.USD],
          ["EUR", exchangeRates.EUR],
        ].map(([currency, rate]) => (
          <article className="exchange-rate-card" key={currency}>
            <span>{currency}/TRY</span>
            <strong>{rate && rate !== 1 ? formatLira(rate, 4) : "-"}</strong>
            <small>
              {exchangeRates.updatedAt
                ? new Date(exchangeRates.updatedAt).toLocaleString(locale)
                : copy("Waiting for saved or fetched rate", "Kayıtlı veya çekilmiş kur bekleniyor")}
            </small>
          </article>
        ))}
      </div>
    </details>
  );
  const renderFinancialInputs = () => (
    <div className="financial-controls finance-input-panel">
      <form className="financial-assumption-form" onSubmit={handleSaveFinancialSettings}>
        {renderExchangeRatePanel()}

        <details className="financial-input-section progressive-input-box">
          <summary className="financial-input-section-heading progressive-section-summary">
            <div>
              <span>{copy("Required inputs", "Zorunlu girdiler")}</span>
              <p>
                {copy(
                  "These assumptions must be present for the financial model to be saved.",
                  "Finansal modelin kaydedilmesi için bu varsayımlar girilmelidir.",
                )}
              </p>
            </div>
          </summary>
          <div className="financial-input-grid">
            {requiredFinancialSettingFields.map((field) => renderFinancialField(field, true))}
          </div>
        </details>

        <details className="financial-input-section general-financial-assumptions progressive-input-box">
          <summary className="financial-input-section-heading progressive-section-summary">
            <div>
              <span>{copy("General financial assumptions", "Genel finansal varsayımlar")}</span>
              <p>
                {copy(
                  "Grant, tax, VAT, collection, supplier payment, stock holding and starting capacity assumptions.",
                  "Yatırım/hibe, vergi, KDV, tahsilat, tedarikçi ödeme, stok tutma ve başlangıç kapasitesi varsayımları.",
                )}
              </p>
            </div>
          </summary>
          <div className="financial-input-grid">
            {generalFinancialAssumptionFields.map((field) => renderFinancialField(field, true))}
          </div>
        </details>

        <details className="financial-input-section optional-macro-section progressive-input-box">
          <summary className="financial-input-section-heading progressive-section-summary">
            <div>
              <span>{copy("Optional macro assumptions", "Opsiyonel makro varsayımlar")}</span>
              <p>
                {copy(
                  "These percentages can inflate material, wage, energy and overhead projections month by month. Leave empty or zero to ignore.",
                  "Bu yüzdeler malzeme, ücret, enerji ve genel gider projeksiyonlarını aylık artırabilir. Dikkate almak istemiyorsanız boş veya sıfır bırakın.",
                )}
              </p>
            </div>
          </summary>
          <div className="financial-input-grid">
            {optionalMacroFinancialSettingFields.map((field) => renderFinancialField(field, false))}
          </div>
        </details>

        <details className="financial-input-section inflation-revaluation-section progressive-input-box">
          <summary className="financial-input-section-heading progressive-section-summary">
            <div>
              <span>{copy("Inflation and revaluation", "Enflasyon ve yeniden değerleme")}</span>
              <p>
                {copy(
                  "Annual COGS, OpEx and price increase policies. Frequency controls how annual increases step through the projection.",
                  "Yıllık SMM, OpEx ve fiyat artışı politikaları. Artış sıklığı yıllık artışların projeksiyona nasıl dağıtılacağını belirler.",
                )}
              </p>
            </div>
          </summary>
          <div className="financial-input-grid">
            {inflationRevaluationFinancialFields.map((field) => renderFinancialField(field, true))}
          </div>
        </details>

        <details className="financial-input-section valuation-section progressive-input-box">
          <summary className="financial-input-section-heading progressive-section-summary">
            <div>
              <span>{copy("Investment valuation", "Yatırım değerlemesi")}</span>
              <p>
                {copy(
                  "Discount rate for net present value. Leave empty to use 30% a year.",
                  "Net bugünkü değer için iskonto oranı. Boş bırakırsanız yıllık %30 kullanılır.",
                )}
              </p>
            </div>
          </summary>
          <div className="financial-input-grid">
            {valuationFinancialSettingFields.map((field) => renderFinancialField(field, false))}
          </div>
        </details>

        <button type="submit" disabled={financialLoading}>
          {copy("Save Assumptions", "Varsayımları Kaydet")}
        </button>
      </form>

      <form className="financial-extra-cost-form" onSubmit={handleSaveFinancialExtraCost}>
        <div className="financial-input-section-heading">
          <div>
            <span>{copy("Optional expense", "Opsiyonel gider")}</span>
            <p>
              {copy(
                "Add one-off or recurring costs without breaking the main assumption grid.",
                "Ana varsayım gridini bozmadan tek seferlik veya tekrarlayan gider ekleyin.",
              )}
            </p>
          </div>
        </div>
        <div className="financial-extra-cost-fields">
          <label>
            <span>{copy("Optional expense name", "Opsiyonel gider adı")}</span>
            <input
              type="text"
              value={financialExtraCostForm.name}
              onChange={(event) => setFinancialExtraCostForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label>
            <span>{copy("Type", "Tip")}</span>
            <select
              value={financialExtraCostForm.costType}
              onChange={(event) =>
                setFinancialExtraCostForm((current) => ({ ...current, costType: event.target.value }))
              }
            >
              <option value="initial">{copy("Initial", "Başlangıç")}</option>
              <option value="recurring">{copy("Recurring", "Tekrarlayan")}</option>
            </select>
          </label>
          <label>
            <span>{copy("Amount", "Tutar")}</span>
            <input
              min="0"
              step="0.01"
              type="number"
              value={financialExtraCostForm.amount}
              onChange={(event) => setFinancialExtraCostForm((current) => ({ ...current, amount: event.target.value }))}
            />
          </label>
          <button type="submit" disabled={financialLoading}>
            {copy("Add Optional Expense", "Opsiyonel Gider Ekle")}
          </button>
        </div>
      </form>
    </div>
  );
  const financialLoanRows = Array.isArray(financialSettingsForm.loanRows) ? financialSettingsForm.loanRows : [];
  const calculatedLoanRows = getFinancialLoanRows(financialSettingsForm);
  const longestLoanTerm = calculatedLoanRows.reduce(
    (longestTerm, loan) => Math.max(longestTerm, loan.loanTermMonths),
    0,
  );
  const longestGracePeriod = calculatedLoanRows.reduce(
    (longestGrace, loan) => Math.max(longestGrace, loan.gracePeriodMonths),
    0,
  );
  const getLoanCurrencyTotals = (selector) => {
    const totals = calculatedLoanRows.reduce((groupedTotals, loan) => {
      const currency = normalizeCurrencyCode(loan.currency);
      groupedTotals.set(currency, (groupedTotals.get(currency) || 0) + Math.max(0, selector(loan)));
      return groupedTotals;
    }, new Map());

    return Array.from(totals.entries())
      .map(([currency, amount]) => ({ amount, currency }))
      .sort((first, second) => {
        const firstIndex = financialLoanCurrencyOptions.indexOf(first.currency);
        const secondIndex = financialLoanCurrencyOptions.indexOf(second.currency);
        return (
          (firstIndex === -1 ? 999 : firstIndex) - (secondIndex === -1 ? 999 : secondIndex) ||
          first.currency.localeCompare(second.currency)
        );
      });
  };
  const formatLoanCurrencyTotals = (totals) =>
    totals.length ? totals.map((total) => formatCurrencyAmount(total.amount, total.currency)).join(" / ") : "-";
  const loanAmountTotals = getLoanCurrencyTotals((loan) => loan.amount);
  const monthlyLoanPaymentTotals = getLoanCurrencyTotals((loan) => loan.monthlyPayment);
  const estimatedLoanInterestTotals = getLoanCurrencyTotals((loan) =>
    Math.max(0, loan.monthlyPayment * loan.repaymentTermMonths - loan.amount),
  );
  const totalLoanAmountTry = calculatedLoanRows.reduce(
    (total, loan) => total + convertMoneyToTry(loan.amount, loan.currency, exchangeRates),
    0,
  );
  const totalMonthlyLoanPaymentTry = calculatedLoanRows.reduce(
    (total, loan) => total + convertMoneyToTry(loan.monthlyPayment, loan.currency, exchangeRates),
    0,
  );
  const estimatedLoanInterestTry = calculatedLoanRows.reduce(
    (total, loan) =>
      total +
      convertMoneyToTry(
        Math.max(0, loan.monthlyPayment * loan.repaymentTermMonths - loan.amount),
        loan.currency,
        exchangeRates,
      ),
    0,
  );
  const hasForeignCurrencyLoan = calculatedLoanRows.some((loan) => normalizeCurrencyCode(loan.currency) !== "TRY");
  const canConvertLoanCurrencies = !hasForeignCurrencyLoan || hasUsableExchangeRates(exchangeRates);
  const loanTryDetail = canConvertLoanCurrencies
    ? copy("TRY + USD x USD/TRY + EUR x EUR/TRY", "TL + USD x USD/TRY + EUR x EUR/TRY")
    : exchangeRates.status === "loading"
      ? copy("FX rates are loading", "kurlar yükleniyor")
      : copy("USD/EUR rate needed", "USD/EUR kuru gerekli");
  const formatLoanTryTotal = (value) =>
    canConvertLoanCurrencies ? formatLira(value) : copy("FX rate needed", "Kur gerekli");
  const loanPaymentCalendar = buildFinancialLoanPaymentCalendar(calculatedLoanRows);
  const renderFinancialLoanPaymentCalendar = () => (
    <section className="financial-input-section optional financial-loan-calendar-section">
      <div className="financial-input-section-heading">
        <div>
          <span>{copy("Payment calendar", "Ödeme takvimi")}</span>
          <p>
            {copy(
              "Months start from the current month. Colored cells show which loan has a payment in that month and the required amount.",
              "Aylar içinde bulunduğunuz aydan başlar. Renkli hücreler o ay hangi kredinin ödemesi olduğunu ve gereken tutarı gösterir.",
            )}
          </p>
        </div>
        <strong>
          {loanPaymentCalendar.months.length} {copy("mo", "ay")}
        </strong>
      </div>
      <div className="financial-loan-calendar-scroll">
        <div
          className="financial-loan-calendar-grid"
          style={{
            gridTemplateColumns: `minmax(122px, 0.72fr) repeat(${loanPaymentCalendar.months.length}, minmax(64px, 1fr))`,
          }}
        >
          <div className="loan-calendar-cell loan-calendar-corner">{copy("Loan", "Kredi")}</div>
          {loanPaymentCalendar.months.map((month) => (
            <div className="loan-calendar-cell loan-calendar-month" key={month.key}>
              <strong>{month.label}</strong>
            </div>
          ))}

          {loanPaymentCalendar.rows.length ? (
            loanPaymentCalendar.rows.map((row, rowIndex) => (
              <React.Fragment key={row.loan.id || `calendar-loan-${rowIndex}`}>
                <div className="loan-calendar-cell loan-calendar-loan">
                  <strong>{row.loan.name || `${copy("Loan", "Kredi")} ${rowIndex + 1}`}</strong>
                  <span>
                    {row.loan.currency} / {formatCurrencyAmount(row.loan.amount, row.loan.currency)}
                  </span>
                </div>
                {row.payments.map((payment) => (
                  <div
                    className="loan-calendar-cell loan-calendar-payment-cell"
                    key={`${row.loan.id}-${payment.monthKey}`}
                  >
                    {payment.isActive && (
                      <div className={`loan-calendar-payment tone-${row.tone}`}>
                        <strong>{formatCurrencyAmount(payment.amount, row.loan.currency)}</strong>
                        <span>{row.loan.name || `${copy("Loan", "Kredi")} ${rowIndex + 1}`}</span>
                      </div>
                    )}
                  </div>
                ))}
              </React.Fragment>
            ))
          ) : (
            <>
              <div className="loan-calendar-cell loan-calendar-loan">
                <strong>{copy("No loan", "Kredi yok")}</strong>
                <span>{copy("Add a loan to see payments.", "Ödemeleri görmek için kredi ekleyin.")}</span>
              </div>
              {loanPaymentCalendar.months.map((month) => (
                <div className="loan-calendar-cell loan-calendar-payment-cell" key={`empty-${month.key}`} />
              ))}
            </>
          )}

          <div className="loan-calendar-cell loan-calendar-total-label">
            <strong>{copy("Monthly total", "Aylık toplam")}</strong>
          </div>
          {loanPaymentCalendar.months.map((month) => (
            <div className="loan-calendar-cell loan-calendar-total" key={`total-${month.key}`}>
              {month.totals.length ? (
                month.totals.map((total) => (
                  <span key={total.currency}>{formatCurrencyAmount(total.amount, total.currency)}</span>
                ))
              ) : (
                <span>-</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
  const renderFinancialLoans = () => (
    <form className="financial-loan-form" onSubmit={handleSaveFinancialSettings}>
      <section className="financial-loan-hero">
        <div>
          <span>{copy("Financing plan", "Finansman planı")}</span>
          <h2>{copy("Loans", "Krediler")}</h2>
          <p>
            {copy(
              "Add each loan separately, including its no-payment grace period. The feasibility model starts cash payments after the grace months.",
              "Her krediyi ayrı ekleyin; ilk kaç ay ödeme olmayacağını belirtin. Fizibilite modeli nakit ödemeleri ödemesiz aylar bittikten sonra başlatır.",
            )}
          </p>
        </div>
        <button type="button" onClick={addFinancialLoanRow}>
          {copy("Add Loan", "Kredi Ekle")}
        </button>
      </section>

      <section className="financial-loan-summary-grid">
        {[
          [
            copy("Total loan", "Toplam kredi"),
            formatLoanCurrencyTotals(loanAmountTotals),
            copy("by currency", "döviz bazında"),
          ],
          [copy("Total loan in TRY", "TL bazlı toplam kredi"), formatLoanTryTotal(totalLoanAmountTry), loanTryDetail],
          [
            copy("Monthly payment", "Aylık ödeme"),
            formatLoanCurrencyTotals(monthlyLoanPaymentTotals),
            copy("after grace periods", "ödemesiz aylar sonrası"),
          ],
          [
            copy("Monthly payment in TRY", "TL bazlı aylık ödeme"),
            formatLoanTryTotal(totalMonthlyLoanPaymentTry),
            loanTryDetail,
          ],
          [
            copy("Longest term", "En uzun vade"),
            `${formatNumber(longestLoanTerm)} ${copy("mo", "ay")}`,
            copy("including grace", "ödemesiz ay dahil"),
          ],
          [
            copy("Longest grace", "En uzun ödemesiz"),
            `${formatNumber(longestGracePeriod)} ${copy("mo", "ay")}`,
            copy("no cash payment", "nakit ödeme yok"),
          ],
          [
            copy("Estimated interest", "Tahmini faiz"),
            formatLoanCurrencyTotals(estimatedLoanInterestTotals),
            copy("based on current terms", "mevcut koşullara göre"),
          ],
          [
            copy("Estimated interest in TRY", "TL bazlı tahmini faiz"),
            formatLoanTryTotal(estimatedLoanInterestTry),
            loanTryDetail,
          ],
        ].map(([label, value, detail]) => (
          <article className="financial-loan-summary-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{detail}</small>
          </article>
        ))}
      </section>

      <section
        className="financial-loan-currency-section"
        aria-label={copy("Loan currency breakdown", "Kredi döviz kırılımı")}
      >
        {(loanAmountTotals.length ? loanAmountTotals : [{ amount: 0, currency: "TRY" }]).map((total) => {
          const monthlyTotal = monthlyLoanPaymentTotals.find((item) => item.currency === total.currency)?.amount || 0;
          const loanCount = calculatedLoanRows.filter(
            (loan) => normalizeCurrencyCode(loan.currency) === total.currency,
          ).length;

          return (
            <article className="financial-loan-currency-card" key={total.currency}>
              <span>{total.currency}</span>
              <strong>{total.amount ? formatCurrencyAmount(total.amount, total.currency) : "-"}</strong>
              <small>
                {loanCount
                  ? `${formatNumber(loanCount)} ${copy("loan", "kredi")} / ${formatCurrencyAmount(monthlyTotal, total.currency)} ${copy("monthly", "aylık")}`
                  : copy("No loan yet", "Henüz kredi yok")}
              </small>
            </article>
          );
        })}
      </section>

      <details className="financial-input-section optional financial-loan-section progressive-input-box">
        <summary className="financial-input-section-heading progressive-section-summary">
          <div>
            <span>{copy("Loan records", "Kredi kayıtları")}</span>
            <p>
              {copy(
                "Every loan row must include amount, annual interest, grace period, and term. Leave this page empty if there is no loan.",
                "Her kredi satırında tutar, yıllık faiz, ödemesiz ay ve vade girilmelidir. Kredi yoksa bu sayfayı boş bırakabilirsiniz.",
              )}
            </p>
          </div>
          <strong>{financialLoanRows.length}</strong>
        </summary>
        <div className="financial-loan-list">
          {financialLoanRows.length ? (
            financialLoanRows.map((loan, index) => {
              const calculatedLoan =
                calculatedLoanRows.find((row) => row.id === loan.id) || calculatedLoanRows[index] || {};

              return (
                <details
                  className="financial-loan-card progressive-input-box financial-loan-record-box"
                  key={loan.id || `loan-${index}`}
                >
                  <summary className="financial-loan-card-heading progressive-section-summary">
                    <div>
                      <span>{loan.name?.trim() || `${copy("Loan", "Kredi")} ${index + 1}`}</span>
                      <h3>{formatCurrencyAmount(toFiniteNumber(loan.amount), loan.currency)}</h3>
                    </div>
                    <button
                      type="button"
                      className="resource-remove-button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        removeFinancialLoanRow(index);
                      }}
                    >
                      x
                    </button>
                  </summary>
                  <div className="financial-loan-row">
                    <label className="optional-financial-field">
                      <span>
                        {copy("Loan name", "Kredi adı")}
                        <small>{copy("Optional", "Opsiyonel")}</small>
                      </span>
                      <input
                        type="text"
                        value={loan.name ?? ""}
                        onChange={(event) => updateFinancialLoanRow(index, "name", event.target.value)}
                      />
                    </label>
                    <label className="optional-financial-field">
                      <span>
                        {copy("Currency", "Döviz")}
                        <small>{copy("Required", "Zorunlu")}</small>
                      </span>
                      <select
                        required
                        value={normalizeCurrencyCode(loan.currency)}
                        onChange={(event) => updateFinancialLoanRow(index, "currency", event.target.value)}
                      >
                        {financialLoanCurrencyOptions.map((currency) => (
                          <option value={currency} key={currency}>
                            {currency}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="optional-financial-field">
                      <span>
                        {copy("Received date", "Alınma tarihi")}
                        <small>{copy("Required", "Zorunlu")}</small>
                      </span>
                      <input
                        required
                        type="date"
                        value={loan.receivedDate || loan.received_date || getTodayDateInputValue()}
                        onChange={(event) => updateFinancialLoanRow(index, "receivedDate", event.target.value)}
                      />
                    </label>
                    <label className="optional-financial-field">
                      <span>
                        {copy("Loan amount", "Kredi tutarı")}
                        <small>{copy("Required", "Zorunlu")}</small>
                      </span>
                      <input
                        min="0.01"
                        required
                        step="1000"
                        type="number"
                        value={loan.amount ?? ""}
                        onChange={(event) => updateFinancialLoanRow(index, "amount", event.target.value)}
                      />
                    </label>
                    <label className="optional-financial-field">
                      <span>
                        {copy("Annual interest %", "Yıllık faiz %")}
                        <small>{copy("Required", "Zorunlu")}</small>
                      </span>
                      <input
                        min="0"
                        required
                        step="0.01"
                        type="number"
                        value={loan.annualInterestRate ?? ""}
                        onChange={(event) => updateFinancialLoanRow(index, "annualInterestRate", event.target.value)}
                      />
                    </label>
                    <label className="optional-financial-field">
                      <span>
                        {copy("Grace period months", "Ödemesiz ay")}
                        <small>{copy("Required", "Zorunlu")}</small>
                      </span>
                      <input
                        min="0"
                        required
                        step="1"
                        type="number"
                        value={loan.gracePeriodMonths ?? 0}
                        onChange={(event) => updateFinancialLoanRow(index, "gracePeriodMonths", event.target.value)}
                      />
                    </label>
                    <label className="optional-financial-field">
                      <span>
                        {copy("Loan term months", "Kredi vadesi ay")}
                        <small>{copy("Required", "Zorunlu")}</small>
                      </span>
                      <input
                        min="1"
                        required
                        step="1"
                        type="number"
                        value={loan.loanTermMonths ?? ""}
                        onChange={(event) => updateFinancialLoanRow(index, "loanTermMonths", event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="financial-loan-card-metrics">
                    <span>
                      {copy("Payment starts", "Ödeme başlangıcı")}
                      <strong>
                        {calculatedLoan.paymentStartDate
                          ? formatMonthLabel(parseDateInput(calculatedLoan.paymentStartDate))
                          : "-"}
                      </strong>
                    </span>
                    <span>
                      {copy("Payment ends", "Ödeme bitişi")}
                      <strong>
                        {calculatedLoan.paymentEndDate
                          ? formatMonthLabel(parseDateInput(calculatedLoan.paymentEndDate))
                          : "-"}
                      </strong>
                    </span>
                    <span>
                      {copy("Repayment term", "Ödeme vadesi")}
                      <strong>
                        {formatNumber(calculatedLoan.repaymentTermMonths || 0)} {copy("mo", "ay")}
                      </strong>
                    </span>
                    <span>
                      {copy("Monthly payment", "Aylık ödeme")}
                      <strong>
                        {formatCurrencyAmount(calculatedLoan.monthlyPayment || 0, calculatedLoan.currency)}
                      </strong>
                    </span>
                  </div>
                </details>
              );
            })
          ) : (
            <p className="planner-empty-state loan-empty-state">
              {copy("No loan added. The model will use zero loan.", "Kredi eklenmedi. Model sıfır kredi kullanacak.")}
            </p>
          )}
        </div>
      </details>
      {renderFinancialLoanPaymentCalendar()}
      <div className="financial-loan-actions">
        <button type="button" onClick={addFinancialLoanRow}>
          {copy("Add Loan", "Kredi Ekle")}
        </button>
        <button type="submit" disabled={financialLoading}>
          {copy("Save Loans", "Kredileri Kaydet")}
        </button>
      </div>
    </form>
  );
  const renderFinancialTrendCard = () => (
    <article className="financial-card financial-overview-wide financial-trend-card">
      <div className="financial-card-heading">
        <h2>{copy("Income and Expense Projection", "Gelir ve Gider Projeksiyonu")}</h2>
        <div className="mini-tabs">
          {[
            ["6m", copy("6 Months", "6 Ay")],
            ["1y", copy("1 Year", "1 Yıl")],
            ["5y", copy("5 Years", "5 Yıl")],
          ].map(([value, label]) => (
            <button
              type="button"
              className={financialHorizon === value ? "active" : ""}
              onClick={() => {
                setFinancialHorizon(value);
                loadFinancialData(value);
              }}
              key={value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-legend" aria-label={copy("Chart color legend", "Grafik renk açıklaması")}>
        <span className="legend-sales">{copy("Income", "Gelir")}</span>
        <span className="legend-costs">{copy("Expense", "Gider")}</span>
      </div>
      {renderIncomeExpenseTrendSvg(copy("Income and expense projection chart", "Gelir ve gider projeksiyon grafiği"))}
    </article>
  );
  const statementProjectionRows = statementProjectionModel.trendRows || [];
  const projectionPeriodMonths =
    financialStatementPeriod === "monthly" ? 1 : financialStatementPeriod === "yearly" ? 12 : 3;
  const projectionPeriodCount =
    financialStatementPeriod === "monthly" ? 24 : financialStatementPeriod === "yearly" ? 5 : 4;
  const projectionPeriodCountLabel =
    financialStatementPeriod === "monthly"
      ? copy("24 months", "24 ay")
      : financialStatementPeriod === "yearly"
        ? copy("5 years", "5 yıl")
        : copy("4 quarters", "4 çeyrek");
  const formatProjectionDate = (date) =>
    new Intl.DateTimeFormat(document.documentElement.lang === "tr" ? "tr-TR" : "en-US", {
      month: "short",
      year: "numeric",
    }).format(date);
  const getProjectionDateAtOffset = (offset) => {
    const date = getMonthStart(new Date());
    date.setMonth(date.getMonth() + offset);
    return date;
  };
  const getProjectionRangeLabel = (startOffset, monthSpan) => {
    const startDate = getProjectionDateAtOffset(startOffset);
    const endDate = getProjectionDateAtOffset(startOffset + Math.max(0, monthSpan - 1));
    return `${formatProjectionDate(startDate)} - ${formatProjectionDate(endDate)}`;
  };
  const buildProjectionPeriod = (index) => {
    const startIndex = index * projectionPeriodMonths;
    const periodRows = statementProjectionRows.slice(startIndex, startIndex + projectionPeriodMonths);
    const sum = (key) => periodRows.reduce((total, row) => total + toFiniteNumber(row[key]), 0);
    const firstRow = periodRows[0] || {};
    const lastRow = periodRows[periodRows.length - 1] || {};
    const salesRevenue = sum("salesRevenue");
    const materialCost = sum("materialCost");
    const workforceCost = sum("workforceCost");
    const electricityCost = sum("electricityCost");
    const otherProductionCost = sum("otherProductionCost");
    const writeOffCost = sum("writeOffCost");
    const grossProfit =
      salesRevenue - materialCost - workforceCost - electricityCost - otherProductionCost - writeOffCost;
    const netIncome = sum("netIncome");
    const sellingCost = sum("sellingCost");
    const overheadCost = sum("overheadCost");

    return {
      cashFlow: sum("cashFlow"),
      equity: toFiniteNumber(lastRow.equity),
      fixedAssets: toFiniteNumber(lastRow.fixedAssets),
      inventoryValue: toFiniteNumber(lastRow.inventoryValue),
      loanBalance: toFiniteNumber(lastRow.loanBalance),
      operatingProfit: grossProfit - sellingCost - overheadCost,
      otherLiabilities:
        toFiniteNumber(lastRow.payables) + toFiniteNumber(lastRow.vatDue) + toFiniteNumber(lastRow.taxPayable),
      otherAssets: toFiniteNumber(lastRow.receivables) + toFiniteNumber(lastRow.vatCredit),
      overheadCost,
      sellingCost,
      totalAssets: toFiniteNumber(lastRow.totalAssets),
      totalLiabilitiesAndEquity: toFiniteNumber(lastRow.totalLiabilitiesAndEquity),
      endingCash: toFiniteNumber(lastRow.cashBalance),
      grossMargin: salesRevenue ? (grossProfit / salesRevenue) * 100 : 0,
      grossProfit,
      incomeTax: sum("incomeTax"),
      label:
        financialStatementPeriod === "monthly"
          ? `${copy("Month", "Ay")} ${index + 1}`
          : financialStatementPeriod === "yearly"
            ? copy(`Year ${index + 1}`, `Yıl ${index + 1}`)
            : copy(`Q${index + 1}`, `Ç${index + 1}`),
      loanInterest: sum("loanInterest"),
      materialCost,
      netIncome,
      otherProductionCost,
      netMargin: salesRevenue ? (netIncome / salesRevenue) * 100 : 0,
      netSoldUnits: sum("netSoldUnits"),
      periodRows,
      inventoryUnits: toFiniteNumber(lastRow.inventoryUnits),
      producedUnits: sum("producedUnits"),
      rangeLabel: getProjectionRangeLabel(startIndex, projectionPeriodMonths),
      salesRevenue,
      startingCash: toFiniteNumber(firstRow.cashBalance) - toFiniteNumber(firstRow.cashFlow),
      totalCost: sum("totalCost"),
      vatPayable: sum("vatPayable"),
      writeOffCost,
      workforceCost,
      electricityCost,
    };
  };
  const financialStatementPeriods = Array.from({ length: projectionPeriodCount }, (_, index) =>
    buildProjectionPeriod(index),
  );
  const statementPeriodColumnWidth = financialStatementPeriod === "monthly" ? 116 : 132;
  const statementGridTemplate = `minmax(240px, 1.22fr) repeat(${financialStatementPeriods.length}, minmax(${statementPeriodColumnWidth}px, 1fr))`;
  const statementGridMinWidth = `${260 + financialStatementPeriods.length * statementPeriodColumnWidth}px`;
  const projectionRows = [
    { id: "income-section", section: copy("Income Statement", "Gelir Tablosu") },
    {
      detail: copy("From channel sales forecast", "Kanal satış tahmininden"),
      emphasis: true,
      format: "money",
      id: "salesRevenue",
      label: copy("Net Sales", "Net Satışlar"),
      tone: "income",
      value: (period) => period.salesRevenue,
    },
    {
      detail: copy("Material input cost", "Malzeme girdi maliyeti"),
      format: "money",
      id: "materialCost",
      label: copy("Materials", "Malzemeler"),
      tone: "cost",
      value: (period) => period.materialCost,
    },
    {
      detail: copy("Labor and salary cost", "İşçilik ve maaş maliyeti"),
      format: "money",
      id: "workforceCost",
      label: copy("Labor", "İşçilik"),
      tone: "cost",
      value: (period) => period.workforceCost,
    },
    {
      detail: copy("Energy cost from operations", "Operasyonlardan gelen enerji maliyeti"),
      format: "money",
      id: "electricityCost",
      label: copy("Energy", "Enerji"),
      tone: "cost",
      value: (period) => period.electricityCost,
    },
    {
      detail: copy("Machines and equipment, straight-line, non-cash", "Makine ve ekipman, doğrusal, nakit dışı"),
      format: "money",
      id: "otherProductionCost",
      label: copy("Depreciation", "Amortisman"),
      tone: "cost",
      value: (period) => period.otherProductionCost,
    },
    {
      detail: copy("Cost of returned units", "İade edilen ürünlerin maliyeti"),
      format: "money",
      id: "writeOffCost",
      label: copy("Returns Write-off", "İade Maliyeti"),
      tone: "cost",
      value: (period) => period.writeOffCost,
    },
    {
      detail: copy("Net sales minus cost of units sold", "Net satışlardan satılan ürünlerin maliyeti düşülmüş hali"),
      emphasis: true,
      format: "money",
      id: "grossProfit",
      label: copy("Gross Profit", "Brüt Kâr"),
      signed: true,
      value: (period) => period.grossProfit,
    },
    {
      detail: copy(
        "Channel commission, acquisition cost and campaigns",
        "Kanal komisyonu, müşteri edinme ve kampanyalar",
      ),
      format: "money",
      id: "sellingCost",
      label: copy("Selling Expenses", "Satış ve Pazarlama Giderleri"),
      tone: "cost",
      value: (period) => period.sellingCost,
    },
    {
      detail: copy(
        "Recurring overhead and one-off start-up costs",
        "Tekrarlayan genel giderler ve tek seferlik başlangıç giderleri",
      ),
      format: "money",
      id: "overheadCost",
      label: copy("Overhead", "Genel Giderler"),
      tone: "cost",
      value: (period) => period.overheadCost,
    },
    {
      detail: copy("Before interest and tax", "Faiz ve vergi öncesi"),
      emphasis: true,
      format: "money",
      id: "operatingProfit",
      label: copy("Operating Profit", "Faaliyet Kârı"),
      signed: true,
      value: (period) => period.operatingProfit,
    },
    {
      detail: copy("Interest accrued from active loans", "Aktif kredilerden işleyen faiz"),
      format: "money",
      id: "loanInterest",
      label: copy("Loan Interest", "Kredi Faizi"),
      tone: "cost",
      value: (period) => period.loanInterest,
    },
    {
      detail: copy(
        "Annual profit after losses carried forward",
        "Devreden zararlar mahsup edilmiş yıllık kâr üzerinden",
      ),
      format: "money",
      id: "incomeTax",
      label: copy("Income Tax", "Gelir Vergisi"),
      tone: "tax",
      value: (period) => period.incomeTax,
    },
    {
      detail: copy("All cost lines carried by the model", "Modelin taşıdığı tüm maliyet satırları"),
      emphasis: true,
      format: "money",
      id: "totalCost",
      label: copy("Total Expenses", "Toplam Giderler"),
      tone: "cost",
      value: (period) => period.totalCost,
    },
    {
      detail: copy(
        "After all operating, financing and tax costs",
        "Tüm operasyon, finansman ve vergi maliyetlerinden sonra",
      ),
      emphasis: true,
      format: "money",
      id: "netIncome",
      label: copy("Net Profit", "Net Kâr"),
      signed: true,
      value: (period) => period.netIncome,
    },
    {
      detail: copy("Net profit divided by net sales", "Net kârın net satışlara oranı"),
      format: "percent",
      id: "netMargin",
      label: copy("Net Profit Margin", "Net Kâr Marjı"),
      signed: true,
      value: (period) => period.netMargin,
    },
    { id: "cash-section", section: copy("Cash Flow", "Nakit Akışı") },
    {
      detail: copy("Cash at the start of the period", "Dönem başındaki nakit"),
      format: "money",
      id: "startingCash",
      label: copy("Starting Cash", "Dönem Başı Nakit"),
      signed: true,
      value: (period) => period.startingCash,
    },
    {
      detail: copy("Net movement inside the period", "Dönem içi net hareket"),
      emphasis: true,
      format: "money",
      id: "cashFlow",
      label: copy("Net Cash Flow", "Net Nakit Akışı"),
      signed: true,
      value: (period) => period.cashFlow,
    },
    {
      detail: copy("Cash left after the period closes", "Dönem kapandıktan sonra kalan nakit"),
      emphasis: true,
      format: "money",
      id: "endingCash",
      label: copy("Ending Cash", "Dönem Sonu Nakit"),
      signed: true,
      value: (period) => period.endingCash,
    },
    {
      detail: copy(
        "Output VAT minus input VAT, paid the following month",
        "Hesaplanan KDV eksi indirilecek KDV, ertesi ay ödenir",
      ),
      format: "money",
      id: "vatPayable",
      label: copy("VAT Payable", "Ödenecek KDV"),
      tone: "tax",
      value: (period) => period.vatPayable,
    },
    { id: "balance-section", section: copy("Balance Sheet (period end)", "Bilanço (dönem sonu)") },
    {
      detail: copy("Customer receivables and VAT credit", "Müşteri alacakları ve devreden KDV"),
      format: "money",
      id: "otherAssets",
      label: copy("Receivables", "Alacaklar"),
      value: (period) => period.otherAssets,
    },
    {
      detail: copy("Finished goods and raw material stock at cost", "Mamul ve hammadde stoku, maliyet bedeliyle"),
      format: "money",
      id: "inventoryValue",
      label: copy("Inventory", "Stoklar"),
      value: (period) => period.inventoryValue,
    },
    {
      detail: copy("Machines and equipment after depreciation", "Amortisman sonrası makine ve ekipman"),
      format: "money",
      id: "fixedAssets",
      label: copy("Fixed Assets", "Duran Varlıklar"),
      value: (period) => period.fixedAssets,
    },
    {
      detail: copy("Cash, receivables, inventory and fixed assets", "Nakit, alacak, stok ve duran varlıklar"),
      emphasis: true,
      format: "money",
      id: "totalAssets",
      label: copy("Total Assets", "Toplam Aktif"),
      value: (period) => period.totalAssets,
    },
    {
      detail: copy("Supplier, VAT and income tax payables", "Tedarikçi, KDV ve gelir vergisi borçları"),
      format: "money",
      id: "otherLiabilities",
      label: copy("Payables", "Kısa Vadeli Borçlar"),
      value: (period) => period.otherLiabilities,
    },
    {
      detail: copy("Outstanding loan principal", "Kalan kredi anaparası"),
      format: "money",
      id: "loanBalance",
      label: copy("Loans", "Krediler"),
      value: (period) => period.loanBalance,
    },
    {
      detail: copy("Paid-in capital, grants and retained earnings", "Sermaye, hibe ve birikmiş kâr"),
      format: "money",
      id: "equity",
      label: copy("Equity", "Özkaynak"),
      signed: true,
      value: (period) => period.equity,
    },
    {
      detail: copy("Must equal total assets", "Toplam aktife eşit olmalı"),
      emphasis: true,
      format: "money",
      id: "totalLiabilitiesAndEquity",
      label: copy("Total Liabilities and Equity", "Toplam Pasif"),
      value: (period) => period.totalLiabilitiesAndEquity,
    },
    { id: "operations-section", section: copy("Operating Volume", "Operasyon Hacmi") },
    {
      detail: copy("Units produced by active process plans", "Aktif süreç planlarıyla üretilen adet"),
      format: "number",
      id: "producedUnits",
      label: copy("Produced Units", "Üretilen Adet"),
      value: (period) => period.producedUnits,
    },
    {
      detail: copy("Units sold after returns", "İadeler sonrası satılan adet"),
      format: "number",
      id: "netSoldUnits",
      label: copy("Net Sold Units", "Net Satılan Adet"),
      value: (period) => period.netSoldUnits,
    },
    {
      detail: copy("Finished goods left at period end", "Dönem sonunda kalan mamul"),
      format: "number",
      id: "inventoryUnits",
      label: copy("Units in Stock", "Stoktaki Adet"),
      value: (period) => period.inventoryUnits,
    },
  ];
  const formatProjectionValue = (row, period) => {
    const value = toFiniteNumber(row.value(period));
    if (row.format === "percent") return `${formatNumber(value, 1)}%`;
    if (row.format === "number") return formatNumber(value);
    return formatLira(value);
  };
  const getProjectionValueTone = (row, period) => {
    if (!row.signed) return row.tone || "";
    return toFiniteNumber(row.value(period)) >= 0 ? "positive" : "negative";
  };
  const renderOverviewFinancialRows = () => (
    <article className="financial-card income-card financial-overview-wide">
      <div className="financial-card-heading">
        <div>
          <h2>{copy("Financial Statement", "Finansal Tablo")}</h2>
          <p>
            {financialStatementPeriod === "monthly"
              ? copy("Forward projection view for the next 24 months.", "Önümüzdeki 24 ay için projeksiyon görünümü.")
              : financialStatementPeriod === "yearly"
                ? copy(
                    "Five-year income statement, cash flow and balance sheet.",
                    "5 yıllık gelir tablosu, nakit akışı ve bilanço.",
                  )
                : copy(
                    "Forward projection view for the next four quarters.",
                    "Önümüzdeki dört çeyrek için projeksiyon görünümü.",
                  )}
          </p>
        </div>
        <div className="financial-statement-controls">
          <span className="financial-row-count">{projectionPeriodCountLabel}</span>
          <div
            className="financial-statement-toggle"
            role="group"
            aria-label={copy("Statement period", "Tablo dönemi")}
          >
            {[
              ["monthly", copy("Monthly", "Aylık")],
              ["quarterly", copy("Quarterly", "Çeyreklik")],
              ["yearly", copy("Yearly", "Yıllık")],
            ].map(([value, label]) => (
              <button
                type="button"
                className={financialStatementPeriod === value ? "active" : ""}
                onClick={() => setFinancialStatementPeriod(value)}
                key={value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="financial-statement financial-projection-statement">
        <div className="financial-projection-scroll">
          <div
            className="financial-projection-row financial-projection-head"
            style={{ gridTemplateColumns: statementGridTemplate, minWidth: statementGridMinWidth }}
          >
            <span>{copy("Line Item", "Kalem")}</span>
            {financialStatementPeriods.map((period) => (
              <span key={period.label}>
                <strong>{period.label}</strong>
                <small>{period.rangeLabel}</small>
              </span>
            ))}
          </div>
          {projectionRows.map((row) =>
            row.section ? (
              <div
                className="financial-projection-row financial-projection-section"
                style={{ gridTemplateColumns: statementGridTemplate, minWidth: statementGridMinWidth }}
                key={row.id}
              >
                <strong>{row.section}</strong>
                {financialStatementPeriods.map((period) => (
                  <span key={`${row.id}-${period.label}`} />
                ))}
              </div>
            ) : (
              <div
                className={`financial-projection-row financial-projection-line ${row.emphasis ? "emphasis" : ""}`}
                style={{ gridTemplateColumns: statementGridTemplate, minWidth: statementGridMinWidth }}
                key={row.id}
              >
                <div>
                  <strong>{row.label}</strong>
                  <small>{row.detail}</small>
                </div>
                {financialStatementPeriods.map((period) => (
                  <b className={getProjectionValueTone(row, period)} key={`${row.id}-${period.label}`}>
                    {formatProjectionValue(row, period)}
                  </b>
                ))}
              </div>
            ),
          )}
        </div>
      </div>
    </article>
  );
  const renderWidgetMetric = (label, value, detail) => (
    <div className="financial-widget-metric">
      <span className="label-with-info">
        {label}
        <GlossaryTip language={form.language} term={label} />
      </span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
  const renderWidgetScenarioList = (rows, emptyLabel) => (
    <div className="scenario-list">
      {(rows.length ? rows : [{ id: "empty", name: emptyLabel, costType: "-", amount: 0 }]).map((item) => (
        <div className="scenario-row" key={item.id || item.name}>
          <div>
            <strong>{item.name || getFinancialRowLabel(item)}</strong>
            <span>
              {item.costType === "initial"
                ? copy("Initial expense", "Başlangıç gideri")
                : item.costType === "recurring"
                  ? copy("Recurring expense", "Tekrarlayan gider")
                  : item.costType || "-"}
            </span>
          </div>
          <strong>{item.id === "empty" ? "-" : formatLira(item.amount)}</strong>
        </div>
      ))}
    </div>
  );
  const financialWidgetCatalog = [
    {
      detail: copy("Liquidity after current inputs", "Mevcut girdilerle likidite"),
      id: "cashRunway",
      render: () =>
        renderWidgetMetric(
          copy("Cash Runway", "Nakit Dayanma"),
          `${formatNumber(summary.cashRunwayMonths)} ${copy("months", "ay")}`,
          copy(
            "Uses initial cash, loans and monthly cash flow",
            "Başlangıç nakdi, krediler ve aylık nakit akışını kullanır",
          ),
        ),
      title: copy("Cash Runway", "Nakit Dayanma"),
    },
    {
      detail: copy("First profitable operating month", "İlk kârlı operasyon ayı"),
      id: "breakEven",
      render: () =>
        renderWidgetMetric(
          copy("Break-even", "Başa Baş"),
          formatMonth(summary.breakEvenMonth),
          copy("Revenue minus operating cost and taxes", "Gelir eksi operasyon maliyeti ve vergiler"),
        ),
      title: copy("Break-even", "Başa Baş"),
    },
    {
      detail: copy("Investment recovery estimate", "Yatırım geri dönüş tahmini"),
      id: "payback",
      render: () =>
        renderWidgetMetric(
          copy("Payback", "Geri Dönüş"),
          formatMonth(summary.paybackMonth),
          copy(
            "Investment, working capital and loan effect included",
            "Yatırım, işletme sermayesi ve kredi etkisi dahil",
          ),
        ),
      title: copy("Payback", "Geri Dönüş"),
    },
    {
      detail: copy("Break-even sales volume", "Başa baş satış hacmi"),
      id: "requiredSales",
      render: () =>
        renderWidgetMetric(
          copy("Required Monthly Sales", "Gerekli Aylık Satış"),
          formatNumber(summary.requiredMonthlySalesVolume),
          copy("Based on contribution per unit", "Birim katkı payına göre"),
        ),
      title: copy("Required Sales", "Gerekli Satış"),
    },
    {
      detail: copy("Forecast not sold", "Satışa dönüşmeyen tahmin"),
      id: "inventoryRisk",
      render: () =>
        renderWidgetMetric(
          copy("Unsold Inventory", "Satılmayan Stok"),
          `${formatNumber(summary.unsoldInventoryUnits)} ${copy("units", "adet")}`,
          copy("Production above channel sales plan", "Kanal satış planını aşan üretim"),
        ),
      title: copy("Inventory Risk", "Stok Riski"),
    },
    {
      detail: copy("Spoilage and return write-off", "Fire ve iade maliyeti"),
      id: "writeOff",
      render: () =>
        renderWidgetMetric(
          copy("Write-off Value", "Fire / İade Değeri"),
          formatLira(summary.expiredWriteOffCost),
          copy("Sales strategy return and spoilage inputs", "Satış stratejisi iade ve fire girdileri"),
        ),
      title: copy("Write-off", "Fire / İade"),
    },
    {
      detail: copy("VAT and income tax", "KDV ve gelir vergisi"),
      id: "taxLoad",
      render: () =>
        renderWidgetMetric(
          copy("Tax Load", "Vergi Yükü"),
          formatLira(summary.vatPayable + summary.incomeTax),
          copy("Tax inputs from financial assumptions", "Finansal varsayımlardan gelen vergi girdileri"),
        ),
      title: copy("Tax Load", "Vergi Yükü"),
    },
    {
      detail: copy("Loan payment impact", "Kredi ödeme etkisi"),
      id: "loanSummary",
      render: () => (
        <div className="financial-widget-pair">
          {renderWidgetMetric(
            copy("Monthly Payment", "Aylık Ödeme"),
            formatLira(summary.loanPayment),
            copy("Current active installments", "Mevcut aktif taksitler"),
          )}
          {renderWidgetMetric(
            copy("Total Loan", "Toplam Kredi"),
            formatLira(summary.loanAmount),
            copy("Saved in Loans page", "Krediler sayfasında kayıtlı"),
          )}
        </div>
      ),
      title: copy("Loan Summary", "Kredi Özeti"),
    },
    {
      detail: copy("Operations and input cost mix", "Operasyon ve girdi maliyet karması"),
      id: "costTypes",
      render: () =>
        renderBreakdownBars(
          costBreakdownRows,
          maxCostBreakdownAmount,
          copy("No cost data yet", "Henüz maliyet verisi yok"),
          "cost",
        ),
      title: copy("Cost Types", "Maliyet Türleri"),
    },
    {
      detail: copy("Revenue, net and cash return", "Gelir, net ve nakit getiri"),
      id: "returnTypes",
      render: () =>
        renderBreakdownBars(
          returnBreakdownRows,
          maxReturnBreakdownAmount,
          copy("No return data yet", "Henüz getiri verisi yok"),
          "income",
        ),
      title: copy("Return Types", "Getiri Türleri"),
    },
    {
      detail: copy("Machine, equipment and working capital", "Makine, ekipman ve işletme sermayesi"),
      id: "investmentBreakdown",
      render: () =>
        renderBreakdownBars(
          investmentBreakdownRows,
          maxInvestmentBreakdownAmount,
          copy("No investment data yet", "Henüz yatırım verisi yok"),
          "investment",
        ),
      title: copy("Investment Breakdown", "Yatırım Kırılımı"),
    },
    {
      detail: copy("User-entered optional expenses", "Kullanıcının girdiği opsiyonel giderler"),
      id: "optionalExpenses",
      render: () =>
        renderWidgetScenarioList(model.extraCosts || [], copy("No optional expense yet", "Henüz opsiyonel gider yok")),
      title: copy("Optional Expenses", "Opsiyonel Giderler"),
    },
  ];
  const selectedFinancialWidgets = financialOverviewWidgets
    .map((widgetId) => financialWidgetCatalog.find((widget) => widget.id === widgetId))
    .filter(Boolean);
  const renderOverviewWidget = (widget) => (
    <article className="financial-card financial-widget-card" key={widget.id}>
      <div className="financial-card-heading">
        <div>
          <h2>{widget.title}</h2>
          <p>{widget.detail}</p>
        </div>
        <button type="button" className="widget-remove-button" onClick={() => toggleFinancialOverviewWidget(widget.id)}>
          x
        </button>
      </div>
      {widget.render()}
    </article>
  );
  const renderWidgetSelector = () => (
    <article className="financial-card financial-widget-selector">
      <div className="financial-card-heading">
        <div>
          <h2>{copy("Add widgets to this screen", "Bu ekrana widget ekle")}</h2>
          <p>
            {copy(
              "Default view stays focused on financial rows and the projection chart. Pick the metrics you want to keep on your saved screen.",
              "Varsayılan görünüm finansal satırlar ve projeksiyon grafiğine odaklı kalır. Kayıtlı ekranında görmek istediğin metrikleri seç.",
            )}
          </p>
        </div>
        <button type="button" className="primary" onClick={saveFinancialOverviewScreen} disabled={financialLoading}>
          {copy("Save Screen", "Ekranı Kaydet")}
        </button>
      </div>
      <div className="financial-widget-picker">
        {financialWidgetCatalog.map((widget) => {
          const isSelected = financialOverviewWidgets.includes(widget.id);

          return (
            <button
              type="button"
              className={isSelected ? "selected" : ""}
              onClick={() => toggleFinancialOverviewWidget(widget.id)}
              key={widget.id}
            >
              <strong>{widget.title}</strong>
              <span>{widget.detail}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
  const overviewMonthCount = Math.max(1, getProjectionMonthCount(financialHorizon));
  const overviewHasSalesForecast = salesStrategy.channels.some(
    (channel) => channel.productId && toFiniteNumber(channel.monthlySalesUnits) > 0,
  );
  const overviewIsDecisionReady = Boolean(
    summary.planCount && overviewHasSalesForecast && financialModel.settingsSaved,
  );
  const overviewMonthlyRevenue = toFiniteNumber(summary.salesRevenue) / overviewMonthCount;
  const overviewMonthlyCost = toFiniteNumber(summary.totalCost) / overviewMonthCount;
  const overviewMonthlyNet = toFiniteNumber(summary.netIncome) / overviewMonthCount;
  const overviewProductionCost =
    toFiniteNumber(summary.materialCost) +
    toFiniteNumber(summary.workforceCost) +
    toFiniteNumber(summary.electricityCost) +
    toFiniteNumber(summary.otherProductionCost) +
    toFiniteNumber(summary.expiredWriteOffCost);
  const overviewTaxAndFinanceCost =
    toFiniteNumber(summary.vatPayable) + toFiniteNumber(summary.incomeTax) + toFiniteNumber(summary.loanInterest);
  const overviewInvestmentBase = Math.max(0, investmentTotal);
  const overviewRoiPercent = overviewInvestmentBase
    ? (toFiniteNumber(summary.netIncome) / overviewInvestmentBase) * 100
    : 0;
  const overviewMarginPercent = summary.salesRevenue
    ? (toFiniteNumber(summary.netIncome) / toFiniteNumber(summary.salesRevenue)) * 100
    : 0;
  const overviewCashRunwayLimit = Math.min(overviewMonthCount, 6);
  const overviewDecisionMetrics = [
    {
      detail: copy("Average of the selected projection horizon", "Seçili projeksiyon ufkunun aylık ortalaması"),
      label: copy("Monthly net", "Aylık net"),
      tone: overviewMonthlyNet >= 0 ? "good" : "risk",
      value: overviewIsDecisionReady ? formatLira(overviewMonthlyNet) : "-",
    },
    {
      detail: copy("Revenue after channel effects", "Kanal etkilerinden sonra gelir"),
      label: copy("Monthly revenue", "Aylık ciro"),
      tone: "neutral",
      value: overviewIsDecisionReady ? formatLira(overviewMonthlyRevenue) : "-",
    },
    {
      detail: copy("First month where cash turns negative", "Nakit negatifleşene kadar geçen süre"),
      label: copy("Cash runway", "Nakit dayanma"),
      tone: summary.cashRunwayMonths >= overviewCashRunwayLimit ? "good" : "risk",
      value: overviewIsDecisionReady ? `${formatNumber(summary.cashRunwayMonths)} ${copy("mo", "ay")}` : "-",
    },
    {
      detail: copy("Net income divided by investment base", "Net kazancın yatırım tabanına oranı"),
      label: copy("ROI", "Yatırım getirisi"),
      tone: overviewRoiPercent >= 0 ? "good" : "risk",
      value: overviewIsDecisionReady && overviewInvestmentBase ? `${formatNumber(overviewRoiPercent, 1)}%` : "-",
    },
  ];
  const overviewMoneyFlowRows = [
    {
      amount: summary.salesRevenue,
      detail: copy("Product-linked channel forecast", "Ürüne bağlı kanal tahmini"),
      label: copy("Sales revenue", "Satış geliri"),
      tone: "income",
    },
    {
      amount: -overviewProductionCost,
      detail: copy("Material, labor, energy, write-off", "Malzeme, işçilik, enerji, fire/iade"),
      label: copy("Production cost", "Üretim maliyeti"),
      tone: "cost",
    },
    {
      amount: -toFiniteNumber(summary.extraRecurringCost),
      detail: copy("Recurring optional expenses", "Tekrarlayan opsiyonel giderler"),
      label: copy("Overhead", "Genel gider"),
      tone: "cost",
    },
    {
      amount: -overviewTaxAndFinanceCost,
      detail: copy("VAT, income tax and loan interest", "KDV, gelir vergisi ve kredi faizi"),
      label: copy("Tax and finance", "Vergi ve finansman"),
      tone: "cost",
    },
    {
      amount: summary.netIncome,
      detail: copy("Revenue minus tracked costs", "Gelir eksi takip edilen maliyetler"),
      label: copy("Net return", "Net getiri"),
      tone: "net",
    },
  ];
  const overviewCostBreakdownRows = [
    {
      amount: overviewProductionCost,
      id: "productionCost",
      label: copy("Production cost", "Üretim maliyeti"),
      tone: "cost",
    },
    {
      amount: summary.extraRecurringCost,
      id: "recurringExtraCost",
      label: copy("Recurring overhead", "Tekrarlayan genel gider"),
      tone: "cost",
    },
    {
      amount: overviewTaxAndFinanceCost,
      id: "taxFinance",
      label: copy("Tax and finance", "Vergi ve finansman"),
      tone: "cost",
    },
    {
      amount: summary.machinePurchaseCost + summary.equipmentPurchaseCost + summary.extraInitialCost,
      id: "initialInvestment",
      label: copy("Initial investment", "Başlangıç yatırımı"),
      tone: "investment",
    },
    {
      amount: summary.workingCapitalRequirement,
      id: "workingCapital",
      label: copy("Working capital", "İşletme sermayesi"),
      tone: "investment",
    },
  ].filter((item) => toFiniteNumber(item.amount) > 0);
  const overviewMaxCostBreakdownAmount = Math.max(
    1,
    ...overviewCostBreakdownRows.map((item) => toFiniteNumber(item.amount)),
  );

  if (currentFinancialPage.key === "inputs") {
    return (
      <DashboardLayout activePage={`financial-modelling/${currentFinancialPage.key}`}>
        <section className="financial-workspace">
          <div className="financial-header">
            <div>
              <span>
                {currentFinancialPage.group} / {copy("Financial assumptions", "Finansal varsayımlar")}
              </span>
              <h1>{financialPageMeta.title}</h1>
              <p>{financialPageMeta.description}</p>
            </div>
            <button type="button" className="primary app-command-button" onClick={() => loadFinancialData()}>
              {financialLoading ? copy("Loading...", "Yükleniyor...") : copy("Update Data", "Verileri Güncelle")}
            </button>
          </div>

          {renderFinancialInputs()}
          {financialStatus && <p className="status-message">{financialStatus}</p>}

          <div className="financial-grid">
            <article className="financial-card scenario-card">
              <div className="financial-card-heading">
                <h2>{copy("Saved Optional Expenses", "Kayıtlı Opsiyonel Giderler")}</h2>
              </div>
              <div className="scenario-list">
                {(model.extraCosts?.length
                  ? model.extraCosts
                  : [{ id: "empty", name: copy("No extra cost yet", "Henüz ek gider yok"), costType: "-", amount: 0 }]
                ).map((cost) => (
                  <div className={`scenario-row${cost.id === "empty" ? "" : " has-row-action"}`} key={cost.id}>
                    <div>
                      <strong>{cost.name}</strong>
                      <span>
                        {cost.costType === "initial"
                          ? copy("Initial expense", "Başlangıç gideri")
                          : cost.costType === "recurring"
                            ? copy("Recurring expense", "Tekrarlayan gider")
                            : "-"}
                      </span>
                    </div>
                    <strong>{cost.id === "empty" ? "-" : formatLira(cost.amount)}</strong>
                    {cost.id !== "empty" && (
                      <button
                        type="button"
                        className="table-delete-button"
                        onClick={() => handleDeleteFinancialExtraCost(cost)}
                      >
                        {copy("Delete", "Sil")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      </DashboardLayout>
    );
  }

  if (currentFinancialPage.key === "loans") {
    return (
      <DashboardLayout activePage={`financial-modelling/${currentFinancialPage.key}`}>
        <section className="financial-workspace">
          <div className="financial-header">
            <div>
              <span>
                {currentFinancialPage.group} / {copy("Financing inputs", "Finansman girdileri")}
              </span>
              <h1>{financialPageMeta.title}</h1>
              <p>{financialPageMeta.description}</p>
            </div>
            <button type="button" className="primary app-command-button" onClick={() => loadFinancialData()}>
              {financialLoading ? copy("Loading...", "Yükleniyor...") : copy("Update Data", "Verileri Güncelle")}
            </button>
          </div>

          {financialStatus && <p className="status-message">{financialStatus}</p>}

          <div className="finance-metric-grid">
            {[
              [
                copy("Loan Count", "Kredi Sayısı"),
                formatNumber(financialLoanRows.length),
                copy("separate financing records", "ayrı finansman kaydı"),
              ],
              [
                copy("Total Loan Amount", "Toplam Kredi Tutarı"),
                formatLoanCurrencyTotals(loanAmountTotals),
                copy("by loan currency", "kredi dövizine göre"),
              ],
              [
                copy("Total Loan in TRY", "TL Bazlı Toplam Kredi"),
                formatLoanTryTotal(totalLoanAmountTry),
                loanTryDetail,
              ],
              [
                copy("Monthly Loan Payment", "Aylık Kredi Ödemesi"),
                formatLoanCurrencyTotals(monthlyLoanPaymentTotals),
                copy("sum of active installments", "aktif taksitlerin toplamı"),
              ],
              [
                copy("Monthly Payment in TRY", "TL Bazlı Aylık Ödeme"),
                formatLoanTryTotal(totalMonthlyLoanPaymentTry),
                loanTryDetail,
              ],
              [
                copy("Longest Term", "En Uzun Vade"),
                longestLoanTerm ? `${formatNumber(longestLoanTerm)} ${copy("months", "ay")}` : "-",
                copy("used for repayment schedule", "ödeme planında kullanılır"),
              ],
            ].map(([label, value, detail]) => (
              <article className="finance-metric-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </div>

          {renderFinancialLoans()}
        </section>
      </DashboardLayout>
    );
  }

  // Overview is the last financial page; legacy detail URLs redirect here.
  return (
    <DashboardLayout activePage={`financial-modelling/${currentFinancialPage.key}`}>
      <section className="financial-workspace">
        <div className="financial-header">
          <div>
            <span>
              {currentFinancialPage.group} /{" "}
              {copy("Model connected to Operations data", "Operasyon verisine bağlı model")}
            </span>
            <h1>{financialPageMeta.title}</h1>
            <p>{financialPageMeta.description}</p>
          </div>
          <button type="button" className="primary app-command-button" onClick={() => loadFinancialData()}>
            {financialLoading ? copy("Loading...", "Yükleniyor...") : copy("Update Data", "Verileri Güncelle")}
          </button>
        </div>

        {financialStatus && <p className="status-message">{financialStatus}</p>}

        <div className="financial-overview-grid financial-overview-primary">
          {renderOverviewFinancialRows()}
          {renderFinancialTrendCard()}
        </div>

        <div className="financial-decision-metrics">
          {overviewDecisionMetrics.map((metric) => (
            <article className={`financial-decision-card ${metric.tone}`} key={metric.label}>
              <span className="label-with-info">
                {metric.label}
                <GlossaryTip language={form.language} term={metric.label} />
              </span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </article>
          ))}
        </div>

        <div className="financial-overview-layout financial-overview-two-up">
          <article className="financial-panel financial-flow-panel">
            <div className="financial-panel-heading">
              <div>
                <span>{copy("Money flow", "Para akışı")}</span>
                <h2>{copy("From sales to net return", "Satıştan net getiriye")}</h2>
              </div>
              <strong>{overviewIsDecisionReady ? `${formatNumber(overviewMarginPercent, 1)}%` : "-"}</strong>
            </div>
            <div className="financial-flow-grid">
              {overviewMoneyFlowRows.map((row) => (
                <div className={`financial-flow-card ${row.tone}`} key={row.label}>
                  <span>{row.label}</span>
                  <strong>{overviewIsDecisionReady ? formatLira(row.amount) : "-"}</strong>
                  <small>{row.detail}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="financial-panel financial-breakdown-panel">
            <div className="financial-panel-heading">
              <div>
                <span>{copy("Cost pressure", "Maliyet baskısı")}</span>
                <h2>{copy("Largest cash needs", "En büyük nakit ihtiyaçları")}</h2>
              </div>
              <strong>{overviewIsDecisionReady ? formatLira(overviewMonthlyCost) : "-"}</strong>
            </div>
            {renderBreakdownBars(
              overviewCostBreakdownRows,
              overviewMaxCostBreakdownAmount,
              copy("No cost data yet", "Henüz maliyet verisi yok"),
              "cost",
            )}
          </article>
        </div>

        <div className="financial-quick-grid">
          {[
            [
              copy("Produced / Sold", "Üretilen / Satılan"),
              overviewIsDecisionReady
                ? `${formatNumber(summary.totalProduced)} / ${formatNumber(summary.netSoldUnits)}`
                : "-",
              copy("selected horizon units", "seçili ufuk adedi"),
            ],
            [
              copy("Unsold Inventory", "Satılmayan Stok"),
              overviewIsDecisionReady ? `${formatNumber(summary.unsoldInventoryUnits)} ${copy("units", "adet")}` : "-",
              copy("production above sales", "satışı aşan üretim"),
            ],
            [
              copy("Required Cash", "Gerekli Nakit"),
              overviewIsDecisionReady ? formatLira(summary.initialCashRequired) : "-",
              copy("after initial loan and grant", "başlangıç kredi ve hibe sonrası"),
            ],
            [
              copy("Payback", "Geri Dönüş"),
              overviewIsDecisionReady ? formatMonth(summary.paybackMonth) : "-",
              copy("investment recovery month", "yatırımın geri dönüş ayı"),
            ],
          ].map(([label, value, detail]) => (
            <article className="financial-quick-card" key={label}>
              <span className="label-with-info">
                {label}
                <GlossaryTip language={form.language} term={label} />
              </span>
              <strong>{value}</strong>
              <small>{detail}</small>
            </article>
          ))}
        </div>

        {selectedFinancialWidgets.length > 0 && (
          <div className="financial-widget-grid">{selectedFinancialWidgets.map(renderOverviewWidget)}</div>
        )}

        {renderWidgetSelector()}
      </section>
    </DashboardLayout>
  );
}
