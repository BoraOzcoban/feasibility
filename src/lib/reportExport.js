import { calculatePlanDailyCost, getPlanDailyOutput, toFiniteNumber } from "./feasibilityModel.js";
import { getCurrentOperationPlans, hasViablePlanResult } from "./operationsCalculations.js";

export const reportPackSections = {
  executive: ["summary", "sensitivity", "income", "cash", "risks"],
  financial: ["summary", "sensitivity", "assumptions", "income", "cash", "balance", "loans", "monthly"],
  full: [
    "summary",
    "sensitivity",
    "assumptions",
    "income",
    "cash",
    "balance",
    "loans",
    "operations",
    "sales",
    "risks",
    "monthly",
  ],
  operations: ["summary", "operations"],
  sales: ["summary", "sales"],
};

const sum = (rows, key) => rows.reduce((total, row) => total + toFiniteNumber(row[key]), 0);
// Values derived by subtraction leave float dust (-0.0000001) that formats as "-₺0".
const dropRoundingNoise = (value) => (Math.abs(value) < 0.005 ? 0 : value);

// Groups monthly projection rows into years: flows are summed, balances are
// taken at year end.
export function summarizeYears(rows = []) {
  const years = [];

  for (let start = 0; start < rows.length; start += 12) {
    const yearRows = rows.slice(start, start + 12);
    const first = yearRows[0] || {};
    const last = yearRows[yearRows.length - 1] || {};
    const salesRevenue = sum(yearRows, "salesRevenue");
    const costOfSales =
      sum(yearRows, "materialCost") + sum(yearRows, "workforceCost") + sum(yearRows, "electricityCost");
    const grossProfit = salesRevenue - costOfSales - sum(yearRows, "depreciation") - sum(yearRows, "writeOffCost");
    const operatingProfit = grossProfit - sum(yearRows, "sellingCost") - sum(yearRows, "overheadCost");
    const netIncome = sum(yearRows, "netIncome");
    const operatingCashFlow = sum(yearRows, "operatingCashFlow");
    const loanPayments = sum(yearRows, "loanPayment");
    const cashFlow = sum(yearRows, "cashFlow");

    years.push({
      cashFlow,
      costOfSales,
      depreciation: sum(yearRows, "depreciation"),
      electricityCost: sum(yearRows, "electricityCost"),
      endingCash: toFiniteNumber(last.cashBalance),
      equity: toFiniteNumber(last.equity),
      fixedAssets: toFiniteNumber(last.fixedAssets),
      grossProfit,
      incomeTax: sum(yearRows, "incomeTax"),
      inventoryUnits: toFiniteNumber(last.inventoryUnits),
      inventoryValue: toFiniteNumber(last.inventoryValue),
      label: `${Math.floor(start / 12) + 1}`,
      loanBalance: toFiniteNumber(last.loanBalance),
      loanInterest: sum(yearRows, "loanInterest"),
      loanPayments,
      loanReceipts: dropRoundingNoise(cashFlow - operatingCashFlow + loanPayments),
      materialCost: sum(yearRows, "materialCost"),
      months: yearRows.length,
      netIncome,
      netMargin: salesRevenue ? (netIncome / salesRevenue) * 100 : 0,
      netSoldUnits: sum(yearRows, "netSoldUnits"),
      operatingCashFlow,
      operatingProfit,
      overheadCost: sum(yearRows, "overheadCost"),
      producedUnits: sum(yearRows, "producedUnits"),
      profitBeforeTax: sum(yearRows, "profitBeforeTax"),
      receivables: toFiniteNumber(last.receivables) + toFiniteNumber(last.vatCredit),
      salesRevenue,
      sellingCost: sum(yearRows, "sellingCost"),
      shortTermLiabilities:
        toFiniteNumber(last.payables) + toFiniteNumber(last.vatDue) + toFiniteNumber(last.taxPayable),
      startingCash: toFiniteNumber(first.cashBalance) - toFiniteNumber(first.cashFlow),
      totalAssets: toFiniteNumber(last.totalAssets),
      totalLiabilitiesAndEquity: toFiniteNumber(last.totalLiabilitiesAndEquity),
      workforceCost: sum(yearRows, "workforceCost"),
      writeOffCost: sum(yearRows, "writeOffCost"),
    });
  }

  return years;
}

