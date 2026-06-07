import assert from "node:assert/strict";
import test from "node:test";
import { defaultFinancialSettings, normalizeFinancialModelSettings } from "../src/lib/financialService.js";

test("normalizes a complete financial input set", () => {
  const settings = normalizeFinancialModelSettings({
    ...defaultFinancialSettings,
    electricityPricePerKwh: 3.2,
    initialCash: 500000,
    loanRows: [
      { amount: 100000, annualInterestRate: 24, gracePeriodMonths: 2, loanTermMonths: 12 },
    ],
  });

  assert.equal(settings.electricityPricePerKwh, 3.2);
  assert.equal(settings.loanAmount, 100000);
  assert.equal(settings.annualInterestRate, 24);
  assert.equal(settings.loanRows[0].gracePeriodMonths, 2);
});

test("rejects missing required financial assumptions", () => {
  assert.throws(() => normalizeFinancialModelSettings({
    ...defaultFinancialSettings,
    electricityPricePerKwh: "",
  }), /Missing required financial input: electricityPricePerKwh/);
});
