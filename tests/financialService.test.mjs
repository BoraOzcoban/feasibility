import assert from "node:assert/strict";
import test from "node:test";
import { defaultFinancialSettings, normalizeFinancialModelSettings } from "../src/lib/financialService.js";

test("normalizes a complete financial input set", () => {
  const settings = normalizeFinancialModelSettings({
    ...defaultFinancialSettings,
    electricityPricePerKwh: 3.2,
    initialCash: 500000,
    loanRows: [
      { amount: 100000, annualInterestRate: 24, currency: "usd", gracePeriodMonths: 2, loanTermMonths: 12, name: "Equipment loan", receivedDate: "2026-06-10" },
    ],
  });

  assert.equal(settings.electricityPricePerKwh, 3.2);
  assert.equal(settings.loanAmount, 100000);
  assert.equal(settings.annualInterestRate, 24);
  assert.equal(settings.loanRows[0].currency, "USD");
  assert.equal(settings.loanRows[0].gracePeriodMonths, 2);
  assert.equal(settings.loanRows[0].name, "Equipment loan");
  assert.equal(settings.loanRows[0].receivedDate, "2026-06-10");
});

test("rejects missing required financial assumptions", () => {
  assert.throws(() => normalizeFinancialModelSettings({
    ...defaultFinancialSettings,
    electricityPricePerKwh: "",
  }), /Missing required financial input: electricityPricePerKwh/);
});

test("normalizes unsupported loan currencies to TRY", () => {
  const settings = normalizeFinancialModelSettings({
    ...defaultFinancialSettings,
    electricityPricePerKwh: 3.2,
    initialCash: 500000,
    loanRows: [
      { amount: 100000, annualInterestRate: 24, currency: "gbp", gracePeriodMonths: 0, loanTermMonths: 12, receivedDate: "2026-06-10" },
    ],
  });

  assert.equal(settings.loanRows[0].currency, "TRY");
});

test("normalizes the startup feasibility financial assumptions", () => {
  const settings = normalizeFinancialModelSettings({
    ...defaultFinancialSettings,
    assetValueIncreaseAnnualPercent: 20,
    cogsInflationAnnualPercent: 35,
    electricityPricePerKwh: 4.75,
    expenseVatRate: 20,
    incomeTaxRate: 25,
    increaseFrequency: "quarterly",
    initialCash: 2500000,
    initialCapacityUnits: 12000,
    investmentGrantAmount: 500000,
    loanRows: [
      { amount: 1500000, annualInterestRate: 38, currency: "TRY", gracePeriodMonths: 3, loanTermMonths: 36, name: "Startup 36 Ay İşletme ve Kapasite Kredisi", receivedDate: "2026-06-28" },
    ],
    monthlyCurrencyIncreasePercent: 1.5,
    monthlyEnergyPriceIncreasePercent: 2,
    monthlyInflationPercent: 2.5,
    monthlyWageIncreasePercent: 2,
    opexInflationAnnualPercent: 30,
    priceIncreaseAnnualPercent: 30,
    rawMaterialBufferMonths: 1,
    rawMaterialStockDays: 15,
    receivablesCollectionDays: 35,
    rentBufferMonths: 1,
    salaryBufferMonths: 1,
    salesVatRate: 10,
    supplierPaymentDays: 45,
    taxPaymentDelayMonths: 3,
    workingDaysPerMonth: 22,
  });

  assert.equal(settings.loanAmount, 1500000);
  assert.equal(settings.annualInterestRate, 38);
  assert.equal(settings.loanTermMonths, 36);
  assert.equal(settings.increaseFrequency, "quarterly");
  assert.equal(settings.salesVatRate, 10);
  assert.equal(settings.expenseVatRate, 20);
  assert.equal(settings.vatRate, 10);
});
