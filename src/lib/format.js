// Number, money, quantity, duration and date formatting for the UI.

import { convertMoneyToTry, defaultExchangeRates, normalizeCurrencyCode, toFiniteNumber } from "./feasibilityModel";

// A value that rounds to zero would otherwise print as "-0" / "-₺0".
export function withoutNegativeZero(value, maximumFractionDigits) {
  const number = Number(value) || 0;
  return Math.abs(number) < 0.5 * 10 ** -maximumFractionDigits ? 0 : number;
}

export function formatNumber(value, maximumFractionDigits = 0) {
  const locale = document.documentElement.lang === "tr" ? "tr-TR" : "en-US";
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(
    withoutNegativeZero(value, maximumFractionDigits),
  );
}

export const countableUnits = new Set(["", "adet", "ad", "pcs", "pc", "piece", "pieces", "unit", "units"]);

// Pieces are shown as whole numbers ("545 adet", not "545,46 adet");
// measured units such as kg or litre keep two decimals.
export function formatQuantity(value, unit = "") {
  return formatNumber(
    value,
    countableUnits.has(
      String(unit || "")
        .trim()
        .toLowerCase(),
    )
      ? 0
      : 2,
  );
}

export function formatLira(value, maximumFractionDigits = 0) {
  const locale = document.documentElement.lang === "tr" ? "tr-TR" : "en-US";
  return new Intl.NumberFormat(locale, {
    currency: "TRY",
    maximumFractionDigits,
    style: "currency",
  }).format(withoutNegativeZero(value, maximumFractionDigits));
}

export function formatCurrencyAmount(value, currency = "TRY", maximumFractionDigits = 0) {
  const locale = document.documentElement.lang === "tr" ? "tr-TR" : "en-US";
  const currencyCode = normalizeCurrencyCode(currency);

  try {
    return new Intl.NumberFormat(locale, {
      currency: currencyCode,
      maximumFractionDigits,
      style: "currency",
    }).format(withoutNegativeZero(value, maximumFractionDigits));
  } catch {
    return `${formatNumber(value, maximumFractionDigits)} ${currencyCode}`;
  }
}

export function formatOperationMoney(
  value,
  currency = "TRY",
  exchangeRates = defaultExchangeRates,
  maximumFractionDigits = 2,
) {
  const currencyCode = normalizeCurrencyCode(currency);
  const originalValue = Math.max(0, toFiniteNumber(value));
  const originalLabel = formatCurrencyAmount(originalValue, currencyCode, maximumFractionDigits);

  if (currencyCode === "TRY") return originalLabel;

  return `${originalLabel} / ${formatLira(convertMoneyToTry(originalValue, currencyCode, exchangeRates), maximumFractionDigits)}`;
}

export const cycleTimeUnits = {
  day: 1440,
  hour: 60,
  minute: 1,
};

export function normalizeCycleTimeUnit(unit) {
  return Object.prototype.hasOwnProperty.call(cycleTimeUnits, unit) ? unit : "minute";
}

export function getCycleTimeUnitLabel(unit, language = document.documentElement.lang) {
  const normalizedUnit = normalizeCycleTimeUnit(unit);
  const labels = {
    day: language === "tr" ? "gün" : "day",
    hour: language === "tr" ? "saat" : "hour",
    minute: language === "tr" ? "dk" : "min",
  };

  return labels[normalizedUnit];
}

export function getCycleTimeMinutes(value, unit) {
  return Math.max(0.0001, toFiniteNumber(value, 1) * cycleTimeUnits[normalizeCycleTimeUnit(unit)]);
}

export function getCycleTimeInputFromMinutes(minutes, preferredUnit = "minute") {
  const safeMinutes = Math.max(0.0001, toFiniteNumber(minutes, 1));
  const normalizedPreferredUnit = normalizeCycleTimeUnit(preferredUnit);
  const divisor = cycleTimeUnits[normalizedPreferredUnit] || 1;

  return {
    cycleTimeUnit: normalizedPreferredUnit,
    cycleTimeValue: safeMinutes / divisor,
  };
}

export function formatCycleTime(minutes, preferredUnit, maximumFractionDigits = 2) {
  const { cycleTimeUnit, cycleTimeValue } = getCycleTimeInputFromMinutes(minutes, preferredUnit);
  return `${formatNumber(cycleTimeValue, maximumFractionDigits)} ${getCycleTimeUnitLabel(cycleTimeUnit)}`;
}

export function formatMinutesDuration(minutes) {
  const safeMinutes = Math.max(0, toFiniteNumber(minutes));
  if (safeMinutes >= 1440)
    return `${formatNumber(safeMinutes / 1440, 2)} ${document.documentElement.lang === "tr" ? "gün" : "days"}`;
  if (safeMinutes >= 60)
    return `${formatNumber(safeMinutes / 60, 2)} ${document.documentElement.lang === "tr" ? "saat" : "hours"}`;
  return `${formatNumber(safeMinutes, 2)} ${document.documentElement.lang === "tr" ? "dk" : "min"}`;
}

export function formatMonthLabel(date) {
  const locale = document.documentElement.lang === "tr" ? "tr-TR" : "en-US";
  return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }).format(date);
}

export function formatCompactMonthLabel(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${year}`;
}

export function formatTrendAxisAmount(value) {
  const safeValue = toFiniteNumber(value);
  const absoluteValue = Math.abs(safeValue);
  const sign = safeValue < 0 ? "-" : "";
  const isTurkish = document.documentElement.lang === "tr";

  if (absoluteValue >= 1_000_000_000)
    return `${sign}${formatNumber(absoluteValue / 1_000_000_000, 1)} ${isTurkish ? "Mr" : "B"}`;
  if (absoluteValue >= 1_000_000) return `${sign}${formatNumber(absoluteValue / 1_000_000, 1)} Mn`;
  if (absoluteValue >= 1_000) return `${sign}${formatNumber(absoluteValue / 1_000, 1)} ${isTurkish ? "Bin" : "K"}`;

  return `${sign}${formatNumber(absoluteValue)}`;
}