// Statement layout shared by the spreadsheet and the printable report.
// `t(en, tr)` picks the label language.
export function getStatementLayout(t) {
  return {
    balance: [
      { key: "endingCash", label: t("Cash", "Nakit") },
      { key: "receivables", label: t("Receivables", "Alacaklar") },
      { key: "inventoryValue", label: t("Inventory", "Stoklar") },
      { key: "fixedAssets", label: t("Fixed assets", "Duran varlıklar") },
      { emphasis: true, key: "totalAssets", label: t("Total assets", "Toplam aktif") },
      { key: "shortTermLiabilities", label: t("Payables and taxes", "Kısa vadeli borçlar") },
      { key: "loanBalance", label: t("Loans", "Krediler") },
      { key: "equity", label: t("Equity", "Özkaynak") },
      { emphasis: true, key: "totalLiabilitiesAndEquity", label: t("Total liabilities and equity", "Toplam pasif") },
    ],
    cash: [
      { key: "startingCash", label: t("Opening cash", "Dönem başı nakit") },
      { key: "operatingCashFlow", label: t("Cash from operations", "Faaliyetlerden nakit") },
      { key: "loanReceipts", label: t("Loans received", "Kredi kullanımı") },
      { key: "loanPayments", label: t("Loan repayments", "Kredi geri ödemeleri"), negative: true },
      { emphasis: true, key: "cashFlow", label: t("Net cash flow", "Net nakit akışı") },
      { emphasis: true, key: "endingCash", label: t("Closing cash", "Dönem sonu nakit") },
    ],
    income: [
      { emphasis: true, key: "salesRevenue", label: t("Net sales", "Net satışlar") },
      { key: "materialCost", label: t("Materials", "Malzemeler"), negative: true },
      { key: "workforceCost", label: t("Labour", "İşçilik"), negative: true },
      { key: "electricityCost", label: t("Energy", "Enerji"), negative: true },
      { key: "depreciation", label: t("Depreciation", "Amortisman"), negative: true },
      { key: "writeOffCost", label: t("Returns write-off", "İade maliyeti"), negative: true },
      { emphasis: true, key: "grossProfit", label: t("Gross profit", "Brüt kâr") },
      { key: "sellingCost", label: t("Selling and marketing", "Satış ve pazarlama"), negative: true },
      { key: "overheadCost", label: t("Overhead and start-up costs", "Genel ve başlangıç giderleri"), negative: true },
      { emphasis: true, key: "operatingProfit", label: t("Operating profit", "Faaliyet kârı") },
      { key: "loanInterest", label: t("Interest", "Kredi faizi"), negative: true },
      { key: "incomeTax", label: t("Income tax", "Gelir vergisi"), negative: true },
      { emphasis: true, key: "netIncome", label: t("Net profit", "Net kâr") },
      { format: "percent", key: "netMargin", label: t("Net margin", "Net kâr marjı") },
    ],
  };
}

