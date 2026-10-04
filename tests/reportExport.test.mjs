import assert from "node:assert/strict";
import test from "node:test";
import writeExcelFile from "write-excel-file/node";
import { buildFinancialFeasibilityModel } from "../src/lib/feasibilityModel.js";
import { defaultFinancialSettings, emptyFinancialModel } from "../src/lib/financialService.js";
import { buildFeasibilityReport, buildReportSheets, reportPackSections, summarizeYears } from "../src/lib/reportExport.js";

const workspace = {
  equipment: [],
  machines: [{ availability_hours: 8, id: "mixer", name: "Mixer", price: 120000, price_currency: "TRY" }],
  materials: [{ id: "water", name: "Water", price_per_unit: 4, unit: "lt" }],
  products: [{ id: "drink", name: "Drink", price: 40 }],
  workforce: [{ hourly_cost: 150, id: "operator", role_name: "Operator" }],
};
const plan = {
  id: "plan",
  plan_name: "Daily plan",
  product_id: "drink",
  result: {
    machineRows: [{ dailyHours: 6, energyConsumptionKwh: 30, machineId: "mixer" }],
    materialRows: [{ dailyQuantity: 100, materialId: "water" }],
    producedQuantity: 100,
    totalProductionTimeMinutes: 360,
    workforceRows: [{ hoursUsed: 8, workforceId: "operator" }],
  },
};
const settings = { ...defaultFinancialSettings, electricityPricePerKwh: 3, initialCash: 300000, workingDaysPerMonth: 20 };
const salesStrategy = {
  campaigns: [],
  channels: [{ collectionDays: 30, commissionPercent: 5, id: "direct", monthlySalesUnits: 1800, name: "Direct", productId: "drink", startMonth: 1, unitSalesPrice: 40 }],
  company: { monthlyMultipliers: Array.from({ length: 12 }, () => 1) },
};
const model = buildFinancialFeasibilityModel(emptyFinancialModel, salesStrategy, settings, { ...workspace, activePlans: [plan] }, "5y");
const report = buildFeasibilityReport({
  companyName: "Test Co",
  generatedAt: new Date("2026-10-04T00:00:00Z"),
  model,
  operationsWorkspace: { ...workspace, activePlans: [plan] },
  productName: "Drink",
  risks: [{ detail: "Demand above capacity", title: "Capacity gap" }],
  salesStrategy,
  settings,
  verdict: { copy: "Check cash", label: "Proceed with care" },
});

test("yearly summary adds up the monthly rows and keeps year-end balances", () => {
  const years = summarizeYears(model.trendRows);

  assert.equal(years.length, 5);
  const monthlyNet = model.trendRows.reduce((total, row) => total + row.netIncome, 0);
  const yearlyNet = years.reduce((total, year) => total + year.netIncome, 0);
  assert.ok(Math.abs(monthlyNet - yearlyNet) < 1e-6);
  assert.equal(years[4].endingCash, model.trendRows[59].cashBalance);
  years.forEach((year) => assert.ok(Math.abs(year.totalAssets - year.totalLiabilitiesAndEquity) < 1e-4));
  years.forEach((year) => assert.ok(Math.abs(year.operatingProfit - year.loanInterest - year.incomeTax - year.netIncome) < 1e-4));
});

test("each report pack produces its own sheets", () => {
  const names = (pack) => buildReportSheets(report, pack).map((sheet) => sheet.sheet);

  assert.deepEqual(names("executive"), ["Summary", "Income statement", "Cash flow", "Risks"]);
  assert.deepEqual(names("operations"), ["Summary", "Production"]);
  // No loans in this scenario, so the full pack has no loan sheet.
  assert.deepEqual(names("full"), ["Summary", "Assumptions", "Income statement", "Cash flow", "Balance sheet", "Production", "Sales channels", "Risks", "Monthly"]);
  assert.equal(reportPackSections.full.includes("loans"), true);
});

test("the workbook can be written as a real xlsx file", async () => {
  const buffer = await writeExcelFile(buildReportSheets(report, "full")).toBuffer();

  // An .xlsx file is a zip archive.
  assert.equal(buffer.subarray(0, 2).toString(), "PK");
  assert.ok(buffer.length > 2000);
});
