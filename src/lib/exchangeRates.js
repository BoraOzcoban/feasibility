// TCMB exchange rates: fetch, store, and convert workspace prices to TRY.

import { convertMoneyToTry, defaultExchangeRates, normalizeCurrencyCode, toFiniteNumber } from "./feasibilityModel";
import { supabase } from "./supabaseClient";

export function getTcmBRatesFromXml(xmlText) {
  const documentXml = new DOMParser().parseFromString(xmlText, "application/xml");
  const parserError = documentXml.querySelector("parsererror");
  if (parserError) {
    throw new Error("TCMB rate XML could not be parsed.");
  }

  const getRate = (currency) => {
    const row = documentXml.querySelector(`Currency[CurrencyCode="${currency}"]`);
    const value = Number(
      row?.querySelector("ForexSelling")?.textContent || row?.querySelector("ForexBuying")?.textContent,
    );
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`TCMB ${currency}/TRY rate was not available.`);
    }
    return value;
  };

  return {
    ...defaultExchangeRates,
    EUR: getRate("EUR"),
    source: "TCMB",
    status: "ready",
    TRY: 1,
    USD: getRate("USD"),
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchTcmBExchangeRates(signal) {
  const isLocalDev = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

  // tcmb.gov.tr sends no CORS headers, so outside local development (where
  // the Vite proxy serves /tcmb-rates) the tcmb-rates Edge Function fetches it.
  if (!isLocalDev && supabase) {
    const { data, error } = await supabase.functions.invoke("tcmb-rates", { method: "GET", signal });
    if (error) throw new Error(`TCMB: ${error.message}`);
    return getTcmBRatesFromXml(typeof data === "string" ? data : await new Response(data).text());
  }

  const response = await fetch(`/tcmb-rates/kurlar/today.xml?_=${Date.now()}`, {
    headers: { Accept: "application/xml,text/xml,*/*" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`TCMB ${response.status}`);
  }

  return getTcmBRatesFromXml(await response.text());
}

export async function fetchExchangeRates(signal) {
  return fetchTcmBExchangeRates(signal);
}

export function isMissingExchangeRatesTableError(error) {
  if (!error) return false;
  const message = String(error.message || "").toLowerCase();
  return error.code === "42P01" || (message.includes("financial_exchange_rates") && message.includes("does not exist"));
}

export function mapExchangeRateRowsToState(rows = []) {
  const latestByCurrency = new Map();

  rows.forEach((row) => {
    const currency = normalizeCurrencyCode(row.currency);
    if (!["USD", "EUR"].includes(currency) || latestByCurrency.has(currency)) return;
    latestByCurrency.set(currency, row);
  });

  const usd = Number(latestByCurrency.get("USD")?.rate_to_try);
  const eur = Number(latestByCurrency.get("EUR")?.rate_to_try);
  const latestRow = rows[0];

  if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(eur) || eur <= 0) {
    return null;
  }

  return {
    ...defaultExchangeRates,
    EUR: eur,
    source: latestRow?.source || "TCMB",
    sourceDetail: "",
    status: "ready",
    TRY: 1,
    USD: usd,
    updatedAt: latestRow?.fetched_at || latestRow?.created_at || null,
  };
}

export async function loadLatestExchangeRatesFromSupabase(supabaseClient, companyId) {
  const { data, error } = await supabaseClient
    .from("financial_exchange_rates")
    .select("currency, rate_to_try, source, fetched_at, created_at")
    .eq("company_id", companyId)
    .in("currency", ["USD", "EUR"])
    .order("fetched_at", { ascending: false })
    .limit(20);

  if (error) {
    if (isMissingExchangeRatesTableError(error)) return null;
    throw error;
  }

  return mapExchangeRateRowsToState(data || []);
}

export async function saveExchangeRatesToSupabase(supabaseClient, companyId, rates) {
  const fetchedAt = rates.updatedAt || new Date().toISOString();
  const rows = ["USD", "EUR"].map((currency) => ({
    company_id: companyId,
    currency,
    fetched_at: fetchedAt,
    rate_to_try: rates[currency],
    source: rates.source || "TCMB",
  }));
  const { error } = await supabaseClient.from("financial_exchange_rates").insert(rows);

  if (error) throw error;
}

export function withTryOperationWorkspace(workspace = {}, exchangeRates = defaultExchangeRates) {
  const convertPriceRow = (row, valueKey = "price", currencyKey = "price_currency") => {
    if (!row) return row;

    const currency = normalizeCurrencyCode(row[currencyKey]);
    const originalValue = Math.max(0, toFiniteNumber(row[valueKey]));

    return {
      ...row,
      [`${currencyKey}_original`]: currency,
      [`${valueKey}_original`]: originalValue,
      [valueKey]: convertMoneyToTry(originalValue, currency, exchangeRates),
      [currencyKey]: "TRY",
    };
  };
  const convertProduct = (product) => {
    if (!product) return product;
    const convertedProduct = convertPriceRow(product);

    return {
      ...convertedProduct,
      material_rows: Array.isArray(product.material_rows)
        ? product.material_rows.map((row) => ({
            ...row,
            material: convertPriceRow(row.material, "price_per_unit", "price_currency"),
          }))
        : product.material_rows,
    };
  };

  return {
    ...workspace,
    activePlans: (workspace.activePlans || [])
      .filter((plan) => plan && typeof plan === "object")
      .map((plan) => ({
        ...plan,
        product: convertProduct(plan.product),
      })),
    equipment: (workspace.equipment || []).map((row) => convertPriceRow(row)),
    latestPlan: workspace.latestPlan
      ? { ...workspace.latestPlan, product: convertProduct(workspace.latestPlan.product) }
      : workspace.latestPlan,
    machines: (workspace.machines || []).map((row) => convertPriceRow(row)),
    materials: (workspace.materials || []).map((row) => convertPriceRow(row, "price_per_unit", "price_currency")),
    product: convertProduct(workspace.product),
    products: (workspace.products || []).map(convertProduct),
    workforce: (workspace.workforce || []).map((row) => convertPriceRow(row, "hourly_cost", "hourly_cost_currency")),
  };
}