export function buildFeasibilityReport({
  companyName = "",
  generatedAt = new Date(),
  model,
  operationsWorkspace = {},
  productName = "",
  risks = [],
  salesStrategy = {},
  sensitivity = [],
  settings = {},
  t = (en) => en,
  verdict = {},
}) {
  const summary = model?.summary || {};
  const rows = model?.trendRows || [];
  const plans = getCurrentOperationPlans(operationsWorkspace).filter((plan) => hasViablePlanResult(plan.result));
  const productNames = new Map((operationsWorkspace.products || []).map((product) => [product.id, product.name]));

  return {
    assumptions: [
      [t("Projection horizon (months)", "Projeksiyon ufku (ay)"), rows.length],
      [t("Working days per month", "Aylık çalışma günü"), toFiniteNumber(settings.workingDaysPerMonth)],
      [t("Starting cash", "Başlangıç nakdi"), toFiniteNumber(settings.initialCash)],
      [t("Investment grant", "Yatırım hibesi"), toFiniteNumber(settings.investmentGrantAmount)],
      [t("Electricity price per kWh", "Elektrik fiyatı (kWh)"), toFiniteNumber(settings.electricityPricePerKwh)],
      [t("Sales VAT %", "Satış KDV %"), toFiniteNumber(settings.salesVatRate)],
      [t("Expense VAT %", "Gider KDV %"), toFiniteNumber(settings.expenseVatRate)],
      [t("Income tax %", "Gelir vergisi %"), toFiniteNumber(settings.incomeTaxRate)],
      [t("Customer collection days", "Müşteri tahsilat günü"), toFiniteNumber(settings.receivablesCollectionDays)],
      [t("Supplier payment days", "Tedarikçi ödeme günü"), toFiniteNumber(settings.supplierPaymentDays)],
      [
        t("Raw material buffer (months)", "Hammadde tampon stoku (ay)"),
        toFiniteNumber(settings.rawMaterialBufferMonths),
      ],
      [t("COGS inflation % / year", "SMM enflasyonu % / yıl"), toFiniteNumber(settings.cogsInflationAnnualPercent)],
      [
        t("Overhead inflation % / year", "Genel gider enflasyonu % / yıl"),
        toFiniteNumber(settings.opexInflationAnnualPercent),
      ],
      [t("Price increase % / year", "Fiyat artışı % / yıl"), toFiniteNumber(settings.priceIncreaseAnnualPercent)],
      [t("Discount rate % / year", "İskonto oranı % / yıl"), toFiniteNumber(summary.discountRateAnnualPercent)],
      [
        t("Depreciation (years, straight-line)", "Amortisman (yıl, doğrusal)"),
        toFiniteNumber(summary.assetUsefulLifeYears),
      ],
    ],
    channels: (salesStrategy.channels || []).map((channel) => ({
      collectionDays: toFiniteNumber(channel.collectionDays),
      commissionPercent: toFiniteNumber(channel.commissionPercent),
      customerAcquisitionCost: toFiniteNumber(channel.customerAcquisitionCost),
      firstMonthUnits: toFiniteNumber(channel.monthlySalesUnits),
      name: channel.name,
      product: productNames.get(channel.productId) || channel.productName || "",
      startMonth: toFiniteNumber(channel.startMonth, 1),
      unitPrice: toFiniteNumber(channel.unitSalesPrice),
    })),
    companyName,
    generatedAt,
    kpis: [
      [t("Total net sales", "Toplam net satış"), toFiniteNumber(summary.salesRevenue), "money"],
      [t("Total net profit", "Toplam net kâr"), toFiniteNumber(summary.netIncome), "money"],
      [t("Unit production cost", "Birim üretim maliyeti"), toFiniteNumber(summary.unitProductionCost), "money2"],
      [t("Initial investment", "Başlangıç yatırımı"), toFiniteNumber(summary.initialInvestment), "money"],
      [t("Own cash required", "Gerekli öz nakit"), toFiniteNumber(summary.initialCashRequired), "money"],
      [
        t("Peak working capital", "En yüksek işletme sermayesi"),
        toFiniteNumber(summary.workingCapitalRequirement),
        "money",
      ],
      [t("Break-even month", "Başa baş ayı"), summary.breakEvenMonth ?? null, "month"],
      [t("Payback month", "Geri dönüş ayı"), summary.paybackMonth ?? null, "month"],
      [t("Net present value", "Net bugünkü değer"), toFiniteNumber(summary.netPresentValue), "money"],
      [
        t("Internal rate of return % / year", "İç verim oranı % / yıl"),
        summary.internalRateOfReturn ?? null,
        "percent",
      ],
      [
        t("Discount rate % / year", "İskonto oranı % / yıl"),
        toFiniteNumber(summary.discountRateAnnualPercent),
        "percent",
      ],
      [t("Lowest cash balance", "En düşük nakit"), toFiniteNumber(summary.lowestCashBalance), "money"],
      [
        t("Capacity use %", "Kapasite kullanımı %"),
        summary.capacityUtilization === null || summary.capacityUtilization === undefined
          ? null
          : summary.capacityUtilization * 100,
        "percent",
      ],
      [t("Closing cash", "Dönem sonu nakit"), toFiniteNumber(summary.endingCash), "money"],
    ],
    loans: (summary.loanRows || []).map((loan) => ({
      amount: toFiniteNumber(loan.originalAmount, loan.amount),
      annualInterestRate: toFiniteNumber(loan.annualInterestRate),
      currency: loan.originalCurrency || loan.currency || "TRY",
      gracePeriodMonths: toFiniteNumber(loan.gracePeriodMonths),
      loanTermMonths: toFiniteNumber(loan.loanTermMonths),
      name: loan.name,
      receivedDate: loan.receivedDate,
    })),
    monthly: rows,
    plans: plans.map((plan) => {
      const cost = calculatePlanDailyCost(plan.result, operationsWorkspace, settings);
      const capacity = getPlanDailyOutput(plan.result, operationsWorkspace);
      return {
        dailyCost: cost.daily.total,
        dailyOutput: capacity.output,
        name: plan.plan_name || plan.result?.planName || "",
        product: productNames.get(plan.product_id) || plan.result?.productName || "",
        target: capacity.target,
        unitEnergy: cost.unit.energy,
        unitLabor: cost.unit.labor,
        unitMaterial: cost.unit.material,
      };
    }),
    productName,
    risks,
    sensitivity,
    verdict,
    years: summarizeYears(rows),
  };
}

const formats = {
  money: "#,##0",
  money2: "#,##0.00",
  percent: "0.0",
  units: "#,##0",
};

function headerCell(value) {
  return { fontWeight: "bold", value };
}

function numberCell(value, format = formats.money) {
  if (value === null || value === undefined || value === "") return null;
  return { format, type: Number, value: Number(value) };
}

function statementSheet(name, layout, years, t) {
  return {
    columns: [{ width: 34 }, ...years.map(() => ({ width: 16 }))],
    data: [
      [headerCell(t("TRY", "TL")), ...years.map((year) => headerCell(t(`Year ${year.label}`, `Yıl ${year.label}`)))],
      ...layout.map((row) => [
        row.emphasis ? headerCell(row.label) : row.label,
        ...years.map((year) => numberCell(year[row.key], row.format === "percent" ? formats.percent : formats.money)),
      ]),
    ],
    sheet: name,
    stickyColumnsCount: 1,
  };
}

// Sheets for write-excel-file. Pure so it can be unit tested.
export function buildReportSheets(report, pack, t = (en) => en) {
  const sections = reportPackSections[pack] || reportPackSections.full;
  const layout = getStatementLayout(t);
  const sheets = [];

  if (sections.includes("summary")) {
    sheets.push({
      columns: [{ width: 36 }, { width: 22 }],
      data: [
        [headerCell(t("Feasibility report", "Fizibilite raporu")), report.companyName || ""],
        [t("Product", "Ürün"), report.productName || ""],
        [
          t("Generated", "Oluşturulma"),
          report.generatedAt instanceof Date
            ? report.generatedAt.toISOString().slice(0, 10)
            : String(report.generatedAt || ""),
        ],
        [t("Decision", "Karar"), report.verdict?.label || ""],
        [t("Decision note", "Karar notu"), report.verdict?.copy || ""],
        [null, null],
        ...report.kpis.map(([label, value, format]) => [
          label,
          format === "month"
            ? value
              ? numberCell(value, formats.units)
              : t("Not reached", "Ulaşılmadı")
            : format === "percent"
              ? value === null
                ? "-"
                : numberCell(value, formats.percent)
              : numberCell(value, format === "money2" ? formats.money2 : formats.money),
        ]),
      ],
      sheet: t("Summary", "Özet"),
    });
  }

  if (sections.includes("sensitivity") && report.sensitivity?.length) {
    const decisionLabels = {
      feasible: t("Feasible", "Uygun"),
      risky: t("Risky", "Riskli"),
      wait: t("Wait", "Beklenmeli"),
    };
    sheets.push({
      columns: [
        { width: 26 },
        { width: 18 },
        { width: 16 },
        { width: 18 },
        { width: 14 },
        { width: 18 },
        { width: 14 },
      ],
      data: [
        [
          t("Case", "Senaryo"),
          t("Net present value", "Net bugünkü değer"),
          t("Change", "Fark"),
          t("5-year net profit", "5 yıllık net kâr"),
          t("Payback (months)", "Geri dönüş (ay)"),
          t("Lowest cash", "En düşük nakit"),
          t("Decision", "Karar"),
        ].map(headerCell),
        ...report.sensitivity.map((row) => [
          row.label || row.lever,
          numberCell(row.netPresentValue),
          row.lever === "base" ? "-" : numberCell(row.netPresentValueChange),
          numberCell(row.netIncome),
          row.paybackMonth ? numberCell(row.paybackMonth, formats.units) : t("Over 5 years", "5 yıldan uzun"),
          numberCell(row.lowestCashBalance),
          decisionLabels[row.decision] || row.decision,
        ]),
      ],
      sheet: t("Sensitivity", "Duyarlılık"),
    });
  }

  if (sections.includes("assumptions")) {
    sheets.push({
      columns: [{ width: 40 }, { width: 16 }],
      data: [
        [headerCell(t("Assumption", "Varsayım")), headerCell(t("Value", "Değer"))],
        ...report.assumptions.map(([label, value]) => [label, numberCell(value, formats.money2)]),
      ],
      sheet: t("Assumptions", "Varsayımlar"),
    });
  }

  if (sections.includes("income"))
    sheets.push(statementSheet(t("Income statement", "Gelir tablosu"), layout.income, report.years, t));
  if (sections.includes("cash"))
    sheets.push(statementSheet(t("Cash flow", "Nakit akışı"), layout.cash, report.years, t));
  if (sections.includes("balance"))
    sheets.push(statementSheet(t("Balance sheet", "Bilanço"), layout.balance, report.years, t));

  if (sections.includes("loans") && report.loans.length) {
    sheets.push({
      columns: [
        { width: 30 },
        { width: 14 },
        { width: 10 },
        { width: 14 },
        { width: 12 },
        { width: 14 },
        { width: 14 },
      ],
      data: [
        [
          t("Loan", "Kredi"),
          t("Amount", "Tutar"),
          t("Currency", "Döviz"),
          t("Interest % / year", "Faiz % / yıl"),
          t("Term (months)", "Vade (ay)"),
          t("Grace (months)", "Ödemesiz (ay)"),
          t("Received", "Kullanım"),
        ].map(headerCell),
        ...report.loans.map((loan) => [
          loan.name,
          numberCell(loan.amount),
          loan.currency,
          numberCell(loan.annualInterestRate, formats.money2),
          numberCell(loan.loanTermMonths, formats.units),
          numberCell(loan.gracePeriodMonths, formats.units),
          loan.receivedDate || "",
        ]),
      ],
      sheet: t("Loans", "Krediler"),
    });
  }

  if (sections.includes("operations")) {
    sheets.push({
      columns: [
        { width: 30 },
        { width: 28 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 16 },
      ],
      data: [
        [
          t("Plan", "Plan"),
          t("Product", "Ürün"),
          t("Target / day", "Hedef / gün"),
          t("Output / day", "Çıktı / gün"),
          t("Material / unit", "Malzeme / birim"),
          t("Labour / unit", "İşçilik / birim"),
          t("Energy / unit", "Enerji / birim"),
          t("Daily cost", "Günlük maliyet"),
        ].map(headerCell),
        ...report.plans.map((plan) => [
          plan.name,
          plan.product,
          numberCell(plan.target, formats.units),
          numberCell(plan.dailyOutput, formats.units),
          numberCell(plan.unitMaterial, formats.money2),
          numberCell(plan.unitLabor, formats.money2),
          numberCell(plan.unitEnergy, formats.money2),
          numberCell(plan.dailyCost),
        ]),
      ],
      sheet: t("Production", "Üretim"),
    });
  }

  if (sections.includes("sales")) {
    sheets.push({
      columns: [
        { width: 28 },
        { width: 28 },
        { width: 12 },
        { width: 16 },
        { width: 12 },
        { width: 14 },
        { width: 12 },
        { width: 14 },
      ],
      data: [
        [
          t("Channel", "Kanal"),
          t("Product", "Ürün"),
          t("Start month", "Başlangıç ayı"),
          t("First month units", "İlk ay adet"),
          t("Unit price", "Birim fiyat"),
          t("Commission %", "Komisyon %"),
          t("Unit CAC", "Birim CAC"),
          t("Collection days", "Tahsilat günü"),
        ].map(headerCell),
        ...report.channels.map((channel) => [
          channel.name,
          channel.product,
          numberCell(channel.startMonth, formats.units),
          numberCell(channel.firstMonthUnits, formats.units),
          numberCell(channel.unitPrice, formats.money2),
          numberCell(channel.commissionPercent, formats.money2),
          numberCell(channel.customerAcquisitionCost, formats.money2),
          numberCell(channel.collectionDays, formats.units),
        ]),
      ],
      sheet: t("Sales channels", "Satış kanalları"),
    });
  }

  if (sections.includes("risks") && report.risks.length) {
    sheets.push({
      columns: [{ width: 34 }, { width: 80 }],
      data: [
        [t("Risk", "Risk"), t("Detail", "Detay")].map(headerCell),
        ...report.risks.map((risk) => [risk.title, risk.detail]),
      ],
      sheet: t("Risks", "Riskler"),
    });
  }

  if (sections.includes("monthly")) {
    const columns = [
      ["period", t("Month", "Ay"), formats.units],
      ["producedUnits", t("Produced", "Üretilen"), formats.units],
      ["netSoldUnits", t("Sold", "Satılan"), formats.units],
      ["inventoryUnits", t("Units in stock", "Stoktaki adet"), formats.units],
      ["salesRevenue", t("Net sales", "Net satış"), formats.money],
      ["netIncome", t("Net profit", "Net kâr"), formats.money],
      ["operatingCashFlow", t("Cash from operations", "Faaliyet nakdi"), formats.money],
      ["cashFlow", t("Net cash flow", "Net nakit akışı"), formats.money],
      ["cashBalance", t("Closing cash", "Dönem sonu nakit"), formats.money],
      ["vatPayable", t("VAT payable", "Ödenecek KDV"), formats.money],
    ];
    sheets.push({
      columns: columns.map(() => ({ width: 16 })),
      data: [
        columns.map(([, label]) => headerCell(label)),
        ...report.monthly.map((row) => columns.map(([key, , format]) => numberCell(row[key], format))),
      ],
      sheet: t("Monthly", "Aylık"),
      stickyRowsCount: 1,
    });
  }

  return sheets;
}
