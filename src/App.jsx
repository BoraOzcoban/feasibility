import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import {
  createDemoFinancialLoanRows,
  defaultFinancialSettings,
  emptyFinancialExtraCostForm,
  emptyFinancialModel,
  financialLoanCurrencyOptions,
  generalFinancialAssumptionFields,
  inflationRevaluationFinancialFields,
  loadFinancialModel,
  optionalMacroFinancialSettingFields,
  requiredFinancialSettingFields,
  saveFinancialExtraCost,
  saveFinancialModelSettings,
} from "./lib/financialService";
import { calculateCurrentPlanResult, getCurrentOperationPlans, hasViablePlanResult } from "./lib/operationsCalculations";
import { emptyOperationForms, emptyOperationPlan, emptyPlanRows, loadOperationsWorkspace, saveOperationRecord, saveOperationResourcePlan } from "./lib/operationsService";
import { deleteSimulationVariantRecord, emptySalesStrategy, emptySimulationVariant, loadSalesStrategy, loadSimulationVariants, saveSalesStrategy, saveSimulationVariant } from "./lib/planningService";
import logoUrl from "./assets/atera-logo.svg";

const emptyForm = {
  username: "",
  password: "",
  email: "",
  phoneNumber: "",
  company: "",
  department: "",
  accessLevel: "user",
  language: "en",
};

const emptyRoleForm = {
  name: "",
  description: "",
};

const emptyManagedUserForm = {
  username: "",
  email: "",
  password: "",
  phoneNumber: "",
  department: "",
  accessLevel: "user",
  language: "tr",
};

const simulationAlgorithms = {
  withTendency: "fbm_with_tendency",
  withoutTendency: "fbm_without_tendency",
};

function normalizeSimulationAlgorithm(value) {
  return value === simulationAlgorithms.withoutTendency
    ? simulationAlgorithms.withoutTendency
    : simulationAlgorithms.withTendency;
}

function isAdminRole(roleOrName) {
  const name = typeof roleOrName === "string" ? roleOrName : roleOrName?.name;
  return String(name || "").trim().toLowerCase() === "admin";
}

function formatNumber(value, maximumFractionDigits = 0) {
  const locale = document.documentElement.lang === "tr" ? "tr-TR" : "en-US";
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value || 0);
}

function formatLira(value, maximumFractionDigits = 0) {
  const locale = document.documentElement.lang === "tr" ? "tr-TR" : "en-US";
  return new Intl.NumberFormat(locale, {
    currency: "TRY",
    maximumFractionDigits,
    style: "currency",
  }).format(value || 0);
}

function useMatchedPanelHeight(dependencyKey) {
  const sourceRef = useRef(null);
  const [height, setHeight] = useState(null);

  useLayoutEffect(() => {
    const element = sourceRef.current;

    if (!element) {
      setHeight(null);
      return undefined;
    }

    let frameId = 0;

    const measure = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        const nextHeight = Math.ceil(element.getBoundingClientRect().height);
        setHeight((currentHeight) => (Math.abs((currentHeight || 0) - nextHeight) > 1 ? nextHeight : currentHeight));
      });
    };

    measure();

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resizeObserver?.observe(element);
    window.addEventListener("resize", measure);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [dependencyKey]);

  return [
    sourceRef,
    height ? { "--matched-record-card-height": `${height}px` } : undefined,
  ];
}

function InfoTip({ label = "Info", text }) {
  if (!text) return null;

  return (
    <span className="info-tip">
      <button type="button" aria-label={label}>i</button>
      <span className="info-tip-panel" role="tooltip">{text}</span>
    </span>
  );
}

const glossaryEntries = [
  {
    en: ["Dashboard", "Overview"],
    tr: ["Dashboard", "Genel Bakış"],
    infoEn: "The main workspace where readiness, risks, and module status are summarized.",
    infoTr: "Hazırlık, risk ve modül durumlarının özetlendiği ana çalışma alanı.",
  },
  {
    en: ["Product", "Product record", "Product definition", "Product to produce", "Product Name", "Product Code", "Product Group"],
    tr: ["Ürün", "Ürün kaydı", "Ürün tanımı", "Üretilecek ürün", "Ürün Adı", "Ürün Kodu", "Ürün Grubu"],
    infoEn: "The sellable item whose recipe, price, process, and demand drive feasibility.",
    infoTr: "Reçete, fiyat, süreç ve talep bilgileriyle fizibiliteyi belirleyen satılabilir kalem.",
  },
  {
    en: ["Recipe", "No recipe", "Recipe qty", "Materials & Components"],
    tr: ["Reçete", "Reçete yok", "Reçete miktarı", "Malzeme & Bileşenler"],
    infoEn: "The materials and quantities needed to make one unit of the product.",
    infoTr: "Ürünün bir birimini üretmek için gereken malzeme ve miktarlar.",
  },
  {
    en: ["Material", "Material Cost", "Material cost"],
    tr: ["Malzeme", "Malzeme Maliyeti", "Malzeme maliyeti"],
    infoEn: "An input consumed during production and included in unit or total cost.",
    infoTr: "Üretimde tüketilen ve birim ya da toplam maliyete giren girdi.",
  },
  {
    en: ["Machine", "Machine Pool", "Machine hours", "Machine Hours", "Machine Value", "Selected Machine Value"],
    tr: ["Makine", "Makine Havuzu", "Makine saati", "Makine Saati", "Makine Değeri", "Seçili Makine Değeri"],
    infoEn: "Production equipment used to calculate capacity, time, energy, and asset value.",
    infoTr: "Kapasite, süre, enerji ve varlık değerini hesaplamakta kullanılan üretim ekipmanı.",
  },
  {
    en: ["Equipment"],
    tr: ["Ekipman"],
    infoEn: "Supporting production asset or tool used by a process step.",
    infoTr: "Bir süreç adımında kullanılan destekleyici üretim varlığı veya araç.",
  },
  {
    en: ["Workforce", "Crew role", "People", "Crew hours", "Workforce Hours", "Workforce Cost"],
    tr: ["İşgücü", "Ekip rolü", "Kişi", "Ekip saati", "İşgücü Saati", "İşgücü Maliyeti"],
    infoEn: "Human labor capacity and cost assigned to production activities.",
    infoTr: "Üretim faaliyetlerine atanan insan emeği kapasitesi ve maliyeti.",
  },
  {
    en: ["Process", "Process name", "Process Definition", "Required processes", "Operation", "Operation Flow"],
    tr: ["Süreç", "Süreç adı", "Süreç Tanımlama", "Gerekli süreçler", "Operasyon", "Operasyon Akışı"],
    infoEn: "A production step or workflow used to turn inputs into finished output.",
    infoTr: "Girdileri bitmiş çıktıya dönüştüren üretim adımı veya iş akışı.",
  },
  {
    en: ["Capacity", "Production capacity", "Capacity gap", "Monthly capacity"],
    tr: ["Kapasite", "Üretim kapasitesi", "Kapasite açığı", "Aylık kapasite"],
    infoEn: "The amount that can be produced with available time, machines, and labor.",
    infoTr: "Mevcut zaman, makine ve işgücüyle üretilebilecek miktar.",
  },
  {
    en: ["Cycle", "Cycle Time", "Effective Cycle"],
    tr: ["Çevrim", "Çevrim Süresi", "Efektif çevrim"],
    infoEn: "Elapsed production time per unit or per completed flow after constraints are included.",
    infoTr: "Kısıtlar dahil edildiğinde birim veya tamamlanan akış başına geçen üretim süresi.",
  },
  {
    en: ["Bottleneck"],
    tr: ["Darboğaz"],
    infoEn: "The limiting operation that constrains output and is usually the first improvement target.",
    infoTr: "Çıktıyı sınırlayan ve genellikle ilk iyileştirme hedefi olan operasyon.",
  },
  {
    en: ["WIP", "Max WIP"],
    tr: ["WIP", "Maks WIP"],
    infoEn: "Work in progress: unfinished units waiting or moving between operations.",
    infoTr: "Yarı mamul: operasyonlar arasında bekleyen veya ilerleyen tamamlanmamış ürünler.",
  },
  {
    en: ["Setup", "Setup min"],
    tr: ["Setup", "Setup dk"],
    infoEn: "Preparation time before production can run at normal speed.",
    infoTr: "Üretimin normal hızda başlamasından önceki hazırlık süresi.",
  },
  {
    en: ["Speed"],
    tr: ["Hız"],
    infoEn: "The rate or multiplier that affects how quickly a process step is completed.",
    infoTr: "Bir süreç adımının ne kadar hızlı tamamlandığını etkileyen oran veya çarpan.",
  },
  {
    en: ["Batch", "Transfer Batch", "Best batch size"],
    tr: ["Toplu", "Transfer batch", "En iyi batch"],
    infoEn: "A group of units processed or transferred together during production.",
    infoTr: "Üretimde birlikte işlenen veya aktarılan ürün grubu.",
  },
  {
    en: ["Flow", "Flow / Pull", "Default flow"],
    tr: ["Akış", "Akış / Pull", "Varsayılan akış"],
    infoEn: "The production movement logic between steps, often used to reduce waiting and WIP.",
    infoTr: "Adımlar arasındaki üretim hareket mantığı; bekleme ve WIP azaltmak için kullanılır.",
  },
  {
    en: ["Cost", "Daily Cost", "Monthly cost", "Estimated Cost", "Tracked Daily Cost", "Unit production cost"],
    tr: ["Maliyet", "Günlük Maliyet", "Aylık maliyet", "Tahmini Maliyet", "Takip Edilen Günlük Maliyet", "Birim üretim maliyeti"],
    infoEn: "Money spent to produce, operate, finance, or deliver the planned activity.",
    infoTr: "Planlanan faaliyeti üretmek, işletmek, finanse etmek veya teslim etmek için harcanan para.",
  },
  {
    en: ["Revenue", "Monthly revenue", "Estimated Revenue", "Income"],
    tr: ["Ciro", "Aylık ciro", "Tahmini Ciro", "Gelir"],
    infoEn: "Sales income generated from product demand and selling price.",
    infoTr: "Ürün talebi ve satış fiyatından oluşan satış geliri.",
  },
  {
    en: ["Margin", "Net margin", "Unit margin", "Profit Margin", "Net Profit Margin"],
    tr: ["Marj", "Net marj", "Birim marj", "Kâr Marjı", "Net Kâr Marjı"],
    infoEn: "The share of revenue left after related costs are deducted.",
    infoTr: "İlgili maliyetler düşüldükten sonra cirodan kalan pay.",
  },
  {
    en: ["Break-even"],
    tr: ["Başa baş"],
    infoEn: "The point where accumulated income covers accumulated costs.",
    infoTr: "Birikmiş gelirin birikmiş maliyeti karşıladığı nokta.",
  },
  {
    en: ["Working capital"],
    tr: ["İşletme sermayesi"],
    infoEn: "Cash needed to carry operations before customer collections arrive.",
    infoTr: "Müşteri tahsilatları gelmeden operasyonu taşımak için gereken nakit.",
  },
  {
    en: ["Cash runway"],
    tr: ["Nakit dayanma", "Kısa nakit dayanma"],
    infoEn: "How long available cash can support the plan before it runs out.",
    infoTr: "Mevcut nakdin planı tükenmeden ne kadar süre taşıyabileceği.",
  },
  {
    en: ["Loan", "Loans", "Loan amount", "Total loan", "Loan records"],
    tr: ["Kredi", "Krediler", "Kredi tutarı", "Toplam kredi", "Kredi kayıtları"],
    infoEn: "Borrowed financing that affects cash inflow, repayment, interest, and runway.",
    infoTr: "Nakit girişi, geri ödeme, faiz ve nakit dayanmayı etkileyen borç finansmanı.",
  },
  {
    en: ["Term", "Loan term months", "Longest term", "Repayment term"],
    tr: ["Vade", "Kredi vadesi ay", "En uzun vade", "Ödeme vadesi"],
    infoEn: "The time period over which a loan or payment schedule runs.",
    infoTr: "Kredi veya ödeme planının geçerli olduğu süre.",
  },
  {
    en: ["Grace period", "Grace period months", "Longest grace"],
    tr: ["Ödemesiz", "Ödemesiz ay", "En uzun ödemesiz"],
    infoEn: "Months before cash repayment starts for a loan.",
    infoTr: "Bir kredide nakit geri ödemenin başlamasından önceki aylar.",
  },
  {
    en: ["Annual interest", "Annual interest %", "Estimated interest"],
    tr: ["Yıllık faiz", "Yıllık faiz %", "Tahmini faiz"],
    infoEn: "Financing cost charged yearly on borrowed money.",
    infoTr: "Borç alınan para üzerinden yıllık hesaplanan finansman maliyeti.",
  },
  {
    en: ["Currency", "FX", "Exchange rate"],
    tr: ["Döviz", "Kur", "Döviz kuru"],
    infoEn: "The money unit and conversion rate used for foreign-currency values.",
    infoTr: "Yabancı para değerlerini çevirmek için kullanılan para birimi ve dönüşüm oranı.",
  },
  {
    en: ["Demand", "Market demand", "Average monthly demand", "Unmet sales"],
    tr: ["Talep", "Pazar talebi", "Ortalama aylık talep", "Karşılanmayan satış"],
    infoEn: "Expected customer need used to calculate sales, capacity coverage, and stock risk.",
    infoTr: "Satış, kapasite karşılama ve stok riskini hesaplamakta kullanılan beklenen müşteri ihtiyacı.",
  },
  {
    en: ["Sales forecast", "Forecast", "Channel sales plan"],
    tr: ["Satış tahmini", "Tahmin", "Kanal satış planı"],
    infoEn: "Expected future sales by product, channel, timing, and volume.",
    infoTr: "Ürün, kanal, zamanlama ve hacme göre beklenen gelecek satışlar.",
  },
  {
    en: ["Inventory", "Inventory risk", "Unsold inventory", "Inventory Cost"],
    tr: ["Stok", "Stok riski", "Satılmayan stok", "Stok maliyeti"],
    infoEn: "Units held before sale and the risk or cost of carrying them.",
    infoTr: "Satış öncesi elde tutulan ürünler ve bunları taşımanın riski veya maliyeti.",
  },
  {
    en: ["Scenario", "Scenario test", "Simulation", "Variant"],
    tr: ["Senaryo", "Senaryo testi", "Simülasyon", "Varyant"],
    infoEn: "A test version of assumptions used to compare possible outcomes.",
    infoTr: "Olası sonuçları karşılaştırmak için kullanılan varsayım testi.",
  },
  {
    en: ["Risk", "Risk board", "Blocker", "High", "Medium", "Controlled"],
    tr: ["Risk", "Risk panosu", "Engel", "Yüksek", "Orta", "Kontrollü"],
    infoEn: "A condition that can reduce feasibility or require action before committing.",
    infoTr: "Fizibiliteyi düşürebilecek veya karar öncesi aksiyon gerektiren durum.",
  },
  {
    en: ["Report", "Report pack", "Report Downloads", "Export"],
    tr: ["Rapor", "Rapor paketi", "Rapor İndirme", "Export"],
    infoEn: "A packaged view of the current plan and evidence for review or sharing.",
    infoTr: "Mevcut planı ve dayanaklarını incelemek veya paylaşmak için paketlenmiş görünüm.",
  },
  {
    en: ["Permission", "Permissions", "Read", "Write", "Role", "User"],
    tr: ["İzin", "İzinler", "Okuma", "Yazma", "Yetki", "Kullanıcı"],
    infoEn: "Access control settings that determine who can view or change modules.",
    infoTr: "Modülleri kimin görüntüleyip değiştirebileceğini belirleyen erişim ayarları.",
  },
  {
    en: ["Status", "Ready", "Needed", "Needs input"],
    tr: ["Durum", "Hazır", "Gerekli", "Girdi gerekli"],
    infoEn: "A readiness signal showing whether the item can be used in the workflow.",
    infoTr: "Öğenin iş akışında kullanılabilir olup olmadığını gösteren hazırlık işareti.",
  },
  {
    en: ["Required", "Optional"],
    tr: ["Zorunlu", "Opsiyonel"],
    infoEn: "Shows whether the field must be filled before saving or calculation.",
    infoTr: "Alanının kayıt veya hesaplama öncesi doldurulmasının gerekip gerekmediğini gösterir.",
  },
];

function normalizeGlossaryText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "")
    .replace(/[:：]+$/g, "")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

function getDirectTextContent(element) {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildGlossaryLookup(language) {
  return glossaryEntries.flatMap((entry) => {
    const terms = language === "tr" ? entry.tr : entry.en;
    const text = language === "tr" ? entry.infoTr : entry.infoEn;

    return terms.map((term) => ({
      key: normalizeGlossaryText(term),
      label: term,
      text,
      wordCount: normalizeGlossaryText(term).split(" ").filter(Boolean).length,
    }));
  }).sort((left, right) => right.key.length - left.key.length);
}

const obviousGlossaryLabels = new Set([
  "dashboard",
  "overview",
  "product",
  "ürün",
  "recipe",
  "reçete",
  "material",
  "malzeme",
  "machine",
  "makine",
  "equipment",
  "ekipman",
  "workforce",
  "işgücü",
  "process",
  "süreç",
  "capacity",
  "kapasite",
  "cycle",
  "çevrim",
  "speed",
  "hız",
  "flow",
  "akış",
  "cost",
  "maliyet",
  "revenue",
  "ciro",
  "income",
  "gelir",
  "loan",
  "kredi",
  "currency",
  "döviz",
  "kur",
  "demand",
  "talep",
  "inventory",
  "stok",
  "scenario",
  "senaryo",
  "simulation",
  "simülasyon",
  "variant",
  "varyant",
  "risk",
  "report",
  "rapor",
  "permission",
  "izin",
  "role",
  "yetki",
  "user",
  "kullanıcı",
  "status",
  "durum",
  "ready",
  "hazır",
  "needed",
  "gerekli",
  "required",
  "zorunlu",
  "optional",
  "opsiyonel",
]);

function findGlossaryEntry(label, lookup) {
  const normalized = normalizeGlossaryText(label);
  if (!normalized || /^\d+([.,]\d+)?$/.test(normalized)) return null;
  if (obviousGlossaryLabels.has(normalized)) return null;

  return lookup.find((entry) => (
    normalized === entry.key
    || (entry.wordCount > 1 && (
      normalized.startsWith(`${entry.key} `)
      || normalized.endsWith(` ${entry.key}`)
      || normalized.includes(` ${entry.key} `)
    ))
  ));
}

function createGlossaryInfoTip(entry, language) {
  const wrapper = document.createElement("span");
  wrapper.className = "info-tip global-term-infobar";
  wrapper.dataset.globalTermInfobar = "true";

  const trigger = document.createElement("span");
  trigger.className = "info-tip-icon";
  trigger.setAttribute("aria-label", `${entry.label} ${language === "tr" ? "bilgi" : "info"}`);
  trigger.setAttribute("role", "button");
  trigger.setAttribute("tabindex", "0");
  trigger.textContent = "i";

  const panel = document.createElement("span");
  panel.className = "info-tip-panel";
  panel.setAttribute("role", "tooltip");
  panel.textContent = entry.text;

  wrapper.append(trigger, panel);
  return wrapper;
}

function applyGlobalTermInfobars(root, language) {
  if (!root) return;

  const lookup = buildGlossaryLookup(language);
  const selector = [
    "h1",
    "h2",
    "h3",
    "h4",
    "dt",
    "th",
    "mark",
    "label > span",
    "summary span",
    "article > span",
    ".operations-tabs button",
    ".mini-tabs button",
    ".reports-tabs button",
    ".financial-loan-summary-card > span",
    ".financial-loan-card-metrics > span",
    ".dashboard-detail-list span",
    ".dashboard-kpi-card span",
    ".process-product-selected span",
    ".machine-row span:first-child",
  ].join(",");

  root.querySelectorAll(selector).forEach((element) => {
    if (
      element.dataset.termInfobarApplied
      || element.closest(".info-tip")
      || element.closest(".dashboard-sidebar")
      || element.closest(".landing-nav")
      || element.closest(".dashboard-nav")
      || element.closest(".dashboard-subnav")
      || element.closest(".operations-header")
      || element.closest(".reports-header")
      || element.closest(".financial-loan-hero")
      || element.closest(".financial-header")
      || element.closest(".simulation-header")
      || element.closest(".sales-header")
      || element.querySelector(":scope > .global-term-infobar")
      || element.matches("input, select, textarea, option")
    ) {
      return;
    }

    const label = getDirectTextContent(element);
    const entry = findGlossaryEntry(label, lookup);
    if (!entry) return;

    element.dataset.termInfobarApplied = "true";
    element.classList.add("term-with-infobar");
    element.appendChild(createGlossaryInfoTip(entry, language));
  });
}

function normalizeCurrencyCode(value) {
  const currency = String(value || "TRY").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "TRY";
}

function formatCurrencyAmount(value, currency = "TRY", maximumFractionDigits = 0) {
  const locale = document.documentElement.lang === "tr" ? "tr-TR" : "en-US";
  const currencyCode = normalizeCurrencyCode(currency);

  try {
    return new Intl.NumberFormat(locale, {
      currency: currencyCode,
      maximumFractionDigits,
      style: "currency",
    }).format(value || 0);
  } catch {
    return `${formatNumber(value, maximumFractionDigits)} ${currencyCode}`;
  }
}

const operationCurrencyOptions = ["TRY", "USD", "EUR"];

const defaultExchangeRates = {
  error: "",
  EUR: 0,
  source: "TCMB",
  sourceDetail: "",
  status: "idle",
  TRY: 1,
  USD: 0,
  updatedAt: null,
};

function getCurrencyRateToTry(exchangeRates, currency = "TRY") {
  const currencyCode = normalizeCurrencyCode(currency);
  if (currencyCode === "TRY") return 1;
  if (!["USD", "EUR"].includes(currencyCode)) return 0;

  const rate = Number(exchangeRates?.[currencyCode]);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

function convertMoneyToTry(value, currency = "TRY", exchangeRates = defaultExchangeRates) {
  return Math.max(0, toFiniteNumber(value)) * getCurrencyRateToTry(exchangeRates, currency);
}

function hasUsableExchangeRates(exchangeRates) {
  return ["USD", "EUR"].every((currency) => getCurrencyRateToTry(exchangeRates, currency) > 0);
}

function formatOperationMoney(value, currency = "TRY", exchangeRates = defaultExchangeRates, maximumFractionDigits = 2) {
  const currencyCode = normalizeCurrencyCode(currency);
  const originalValue = Math.max(0, toFiniteNumber(value));
  const originalLabel = formatCurrencyAmount(originalValue, currencyCode, maximumFractionDigits);

  if (currencyCode === "TRY") return originalLabel;

  return `${originalLabel} / ${formatLira(convertMoneyToTry(originalValue, currencyCode, exchangeRates), maximumFractionDigits)}`;
}

function getTcmBRatesFromXml(xmlText) {
  const documentXml = new DOMParser().parseFromString(xmlText, "application/xml");
  const parserError = documentXml.querySelector("parsererror");
  if (parserError) {
    throw new Error("TCMB rate XML could not be parsed.");
  }

  const getRate = (currency) => {
    const row = documentXml.querySelector(`Currency[CurrencyCode="${currency}"]`);
    const value = Number(row?.querySelector("ForexSelling")?.textContent || row?.querySelector("ForexBuying")?.textContent);
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

async function fetchTcmBExchangeRates(signal) {
  const isLocalDev = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  const url = isLocalDev
    ? `/tcmb-rates/kurlar/today.xml?_=${Date.now()}`
    : `https://www.tcmb.gov.tr/kurlar/today.xml?_=${Date.now()}`;
  const response = await fetch(url, {
    headers: { Accept: "application/xml,text/xml,*/*" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`TCMB ${response.status}`);
  }

  return getTcmBRatesFromXml(await response.text());
}

async function fetchExchangeRates(signal) {
  return fetchTcmBExchangeRates(signal);
}

function isMissingExchangeRatesTableError(error) {
  if (!error) return false;
  const message = String(error.message || "").toLowerCase();
  return error.code === "42P01" || (message.includes("financial_exchange_rates") && message.includes("does not exist"));
}

function mapExchangeRateRowsToState(rows = []) {
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
    sourceDetail: "Supabase latest",
    status: "ready",
    TRY: 1,
    USD: usd,
    updatedAt: latestRow?.fetched_at || latestRow?.created_at || null,
  };
}

async function loadLatestExchangeRatesFromSupabase(supabaseClient, companyId) {
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

async function saveExchangeRatesToSupabase(supabaseClient, companyId, rates) {
  const fetchedAt = rates.updatedAt || new Date().toISOString();
  const rows = ["USD", "EUR"].map((currency) => ({
    company_id: companyId,
    currency,
    fetched_at: fetchedAt,
    rate_to_try: rates[currency],
    source: rates.source || "TCMB",
  }));
  const { error } = await supabaseClient
    .from("financial_exchange_rates")
    .insert(rows);

  if (error) throw error;
}

function withTryOperationWorkspace(workspace = {}, exchangeRates = defaultExchangeRates) {
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
    latestPlan: workspace.latestPlan ? { ...workspace.latestPlan, product: convertProduct(workspace.latestPlan.product) } : workspace.latestPlan,
    machines: (workspace.machines || []).map((row) => convertPriceRow(row)),
    materials: (workspace.materials || []).map((row) => convertPriceRow(row, "price_per_unit", "price_currency")),
    product: convertProduct(workspace.product),
    products: (workspace.products || []).map(convertProduct),
    workforce: (workspace.workforce || []).map((row) => convertPriceRow(row, "hourly_cost", "hourly_cost_currency")),
  };
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toOptionalFiniteNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asObjectArray(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function getOptionalPositiveNumber(value) {
  const number = toOptionalFiniteNumber(value);
  return number === null || number <= 0 ? null : number;
}

const cycleTimeUnits = {
  day: 1440,
  hour: 60,
  minute: 1,
};

function normalizeCycleTimeUnit(unit) {
  return Object.prototype.hasOwnProperty.call(cycleTimeUnits, unit) ? unit : "minute";
}

function getCycleTimeUnitLabel(unit, language = document.documentElement.lang) {
  const normalizedUnit = normalizeCycleTimeUnit(unit);
  const labels = {
    day: language === "tr" ? "gün" : "day",
    hour: language === "tr" ? "saat" : "hour",
    minute: language === "tr" ? "dk" : "min",
  };

  return labels[normalizedUnit];
}

function getCycleTimeMinutes(value, unit) {
  return Math.max(0.0001, toFiniteNumber(value, 1) * cycleTimeUnits[normalizeCycleTimeUnit(unit)]);
}

function getCycleTimeInputFromMinutes(minutes, preferredUnit = "minute") {
  const safeMinutes = Math.max(0.0001, toFiniteNumber(minutes, 1));
  const normalizedPreferredUnit = normalizeCycleTimeUnit(preferredUnit);
  const divisor = cycleTimeUnits[normalizedPreferredUnit] || 1;

  return {
    cycleTimeUnit: normalizedPreferredUnit,
    cycleTimeValue: safeMinutes / divisor,
  };
}

function formatCycleTime(minutes, preferredUnit, maximumFractionDigits = 2) {
  const { cycleTimeUnit, cycleTimeValue } = getCycleTimeInputFromMinutes(minutes, preferredUnit);
  return `${formatNumber(cycleTimeValue, maximumFractionDigits)} ${getCycleTimeUnitLabel(cycleTimeUnit)}`;
}

function formatMinutesDuration(minutes) {
  const safeMinutes = Math.max(0, toFiniteNumber(minutes));
  if (safeMinutes >= 1440) return `${formatNumber(safeMinutes / 1440, 2)} ${document.documentElement.lang === "tr" ? "gün" : "days"}`;
  if (safeMinutes >= 60) return `${formatNumber(safeMinutes / 60, 2)} ${document.documentElement.lang === "tr" ? "saat" : "hours"}`;
  return `${formatNumber(safeMinutes, 2)} ${document.documentElement.lang === "tr" ? "dk" : "min"}`;
}

function getProjectionMonthCount(horizon) {
  if (horizon === "5y") return 60;
  if (horizon === "1y") return 12;
  return 6;
}

function getTodayDateInputValue() {
  return formatDateInputValue(new Date());
}

function parseDateInput(value) {
  if (!value) return null;

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateInputValue(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getDateInputValue(value, fallback = getTodayDateInputValue()) {
  const date = parseDateInput(value) || parseDateInput(fallback) || new Date();
  return formatDateInputValue(date);
}

function getMonthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthDifference(startDate, endDate) {
  return ((endDate.getFullYear() - startDate.getFullYear()) * 12) + (endDate.getMonth() - startDate.getMonth());
}

function formatMonthLabel(date) {
  const locale = document.documentElement.lang === "tr" ? "tr-TR" : "en-US";
  return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }).format(date);
}

function formatCompactMonthLabel(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${year}`;
}

function formatTrendAxisAmount(value) {
  const safeValue = toFiniteNumber(value);
  const absoluteValue = Math.abs(safeValue);
  const sign = safeValue < 0 ? "-" : "";
  const isTurkish = document.documentElement.lang === "tr";

  if (absoluteValue >= 1_000_000_000) return `${sign}${formatNumber(absoluteValue / 1_000_000_000, 1)} ${isTurkish ? "Mr" : "B"}`;
  if (absoluteValue >= 1_000_000) return `${sign}${formatNumber(absoluteValue / 1_000_000, 1)} Mn`;
  if (absoluteValue >= 1_000) return `${sign}${formatNumber(absoluteValue / 1_000, 1)} ${isTurkish ? "Bin" : "K"}`;

  return `${sign}${formatNumber(absoluteValue)}`;
}

function getNiceTrendTickStep(maxValue, targetSegments = 6) {
  const rawStep = Math.max(1, toFiniteNumber(maxValue) / targetSegments);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceMultiplier = [1, 2, 5, 10].find((candidate) => normalized <= candidate) || 10;

  return niceMultiplier * magnitude;
}

function getTrendAxisScale(maxValue) {
  const tickStep = getNiceTrendTickStep(maxValue);
  const axisMax = Math.max(tickStep, Math.ceil(Math.max(1, toFiniteNumber(maxValue)) / tickStep) * tickStep);
  const tickValues = [];

  for (let value = 0; value <= axisMax + (tickStep / 2); value += tickStep) {
    tickValues.push(Math.min(value, axisMax));
  }

  return { axisMax, tickStep, tickValues: Array.from(new Set(tickValues)) };
}

function getFinancialTrendRowDate(row, index) {
  const parsedPeriodDate = parseDateInput(row?.period);
  if (parsedPeriodDate) return parsedPeriodDate;

  const periodNumber = Math.max(1, Math.round(toFiniteNumber(row?.period, index + 1)));
  return addMonths(getMonthStart(new Date()), periodNumber - 1);
}

function buildIncomeExpenseTrendChart(rows = []) {
  const plot = {
    bottom: 210,
    left: 82,
    right: 438,
    top: 38,
  };
  const sanitizedRows = rows.map((row, index) => ({
    cost: Math.max(0, toFiniteNumber(row.totalCost)),
    date: getFinancialTrendRowDate(row, index),
    revenue: Math.max(0, toFiniteNumber(row.salesRevenue)),
  }));
  const maxValue = Math.max(
    1,
    ...sanitizedRows.flatMap((row) => [row.revenue, row.cost]),
  );
  const axisScale = getTrendAxisScale(maxValue);
  const yTicks = axisScale.tickValues.map((value) => {
    const ratio = value / axisScale.axisMax;
    const y = plot.bottom - (ratio * (plot.bottom - plot.top));

    return {
      label: formatTrendAxisAmount(value),
      value,
      y,
    };
  });
  const getX = (index) => (
    sanitizedRows.length <= 1
      ? plot.left
      : plot.left + (index * ((plot.right - plot.left) / (sanitizedRows.length - 1)))
  );
  const getY = (value) => plot.bottom - ((Math.max(0, value) / axisScale.axisMax) * (plot.bottom - plot.top));
  const getPoints = (field) => sanitizedRows.map((row, index) => ({
    value: row[field],
    x: getX(index),
    y: getY(row[field]),
  }));
  const buildPath = (points) => {
    if (!points.length) return "";
    if (points.length === 1) return `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

    return points.reduce((path, point, index) => {
      if (index === 0) return `M${point.x.toFixed(2)} ${point.y.toFixed(2)}`;

      const previous = points[index - 1];
      const beforePrevious = points[index - 2] || previous;
      const next = points[index + 1] || point;
      const controlOneX = previous.x + ((point.x - beforePrevious.x) / 6);
      const controlTwoX = point.x - ((next.x - previous.x) / 6);

      return `${path} C${controlOneX.toFixed(2)} ${previous.y.toFixed(2)}, ${controlTwoX.toFixed(2)} ${point.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }, "");
  };
  const revenuePoints = getPoints("revenue");
  const costPoints = getPoints("cost");
  const revenuePath = buildPath(revenuePoints);
  const costPath = buildPath(costPoints);
  const buildAreaPath = (path, points) => {
    if (!path || !points.length) return "";

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    return `${path} L${lastPoint.x.toFixed(2)} ${plot.bottom} L${firstPoint.x.toFixed(2)} ${plot.bottom} Z`;
  };
  const xTickIndexes = [];

  if (sanitizedRows.length) {
    const maxTicks = Math.min(6, sanitizedRows.length);
    const step = maxTicks <= 1 ? 1 : Math.max(1, Math.ceil((sanitizedRows.length - 1) / (maxTicks - 1)));

    for (let index = 0; index < sanitizedRows.length; index += step) {
      xTickIndexes.push(index);
    }

    if (xTickIndexes[xTickIndexes.length - 1] !== sanitizedRows.length - 1) {
      xTickIndexes.push(sanitizedRows.length - 1);
    }
  }

  return {
    axisPath: `M${plot.left} ${plot.top} V${plot.bottom} H${plot.right}`,
    axisMax: axisScale.axisMax,
    costAreaPath: buildAreaPath(costPath, costPoints),
    costPath,
    costPoints,
    gridPath: yTicks.map((tick) => `M${plot.left} ${tick.y.toFixed(2)} H${plot.right}`).join(" "),
    plot,
    revenueAreaPath: buildAreaPath(revenuePath, revenuePoints),
    revenuePath,
    revenuePoints,
    xTicks: xTickIndexes.map((index) => ({
      label: formatMonthLabel(sanitizedRows[index].date),
      x: getX(index),
    })),
    yTicks,
  };
}

function getMonthlyLoanPayment(amount, annualInterestRate, termMonths) {
  const principal = Math.max(0, toFiniteNumber(amount));
  const term = Math.max(1, Math.round(toFiniteNumber(termMonths, 1)));
  const monthlyRate = Math.max(0, toFiniteNumber(annualInterestRate)) / 100 / 12;

  if (!principal) return 0;
  if (!monthlyRate) return principal / term;

  return principal * (monthlyRate * ((1 + monthlyRate) ** term)) / (((1 + monthlyRate) ** term) - 1);
}

function getMonthlyRateFromAnnualPercent(annualPercent) {
  const annualRate = Math.max(0, toFiniteNumber(annualPercent)) / 100;
  return ((1 + annualRate) ** (1 / 12)) - 1;
}

function getIncreaseFrequencyMonths(frequency) {
  if (frequency === "monthly") return 1;
  if (frequency === "quarterly") return 3;
  if (frequency === "annual") return 12;
  return 6;
}

function getPeriodicAnnualIncreaseMultiplier(annualPercent, monthIndex, frequency) {
  const annualRate = Math.max(0, toFiniteNumber(annualPercent)) / 100;
  if (!annualRate) return 1;

  const periodMonths = getIncreaseFrequencyMonths(frequency);
  const periodRate = ((1 + annualRate) ** (periodMonths / 12)) - 1;
  const elapsedPeriods = Math.floor(monthIndex / periodMonths);

  return (1 + periodRate) ** elapsedPeriods;
}

function getFinancialLoanRows(settings = {}) {
  const sourceRows = Array.isArray(settings.loanRows) ? settings.loanRows : [];
  const rows = sourceRows.length
    ? sourceRows
    : (toFiniteNumber(settings.loanAmount) > 0
        ? [{
            amount: settings.loanAmount,
            annualInterestRate: settings.annualInterestRate,
            gracePeriodMonths: settings.gracePeriodMonths,
            id: "legacy-loan",
            loanTermMonths: settings.loanTermMonths,
          }]
        : []);

  return rows
    .map((row, index) => {
      const amount = Math.max(0, toFiniteNumber(row.amount));
      const annualInterestRate = Math.max(0, toFiniteNumber(row.annualInterestRate));
      const currency = normalizeCurrencyCode(row.currency);
      const loanTermMonths = Math.max(1, Math.round(toFiniteNumber(row.loanTermMonths, 24)));
      const gracePeriodMonths = Math.min(
        loanTermMonths - 1,
        Math.max(0, Math.round(toFiniteNumber(row.gracePeriodMonths))),
      );
      const name = String(row.name || `${document.documentElement.lang === "tr" ? "Kredi" : "Loan"} ${index + 1}`).trim();
      const receivedDate = getDateInputValue(row.receivedDate || row.received_date);
      const receivedMonth = getMonthStart(parseDateInput(receivedDate) || new Date());
      const paymentStartMonth = addMonths(receivedMonth, gracePeriodMonths);
      const paymentEndMonth = addMonths(receivedMonth, loanTermMonths - 1);
      const monthlyRate = annualInterestRate / 100 / 12;
      const principalAfterGrace = monthlyRate ? amount * ((1 + monthlyRate) ** gracePeriodMonths) : amount;
      const repaymentTermMonths = Math.max(1, loanTermMonths - gracePeriodMonths);

      return {
        amount,
        annualInterestRate,
        currency,
        gracePeriodMonths,
        id: row.id || `loan-${index + 1}`,
        loanTermMonths,
        monthlyPayment: getMonthlyLoanPayment(principalAfterGrace, annualInterestRate, repaymentTermMonths),
        name,
        paymentEndDate: formatDateInputValue(paymentEndMonth),
        paymentStartDate: formatDateInputValue(paymentStartMonth),
        principalAfterGrace,
        receivedDate,
        repaymentTermMonths,
      };
    })
    .filter((row) => row.amount > 0);
}

const loanCalendarTones = ["yellow", "red", "teal", "blue", "green", "clay"];

function buildFinancialLoanPaymentCalendar(loans = []) {
  const currentMonth = getMonthStart(new Date());
  const latestLoanEndMonth = loans.reduce((latestMonth, loan) => {
    const paymentEndMonth = getMonthStart(parseDateInput(loan.paymentEndDate) || currentMonth);
    return paymentEndMonth > latestMonth ? paymentEndMonth : latestMonth;
  }, currentMonth);
  const monthCount = Math.max(12, getMonthDifference(currentMonth, latestLoanEndMonth) + 1);
  const months = Array.from({ length: monthCount }, (_, index) => {
    const date = addMonths(currentMonth, index);

    return {
      date,
      key: getMonthKey(date),
      label: formatCompactMonthLabel(date),
      totals: new Map(),
    };
  });
  const rows = loans.map((loan, loanIndex) => {
    const paymentStartMonth = getMonthStart(parseDateInput(loan.paymentStartDate) || currentMonth);
    const paymentEndMonth = getMonthStart(parseDateInput(loan.paymentEndDate) || currentMonth);
    const tone = loanCalendarTones[loanIndex % loanCalendarTones.length];
    const payments = months.map((month) => {
      const isActive = month.date >= paymentStartMonth && month.date <= paymentEndMonth;

      if (isActive) {
        const currentTotal = month.totals.get(loan.currency) || 0;
        month.totals.set(loan.currency, currentTotal + loan.monthlyPayment);
      }

      return {
        amount: isActive ? loan.monthlyPayment : 0,
        isActive,
        monthKey: month.key,
      };
    });

    return {
      loan,
      payments,
      tone,
    };
  });

  return {
    months: months.map((month) => ({
      ...month,
      totals: Array.from(month.totals.entries()).map(([currency, amount]) => ({ amount, currency })),
    })),
    rows,
  };
}

function getSalesExpectationMultipliers(salesStrategy) {
  const company = salesStrategy.company || {};
  const source = Array.isArray(company.monthlyMultipliers)
    ? company.monthlyMultipliers
    : (Array.isArray(company.monthlyForecast) ? company.monthlyForecast : []);

  if (getSalesMultiplierPeriod(salesStrategy) === "quarterly") {
    const quarterlyMultipliers = getQuarterlySalesExpectationMultipliers(source);

    return Array.from({ length: 12 }, (_, index) => quarterlyMultipliers[Math.floor(index / 3)] ?? 1);
  }

  return Array.from({ length: 12 }, (_, index) => Math.max(0, toFiniteNumber(source[index], 1)));
}

function getSalesMultiplierPeriod(salesStrategy) {
  return salesStrategy.company?.multiplierPeriod === "quarterly" ? "quarterly" : "monthly";
}

function getQuarterlySalesExpectationMultipliers(source) {
  const rows = Array.isArray(source) ? source : [];

  if (rows.length === 4) {
    return Array.from({ length: 4 }, (_, index) => Math.max(0, toFiniteNumber(rows[index], 1)));
  }

  return Array.from({ length: 4 }, (_, quarterIndex) => {
    const quarterValues = Array.from({ length: 3 }, (_, offset) => Math.max(0, toFiniteNumber(rows[(quarterIndex * 3) + offset], 1)));
    return quarterValues.reduce((total, value) => total + value, 0) / quarterValues.length;
  });
}

function getSalesExpectationInputMultipliers(salesStrategy) {
  const company = salesStrategy.company || {};
  const source = Array.isArray(company.monthlyMultipliers)
    ? company.monthlyMultipliers
    : (Array.isArray(company.monthlyForecast) ? company.monthlyForecast : []);

  return getSalesMultiplierPeriod(salesStrategy) === "quarterly"
    ? getQuarterlySalesExpectationMultipliers(source)
    : getSalesExpectationMultipliers(salesStrategy);
}

function getSalesExpectationMultiplier(salesStrategy, monthIndex) {
  const multipliers = getSalesExpectationMultipliers(salesStrategy);
  return multipliers[monthIndex % multipliers.length] ?? 1;
}

function getChannelGrowthRate(channel, elapsedMonthIndex) {
  if (elapsedMonthIndex < 6) return Math.max(0, toFiniteNumber(channel.growthMonths1To6Percent)) / 100;
  if (elapsedMonthIndex < 18) return Math.max(0, toFiniteNumber(channel.growthMonths7To18Percent)) / 100;
  if (elapsedMonthIndex < 24) return Math.max(0, toFiniteNumber(channel.growthMonths19To24Percent)) / 100;
  return Math.max(0, toFiniteNumber(channel.growthYears3To5Percent)) / 100;
}

function getChannelGrowthMultiplier(channel, elapsedMonthIndex) {
  let multiplier = 1;

  for (let index = 1; index <= elapsedMonthIndex; index += 1) {
    multiplier *= 1 + getChannelGrowthRate(channel, index - 1);
  }

  return multiplier;
}

function getChannelSeasonalityMultiplier(channel, monthIndex) {
  const curve = Array.isArray(channel.seasonalityCurve) ? channel.seasonalityCurve : [];
  const value = getOptionalPositiveNumber(curve[monthIndex % 12]);
  return value ?? 1;
}

function getProjectedChannelSalesUnits(channel, monthIndex, salesStrategy) {
  const startMonth = Math.max(1, Math.round(toFiniteNumber(channel.startMonth, 1)));
  const monthNumber = monthIndex + 1;

  if (monthNumber < startMonth) return 0;

  const elapsedMonthIndex = monthNumber - startMonth;
  const expectationMultiplier = getSalesExpectationMultiplier(salesStrategy, monthIndex);
  const trafficScore = getOptionalPositiveNumber(channel.trafficScore) ?? 1;
  const rampUpMonths = getOptionalPositiveNumber(channel.rampUpMonths);
  const failureRate = Math.min(1, Math.max(0, toFiniteNumber(channel.failureProbabilityPercent)) / 100);
  const capacityLimit = getOptionalPositiveNumber(channel.capacityLimit);
  const moqMonthly = getOptionalPositiveNumber(channel.moqMonthly);
  let units = Math.max(0, toFiniteNumber(channel.monthlySalesUnits)) *
    getChannelGrowthMultiplier(channel, elapsedMonthIndex) *
    expectationMultiplier *
    getChannelSeasonalityMultiplier(channel, monthIndex) *
    trafficScore *
    (1 - failureRate);

  if (rampUpMonths) {
    units *= Math.min(1, (elapsedMonthIndex + 1) / rampUpMonths);
  }

  if (capacityLimit) {
    units = Math.min(units, capacityLimit);
  }

  if (moqMonthly && units > 0) {
    units = Math.max(units, moqMonthly);
  }

  return Math.max(0, units);
}

function getBaseMonthlySalesUnits(salesStrategy) {
  const channels = Array.isArray(salesStrategy.channels) ? salesStrategy.channels : [];
  return channels.reduce((total, channel) => total + Math.max(0, toFiniteNumber(channel.monthlySalesUnits)), 0);
}

function getSalesForecastForMonth(salesStrategy, monthIndex) {
  const channels = Array.isArray(salesStrategy.channels) ? salesStrategy.channels : [];
  return channels.reduce((total, channel) => total + getProjectedChannelSalesUnits(channel, monthIndex, salesStrategy), 0);
}

function getPlanProductId(plan) {
  return plan?.product_id || plan?.product?.id || plan?.input?.productId || "";
}

function buildWorkforceRowsFromOperationRows(operationRows) {
  return asObjectArray(operationRows)
    .map((row) => {
      const workforceId = row.workforceId || row.workforce_id || "";
      const peopleAssigned = Math.max(0, toFiniteNumber(row.peopleAssigned, 1));
      const dailyHours = Math.max(0, toFiniteNumber(row.workforceDailyHours ?? row.workforceHours ?? row.dailyHours, 8));

      if (!workforceId || peopleAssigned <= 0 || dailyHours <= 0) return null;

      return {
        ...emptyPlanRows.workforce,
        dailyHours,
        peopleAssigned,
        workforceId,
      };
    })
    .filter(Boolean);
}

function getMonthlyProductProductionMap(operationsWorkspace, workingDaysPerMonth = 22) {
  const plans = getCurrentOperationPlans(operationsWorkspace).filter((plan) => hasViablePlanResult(plan.result));
  const productionByProduct = new Map();

  plans.forEach((plan) => {
    const productId = getPlanProductId(plan);
    if (!productId) return;

    const monthlyProduced = Math.max(0, toFiniteNumber(plan.result?.producedQuantity)) * Math.max(1, toFiniteNumber(workingDaysPerMonth, 22));
    productionByProduct.set(productId, (productionByProduct.get(productId) || 0) + monthlyProduced);
  });

  return productionByProduct;
}

function getOperationProductMap(operationsWorkspace) {
  return new Map((operationsWorkspace.products || []).map((product) => [product.id, product]));
}

function calculateChannelMonth(monthIndex, salesStrategy, operationsWorkspace = {}, workingDaysPerMonth = 22, settingsInput = {}) {
  const channels = Array.isArray(salesStrategy.channels) ? salesStrategy.channels : [];
  const productionByProduct = getMonthlyProductProductionMap(operationsWorkspace, workingDaysPerMonth);
  const productMap = getOperationProductMap(operationsWorkspace);
  const priceIncreaseMultiplier = getPeriodicAnnualIncreaseMultiplier(settingsInput.priceIncreaseAnnualPercent, monthIndex, settingsInput.increaseFrequency);

  const totals = channels.reduce((currentTotals, channel) => {
    const productId = channel.productId || channel.product_id || "";
    const desiredUnits = getProjectedChannelSalesUnits(channel, monthIndex, salesStrategy);
    const availableUnits = productId ? Math.max(0, productionByProduct.get(productId) || 0) : 0;
    const channelUnits = Math.min(desiredUnits, availableUnits);
    const product = productMap.get(productId) || channel.product || {};
    const channelUnitPrice = getOptionalPositiveNumber(channel.unitSalesPrice);
    const price = Math.max(0, channelUnitPrice ?? toFiniteNumber(product.price)) * priceIncreaseMultiplier;
    const commissionRate = Math.max(0, toFiniteNumber(channel.commissionPercent)) / 100;
    const discountRate = Math.max(0, toFiniteNumber(channel.discountRatePercent)) / 100;
    const returnRate = Math.max(0, toFiniteNumber(channel.returnRatePercent)) / 100;
    const returnedUnits = channelUnits * returnRate;
    const netUnits = Math.max(0, channelUnits - returnedUnits);
    const launchFee = monthIndex + 1 === Math.max(1, Math.round(toFiniteNumber(channel.startMonth, 1)))
      ? Math.max(0, toFiniteNumber(channel.launchFee))
      : 0;
    const grossRevenue = netUnits * price * Math.max(0, 1 - discountRate);
    const acquisitionCost = netUnits * Math.max(0, toFiniteNumber(channel.customerAcquisitionCost));
    const commissionCost = grossRevenue * commissionRate;
    const channelCost = commissionCost + acquisitionCost + launchFee;
    const revenue = Math.max(0, grossRevenue - channelCost);
    const collectionDays = toOptionalFiniteNumber(channel.collectionDays) ?? toFiniteNumber(settingsInput.receivablesCollectionDays, 30);
    const delayMonths = Math.max(0, Math.ceil(collectionDays / 30));

    if (productId) {
      productionByProduct.set(productId, Math.max(0, availableUnits - channelUnits));
    }

    currentTotals.channels.push({
      delayMonths,
      desiredUnits,
      marginCost: channelCost,
      productId,
      revenue,
      returnedUnits,
      units: netUnits,
    });
    currentTotals.delayWeight += desiredUnits;
    currentTotals.discountCost += netUnits * price * discountRate;
    currentTotals.marginCost += channelCost;
    currentTotals.netSoldUnits += netUnits;
    currentTotals.forecastUnits += desiredUnits;
    currentTotals.revenue += revenue;
    currentTotals.returnedUnits += returnedUnits;
    currentTotals.weightedPaymentDelayDays += desiredUnits * collectionDays;

    return currentTotals;
  }, {
    channels: [],
    delayWeight: 0,
    discountCost: 0,
    forecastUnits: 0,
    marginCost: 0,
    netSoldUnits: 0,
    returnedUnits: 0,
    revenue: 0,
    weightedPaymentDelayDays: 0,
  });

  return {
    ...totals,
    weightedPaymentDelayDays: totals.delayWeight ? totals.weightedPaymentDelayDays / totals.delayWeight : 0,
  };
}

function buildFinancialFeasibilityModel(baseModel, salesStrategy, settingsInput, operationsWorkspace, horizon) {
  const settings = {
    ...defaultFinancialSettings,
    ...(baseModel.settings || {}),
    ...(settingsInput || {}),
  };
  const monthCount = getProjectionMonthCount(horizon);
  const activePlans = getCurrentOperationPlans(operationsWorkspace).filter((plan) => hasViablePlanResult(plan.result));
  const electricityPrice = Math.max(0, toFiniteNumber(settings.electricityPricePerKwh));
  const workingDaysPerMonth = Math.max(1, toFiniteNumber(settings.workingDaysPerMonth, 22));
  const investmentGrantAmount = Math.max(0, toFiniteNumber(settings.investmentGrantAmount));
  const initialCapacityUnits = Math.max(0, toFiniteNumber(settings.initialCapacityUnits));
  const dailyProduced = activePlans.reduce((total, plan) => total + Math.max(0, toFiniteNumber(plan.result?.producedQuantity)), 0);
  const dailyMaterialCost = activePlans.reduce((total, plan) => total + Math.max(0, toFiniteNumber(plan.result?.materialCost)), 0);
  const dailyWorkforceCost = activePlans.reduce((total, plan) => total + Math.max(0, toFiniteNumber(plan.result?.workforceCost)), 0);
  const dailyElectricityCost = activePlans.reduce((total, plan) => total + Math.max(0, toFiniteNumber(plan.result?.energyConsumptionKwh)) * electricityPrice, 0);
  const uniqueMachines = new Map();

  activePlans.forEach((plan) => {
    (plan.result?.machineRows || []).forEach((row) => {
      if (row.machineId && !uniqueMachines.has(row.machineId)) {
        uniqueMachines.set(row.machineId, Math.max(0, toFiniteNumber(row.price)));
      }
    });
  });

  const machinePurchaseCost = Array.from(uniqueMachines.values()).reduce((total, price) => total + price, 0) || toFiniteNumber(baseModel.summary?.machinePurchaseCost);
  const equipmentPurchaseCost = (operationsWorkspace.equipment || []).reduce(
    (total, equipment) => total + (Math.max(0, toFiniteNumber(equipment.price)) * Math.max(0, toFiniteNumber(equipment.quantity, 1))),
    0,
  );
  const unitMaterialCost = dailyProduced ? dailyMaterialCost / dailyProduced : 0;
  const unitWorkforceCost = dailyProduced ? dailyWorkforceCost / dailyProduced : 0;
  const unitElectricityCost = dailyProduced ? dailyElectricityCost / dailyProduced : 0;
  const unitProductionCost = unitMaterialCost + unitWorkforceCost + unitElectricityCost;
  const extraCosts = baseModel.extraCosts || [];
  const extraInitialCost = extraCosts.reduce((total, cost) => total + (cost.costType === "initial" ? Math.max(0, toFiniteNumber(cost.amount)) : 0), 0);
  const extraRecurringCost = extraCosts.reduce((total, cost) => total + (cost.costType === "recurring" ? Math.max(0, toFiniteNumber(cost.amount)) : 0), 0);
  const monthlyMaterialCost = dailyMaterialCost * workingDaysPerMonth;
  const monthlyWorkforceCost = dailyWorkforceCost * workingDaysPerMonth;
  const projectionStartMonth = getMonthStart(new Date());
  const loanRows = getFinancialLoanRows(settings).map((loan) => ({
    ...loan,
    amount: convertMoneyToTry(loan.amount, loan.currency, settings.exchangeRates),
    currency: "TRY",
    monthlyPayment: convertMoneyToTry(loan.monthlyPayment, loan.currency, settings.exchangeRates),
    originalAmount: loan.amount,
    originalCurrency: loan.currency,
    originalMonthlyPayment: loan.monthlyPayment,
  })).map((loan) => {
    const receivedMonth = getMonthStart(parseDateInput(loan.receivedDate) || projectionStartMonth);
    const receivedMonthIndex = Math.max(0, getMonthDifference(projectionStartMonth, receivedMonth));

    return {
      ...loan,
      receivedMonthIndex,
    };
  });
  const loanAmount = loanRows.reduce((total, row) => total + row.amount, 0);
  const initialLoanFunding = loanRows.reduce((total, row) => (row.receivedMonthIndex === 0 ? total + row.amount : total), 0);
  const monthlyLoanPayment = loanRows.reduce((total, row) => total + row.monthlyPayment, 0);
  const monthlyCurrencyIncreaseRate = Math.max(0, toFiniteNumber(settings.monthlyCurrencyIncreasePercent)) / 100;
  const monthlyEnergyPriceIncreaseRate = Math.max(0, toFiniteNumber(settings.monthlyEnergyPriceIncreasePercent)) / 100;
  const monthlyInflationRate = Math.max(0, toFiniteNumber(settings.monthlyInflationPercent)) / 100;
  const monthlyWageIncreaseRate = Math.max(0, toFiniteNumber(settings.monthlyWageIncreasePercent)) / 100;
  const monthlyCogsInflationRate = getMonthlyRateFromAnnualPercent(settings.cogsInflationAnnualPercent);
  const monthlyOpexInflationRate = getMonthlyRateFromAnnualPercent(settings.opexInflationAnnualPercent);
  const compoundMonthlyRate = (rate, monthIndex) => ((1 + rate) ** monthIndex);
  const salesVatRate = Math.max(0, toFiniteNumber(settings.salesVatRate, settings.vatRate ?? 20)) / 100;
  const expenseVatRate = Math.max(0, toFiniteNumber(settings.expenseVatRate, settings.vatRate ?? 20)) / 100;
  const incomeTaxRate = Math.max(0, toFiniteNumber(settings.incomeTaxRate, 25)) / 100;
  const taxPaymentDelayMonths = Math.max(0, Math.round(toFiniteNumber(settings.taxPaymentDelayMonths, 0)));
  const initialCash = Math.max(0, toFiniteNumber(settings.initialCash));
  const initialInvestment = machinePurchaseCost + equipmentPurchaseCost + extraInitialCost;
  const receivablesWorkingCapital = Math.max(0, calculateChannelMonth(0, salesStrategy, operationsWorkspace, workingDaysPerMonth, settings).revenue) *
    (Math.max(0, toFiniteNumber(settings.receivablesCollectionDays, 30)) / 30);
  const materialStockMonths = Math.max(0, toFiniteNumber(settings.rawMaterialStockDays)) / 30;
  const supplierCreditMonths = Math.max(0, toFiniteNumber(settings.supplierPaymentDays)) / 30;
  const materialWorkingCapital = monthlyMaterialCost * Math.max(0, Math.max(0, toFiniteNumber(settings.rawMaterialBufferMonths, 1)) + materialStockMonths - supplierCreditMonths);
  const adjustedWorkingCapitalRequirement =
    materialWorkingCapital +
    receivablesWorkingCapital +
    (monthlyWorkforceCost * Math.max(0, toFiniteNumber(settings.salaryBufferMonths, 1))) +
    (extraRecurringCost * Math.max(0, toFiniteNumber(settings.rentBufferMonths, 1)));
  const workingCapitalRequirement = adjustedWorkingCapitalRequirement;
  const requiredOwnCash = Math.max(0, initialInvestment + adjustedWorkingCapitalRequirement - initialLoanFunding - investmentGrantAmount);
  const cashReceipts = Array.from({ length: monthCount + 24 }, () => 0);
  const loanReceipts = Array.from({ length: monthCount + 24 }, () => 0);
  loanRows.forEach((loan) => {
    if (loan.receivedMonthIndex > 0 && loan.receivedMonthIndex < loanReceipts.length) {
      loanReceipts[loan.receivedMonthIndex] += loan.amount;
    }
  });
  const taxPayments = Array.from({ length: monthCount + taxPaymentDelayMonths + 24 }, () => 0);
  const rows = [];
  const loanBalances = loanRows.map((row) => row.amount);
  let cashBalance = initialCash + initialLoanFunding + investmentGrantAmount - initialInvestment - adjustedWorkingCapitalRequirement;
  let cumulativePayback = -initialInvestment - adjustedWorkingCapitalRequirement + initialLoanFunding + investmentGrantAmount;
  let cashRunwayMonths = cashBalance < 0 ? 0 : monthCount;
  let breakEvenMonth = null;
  let paybackMonth = null;
  const totals = {
    cashFlow: 0,
    discountCost: 0,
    electricityCost: 0,
    expiredWriteOffCost: 0,
    expiredWriteOffUnits: 0,
    forecastSalesUnits: 0,
    incomeTax: 0,
    loanInterest: 0,
    loanPayment: 0,
    materialCost: 0,
    netIncome: 0,
    netSoldUnits: 0,
    producedUnits: 0,
    retailerMarginCost: 0,
    returnedUnits: 0,
    revenue: 0,
    totalCost: 0,
    unsoldInventoryUnits: 0,
    vatPayable: 0,
    workforceCost: 0,
  };

  for (let index = 0; index < monthCount; index += 1) {
    const cogsCostMultiplier = compoundMonthlyRate(monthlyCogsInflationRate, index);
    const opexCostMultiplier = compoundMonthlyRate(monthlyOpexInflationRate, index);
    const materialCostMultiplier = compoundMonthlyRate(monthlyCurrencyIncreaseRate, index) * compoundMonthlyRate(monthlyInflationRate, index) * cogsCostMultiplier;
    const workforceCostMultiplier = compoundMonthlyRate(monthlyWageIncreaseRate || monthlyInflationRate, index);
    const electricityCostMultiplier = compoundMonthlyRate(monthlyEnergyPriceIncreaseRate || monthlyInflationRate, index) * cogsCostMultiplier;
    const overheadCostMultiplier = compoundMonthlyRate(monthlyInflationRate, index) * opexCostMultiplier;
    const monthlyUnitMaterialCost = unitMaterialCost * materialCostMultiplier;
    const monthlyUnitWorkforceCost = unitWorkforceCost * workforceCostMultiplier;
    const monthlyUnitElectricityCost = unitElectricityCost * electricityCostMultiplier;
    const monthlyUnitProductionCost = monthlyUnitMaterialCost + monthlyUnitWorkforceCost + monthlyUnitElectricityCost;
    const monthlyExtraRecurringCost = extraRecurringCost * overheadCostMultiplier;
    const plannedProducedUnits = dailyProduced * workingDaysPerMonth;
    const producedUnits = index === 0 && initialCapacityUnits > 0
      ? Math.min(plannedProducedUnits, initialCapacityUnits)
      : plannedProducedUnits;
    const forecastUnits = getSalesForecastForMonth(salesStrategy, index);
    const channelMonth = calculateChannelMonth(index, salesStrategy, operationsWorkspace, workingDaysPerMonth, settings);
    const grossSoldUnits = channelMonth.netSoldUnits;
    const unsoldUnits = Math.max(0, producedUnits - grossSoldUnits);
    const spoilageRate = 0;
    const expiredUnits = unsoldUnits * spoilageRate;
    const writeOffUnits = expiredUnits + channelMonth.returnedUnits;
    const writeOffCost = writeOffUnits * monthlyUnitProductionCost;
    const cogsSold = channelMonth.netSoldUnits * monthlyUnitProductionCost;
    const cashProductionCost = producedUnits * monthlyUnitProductionCost;
    const materialCost = producedUnits * monthlyUnitMaterialCost;
    const workforceCost = producedUnits * monthlyUnitWorkforceCost;
    const electricityCost = producedUnits * monthlyUnitElectricityCost;
    const loanMonth = loanRows.reduce((total, loan, loanIndex) => {
      const monthsSinceReceived = index - loan.receivedMonthIndex;
      if (monthsSinceReceived < 0 || monthsSinceReceived >= loan.loanTermMonths) {
        return total;
      }

      const balance = loanBalances[loanIndex] || 0;
      const monthlyRate = loan.annualInterestRate / 100 / 12;
      const interest = balance * monthlyRate;
      const isGraceMonth = monthsSinceReceived < loan.gracePeriodMonths;
      const payment = !isGraceMonth ? Math.min(loan.monthlyPayment, balance + interest) : 0;
      const principal = Math.max(0, payment - interest);

      loanBalances[loanIndex] = isGraceMonth
        ? Math.max(0, balance + interest)
        : Math.max(0, balance - principal);

      return {
        interest: total.interest + interest,
        payment: total.payment + payment,
        principal: total.principal + principal,
      };
    }, { interest: 0, payment: 0, principal: 0 });
    const loanPayment = loanMonth.payment;
    const loanInterest = loanMonth.interest;

    channelMonth.channels.forEach((channel) => {
      const receiptIndex = index + channel.delayMonths;
      if (receiptIndex < cashReceipts.length) {
        cashReceipts[receiptIndex] += channel.revenue;
      }
    });

    const cashIn = (cashReceipts[index] || 0) + (loanReceipts[index] || 0);
    const outputVat = channelMonth.revenue * salesVatRate;
    const inputVat = Math.max(0, (materialCost + electricityCost + monthlyExtraRecurringCost) * expenseVatRate);
    const vatPayable = Math.max(0, outputVat - inputVat);
    const profitBeforeTax = channelMonth.revenue - cogsSold - writeOffCost - monthlyExtraRecurringCost - loanInterest;
    const incomeTax = Math.max(0, profitBeforeTax * incomeTaxRate);
    const netIncome = profitBeforeTax - incomeTax;
    const taxPaymentIndex = index + taxPaymentDelayMonths;
    if (taxPaymentIndex < taxPayments.length) {
      taxPayments[taxPaymentIndex] += vatPayable + incomeTax;
    }
    const taxCashOut = taxPayments[index] || 0;
    const cashFlow = cashIn - cashProductionCost - monthlyExtraRecurringCost - loanPayment - taxCashOut;
    const totalCost = cogsSold + writeOffCost + monthlyExtraRecurringCost + loanInterest + incomeTax;

    cashBalance += cashFlow;
    cumulativePayback += cashFlow;

    if (cashBalance < 0 && cashRunwayMonths === monthCount) {
      cashRunwayMonths = index;
    }

    if (breakEvenMonth === null && netIncome >= 0) {
      breakEvenMonth = index + 1;
    }

    if (paybackMonth === null && cumulativePayback >= 0) {
      paybackMonth = index + 1;
    }

    totals.cashFlow += cashFlow;
    totals.discountCost += channelMonth.discountCost;
    totals.electricityCost += electricityCost;
    totals.expiredWriteOffCost += writeOffCost;
    totals.expiredWriteOffUnits += writeOffUnits;
    totals.forecastSalesUnits += forecastUnits;
    totals.incomeTax += incomeTax;
    totals.loanInterest += loanInterest;
    totals.loanPayment += loanPayment;
    totals.materialCost += materialCost;
    totals.netIncome += netIncome;
    totals.netSoldUnits += channelMonth.netSoldUnits;
    totals.producedUnits += producedUnits;
    totals.retailerMarginCost += channelMonth.marginCost;
    totals.returnedUnits += channelMonth.returnedUnits;
    totals.revenue += channelMonth.revenue;
    totals.totalCost += totalCost;
    totals.unsoldInventoryUnits += unsoldUnits;
    totals.vatPayable += vatPayable;
    totals.workforceCost += workforceCost;

    rows.push({
      cashBalance,
      cashFlow,
      cashIn,
      electricityCost,
      forecastUnits,
      incomeTax,
      loanInterest,
      materialCost,
      netIncome,
      netSoldUnits: channelMonth.netSoldUnits,
      period: index + 1,
      producedUnits,
      salesRevenue: channelMonth.revenue,
      totalCost,
      unsoldUnits,
      vatPayable,
      workforceCost,
      writeOffCost,
      writeOffUnits,
    });
  }

  const firstMonth = rows[0] || {};
  const averageNetPrice = totals.netSoldUnits ? totals.revenue / totals.netSoldUnits : toFiniteNumber(operationsWorkspace.products?.[0]?.price);
  const contributionPerUnit = Math.max(0, averageNetPrice - unitProductionCost);
  const requiredMonthlySalesVolume = contributionPerUnit
    ? (extraRecurringCost + Math.min(monthlyLoanPayment, loanAmount || monthlyLoanPayment)) / contributionPerUnit
    : 0;
  const maxChartValue = Math.max(
    1,
    ...rows.map((row) => Math.max(row.salesRevenue, row.totalCost, row.netIncome, 0)),
  );
  const getPath = (field) => rows.map((row, index) => {
    const x = rows.length <= 1 ? 36 : 36 + (index * (434 / (rows.length - 1)));
    const y = 210 - ((Math.max(0, row[field]) / maxChartValue) * 170);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");

  return {
    ...baseModel,
    costStructure: [
      { amount: totals.materialCost, id: "materialCost", label: "Raw materials and packaging" },
      { amount: totals.workforceCost, id: "workforceCost", label: "Salaries and labor" },
      { amount: totals.electricityCost, id: "electricityCost", label: "Electricity" },
      { amount: totals.expiredWriteOffCost, id: "writeOffCost", label: "Spoilage, returns and expired write-off" },
      { amount: extraRecurringCost * monthCount, id: "recurringExtraCost", label: "Recurring overhead" },
      { amount: totals.vatPayable, id: "vatPayable", label: "VAT payable" },
      { amount: totals.incomeTax, id: "incomeTax", label: "Income tax" },
      { amount: totals.loanInterest, id: "loanInterest", label: "Loan interest" },
    ],
    extraCosts,
    incomeRows: [
      { amount: totals.revenue, id: "salesRevenue", kind: "income", label: "Sales revenue from monthly forecast" },
      { amount: investmentGrantAmount, id: "investmentGrant", kind: "income", label: "Investment grant / subsidy" },
      { amount: totals.materialCost, costType: "recurring", id: "materialCost", kind: "cost", label: "Raw materials and packaging" },
      { amount: totals.workforceCost, costType: "recurring", id: "workforceCost", kind: "cost", label: "Salaries and labor" },
      { amount: totals.electricityCost, costType: "recurring", id: "electricityCost", kind: "cost", label: "Electricity" },
      { amount: totals.expiredWriteOffCost, costType: "recurring", id: "writeOffCost", kind: "cost", label: "Spoilage, returns and expired write-off" },
      { amount: machinePurchaseCost, costType: "initial", id: "machinePurchase", kind: "cost", label: "Machine investment" },
      { amount: equipmentPurchaseCost, costType: "initial", id: "equipmentPurchase", kind: "cost", label: "Equipment investment" },
      { amount: extraInitialCost, costType: "initial", id: "extraInitialCost", kind: "cost", label: "Initial extra costs" },
      { amount: workingCapitalRequirement, costType: "initial", id: "workingCapital", kind: "cost", label: "Working capital requirement" },
      { amount: totals.vatPayable, costType: "recurring", id: "vatPayable", kind: "cost", label: "VAT payable" },
      { amount: totals.incomeTax, costType: "recurring", id: "incomeTax", kind: "cost", label: "Income tax" },
      { amount: totals.loanInterest, costType: "recurring", id: "loanInterest", kind: "cost", label: "Loan interest" },
    ],
    settings,
    summary: {
      ...emptyFinancialModel.summary,
      ...baseModel.summary,
      averageNetPrice,
      breakEvenMonth,
      cashRunwayMonths,
      discountCost: totals.discountCost,
      electricityCost: totals.electricityCost,
      equipmentPurchaseCost,
      expiredWriteOffCost: totals.expiredWriteOffCost,
      expiredWriteOffUnits: totals.expiredWriteOffUnits,
      extraInitialCost,
      extraRecurringCost: extraRecurringCost * monthCount,
      forecastSalesUnits: totals.forecastSalesUnits,
      incomeTax: totals.incomeTax,
      initialCash,
      investmentGrantAmount,
      initialCashRequired: requiredOwnCash,
      loanAmount,
      loanInterest: totals.loanInterest,
      loanPayment: monthlyLoanPayment,
      loanPaymentTotal: totals.loanPayment,
      loanRows,
      machinePurchaseCost,
      materialCost: totals.materialCost,
      netIncome: totals.netIncome,
      netSoldUnits: totals.netSoldUnits,
      paybackMonth,
      planCount: activePlans.length,
      requiredMonthlySalesVolume,
      retailerMarginCost: totals.retailerMarginCost,
      returnedUnits: totals.returnedUnits,
      salesRevenue: totals.revenue,
      totalCashFlow: totals.cashFlow,
      totalCost: totals.totalCost,
      totalProduced: totals.producedUnits,
      unitProductionCost,
      unsoldInventoryUnits: totals.unsoldInventoryUnits,
      vatPayable: totals.vatPayable,
      weightedPaymentDelayDays: calculateChannelMonth(0, salesStrategy, operationsWorkspace, workingDaysPerMonth, settings).weightedPaymentDelayDays,
      workingCapitalRequirement,
      workingDaysPerMonth,
      firstMonthCashBalance: firstMonth.cashBalance || 0,
    },
    trendChart: {
      costPath: getPath("totalCost"),
      labels: rows,
      netPath: getPath("netIncome"),
      salesPath: getPath("salesRevenue"),
    },
    trendRows: rows,
  };
}

const text = {
  en: {
    language: "Language",
    themeLight: "Light mode",
    themeDark: "Dark mode",
    showPassword: "Show password",
    hidePassword: "Hide password",
    show: "Show",
    hide: "Hide",
    light: "Light",
    dark: "Dark",
    dataSync: "Data Sync",
    live: "Live",
    login: "Log in",
    adminProvisionedAccess: "Accounts are created by your company admin in Authorization.",
    who: "Who are we?",
    solutions: "Our solutions",
    references: "Our references",
    contact: "Contact",
    heroTitle: "Atera",
    heroCopy: "Turn production, cash, capacity, and sales assumptions into one living feasibility model before you commit capital.",
    goToLogin: "Use Atera",
    whoCopy: "Atera is the operating layer for teams that need to see the factory before the factory spends money. Capacity, margin, cash, timing, and risk move in one live decision model, so every scenario shows what it costs, what it breaks, and what it makes possible.",
    solutionsCopy: "Define the product, resources, production plan, sales channels, financial assumptions, and scenarios in one flow. Plan, test, decide, and scale with the same operating truth.",
    farmerPersona: "Planning team",
    factoryOwnerPersona: "Production lead",
    entrepreneurPersona: "Finance team",
    exporterPersona: "Operations owner",
    farmerNeed: "Need: See whether a new order is feasible before committing capacity.",
    farmerBenefit: "Benefit: Compare material, labor, and timing scenarios in one calm workspace.",
    farmerDifference: "Atera's difference: Tailor-made planning without enterprise software weight.",
    factoryOwnerNeed: "Need: Understand which production route protects margin and delivery time.",
    factoryOwnerBenefit: "Benefit: Make faster calls with clearer cost and stock visibility.",
    factoryOwnerDifference: "Atera's difference: Built around the way your team actually works.",
    entrepreneurNeed: "Need: Turn scattered spreadsheets into a shared operating view.",
    entrepreneurBenefit: "Benefit: Keep decisions, assumptions, and feasibility notes together.",
    entrepreneurDifference: "Atera's difference: Practical, budget-friendly structure that can grow step by step.",
    exporterNeed: "Need: Check price, currency, stock, and shipment promises before quoting.",
    exporterBenefit: "Benefit: Reduce surprises between sales, production, and delivery.",
    exporterDifference: "Atera's difference: Friendly planning tools for real-world tradeoffs.",
    referencesCopy: "Reference stories and customer examples will live here as the product grows. For now, the system map shows the decision areas Atera brings into the same loop.",
    contactPhone: "",
    contactEmail: "hello@atera.app",
    contactLocation: "Istanbul, Turkiye",
    username: "Username",
    loginEmail: "Email",
    password: "Password",
    email: "Mail address",
    phoneNumber: "Phone number",
    company: "Company",
    department: "Department",
    accessLevel: "Access level",
    profilePicture: "Profile picture",
    forgot: "I forgot my password",
    resetPassword: "Set new password",
    confirmPassword: "Confirm password",
    submitLogin: "Log in",
    logout: "Log out",
    signedIn: "Signed in",
    dashboard: "Dashboard",
    dashboardCopy: "This area will become the main workspace for planning, feasibility, and operational tools.",
    authorizationPage: "Authorization Page",
    authorizationCopy: "Authorization tools and user access controls live here.",
    authorizationLocked: "Authorization is locked for your current role.",
    authorizationLockedCopy: "Your company role does not have read or write permission for this module yet.",
    roleDefinition: "Role definition",
    userDefinition: "User definition",
    userDefinitionCopy: "Create company users and save their profile records through Supabase.",
    managedUsers: "Defined users",
    createManagedUser: "Create user",
    userCreated: "User was created and saved to profiles.",
    newRole: "New role",
    roleName: "Role name",
    roleDescription: "Role description",
    createRole: "Create role",
    permissions: "Permissions",
    module: "Module",
    readPermission: "Read",
    writePermission: "Write",
    readOnlyMode: "Read-only mode",
    writeAccess: "Write access",
    noCompany: "Your profile is not connected to a company yet.",
    loadAuthorizationError: "Authorization data could not be loaded.",
    backToDashboard: "Back to dashboard",
    configure: "Add your Supabase URL and anon key to .env, then restart npm run dev.",
    resetSent: "Password reset email sent.",
    needEmail: "Enter your mail address first.",
    forgotEmailPrompt: "Enter your mail address for password reset.",
    passwordMismatch: "Passwords do not match.",
    passwordTooShort: "Password must be at least 6 characters.",
    passwordUpdated: "Password updated. You can log in now.",
    usernameNotFound: "Username was not found.",
    missingUser: "Supabase did not return a user.",
  },
  tr: {
    language: "Dil",
    themeLight: "Aydınlık mod",
    themeDark: "Karanlık mod",
    showPassword: "Şifreyi göster",
    hidePassword: "Şifreyi gizle",
    show: "Göster",
    hide: "Gizle",
    light: "Aydınlık",
    dark: "Karanlık",
    dataSync: "Veri Senkronu",
    live: "Canlı",
    login: "Giriş yap",
    adminProvisionedAccess: "Hesaplar şirket admini tarafından Yetkilendirme ekranında oluşturulur.",
    who: "Biz kimiz?",
    solutions: "Çözümlerimiz",
    references: "Referanslarımız",
    contact: "İletişim",
    heroTitle: "Atera",
    heroCopy: "Üretim, nakit, kapasite ve satış varsayımlarını sermaye bağlamadan önce tek canlı fizibilite modeline çevirin.",
    goToLogin: "Atera'yı kullan",
    whoCopy: "Atera, fabrika daha para harcamadan fabrikanın kendisini görmenizi sağlayan operasyon katmanıdır. Kapasite, marj, nakit, termin ve risk tek canlı karar modelinde akar; her senaryo neye mal olur, nereyi zorlar ve neyi mümkün kılar netleşir.",
    solutionsCopy: "Ürünü, kaynakları, üretim planını, satış kanallarını, finansal varsayımları ve senaryoları tek akışta tanımlayın. Aynı operasyon gerçeğiyle planlayın, deneyin, karar verin ve büyütün.",
    farmerPersona: "Planlama ekibi",
    factoryOwnerPersona: "Üretim sorumlusu",
    entrepreneurPersona: "Finans ekibi",
    exporterPersona: "Operasyon sahibi",
    farmerNeed: "İhtiyaç: Yeni bir siparişe söz vermeden önce üretim fizibilitesini görmek.",
    farmerBenefit: "Fayda: Malzeme, işçilik ve termin senaryolarını tek sakin alanda karşılaştırmak.",
    farmerDifference: "Atera'nın farkı: Kurumsal yazılım ağırlığı olmadan tailor-made planlama.",
    factoryOwnerNeed: "İhtiyaç: Hangi üretim yolunun marjı ve teslimatı koruduğunu anlamak.",
    factoryOwnerBenefit: "Fayda: Maliyet ve stok görünürlüğüyle daha hızlı karar almak.",
    factoryOwnerDifference: "Atera'nın farkı: Ekibinizin gerçek çalışma şekline göre şekillenmesi.",
    entrepreneurNeed: "İhtiyaç: Dağılan Excel'leri ortak bir operasyon görünümüne çevirmek.",
    entrepreneurBenefit: "Fayda: Kararları, varsayımları ve fizibilite notlarını birlikte tutmak.",
    entrepreneurDifference: "Atera'nın farkı: Adım adım büyüyebilen pratik ve bütçe dostu yapı.",
    exporterNeed: "İhtiyaç: Teklif vermeden önce fiyat, kur, stok ve sevkiyat sözünü kontrol etmek.",
    exporterBenefit: "Fayda: Satış, üretim ve teslimat arasındaki sürprizleri azaltmak.",
    exporterDifference: "Atera'nın farkı: Gerçek hayattaki trade-off'lar için samimi planlama araçları.",
    referencesCopy: "Ürün büyüdükçe referans hikayeleri ve müşteri örnekleri burada yer alacak. Şimdilik bu akış, Atera'nın aynı döngüye aldığı karar alanlarını gösterir.",
    contactPhone: "",
    contactEmail: "hello@atera.app",
    contactLocation: "Istanbul, Turkiye",
    username: "Kullanıcı adı",
    loginEmail: "E-posta",
    password: "Şifre",
    email: "Mail adresi",
    phoneNumber: "Telefon numarası",
    company: "Şirket",
    department: "Departman",
    accessLevel: "Yetki seviyesi",
    profilePicture: "Profil fotoğrafı",
    forgot: "Şifremi unuttum",
    resetPassword: "Yeni şifre belirle",
    confirmPassword: "Şifreyi onayla",
    submitLogin: "Giriş yap",
    logout: "Çıkış yap",
    signedIn: "Giriş yapıldı",
    dashboard: "Dashboard",
    dashboardCopy: "Bu alan planlama, fizibilite ve operasyon araçları için ana çalışma alanına dönüşecek.",
    authorizationPage: "Yetkilendirme Sayfası",
    authorizationCopy: "Yetkilendirme araçları ve kullanıcı erişim kontrolleri burada yer alır.",
    authorizationLocked: "Yetkilendirme mevcut yetkiniz için kilitli.",
    authorizationLockedCopy: "Şirketinizdeki yetkinizin bu modül için okuma veya yazma izni yok.",
    roleDefinition: "Yetki tanımlama",
    userDefinition: "Kullanıcı tanımlama",
    userDefinitionCopy: "Şirket kullanıcıları oluşturun ve profil kayıtlarını Supabase'e kaydedin.",
    managedUsers: "Tanımlı kullanıcılar",
    createManagedUser: "Kullanıcı oluştur",
    userCreated: "Kullanıcı oluşturuldu ve profiles tablosuna kaydedildi.",
    newRole: "Yeni yetki",
    roleName: "Yetki adı",
    roleDescription: "Yetki açıklaması",
    createRole: "Yetki yarat",
    permissions: "İzinler",
    module: "Modül",
    readPermission: "Okuma",
    writePermission: "Yazma",
    readOnlyMode: "Sadece okuma",
    writeAccess: "Yazma erişimi",
    noCompany: "Profiliniz henüz bir şirkete bağlı değil.",
    loadAuthorizationError: "Yetkilendirme verisi yüklenemedi.",
    backToDashboard: "Dashboard'a dön",
    configure: ".env dosyasına Supabase URL ve anon key ekleyip npm run dev'i yeniden başlat.",
    resetSent: "Şifre sıfırlama e-postası gönderildi.",
    needEmail: "Önce mail adresini gir.",
    forgotEmailPrompt: "Şifre sıfırlama için mail adresini gir.",
    passwordMismatch: "Şifreler eşleşmiyor.",
    passwordTooShort: "Şifre en az 6 karakter olmalı.",
    passwordUpdated: "Şifre güncellendi. Artık giriş yapabilirsiniz.",
    usernameNotFound: "Kullanıcı adı bulunamadı.",
    missingUser: "Supabase kullanıcı bilgisi döndürmedi.",
  },
};

function PersonaAvatar({ type, title }) {
  const palette = {
    planning: { shirt: "#2f9fbd", hair: "#173b41", accent: "#d99a24", skin: "#f1c19d" },
    production: { shirt: "#187565", hair: "#102b32", accent: "#d99a24", skin: "#d99f78" },
    finance: { shirt: "#9d5b3f", hair: "#3f2b24", accent: "#2f9fbd", skin: "#e7b58e" },
    operations: { shirt: "#173b41", hair: "#6f4937", accent: "#187565", skin: "#c98d68" },
  }[type];

  return (
    <svg className="persona-avatar" viewBox="0 0 160 160" role="img" aria-label={title}>
      <rect className="avatar-card-bg" x="8" y="8" width="144" height="144" rx="22" />
      <circle cx="80" cy="68" r="34" fill={palette.skin} />
      <path d="M47 66c4-26 19-40 43-38 19 2 31 14 33 36-15-7-32-9-48-6-11 2-20 5-28 8Z" fill={palette.hair} />
      <circle cx="68" cy="72" r="4" fill="#102b32" />
      <circle cx="92" cy="72" r="4" fill="#102b32" />
      <path d="M70 88c7 6 15 6 22 0" fill="none" stroke="#102b32" strokeLinecap="round" strokeWidth="4" />
      <path d="M42 137c4-24 19-36 38-36s34 12 38 36H42Z" fill={palette.shirt} />
      {type === "planning" && (
        <>
          <circle cx="40" cy="116" r="14" fill="#f1c19d" />
          <circle cx="120" cy="116" r="14" fill="#d99f78" />
          <path d="M26 140c2-12 8-18 14-18s12 6 14 18H26Z" fill="#173b41" />
          <path d="M106 140c2-12 8-18 14-18s12 6 14 18h-28Z" fill="#d99a24" />
          <path d="M112 36h22v18h-22zM117 44h12" fill="none" stroke={palette.accent} strokeLinecap="round" strokeWidth="4" />
        </>
      )}
      {type === "production" && (
        <>
          <path d="M46 54c5-21 17-31 34-31s29 10 34 31H46Z" fill={palette.accent} />
          <path d="M45 55h70" stroke="#102b32" strokeLinecap="round" strokeWidth="5" />
          <path d="M116 106h20v28h-20zM122 112h8M122 121h8M122 130h8" fill="none" stroke="#102b32" strokeLinecap="round" strokeWidth="4" />
        </>
      )}
      {type === "finance" && (
        <>
          <rect x="108" y="98" width="30" height="38" rx="6" fill="#f9faf6" stroke="#102b32" strokeWidth="4" />
          <path d="M115 108h16M116 119h4M124 119h4M132 119h1M116 128h4M124 128h4M132 128h1" stroke={palette.accent} strokeLinecap="round" strokeWidth="3" />
          <path d="M50 44c10-16 31-19 48-6" fill="none" stroke={palette.hair} strokeLinecap="round" strokeWidth="10" />
        </>
      )}
      {type === "operations" && (
        <>
          <path d="M47 73c0-23 14-42 33-42s33 19 33 42" fill="none" stroke={palette.accent} strokeLinecap="round" strokeWidth="7" />
          <rect x="39" y="68" width="12" height="22" rx="5" fill="#102b32" />
          <rect x="109" y="68" width="12" height="22" rx="5" fill="#102b32" />
          <path d="M116 91c-4 15-13 22-27 22" fill="none" stroke="#102b32" strokeLinecap="round" strokeWidth="4" />
          <circle cx="87" cy="113" r="4" fill="#102b32" />
        </>
      )}
    </svg>
  );
}

const routeAliasMap = {
  "/operations/process-definition": "/operations/data-entry",
  "/operations/process": "/operations/data-entry",
  "/operations/data": "/operations/data-entry",
};

function normalizeRoutePath(pathname) {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return routeAliasMap[normalized] || normalized;
}

function App() {
  const [mode, setMode] = useState("login");
  const [path, setPath] = useState(() => normalizeRoutePath(window.location.pathname));
  const [form, setForm] = useState(emptyForm);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [theme, setTheme] = useState("light");
  const [profilePreview, setProfilePreview] = useState("");
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [dashboardSidebarOpen, setDashboardSidebarOpen] = useState(true);
  const [dashboardAssumptionMenu, setDashboardAssumptionMenu] = useState(null);
  const [authorizationLoading, setAuthorizationLoading] = useState(false);
  const [authorizationStatus, setAuthorizationStatus] = useState("");
  const [authorizationTab, setAuthorizationTab] = useState("roles");
  const [authorizationAccess, setAuthorizationAccess] = useState({ read: false, write: false });
  const [modules, setModules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [managedUserForm, setManagedUserForm] = useState(emptyManagedUserForm);
  const [financialExtraCostForm, setFinancialExtraCostForm] = useState(emptyFinancialExtraCostForm);
  const [financialHorizon, setFinancialHorizon] = useState("6m");
  const [financialStatementPeriod, setFinancialStatementPeriod] = useState("quarterly");
  const [financialModel, setFinancialModel] = useState(emptyFinancialModel);
  const [financialSettingsForm, setFinancialSettingsForm] = useState(defaultFinancialSettings);
  const [financialStatus, setFinancialStatus] = useState("");
  const [financialLoading, setFinancialLoading] = useState(false);
  const [financialOverviewWidgets, setFinancialOverviewWidgets] = useState([]);
  const [incomeExpenseChartInView, setIncomeExpenseChartInView] = useState(false);
  const [incomeExpenseChartNode, setIncomeExpenseChartNode] = useState(null);
  const [exchangeRates, setExchangeRates] = useState(defaultExchangeRates);
  const [financeWindow, setFinanceWindow] = useState("today");
  const [financeDateRange, setFinanceDateRange] = useState({ start: "", end: "" });
  const [reportsFilterOpen, setReportsFilterOpen] = useState(false);
  const [reportsSearch, setReportsSearch] = useState("");
  const [reportsTab, setReportsTab] = useState("all");
  const [productPlusTab, setProductPlusTab] = useState("general");
  const [operationForms, setOperationForms] = useState(emptyOperationForms);
  const [operationPlan, setOperationPlan] = useState(emptyOperationPlan);
  const [operationPlanResult, setOperationPlanResult] = useState(null);
  const [processDefinitionOpen, setProcessDefinitionOpen] = useState(false);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [operationsStatus, setOperationsStatus] = useState("");
  const [tableControls, setTableControls] = useState({});
  const [salesStrategy, setSalesStrategy] = useState(emptySalesStrategy);
  const [salesStatus, setSalesStatus] = useState("");
  const [salesLoading, setSalesLoading] = useState(false);
  const [simulationVariants, setSimulationVariants] = useState([emptySimulationVariant]);
  const [simulationStatus, setSimulationStatus] = useState("");
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [operationsWorkspace, setOperationsWorkspace] = useState({
    activePlans: [],
    equipment: [],
    latestPlan: null,
    machines: [],
    materials: [],
    notes: [],
    product: null,
    products: [],
    workforce: [],
  });

  const labels = text[form.language] || text.en;
  const copy = (en, tr) => (form.language === "tr" ? tr : en);
  const locale = form.language === "tr" ? "tr-TR" : "en-US";
  const heightMatchKey = `${path}|${form.language}`;
  const [materialFormRef, materialListHeightStyle] = useMatchedPanelHeight(`${heightMatchKey}|material`);
  const [workforceFormRef, workforceListHeightStyle] = useMatchedPanelHeight(`${heightMatchKey}|workforce`);
  const [productFormRef, productListHeightStyle] = useMatchedPanelHeight(`${heightMatchKey}|product`);
  const [machineFormRef, machineListHeightStyle] = useMatchedPanelHeight(`${heightMatchKey}|machine`);
  const [equipmentFormRef, equipmentListHeightStyle] = useMatchedPanelHeight(`${heightMatchKey}|equipment`);
  const incomeExpenseChartRef = useRef(null);
  const setIncomeExpenseChartElement = useCallback((node) => {
    incomeExpenseChartRef.current = node;
    setIncomeExpenseChartNode(node);
  }, []);

  const initials = useMemo(() => {
    const source = form.username || form.email || "A";
    return source.slice(0, 2).toUpperCase();
  }, [form.email, form.username]);

  useEffect(() => {
    const nextPath = normalizeRoutePath(window.location.pathname);

    if (nextPath !== window.location.pathname) {
      window.history.replaceState({}, "", nextPath);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = form.language;
  }, [form.language]);

  useEffect(() => {
    const root = document.body;
    let frameId = 0;
    let observer;

    const refreshInfobars = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        observer?.disconnect();
        document.querySelectorAll(".global-term-infobar").forEach((node) => node.remove());
        document.querySelectorAll("[data-term-infobar-applied]").forEach((node) => {
          node.classList.remove("term-with-infobar");
          delete node.dataset.termInfobarApplied;
        });
        applyGlobalTermInfobars(root, form.language);
        observer?.observe(root, { childList: true, subtree: true });
      });
    };

    refreshInfobars();

    observer = new MutationObserver((mutations) => {
      if (mutations.every((mutation) => mutation.target instanceof Element && mutation.target.closest(".info-tip"))) {
        return;
      }
      refreshInfobars();
    });

    observer.observe(root, { childList: true, subtree: true });

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      observer.disconnect();
    };
  }, [form.language, path]);

  useEffect(() => {
    if (path === "/operations/data-entry") {
      setProcessDefinitionOpen(false);
    }
  }, [path]);

  useEffect(() => {
    setIncomeExpenseChartInView(false);
    const chartNode = incomeExpenseChartNode;
    if (!chartNode) return undefined;
    if (!("IntersectionObserver" in window)) {
      setIncomeExpenseChartInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.22) {
          setIncomeExpenseChartInView(true);
          observer.disconnect();
        }
      },
      {
        root: null,
        rootMargin: "0px 0px -14% 0px",
        threshold: [0.22],
      },
    );

    observer.observe(chartNode);
    return () => observer.disconnect();
  }, [incomeExpenseChartNode, path, financialHorizon]);

  useEffect(() => {
    if (!supabase) return;

    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    if (params.get("type") === "recovery") {
      setMode("reset");
    } else {
      setMode("login");
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handlePopState() {
      const currentPath = window.location.pathname;
      const nextPath = normalizeRoutePath(currentPath);

      if (nextPath !== currentPath) {
        window.history.replaceState({}, "", nextPath);
      }

      setPath(nextPath);
      setStatus("");
      setMode("login");
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!session || !supabase) {
      setCurrentProfile(null);
      setAuthorizationAccess({ read: false, write: false });
      setModules([]);
      setRoles([]);
      setProfiles([]);
      return;
    }

    loadAuthorizationData();
  }, [session]);

  useEffect(() => {
    if (session && path === "/login" && mode !== "reset") {
      goTo("/dashboard", "login");
    }
  }, [session, path, mode]);

  useEffect(() => {
    if (!session || !supabase) {
      setOperationsWorkspace({
        activePlans: [],
        equipment: [],
        latestPlan: null,
        machines: [],
        materials: [],
        notes: [],
        product: null,
        products: [],
        workforce: [],
      });
      setOperationPlan(emptyOperationPlan);
      setOperationPlanResult(null);
      setFinancialModel(emptyFinancialModel);
      setFinancialSettingsForm(defaultFinancialSettings);
      setFinancialExtraCostForm(emptyFinancialExtraCostForm);
      setFinancialStatus("");
      setFinancialOverviewWidgets([]);
      setExchangeRates(defaultExchangeRates);
      setSalesStrategy(emptySalesStrategy);
      setSalesStatus("");
      setSimulationVariants([emptySimulationVariant]);
      setSimulationStatus("");
      return;
    }

    loadOperationsData();
    loadFinancialData();
    loadPlanningData();
  }, [session]);

  useEffect(() => {
    if (!supabase || !currentProfile?.company_id) return;

    let isCurrent = true;
    const controller = new AbortController();

    async function loadExchangeRates() {
      try {
        const latestRates = await loadLatestExchangeRatesFromSupabase(supabase, currentProfile.company_id);

        if (!isCurrent) return;

        if (hasUsableExchangeRates(latestRates)) {
          setExchangeRates(latestRates);
          return;
        }

        setExchangeRates((current) => ({ ...current, error: "", status: "loading" }));

        const nextRates = await fetchExchangeRates(controller.signal);

        if (!isCurrent) return;

        let sourceDetail = "Auto fetched";
        try {
          await saveExchangeRatesToSupabase(supabase, currentProfile.company_id, nextRates);
          sourceDetail = "Saved to Supabase";
        } catch (saveError) {
          sourceDetail = isMissingExchangeRatesTableError(saveError) ? "Auto fetched" : `Auto fetched, save failed: ${saveError.message}`;
        }

        setExchangeRates({
          ...nextRates,
          sourceDetail,
        });
      } catch (error) {
        if (!isCurrent || error.name === "AbortError") return;
        setExchangeRates((current) => ({
          ...current,
          error: error.message,
          status: current.status === "idle" ? "error" : current.status,
        }));
      }
    }

    loadExchangeRates();

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [currentProfile?.company_id]);

  function goTo(pathname, nextMode) {
    const nextPath = normalizeRoutePath(pathname);
    window.history.pushState({}, "", nextPath);
    setPath(nextPath);
    setMode(nextMode);
    setStatus("");
  }

  function handleUseAtera() {
    goTo(session ? "/dashboard" : "/login", "login");
  }

  function updateField(field, value) {
    if (field === "language") {
      if (supabase && session?.user?.id) {
        supabase.from("profiles").update({ language: value }).eq("id", session.user.id).then(({ error }) => {
          if (error) console.warn("Language preference could not be saved.", error);
        });
      }
    }
    setForm((current) => ({ ...current, [field]: value }));
  }

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

  function addFinancialLoanRow() {
    setFinancialSettingsForm((current) => ({
      ...current,
      loanRows: [
        ...(Array.isArray(current.loanRows) ? current.loanRows : []),
        {
          amount: "",
          annualInterestRate: "",
          currency: "TRY",
          gracePeriodMonths: 0,
          id: `loan-${Date.now()}`,
          loanTermMonths: "",
          name: "",
          receivedDate: getTodayDateInputValue(),
        },
      ],
    }));
  }

  function updateFinancialLoanRow(index, field, value) {
    setFinancialSettingsForm((current) => {
      const loanRows = Array.isArray(current.loanRows) ? [...current.loanRows] : [];
      loanRows[index] = { ...loanRows[index], [field]: value };

      return { ...current, loanRows };
    });
  }

  function removeFinancialLoanRow(index) {
    setFinancialSettingsForm((current) => ({
      ...current,
      loanRows: (Array.isArray(current.loanRows) ? current.loanRows : []).filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function updateSimulationVariant(id, field, value) {
    setSimulationVariants((current) => current.map((variant) => {
      if (variant.id !== id) return variant;
      const nextVariant = { ...variant, [field]: value };
      if (field === "name") {
        nextVariant.label = value || variant.label;
      }
      return nextVariant;
    }));
  }

  function updateSimulationParameter(id, field, value) {
    setSimulationVariants((current) => current.map((variant) => (
      variant.id === id
        ? { ...variant, parameters: { ...variant.parameters, [field]: value } }
        : variant
    )));
  }

  function addSimulationVariant() {
    const linkedFinancialModel = buildFinancialFeasibilityModel(financialModel, salesStrategy, financialSettingsForModel, operationsWorkspaceForFinance, financialHorizon);
    const linkedSummary = linkedFinancialModel.summary || emptyFinancialModel.summary;
    const horizonMonths = Math.max(1, getProjectionMonthCount(financialHorizon));
    const monthlySalesUnits = Math.round(
      toFiniteNumber(linkedSummary.netSoldUnits) / horizonMonths ||
      getSalesForecastForMonth(salesStrategy, 0),
    );
    const monthlyProductionUnits = Math.max(
      monthlySalesUnits,
      Math.round(toFiniteNumber(linkedSummary.totalProduced) / horizonMonths),
    );
    const unitSalesPrice = toFiniteNumber(
      linkedSummary.averageNetPrice,
      toFiniteNumber(operationsWorkspaceForFinance.product?.price, toFiniteNumber(operationsWorkspaceForFinance.products[0]?.price)),
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
        grossMargin: linkedSummary.salesRevenue ? Math.max(0, Math.round((toFiniteNumber(linkedSummary.netIncome) / toFiniteNumber(linkedSummary.salesRevenue)) * 100)) : 0,
        marketShare: 0,
        reputationScore: 0,
        marketingBudget: 0,
        productionUnits: monthlyProductionUnits,
        returnRatePercent: 0,
        salesUnits: monthlySalesUnits,
        spoilagePercent: 0,
        timeHorizonMonths: horizonMonths,
        unitSalesPrice,
        variableCostRatio: linkedSummary.salesRevenue ? Math.min(95, Math.round((toFiniteNumber(linkedSummary.totalCost) / toFiniteNumber(linkedSummary.salesRevenue)) * 100)) : 0,
      },
    };

    setSimulationVariants((current) => [...current, nextVariant]);
    goTo(nextVariant.path, "login");
  }

  async function deleteSimulationVariant(id) {
    if (id === "current-situation") return;

    setSimulationStatus("");

    if (supabase && currentProfile?.company_id) {
      setSimulationLoading(true);

      try {
        await deleteSimulationVariantRecord(supabase, currentProfile.company_id, id);
        setSimulationStatus(copy("Simulation variant was deleted from Supabase.", "Simülasyon varyantı Supabase'ten silindi."));
      } catch (error) {
        setSimulationStatus(error.message);
      } finally {
        setSimulationLoading(false);
      }
    }

    setSimulationVariants((current) => current.filter((variant) => variant.id !== id));
    if (path === `/simulation/${id}`) goTo("/simulation/current-situation", "login");
  }

  function toggleTheme() {
    setTheme((current) => {
      const nextTheme = current === "dark" ? "light" : "dark";

      if (supabase && session?.user?.id) {
        supabase.from("profiles").update({ theme: nextTheme }).eq("id", session.user.id).then(({ error }) => {
          if (error) console.warn("Theme preference could not be saved.", error);
        });
      }

      return nextTheme;
    });
  }

  function ThemeToggle() {
    const isDark = theme === "dark";

    return (
      <button
        type="button"
        className="theme-toggle"
        aria-label={isDark ? labels.themeLight : labels.themeDark}
        onClick={toggleTheme}
      >
        <span>{isDark ? labels.light : labels.dark}</span>
      </button>
    );
  }

  function updateRoleForm(field, value) {
    setRoleForm((current) => ({ ...current, [field]: value }));
  }

  function updateManagedUserForm(field, value) {
    setManagedUserForm((current) => ({ ...current, [field]: value }));
  }

  function updateFinanceDateRange(field, value) {
    setFinanceDateRange((current) => ({ ...current, [field]: value }));
    setFinanceWindow("custom");
  }

  function handleDashboardProductChange(productId) {
    const nextProduct = operationsWorkspace.products.find((product) => product.id === productId) || operationsWorkspace.products[0] || null;
    const nextLatestPlan = nextProduct
      ? operationsWorkspace.activePlans.find((plan) => getPlanProductId(plan) === nextProduct.id) || null
      : null;

    setOperationsWorkspace((current) => ({
      ...current,
      latestPlan: nextLatestPlan || current.latestPlan,
      product: nextProduct,
    }));
    setOperationPlan((plan) => ({
      ...plan,
      ...getProductFlowDefaults(nextProduct),
      productId: nextProduct?.id || "",
      productName: nextProduct?.name || "",
    }));
    setOperationPlanResult(nextLatestPlan?.result || null);
  }

  async function handleFetchExchangeRates() {
    setExchangeRates((current) => ({ ...current, error: "", status: "loading" }));

    try {
      const nextRates = await fetchExchangeRates();
      let sourceDetail = "";
      if (supabase && currentProfile?.company_id) {
        try {
          await saveExchangeRatesToSupabase(supabase, currentProfile.company_id, nextRates);
          sourceDetail = "Saved to Supabase";
        } catch (saveError) {
          sourceDetail = isMissingExchangeRatesTableError(saveError) ? "" : `Save failed: ${saveError.message}`;
        }
      }
      setExchangeRates({
        ...nextRates,
        sourceDetail,
      });
    } catch (error) {
      setExchangeRates((current) => ({
        ...current,
        error: error.message,
        status: "error",
      }));
    }
  }

  function updateOperationPlan(field, value) {
    setOperationPlan((current) => ({ ...current, [field]: value }));
  }

  function normalizeFlowStrategy(value) {
    return ["batch", "flow", "parallel"].includes(value) ? value : "flow";
  }

  function getProductFlowDefaults(product) {
    const minimumTransferQuantity = Math.max(
      1,
      toFiniteNumber(product?.minimum_transfer_quantity ?? product?.minimumTransferQuantity, 1),
    );
    const defaultBatchSize = Math.max(
      minimumTransferQuantity,
      toFiniteNumber(product?.default_batch_size ?? product?.defaultBatchSize, minimumTransferQuantity),
    );

    return {
      batchSize: defaultBatchSize,
      flowStrategy: normalizeFlowStrategy(product?.default_flow_strategy ?? product?.defaultFlowStrategy),
      minimumTransferQuantity,
    };
  }

  function getOperationMachineDefaults(machineId, sourceMachines = operationsWorkspace.machines) {
    const machine = sourceMachines.find((item) => item.id === machineId);

    return {
      capacity: Math.max(1, toFiniteNumber(machine?.concurrent_capacity, 1)),
      dailyHours: Math.max(0, toFiniteNumber(machine?.availability_hours, 8)),
      failureProbabilityPercent: Math.max(0, toFiniteNumber(machine?.failure_probability_percent, 0)),
      speedMultiplier: Math.max(0.0001, toFiniteNumber(machine?.speed_multiplier, 1)),
    };
  }

  function buildDefaultOperationRow(index = 0, machine, product, sourceMachines = operationsWorkspace.machines) {
    const selectedMachine = machine || sourceMachines[index] || sourceMachines[0];
    const machineDefaults = getOperationMachineDefaults(selectedMachine?.id, sourceMachines);

    return {
      ...emptyPlanRows.operation,
      ...machineDefaults,
      machineId: selectedMachine?.id || "",
      operationName: `${copy("Operation", "Operasyon")} ${index + 1}`,
      processTimeMinutes: Math.max(0.0001, toFiniteNumber(product?.cycle_time_minutes, 1)),
    };
  }

  function buildDefaultOperationRows(product, machines = operationsWorkspace.machines) {
    return machines.slice(0, Math.min(2, Math.max(1, machines.length))).map((machine, index) => (
      buildDefaultOperationRow(index, machine, product, machines)
    ));
  }

  function getProductProcessNames(product) {
    const source = [
      product?.processes_required,
      product?.processes,
      product?.process_steps,
      product?.process_names,
    ].find((value) => Array.isArray(value) && value.length);

    return (Array.isArray(source) ? source : []).map((entry) => (
      typeof entry === "string"
        ? entry
        : (entry.name || entry.process_name || entry.operationName || entry.label || "")
    )).filter(Boolean);
  }

  function getSavedOperationRowsForProduct(productId) {
    if (!productId) return [];

    const savedPlan = [
      operationsWorkspace.latestPlan,
      ...asObjectArray(operationsWorkspace.activePlans),
    ].find((plan) => getPlanProductId(plan) === productId);
    const inputRows = asObjectArray(savedPlan?.input?.operationRows);

    if (inputRows.length) return inputRows;

    return asObjectArray(savedPlan?.result?.operationRows).map((row, index) => ({
      ...row,
      operationName: row.operationName || row.name || `${copy("Process", "Süreç")} ${index + 1}`,
    }));
  }

  function getRecipeMaterialId(row) {
    return row?.material_id || row?.materialId || row?.material?.id || "";
  }

  function enrichOperationRowsForProduct(rows, product) {
    const productMaterials = asObjectArray(product?.material_rows);
    const productProcessNames = getProductProcessNames(product);
    const planWorkforceRows = asObjectArray(operationPlan.workforceRows);

    return asObjectArray(rows).map((row, index) => {
      const defaultRow = buildDefaultOperationRow(
        index,
        operationsWorkspace.machines[index] || operationsWorkspace.machines[0],
        product,
      );
      const materialRow = productMaterials[index % Math.max(productMaterials.length, 1)] || productMaterials[0] || {};
      const workforceRow = planWorkforceRows[index] || {};

      return {
        ...defaultRow,
        ...row,
        equipmentId: row.equipmentId || row.equipment_id || "",
        materialId: row.materialId || row.material_id || getRecipeMaterialId(materialRow),
        materialQuantityPerUnit: row.materialQuantityPerUnit ?? row.quantityPerUnit ?? materialRow.quantity_per_unit ?? "",
        operationId: row.operationId || row.id || `${product?.id || "product"}-process-${index + 1}`,
        operationName: row.operationName || row.name || productProcessNames[index] || `${copy("Process", "Süreç")} ${index + 1}`,
        peopleAssigned: row.peopleAssigned ?? workforceRow.peopleAssigned ?? 1,
        workforceDailyHours: row.workforceDailyHours ?? workforceRow.dailyHours ?? row.dailyHours ?? defaultRow.dailyHours,
        workforceId: row.workforceId || row.workforce_id || workforceRow.workforceId || operationsWorkspace.workforce[index]?.id || operationsWorkspace.workforce[0]?.id || "",
      };
    });
  }

  function buildProductOperationRows(product, preferredRows = []) {
    if (!product) return [];

    const currentRows = asObjectArray(preferredRows);
    if (currentRows.length) return enrichOperationRowsForProduct(currentRows, product);

    const savedRows = getSavedOperationRowsForProduct(product.id);
    if (savedRows.length) return enrichOperationRowsForProduct(savedRows, product);

    const productProcessNames = getProductProcessNames(product);
    if (productProcessNames.length) {
      return enrichOperationRowsForProduct(productProcessNames.map((name, index) => ({
        ...buildDefaultOperationRow(index, operationsWorkspace.machines[index] || operationsWorkspace.machines[0], product),
        operationName: name,
      })), product);
    }

    return enrichOperationRowsForProduct(buildDefaultOperationRows(product, operationsWorkspace.machines), product);
  }

  function updateOperationPlanRow(collection, index, field, value) {
    setOperationPlan((current) => ({
      ...current,
      [collection]: (current[collection] || []).map((row, rowIndex) => (
        rowIndex === index
          ? {
              ...row,
              ...(collection === "operationRows" && field === "machineId" ? getOperationMachineDefaults(value) : {}),
              [field]: value,
            }
          : row
      )),
    }));
  }

  function updateOperationPlanRowFields(collection, index, fields) {
    setOperationPlan((current) => ({
      ...current,
      [collection]: (current[collection] || []).map((row, rowIndex) => (
        rowIndex === index ? { ...row, ...fields } : row
      )),
    }));
  }

  function addOperationPlanRow(collection, row) {
    setOperationPlan((current) => ({
      ...current,
      [collection]: [...(current[collection] || []), row],
    }));
  }

  function removeOperationPlanRow(collection, index) {
    setOperationPlan((current) => ({
      ...current,
      [collection]: (current[collection] || []).filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function updateOperationForm(entity, field, value) {
    setOperationForms((current) => ({
      ...current,
      [entity]: {
        ...current[entity],
        [field]: value,
      },
    }));
  }

  function copyOperationRecordToForm(entity, row) {
    if (!row || row.id === "empty") return;

    const nextForm = {
      machine: {
        ...emptyOperationForms.machine,
        availabilityHours: row.availability_hours ?? emptyOperationForms.machine.availabilityHours,
        concurrentCapacity: row.concurrent_capacity ?? emptyOperationForms.machine.concurrentCapacity,
        failureProbabilityPercent: row.failure_probability_percent ?? emptyOperationForms.machine.failureProbabilityPercent,
        hourlyEnergyConsumptionKwh: row.hourly_energy_consumption_kwh ?? emptyOperationForms.machine.hourlyEnergyConsumptionKwh,
        name: row.name || "",
        price: row.price ?? emptyOperationForms.machine.price,
        priceCurrency: row.price_currency || emptyOperationForms.machine.priceCurrency,
        speedMultiplier: row.speed_multiplier ?? emptyOperationForms.machine.speedMultiplier,
      },
      equipment: {
        ...emptyOperationForms.equipment,
        name: row.name || "",
        price: row.price ?? emptyOperationForms.equipment.price,
        priceCurrency: row.price_currency || emptyOperationForms.equipment.priceCurrency,
        quantity: row.quantity ?? emptyOperationForms.equipment.quantity,
      },
      material: {
        ...emptyOperationForms.material,
        name: row.name || "",
        pricePerUnit: row.price_per_unit ?? emptyOperationForms.material.pricePerUnit,
        priceCurrency: row.price_currency || emptyOperationForms.material.priceCurrency,
        unit: row.unit || emptyOperationForms.material.unit,
      },
      workforce: {
        ...emptyOperationForms.workforce,
        hourlyCost: row.hourly_cost ?? emptyOperationForms.workforce.hourlyCost,
        hourlyCostCurrency: row.hourly_cost_currency || emptyOperationForms.workforce.hourlyCostCurrency,
        roleName: row.role_name || "",
      },
    }[entity];

    if (!nextForm) return;

    setOperationForms((current) => ({
      ...current,
      [entity]: nextForm,
    }));
    setOperationsStatus(copy("Record values were copied into the form. Edit and save to create a new record.", "Kayıt değerleri forma kopyalandı. Yeni kayıt oluşturmak için düzenleyip kaydedin."));
  }

  function addProductMaterialRow() {
    setOperationForms((current) => ({
      ...current,
      product: {
        ...current.product,
        materialRows: [
          ...(current.product.materialRows || []),
          {
            materialId: operationsWorkspace.materials[0]?.id || "",
            quantityPerUnit: 0,
          },
        ],
      },
    }));
  }

  function updateProductMaterialRow(index, field, value) {
    setOperationForms((current) => ({
      ...current,
      product: {
        ...current.product,
        materialRows: (current.product.materialRows || []).map((row, rowIndex) => (
          rowIndex === index ? { ...row, [field]: value } : row
        )),
      },
    }));
  }

  function removeProductMaterialRow(index) {
    setOperationForms((current) => ({
      ...current,
      product: {
        ...current.product,
        materialRows: (current.product.materialRows || []).filter((_, rowIndex) => rowIndex !== index),
      },
    }));
  }

  async function loadOperationsData() {
    if (!supabase) return;

    setOperationsLoading(true);
    setOperationsStatus("");

    try {
      const workspace = await loadOperationsWorkspace(supabase);
      const currentPlans = getCurrentOperationPlans(workspace);
      const currentLatestPlan = currentPlans.find((plan) => plan.id === workspace.latestPlan?.id) || currentPlans[0] || null;
      setOperationsWorkspace(workspace);

      if (workspace.latestPlan) {
        const savedMachineRows = asObjectArray(workspace.latestPlan.input?.machineRows);
        const savedMaterialRows = asObjectArray(workspace.latestPlan.input?.materialRows);
        const savedOperationRows = asObjectArray(workspace.latestPlan.input?.operationRows);
        const savedWorkforceRows = asObjectArray(workspace.latestPlan.input?.workforceRows);
        const hasSimplePlanResult = currentLatestPlan?.result?.energyConsumptionKwh !== undefined;

        setOperationPlan({
          ...emptyOperationPlan,
          ...getProductFlowDefaults(workspace.product),
          ...workspace.latestPlan.input,
          machineRows: savedMachineRows.length
            ? savedMachineRows.map((row) => ({
                dailyHours: row.dailyHours || 0,
                machineId: row.machineId || "",
              }))
            : (workspace.machines[0]
                ? [{ ...emptyPlanRows.machine, machineId: workspace.machines[0].id }]
                : []),
          materialRows: savedMaterialRows.length
            ? savedMaterialRows.map((row) => ({
                dailyQuantity: row.dailyQuantity ?? row.quantityPerUnit ?? 0,
                materialId: row.materialId || "",
              }))
            : workspace.materials.slice(0, 2).map((material) => ({
                dailyQuantity: 0,
                materialId: material.id,
              })),
          productId: workspace.latestPlan.input?.productId || workspace.product?.id || "",
          productName: workspace.latestPlan.input?.productName || workspace.product?.name || "",
          operationRows: savedOperationRows.length
            ? savedOperationRows.map((row, index) => ({
                ...emptyPlanRows.operation,
                ...row,
                operationName: row.operationName || row.name || `${copy("Operation", "Operasyon")} ${index + 1}`,
              }))
            : buildDefaultOperationRows(workspace.product, workspace.machines),
          workforceRows: savedWorkforceRows.length
            ? savedWorkforceRows
            : (workspace.workforce[0]
                ? [{ ...emptyPlanRows.workforce, workforceId: workspace.workforce[0].id }]
                : []),
        });
        setOperationPlanResult(hasSimplePlanResult ? currentLatestPlan.result : null);
      } else if (workspace.product) {
        setOperationPlan((current) => ({
          ...current,
          ...getProductFlowDefaults(workspace.product),
          machineRows: workspace.machines[0]
            ? [{ ...emptyPlanRows.machine, machineId: workspace.machines[0].id }]
            : [],
          materialRows: workspace.materials.length
            ? workspace.materials.slice(0, 2).map((material) => ({
                dailyQuantity: 0,
                materialId: material.id,
              }))
            : [],
          productId: workspace.product.id,
          productName: workspace.product.name || "",
          operationRows: buildDefaultOperationRows(workspace.product, workspace.machines),
          workforceRows: workspace.workforce[0]
            ? [{ ...emptyPlanRows.workforce, workforceId: workspace.workforce[0].id }]
            : [],
        }));
        setOperationPlanResult(null);
      }
    } catch (error) {
      setOperationsStatus(`${copy("Operations data could not be loaded:", "Operations verisi yüklenemedi:")} ${error.message}`);
    } finally {
      setOperationsLoading(false);
    }
  }

  async function handleSaveOperationPlan(event) {
    event.preventDefault();
    setOperationsStatus("");

    if (!supabase) {
      setOperationsStatus(labels.configure);
      return;
    }

    const selectedProduct = operationsWorkspace.products.find((product) => product.id === operationPlan.productId);
    const machineRows = asObjectArray(operationPlan.machineRows);
    const operationRows = asObjectArray(operationPlan.operationRows);
    const operationWorkforceRows = buildWorkforceRowsFromOperationRows(operationRows);
    const effectiveWorkforceRows = operationWorkforceRows.length
      ? operationWorkforceRows
      : asObjectArray(operationPlan.workforceRows);
    const productRecipeRows = asObjectArray(selectedProduct?.material_rows);
    const hasPositiveMachineHours = machineRows.some((row) => row.machineId && toFiniteNumber(row.dailyHours) > 0);
    const hasSchedulableOperationRows = operationRows.some((row) => (
      row.machineId &&
      toFiniteNumber(row.processTimeMinutes) > 0 &&
      toFiniteNumber(row.capacity, 1) > 0
    ));

    if (!selectedProduct) {
      setOperationsStatus(copy("Select a saved product with a recipe before calculating feasibility.", "Fizibilite hesaplamadan önce reçetesi olan kayıtlı bir ürün seçin."));
      return;
    }

    if (!productRecipeRows.some((row) => toFiniteNumber(row.quantity_per_unit) > 0)) {
      setOperationsStatus(copy("Add at least one material with a positive quantity to the selected product recipe before saving a process plan.", "Süreç planını kaydetmeden önce seçili ürün reçetesine pozitif miktarlı en az bir malzeme ekleyin."));
      return;
    }

    if (!hasPositiveMachineHours && !hasSchedulableOperationRows) {
      setOperationsStatus(copy("Add at least one machine with daily hours, or define an operation step with a machine and process time.", "Günlük saati olan en az bir makine ekleyin ya da makine ve işlem süresi olan bir operasyon adımı tanımlayın."));
      return;
    }

    if (hasSchedulableOperationRows && toFiniteNumber(operationPlan.targetQuantity) <= 0) {
      setOperationsStatus(copy("Enter a production quantity greater than zero for the operation flow.", "Operasyon akışı için sıfırdan büyük üretim miktarı girin."));
      return;
    }

    setOperationsLoading(true);

    try {
      const savedPlan = await saveOperationResourcePlan(supabase, {
        ...operationPlan,
        workforceRows: effectiveWorkforceRows,
      });

      setOperationPlan({ ...emptyOperationPlan, ...savedPlan.input });
      setOperationPlanResult(savedPlan.result);
      setOperationsStatus(copy(
        "Resource plan was saved to Supabase and calculated by the backend function.",
        "Kaynak planı Supabase veritabanına kaydedildi ve backend fonksiyonunda hesaplandı.",
      ));
      await loadOperationsData();
      await loadFinancialData();
    } catch (error) {
      setOperationsStatus(error.message);
    } finally {
      setOperationsLoading(false);
    }
  }

  async function handleSaveOperationRecord(entity, event) {
    event.preventDefault();
    setOperationsStatus("");

    if (!supabase) {
      setOperationsStatus(labels.configure);
      return;
    }

    setOperationsLoading(true);

    try {
      const formInput = operationForms[entity];
      const recordInput = entity === "product"
        ? {
            ...formInput,
            cycleTimeMinutes: getCycleTimeMinutes(formInput.cycleTimeValue, formInput.cycleTimeUnit),
            cycleTimeUnit: normalizeCycleTimeUnit(formInput.cycleTimeUnit),
            productId: formInput.id || "",
          }
        : formInput;

      await saveOperationRecord(supabase, entity, {
        ...recordInput,
        productId: entity === "product" ? recordInput.productId : operationPlan.productId || operationsWorkspace.product?.id,
      });

      setOperationForms((current) => ({ ...current, [entity]: emptyOperationForms[entity] }));
      setOperationsStatus(copy("Operations record was saved to Supabase.", "Operations kaydı Supabase veritabanına kaydedildi."));
      await loadOperationsData();
    } catch (error) {
      setOperationsStatus(error.message);
    } finally {
      setOperationsLoading(false);
    }
  }

  async function loadFinancialData(nextHorizon = financialHorizon) {
    if (!supabase) return;

    setFinancialHorizon(nextHorizon);
    setFinancialLoading(true);
    setFinancialStatus("");

    try {
      const nextModel = await loadFinancialModel(supabase, nextHorizon);
      const nextSettings = {
        ...defaultFinancialSettings,
        ...(nextModel.settings || {}),
      };
      const loadedLoanRows = Array.isArray(nextSettings.loanRows) && nextSettings.loanRows.length
        ? nextSettings.loanRows
        : getFinancialLoanRows(nextSettings);
      const loanRowsForForm = loadedLoanRows.length ? loadedLoanRows : createDemoFinancialLoanRows();

      setFinancialModel(nextModel);
      setFinancialSettingsForm({
        ...nextSettings,
        loanRows: loanRowsForForm,
      });
    } catch (error) {
      setFinancialStatus(`${copy("Financial model could not be loaded:", "Finansal model yüklenemedi:")} ${error.message}`);
    } finally {
      setFinancialLoading(false);
    }
  }

  async function handleSaveFinancialSettings(event) {
    event.preventDefault();
    setFinancialStatus("");

    if (!supabase) {
      setFinancialStatus(labels.configure);
      return;
    }

    setFinancialLoading(true);

    try {
      await saveFinancialModelSettings(supabase, financialSettingsForm);
      setFinancialStatus(copy("Financial assumptions were saved to Supabase.", "Finansal varsayımlar Supabase'e kaydedildi."));
      await loadFinancialData();
    } catch (error) {
      setFinancialStatus(error.message);
    } finally {
      setFinancialLoading(false);
    }
  }

  function toggleFinancialOverviewWidget(widgetId) {
    setFinancialOverviewWidgets((current) => (
      current.includes(widgetId)
        ? current.filter((id) => id !== widgetId)
        : [...current, widgetId]
    ));
  }

  async function saveFinancialOverviewScreen() {
    setFinancialStatus("");

    if (!supabase || !session?.user?.id) {
      setFinancialStatus(labels.configure);
      return;
    }

    setFinancialLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ financial_overview_widgets: financialOverviewWidgets })
        .eq("id", session.user.id);

      if (error) throw error;

      setCurrentProfile((current) => current ? { ...current, financial_overview_widgets: financialOverviewWidgets } : current);
      setFinancialStatus(copy("Financial analysis screen was saved.", "Finansal analiz ekranı kaydedildi."));
    } catch (error) {
      setFinancialStatus(error.message);
    } finally {
      setFinancialLoading(false);
    }
  }

  async function handleSaveFinancialExtraCost(event) {
    event.preventDefault();
    setFinancialStatus("");

    if (!supabase) {
      setFinancialStatus(labels.configure);
      return;
    }

    setFinancialLoading(true);

    try {
      await saveFinancialExtraCost(supabase, financialExtraCostForm);
      setFinancialExtraCostForm(emptyFinancialExtraCostForm);
      setFinancialStatus(copy("Extra financial cost was saved to Supabase.", "Ek finansal gider Supabase'e kaydedildi."));
      await loadFinancialData();
    } catch (error) {
      setFinancialStatus(error.message);
    } finally {
      setFinancialLoading(false);
    }
  }

  async function loadPlanningData() {
    if (!supabase) return;

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
    } catch (error) {
      setSalesStatus(`${copy("Planning data could not be loaded:", "Planlama verisi yüklenemedi:")} ${error.message}`);
      setSimulationStatus(`${copy("Planning data could not be loaded:", "Planlama verisi yüklenemedi:")} ${error.message}`);
    } finally {
      setSalesLoading(false);
      setSimulationLoading(false);
    }
  }

  async function handleSaveSalesStrategy() {
    setSalesStatus("");

    if (!supabase) {
      setSalesStatus(labels.configure);
      return;
    }

    if (!currentProfile?.company_id) {
      setSalesStatus(copy("Company profile is still loading.", "Şirket profili henüz yükleniyor."));
      return;
    }

    const validationMessage = validateSalesStrategy();
    if (validationMessage) {
      setSalesStatus(validationMessage);
      return;
    }

    setSalesLoading(true);

    try {
      await saveSalesStrategy(supabase, currentProfile.company_id, salesStrategy);
      await loadPlanningData();
      setSalesStatus(copy("Sales strategy was saved to Supabase.", "Satış stratejisi Supabase'e kaydedildi."));
    } catch (error) {
      setSalesStatus(error.message);
    } finally {
      setSalesLoading(false);
    }
  }

  async function persistSimulationVariant(variant) {
    setSimulationStatus("");

    if (!supabase) {
      setSimulationStatus(labels.configure);
      return;
    }

    if (!currentProfile?.company_id) {
      setSimulationStatus(copy("Company profile is still loading.", "Şirket profili henüz yükleniyor."));
      return;
    }

    setSimulationLoading(true);

    try {
      await saveSimulationVariant(supabase, currentProfile.company_id, variant);
      await loadPlanningData();
      setSimulationStatus(copy("Simulation variant was saved to Supabase.", "Simülasyon varyantı Supabase'e kaydedildi."));
    } catch (error) {
      setSimulationStatus(error.message);
    } finally {
      setSimulationLoading(false);
    }
  }

  async function handleCreateOperationNote() {
    setOperationsStatus("");

    if (!supabase) {
      setOperationsStatus(labels.configure);
      return;
    }

    if (!operationsWorkspace.product?.id) {
      setOperationsStatus(copy("Select or create a product before adding notes.", "Not eklemeden önce bir ürün seçin veya oluşturun."));
      return;
    }

    const note = window.prompt(copy("New product note", "Yeni ürün notu"))?.trim();
    if (!note) return;

    setOperationsLoading(true);
    try {
      const { error } = await supabase.from("operation_notes").insert({
        created_by: session?.user?.id,
        note,
        product_id: operationsWorkspace.product.id,
      });

      if (error) throw error;
      await loadOperationsData();
      setOperationsStatus(copy("Product note was saved.", "Ürün notu kaydedildi."));
    } catch (error) {
      setOperationsStatus(error.message);
    } finally {
      setOperationsLoading(false);
    }
  }

  function openFactoryMapFullscreen() {
    const target = document.querySelector(".factory-map-card");
    if (target?.requestFullscreen) {
      target.requestFullscreen().catch((error) => setOperationsStatus(error.message));
    }
  }

  function focusOperationFlow() {
    document.querySelector(".operation-flow")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function exportReportsCsv(rows) {
    const reportRows = rows.length ? rows : [[copy("No report snapshots yet", "Henüz rapor anlık görünümü yok"), copy("Input required", "Girdi gerekli"), "-", "-", currentProfile?.username || currentProfile?.email || "Atera"]];
    const header = [copy("Report Name", "Rapor Adı"), copy("Category", "Kategori"), copy("Created Date", "Oluşturulma Tarihi"), copy("Period", "Dönem"), copy("Created By", "Oluşturan")];
    const escapeCell = (cell) => `"${String(cell ?? "").replaceAll("\"", "\"\"")}"`;
    const csv = [header, ...reportRows].map((row) => row.map(escapeCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `atera-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadReportPlaceholder(report, format) {
    const extension = format.extension || format.key;
    const fileSafeName = `${report.key || "report"}-${new Date().toISOString().slice(0, 10)}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    const body = [
      "Atera report export placeholder",
      `Report: ${report.label || report.title}`,
      `Format: ${format.label}`,
      `Period: ${periodLabel}`,
      `Created by: ${currentProfile?.username || currentProfile?.email || "Atera"}`,
      "",
      "Real PDF/XLSX/PPTX generation will be connected later. This file is downloaded locally only and is not saved to the database.",
    ].join("\n");
    const blob = new Blob([body], { type: format.mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileSafeName}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function normalizeRole(role) {
    const permissions = {};

    for (const permission of role.role_permissions || []) {
      const moduleKey = permission.module?.module_key;
      if (!moduleKey) continue;

      permissions[moduleKey] = {
        id: permission.id,
        moduleId: permission.module_id,
        canRead: permission.can_read,
        canWrite: permission.can_write,
      };
    }

    return { ...role, permissions };
  }

  async function loadAuthorizationData() {
    if (!supabase || !session) return;

    setAuthorizationLoading(true);
    setAuthorizationStatus("");

    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*, company:companies(name)")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;

      setCurrentProfile(profile);
      setProfilePreview(profile?.profile_picture_url ? await resolveProfilePicturePreview(profile.profile_picture_url) : "");
      if (profile?.language && ["en", "tr"].includes(profile.language)) {
        setForm((current) => ({ ...current, language: profile.language }));
      }
      if (profile?.theme && ["light", "dark"].includes(profile.theme)) {
        setTheme(profile.theme);
      }
      setFinancialOverviewWidgets(Array.isArray(profile?.financial_overview_widgets) ? profile.financial_overview_widgets : []);

      const [{ data: canRead }, { data: canWrite }] = await Promise.all([
        supabase.rpc("has_module_permission", { p_module_key: "authorization", p_permission: "read" }),
        supabase.rpc("has_module_permission", { p_module_key: "authorization", p_permission: "write" }),
      ]);

      const nextAccess = { read: Boolean(canRead), write: Boolean(canWrite) };
      setAuthorizationAccess(nextAccess);

      if (!nextAccess.read) {
        setModules([]);
        setRoles([]);
        setProfiles([]);
        return;
      }

      const [
        { data: moduleRows, error: modulesError },
        { data: roleRows, error: rolesError },
        { data: profileRows, error: profilesError },
      ] = await Promise.all([
        supabase.from("app_modules").select("id, module_key, name").order("name"),
        supabase
          .from("company_roles")
          .select("id, name, description, is_system, role_permissions(id, module_id, can_read, can_write, module:app_modules(id, module_key, name))")
          .order("is_system", { ascending: false })
          .order("name"),
        supabase
          .from("profiles")
          .select("id, username, email, phone_number, department, access_level, language, theme, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (modulesError) throw modulesError;
      if (rolesError) throw rolesError;
      if (profilesError) throw profilesError;

      setModules(moduleRows || []);
      setRoles((roleRows || []).map(normalizeRole));
      setProfiles(profileRows || []);
    } catch (error) {
      setAuthorizationStatus(`${labels.loadAuthorizationError} ${error.message}`);
      setAuthorizationAccess({ read: false, write: false });
      setModules([]);
      setRoles([]);
      setProfiles([]);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  async function handleCreateRole(event) {
    event.preventDefault();
    setAuthorizationStatus("");

    if (!supabase || !currentProfile?.company_id || !authorizationAccess.write) return;

    const nextName = roleForm.name.trim().toLowerCase();
    if (!nextName) return;
    if (isAdminRole(nextName)) {
      setAuthorizationStatus(copy("Admin role is managed by the system and cannot be recreated or edited here.", "Admin rolü sistem tarafından yönetilir; burada yeniden oluşturulamaz veya düzenlenemez."));
      return;
    }

    setAuthorizationLoading(true);
    try {
      const { data: role, error: roleError } = await supabase
        .from("company_roles")
        .insert({
          company_id: currentProfile.company_id,
          name: nextName,
          description: roleForm.description.trim() || null,
        })
        .select("id")
        .single();

      if (roleError) throw roleError;

      if (modules.length) {
        const { error: permissionError } = await supabase.from("role_permissions").insert(
          modules.map((module) => ({
            role_id: role.id,
            module_id: module.id,
            can_read: false,
            can_write: false,
          })),
        );

        if (permissionError) throw permissionError;
      }

      setRoleForm(emptyRoleForm);
      await loadAuthorizationData();
    } catch (error) {
      setAuthorizationStatus(error.message);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  async function updatePermission(role, module, field, checked) {
    if (!supabase || !authorizationAccess.write) return;
    if (isAdminRole(role)) return;

    const existing = role.permissions[module.module_key];
    const nextPermission = {
      can_read: field === "can_read" ? checked : Boolean(existing?.canRead),
      can_write: field === "can_write" ? checked : Boolean(existing?.canWrite),
    };

    setAuthorizationLoading(true);
    setAuthorizationStatus("");

    try {
      const payload = {
        role_id: role.id,
        module_id: module.id,
        ...nextPermission,
      };

      const query = existing?.id
        ? supabase.from("role_permissions").update(nextPermission).eq("id", existing.id)
        : supabase.from("role_permissions").insert(payload);

      const { error } = await query;
      if (error) throw error;

      await loadAuthorizationData();
    } catch (error) {
      setAuthorizationStatus(error.message);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  async function handleCreateManagedUser(event) {
    event.preventDefault();
    setAuthorizationStatus("");

    if (!supabase || !currentProfile?.company?.name || !authorizationAccess.write) return;

    setAuthorizationLoading(true);
    try {
      const adminSession = session;
      const { data, error } = await supabase.auth.signUp({
        email: managedUserForm.email.trim(),
        password: managedUserForm.password,
        options: {
          data: {
            username: managedUserForm.username.trim(),
            phone_number: managedUserForm.phoneNumber.trim(),
            company: currentProfile.company.name,
            department: managedUserForm.department.trim(),
            access_level: managedUserForm.accessLevel,
            language: managedUserForm.language,
            theme,
          },
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error(labels.missingUser);

      if (data.session && adminSession?.access_token && adminSession?.refresh_token) {
        const { error: restoreError } = await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });

        if (restoreError) throw restoreError;
        setSession(adminSession);
      }

      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({
          access_level: managedUserForm.accessLevel,
          department: managedUserForm.department.trim(),
          language: managedUserForm.language,
          phone_number: managedUserForm.phoneNumber.trim(),
          theme,
        })
        .eq("id", data.user.id);

      if (profileUpdateError) throw profileUpdateError;

      setManagedUserForm({ ...emptyManagedUserForm, language: form.language });
      await loadAuthorizationData();
      setAuthorizationStatus(labels.userCreated);
    } catch (error) {
      setAuthorizationStatus(error.message);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  async function resolveProfilePicturePreview(storageValue) {
    if (!storageValue || !supabase) return "";
    if (/^https?:\/\//i.test(storageValue)) return storageValue;

    const { data, error } = await supabase.storage
      .from("profile-pictures")
      .createSignedUrl(storageValue, 60 * 60);

    if (error) {
      console.warn("Profile picture preview could not be signed.", error);
      return "";
    }

    return data?.signedUrl || "";
  }

  async function handleLogin(event) {
    event.preventDefault();
    setStatus("");

    if (!supabase) {
      setStatus(labels.configure);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });

      if (error) throw error;

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("profile_picture_url, language, theme")
        .single();

      setProfilePreview(userProfile?.profile_picture_url ? await resolveProfilePicturePreview(userProfile.profile_picture_url) : "");
      if (userProfile?.language && ["en", "tr"].includes(userProfile.language)) {
        setForm((current) => ({ ...current, language: userProfile.language }));
      }
      if (userProfile?.theme && ["light", "dark"].includes(userProfile.theme)) {
        setTheme(userProfile.theme);
      }
      goTo(path && !["/", "/login"].includes(path) ? path : "/dashboard", "login");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setStatus("");

    if (!supabase) {
      setStatus(labels.configure);
      return;
    }

    const resetEmail = form.email || window.prompt(labels.forgotEmailPrompt)?.trim();

    if (!resetEmail) {
      setStatus(labels.needEmail);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/login`,
    });

    setStatus(error ? error.message : labels.resetSent);
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setStatus("");

    if (!supabase) {
      setStatus(labels.configure);
      return;
    }

    if (form.password.length < 6) {
      setStatus(labels.passwordTooShort);
      return;
    }

    if (form.password !== confirmPassword) {
      setStatus(labels.passwordMismatch);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: form.password });
    setLoading(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus(labels.passwordUpdated);
    goTo("/login", "login");
    updateField("password", "");
    setConfirmPassword("");
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    goTo("/login", "login");
  }

  const updateTableControl = (tableId, patch) => {
    setTableControls((current) => ({
      ...current,
      [tableId]: {
        ...(current[tableId] || {}),
        ...patch,
      },
    }));
  };

  const getNextTableSortPatch = (control, key) => {
    if (control.sortKey !== key) {
      return { direction: "asc", sortKey: key };
    }

    if (control.direction === "asc") {
      return { direction: "desc", sortKey: key };
    }

    return { direction: undefined, sortKey: undefined };
  };

  const getTableColumnKey = (column, index) => column.key || column.header || `column-${index}`;

  const getTableCellValue = (column, row) => {
    if (column.value) return column.value(row);
    if (column.sortValue) return column.sortValue(row);
    if (column.filterValue) return column.filterValue(row);
    if (column.render) return column.render(row);
    return "";
  };

  const normalizeTableValue = (value) => {
    if (value == null || value === false) return "";
    if (typeof value === "number") return value;
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(normalizeTableValue).join(" ");
    if (React.isValidElement(value)) return "";
    return String(value);
  };

  const getSortableTableRows = (tableId, rows, columns) => {
    const control = tableControls[tableId] || {};
    const query = normalizeGlossaryText(control.query || "");
    const filteredRows = rows.filter((row) => {
      if (!query) return true;

      return columns.some((column) => {
        const rawValue = column.filterValue ? column.filterValue(row) : getTableCellValue(column, row);
        return normalizeGlossaryText(normalizeTableValue(rawValue)).includes(query);
      });
    });

    if (!control.sortKey) return filteredRows;

    const column = columns.find((item, index) => getTableColumnKey(item, index) === control.sortKey);
    if (!column || column.sortable === false) return filteredRows;

    const direction = control.direction === "desc" ? -1 : 1;
    return [...filteredRows].sort((leftRow, rightRow) => {
      const leftValue = normalizeTableValue(column.sortValue ? column.sortValue(leftRow) : getTableCellValue(column, leftRow));
      const rightValue = normalizeTableValue(column.sortValue ? column.sortValue(rightRow) : getTableCellValue(column, rightRow));

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * direction;
      }

      return String(leftValue).localeCompare(String(rightValue), locale, { numeric: true, sensitivity: "base" }) * direction;
    });
  };

  const renderTableToolbar = (tableId, rows, visibleRows) => {
    const control = tableControls[tableId] || {};

    return (
      <div className="table-control-bar">
        <label>
          <span>{copy("Filter", "Filtrele")}</span>
          <input
            type="search"
            value={control.query || ""}
            placeholder={copy("Search table", "Tabloda ara")}
            onChange={(event) => updateTableControl(tableId, { query: event.target.value })}
          />
        </label>
        <strong>{formatNumber(visibleRows.length)} / {formatNumber(rows.length)}</strong>
      </div>
    );
  };

  const renderSortableTableHead = (tableId, columns, gridTemplateColumns) => {
    const control = tableControls[tableId] || {};

    return (
      <div className="operation-data-row operation-data-head sortable-table-head" style={{ gridTemplateColumns }}>
        {columns.map((column, index) => {
          const key = getTableColumnKey(column, index);
          const active = control.sortKey === key;

          return (
            <button
              type="button"
              className={active ? "active" : ""}
              disabled={column.sortable === false}
              key={key}
              onClick={() => updateTableControl(tableId, getNextTableSortPatch(control, key))}
            >
              <span>{column.header}</span>
              {column.sortable !== false && <small aria-hidden="true">{active ? (control.direction === "desc" ? "DESC" : "ASC") : "SORT"}</small>}
            </button>
          );
        })}
      </div>
    );
  };

  const renderSortableDataTable = ({
    columns,
    emptyLabel,
    gridTemplateColumns,
    getRowKey = (row) => row.id,
    onRowClick,
    rows,
    tableId,
    useButtonRows = false,
  }) => {
    const visibleRows = getSortableTableRows(tableId, rows, columns);
    const displayRows = visibleRows.length ? visibleRows : [{ id: "empty" }];
    const rowElement = useButtonRows ? "button" : "div";

    return (
      <>
        {renderTableToolbar(tableId, rows, visibleRows)}
        <div className="operation-data-table">
          {renderSortableTableHead(tableId, columns, gridTemplateColumns)}
          {displayRows.map((row) => {
            const isEmpty = row.id === "empty";
            const RowTag = rowElement;

            return (
              <RowTag
                type={useButtonRows ? "button" : undefined}
                className={`operation-data-row${useButtonRows ? " operation-data-button-row" : ""}${isEmpty ? " table-empty-row" : ""}`}
                style={{ gridTemplateColumns }}
                key={isEmpty ? `${tableId}-empty` : getRowKey(row)}
                onClick={useButtonRows ? () => {
                  if (!isEmpty && onRowClick) onRowClick(row);
                } : undefined}
              >
                {isEmpty ? (
                  <span className="table-empty-cell">{emptyLabel || copy("No matching records", "Eşleşen kayıt yok")}</span>
                ) : columns.map((column, index) => (
                  <span key={getTableColumnKey(column, index)}>{column.render ? column.render(row) : normalizeTableValue(getTableCellValue(column, row))}</span>
                ))}
              </RowTag>
            );
          })}
        </div>
      </>
    );
  };

  const renderSimpleSortableGrid = ({
    columns,
    emptyLabel,
    getRowKey = (row) => row.id,
    gridTemplateColumns,
    headClassName,
    rowClassName,
    rows,
    tableClassName,
    tableId,
  }) => {
    const visibleRows = getSortableTableRows(tableId, rows, columns);
    const control = tableControls[tableId] || {};

    return (
      <>
        {renderTableToolbar(tableId, rows, visibleRows)}
        <div className={tableClassName}>
          <div className={`${rowClassName} ${headClassName} sortable-table-head`} style={{ gridTemplateColumns }}>
            {columns.map((column, index) => {
              const key = getTableColumnKey(column, index);
              const active = control.sortKey === key;

              return (
                <button
                  type="button"
                  className={active ? "active" : ""}
                  disabled={column.sortable === false}
                  key={key}
                  onClick={() => updateTableControl(tableId, getNextTableSortPatch(control, key))}
                >
                  <span>{column.header}</span>
                  {column.sortable !== false && <small aria-hidden="true">{active ? (control.direction === "desc" ? "DESC" : "ASC") : "SORT"}</small>}
                </button>
              );
            })}
          </div>
          {(visibleRows.length ? visibleRows : [{ id: "empty" }]).map((row) => (
            <div className={`${rowClassName}${row.id === "empty" ? " table-empty-row" : ""}`} style={{ gridTemplateColumns }} key={row.id === "empty" ? `${tableId}-empty` : getRowKey(row)}>
              {row.id === "empty" ? (
                <span className="table-empty-cell">{emptyLabel || copy("No matching records", "Eşleşen kayıt yok")}</span>
              ) : columns.map((column, index) => {
                const content = column.render ? column.render(row) : normalizeTableValue(getTableCellValue(column, row));
                const CellTag = index === 0 && (rowClassName.includes("users-row") || rowClassName.includes("permissions-row")) ? "strong" : "span";
                return <CellTag key={getTableColumnKey(column, index)}>{content}</CellTag>;
              })}
            </div>
          ))}
        </div>
      </>
    );
  };

  function renderOperationPlanner() {
    const result = operationPlanResult
      ? calculateCurrentPlanResult({ input: operationPlan, result: operationPlanResult }, operationsWorkspaceForFinance, { optimize: false })
      : null;
    const latestProcess = asObjectArray(operationsWorkspace.activePlans)[0] || operationsWorkspace.latestPlan;
    const latestProcessName = latestProcess?.plan_name || latestProcess?.input?.planName || result?.planName || "";
    const machineRows = asObjectArray(operationPlan.machineRows);
    const operationRows = asObjectArray(operationPlan.operationRows);
    const workforceRows = asObjectArray(operationPlan.workforceRows);
    const selectedProduct = operationsWorkspace.products.find((product) => product.id === operationPlan.productId);
    const selectedProductFlowDefaults = getProductFlowDefaults(selectedProduct);
    const selectedProductMaterials = asObjectArray(selectedProduct?.material_rows);
    const resultMachineRows = asObjectArray(result?.machineRows);
    const resultOperationRows = asObjectArray(result?.operationRows);
    const resultBufferRows = asObjectArray(result?.bufferRows);
    const resultWorkforceRows = asObjectArray(result?.workforceRows);
    const resultMaterialRows = asObjectArray(result?.materialRows);
    const flowStrategyLabels = {
      batch: copy("Batch", "Toplu"),
      flow: copy("Flow / Pull", "Akış / Pull"),
      parallel: copy("Parallel simulation", "Paralel simülasyon"),
    };
    const defaultMachineRow = {
      ...emptyPlanRows.machine,
      machineId: operationsWorkspace.machines[0]?.id || "",
    };
    const defaultOperationRow = buildDefaultOperationRow(operationRows.length, operationsWorkspace.machines[operationRows.length] || operationsWorkspace.machines[0], selectedProduct);
    const defaultWorkforceRow = {
      ...emptyPlanRows.workforce,
      workforceId: operationsWorkspace.workforce[0]?.id || "",
    };
    const infoLabel = (label, info) => (
      <span className="label-with-info">
        {label}
        <InfoTip label={`${label} ${copy("info", "bilgi")}`} text={info} />
      </span>
    );
    const resultSummaryColumns = [
      { header: copy("Category", "Kategori"), key: "category", render: (row) => row.group, value: (row) => row.group },
      { header: copy("Metric", "Metrik"), key: "metric", render: (row) => (row.info ? infoLabel(row.label, row.info) : row.label), value: (row) => row.label },
      { header: copy("Value", "Değer"), key: "value", render: (row) => row.value, value: (row) => row.value },
    ];
    const resultTableRows = result ? [
      {
        id: "product",
        group: copy("Plan", "Plan"),
        label: copy("Product", "Ürün"),
        value: result.productName || "-",
      },
      {
        id: "unit-price",
        group: copy("Plan", "Plan"),
        label: copy("Unit Price", "Birim Fiyat"),
        value: `${formatOperationMoney(result.productPrice, result.productPriceCurrency, exchangeRates, 2)} / ${result.productUnit || copy("pcs", "adet")}`,
      },
      {
        id: "quantity",
        group: copy("Plan", "Plan"),
        label: copy("Quantity to Produce", "Üretilecek Miktar"),
        value: `${formatNumber(result.producedQuantity, 2)} ${result.productUnit || copy("pcs", "adet")}`,
      },
      {
        id: "strategy",
        group: copy("Plan", "Plan"),
        label: copy("Strategy", "Strateji"),
        value: flowStrategyLabels[result.flowStrategy] || result.flowStrategy || "-",
        info: copy("The selected production logic used by the scheduler: full batch, flow/pull batches, or minimum-transfer event simulation.", "Planlayıcının kullandığı üretim mantığıdır: tam batch, flow/pull batch'leri veya minimum transferli event simülasyonu."),
      },
      {
        id: "transfer-batch",
        group: copy("Plan", "Plan"),
        label: copy("Transfer Batch", "Transfer batch"),
        value: result.transferBatchSize ? formatNumber(result.transferBatchSize, 2) : "-",
        info: copy("The actual group size sent between operations. In Batch mode it becomes the full quantity; in Flow mode it follows batch size; in Parallel mode it follows minimum transfer.", "Operasyonlar arasında aktarılan gerçek grup boyutudur. Batch modunda tüm miktar; Flow modunda batch boyutu; Parallel modunda minimum transfer kullanılır."),
      },
      {
        id: "recommended-batch",
        group: copy("Plan", "Plan"),
        label: copy("Best batch size", "En iyi batch"),
        value: result.optimization?.recommendedBatchSize ? formatNumber(result.optimization.recommendedBatchSize, 2) : "-",
        info: copy("Recommended transfer batch size from the optimizer, based on total time plus waiting, inventory, delay, and capacity-loss costs.", "Toplam süre, bekleme, stok, gecikme ve kapasite kaybı maliyetlerine göre optimizasyonun önerdiği transfer batch boyutudur."),
      },
      {
        id: "production-time",
        group: copy("Flow", "Akış"),
        label: copy("Production Time", "Toplam üretim süresi"),
        value: result.totalProductionTimeMinutes ? formatMinutesDuration(result.totalProductionTimeMinutes) : "-",
        info: copy("The simulated time from the first operation start until the last batch finishes the final operation.", "İlk operasyonun başlamasından son batch'in son operasyonu bitirmesine kadar simüle edilen süredir."),
      },
      {
        id: "cycle-time",
        group: copy("Flow", "Akış"),
        label: copy("Cycle Time", "Çevrim Süresi"),
        value: formatCycleTime(result.cycleTimeMinutes, selectedProduct?.cycle_time_unit || "minute"),
      },
      {
        id: "effective-cycle",
        group: copy("Flow", "Akış"),
        label: copy("Effective Cycle", "Efektif çevrim"),
        value: result.effectiveCycleTimeMinutes ? formatMinutesDuration(result.effectiveCycleTimeMinutes) : "-",
        info: copy("Average elapsed production time per finished unit after flow, waiting, setup, and bottlenecks are included.", "Akış, bekleme, setup ve darboğazlar dahil edildikten sonra biten ürün başına ortalama geçen üretim süresidir."),
      },
      {
        id: "bottleneck",
        group: copy("Flow", "Akış"),
        label: copy("Bottleneck", "Darboğaz"),
        value: result.bottleneck?.operationName || "-",
        info: copy("The operation with the highest total busy time. It limits the line and is usually the first place to improve capacity.", "Toplam meşgul süresi en yüksek operasyondur. Hattı sınırlar ve kapasite iyileştirmesinde genellikle ilk bakılacak yerdir."),
      },
      {
        id: "max-wip",
        group: copy("Flow", "Akış"),
        label: copy("Max WIP", "Maks WIP"),
        value: formatNumber(result.maxWipQuantity, 2),
        info: copy("Maximum work-in-progress quantity waiting in buffers between operations. High WIP means intermediate stock is accumulating.", "Operasyonlar arasındaki buffer'larda bekleyen maksimum yarı mamul miktarıdır. Yüksek WIP ara stok biriktiğini gösterir."),
      },
      {
        id: "machine-hours",
        group: copy("Capacity", "Kapasite"),
        label: copy("Machine Hours", "Makine Saati"),
        value: `${formatNumber(result.machineHoursUsed, 1)} ${copy("hours", "saat")}`,
      },
      {
        id: "workforce-hours",
        group: copy("Capacity", "Kapasite"),
        label: copy("Workforce Hours", "İşgücü Saati"),
        value: `${formatNumber(result.workforceHoursUsed, 1)} ${copy("hours", "saat")}`,
      },
      {
        id: "machine-value",
        group: copy("Capacity", "Kapasite"),
        label: copy("Selected Machine Value", "Seçili Makine Değeri"),
        value: formatLira(result.selectedMachineValue),
      },
      {
        id: "idle-time",
        group: copy("Capacity", "Kapasite"),
        label: copy("Idle Time", "Boşta süre"),
        value: `${formatNumber(result.totalIdleTimeHours, 2)} ${copy("hours", "saat")}`,
        info: copy("Machine time that remains unused while the simulated line is constrained by another operation or demand timing.", "Simüle edilen hat başka bir operasyon veya talep zamanlaması tarafından sınırlandığında kullanılmadan kalan makine süresidir."),
      },
      {
        id: "energy",
        group: copy("Cost", "Maliyet"),
        label: copy("Electricity Consumption", "Elektrik Tüketimi"),
        value: `${formatNumber(result.energyConsumptionKwh, 2)} kWh`,
      },
      {
        id: "material-cost",
        group: copy("Cost", "Maliyet"),
        label: copy("Material Cost", "Malzeme Maliyeti"),
        value: formatLira(result.materialCost),
      },
      {
        id: "workforce-cost",
        group: copy("Cost", "Maliyet"),
        label: copy("Workforce Cost", "İşgücü Maliyeti"),
        value: formatLira(result.workforceCost),
      },
      {
        id: "daily-cost",
        group: copy("Cost", "Maliyet"),
        label: copy("Tracked Daily Cost", "Takip Edilen Günlük Maliyet"),
        value: formatLira(result.totalTrackedDailyCost),
      },
      {
        id: "waiting-cost",
        group: copy("Cost", "Maliyet"),
        label: copy("Waiting Cost", "Bekleme maliyeti"),
        value: formatLira(result.waitingCost),
        info: copy("Cost generated by queue waiting before downstream operations. It equals waiting hours multiplied by your waiting cost input.", "Sonraki operasyonlardan önce kuyrukta bekleme nedeniyle oluşan maliyettir. Bekleme saatleri ile girdiğiniz bekleme maliyetinin çarpımıdır."),
      },
      {
        id: "inventory-cost",
        group: copy("Cost", "Maliyet"),
        label: copy("Inventory Cost", "Stok maliyeti"),
        value: formatLira(result.inventoryCost),
        info: copy("Cost generated by WIP held in buffers. It uses unit-hours, so both quantity and time in buffer matter.", "Buffer'da tutulan WIP nedeniyle oluşan maliyettir. Birim-saat mantığıyla çalışır; yani hem miktar hem de buffer'da kalma süresi önemlidir."),
      },
      {
        id: "delay-capacity",
        group: copy("Cost", "Maliyet"),
        label: copy("Delay / Capacity Loss", "Gecikme / kapasite kaybı"),
        value: formatLira(toFiniteNumber(result.delayCost) + toFiniteNumber(result.capacityLossCost)),
        info: copy("Combined penalty for exceeding available production time and leaving machine capacity idle because of line imbalance.", "Kullanılabilir üretim süresini aşma ve hat dengesizliği yüzünden makine kapasitesinin boş kalması için birleşik cezadır."),
      },
      {
        id: "objective-score",
        group: copy("Cost", "Maliyet"),
        label: copy("Objective Score", "Amaç skoru"),
        value: formatNumber(result.objectiveScore, 2),
        info: copy("Optimizer score: total production minutes plus waiting, inventory, delay, and capacity-loss costs. Lower is better.", "Optimizasyon skoru: toplam üretim dakikası ile bekleme, stok, gecikme ve kapasite kaybı maliyetlerinin toplamı. Düşük olması daha iyidir."),
      },
    ] : [];

    const processWorkforceRows = buildWorkforceRowsFromOperationRows(operationRows);
    const activeWorkforceRows = processWorkforceRows.length ? processWorkforceRows : workforceRows;
    const showProcessSteps = Boolean(processDefinitionOpen && selectedProduct);
    const recipeHasPositiveQuantity = selectedProductMaterials.some((row) => toFiniteNumber(row.quantity_per_unit ?? row.quantityPerUnit) > 0);
    const selectedProductRecipeLabel = selectedProductMaterials.length
      ? `${formatNumber(selectedProductMaterials.length)} ${copy("materials", "malzeme")}`
      : copy("No recipe", "Reçete yok");
    const getSelectedRecipeMaterial = (materialId) => selectedProductMaterials.find((row) => getRecipeMaterialId(row) === materialId);
    const handleProcessProductChange = (productId) => {
      const product = operationsWorkspace.products.find((item) => item.id === productId);

      setProcessDefinitionOpen(false);
      setOperationPlan((current) => ({
        ...current,
        ...getProductFlowDefaults(product),
        operationRows: product ? buildProductOperationRows(product) : [],
        productId: product?.id || "",
        productName: product?.name || "",
      }));
      setOperationPlanResult(null);
    };
    const handleOpenProcessSteps = () => {
      if (!selectedProduct) return;

      setOperationPlan((current) => ({
        ...current,
        operationRows: buildProductOperationRows(
          selectedProduct,
          current.productId === selectedProduct.id ? current.operationRows : [],
        ),
        productName: selectedProduct.name || "",
      }));
      setProcessDefinitionOpen(true);
    };
    const addProcessStep = () => {
      if (!selectedProduct) return;

      const nextRow = enrichOperationRowsForProduct([
        {
          ...buildDefaultOperationRow(operationRows.length, operationsWorkspace.machines[operationRows.length] || operationsWorkspace.machines[0], selectedProduct),
          operationName: `${copy("Process", "Süreç")} ${operationRows.length + 1}`,
        },
      ], selectedProduct)[0];

      addOperationPlanRow("operationRows", nextRow);
    };

    return (
      <section
        className={`operation-planner process-definition-builder ${showProcessSteps ? "is-open" : "is-closed"}`}
        aria-label={copy("Process definition", "Süreç tanımlama")}
      >
        <form className="operation-card planner-input-card process-definition-form" onSubmit={handleSaveOperationPlan}>
          <section className={`process-product-gate ${showProcessSteps ? "open" : ""}`}>
            <div className="process-product-copy">
              <span>{copy("Product", "Ürün")}</span>
              <h2>{copy("What product will be produced?", "Hangi ürün üretilecek?")}</h2>
            </div>
            <div className="process-product-controls">
              <label>
                <span>{copy("Product to produce", "Üretilecek ürün")}</span>
                <select value={operationPlan.productId || ""} onChange={(event) => handleProcessProductChange(event.target.value)}>
                  <option value="">{copy("Select product", "Ürün seç")}</option>
                  {operationsWorkspace.products.map((product) => (
                    <option value={product.id} key={product.id}>{product.name}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="process-open-button" disabled={!selectedProduct} onClick={handleOpenProcessSteps}>
                {showProcessSteps ? copy("Refresh boxes", "Kutuları yenile") : copy("Open process boxes", "Süreç kutularını aç")}
              </button>
            </div>
            {selectedProduct && (
              <div className="process-product-selected" aria-label={copy("Selected product summary", "Seçili ürün özeti")}>
                <span>
                  {copy("Unit price", "Birim fiyat")}
                  <strong>{formatOperationMoney(selectedProduct.price, selectedProduct.price_currency, exchangeRates, 2)}</strong>
                </span>
                <span>
                  {copy("Recipe", "Reçete")}
                  <strong>{selectedProductRecipeLabel}</strong>
                </span>
                <span>
                  {copy("Default flow", "Varsayılan akış")}
                  <strong>{flowStrategyLabels[selectedProductFlowDefaults.flowStrategy]}</strong>
                </span>
              </div>
            )}
          </section>

          {showProcessSteps && (
            <>
              <div className="process-run-settings">
                <label>
                  <span>{copy("Plan name", "Plan adı")}</span>
                  <input
                    type="text"
                    value={operationPlan.planName ?? ""}
                    onChange={(event) => updateOperationPlan("planName", event.target.value)}
                  />
                </label>
                <label>
                  <span>{copy("Production quantity", "Üretilecek adet")}</span>
                  <input
                    min="0"
                    step="1"
                    type="number"
                    value={operationPlan.targetQuantity ?? ""}
                    onChange={(event) => updateOperationPlan("targetQuantity", event.target.value)}
                  />
                  <small>{selectedProduct.unit || copy("units", "adet")}</small>
                </label>
              </div>

              {!recipeHasPositiveQuantity && (
                <p className="planner-empty-state process-recipe-warning">
                  {copy("This product needs a positive saved recipe before calculation.", "Hesaplama için bu ürünün pozitif miktarlı kayıtlı reçetesi olmalı.")}
                </p>
              )}

              <section className="process-step-workspace" aria-label={copy("Process steps", "Süreç adımları")}>
                <div className="process-step-toolbar">
                  <div>
                    <span>{copy("Required processes", "Gerekli süreçler")}</span>
                    <strong>{formatNumber(operationRows.length)} {copy("process boxes", "süreç kutusu")}</strong>
                  </div>
                  <button type="button" className="process-add-button" onClick={addProcessStep}>
                    {copy("Add process", "Süreç ekle")}
                  </button>
                </div>

                <div className="process-step-list">
                  {operationRows.length ? operationRows.map((row, index) => {
                    const selectedMachine = operationsWorkspace.machines.find((machine) => machine.id === row.machineId);
                    const selectedMaterial = getSelectedRecipeMaterial(row.materialId);

                    return (
                      <article className="process-step-card" key={row.operationId || `operation-${index}`}>
                        <div className="process-step-card-header">
                          <div className="process-step-index">{formatNumber(index + 1, 0)}</div>
                          <div>
                            <span>{copy("Process", "Süreç")}</span>
                            <strong>{row.operationName || `${copy("Process", "Süreç")} ${index + 1}`}</strong>
                            <small>{selectedMachine?.name || copy("Machine not selected", "Makine seçilmedi")}</small>
                          </div>
                          <button type="button" className="resource-remove-button" onClick={() => removeOperationPlanRow("operationRows", index)}>
                            {copy("Delete", "Sil")}
                          </button>
                        </div>

                        <div className="process-step-grid">
                          <label>
                            <span>{copy("Process name", "Süreç adı")}</span>
                            <input
                              type="text"
                              value={row.operationName || ""}
                              onChange={(event) => updateOperationPlanRow("operationRows", index, "operationName", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>{copy("Machine", "Makine")}</span>
                            <select value={row.machineId || ""} onChange={(event) => updateOperationPlanRow("operationRows", index, "machineId", event.target.value)}>
                              <option value="">{copy("Select machine", "Makine seç")}</option>
                              {operationsWorkspace.machines.map((machine) => (
                                <option value={machine.id} key={machine.id}>{machine.name}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>{copy("Min / unit", "Dk / birim")}</span>
                            <input
                              min="0.0001"
                              step="0.01"
                              type="number"
                              value={row.processTimeMinutes ?? ""}
                              onChange={(event) => updateOperationPlanRow("operationRows", index, "processTimeMinutes", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>{copy("Machine hours", "Makine saati")}</span>
                            <input
                              min="0"
                              step="0.25"
                              type="number"
                              value={row.dailyHours ?? ""}
                              onChange={(event) => updateOperationPlanRow("operationRows", index, "dailyHours", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>{copy("Material", "Malzeme")}</span>
                            <select
                              disabled={!selectedProductMaterials.length}
                              value={row.materialId || ""}
                              onChange={(event) => {
                                const materialRow = getSelectedRecipeMaterial(event.target.value);
                                updateOperationPlanRowFields("operationRows", index, {
                                  materialId: event.target.value,
                                  materialQuantityPerUnit: materialRow?.quantity_per_unit ?? materialRow?.quantityPerUnit ?? row.materialQuantityPerUnit ?? "",
                                });
                              }}
                            >
                              <option value="">{copy("Select material", "Malzeme seç")}</option>
                              {selectedProductMaterials.map((materialRow, materialIndex) => {
                                const materialId = getRecipeMaterialId(materialRow);
                                return (
                                  <option value={materialId} key={materialId || `material-${materialIndex}`}>
                                    {materialRow.material?.name || materialRow.name || `${copy("Material", "Malzeme")} ${materialIndex + 1}`}
                                  </option>
                                );
                              })}
                            </select>
                          </label>
                          <label>
                            <span>{copy("Recipe qty", "Reçete miktarı")}</span>
                            <input
                              min="0"
                              step="0.0001"
                              type="number"
                              value={row.materialQuantityPerUnit ?? ""}
                              onChange={(event) => updateOperationPlanRow("operationRows", index, "materialQuantityPerUnit", event.target.value)}
                            />
                            <small>{selectedMaterial?.material?.unit || selectedMaterial?.unit || ""}</small>
                          </label>
                          <label>
                            <span>{copy("Equipment", "Ekipman")}</span>
                            <select value={row.equipmentId || ""} onChange={(event) => updateOperationPlanRow("operationRows", index, "equipmentId", event.target.value)}>
                              <option value="">{copy("Optional", "Opsiyonel")}</option>
                              {operationsWorkspace.equipment.map((equipment) => (
                                <option value={equipment.id} key={equipment.id}>{equipment.name}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>{copy("Crew role", "Ekip rolü")}</span>
                            <select value={row.workforceId || ""} onChange={(event) => updateOperationPlanRow("operationRows", index, "workforceId", event.target.value)}>
                              <option value="">{copy("Select role", "Rol seç")}</option>
                              {operationsWorkspace.workforce.map((workforce) => (
                                <option value={workforce.id} key={workforce.id}>{workforce.role_name}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>{copy("People", "Kişi")}</span>
                            <input
                              min="0"
                              step="1"
                              type="number"
                              value={row.peopleAssigned ?? ""}
                              onChange={(event) => updateOperationPlanRow("operationRows", index, "peopleAssigned", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>{copy("Crew hours", "Ekip saati")}</span>
                            <input
                              min="0"
                              step="0.25"
                              type="number"
                              value={row.workforceDailyHours ?? ""}
                              onChange={(event) => updateOperationPlanRow("operationRows", index, "workforceDailyHours", event.target.value)}
                            />
                          </label>
                        </div>

                        <details className="process-step-advanced">
                          <summary>{copy("Advanced timing", "İleri zamanlama")}</summary>
                          <div className="process-step-grid compact">
                            <label>
                              <span>{copy("Capacity", "Kapasite")}</span>
                              <input
                                min="1"
                                step="1"
                                type="number"
                                value={row.capacity ?? ""}
                                onChange={(event) => updateOperationPlanRow("operationRows", index, "capacity", event.target.value)}
                              />
                            </label>
                            <label>
                              <span>{copy("Setup min", "Setup dk")}</span>
                              <input
                                min="0"
                                step="0.1"
                                type="number"
                                value={row.setupMinutes ?? ""}
                                onChange={(event) => updateOperationPlanRow("operationRows", index, "setupMinutes", event.target.value)}
                              />
                            </label>
                            <label>
                              <span>{copy("Speed", "Hız")}</span>
                              <input
                                min="0.0001"
                                step="0.01"
                                type="number"
                                value={row.speedMultiplier ?? ""}
                                onChange={(event) => updateOperationPlanRow("operationRows", index, "speedMultiplier", event.target.value)}
                              />
                            </label>
                          </div>
                        </details>
                      </article>
                    );
                  }) : (
                    <p className="planner-empty-state">{copy("Add at least one process box for this product.", "Bu ürün için en az bir süreç kutusu ekleyin.")}</p>
                  )}
                </div>
              </section>

              <details className="process-advanced-options process-accordion">
                <summary className="process-accordion-summary">
                  <div>
                    <span>{copy("Flow and optimization", "Akış ve optimizasyon")}</span>
                    <p>{copy("Batch, transfer, buffer, and optional cost weights.", "Batch, transfer, buffer ve opsiyonel maliyet ağırlıkları.")}</p>
                  </div>
                  <small>{flowStrategyLabels[operationPlan.flowStrategy] || flowStrategyLabels.flow}</small>
                </summary>
                <div className="process-accordion-body">
                  <div className="planner-fields compact-planner-fields process-compact-options">
                    <label>
                      <span>{copy("Flow strategy", "Akış stratejisi")}</span>
                      <div>
                        <select value={operationPlan.flowStrategy || "flow"} onChange={(event) => updateOperationPlan("flowStrategy", event.target.value)}>
                          <option value="flow">{flowStrategyLabels.flow}</option>
                          <option value="batch">{flowStrategyLabels.batch}</option>
                          <option value="parallel">{flowStrategyLabels.parallel}</option>
                        </select>
                      </div>
                    </label>
                    <label>
                      <span>{copy("Batch size", "Batch boyutu")}</span>
                      <div>
                        <input min="1" step="1" type="number" value={operationPlan.batchSize ?? ""} onChange={(event) => updateOperationPlan("batchSize", event.target.value)} />
                      </div>
                    </label>
                    <label>
                      <span>{copy("Minimum transfer", "Minimum transfer")}</span>
                      <div>
                        <input min="1" step="1" type="number" value={operationPlan.minimumTransferQuantity ?? ""} onChange={(event) => updateOperationPlan("minimumTransferQuantity", event.target.value)} />
                      </div>
                    </label>
                    <label>
                      <span>{copy("Max buffer", "Maks buffer")}</span>
                      <div>
                        <input min="0" step="1" type="number" value={operationPlan.bufferMaxQuantity ?? ""} onChange={(event) => updateOperationPlan("bufferMaxQuantity", event.target.value)} />
                      </div>
                    </label>
                    <label>
                      <span>{copy("Waiting cost / hour", "Bekleme maliyeti / saat")}</span>
                      <div>
                        <input min="0" step="0.01" type="number" value={operationPlan.waitingCostPerHour ?? ""} onChange={(event) => updateOperationPlan("waitingCostPerHour", event.target.value)} />
                      </div>
                    </label>
                    <label>
                      <span>{copy("Inventory cost / unit-hour", "Stok maliyeti / birim-saat")}</span>
                      <div>
                        <input min="0" step="0.01" type="number" value={operationPlan.inventoryCostPerUnitHour ?? ""} onChange={(event) => updateOperationPlan("inventoryCostPerUnitHour", event.target.value)} />
                      </div>
                    </label>
                    <label>
                      <span>{copy("Delay cost / hour", "Gecikme maliyeti / saat")}</span>
                      <div>
                        <input min="0" step="0.01" type="number" value={operationPlan.delayCostPerHour ?? ""} onChange={(event) => updateOperationPlan("delayCostPerHour", event.target.value)} />
                      </div>
                    </label>
                    <label>
                      <span>{copy("Capacity loss / hour", "Kapasite kaybı / saat")}</span>
                      <div>
                        <input min="0" step="0.01" type="number" value={operationPlan.capacityLossCostPerHour ?? ""} onChange={(event) => updateOperationPlan("capacityLossCostPerHour", event.target.value)} />
                      </div>
                    </label>
                  </div>
                </div>
              </details>

              <div className="process-save-panel">
                <div>
                  <span>{copy("Final checkpoint", "Son kontrol")}</span>
                  <strong>{copy("Calculate this production process", "Bu üretim sürecini hesapla")}</strong>
                  <p>{`${formatNumber(operationRows.length)} ${copy("processes", "süreç")} / ${formatNumber(activeWorkforceRows.length)} ${copy("crew roles", "ekip rolü")}`}</p>
                </div>
                <button className="submit-button planner-save-button" disabled={operationsLoading} type="submit">
                  {operationsLoading ? copy("Saving...", "Kaydediliyor...") : copy("Calculate and Save", "Hesapla ve Kaydet")}
                </button>
              </div>
            </>
          )}

          {operationsStatus && <p className="status-message">{operationsStatus}</p>}
        </form>

        {showProcessSteps && result && (
          <article className="operation-card planner-result-card process-definition-result">
            <div className="operation-card-heading">
              <div>
                <span>{latestProcessName || copy("Result", "Sonuç")}</span>
                <h2>{copy("Flow and cost summary", "Akış ve maliyet özeti")}</h2>
              </div>
              <mark className="ok">{`${formatNumber(result.energyConsumptionKwh, 2)} kWh`}</mark>
            </div>
            {renderSimpleSortableGrid({
              columns: resultSummaryColumns,
              gridTemplateColumns: "0.72fr 1.15fr 1fr",
              headClassName: "process-result-table-head",
              rowClassName: "process-result-table-row",
              rows: resultTableRows,
              tableClassName: "process-result-table",
              tableId: "process-result-summary",
            })}
          </article>
        )}
      </section>
    );


  }

  function renderOperationRecordForm(entity, fields, options = {}) {
    const formClassName = [
      "operation-card operation-data-form operations-record-form-card",
      options.className,
    ].filter(Boolean).join(" ");
    const recordFormLabels = {
      equipment: {
        eyebrow: copy("Register equipment", "Ekipman kaydı"),
        title: copy("Equipment details", "Ekipman detayları"),
      },
      machine: {
        eyebrow: copy("Register machine", "Makine kaydı"),
        title: copy("Machine capability", "Makine kabiliyeti"),
      },
      material: {
        eyebrow: copy("Register material", "Malzeme kaydı"),
        title: copy("Material details", "Malzeme detayları"),
      },
      workforce: {
        eyebrow: copy("Register workforce", "İşgücü kaydı"),
        title: copy("Workforce details", "İşgücü detayları"),
      },
    };
    const recordFormLabel = recordFormLabels[entity] || {
      eyebrow: copy("New record", "Yeni kayıt"),
      title: copy("Record details", "Kayıt detayları"),
    };

    return (
      <form ref={options.formRef} className={formClassName} onSubmit={(event) => handleSaveOperationRecord(entity, event)}>
        <div className="operation-card-heading">
          <div>
            <span>{recordFormLabel.eyebrow}</span>
            <h2>{recordFormLabel.title}</h2>
          </div>
        </div>
        <div className="operation-data-fields">
          {fields.map((field) => (
            <label key={field.name}>
              <span className="label-with-info">
                {field.label}
                {field.info && <InfoTip label={`${field.label} ${copy("info", "bilgi")}`} text={field.info} />}
              </span>
              {field.type === "select" ? (
                <select value={operationForms[entity][field.name]} onChange={(event) => updateOperationForm(entity, field.name, event.target.value)}>
                  {field.options.map((option) => {
                    const value = Array.isArray(option) ? option[0] : option.value ?? option;
                    const label = Array.isArray(option) ? option[1] : option.label ?? option;

                    return <option value={value} key={value}>{label}</option>;
                  })}
                </select>
              ) : field.type === "textarea" ? (
                <textarea value={operationForms[entity][field.name]} onChange={(event) => updateOperationForm(entity, field.name, event.target.value)} />
              ) : (
                <input
                  min={field.min ?? 0}
                  step={field.step || "1"}
                  type={field.type || "text"}
                  value={operationForms[entity][field.name]}
                  onChange={(event) => updateOperationForm(entity, field.name, event.target.value)}
                />
              )}
            </label>
          ))}
        </div>
        <button className="submit-button planner-save-button" disabled={operationsLoading} type="submit">
          {operationsLoading ? copy("Saving...", "Kaydediliyor...") : copy("Save to Supabase", "Supabase'e Kaydet")}
        </button>
      </form>
    );
  }

  function renderResourcesPage() {
    const unitOptions = ["kg", "gr", "mg", "adet", "metre", "litre", "ml"];
    const resourceCurrencyCount = new Set([
      ...operationsWorkspace.materials.map((material) => material.price_currency || "TRY"),
      ...operationsWorkspace.workforce.map((workforce) => workforce.hourly_cost_currency || "TRY"),
    ]).size;
    const pricedMaterialCount = operationsWorkspace.materials.filter((material) => toFiniteNumber(material.price_per_unit) > 0).length;
    const materialColumns = [
      { header: copy("Material", "Malzeme"), key: "material", render: (row) => row.name, value: (row) => row.name },
      { header: copy("Unit", "Birim"), key: "unit", render: (row) => row.unit, value: (row) => row.unit },
      {
        header: copy("Unit price", "Birim fiyat"),
        key: "unit-price",
        render: (row) => formatOperationMoney(row.price_per_unit, row.price_currency, exchangeRates, 2),
        sortValue: (row) => toFiniteNumber(row.price_per_unit),
        filterValue: (row) => `${row.price_per_unit} ${formatOperationMoney(row.price_per_unit, row.price_currency, exchangeRates, 2)}`,
      },
      { header: copy("Currency", "Para birimi"), key: "currency", render: (row) => row.price_currency || "TRY", value: (row) => row.price_currency || "TRY" },
    ];
    const workforceColumns = [
      { header: copy("Role", "Rol"), key: "role", render: (row) => row.role_name, value: (row) => row.role_name },
      {
        header: copy("Hourly cost", "Saatlik maliyet"),
        key: "hourly-cost",
        render: (row) => `${formatOperationMoney(row.hourly_cost, row.hourly_cost_currency, exchangeRates, 2)} / ${copy("hour", "saat")}`,
        sortValue: (row) => toFiniteNumber(row.hourly_cost),
        filterValue: (row) => `${row.hourly_cost} ${formatOperationMoney(row.hourly_cost, row.hourly_cost_currency, exchangeRates, 2)}`,
      },
      { header: copy("Currency", "Para birimi"), key: "currency", render: (row) => row.hourly_cost_currency || "TRY", value: (row) => row.hourly_cost_currency || "TRY" },
    ];

    return renderDashboardLayout(
      "operations/resources",
        <section className="operations-workspace operations-modern operations-entry-page operations-resources-page">
          <div className="operations-header">
            <div>
              <span>Operations / {copy("Resources", "Kaynak")}</span>
              <h1>{copy("Resources", "Kaynak")}</h1>
              <p>{copy("Add materials, semi-finished items, and services used by production and costing workflows.", "Üretim ve maliyet akışlarında kullanılan malzeme, yarı mamül ve hizmetleri ekleyin.")}</p>
            </div>
            <div className="operations-actions">
              <button type="button" className="operations-refresh-button" onClick={loadOperationsData}>{copy("Refresh Data", "Verileri Yenile")}</button>
            </div>
          </div>

          <div className="process-summary-grid operations-entry-summary">
            <article className="operation-card process-summary-card">
              <span>{copy("Materials", "Malzemeler")}</span>
              <strong>{formatNumber(operationsWorkspace.materials.length)}</strong>
              <small>{copy("priced production inputs", "fiyatlı üretim girdileri")}: {formatNumber(pricedMaterialCount)}</small>
            </article>
            <article className="operation-card process-summary-card">
              <span>{copy("Workforce roles", "İşgücü rolleri")}</span>
              <strong>{formatNumber(operationsWorkspace.workforce.length)}</strong>
              <small>{copy("available for process plans", "süreç planlarına hazır")}</small>
            </article>
            <article className="operation-card process-summary-card">
              <span>{copy("Currencies", "Para birimleri")}</span>
              <strong>{formatNumber(resourceCurrencyCount)}</strong>
              <small>{copy("converted in financial analysis", "finans analizinde çevrilir")}</small>
            </article>
          </div>

          <div className="resource-definition-grid">
            <form ref={materialFormRef} className="operation-card operation-data-form resource-definition-card operations-record-form-card operations-material-form-card" onSubmit={(event) => handleSaveOperationRecord("material", event)}>
              <div className="operation-card-heading">
                <div>
                  <span>{copy("Add material", "Malzeme ekle")}</span>
                  <h2>{copy("Material", "Malzeme")}</h2>
                </div>
              </div>
              <div className="operation-data-fields">
                <label>
                  <span>{copy("Material name", "Malzeme adı")}</span>
                  <input type="text" value={operationForms.material.name} onChange={(event) => updateOperationForm("material", "name", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Unit", "Birim")}</span>
                  <select value={operationForms.material.unit} onChange={(event) => updateOperationForm("material", "unit", event.target.value)}>
                    {unitOptions.map((unit) => <option value={unit} key={unit}>{unit}</option>)}
                  </select>
                </label>
                <label>
                  <span className="label-with-info">
                    {copy("Unit price", "Birim fiyat")}
                    <InfoTip
                      label={copy("Material unit price info", "Malzeme birim fiyat bilgisi")}
                      text={copy(
                        "Material cost is unit price x required quantity. If the price is USD/EUR, financial analysis first converts it to TRY with the current rate.",
                        "Malzeme maliyeti birim fiyat x gereken miktar olarak hesaplanır. Fiyat USD/EUR ise finansal analiz önce güncel kurla TL'ye çevirir.",
                      )}
                    />
                  </span>
                  <input min="0" step="0.01" type="number" value={operationForms.material.pricePerUnit} onChange={(event) => updateOperationForm("material", "pricePerUnit", event.target.value)} />
                </label>
                <label>
                  <span className="label-with-info">
                    {copy("Currency", "Para birimi")}
                    <InfoTip
                      label={copy("Material currency info", "Malzeme para birimi bilgisi")}
                      text={copy("TRY stays as entered. USD and EUR are multiplied by their TRY rates before cost and feasibility calculations.", "TL girildiği gibi kalır. USD ve EUR, maliyet ve fizibilite hesaplarından önce ilgili TL kuru ile çarpılır.")}
                    />
                  </span>
                  <select value={operationForms.material.priceCurrency} onChange={(event) => updateOperationForm("material", "priceCurrency", event.target.value)}>
                    {operationCurrencyOptions.map((currency) => <option value={currency} key={currency}>{currency}</option>)}
                  </select>
                </label>
              </div>
              <button className="submit-button planner-save-button" disabled={operationsLoading} type="submit">
                {operationsLoading ? copy("Saving...", "Kaydediliyor...") : copy("Add Material", "Malzeme Ekle")}
              </button>
            </form>

            <article className="operation-card resource-definition-card operation-data-table-card operations-record-list-card operations-material-list-card" style={materialListHeightStyle}>
              <div className="operation-card-heading">
                <h2>{copy("Materials", "Malzemeler")}</h2>
                <span>{operationsWorkspace.materials.length} {copy("records", "kayıt")}</span>
              </div>
              {renderSortableDataTable({
                columns: materialColumns,
                gridTemplateColumns: "1.2fr 0.6fr 0.9fr 0.7fr",
                onRowClick: (material) => copyOperationRecordToForm("material", material),
                rows: operationsWorkspace.materials,
                tableId: "materials",
                useButtonRows: true,
              })}
            </article>

            <form ref={workforceFormRef} className="operation-card operation-data-form resource-definition-card operations-record-form-card operations-workforce-form-card" onSubmit={(event) => handleSaveOperationRecord("workforce", event)}>
              <div className="operation-card-heading">
                <div>
                  <span>{copy("Add human resource", "İnsan kaynağı ekle")}</span>
                  <h2>{copy("Human Resources", "İnsan Kaynağı")}</h2>
                </div>
              </div>
              <div className="operation-data-fields">
                <label>
                  <span>{copy("Role", "Rol")}</span>
                  <input type="text" value={operationForms.workforce.roleName} onChange={(event) => updateOperationForm("workforce", "roleName", event.target.value)} />
                </label>
                <label>
                  <span className="label-with-info">
                    {copy("Hourly cost", "Saatlik maliyet")}
                    <InfoTip
                      label={copy("Hourly cost info", "Saatlik maliyet bilgisi")}
                      text={copy("Workforce cost is hourly cost x assigned people x daily hours. It then rolls into daily and monthly production cost.", "İşçilik maliyeti saatlik maliyet x atanmış kişi x günlük saat olarak hesaplanır. Sonra günlük ve aylık üretim maliyetine girer.")}
                    />
                  </span>
                  <input min="0" step="1" type="number" value={operationForms.workforce.hourlyCost} onChange={(event) => updateOperationForm("workforce", "hourlyCost", event.target.value)} />
                </label>
                <label>
                  <span className="label-with-info">
                    {copy("Currency", "Para birimi")}
                    <InfoTip
                      label={copy("Workforce currency info", "İşçilik para birimi bilgisi")}
                      text={copy("Select the currency used for hourly cost. USD/EUR are converted to TRY for financial outputs.", "Saatlik maliyetin para birimini seçin. USD/EUR finans çıktılarında TL'ye çevrilir.")}
                    />
                  </span>
                  <select value={operationForms.workforce.hourlyCostCurrency} onChange={(event) => updateOperationForm("workforce", "hourlyCostCurrency", event.target.value)}>
                    {operationCurrencyOptions.map((currency) => <option value={currency} key={currency}>{currency}</option>)}
                  </select>
                </label>
              </div>
              <button className="submit-button planner-save-button" disabled={operationsLoading} type="submit">
                {operationsLoading ? copy("Saving...", "Kaydediliyor...") : copy("Add Human Resource", "İnsan Kaynağı Ekle")}
              </button>
            </form>

            <article className="operation-card resource-definition-card operation-data-table-card operations-record-list-card operations-workforce-list-card" style={workforceListHeightStyle}>
              <div className="operation-card-heading">
                <h2>{copy("Human Resources", "İnsan Kaynağı")}</h2>
                <span>{operationsWorkspace.workforce.length} {copy("records", "kayıt")}</span>
              </div>
              {renderSortableDataTable({
                columns: workforceColumns,
                gridTemplateColumns: "1.2fr 0.9fr 0.7fr",
                onRowClick: (workforce) => copyOperationRecordToForm("workforce", workforce),
                rows: operationsWorkspace.workforce,
                tableId: "workforce",
                useButtonRows: true,
              })}
            </article>

            <article className="operation-card resource-definition-card resource-guidance-card">
              <div className="operation-card-heading">
                <div>
                  <span>{copy("Semi-finished items", "Yarı mamüller")}</span>
                  <h2>{copy("Use a material record for now", "Şimdilik malzeme kaydı kullanın")}</h2>
                </div>
              </div>
              <p className="planner-empty-state">
                {copy(
                  "Semi-finished recipe nesting is not persisted yet. Add the semi-finished item as a material with a real unit price, then use it in the product recipe.",
                  "Yarı mamül reçete kırılımı henüz kalıcı değil. Yarı mamülü gerçek birim fiyatıyla malzeme olarak ekleyin, sonra ürün reçetesinde kullanın.",
                )}
              </p>
            </article>

            <article className="operation-card resource-definition-card resource-guidance-card">
              <div className="operation-card-heading">
                <div>
                  <span>{copy("Services", "Hizmetler")}</span>
                  <h2>{copy("Persist service cost in finance", "Hizmet maliyetini finansta kaydedin")}</h2>
                </div>
                <button type="button" onClick={() => goTo("/financial-modelling/girdiler", "login")}>
                  {copy("Open Financial Inputs", "Finans Girdilerini Aç")}
                </button>
              </div>
              <p className="planner-empty-state">
                {copy(
                  "Service costs affect feasibility through optional financial expenses. Use initial or recurring expense rows so they are saved in Supabase and included in the model.",
                  "Hizmet maliyetleri fizibiliteyi opsiyonel finans giderleri üzerinden etkiler. Supabase'e kaydedilip modele dahil olması için başlangıç veya tekrarlayan gider satırlarını kullanın.",
                )}
              </p>
            </article>
          </div>
          {operationsStatus && <p className="status-message">{operationsStatus}</p>}
        </section>,
    );
  }

  function renderProductDataPage() {
    const productMaterialRows = operationForms.product.materialRows || [];
    const productsWithRecipe = operationsWorkspace.products.filter((product) => asObjectArray(product.material_rows).length > 0).length;
    const productRecipeLinkCount = operationsWorkspace.products.reduce((total, product) => total + asObjectArray(product.material_rows).length, 0);
    const pricedProductCount = operationsWorkspace.products.filter((product) => toFiniteNumber(product.price) > 0).length;
    const productFlowStrategyLabels = {
      batch: copy("Batch", "Toplu"),
      flow: copy("Flow / Pull", "Akış / Pull"),
      parallel: copy("Parallel simulation", "Paralel simülasyon"),
    };
    const getProductRecipeSummary = (product) => (
      (product.material_rows || []).map((row) => `${row.material?.name || "-"}: ${formatNumber(row.quantity_per_unit, 4)} ${row.material?.unit || ""}`).join(", ") || "-"
    );
    const getProductFlowSummary = (product) => {
      const flowDefaults = getProductFlowDefaults(product);
      return `${productFlowStrategyLabels[flowDefaults.flowStrategy]} / ${formatNumber(flowDefaults.batchSize, 0)} / min ${formatNumber(flowDefaults.minimumTransferQuantity, 0)}`;
    };
    const productColumns = [
      { header: copy("Product", "Ürün"), key: "product", render: (row) => row.name, value: (row) => row.name },
      { header: copy("Unit", "Birim"), key: "unit", render: (row) => row.unit || "adet", value: (row) => row.unit || "adet" },
      {
        header: copy("Price", "Fiyat"),
        key: "price",
        render: (row) => formatOperationMoney(row.price, row.price_currency, exchangeRates, 2),
        sortValue: (row) => toFiniteNumber(row.price),
        filterValue: (row) => `${row.price} ${row.price_currency || "TRY"} ${formatOperationMoney(row.price, row.price_currency, exchangeRates, 2)}`,
      },
      {
        header: copy("Cycle", "Çevrim"),
        key: "cycle",
        render: (row) => formatCycleTime(row.cycle_time_minutes || 1, row.cycle_time_unit || "minute"),
        sortValue: (row) => toFiniteNumber(row.cycle_time_minutes || 1),
      },
      { header: copy("Flow defaults", "Akış varsayılanı"), key: "flow", render: getProductFlowSummary, value: getProductFlowSummary },
      { header: copy("Materials", "Malzemeler"), key: "materials", render: getProductRecipeSummary, value: getProductRecipeSummary },
    ];
    const copyProductToForm = (product) => {
      const flowDefaults = getProductFlowDefaults(product);

      setOperationForms((current) => ({
        ...current,
        product: {
          ...getCycleTimeInputFromMinutes(product.cycle_time_minutes || 1, product.cycle_time_unit || "minute"),
          defaultBatchSize: flowDefaults.batchSize,
          defaultFlowStrategy: flowDefaults.flowStrategy,
          id: product.id,
          materialRows: (product.material_rows || []).map((row) => ({
            materialId: row.material_id,
            quantityPerUnit: row.quantity_per_unit,
          })),
          minimumTransferQuantity: flowDefaults.minimumTransferQuantity,
          name: product.name || "",
          price: product.price || 0,
          priceCurrency: product.price_currency || "TRY",
          unit: product.unit || "adet",
        },
      }));
    };

    return renderDashboardLayout(
      `operations/${activeOperationsSubmodule.key}`,
        <section className="operations-workspace operations-modern operations-entry-page operations-products-page">
          <div className="operations-header">
            <div>
              <span>Operations / {copy("Products", "Ürünler")}</span>
              <h1>{copy("Products", "Ürünler")}</h1>
              <p>{copy("Keep the product recipe, unit, price, cycle time, and default transfer rules used in process definition calculations.", "Süreç tanımlama hesaplamasında kullanılacak ürün reçetesini, birimini, fiyatını, çevrim süresini ve varsayılan transfer kurallarını tutun.")}</p>
            </div>
            <div className="operations-actions">
              <button type="button" className="operations-refresh-button" onClick={loadOperationsData}>{copy("Refresh Data", "Verileri Yenile")}</button>
            </div>
          </div>

          <div className="process-summary-grid operations-entry-summary">
            <article className="operation-card process-summary-card">
              <span>{copy("Products", "Ürünler")}</span>
              <strong>{formatNumber(operationsWorkspace.products.length)}</strong>
              <small>{copy("priced", "fiyatlı")}: {formatNumber(pricedProductCount)}</small>
            </article>
            <article className="operation-card process-summary-card">
              <span>{copy("Recipes", "Reçeteler")}</span>
              <strong>{formatNumber(productsWithRecipe)}</strong>
              <small>{formatNumber(productRecipeLinkCount)} {copy("material links", "malzeme bağlantısı")}</small>
            </article>
            <article className="operation-card process-summary-card">
              <span>{copy("Flow defaults", "Akış varsayılanı")}</span>
              <strong>{formatNumber(operationsWorkspace.products.length)}</strong>
              <small>{copy("ready for process definition", "süreç tanımlamaya hazır")}</small>
            </article>
          </div>

          <div className="operation-data-grid">
            <form ref={productFormRef} className="operation-card operation-data-form operations-product-form-card" onSubmit={(event) => handleSaveOperationRecord("product", event)}>
              <div className="operation-card-heading">
                <div>
                  <span>{copy("Product definition", "Ürün tanımı")}</span>
                  <h2>{copy("Commercial and production defaults", "Ticari ve üretim varsayılanları")}</h2>
                </div>
              </div>
              <div className="operation-data-fields">
                <label>
                  <span>{copy("Product name", "Ürün adı")}</span>
                  <input
                    type="text"
                    value={operationForms.product.name}
                    onChange={(event) => updateOperationForm("product", "name", event.target.value)}
                  />
                </label>
                <label>
                  <span>{copy("Unit", "Birim")}</span>
                  <select
                    value={operationForms.product.unit}
                    onChange={(event) => updateOperationForm("product", "unit", event.target.value)}
                  >
                    {["adet", "kg", "gr", "mg", "metre", "litre", "ml"].map((unit) => (
                      <option value={unit} key={unit}>{unit}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="label-with-info">
                    {copy("Price", "Fiyat")}
                    <InfoTip
                      label={copy("Product price info", "Ürün fiyatı bilgisi")}
                      text={copy("Sales revenue uses this product price x sold units, then applies channel discounts, commissions, and collection timing.", "Satış cirosu bu ürün fiyatı x satılan adet ile başlar; sonra kanal indirimi, komisyonu ve tahsilat zamanlaması uygulanır.")}
                    />
                  </span>
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={operationForms.product.price}
                    onChange={(event) => updateOperationForm("product", "price", event.target.value)}
                  />
                </label>
                <label>
                  <span className="label-with-info">
                    {copy("Currency", "Para birimi")}
                    <InfoTip
                      label={copy("Product currency info", "Ürün para birimi bilgisi")}
                      text={copy("Choose the currency for the sales price. Financial analysis converts USD/EUR product prices to TRY before revenue calculations.", "Satış fiyatının para birimini seçin. Finansal analiz USD/EUR ürün fiyatlarını ciro hesaplarından önce TL'ye çevirir.")}
                    />
                  </span>
                  <select
                    value={operationForms.product.priceCurrency}
                    onChange={(event) => updateOperationForm("product", "priceCurrency", event.target.value)}
                  >
                    {operationCurrencyOptions.map((currency) => (
                      <option value={currency} key={currency}>{currency}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="label-with-info">
                    {copy("Cycle time", "Çevrim süresi")}
                    <InfoTip
                      label={copy("Cycle time info", "Çevrim süresi bilgisi")}
                      text={copy("Cycle time defines how long one unit takes. Capacity is roughly available machine minutes divided by cycle time.", "Çevrim süresi bir ürünün ne kadar sürdüğünü belirtir. Kapasite kabaca kullanılabilir makine dakikası / çevrim süresi olarak hesaplanır.")}
                    />
                  </span>
                  <div className="cycle-time-control">
                    <input
                      min="0.0001"
                      step="0.01"
                      type="number"
                      value={operationForms.product.cycleTimeValue}
                      onChange={(event) => updateOperationForm("product", "cycleTimeValue", event.target.value)}
                    />
                    <select
                      aria-label={copy("Cycle time unit", "Çevrim süresi birimi")}
                      value={operationForms.product.cycleTimeUnit}
                      onChange={(event) => updateOperationForm("product", "cycleTimeUnit", event.target.value)}
                    >
                      <option value="minute">{copy("Minute", "Dakika")}</option>
                      <option value="hour">{copy("Hour", "Saat")}</option>
                      <option value="day">{copy("Day", "Gün")}</option>
                    </select>
                  </div>
                </label>
                <label>
                  <span className="label-with-info">
                    {copy("Default flow strategy", "Varsayılan akış stratejisi")}
                    <InfoTip
                      label={copy("Default flow strategy info", "Varsayılan akış stratejisi bilgisi")}
                      text={copy("Used as the starting strategy when this product is selected in Process Definition. The plan can still override it.", "Bu ürün Süreç Tanımlama'da seçildiğinde başlangıç stratejisi olarak kullanılır. Plan içinde yine değiştirilebilir.")}
                    />
                  </span>
                  <select
                    value={operationForms.product.defaultFlowStrategy}
                    onChange={(event) => updateOperationForm("product", "defaultFlowStrategy", event.target.value)}
                  >
                    <option value="flow">{productFlowStrategyLabels.flow}</option>
                    <option value="batch">{productFlowStrategyLabels.batch}</option>
                    <option value="parallel">{productFlowStrategyLabels.parallel}</option>
                  </select>
                </label>
                <label>
                  <span className="label-with-info">
                    {copy("Default batch size", "Varsayılan batch boyutu")}
                    <InfoTip
                      label={copy("Default batch size info", "Varsayılan batch boyutu bilgisi")}
                      text={copy("The normal transfer lot for this product in Flow mode, such as 5, 10, or 50 units.", "Bu ürün için Flow modundaki normal transfer lotudur; örneğin 5, 10 veya 50 adet.")}
                    />
                  </span>
                  <input
                    min="1"
                    step="1"
                    type="number"
                    value={operationForms.product.defaultBatchSize}
                    onChange={(event) => updateOperationForm("product", "defaultBatchSize", event.target.value)}
                  />
                </label>
                <label>
                  <span className="label-with-info">
                    {copy("Minimum transfer", "Minimum transfer")}
                    <InfoTip
                      label={copy("Minimum transfer info", "Minimum transfer bilgisi")}
                      text={copy("Smallest accepted quantity that can move to the next operation for this product.", "Bu ürün için sonraki operasyona aktarılabilecek kabul edilen en küçük miktar.")}
                    />
                  </span>
                  <input
                    min="1"
                    step="1"
                    type="number"
                    value={operationForms.product.minimumTransferQuantity}
                    onChange={(event) => updateOperationForm("product", "minimumTransferQuantity", event.target.value)}
                  />
                </label>
              </div>

              <div className="resource-section">
                <div className="resource-section-header">
                  <div>
                    <span>{copy("Required materials", "Gerekli malzemeler")}</span>
                    <p>{copy("Enter the materials and quantities required to produce one product unit.", "Bir ürün birimi üretmek için gereken malzemeleri ve miktarları girin.")}</p>
                  </div>
                  <button type="button" onClick={addProductMaterialRow}>{copy("Add Material", "Malzeme Ekle")}</button>
                </div>
                <div className="resource-row-list">
                  {productMaterialRows.length ? productMaterialRows.map((row, index) => {
                    const selectedMaterial = operationsWorkspace.materials.find((material) => material.id === row.materialId);

                    return (
                      <div className="resource-row-grid material-plan-row" key={`product-material-${index}`}>
                        <label>
                          <span>{copy("Material", "Malzeme")}</span>
                          <select value={row.materialId || ""} onChange={(event) => updateProductMaterialRow(index, "materialId", event.target.value)}>
                            <option value="">{copy("Select material", "Malzeme seç")}</option>
                            {operationsWorkspace.materials.map((material) => (
                              <option value={material.id} key={material.id}>{material.name}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>{copy("Quantity per unit", "Birim başına miktar")}</span>
                          <input
                            min="0"
                            step="0.0001"
                            type="number"
                            value={row.quantityPerUnit ?? ""}
                            onChange={(event) => updateProductMaterialRow(index, "quantityPerUnit", event.target.value)}
                          />
                        </label>
                        <div className="resource-row-meta">
                          <strong>{selectedMaterial?.unit || "-"}</strong>
                          <small>{selectedMaterial ? `${formatOperationMoney(selectedMaterial.price_per_unit, selectedMaterial.price_currency, exchangeRates, 2)} / ${selectedMaterial.unit}` : copy("No record selected", "Kayıt seçilmedi")}</small>
                        </div>
                        <button type="button" className="resource-remove-button" onClick={() => removeProductMaterialRow(index)}>
                          {copy("Delete", "Sil")}
                        </button>
                      </div>
                    );
                  }) : (
                    <p className="planner-empty-state">{copy("No recipe materials yet. Add materials on Material Definitions first, then connect them to the product here.", "Henüz reçete malzemesi yok. Önce Malzeme Tanımları ekranında malzeme ekleyin, sonra buradan ürüne bağlayın.")}</p>
                  )}
                </div>
              </div>

              <button className="submit-button planner-save-button" disabled={operationsLoading} type="submit">
                {operationsLoading ? copy("Saving...", "Kaydediliyor...") : copy("Save to Supabase", "Supabase'e Kaydet")}
              </button>
            </form>

            <article className="operation-card operation-data-table-card operations-product-list-card" style={productListHeightStyle}>
              <div className="operation-card-heading">
                <h2>{copy("Records", "Kayıtlar")}</h2>
                <span>{operationsWorkspace.products.length} {copy("records", "kayıt")}</span>
              </div>
              {renderSortableDataTable({
                columns: productColumns,
                gridTemplateColumns: "1.2fr 0.6fr 0.8fr 0.8fr 1fr 1.4fr",
                onRowClick: copyProductToForm,
                rows: operationsWorkspace.products,
                tableId: "products",
                useButtonRows: true,
              })}
            </article>
          </div>
          {operationsStatus && <p className="status-message">{operationsStatus}</p>}
        </section>,
    );
  }

  function renderActiveProcessesPage() {
    const activePlans = getCurrentOperationPlans(operationsWorkspaceForFinance);
    const processStrategyLabels = {
      batch: copy("Batch", "Batch"),
      flow: copy("Flow / Pull", "Akış / Pull"),
      parallel: copy("Parallel simulation", "Paralel simülasyon"),
    };

    return renderDashboardLayout(
      `operations/${activeOperationsSubmodule.key}`,
        <section className="operations-workspace operations-modern">
          <div className="operations-header">
            <div>
              <span>Operations / {copy("Active Processes", "Mevcut Süreçler")}</span>
              <h1>{copy("Active Processes", "Mevcut Süreçler")}</h1>
              <p>{copy("Track production plans saved to Supabase and their calculated production/cost results.", "Supabase'e kaydedilen üretim planlarını ve hesaplanan üretim/maliyet sonuçlarını takip edin.")}</p>
            </div>
            <div className="operations-actions">
              <button type="button" className="operations-refresh-button" onClick={loadOperationsData}>{copy("Refresh Data", "Verileri Yenile")}</button>
              <button type="button" className="operations-refresh-button" onClick={() => goTo("/operations/data-entry", "login")}>{copy("New Plan", "Yeni Plan")}</button>
            </div>
          </div>

          <div className="process-summary-grid">
            <article className="operation-card process-summary-card">
              <span>{copy("Active Plan", "Aktif Plan")}</span>
              <strong>{activePlans.length}</strong>
            </article>
            <article className="operation-card process-summary-card">
              <span>{copy("Total Production", "Toplam Üretim")}</span>
              <strong>{formatNumber(activePlans.reduce((total, plan) => total + (Number(plan.result?.producedQuantity) || 0), 0), 2)}</strong>
            </article>
            <article className="operation-card process-summary-card">
              <span>{copy("Tracked Cost", "Takip Edilen Maliyet")}</span>
              <strong>{formatLira(activePlans.reduce((total, plan) => total + (Number(plan.result?.totalTrackedDailyCost) || 0), 0))}</strong>
            </article>
          </div>

          <div className="process-list">
            {activePlans.length ? activePlans.map((plan) => {
              const result = plan.result || {};
              const productName = plan.product?.name || result.productName || plan.input?.productName || "-";
              const productUnit = result.productUnit || plan.product?.unit || copy("pcs", "adet");
              const machineRows = Array.isArray(result.machineRows) ? result.machineRows : [];
              const materialRows = Array.isArray(result.materialRows) ? result.materialRows : [];
              const operationRows = Array.isArray(result.operationRows) ? result.operationRows : [];
              const bufferRows = Array.isArray(result.bufferRows) ? result.bufferRows : [];

              return (
                <article className="operation-card process-card" key={plan.id}>
                  <div className="operation-card-heading">
                    <div>
                      <span>{new Date(plan.created_at).toLocaleString(locale)}</span>
                      <h2>{plan.plan_name || copy("Daily production plan", "Günlük üretim planı")}</h2>
                    </div>
                    <mark className="ok">{copy("Active", "Aktif")}</mark>
                  </div>

                  <div className="process-metrics">
                    <span>{copy("Product", "Ürün")} <strong>{productName}</strong></span>
                    <span>{copy("Quantity to Produce", "Üretilecek Miktar")} <strong>{formatNumber(result.producedQuantity, 2)} {productUnit}</strong></span>
                    <span>{copy("Cycle", "Çevrim")} <strong>{formatCycleTime(result.cycleTimeMinutes, plan.product?.cycle_time_unit || "minute")}</strong></span>
                    <span>{copy("Production Time", "Toplam süre")} <strong>{result.totalProductionTimeMinutes ? formatMinutesDuration(result.totalProductionTimeMinutes) : "-"}</strong></span>
                    <span>{copy("Strategy", "Strateji")} <strong>{processStrategyLabels[result.flowStrategy] || result.flowStrategy || "-"}</strong></span>
                    <span>{copy("Batch / Transfer", "Batch / Transfer")} <strong>{result.transferBatchSize ? formatNumber(result.transferBatchSize, 2) : "-"}</strong></span>
                    <span>{copy("Max WIP", "Maks WIP")} <strong>{formatNumber(result.maxWipQuantity, 2)}</strong></span>
                    <span>{copy("Bottleneck", "Darboğaz")} <strong>{result.bottleneck?.operationName || "-"}</strong></span>
                    <span>{copy("Main Machine Hours", "Ana Makine Saati")} <strong>{formatNumber(result.primaryMachineDailyHours, 2)} {copy("hours", "saat")}</strong></span>
                    <span>{copy("Energy", "Enerji")} <strong>{formatNumber(result.energyConsumptionKwh, 2)} kWh</strong></span>
                    <span>{copy("Cost", "Maliyet")} <strong>{formatLira(result.totalTrackedDailyCost)}</strong></span>
                  </div>

                  <div className="process-detail-grid">
                    <div>
                      <h3>{copy("Operations", "Operasyonlar")}</h3>
                      {(operationRows.length ? operationRows : [{ operationId: "empty", operationName: "-", machineName: "-", busyMinutes: 0 }]).map((row, index) => (
                        <span key={row.operationId || `operation-${index}`}>
                          {row.operationName} <strong>{row.machineName || "-"} / {formatMinutesDuration(row.busyMinutes || 0)}</strong>
                        </span>
                      ))}
                    </div>
                    <div>
                      <h3>{copy("Buffers", "Buffer")}</h3>
                      {(bufferRows.length ? bufferRows : [{ fromOperationName: "-", toOperationName: "-", maxWip: 0 }]).map((row, index) => (
                        <span key={`${row.fromOperationName}-${row.toOperationName}-${index}`}>
                          {row.fromOperationName} -&gt; {row.toOperationName} <strong>{formatNumber(row.maxWip, 2)} WIP</strong>
                        </span>
                      ))}
                    </div>
                    <div>
                      <h3>{copy("Machines", "Makineler")}</h3>
                      {(machineRows.length ? machineRows : [{ machineId: "empty", name: "-", dailyHours: 0 }]).map((row) => (
                        <span key={row.machineId}>
                          {row.name} <strong>{formatNumber(row.dailyHours, 2)} {copy("hours", "saat")}{Number.isFinite(Number(row.utilizationPercent)) ? ` / ${formatNumber(row.utilizationPercent, 1)}%` : ""}</strong>
                        </span>
                      ))}
                    </div>
                    <div>
                      <h3>{copy("Material Usage", "Malzeme Kullanımı")}</h3>
                      {(materialRows.length ? materialRows : [{ materialId: "empty", name: "-", dailyQuantity: 0, unit: "" }]).map((row) => (
                        <span key={row.materialId}>
                          {row.name} <strong>{formatNumber(row.dailyQuantity, 4)} {row.unit || ""}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            }) : (
              <article className="operation-card process-card">
                <p className="planner-empty-state">{copy("No production plans saved to Supabase yet. Save a plan from the process definition screen and it will appear here.", "Henüz Supabase'e kaydedilmiş üretim planı yok. Süreç tanımlama ekranından plan kaydedince burada görünecek.")}</p>
              </article>
            )}
          </div>

          {operationsStatus && <p className="status-message">{operationsStatus}</p>}
        </section>,
    );
  }

  function renderFinancialModellingPage() {
    const model = buildFinancialFeasibilityModel(financialModel, salesStrategy, financialSettingsForModel, operationsWorkspaceForFinance, financialHorizon);
    const statementProjectionModel = financialHorizon === "5y"
      ? model
      : buildFinancialFeasibilityModel(financialModel, salesStrategy, financialSettingsForModel, operationsWorkspaceForFinance, "5y");
    const summary = model.summary || emptyFinancialModel.summary;
    const incomeExpenseTrendChart = buildIncomeExpenseTrendChart(model.trendRows || []);
    const currentFinancialPage = activeFinancialSubmodule || financialSubmodules[0];
    const investmentTotal = (summary.machinePurchaseCost || 0) + (summary.equipmentPurchaseCost || 0) + (summary.extraInitialCost || 0) + (summary.workingCapitalRequirement || 0);
    const returnOnInvestment = investmentTotal ? `${formatNumber(((summary.netIncome || 0) / investmentTotal) * 100, 1)}%` : "-";
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
      let revenueBadgeY = latestRevenuePoint ? clampBadgeY(latestRevenuePoint.y - (badgeHeight / 2)) : 0;
      let costBadgeY = latestCostPoint ? clampBadgeY(latestCostPoint.y - (badgeHeight / 2)) : 0;

      if (latestRevenuePoint && latestCostPoint && Math.abs(revenueBadgeY - costBadgeY) < badgeHeight + badgeMinGap) {
        const midpoint = clampBadgeY(((revenueBadgeY + costBadgeY) / 2) - (badgeHeight / 2));
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
        <div className={`financial-trend-stage ${incomeExpenseChartInView ? "is-visible" : ""}`} ref={setIncomeExpenseChartElement} key={chartToken}>
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
            <linearGradient id={incomeStrokeId} x1={incomeExpenseTrendChart.plot.left} x2={incomeExpenseTrendChart.plot.right} y1="0" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--color-teal)" />
              <stop offset="45%" stopColor="var(--color-cyan)" />
              <stop offset="100%" stopColor="#7c5cff" />
            </linearGradient>
            <linearGradient id={expenseStrokeId} x1={incomeExpenseTrendChart.plot.left} x2={incomeExpenseTrendChart.plot.right} y1="0" y2="0" gradientUnits="userSpaceOnUse">
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
          <text className="axis-label axis-label-y chart-axis-title" x={incomeExpenseTrendChart.plot.left} y="18">{copy("Amount (TRY)", "Tutar (TRY)")}</text>
          <text className="axis-label axis-label-x" x="260" y="266">{copy("Date", "Tarih")}</text>
          <path className="chart-grid" d={incomeExpenseTrendChart.gridPath} />
          {incomeExpenseTrendChart.xTicks.map((tick) => (
            <line className="chart-x-guide" x1={tick.x} x2={tick.x} y1={incomeExpenseTrendChart.plot.top} y2={incomeExpenseTrendChart.plot.bottom} key={`guide-${tick.x}`} />
          ))}
          <path className="chart-axis" d={incomeExpenseTrendChart.axisPath} />
          {incomeExpenseTrendChart.yTicks.map((tick) => (
            <text className="chart-tick chart-tick-y" x={incomeExpenseTrendChart.plot.left - 8} y={tick.y + 4} textAnchor="end" key={tick.value}>
              {tick.label}
            </text>
          ))}
          {incomeExpenseTrendChart.xTicks.map((tick) => (
            <text className="chart-tick chart-tick-x" x={tick.x} y="235" textAnchor="middle" key={`${tick.x}-${tick.label}`}>
              {tick.label}
            </text>
          ))}
          {incomeExpenseTrendChart.revenueAreaPath && <path className="trend-area sales chart-area-fill" d={incomeExpenseTrendChart.revenueAreaPath} style={{ fill: `url(#${incomeSurfaceId})` }} />}
          {incomeExpenseTrendChart.costAreaPath && <path className="trend-area costs chart-area-fill" d={incomeExpenseTrendChart.costAreaPath} style={{ fill: `url(#${expenseSurfaceId})` }} />}
          <line className="chart-badge-rail" x1="448" x2="448" y1="34" y2="218" />
          {incomeExpenseTrendChart.revenuePath && <path className="trend-line-glow sales chart-draw-line" d={incomeExpenseTrendChart.revenuePath} filter={`url(#${trendGlowId})`} pathLength="1" style={{ stroke: `url(#${incomeStrokeId})` }} />}
          {incomeExpenseTrendChart.costPath && <path className="trend-line-glow costs chart-draw-line" d={incomeExpenseTrendChart.costPath} filter={`url(#${trendGlowId})`} pathLength="1" style={{ stroke: `url(#${expenseStrokeId})` }} />}
          {incomeExpenseTrendChart.revenuePath && <path className="trend-line sales chart-draw-line" d={incomeExpenseTrendChart.revenuePath} pathLength="1" style={{ stroke: `url(#${incomeStrokeId})` }} />}
          {incomeExpenseTrendChart.costPath && <path className="trend-line costs chart-draw-line" d={incomeExpenseTrendChart.costPath} pathLength="1" style={{ stroke: `url(#${expenseStrokeId})` }} />}
          {revenuePoints.map((point, index) => (
            <circle className="trend-point sales" cx={point.x} cy={point.y} r={index === revenuePoints.length - 1 ? 4.8 : 3.2} style={{ animationDelay: `${760 + (index * 36)}ms` }} key={`sales-${index}`} />
          ))}
          {costPoints.map((point, index) => (
            <circle className="trend-point costs" cx={point.x} cy={point.y} r={index === costPoints.length - 1 ? 4.8 : 3.2} style={{ animationDelay: `${820 + (index * 36)}ms` }} key={`cost-${index}`} />
          ))}
          {latestRevenuePoint && (
            <>
              <path className="chart-badge-connector sales" d={`M${latestRevenuePoint.x + 7} ${latestRevenuePoint.y} C${latestRevenuePoint.x + 28} ${latestRevenuePoint.y}, ${badgeX - 18} ${revenueBadgeY + 17}, ${badgeX} ${revenueBadgeY + 17}`} pathLength="1" />
              <g className="chart-value-badge sales" transform={`translate(${badgeX} ${revenueBadgeY})`}>
                <rect width="86" height={badgeHeight} rx="8" />
                <text className="chart-value-badge-label" x="12" y="13">{copy("Income", "Gelir")}</text>
                <text className="chart-value-badge-amount" x="12" y="27">{formatTrendAxisAmount(latestRevenuePoint.value)}</text>
              </g>
            </>
          )}
          {latestCostPoint && (
            <>
              <path className="chart-badge-connector costs" d={`M${latestCostPoint.x + 7} ${latestCostPoint.y} C${latestCostPoint.x + 28} ${latestCostPoint.y}, ${badgeX - 18} ${costBadgeY + 17}, ${badgeX} ${costBadgeY + 17}`} pathLength="1" />
              <g className="chart-value-badge costs" transform={`translate(${badgeX} ${costBadgeY})`}>
                <rect width="86" height={badgeHeight} rx="8" />
                <text className="chart-value-badge-label" x="12" y="13">{copy("Expense", "Gider")}</text>
                <text className="chart-value-badge-amount" x="12" y="27">{formatTrendAxisAmount(latestCostPoint.value)}</text>
              </g>
            </>
          )}
        </svg>
        </div>
      );
    };
    const financialPageMeta = {
      inputs: {
        description: copy("Enter financial assumptions and extra costs used by the feasibility model.", "Fizibilite modelinde kullanılacak finansal varsayımları ve ek giderleri girin."),
        title: "Girdiler",
      },
      overview: {
        description: copy("Review all financial rows and the income-expense projection. Add only the widgets you want to keep on your saved screen.", "Tüm finansal satırları ve gelir-gider projeksiyonunu inceleyin. Kayıtlı ekranınızda tutmak istediğiniz widgetları ayrıca ekleyin."),
        title: copy("Cost & Return Analysis", "Maliyet & Getiri Analizi"),
      },
      loans: {
        description: copy("Add financing loans separately from optional expenses. Each loan needs its own amount, annual interest, and term.", "Finansman kredilerini opsiyonel giderlerden ayrı girin. Her kredinin tutarı, yıllık faizi ve vadesi ayrı olmalıdır."),
        title: copy("Loans", "Krediler"),
      },
      "product-cost": {
        description: copy("Product cost is calculated from active operation plans, product recipes, machine energy, workforce, materials, and recurring extra costs.", "Ürün maliyeti; aktif operasyon planları, ürün reçeteleri, makine enerjisi, işgücü, malzeme ve tekrarlayan ek giderlerden hesaplanır."),
        title: "Ürün Maliyeti",
      },
      "investment-cost": {
        description: copy("Investment cost combines machine purchase cost and initial extra costs coming from the financial model.", "Yatırım maliyeti; finansal modelden gelen makine satın alma maliyeti ve başlangıç ek giderlerini birleştirir."),
        title: "Yatırım Maliyeti",
      },
      "product-return": {
        description: copy("Product return compares operation-based sales revenue with tracked production expenses and net income.", "Ürün getirisi; operasyon bazlı satış kazançlarını takip edilen üretim giderleri ve net kazançla karşılaştırır."),
        title: "Ürün Getirisi",
      },
      "investment-return": {
        description: copy("Investment return compares net income with the current machine and initial-cost investment base.", "Yatırım getirisi; net kazancı mevcut makine ve başlangıç maliyeti yatırım tabanıyla karşılaştırır."),
        title: "Yatırım Getirisi",
      },
    }[currentFinancialPage.key];
    const metricRowsByPage = {
      "product-cost": [
        [copy("Active Process", "Mevcut Süreç"), summary.planCount],
        [copy("Working Days", "Çalışma Günü"), formatNumber(summary.workingDaysPerMonth, 1)],
        [copy("Material Cost", "Malzeme Maliyeti"), formatLira(summary.materialCost)],
        [copy("Total Expense", "Toplam Gider"), formatLira(summary.totalCost)],
      ],
      "investment-cost": [
        [copy("Initial Cash Needed", "Gerekli Başlangıç Nakit"), formatLira(summary.initialCashRequired)],
        [copy("Working Capital", "İşletme Sermayesi"), formatLira(summary.workingCapitalRequirement)],
        [copy("Loan Amount", "Kredi Tutarı"), formatLira(summary.loanAmount)],
        [copy("Total Investment", "Toplam Yatırım"), formatLira(investmentTotal)],
      ],
      "product-return": [
        [copy("Sales Revenue", "Satış Kazançları"), formatLira(summary.salesRevenue)],
        [copy("Net Sold", "Net Satılan"), formatNumber(summary.netSoldUnits)],
        [copy("Net Income", "Net Kazanç"), formatLira(summary.netIncome)],
        [copy("Required Monthly Sales", "Gerekli Aylık Satış"), formatNumber(summary.requiredMonthlySalesVolume)],
      ],
      "investment-return": [
        [copy("Net Income", "Net Kazanç"), formatLira(summary.netIncome)],
        [copy("Cash Runway", "Nakit Dayanma Süresi"), `${formatNumber(summary.cashRunwayMonths)} ${copy("mo", "ay")}`],
        [copy("Payback", "Geri Ödeme"), formatMonth(summary.paybackMonth)],
        [copy("ROI", "Yatırım Getirisi"), returnOnInvestment],
      ],
    };
    const isCostPage = currentFinancialPage.key.includes("cost");
    const isInvestmentPage = currentFinancialPage.key.includes("investment");
    const costBreakdownRows = (model.costStructure || []).filter((item) => toFiniteNumber(item.amount) > 0);
    const investmentBreakdownRows = [
      { amount: summary.machinePurchaseCost, id: "machinePurchase", label: copy("Machine investment", "Makine yatırımı") },
      { amount: summary.equipmentPurchaseCost, id: "equipmentPurchase", label: copy("Equipment investment", "Ekipman yatırımı") },
      { amount: summary.extraInitialCost, id: "extraInitialCost", label: copy("Initial extra costs", "Başlangıç ek giderleri") },
      { amount: summary.workingCapitalRequirement, id: "workingCapital", label: copy("Working capital requirement", "İşletme sermayesi ihtiyacı") },
    ].filter((item) => toFiniteNumber(item.amount) > 0);
    const returnBreakdownRows = [
      { amount: summary.salesRevenue, id: "salesRevenue", label: copy("Sales revenue", "Satış geliri"), tone: "income" },
      { amount: summary.netIncome, id: "netIncome", label: copy("Net income", "Net kazanç"), tone: "net" },
      { amount: summary.totalCashFlow, id: "cashFlow", label: copy("Total cash flow", "Toplam nakit akışı"), tone: "cash" },
    ];
    const maxCostBreakdownAmount = Math.max(1, ...costBreakdownRows.map((item) => toFiniteNumber(item.amount)));
    const maxInvestmentBreakdownAmount = Math.max(1, ...investmentBreakdownRows.map((item) => toFiniteNumber(item.amount)));
    const maxReturnBreakdownAmount = Math.max(1, ...returnBreakdownRows.map((item) => Math.abs(toFiniteNumber(item.amount))));
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
      assetValueIncreaseAnnualPercent: { label: copy("Asset value increase % / year", "Varlık değer artışı (% yıllık)"), min: "0", step: "0.01" },
      cogsInflationAnnualPercent: { label: copy("COGS inflation % / year", "SMM enflasyonu (% yıllık)"), min: "0", step: "0.01" },
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
      initialCash: { info: copy("Cash available at the start of the model. Loans and grants are added separately, so do not include them here unless they are already in the bank.", "Model başlangıcındaki hazır nakit. Krediler ve hibeler ayrıca eklenir; bankada hazır değilse burada tekrar yazmayın."), label: copy("Initial cash", "Başlangıç nakdi"), min: "0", step: "1000" },
      initialCapacityUnits: { label: copy("Initial capacity (month 1)", "Başlangıç kapasitesi (Ay 1)"), min: "0", step: "1" },
      investmentGrantAmount: { info: copy("Non-loan funding that enters cash as support. It reduces required own cash but does not create monthly repayments.", "Kredi olmayan destek/hibe/yatırım girişi. Gerekli öz kaynağı azaltır ama aylık ödeme oluşturmaz."), label: copy("Investment / grant to receive", "Alınacak yatırım / hibe"), min: "0", step: "1000" },
      monthlyCurrencyIncreasePercent: { info: copy("Applied as a monthly multiplier to currency-sensitive material costs. Example: 2% means next month is cost x 1.02 before other inflation assumptions.", "Dövize hassas malzeme maliyetlerine aylık çarpan olarak uygulanır. Örn. %2, sonraki ay diğer enflasyon varsayımlarından önce maliyet x 1,02 demektir."), label: copy("Monthly FX increase %", "Aylık döviz artışı %"), min: "0", step: "0.01" },
      monthlyEnergyPriceIncreasePercent: { info: copy("Raises electricity cost month by month. If left at zero, the model falls back to the general monthly inflation assumption.", "Elektrik maliyetini aylık artırır. Sıfır kalırsa model genel aylık enflasyon varsayımını kullanır."), label: copy("Monthly energy price increase %", "Aylık enerji fiyat artışı %"), min: "0", step: "0.01" },
      monthlyInflationPercent: { info: copy("General monthly cost pressure used for overheads and fallback cost increases. It compounds over the selected projection horizon.", "Genel aylık maliyet baskısıdır; genel giderlerde ve yedek maliyet artışlarında kullanılır. Seçilen projeksiyon dönemi boyunca bileşik işler."), label: copy("Monthly inflation %", "Aylık enflasyon %"), min: "0", step: "0.01" },
      monthlyWageIncreasePercent: { label: copy("Monthly wage increase %", "Aylık ücret artışı %"), min: "0", step: "0.01" },
      opexInflationAnnualPercent: { label: copy("OpEx inflation % / year", "OpEx enflasyonu (% yıllık)"), min: "0", step: "0.01" },
      priceIncreaseAnnualPercent: { label: copy("Price increase policy % / year", "Fiyat artış politikası (% yıllık)"), min: "0", step: "0.01" },
      rawMaterialBufferMonths: { label: copy("Material buffer months", "Malzeme tampon ay"), min: "0", step: "0.1" },
      rawMaterialStockDays: { info: copy("Extra days of material held before sale. More stock days increase working capital need.", "Satıştan önce elde tutulan ek hammadde günü. Gün arttıkça işletme sermayesi ihtiyacı yükselir."), label: copy("Raw material stock holding days", "Hammadde stok tutma süresi (gün)"), min: "0", step: "1" },
      receivablesCollectionDays: { info: copy("Average delay before sales cash is collected. 45 days means revenue usually enters cash roughly two model months later.", "Satış nakdinin ortalama tahsil gecikmesi. 45 gün, cironun nakde yaklaşık iki model ayı sonra girmesi demektir."), label: copy("Receivables collection days", "Alacak tahsil süresi (gün)"), min: "0", step: "1" },
      rentBufferMonths: { label: copy("Rent buffer months", "Kira tampon ay"), min: "0", step: "0.1" },
      salaryBufferMonths: { label: copy("Salary buffer months", "Maaş tampon ay"), min: "0", step: "0.1" },
      salesVatRate: { label: copy("Average sales VAT %", "Ortalama satış KDV oranı (%)"), min: "0", step: "0.01" },
      supplierPaymentDays: { label: copy("Supplier payment days", "Tedarikçi ödeme süresi (gün)"), min: "0", step: "1" },
      taxPaymentDelayMonths: { label: copy("Tax payment delay months", "Vergi ödeme gecikmesi (ay)"), min: "0", step: "1" },
      workingDaysPerMonth: { info: copy("Daily production and daily costs are multiplied by this number to create monthly production capacity and monthly operating cost.", "Günlük üretim ve günlük maliyetler bu değerle çarpılarak aylık kapasite ve aylık operasyon maliyeti hesaplanır."), label: copy("Working days / month", "Aylık çalışma günü"), min: "1", step: "1" },
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
                <option value={value} key={value}>{label}</option>
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
                    ? `${copy("Rates loaded from", "Kurlar şu kaynaktan alındı")}: ${exchangeRates.sourceDetail || exchangeRates.source}. ${copy("Operations prices entered in USD/EUR are converted to TRY in financial analysis.", "Operations tarafında USD/EUR girilen fiyatlar finansal analizde TL'ye çevrilir.")}`
                    : copy("Latest Supabase rates appear here first. Click fetch prices to refresh USD/TRY and EUR/TRY from TCMB and save them.", "Önce Supabase'deki son kurlar burada görünür. USD/TRY ve EUR/TRY değerlerini TCMB'den yenileyip kaydetmek için fiyatları çek butonuna basın.")}
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
              {exchangeRates.status === "loading" ? copy("Fetching...", "Çekiliyor...") : copy("Fetch Prices", "Fiyatları Çek")}
            </button>
            <strong>{exchangeRates.status === "ready" ? exchangeRates.source : exchangeRates.status === "loading" ? copy("Loading", "Yükleniyor") : copy("Manual", "Manuel")}</strong>
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
              <small>{exchangeRates.updatedAt ? new Date(exchangeRates.updatedAt).toLocaleString(locale) : copy("Waiting for saved or fetched rate", "Kayıtlı veya çekilmiş kur bekleniyor")}</small>
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
                <p>{copy("These assumptions must be present for the financial model to be saved.", "Finansal modelin kaydedilmesi için bu varsayımlar girilmelidir.")}</p>
              </div>
              <strong>{requiredFinancialSettingFields.length}</strong>
            </summary>
            <div className="financial-input-grid">
              {requiredFinancialSettingFields.map((field) => renderFinancialField(field, true))}
            </div>
          </details>

          <details className="financial-input-section general-financial-assumptions progressive-input-box">
            <summary className="financial-input-section-heading progressive-section-summary">
              <div>
                <span>{copy("General financial assumptions", "Genel finansal varsayımlar")}</span>
                <p>{copy("Grant, tax, VAT, collection, supplier payment, stock holding and starting capacity assumptions.", "Yatırım/hibe, vergi, KDV, tahsilat, tedarikçi ödeme, stok tutma ve başlangıç kapasitesi varsayımları.")}</p>
              </div>
              <strong>{generalFinancialAssumptionFields.length}</strong>
            </summary>
            <div className="financial-input-grid">
              {generalFinancialAssumptionFields.map((field) => renderFinancialField(field, true))}
            </div>
          </details>

          <details className="financial-input-section optional-macro-section progressive-input-box">
            <summary className="financial-input-section-heading progressive-section-summary">
              <div>
                <span>{copy("Optional macro assumptions", "Opsiyonel makro varsayımlar")}</span>
                <p>{copy("These percentages can inflate material, wage, energy and overhead projections month by month. Leave empty or zero to ignore.", "Bu yüzdeler malzeme, ücret, enerji ve genel gider projeksiyonlarını aylık artırabilir. Dikkate almak istemiyorsanız boş veya sıfır bırakın.")}</p>
              </div>
              <strong>{optionalMacroFinancialSettingFields.length}</strong>
            </summary>
            <div className="financial-input-grid">
              {optionalMacroFinancialSettingFields.map((field) => renderFinancialField(field, false))}
            </div>
          </details>

          <details className="financial-input-section inflation-revaluation-section progressive-input-box">
            <summary className="financial-input-section-heading progressive-section-summary">
              <div>
                <span>{copy("Inflation and revaluation", "Enflasyon ve yeniden değerleme")}</span>
                <p>{copy("Annual COGS, OpEx, price increase and asset value policies. Frequency controls how annual increases step through the projection.", "Yıllık SMM, OpEx, fiyat artışı ve varlık değer politikaları. Artış sıklığı yıllık artışların projeksiyona nasıl dağıtılacağını belirler.")}</p>
              </div>
              <strong>{inflationRevaluationFinancialFields.length}</strong>
            </summary>
            <div className="financial-input-grid">
              {inflationRevaluationFinancialFields.map((field) => renderFinancialField(field, true))}
            </div>
          </details>

          <button type="submit" disabled={financialLoading}>{copy("Save Assumptions", "Varsayımları Kaydet")}</button>
        </form>

        <form className="financial-extra-cost-form" onSubmit={handleSaveFinancialExtraCost}>
          <div className="financial-input-section-heading">
            <div>
              <span>{copy("Optional expense", "Opsiyonel gider")}</span>
              <p>{copy("Add one-off or recurring costs without breaking the main assumption grid.", "Ana varsayım gridini bozmadan tek seferlik veya tekrarlayan gider ekleyin.")}</p>
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
                onChange={(event) => setFinancialExtraCostForm((current) => ({ ...current, costType: event.target.value }))}
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
            <button type="submit" disabled={financialLoading}>{copy("Add Optional Expense", "Opsiyonel Gider Ekle")}</button>
          </div>
        </form>
      </div>
    );
    const financialLoanRows = Array.isArray(financialSettingsForm.loanRows) ? financialSettingsForm.loanRows : [];
    const calculatedLoanRows = getFinancialLoanRows(financialSettingsForm);
    const longestLoanTerm = calculatedLoanRows.reduce((longestTerm, loan) => Math.max(longestTerm, loan.loanTermMonths), 0);
    const longestGracePeriod = calculatedLoanRows.reduce((longestGrace, loan) => Math.max(longestGrace, loan.gracePeriodMonths), 0);
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
          return (firstIndex === -1 ? 999 : firstIndex) - (secondIndex === -1 ? 999 : secondIndex)
            || first.currency.localeCompare(second.currency);
        });
    };
    const formatLoanCurrencyTotals = (totals) => (
      totals.length
        ? totals.map((total) => formatCurrencyAmount(total.amount, total.currency)).join(" / ")
        : "-"
    );
    const loanAmountTotals = getLoanCurrencyTotals((loan) => loan.amount);
    const monthlyLoanPaymentTotals = getLoanCurrencyTotals((loan) => loan.monthlyPayment);
    const estimatedLoanInterestTotals = getLoanCurrencyTotals((loan) => (
      Math.max(0, (loan.monthlyPayment * loan.repaymentTermMonths) - loan.amount)
    ));
    const totalLoanAmountTry = calculatedLoanRows.reduce((total, loan) => (
      total + convertMoneyToTry(loan.amount, loan.currency, exchangeRates)
    ), 0);
    const totalMonthlyLoanPaymentTry = calculatedLoanRows.reduce((total, loan) => (
      total + convertMoneyToTry(loan.monthlyPayment, loan.currency, exchangeRates)
    ), 0);
    const estimatedLoanInterestTry = calculatedLoanRows.reduce((total, loan) => (
      total + convertMoneyToTry(Math.max(0, (loan.monthlyPayment * loan.repaymentTermMonths) - loan.amount), loan.currency, exchangeRates)
    ), 0);
    const hasForeignCurrencyLoan = calculatedLoanRows.some((loan) => normalizeCurrencyCode(loan.currency) !== "TRY");
    const canConvertLoanCurrencies = !hasForeignCurrencyLoan || hasUsableExchangeRates(exchangeRates);
    const loanTryDetail = canConvertLoanCurrencies
      ? copy("TRY + USD x USD/TRY + EUR x EUR/TRY", "TL + USD x USD/TRY + EUR x EUR/TRY")
      : exchangeRates.status === "loading"
        ? copy("FX rates are loading", "kurlar yükleniyor")
        : copy("USD/EUR rate needed", "USD/EUR kuru gerekli");
    const formatLoanTryTotal = (value) => canConvertLoanCurrencies
      ? formatLira(value)
      : copy("FX rate needed", "Kur gerekli");
    const loanPaymentCalendar = buildFinancialLoanPaymentCalendar(calculatedLoanRows);
    const renderFinancialLoanPaymentCalendar = () => (
      <section className="financial-input-section optional financial-loan-calendar-section">
        <div className="financial-input-section-heading">
          <div>
            <span>{copy("Payment calendar", "Ödeme takvimi")}</span>
            <p>{copy("Months start from the current month. Colored cells show which loan has a payment in that month and the required amount.", "Aylar içinde bulunduğunuz aydan başlar. Renkli hücreler o ay hangi kredinin ödemesi olduğunu ve gereken tutarı gösterir.")}</p>
          </div>
          <strong>{loanPaymentCalendar.months.length} {copy("mo", "ay")}</strong>
        </div>
        <div className="financial-loan-calendar-scroll">
          <div
            className="financial-loan-calendar-grid"
            style={{ gridTemplateColumns: `minmax(122px, 0.72fr) repeat(${loanPaymentCalendar.months.length}, minmax(64px, 1fr))` }}
          >
            <div className="loan-calendar-cell loan-calendar-corner">{copy("Loan", "Kredi")}</div>
            {loanPaymentCalendar.months.map((month) => (
              <div className="loan-calendar-cell loan-calendar-month" key={month.key}>
                <strong>{month.label}</strong>
              </div>
            ))}

            {loanPaymentCalendar.rows.length ? loanPaymentCalendar.rows.map((row, rowIndex) => (
              <React.Fragment key={row.loan.id || `calendar-loan-${rowIndex}`}>
                <div className="loan-calendar-cell loan-calendar-loan">
                  <strong>{row.loan.name || `${copy("Loan", "Kredi")} ${rowIndex + 1}`}</strong>
                  <span>{row.loan.currency} / {formatCurrencyAmount(row.loan.amount, row.loan.currency)}</span>
                </div>
                {row.payments.map((payment) => (
                  <div className="loan-calendar-cell loan-calendar-payment-cell" key={`${row.loan.id}-${payment.monthKey}`}>
                    {payment.isActive && (
                      <div className={`loan-calendar-payment tone-${row.tone}`}>
                        <strong>{formatCurrencyAmount(payment.amount, row.loan.currency)}</strong>
                        <span>{row.loan.name || `${copy("Loan", "Kredi")} ${rowIndex + 1}`}</span>
                      </div>
                    )}
                  </div>
                ))}
              </React.Fragment>
            )) : (
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
                {month.totals.length ? month.totals.map((total) => (
                  <span key={total.currency}>{formatCurrencyAmount(total.amount, total.currency)}</span>
                )) : <span>-</span>}
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
            <p>{copy("Add each loan separately, including its no-payment grace period. The feasibility model starts cash payments after the grace months.", "Her krediyi ayrı ekleyin; ilk kaç ay ödeme olmayacağını belirtin. Fizibilite modeli nakit ödemeleri ödemesiz aylar bittikten sonra başlatır.")}</p>
          </div>
          <button type="button" onClick={addFinancialLoanRow}>{copy("Add Loan", "Kredi Ekle")}</button>
        </section>

        <section className="financial-loan-summary-grid">
          {[
            [copy("Total loan", "Toplam kredi"), formatLoanCurrencyTotals(loanAmountTotals), copy("by currency", "döviz bazında")],
            [copy("Total loan in TRY", "TL bazlı toplam kredi"), formatLoanTryTotal(totalLoanAmountTry), loanTryDetail],
            [copy("Monthly payment", "Aylık ödeme"), formatLoanCurrencyTotals(monthlyLoanPaymentTotals), copy("after grace periods", "ödemesiz aylar sonrası")],
            [copy("Monthly payment in TRY", "TL bazlı aylık ödeme"), formatLoanTryTotal(totalMonthlyLoanPaymentTry), loanTryDetail],
            [copy("Longest term", "En uzun vade"), `${formatNumber(longestLoanTerm)} ${copy("mo", "ay")}`, copy("including grace", "ödemesiz ay dahil")],
            [copy("Longest grace", "En uzun ödemesiz"), `${formatNumber(longestGracePeriod)} ${copy("mo", "ay")}`, copy("no cash payment", "nakit ödeme yok")],
            [copy("Estimated interest", "Tahmini faiz"), formatLoanCurrencyTotals(estimatedLoanInterestTotals), copy("based on current terms", "mevcut koşullara göre")],
            [copy("Estimated interest in TRY", "TL bazlı tahmini faiz"), formatLoanTryTotal(estimatedLoanInterestTry), loanTryDetail],
          ].map(([label, value, detail]) => (
            <article className="financial-loan-summary-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{detail}</small>
            </article>
          ))}
        </section>

        <section className="financial-loan-currency-section" aria-label={copy("Loan currency breakdown", "Kredi döviz kırılımı")}>
          {(loanAmountTotals.length ? loanAmountTotals : [{ amount: 0, currency: "TRY" }]).map((total) => {
            const monthlyTotal = monthlyLoanPaymentTotals.find((item) => item.currency === total.currency)?.amount || 0;
            const loanCount = calculatedLoanRows.filter((loan) => normalizeCurrencyCode(loan.currency) === total.currency).length;

            return (
              <article className="financial-loan-currency-card" key={total.currency}>
                <span>{total.currency}</span>
                <strong>{total.amount ? formatCurrencyAmount(total.amount, total.currency) : "-"}</strong>
                <small>
                  {loanCount ? `${formatNumber(loanCount)} ${copy("loan", "kredi")} / ${formatCurrencyAmount(monthlyTotal, total.currency)} ${copy("monthly", "aylık")}` : copy("No loan yet", "Henüz kredi yok")}
                </small>
              </article>
            );
          })}
        </section>

        <details className="financial-input-section optional financial-loan-section progressive-input-box">
          <summary className="financial-input-section-heading progressive-section-summary">
            <div>
              <span>{copy("Loan records", "Kredi kayıtları")}</span>
              <p>{copy("Every loan row must include amount, annual interest, grace period, and term. Leave this page empty if there is no loan.", "Her kredi satırında tutar, yıllık faiz, ödemesiz ay ve vade girilmelidir. Kredi yoksa bu sayfayı boş bırakabilirsiniz.")}</p>
            </div>
            <strong>{financialLoanRows.length}</strong>
          </summary>
          <div className="financial-loan-list">
            {financialLoanRows.length ? financialLoanRows.map((loan, index) => {
              const calculatedLoan = calculatedLoanRows.find((row) => row.id === loan.id) || calculatedLoanRows[index] || {};

              return (
                <details className="financial-loan-card progressive-input-box financial-loan-record-box" key={loan.id || `loan-${index}`}>
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
                          <option value={currency} key={currency}>{currency}</option>
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
                    <span>{copy("Payment starts", "Ödeme başlangıcı")}<strong>{calculatedLoan.paymentStartDate ? formatMonthLabel(parseDateInput(calculatedLoan.paymentStartDate)) : "-"}</strong></span>
                    <span>{copy("Payment ends", "Ödeme bitişi")}<strong>{calculatedLoan.paymentEndDate ? formatMonthLabel(parseDateInput(calculatedLoan.paymentEndDate)) : "-"}</strong></span>
                    <span>{copy("Repayment term", "Ödeme vadesi")}<strong>{formatNumber(calculatedLoan.repaymentTermMonths || 0)} {copy("mo", "ay")}</strong></span>
                    <span>{copy("Monthly payment", "Aylık ödeme")}<strong>{formatCurrencyAmount(calculatedLoan.monthlyPayment || 0, calculatedLoan.currency)}</strong></span>
                  </div>
                </details>
              );
            }) : (
              <p className="planner-empty-state loan-empty-state">{copy("No loan added. The model will use zero loan.", "Kredi eklenmedi. Model sıfır kredi kullanacak.")}</p>
            )}
          </div>
        </details>
        {renderFinancialLoanPaymentCalendar()}
        <div className="financial-loan-actions">
          <button type="button" onClick={addFinancialLoanRow}>{copy("Add Loan", "Kredi Ekle")}</button>
          <button type="submit" disabled={financialLoading}>{copy("Save Loans", "Kredileri Kaydet")}</button>
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
    const projectionPeriodMonths = financialStatementPeriod === "yearly" ? 12 : 3;
    const projectionPeriodCountLabel = financialStatementPeriod === "yearly"
      ? copy("4 years", "4 yıl")
      : copy("4 quarters", "4 çeyrek");
    const formatProjectionDate = (date) => new Intl.DateTimeFormat(document.documentElement.lang === "tr" ? "tr-TR" : "en-US", {
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
      const writeOffCost = sum("writeOffCost");
      const grossProfit = salesRevenue - materialCost - workforceCost - electricityCost - writeOffCost;
      const netIncome = sum("netIncome");

      return {
        cashFlow: sum("cashFlow"),
        endingCash: toFiniteNumber(lastRow.cashBalance),
        grossMargin: salesRevenue ? (grossProfit / salesRevenue) * 100 : 0,
        grossProfit,
        incomeTax: sum("incomeTax"),
        label: financialStatementPeriod === "yearly" ? copy(`Year ${index + 1}`, `Yıl ${index + 1}`) : copy(`Q${index + 1}`, `Ç${index + 1}`),
        loanInterest: sum("loanInterest"),
        materialCost,
        netIncome,
        netMargin: salesRevenue ? (netIncome / salesRevenue) * 100 : 0,
        netSoldUnits: sum("netSoldUnits"),
        periodRows,
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
    const financialStatementPeriods = Array.from({ length: 4 }, (_, index) => buildProjectionPeriod(index));
    const statementGridTemplate = `minmax(240px, 1.22fr) repeat(${financialStatementPeriods.length}, minmax(132px, 1fr))`;
    const projectionRows = [
      { id: "income-section", section: copy("Income Statement", "Gelir Tablosu") },
      { detail: copy("From channel sales forecast", "Kanal satış tahmininden"), emphasis: true, format: "money", id: "salesRevenue", label: copy("Net Sales", "Net Satışlar"), tone: "income", value: (period) => period.salesRevenue },
      { detail: copy("Material input cost", "Malzeme girdi maliyeti"), format: "money", id: "materialCost", label: copy("Materials", "Malzemeler"), tone: "cost", value: (period) => period.materialCost },
      { detail: copy("Labor and salary cost", "İşçilik ve maaş maliyeti"), format: "money", id: "workforceCost", label: copy("Labor", "İşçilik"), tone: "cost", value: (period) => period.workforceCost },
      { detail: copy("Energy cost from operations", "Operasyonlardan gelen enerji maliyeti"), format: "money", id: "electricityCost", label: copy("Energy", "Enerji"), tone: "cost", value: (period) => period.electricityCost },
      { detail: copy("Returns, spoilage and expired stock", "İade, fire ve SKT kaynaklı stok"), format: "money", id: "writeOffCost", label: copy("Write-off Cost", "Fire / İade Maliyeti"), tone: "cost", value: (period) => period.writeOffCost },
      { detail: copy("Revenue after direct production costs", "Direkt üretim maliyetleri sonrası gelir"), emphasis: true, format: "money", id: "grossProfit", label: copy("Gross Profit", "Brüt Kâr"), signed: true, value: (period) => period.grossProfit },
      { detail: copy("Interest accrued from active loans", "Aktif kredilerden işleyen faiz"), format: "money", id: "loanInterest", label: copy("Loan Interest", "Kredi Faizi"), tone: "cost", value: (period) => period.loanInterest },
      { detail: copy("Income tax calculated from profit", "Kârdan hesaplanan gelir vergisi"), format: "money", id: "incomeTax", label: copy("Income Tax", "Gelir Vergisi"), tone: "tax", value: (period) => period.incomeTax },
      { detail: copy("All cost lines carried by the model", "Modelin taşıdığı tüm maliyet satırları"), emphasis: true, format: "money", id: "totalCost", label: copy("Total Expenses", "Toplam Giderler"), tone: "cost", value: (period) => period.totalCost },
      { detail: copy("After all operating, financing and tax costs", "Tüm operasyon, finansman ve vergi maliyetlerinden sonra"), emphasis: true, format: "money", id: "netIncome", label: copy("Net Profit", "Net Kâr"), signed: true, value: (period) => period.netIncome },
      { detail: copy("Net profit divided by net sales", "Net kârın net satışlara oranı"), format: "percent", id: "netMargin", label: copy("Net Profit Margin", "Net Kâr Marjı"), signed: true, value: (period) => period.netMargin },
      { id: "cash-section", section: copy("Cash Flow", "Nakit Akışı") },
      { detail: copy("Cash at the start of the period", "Dönem başındaki nakit"), format: "money", id: "startingCash", label: copy("Starting Cash", "Dönem Başı Nakit"), signed: true, value: (period) => period.startingCash },
      { detail: copy("Net movement inside the period", "Dönem içi net hareket"), emphasis: true, format: "money", id: "cashFlow", label: copy("Net Cash Flow", "Net Nakit Akışı"), signed: true, value: (period) => period.cashFlow },
      { detail: copy("Cash left after the period closes", "Dönem kapandıktan sonra kalan nakit"), emphasis: true, format: "money", id: "endingCash", label: copy("Ending Cash", "Dönem Sonu Nakit"), signed: true, value: (period) => period.endingCash },
      { detail: copy("Sales VAT position in the model", "Modeldeki satış KDV pozisyonu"), format: "money", id: "vatPayable", label: copy("VAT Payable", "Ödenecek KDV"), tone: "tax", value: (period) => period.vatPayable },
      { id: "operations-section", section: copy("Operating Volume", "Operasyon Hacmi") },
      { detail: copy("Units produced by active process plans", "Aktif süreç planlarıyla üretilen adet"), format: "number", id: "producedUnits", label: copy("Produced Units", "Üretilen Adet"), value: (period) => period.producedUnits },
      { detail: copy("Units sold after returns", "İadeler sonrası satılan adet"), format: "number", id: "netSoldUnits", label: copy("Net Sold Units", "Net Satılan Adet"), value: (period) => period.netSoldUnits },
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
            <p>{copy("Forward projection view for the next four periods.", "Önümüzdeki dört dönem için projeksiyon görünümü.")}</p>
          </div>
          <div className="financial-statement-controls">
            <span className="financial-row-count">{projectionPeriodCountLabel}</span>
            <div className="financial-statement-toggle" role="group" aria-label={copy("Statement period", "Tablo dönemi")}>
              {[
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
            <div className="financial-projection-row financial-projection-head" style={{ gridTemplateColumns: statementGridTemplate }}>
              <span>{copy("Line Item", "Kalem")}</span>
              {financialStatementPeriods.map((period) => (
                <span key={period.label}>
                  <strong>{period.label}</strong>
                  <small>{period.rangeLabel}</small>
                </span>
              ))}
            </div>
            {projectionRows.map((row) => row.section ? (
              <div className="financial-projection-row financial-projection-section" style={{ gridTemplateColumns: statementGridTemplate }} key={row.id}>
                <strong>{row.section}</strong>
                <span />
                <span />
                <span />
                <span />
              </div>
            ) : (
              <div className={`financial-projection-row financial-projection-line ${row.emphasis ? "emphasis" : ""}`} style={{ gridTemplateColumns: statementGridTemplate }} key={row.id}>
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
            ))}
          </div>
        </div>
      </article>
    );
    const renderWidgetMetric = (label, value, detail) => (
      <div className="financial-widget-metric">
        <span>{label}</span>
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
              <span>{item.costType === "initial" ? copy("Initial expense", "Başlangıç gideri") : item.costType === "recurring" ? copy("Recurring expense", "Tekrarlayan gider") : item.costType || "-"}</span>
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
        render: () => renderWidgetMetric(copy("Cash Runway", "Nakit Dayanma"), `${formatNumber(summary.cashRunwayMonths)} ${copy("months", "ay")}`, copy("Uses initial cash, loans and monthly cash flow", "Başlangıç nakdi, krediler ve aylık nakit akışını kullanır")),
        title: copy("Cash Runway", "Nakit Dayanma"),
      },
      {
        detail: copy("First profitable operating month", "İlk kârlı operasyon ayı"),
        id: "breakEven",
        render: () => renderWidgetMetric(copy("Break-even", "Başa Baş"), formatMonth(summary.breakEvenMonth), copy("Revenue minus operating cost and taxes", "Gelir eksi operasyon maliyeti ve vergiler")),
        title: copy("Break-even", "Başa Baş"),
      },
      {
        detail: copy("Investment recovery estimate", "Yatırım geri dönüş tahmini"),
        id: "payback",
        render: () => renderWidgetMetric(copy("Payback", "Geri Dönüş"), formatMonth(summary.paybackMonth), copy("Investment, working capital and loan effect included", "Yatırım, işletme sermayesi ve kredi etkisi dahil")),
        title: copy("Payback", "Geri Dönüş"),
      },
      {
        detail: copy("Break-even sales volume", "Başa baş satış hacmi"),
        id: "requiredSales",
        render: () => renderWidgetMetric(copy("Required Monthly Sales", "Gerekli Aylık Satış"), formatNumber(summary.requiredMonthlySalesVolume), copy("Based on contribution per unit", "Birim katkı payına göre")),
        title: copy("Required Sales", "Gerekli Satış"),
      },
      {
        detail: copy("Forecast not sold", "Satışa dönüşmeyen tahmin"),
        id: "inventoryRisk",
        render: () => renderWidgetMetric(copy("Unsold Inventory", "Satılmayan Stok"), `${formatNumber(summary.unsoldInventoryUnits)} ${copy("units", "adet")}`, copy("Production above channel sales plan", "Kanal satış planını aşan üretim")),
        title: copy("Inventory Risk", "Stok Riski"),
      },
      {
        detail: copy("Spoilage and return write-off", "Fire ve iade maliyeti"),
        id: "writeOff",
        render: () => renderWidgetMetric(copy("Write-off Value", "Fire / İade Değeri"), formatLira(summary.expiredWriteOffCost), copy("Sales strategy return and spoilage inputs", "Satış stratejisi iade ve fire girdileri")),
        title: copy("Write-off", "Fire / İade"),
      },
      {
        detail: copy("VAT and income tax", "KDV ve gelir vergisi"),
        id: "taxLoad",
        render: () => renderWidgetMetric(copy("Tax Load", "Vergi Yükü"), formatLira(summary.vatPayable + summary.incomeTax), copy("Tax inputs from financial assumptions", "Finansal varsayımlardan gelen vergi girdileri")),
        title: copy("Tax Load", "Vergi Yükü"),
      },
      {
        detail: copy("Loan payment impact", "Kredi ödeme etkisi"),
        id: "loanSummary",
        render: () => (
          <div className="financial-widget-pair">
            {renderWidgetMetric(copy("Monthly Payment", "Aylık Ödeme"), formatLira(summary.loanPayment), copy("Current active installments", "Mevcut aktif taksitler"))}
            {renderWidgetMetric(copy("Total Loan", "Toplam Kredi"), formatLira(summary.loanAmount), copy("Saved in Loans page", "Krediler sayfasında kayıtlı"))}
          </div>
        ),
        title: copy("Loan Summary", "Kredi Özeti"),
      },
      {
        detail: copy("Operations and input cost mix", "Operasyon ve girdi maliyet karması"),
        id: "costTypes",
        render: () => renderBreakdownBars(costBreakdownRows, maxCostBreakdownAmount, copy("No cost data yet", "Henüz maliyet verisi yok"), "cost"),
        title: copy("Cost Types", "Maliyet Türleri"),
      },
      {
        detail: copy("Revenue, net and cash return", "Gelir, net ve nakit getiri"),
        id: "returnTypes",
        render: () => renderBreakdownBars(returnBreakdownRows, maxReturnBreakdownAmount, copy("No return data yet", "Henüz getiri verisi yok"), "income"),
        title: copy("Return Types", "Getiri Türleri"),
      },
      {
        detail: copy("Machine, equipment and working capital", "Makine, ekipman ve işletme sermayesi"),
        id: "investmentBreakdown",
        render: () => renderBreakdownBars(investmentBreakdownRows, maxInvestmentBreakdownAmount, copy("No investment data yet", "Henüz yatırım verisi yok"), "investment"),
        title: copy("Investment Breakdown", "Yatırım Kırılımı"),
      },
      {
        detail: copy("User-entered optional expenses", "Kullanıcının girdiği opsiyonel giderler"),
        id: "optionalExpenses",
        render: () => renderWidgetScenarioList(model.extraCosts || [], copy("No optional expense yet", "Henüz opsiyonel gider yok")),
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
            <p>{copy("Default view stays focused on financial rows and the projection chart. Pick the metrics you want to keep on your saved screen.", "Varsayılan görünüm finansal satırlar ve projeksiyon grafiğine odaklı kalır. Kayıtlı ekranında görmek istediğin metrikleri seç.")}</p>
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
    const visibleIncomeRows = (model.incomeRows || []).filter((row) => {
      if (currentFinancialPage.key === "product-cost") return row.kind !== "income" && row.costType !== "initial";
      if (currentFinancialPage.key === "investment-cost") return row.costType === "initial" || row.id === "workingCapital";
      if (currentFinancialPage.key === "product-return") return row.costType !== "initial";
      return true;
    });
    const overviewMonthCount = Math.max(1, getProjectionMonthCount(financialHorizon));
    const overviewHasSalesForecast = salesStrategy.channels.some((channel) => channel.productId && toFiniteNumber(channel.monthlySalesUnits) > 0);
    const overviewIsDecisionReady = Boolean(summary.planCount && overviewHasSalesForecast && financialModel.settingsSaved);
    const overviewMonthlyRevenue = toFiniteNumber(summary.salesRevenue) / overviewMonthCount;
    const overviewMonthlyCost = toFiniteNumber(summary.totalCost) / overviewMonthCount;
    const overviewMonthlyNet = toFiniteNumber(summary.netIncome) / overviewMonthCount;
    const overviewProductionCost = toFiniteNumber(summary.materialCost) + toFiniteNumber(summary.workforceCost) + toFiniteNumber(summary.electricityCost) + toFiniteNumber(summary.expiredWriteOffCost);
    const overviewTaxAndFinanceCost = toFiniteNumber(summary.vatPayable) + toFiniteNumber(summary.incomeTax) + toFiniteNumber(summary.loanInterest);
    const overviewInvestmentBase = Math.max(0, investmentTotal);
    const overviewRoiPercent = overviewInvestmentBase ? (toFiniteNumber(summary.netIncome) / overviewInvestmentBase) * 100 : 0;
    const overviewMarginPercent = summary.salesRevenue ? (toFiniteNumber(summary.netIncome) / toFiniteNumber(summary.salesRevenue)) * 100 : 0;
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
      { amount: overviewProductionCost, id: "productionCost", label: copy("Production cost", "Üretim maliyeti"), tone: "cost" },
      { amount: summary.extraRecurringCost, id: "recurringExtraCost", label: copy("Recurring overhead", "Tekrarlayan genel gider"), tone: "cost" },
      { amount: overviewTaxAndFinanceCost, id: "taxFinance", label: copy("Tax and finance", "Vergi ve finansman"), tone: "cost" },
      { amount: summary.machinePurchaseCost + summary.equipmentPurchaseCost + summary.extraInitialCost, id: "initialInvestment", label: copy("Initial investment", "Başlangıç yatırımı"), tone: "investment" },
      { amount: summary.workingCapitalRequirement, id: "workingCapital", label: copy("Working capital", "İşletme sermayesi"), tone: "investment" },
    ].filter((item) => toFiniteNumber(item.amount) > 0);
    const overviewMaxCostBreakdownAmount = Math.max(1, ...overviewCostBreakdownRows.map((item) => toFiniteNumber(item.amount)));

    if (currentFinancialPage.key === "inputs") {
      return renderDashboardLayout(
        `financial-modelling/${currentFinancialPage.key}`,
          <section className="financial-workspace">
            <div className="financial-header">
              <div>
                <span>{currentFinancialPage.group} / {copy("Financial assumptions", "Finansal varsayımlar")}</span>
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
                <div className="financial-card-heading"><h2>{copy("Saved Optional Expenses", "Kayıtlı Opsiyonel Giderler")}</h2></div>
                <div className="scenario-list">
                  {(model.extraCosts?.length ? model.extraCosts : [{ id: "empty", name: copy("No extra cost yet", "Henüz ek gider yok"), costType: "-", amount: 0 }]).map((cost) => (
                    <div className="scenario-row" key={cost.id}>
                      <div>
                        <strong>{cost.name}</strong>
                        <span>{cost.costType === "initial" ? copy("Initial expense", "Başlangıç gideri") : cost.costType === "recurring" ? copy("Recurring expense", "Tekrarlayan gider") : "-"}</span>
                      </div>
                      <strong>{cost.id === "empty" ? "-" : formatLira(cost.amount)}</strong>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>,
      );
    }

    if (currentFinancialPage.key === "loans") {
      return renderDashboardLayout(
        `financial-modelling/${currentFinancialPage.key}`,
          <section className="financial-workspace">
            <div className="financial-header">
              <div>
                <span>{currentFinancialPage.group} / {copy("Financing inputs", "Finansman girdileri")}</span>
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
                [copy("Loan Count", "Kredi Sayısı"), formatNumber(financialLoanRows.length), copy("separate financing records", "ayrı finansman kaydı")],
                [copy("Total Loan Amount", "Toplam Kredi Tutarı"), formatLoanCurrencyTotals(loanAmountTotals), copy("by loan currency", "kredi dövizine göre")],
                [copy("Total Loan in TRY", "TL Bazlı Toplam Kredi"), formatLoanTryTotal(totalLoanAmountTry), loanTryDetail],
                [copy("Monthly Loan Payment", "Aylık Kredi Ödemesi"), formatLoanCurrencyTotals(monthlyLoanPaymentTotals), copy("sum of active installments", "aktif taksitlerin toplamı")],
                [copy("Monthly Payment in TRY", "TL Bazlı Aylık Ödeme"), formatLoanTryTotal(totalMonthlyLoanPaymentTry), loanTryDetail],
                [copy("Longest Term", "En Uzun Vade"), longestLoanTerm ? `${formatNumber(longestLoanTerm)} ${copy("months", "ay")}` : "-", copy("used for repayment schedule", "ödeme planında kullanılır")],
              ].map(([label, value, detail]) => (
                <article className="finance-metric-card" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>{detail}</small>
                </article>
              ))}
            </div>

            {renderFinancialLoans()}
          </section>,
      );
    }

    if (currentFinancialPage.key === "overview") {
      return renderDashboardLayout(
        `financial-modelling/${currentFinancialPage.key}`,
          <section className="financial-workspace">
            <div className="financial-header">
              <div>
                <span>{currentFinancialPage.group} / {copy("Model connected to Operations data", "Operations verisine bağlı model")}</span>
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
                  <span>{metric.label}</span>
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
                [copy("Produced / Sold", "Üretilen / Satılan"), overviewIsDecisionReady ? `${formatNumber(summary.totalProduced)} / ${formatNumber(summary.netSoldUnits)}` : "-", copy("selected horizon units", "seçili ufuk adedi")],
                [copy("Unsold Inventory", "Satılmayan Stok"), overviewIsDecisionReady ? `${formatNumber(summary.unsoldInventoryUnits)} ${copy("units", "adet")}` : "-", copy("production above sales", "satışı aşan üretim")],
                [copy("Required Cash", "Gerekli Nakit"), overviewIsDecisionReady ? formatLira(summary.initialCashRequired) : "-", copy("after initial loan and grant", "başlangıç kredi ve hibe sonrası")],
                [copy("Payback", "Geri Dönüş"), overviewIsDecisionReady ? formatMonth(summary.paybackMonth) : "-", copy("investment recovery month", "yatırımın geri dönüş ayı")],
              ].map(([label, value, detail]) => (
                <article className="financial-quick-card" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>{detail}</small>
                </article>
              ))}
            </div>

            {selectedFinancialWidgets.length > 0 && (
              <div className="financial-widget-grid">
                {selectedFinancialWidgets.map(renderOverviewWidget)}
              </div>
            )}

            {renderWidgetSelector()}
          </section>,
      );
    }

    return renderDashboardLayout(
      `financial-modelling/${currentFinancialPage.key}`,
        <section className="financial-workspace">
          <div className="financial-header">
            <div>
              <span>{currentFinancialPage.group} / {copy("Model connected to Operations data", "Operations verisine bağlı model")}</span>
              <h1>{financialPageMeta.title}</h1>
              <p>{financialPageMeta.description}</p>
            </div>
            <button type="button" className="primary app-command-button" onClick={() => loadFinancialData()}>
              {financialLoading ? copy("Loading...", "Yükleniyor...") : copy("Update Data", "Verileri Güncelle")}
            </button>
          </div>

          {financialStatus && <p className="status-message">{financialStatus}</p>}

          <div className="finance-metric-grid">
            {metricRowsByPage[currentFinancialPage.key].map(([label, value]) => (
              <article className="finance-metric-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{copy("Feasibility model result", "Fizibilite model sonucu")}</small>
              </article>
            ))}
          </div>

          <div className="financial-feasibility-grid">
            {[
              [copy("Forecast Sales", "Tahmini Satış"), formatNumber(summary.forecastSalesUnits), copy("from Sales Strategy monthly inputs", "Satış Stratejisi aylık girdilerinden")],
              [copy("Unsold Inventory", "Satılmayan Stok"), formatNumber(summary.unsoldInventoryUnits), copy("production above channel sales plan", "kanal satış planını aşan üretim")],
              [copy("Write-off Value", "Fire / İade Değeri"), formatLira(summary.expiredWriteOffCost), copy("spoilage, returns and expired products", "bozulma, iade ve SKT ürünler")],
              [copy("Cash Runway", "Nakit Dayanma"), `${formatNumber(summary.cashRunwayMonths)} ${copy("months", "ay")}`, copy("with entered initial cash", "girilen başlangıç nakdiyle")],
              [copy("Break-even", "Başa Baş"), formatMonth(summary.breakEvenMonth), copy("first profitable operating month", "ilk kârlı operasyon ayı")],
              [copy("Payback", "Geri Dönüş"), formatMonth(summary.paybackMonth), copy("investment plus working capital", "yatırım ve işletme sermayesi")],
              [copy("Initial Cash Needed", "Gerekli Başlangıç Nakdi"), formatLira(summary.initialCashRequired), copy("own cash after loan", "kredi sonrası öz nakit")],
              [copy("Monthly Loan Payment", "Aylık Kredi Ödemesi"), formatLira(summary.loanPayment), copy("principal and interest", "anapara ve faiz")],
              [copy("Required Monthly Sales", "Gerekli Aylık Satış"), formatNumber(summary.requiredMonthlySalesVolume), copy("break-even volume estimate", "başa baş hacim tahmini")],
              [copy("Channel Commission", "Kanal Komisyonu"), formatLira(summary.retailerMarginCost), copy("commission deducted from channel sales", "kanal satışlarından düşülen komisyon")],
              [copy("Payment Delay", "Ödeme Vadesi"), `${formatNumber(summary.weightedPaymentDelayDays, 1)} ${copy("days", "gün")}`, copy("weighted channel delay", "ağırlıklı kanal vadesi")],
              [copy("VAT + Tax", "KDV + Vergi"), formatLira(summary.vatPayable + summary.incomeTax), copy("basic tax handling", "temel vergi hesabı")],
            ].map(([label, value, detail]) => (
              <article className="financial-feasibility-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </div>

          <div className="financial-grid">
            <article className="financial-card income-card">
              <div className="financial-card-heading"><h2>{isCostPage ? copy("Cost Calculation Rows", "Maliyet Hesap Satırları") : copy("Return Calculation Rows", "Getiri Hesap Satırları")}</h2></div>
              <div className="income-table simplified-income-table">
                <div className="income-row income-head"><span>{copy("Item", "Kalem")}</span><span>{copy("Type", "Tip")}</span><span>{copy("Amount", "Tutar")}</span></div>
                {visibleIncomeRows.map((row, index) => (
                  <div className="income-row" key={`${row.label}-${index}`}>
                    <strong>{getFinancialRowLabel(row)}</strong>
                    <span>{row.kind === "income" ? copy("Income", "Gelir") : row.costType === "initial" ? copy("Initial expense", "Başlangıç gideri") : copy("Expense", "Gider")}</span>
                    <span>{formatLira(row.amount)}</span>
                  </div>
                ))}
                <div className="income-row income-total">
                  <strong>{isCostPage ? copy("Selected cost total", "Seçili maliyet toplamı") : copy("Net income", "Net kazanç")}</strong>
                  <span>{isCostPage ? currentFinancialPage.group : copy("Income - expense", "Gelir - gider")}</span>
                  <span>{isCostPage ? formatLira(isInvestmentPage ? investmentTotal : summary.totalCost) : formatLira(summary.netIncome)}</span>
                </div>
              </div>
            </article>

            <article className="financial-card trend-card">
            <div className="financial-card-heading">
              <h2>{copy("Financial Trends", "Finansal Trendler")}</h2>
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
              <span className="legend-sales">{copy("Sales revenue", "Satış kazançları")}</span>
              <span className="legend-costs">{copy("Expenses", "Giderler")}</span>
            </div>
            {renderIncomeExpenseTrendSvg(copy("Sales revenue and expenses projection chart", "Satış kazançları ve giderler projeksiyon grafiği"))}
            </article>

            <article className="financial-card cost-card">
              <h2>{isInvestmentPage ? copy("Investment Structure", "Yatırım Yapısı") : copy("Cost Structure", "Maliyet Yapısı")}</h2>
              <div className="cost-body">
                <div className="donut-chart cost-donut" aria-hidden="true"><span>{formatLira(isInvestmentPage ? investmentTotal : summary.totalCost)}</span></div>
                <div className="cost-list">
                  {(isInvestmentPage
                    ? [
                        { amount: summary.machinePurchaseCost, label: copy("Machine investment", "Makine yatırımı") },
                        { amount: summary.extraInitialCost, label: copy("Initial extra costs", "Başlangıç ek giderleri") },
                      ]
                    : (model.costStructure || [])
                  ).map((item) => (
                    <span key={item.id || item.label}>{getFinancialRowLabel(item)}<strong>{formatLira(item.amount)}</strong></span>
                  ))}
                </div>
              </div>
            </article>

            <article className="financial-card scenario-card">
              <div className="financial-card-heading"><h2>{isCostPage ? copy("Extra Costs", "Ek Giderler") : copy("Return Notes", "Getiri Notları")}</h2></div>
              <div className="scenario-list">
                {(isCostPage
                  ? (model.extraCosts?.length ? model.extraCosts : [{ id: "empty", name: copy("No extra cost yet", "Henüz ek gider yok"), costType: "-", amount: 0 }])
                  : [
                      { amount: summary.salesRevenue, costType: "income", id: "sales", name: copy("Sales revenue from monthly forecast", "Aylık tahminden satış geliri") },
                      { amount: summary.netIncome, costType: "income", id: "net", name: copy("Net return after tracked costs", "Takip edilen maliyetlerden sonra net getiri") },
                      { amount: summary.expiredWriteOffCost, costType: "income", id: "writeoff-note", name: copy("Spoilage and return write-off", "Bozulma ve iade fire maliyeti") },
                      { amount: summary.vatPayable + summary.incomeTax, costType: "income", id: "tax-note", name: copy("VAT and income tax", "KDV ve gelir vergisi") },
                    ]
                ).map((cost) => (
                  <div className="scenario-row" key={cost.id}>
                    <div>
                      <strong>{cost.name}</strong>
                      <span>{cost.costType === "initial" ? copy("Initial expense", "Başlangıç gideri") : cost.costType === "recurring" ? copy("Recurring expense", "Tekrarlayan gider") : cost.costType === "income" ? copy("Calculated return", "Hesaplanan getiri") : "-"}</span>
                    </div>
                    <strong>{cost.id === "empty" ? "-" : formatLira(cost.amount)}</strong>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>,
    );
  }

  function renderSimulationPage() {
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
    const linkedFinancialModel = buildFinancialFeasibilityModel(financialModel, salesStrategy, financialSettingsForModel, operationsWorkspaceForFinance, financialHorizon);
    const linkedSummary = linkedFinancialModel.summary || emptyFinancialModel.summary;
    const defaultHorizonMonths = Math.max(1, getProjectionMonthCount(financialHorizon));
    const timeHorizonMonths = Math.max(1, Math.round(positiveParam("timeHorizonMonths", defaultHorizonMonths)));
    const productMap = getOperationProductMap(operationsWorkspaceForFinance);
    const firstChannelProduct = salesStrategy.channels.map((channel) => productMap.get(channel.productId) || channel.product).find(Boolean);
    const defaultSalesUnits = Math.round(
      toFiniteNumber(linkedSummary.netSoldUnits) / timeHorizonMonths ||
      getSalesForecastForMonth(salesStrategy, 0),
    );
    const defaultUnitSalesPrice = toFiniteNumber(
      linkedSummary.averageNetPrice,
      toFiniteNumber(firstChannelProduct?.price, toFiniteNumber(operationsWorkspaceForFinance.product?.price, toFiniteNumber(operationsWorkspaceForFinance.products[0]?.price))),
    );
    const scenarioSalesUnits = Math.max(0, positiveParam("salesUnits", defaultSalesUnits));
    const scenarioUnitSalesPrice = Math.max(0, positiveParam("unitSalesPrice", defaultUnitSalesPrice));
    const scenarioProductionUnits = Math.max(
      scenarioSalesUnits,
      positiveParam("productionUnits", Math.round(toFiniteNumber(linkedSummary.totalProduced) / timeHorizonMonths) || scenarioSalesUnits),
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
      [simulationAlgorithms.withTendency, copy("FBM Monte Carlo + bull/bear tendency", "FBM Monte Carlo + boğa/ayı eğilimi")],
      [simulationAlgorithms.withoutTendency, copy("FBM Monte Carlo without tendency", "FBM Monte Carlo eğilimsiz")],
    ];
    const simulationAlgorithmLabel = simulationAlgorithmOptions.find(([value]) => value === simulationAlgorithm)?.[1] || simulationAlgorithmOptions[0][1];
    const volatility = numberParam("volatility") / 100;
    const costVolatility = numberParam("costVolatility") / 100;
    const fixedCost = Math.max(0, positiveParam("fixedCost", toFiniteNumber(linkedSummary.extraRecurringCost)));
    const marketingBudget = Math.max(0, finiteParam("marketingBudget", 0)) * timeHorizonMonths;
    const derivedVariableCostRatio = baseRevenue ? Math.min(95, (scenarioProductionCost / baseRevenue) * 100) : 0;
    const variableCostRatio = Math.min(0.95, Math.max(0, finiteParam("variableCostRatio", derivedVariableCostRatio) / 100));
    const tendencyEffect = demandEffect + priceEffect + campaignEffect + efficiencyEffect * 0.42 - competitorDrag * 0.55;
    const appliedTendencyEffect = simulationAlgorithm === simulationAlgorithms.withoutTendency ? 0 : tendencyEffect;
    const trendAdjustedRevenue = baseRevenue * Math.max(0, 1 + appliedTendencyEffect);
    const projectedVariableCost = scenarioProductionCost || (trendAdjustedRevenue * Math.min(variableCostRatio + costVolatility * 0.22, 0.92));
    const outcomeSpread = trendAdjustedRevenue * Math.max(volatility + costVolatility * 0.65 + competitorDrag * 0.35, 0.08);
    const contributionPerUnit = Math.max(0, (scenarioUnitSalesPrice * Math.max(0, 1 - discountRate)) - unitProductionCost);
    const buildOutcome = (key, percentile, label, tone, multiplier) => {
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
        percentile,
        revenue,
        tone,
      };
    };
    const outcomes = [
      buildOutcome("worst", "Worst 5%", copy("Highly Risky Scenario", "Çok Riskli Senaryo"), "danger", -1.32),
      buildOutcome("bad", "20th", copy("Bad Scenario", "Kötü Senaryo"), "bad", -0.72),
      buildOutcome("likely", "50th", copy("Most Likely Scenario", "En Olası Senaryo"), "likely", 0),
      buildOutcome("good", "80th", copy("Good Scenario", "İyi Senaryo"), "good", 0.78),
    ];
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
      [copy("Unit production cost", "Birim üretim maliyeti"), unitProductionCost ? formatLira(unitProductionCost, 2) : "-"],
      [copy("Projection horizon", "Projeksiyon ufku"), `${formatNumber(timeHorizonMonths)} ${copy("months", "ay")}`],
    ];
    const simulationHasSalesForecast = salesStrategy.channels.some((channel) => channel.productId && toFiniteNumber(channel.monthlySalesUnits) > 0);
    const simulationSourceReady = Boolean(toFiniteNumber(linkedSummary.planCount) && simulationHasSalesForecast && financialModel.settingsSaved);
    const positiveOutcomeCount = outcomes.filter((outcome) => outcome.net > 0).length;
    const simulationConfidencePercent = Math.round((positiveOutcomeCount / outcomes.length) * 100);
    const simulationReadinessItems = [
      { done: toFiniteNumber(linkedSummary.planCount) > 0, label: copy("Operations", "Operations"), path: "/operations/data-entry" },
      { done: simulationHasSalesForecast, label: copy("Sales", "Satış"), path: "/sales-strategy" },
      { done: financialModel.settingsSaved, label: copy("Finance", "Finans"), path: "/financial-modelling/analiz" },
      { done: scenarioSalesUnits > 0 && scenarioUnitSalesPrice > 0, label: copy("Variant", "Varyant"), path: variant.path || `/simulation/${variant.id}` },
    ];
    const simulationReadinessPercent = Math.round((simulationReadinessItems.filter((item) => item.done).length / simulationReadinessItems.length) * 100);
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
          `Likely net is ${formatLira(likelyOutcome.net)}, worst 5% net is ${formatLira(simulationWorstNet)}, and ${positiveOutcomeCount} of ${outcomes.length} scenario bands stay positive.`,
          `Olası net ${formatLira(likelyOutcome.net)}, en kötü %5 net ${formatLira(simulationWorstNet)} ve ${outcomes.length} senaryo bandının ${positiveOutcomeCount} tanesi pozitif kalıyor.`,
        );
    const simulationSignalRows = [
      {
        detail: copy(`${positiveOutcomeCount}/${outcomes.length} positive percentile bands`, `${outcomes.length} bandın ${positiveOutcomeCount} tanesi pozitif`),
        label: copy("Positive bands", "Pozitif bantlar"),
        tone: positiveOutcomeCount >= 3 ? "good" : positiveOutcomeCount >= 2 ? "watch" : "risk",
        value: `${simulationConfidencePercent}%`,
      },
      {
        detail: copy("likely minus worst 5%", "olası eksi en kötü %5"),
        label: copy("Downside gap", "Aşağı fark"),
        tone: simulationWorstNet >= 0 ? "good" : "risk",
        value: formatLira(simulationDownsideGap),
      },
      {
        detail: copy("80th percentile minus likely", "80. persentil eksi olası"),
        label: copy("Upside room", "Yukarı alan"),
        tone: "good",
        value: formatLira(simulationUpsideGap),
      },
      {
        detail: simulationAlgorithm === simulationAlgorithms.withoutTendency ? copy("without bull/bear tendency", "boğa/ayı eğilimsiz") : copy("with bull/bear tendency", "boğa/ayı eğilimli"),
        label: copy("Algorithm", "Algoritma"),
        tone: "neutral",
        value: simulationAlgorithm === simulationAlgorithms.withoutTendency ? copy("Neutral", "Nötr") : copy("Tendency", "Eğilimli"),
      },
    ];
    return renderDashboardLayout(
      `simulation/${variant.id}`,
        <section className="simulation-workspace monte-carlo-workspace">
          <div className="simulation-header">
            <div>
              <span>{dashboardCompanyName} / {copy("Monte Carlo Simulation", "Monte Carlo Simülasyonu")}</span>
              <h1>{variant.id === "current-situation" ? copy("Current Situation", "Mevcut Durum") : variant.name}</h1>
              <p>{copy("Variants are saved with simple product and sales assumptions. Outputs are recalculated from the saved operations, sales, and financial data available now.", "Varyantlar basit ürün ve satış varsayımlarıyla kaydedilir. Çıktılar kayıtlı operasyon, satış ve finans verilerinden yeniden hesaplanır.")}</p>
            </div>
            <div className="simulation-header-actions">
              <button type="button" onClick={loadPlanningData} disabled={simulationLoading}>
                {copy("Refresh Data", "Verileri Yenile")}
              </button>
              <button type="button" onClick={() => persistSimulationVariant(variant)} disabled={simulationLoading}>
                {simulationLoading ? copy("Saving...", "Kaydediliyor...") : copy("Save Variant", "Varyantı Kaydet")}
              </button>
              <button type="button" className="primary" onClick={addSimulationVariant}>{copy("Add Variant", "Varyant Ekle")}</button>
            </div>
          </div>

          {simulationStatus && <p className="status-message">{simulationStatus}</p>}

          <div className="simulation-variant-strip" role="tablist" aria-label={copy("Simulation variants", "Simülasyon varyantları")}>
            {simulationVariants.map((item) => (
              <div className={variant.id === item.id ? "simulation-variant-pill active" : "simulation-variant-pill"} key={item.id}>
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
                <button type="button" className="primary" onClick={() => persistSimulationVariant(variant)} disabled={simulationLoading}>
                  {simulationLoading ? copy("Saving...", "Kaydediliyor...") : copy("Save Variant", "Varyantı Kaydet")}
                </button>
                <button type="button" className="secondary" onClick={() => goTo("/financial-modelling/analiz", "login")}>
                  {copy("Open finance model", "Finans modelini aç")}
                </button>
              </div>
            </div>
            <div className="simulation-confidence-panel" aria-label={copy("Simulation readiness", "Simülasyon hazırlığı")}>
              <div className="readiness-ring" style={{ "--readiness": `${simulationReadinessPercent}%` }}>
                <strong>{simulationReadinessPercent}%</strong>
                <span>{copy("Ready", "Hazır")}</span>
              </div>
              <div className="simulation-source-list">
                {simulationReadinessItems.map((item) => (
                  <button type="button" className={item.done ? "done" : ""} onClick={() => goTo(item.path, "login")} key={item.label}>
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
              [copy("Most likely net", "En olası net"), formatLira(likelyOutcome.net), copy("50th percentile", "50. persentil")],
              [copy("Break-even point", "Başa baş noktası"), `${formatNumber(likelyOutcome.breakEvenUnits)} ${copy("units", "adet")}`, copy("current price basis", "mevcut fiyat bazlı")],
              [copy("Worst 5% net", "En kötü %5 net"), formatLira(outcomes[0].net), copy("highly risky scenario", "çok riskli senaryo")],
              [copy("Revenue range", "Gelir aralığı"), `${formatLira(outcomes[1].revenue)} - ${formatLira(outcomes[3].revenue)}`, copy("20th to 80th percentile", "20-80 persentil")],
            ].map(([label, value, detail]) => (
              <article className="monte-carlo-stat" key={label}>
                <span>{label}</span>
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
                <input value={variant.name} onChange={(event) => updateSimulationVariant(variant.id, "name", event.target.value)} />
              </label>
              <label className="simulation-name-field">
                <span>{copy("Simulation algorithm", "Simülasyon algoritması")}</span>
                <select
                  value={simulationAlgorithm}
                  onChange={(event) => updateSimulationParameter(variant.id, "simulationAlgorithm", event.target.value)}
                >
                  {simulationAlgorithmOptions.map(([value, label]) => (
                    <option value={value} key={value}>{label}</option>
                  ))}
                </select>
              </label>
              {editableVariantGroups.map((group) => (
                <div className="parameter-group" key={group.title}>
                  <h3>{group.title}</h3>
                  {group.fields.map(([field, label, min, max, step]) => (
                    <label className="sim-input-row" key={field}>
                      <span>{label}</span>
                      <input
                        min={min}
                        max={max}
                        step={step}
                        type="number"
                        value={parameters[field] ?? ""}
                        onChange={(event) => updateSimulationParameter(variant.id, field, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </aside>

            <main className="monte-carlo-main">
              <article className="simulation-card percentile-card">
                <div className="simulation-card-heading">
                  <div>
                    <span>{copy("Percentile outcomes", "Persentil çıktıları")}</span>
                    <h2>{copy("Bad, most likely, good and worst 5% scenarios", "Kötü, en olası, iyi ve en kötü %5 senaryolar")}</h2>
                  </div>
                </div>
                <div className="percentile-grid">
                  {outcomes.map((outcome) => (
                    <article className={`percentile-outcome ${outcome.tone}`} key={outcome.key}>
                      <span>{outcome.percentile}</span>
                      <h3>{outcome.label}</h3>
                      <strong>{formatLira(outcome.net)}</strong>
                      <p>{copy("Revenue", "Gelir")}: {formatLira(outcome.revenue)}</p>
                      <p>{copy("Break-even", "Başa baş")}: {formatNumber(outcome.breakEvenUnits)} {copy("units", "adet")}</p>
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
                  <svg className="monte-chart break-even-chart" viewBox="0 0 620 280" role="img" aria-label={copy("Break-even chart", "Başa baş grafiği")}>
                    <path className="chart-grid" d="M42 40 H580 M42 90 H580 M42 140 H580 M42 190 H580 M42 240 H580" />
                    <path className="chart-axis" d="M42 28 V240 H585" />
                    <path className="break-even-cost" d="M50 218 L130 202 L210 184 L290 166 L370 148 L450 130 L570 104" />
                    <path className="break-even-revenue" d="M50 232 L130 206 L210 178 L290 150 L370 122 L450 94 L570 52" />
                    <line className="break-even-marker" x1="285" x2="285" y1="42" y2="240" />
                    <text className="chart-tick" x="294" y="68">{copy("Break-even", "Başa baş")}</text>
                    <text className="chart-tick" x="48" y="262">{copy("Volume", "Hacim")}</text>
                    <text className="chart-tick chart-tick-end" x="502" y="262">{copy("Projected sales", "Projeksiyon satış")}</text>
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
                            <rect className={value >= 0 ? "income-positive" : "income-negative"} x={x} y={y} width="46" height={height} rx="6" />
                            <text className="chart-tick" x={x - 8} y="230">{index + 1}</text>
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
                    <span key={label}>{label}<strong>{value}</strong></span>
                  ))}
                </div>
              </article>

              <article className="simulation-card path-preview-card simulation-trend-card">
                <div className="simulation-card-heading">
                  <div>
                    <span>{copy("Sales path", "Satış yolu")}</span>
                    <h2>{copy("Revenue sensitivity preview", "Gelir hassasiyeti önizlemesi")}</h2>
                  </div>
                </div>
                <div className="simulation-chart-stage">
                  <svg className="monte-chart path-preview-chart" viewBox="0 0 420 220" aria-hidden="true">
                    <path className="chart-grid" d="M24 42 H396 M24 88 H396 M24 134 H396 M24 180 H396" />
                    <path className="percentile-band" d="M28 166 C76 144 118 154 162 126 S248 108 294 82 360 80 392 58 L392 128 C340 140 312 154 266 166 S178 174 128 188 62 196 28 202 Z" />
                    <path className="path-worst" d="M28 196 C74 184 118 190 164 176 S244 166 294 152 350 150 392 136" />
                    <path className="path-likely" d="M28 168 C82 148 124 158 168 128 S248 118 296 90 352 82 392 68" />
                    <path className="path-good" d="M28 142 C78 112 122 120 168 92 S248 74 296 54 350 46 392 34" />
                  </svg>
                </div>
                <p>{copy("This preview shows how the selected sales assumptions can move revenue across low, likely, and high outcomes.", "Bu önizleme seçilen satış varsayımlarının geliri düşük, olası ve yüksek çıktılarda nasıl oynatabileceğini gösterir.")}</p>
              </article>

              <article className="simulation-card risk-card">
                <h2>{copy("Highly risky scenario", "Çok riskli senaryo")}</h2>
                <p>{copy("The worst 5% outcome is displayed separately because it represents the tail-risk case that can threaten margin, cash flow, and break-even timing.", "En kötü %5 çıktı ayrı gösterilir; marjı, nakit akışını ve başa baş zamanlamasını tehdit edebilecek kuyruk riskini temsil eder.")}</p>
                <strong>{formatLira(outcomes[0].net)}</strong>
              </article>
            </aside>
          </div>
        </section>,
    );
  }

  function renderSalesStrategyPage() {
    const monthlyMultipliers = getSalesExpectationMultipliers(salesStrategy);
    const multiplierPeriod = getSalesMultiplierPeriod(salesStrategy);
    const multiplierInputs = getSalesExpectationInputMultipliers(salesStrategy);
    const workingDaysPerMonth = Math.max(1, toFiniteNumber(financialSettingsForm.workingDaysPerMonth, 22));
    const monthlyProductionByProduct = getMonthlyProductProductionMap(operationsWorkspace, workingDaysPerMonth);
    const productMap = getOperationProductMap(operationsWorkspace);
    const baseMonthlySalesUnits = getBaseMonthlySalesUnits(salesStrategy);
    const expectedAnnualSalesUnits = monthlyMultipliers.reduce((total, _multiplier, index) => total + getSalesForecastForMonth(salesStrategy, index), 0);
    const averageMultiplier = monthlyMultipliers.reduce((total, multiplier) => total + multiplier, 0) / Math.max(monthlyMultipliers.length, 1);
    const totalCampaignBudget = salesStrategy.campaigns.reduce((total, campaign) => total + (Number(campaign.budget) || 0), 0);
    const getProductAvailability = (productId) => {
      const monthlyProduced = Math.max(0, monthlyProductionByProduct.get(productId) || 0);
      const plannedSales = salesStrategy.channels.reduce((total, channel) => (
        channel.productId === productId ? total + Math.max(0, toFiniteNumber(channel.monthlySalesUnits)) : total
      ), 0);

      return {
        monthlyProduced,
        plannedSales,
        remaining: monthlyProduced - plannedSales,
      };
    };
    const totalReadyUnits = operationsWorkspace.products.reduce((total, product) => total + Math.max(0, getProductAvailability(product.id).remaining), 0);
    const totalMonthlyCommission = salesStrategy.channels.reduce((total, channel) => {
      const product = productMap.get(channel.productId) || channel.product || {};
      const productPriceTry = getOptionalPositiveNumber(channel.unitSalesPrice) ?? convertMoneyToTry(product.price, product.price_currency, exchangeRates);
      const grossRevenue = Math.max(0, toFiniteNumber(channel.monthlySalesUnits)) * Math.max(0, productPriceTry);
      return total + (grossRevenue * Math.max(0, toFiniteNumber(channel.commissionPercent)) / 100);
    }, 0);
    const activeProductCount = new Set(salesStrategy.channels.map((channel) => channel.productId).filter(Boolean)).size;
    const salesReadinessItems = [
      { done: operationsWorkspace.products.length > 0, label: copy("Products", "Ürünler"), path: "/operations/products" },
      { done: salesStrategy.channels.some((channel) => channel.name && channel.productId), label: copy("Channels", "Kanallar"), path: "/sales-strategy" },
      { done: salesStrategy.channels.some((channel) => toFiniteNumber(channel.monthlySalesUnits) > 0), label: copy("Quantities", "Adetler"), path: "/sales-strategy" },
      { done: salesStrategy.campaigns.some((campaign) => campaign.name && toFiniteNumber(campaign.budget) > 0), label: copy("Campaigns", "Kampanyalar"), path: "/sales-strategy" },
    ];
    const salesReadyCount = salesReadinessItems.filter((item) => item.done).length;
    const salesReadinessPercent = Math.round((salesReadyCount / Math.max(salesReadinessItems.length, 1)) * 100);
    const salesMonthLabels = form.language === "tr"
      ? ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"]
      : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const salesForecastPreview = Array.from({ length: 12 }, (_, index) => ({
      label: salesMonthLabels[index],
      value: getSalesForecastForMonth(salesStrategy, index),
    }));
    const maxSalesForecastPreview = Math.max(1, ...salesForecastPreview.map((item) => item.value));
    const salesStrategyTone = salesReadinessPercent >= 75 ? "teal" : salesReadinessPercent >= 50 ? "amber" : "clay";
    const salesChannelTypeOptions = salesStrategy.channelTypes?.length ? salesStrategy.channelTypes : [
      { averageCommissionPercent: 0, averageCustomerAcquisitionRate: 18, descriptionEn: "Direct sales owned by the company.", descriptionTr: "Şirketin doğrudan yönettiği satış.", id: "direct", nameEn: "Direct sales", nameTr: "Direkt satış" },
      { averageCommissionPercent: 8, averageCustomerAcquisitionRate: 8, descriptionEn: "Digital storefront or online flow.", descriptionTr: "Dijital mağaza veya online akış.", id: "online", nameEn: "Online", nameTr: "Online" },
      { averageCommissionPercent: 20, averageCustomerAcquisitionRate: 5, descriptionEn: "Retail shelf or store channel.", descriptionTr: "Perakende raf veya mağaza kanalı.", id: "retail", nameEn: "Retail", nameTr: "Perakende" },
      { averageCommissionPercent: 25, averageCustomerAcquisitionRate: 4, descriptionEn: "Distributor-led sales route.", descriptionTr: "Distribütör üzerinden satış rotası.", id: "distributor", nameEn: "Distributor", nameTr: "Distribütör" },
      { averageCommissionPercent: 15, averageCustomerAcquisitionRate: 7, descriptionEn: "Marketplace platform channel.", descriptionTr: "Pazaryeri platform kanalı.", id: "marketplace", nameEn: "Marketplace", nameTr: "Pazaryeri" },
    ];
    const campaignTypeOptions = salesStrategy.campaignTypes?.length ? salesStrategy.campaignTypes : [
      { averageConversionRate: 3, averageCustomerAcquisitionRate: 6, averageDurationDays: 30, descriptionEn: "Paid digital acquisition campaign.", descriptionTr: "Ücretli dijital müşteri kazanım kampanyası.", id: "digital", nameEn: "Digital advertising", nameTr: "Dijital reklam" },
      { averageConversionRate: 2.5, averageCustomerAcquisitionRate: 5, averageDurationDays: 21, descriptionEn: "Organic and paid social campaign.", descriptionTr: "Organik ve ücretli sosyal medya kampanyası.", id: "social", nameEn: "Social media", nameTr: "Sosyal medya" },
      { averageConversionRate: 4, averageCustomerAcquisitionRate: 7, averageDurationDays: 14, descriptionEn: "Creator or influencer-led campaign.", descriptionTr: "İçerik üretici veya influencer odaklı kampanya.", id: "influencer", nameEn: "Influencer", nameTr: "Influencer" },
      { averageConversionRate: 5, averageCustomerAcquisitionRate: 4, averageDurationDays: 30, descriptionEn: "Trade promotion for partners.", descriptionTr: "Ticari iş ortakları için promosyon.", id: "trade", nameEn: "Trade promotion", nameTr: "Ticari promosyon" },
      { averageConversionRate: 6, averageCustomerAcquisitionRate: 3, averageDurationDays: 7, descriptionEn: "Event, fair, or field activation.", descriptionTr: "Etkinlik, fuar veya saha aktivasyonu.", id: "event", nameEn: "Event / fair", nameTr: "Etkinlik / fuar" },
      { averageConversionRate: 2, averageCustomerAcquisitionRate: 4, averageDurationDays: 14, descriptionEn: "Email and CRM lifecycle campaign.", descriptionTr: "E-posta ve CRM yaşam döngüsü kampanyası.", id: "email", nameEn: "Email / CRM", nameTr: "E-posta / CRM" },
    ];
    const getSalesTypeLabel = (type) => (form.language === "tr" ? type.nameTr || type.nameEn : type.nameEn || type.nameTr) || type.id;
    const getSalesTypeDescription = (type) => (form.language === "tr" ? type.descriptionTr || type.descriptionEn : type.descriptionEn || type.descriptionTr) || "";
    const getCampaignTypeLabel = (campaign) => {
      const selectedType = campaignTypeOptions.find((type) => type.id === (campaign.typeId || "digital"));
      return selectedType ? getSalesTypeLabel(selectedType) : "";
    };
    const campaignTableColumns = [
      { header: copy("Campaign", "Kampanya"), key: "campaign", render: (row) => row.name || "", value: (row) => row.name || "" },
      { header: copy("Type", "Tip"), key: "type", render: getCampaignTypeLabel, value: getCampaignTypeLabel },
      { header: copy("Channel", "Kanal"), key: "channel", render: (row) => row.channel || "", value: (row) => row.channel || "" },
      { header: copy("Budget", "Bütçe"), key: "budget", render: (row) => formatLira(toFiniteNumber(row.budget)), sortValue: (row) => toFiniteNumber(row.budget) },
      { header: copy("Duration", "Süre"), key: "duration", render: (row) => toFiniteNumber(row.durationDays), sortValue: (row) => toFiniteNumber(row.durationDays) },
    ];
    const visibleCampaignRows = getSortableTableRows("sales-campaigns", salesStrategy.campaigns, campaignTableColumns);
    const salesChannelRequiredFields = [
      { field: "startMonth", info: copy("The first model month where this channel can sell. Earlier months contribute zero sales for this channel.", "Bu kanalın satışa başlayacağı ilk model ayı. Önceki aylar bu kanal için sıfır satış üretir."), label: copy("Start month", "Başlangıç Ayı"), min: 1, step: "1" },
      { field: "monthlySalesUnits", info: copy("Base sales promise for the first active month. Forecast then applies growth, expectation multiplier, seasonality, traffic score, returns, and limits.", "İlk aktif ay için temel satış vaadi. Tahmin sonrasında büyüme, beklenti çarpanı, sezonsallık, trafik skoru, iadeler ve limitler uygulanır."), label: copy("First month sales (units)", "İlk Ay Satış (Adet)"), min: 0, step: "1" },
      { field: "growthMonths1To6Percent", info: copy("Monthly growth applied after launch for elapsed months 1-6.", "Lansmandan sonra geçen 1-6. aylar için uygulanan aylık büyüme oranı."), label: copy("Growth (1-6 mo) (%)", "Büyüme (1-6 Ay) (%)"), min: 0, step: "0.01" },
      { field: "growthMonths7To18Percent", info: copy("Monthly growth applied for elapsed months 7-18 after the channel start.", "Kanal başlangıcından sonra geçen 7-18. aylar için uygulanan aylık büyüme oranı."), label: copy("Growth (7-18 mo) (%)", "Büyüme (7-18 Ay) (%)"), min: 0, step: "0.01" },
      { field: "growthMonths19To24Percent", info: copy("Monthly growth applied for elapsed months 19-24 after the channel start.", "Kanal başlangıcından sonra geçen 19-24. aylar için uygulanan aylık büyüme oranı."), label: copy("Growth (19-24 mo) (%)", "Büyüme (19-24 Ay) (%)"), min: 0, step: "0.01" },
      { field: "growthYears3To5Percent", info: copy("Monthly growth used after month 24 when longer horizons are selected.", "24. aydan sonra, daha uzun projeksiyonlarda kullanılan aylık büyüme oranı."), label: copy("Year 3-5 growth (%)", "Yıl 3-5 Büyüme (%)"), min: 0, step: "0.01" },
      { field: "collectionDays", info: copy("Average delay before channel revenue becomes cash. The model shifts cash receipts by this delay.", "Kanal cirosunun nakde dönüşme ortalama gecikmesi. Model nakit girişini bu gecikmeye göre kaydırır."), label: copy("Collection (days)", "Tahsilat (Gün)"), min: 0, step: "1" },
      { field: "customerAcquisitionCost", label: copy("Unit marketing (CAC) TL", "Birim Pazarlama (CAC) TL"), min: 0, step: "0.01" },
      { field: "commissionPercent", info: copy("Commission is deducted from gross channel revenue before net revenue is reported.", "Komisyon, net ciro raporlanmadan önce brüt kanal cirosundan düşülür."), label: copy("Channel commission (%)", "Kanal Komisyonu (%)"), max: 100, min: 0, step: "0.1" },
    ];
    const advancedChannelFields = [
      { field: "basketSize", label: copy("Basket Size", "Sepet Büyüklüğü"), min: 0, step: "0.01" },
      { field: "conversionRatePercent", label: copy("Conversion Rate (%)", "Dönüşüm Oranı (%)"), min: 0, step: "0.001" },
      { field: "trafficScore", info: copy("A simple demand strength multiplier. 1 keeps demand unchanged, 1.2 lifts it by 20%, 0.8 lowers it by 20%.", "Basit talep gücü çarpanı. 1 talebi değiştirmez, 1,2 %20 artırır, 0,8 %20 düşürür."), label: copy("Traffic Score", "Trafik Skoru"), min: 0, step: "0.01" },
      { field: "unitSalesPrice", info: copy("Optional channel-specific TRY price. If empty, finance uses the selected product price.", "Opsiyonel kanala özel TL satış fiyatı. Boş bırakılırsa finans seçili ürün fiyatını kullanır."), label: copy("Channel Unit Price (TRY)", "Kanal Birim Fiyatı (TL)"), min: 0, step: "0.01" },
      { field: "repeatRatePercent", label: copy("Repeat Rate (%)", "Tekrar Oranı (%)"), min: 0, step: "0.001" },
      { field: "churnRatePercent", label: copy("Churn Rate (%)", "Kayıp Oranı (%)"), min: 0, step: "0.001" },
      { field: "discountRatePercent", label: copy("Discount Rate (%)", "İndirim Oranı (%)"), min: 0, step: "0.01" },
      { field: "returnRatePercent", label: copy("Return Rate (%)", "İade Oranı (%)"), min: 0, step: "0.001" },
      { field: "capacityLimit", info: copy("Maximum units this channel can sell in a month after all multipliers are applied.", "Tüm çarpanlardan sonra bu kanalın bir ayda satabileceği maksimum adet."), label: copy("Capacity Limit", "Kapasite Limiti"), min: 0, step: "1" },
      { field: "launchFee", label: copy("Launch Fee", "Lansman Bedeli"), min: 0, step: "0.01" },
      { field: "moqMonthly", label: copy("MOQ Monthly", "Aylık MOQ"), min: 0, step: "1" },
      { field: "failureProbabilityPercent", label: copy("Failure Prob. (%)", "Başarısızlık Olas. (%)"), min: 0, step: "0.001" },
      { field: "rampUpMonths", label: copy("Ramp-Up Months", "Ramp-Up Ayı"), min: 0, step: "1" },
    ];
    const seasonalityMonthLabels = form.language === "tr"
      ? ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"]
      : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return renderDashboardLayout(
      "sales-strategy",
        <section className="sales-workspace">
          <div className="sales-header">
            <div>
              <span>{dashboardCompanyName} / {copy("Sales Strategy", "Satış Stratejisi")}</span>
              <h1>{copy("Sales Strategy", "Satış Stratejisi")}</h1>
              <p>{copy("Plan sales channels by product, monthly sales quantity, commission, campaign duration, and monthly or quarterly expectation multipliers. Financial Modelling reads these product-linked quantities directly.", "Satış kanallarını ürün, aylık satış adedi, komisyon, kampanya süresi ve aylık ya da çeyreklik beklenti çarpanlarıyla planlayın. Finansal Modelleme bu ürün bağlantılı adetleri doğrudan kullanır.")}</p>
            </div>
            <div className="sales-header-actions">
              <button type="button" className="app-command-button" onClick={loadPlanningData} disabled={salesLoading}>
                {copy("Refresh Data", "Verileri Yenile")}
              </button>
              <button type="button" className="primary app-command-button" onClick={handleSaveSalesStrategy} disabled={salesLoading}>
                {salesLoading ? copy("Saving...", "Kaydediliyor...") : copy("Save Strategy", "Stratejiyi Kaydet")}
              </button>
            </div>
          </div>

          {salesStatus && <p className="status-message">{salesStatus}</p>}

          <section className={`sales-command-hero ${salesStrategyTone}`} aria-label={copy("Sales strategy readiness", "Satış stratejisi hazırlığı")}>
            <div className="sales-command-copy">
              <span>{copy("Strategy readiness", "Strateji hazırlığı")}</span>
              <h2>{salesReadinessPercent >= 75 ? copy("Sales plan is model-ready", "Satış planı modele hazır") : copy("Turn channels into a usable forecast", "Kanalları kullanılabilir tahmine çevirin")}</h2>
              <p>{copy("Connect products, channel quantities, commissions, and campaigns so finance can read a reliable sales signal.", "Finansın güvenilir satış sinyali okuyabilmesi için ürünleri, kanal adetlerini, komisyonları ve kampanyaları bağlayın.")}</p>
              <div className="sales-readiness-list">
                {salesReadinessItems.map((item) => (
                  <button type="button" className={item.done ? "done" : ""} onClick={() => goTo(item.path, "login")} key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.done ? copy("Ready", "Hazır") : copy("Needed", "Gerekli")}</strong>
                  </button>
                ))}
              </div>
            </div>
            <div className="sales-forecast-preview">
              <div className="readiness-ring" style={{ "--readiness": `${salesReadinessPercent}%` }}>
                <strong>{salesReadinessPercent}%</strong>
                <span>{copy("ready", "hazır")}</span>
              </div>
              <div className="sales-mini-chart" aria-label={copy("12 month sales forecast preview", "12 aylık satış tahmini önizlemesi")}>
                {salesForecastPreview.map((item) => (
                  <span style={{ "--bar-height": `${Math.max(6, (item.value / maxSalesForecastPreview) * 100)}%` }} key={item.label}>
                    <i />
                    <small>{item.label}</small>
                  </span>
                ))}
              </div>
            </div>
          </section>

          <div className="sales-stat-grid">
            {[
              [copy("Monthly channel plan", "Aylık kanal planı"), formatNumber(baseMonthlySalesUnits), copy("sum of channel quantities", "kanal adetleri toplamı")],
              [copy("12M expected units", "12A beklenen adet"), formatNumber(expectedAnnualSalesUnits), multiplierPeriod === "quarterly" ? copy("channel plan x quarterly multipliers", "kanal planı x çeyreklik çarpanlar") : copy("channel plan x monthly multipliers", "kanal planı x aylık çarpanlar")],
              [copy("Ready to sell", "Satmaya hazır"), formatNumber(totalReadyUnits), copy("remaining after channel quantities", "kanal adetlerinden sonra kalan")],
              [copy("Monthly commission", "Aylık komisyon"), formatLira(totalMonthlyCommission), copy("based on product prices", "ürün fiyatlarına göre")],
            ].map(([label, value, detail]) => (
              <article className="sales-stat-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </div>

          <div className="sales-grid">
            <details className="sales-card sales-forecast-card progressive-input-box">
              <summary className="sales-card-heading progressive-section-summary">
                <div>
                  <span className="heading-with-info">
                    {copy("Expectation multiplier period", "Beklenti çarpanı periyodu")}
                    <InfoTip
                      label={copy("Sales expectation multiplier info", "Satış beklenti çarpanı bilgisi")}
                      text={copy(
                        "A multiplier scales the channel sales forecast. Monthly mode uses each month directly: month sales = channel units x that month's multiplier. Quarterly mode repeats each quarter value for its 3 months: Q1 applies to months 1-3, Q2 to 4-6, and so on.",
                        "Çarpan, kanal satış tahminini ölçekler. Aylık modda formül: aylık satış = kanal adedi x o ayın çarpanı. Çeyreklik modda her çeyrek değeri 3 aya yayılır: Q1 ay 1-3'e, Q2 ay 4-6'ya uygulanır.",
                      )}
                    />
                  </span>
                  <h2>{copy("Sales expectation multipliers", "Satış beklentisi çarpanları")}</h2>
                </div>
                <div className="sales-period-toggle" aria-label={copy("Expectation multiplier period", "Beklenti çarpanı periyodu")}>
                  {[
                    ["monthly", copy("Monthly", "Aylık")],
                    ["quarterly", copy("Quarterly", "Çeyreklik")],
                  ].map(([period, label]) => (
                    <button
                      className={period === multiplierPeriod ? "active" : ""}
                      key={period}
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        updateSalesCompany("multiplierPeriod", period);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </summary>
              <div className="sales-forecast-grid">
                {multiplierInputs.map((multiplier, index) => (
                  <label key={`forecast-${index}`}>
                    <span>{multiplierPeriod === "quarterly" ? copy("Quarter", "Çeyrek") : copy("Month", "Ay")} {index + 1}</span>
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      value={multiplier}
                      onChange={(event) => updateSalesForecast(index, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </details>

            <details className="sales-card channels-card progressive-input-box">
              <summary className="sales-card-heading progressive-section-summary">
                <div>
                  <span>{copy("Sales channels", "Satış kanalları")}</span>
                  <h2>{copy("Product, monthly quantity and commission", "Ürün, aylık adet ve komisyon")}</h2>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    addSalesItem("channels");
                  }}
                >{copy("Add Channel", "Kanal Ekle")}</button>
              </summary>
              <div className="sales-channel-grid">
                {salesStrategy.channels.map((channel, index) => {
                  const channelProduct = productMap.get(channel.productId) || channel.product || {};
                  const channelType = salesChannelTypeOptions.find((type) => type.id === (channel.typeId || "direct"));

                  return (
                  <details className="sales-edit-card progressive-input-box sales-item-box" key={channel.id}>
                    <summary className="sales-item-summary progressive-section-summary">
                      <div>
                        <span>{`${copy("Channel", "Kanal")} ${index + 1}`}</span>
                        <strong>{channel.name?.trim() || copy("Unnamed channel", "Adsız kanal")}</strong>
                        <small>{[channelProduct.name, channelType ? getSalesTypeLabel(channelType) : ""].filter(Boolean).join(" / ") || copy("No product selected", "Ürün seçilmedi")}</small>
                      </div>
                      <button
                        type="button"
                        aria-label={copy("Delete channel", "Kanalı sil")}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          removeSalesItem("channels", channel.id);
                        }}
                      >
                        -
                      </button>
                    </summary>
                    <div className="sales-item-fields">
                    <div className="sales-channel-title wide-field">
                      <label><span>{copy("Channel name", "Kanal adı")} *</span><input required value={channel.name} onChange={(event) => updateSalesItem("channels", channel.id, "name", event.target.value)} /></label>
                    </div>
                    <label>
                      <span>{copy("Channel type", "Kanal tipi")} *</span>
                      <select required value={channel.typeId || "direct"} onChange={(event) => updateSalesItem("channels", channel.id, "typeId", event.target.value)}>
                        {salesChannelTypeOptions.map((type) => (
                          <option value={type.id} key={type.id}>{getSalesTypeLabel(type)}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>{copy("Product to sell", "Satılacak ürün")} *</span>
                      <select
                        required
                        value={channel.productId || ""}
                        onChange={(event) => {
                          const product = operationsWorkspace.products.find((item) => item.id === event.target.value);
                          setSalesStrategy((current) => ({
                            ...current,
                            channels: current.channels.map((item) => (
                              item.id === channel.id
                                ? { ...item, product: product || null, productId: product?.id || "", productName: product?.name || "" }
                                : item
                            )),
                          }));
                        }}
                      >
                        <option value="">{copy("Select product", "Ürün seç")}</option>
                        {operationsWorkspace.products.map((product) => (
                          <option value={product.id} key={product.id}>{product.name}</option>
                        ))}
                      </select>
                    </label>
                    {salesChannelRequiredFields.map((field) => (
                      <label key={field.field}>
                        <span className="label-with-info">
                          {field.label} *
                          {field.info && <InfoTip label={`${field.label} ${copy("info", "bilgi")}`} text={field.info} />}
                        </span>
                        <input
                          max={field.max}
                          min={field.min}
                          required
                          step={field.step}
                          type="number"
                          value={channel[field.field] ?? ""}
                          onChange={(event) => updateSalesItem("channels", channel.id, field.field, event.target.value)}
                        />
                      </label>
                    ))}
                    <details
                      className="advanced-channel-panel wide-field"
                      open={channel.advancedOpen ?? false}
                      onToggle={(event) => updateSalesItem("channels", channel.id, "advancedOpen", event.currentTarget.open)}
                    >
                      <summary>{copy("Advanced Channel Parameters", "Gelişmiş Kanal Parametreleri")}</summary>
                      <div className="advanced-channel-grid">
                        {advancedChannelFields.map((field) => (
                          <label key={field.field}>
                            <span className="label-with-info">
                              {field.label}
                              {field.info && <InfoTip label={`${field.label} ${copy("info", "bilgi")}`} text={field.info} />}
                            </span>
                            <input
                              min={field.min}
                              step={field.step}
                              type="number"
                              value={channel[field.field] ?? ""}
                              onChange={(event) => updateSalesItem("channels", channel.id, field.field, event.target.value)}
                            />
                          </label>
                        ))}
                        <div className="seasonality-inputs">
                          <strong>{copy("Seasonality Curve (Jan-Dec multipliers):", "Sezonluk Eğri (Oca-Ara çarpanları):")}</strong>
                          <div>
                            {seasonalityMonthLabels.map((month, index) => (
                              <label key={`${channel.id}-season-${month}`}>
                                <span>{month}</span>
                                <input
                                  min="0"
                                  step="0.01"
                                  type="number"
                                  value={(Array.isArray(channel.seasonalityCurve) ? channel.seasonalityCurve[index] : "") ?? ""}
                                  onChange={(event) => updateSalesChannelSeasonality(channel.id, index, event.target.value)}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </details>
                    {(() => {
                      const product = productMap.get(channel.productId) || channel.product || {};
                      const availability = getProductAvailability(channel.productId);
                      const unit = product.unit || copy("units", "adet");

                      return (
                        <div className="sales-channel-capacity wide-field">
                          <span>{copy("Monthly produced", "Aylık üretilen")}<strong>{formatNumber(availability.monthlyProduced, 2)} {unit}</strong></span>
                          <span>{copy("Planned in channels", "Kanallarda planlanan")}<strong>{formatNumber(availability.plannedSales, 2)} {unit}</strong></span>
                          <span>{copy("Ready to sell remaining", "Satmaya hazır kalan")}<strong>{formatNumber(Math.max(0, availability.remaining), 2)} {unit}</strong></span>
                        </div>
                      );
                    })()}
                    {(() => {
                      const selectedType = salesChannelTypeOptions.find((type) => type.id === (channel.typeId || "direct"));

                      return selectedType ? (
                        <div className="sales-type-info wide-field">
                          <span>{copy("Avg acquisition", "Ort. müşteri kazanımı")}<strong>{formatNumber(selectedType.averageCustomerAcquisitionRate, 1)}%</strong></span>
                          <span>{copy("Avg commission", "Ort. komisyon")}<strong>{formatNumber(selectedType.averageCommissionPercent, 1)}%</strong></span>
                          <small>{getSalesTypeDescription(selectedType)}</small>
                        </div>
                      ) : null;
                    })()}
                    </div>
                  </details>
                  );
                })}
              </div>
            </details>

            <details className="sales-card campaigns-card progressive-input-box">
              <summary className="sales-card-heading progressive-section-summary">
                <div>
                  <span>{copy("Marketing campaigns", "Pazarlama kampanyaları")}</span>
                  <h2>{copy("Budget, campaign type, duration in days and target channel", "Bütçe, kampanya tipi, gün bazlı süre ve hedef kanal")}</h2>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    addSalesItem("campaigns");
                  }}
                >{copy("Add Campaign", "Kampanya Ekle")}</button>
              </summary>
              {renderTableToolbar("sales-campaigns", salesStrategy.campaigns, visibleCampaignRows)}
              <div className="sales-table">
                <div className="sales-table-row sales-table-head campaign-row-layout sortable-table-head">
                  {campaignTableColumns.map((column, columnIndex) => {
                    const key = getTableColumnKey(column, columnIndex);
                    const control = tableControls["sales-campaigns"] || {};
                    const active = control.sortKey === key;

                    return (
                      <button
                        type="button"
                        className={active ? "active" : ""}
                        key={key}
                        onClick={() => updateTableControl("sales-campaigns", getNextTableSortPatch(control, key))}
                      >
                        <span>{column.header}</span>
                        <small aria-hidden="true">{active ? (control.direction === "desc" ? "DESC" : "ASC") : "SORT"}</small>
                      </button>
                    );
                  })}
                </div>
                {(visibleCampaignRows.length ? visibleCampaignRows : [{ id: "empty" }]).map((campaign, index) => {
                  if (campaign.id === "empty") {
                    return (
                      <div className="sales-table-row campaign-row-layout table-empty-row" key="sales-campaigns-empty">
                        <span className="table-empty-cell">{copy("No matching records", "Eşleşen kayıt yok")}</span>
                      </div>
                    );
                  }
                  const selectedType = campaignTypeOptions.find((type) => type.id === (campaign.typeId || "digital"));

                  return (
                  <details className="sales-table-row campaign-row campaign-row-layout progressive-input-box sales-campaign-box" key={campaign.id}>
                    <summary className="sales-item-summary progressive-section-summary">
                      <div>
                        <span>{`${copy("Campaign", "Kampanya")} ${index + 1}`}</span>
                        <strong>{campaign.name?.trim() || copy("Unnamed campaign", "Adsız kampanya")}</strong>
                        <small>{[selectedType ? getSalesTypeLabel(selectedType) : "", campaign.channel, formatLira(toFiniteNumber(campaign.budget))].filter(Boolean).join(" / ")}</small>
                      </div>
                    </summary>
                    <div className="sales-campaign-fields campaign-row-layout">
                    <label><input value={campaign.name} onChange={(event) => updateSalesItem("campaigns", campaign.id, "name", event.target.value)} /></label>
                    <label>
                      <select value={campaign.typeId || "digital"} onChange={(event) => updateSalesItem("campaigns", campaign.id, "typeId", event.target.value)}>
                        {campaignTypeOptions.map((type) => (
                          <option value={type.id} key={type.id}>{getSalesTypeLabel(type)}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <select value={campaign.channel || ""} onChange={(event) => updateSalesItem("campaigns", campaign.id, "channel", event.target.value)}>
                        <option value="">{copy("Select channel", "Kanal seç")}</option>
                        {salesStrategy.channels.map((channel) => (
                          <option value={channel.name || channel.id} key={channel.id}>{channel.name || channel.id}</option>
                        ))}
                      </select>
                    </label>
                    <label><input min="0" step="1000" type="number" value={campaign.budget} onChange={(event) => updateSalesItem("campaigns", campaign.id, "budget", event.target.value)} /></label>
                    <label><input min="0" step="1" type="number" value={campaign.durationDays} onChange={(event) => updateSalesItem("campaigns", campaign.id, "durationDays", event.target.value)} /></label>
                    {(() => {
                      return selectedType ? (
                        <div className="sales-type-info campaign-type-info">
                          <span>{copy("Avg acquisition", "Ort. müşteri kazanımı")}<strong>{formatNumber(selectedType.averageCustomerAcquisitionRate, 1)}%</strong></span>
                          <span>{copy("Avg conversion", "Ort. dönüşüm")}<strong>{formatNumber(selectedType.averageConversionRate, 1)}%</strong></span>
                          <span>{copy("Avg duration", "Ort. süre")}<strong>{formatNumber(selectedType.averageDurationDays, 0)} {copy("days", "gün")}</strong></span>
                          <small>{getSalesTypeDescription(selectedType)}</small>
                        </div>
                      ) : null;
                    })()}
                    <textarea value={campaign.goal} onChange={(event) => updateSalesItem("campaigns", campaign.id, "goal", event.target.value)} />
                    </div>
                  </details>
                  );
                })}
              </div>
            </details>

            <details className="sales-card sales-decision-card progressive-input-box">
              <summary className="sales-card-heading progressive-section-summary">
                <div>
                  <span>{copy("Strategy readout", "Strateji okuması")}</span>
                  <h2>{copy("Manual inputs translated into decision signals", "Manuel girdilerden karar sinyalleri")}</h2>
                </div>
              </summary>
              <div className="sales-signal-grid">
                <span>{copy("Products in channels", "Kanallardaki ürün")} <strong>{formatNumber(activeProductCount)}</strong><small>{copy("selected from Operations products", "Operations ürünlerinden seçildi")}</small></span>
                <span>{copy("Campaign budget", "Kampanya bütçesi")} <strong>{formatLira(totalCampaignBudget)}</strong><small>{copy("total planned marketing spend", "toplam planlanan pazarlama bütçesi")}</small></span>
                <span>{copy("Average multiplier", "Ortalama çarpan")} <strong>{formatNumber(averageMultiplier, 2)}x</strong><small>{multiplierPeriod === "quarterly" ? copy("quarterly values expanded to 12 months", "çeyrek değerleri 12 aya yayıldı") : copy("across 12 months", "12 ay genelinde")}</small></span>
                <span>{copy("Ready remaining", "Hazır kalan")} <strong>{formatNumber(totalReadyUnits)}</strong><small>{copy("after planned channel quantities", "planlanan kanal adetlerinden sonra")}</small></span>
              </div>
            </details>
          </div>
        </section>,
    );
  }

  function renderOperationDataPage({ columns, description, entity, fields, rows, title }) {
    return renderDashboardLayout(
      `operations/${activeOperationsSubmodule.key}`,
        <section className="operations-workspace operations-modern">
          <div className="operations-header">
            <div>
              <span>Operations / {activeOperationsSubmodule.label}</span>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            <div className="operations-actions">
              <button type="button" className="operations-refresh-button" onClick={loadOperationsData}>{copy("Refresh Data", "Verileri Yenile")}</button>
            </div>
          </div>

          <div className="operation-data-grid">
            {renderOperationRecordForm(entity, fields)}
            <article className="operation-card operation-data-table-card">
              <div className="operation-card-heading">
                <h2>{copy("Records", "Kayıtlar")}</h2>
                <span>{rows.length} {copy("records", "kayıt")}</span>
              </div>
              {renderSortableDataTable({
                columns,
                gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr))`,
                rows,
                tableId: `operations-${entity}`,
              })}
            </article>
          </div>
          {operationsStatus && <p className="status-message">{operationsStatus}</p>}
        </section>,
    );
  }

  function renderMachinesEquipmentPage() {
    const machineFields = [
      { name: "name", label: copy("Machine name", "Makine adı") },
      { info: copy("Purchase value of the selected machine. If currency is USD/EUR, financial analysis converts it to TRY using the current FX rate.", "Seçili makinenin alım değeri. Para birimi USD/EUR ise finansal analiz güncel kurla TL'ye çevirir."), name: "price", label: copy("Machine price", "Makine fiyatı"), step: "0.01", type: "number" },
      { info: copy("Choose the currency the price is entered in. TRY stays unchanged; USD/EUR are multiplied by their TRY rates in financial outputs.", "Fiyatın girildiği para birimini seçin. TL aynen kalır; USD/EUR finans çıktılarında ilgili TL kuru ile çarpılır."), name: "priceCurrency", label: copy("Currency", "Para birimi"), options: operationCurrencyOptions, type: "select" },
      { name: "hourlyEnergyConsumptionKwh", label: copy("Hourly energy consumption", "Saatlik enerji tüketimi"), step: "0.01", type: "number" },
      { info: copy("How many product units this machine can process at the same time.", "Makinenin aynı anda kaç ürün işleyebildiği."), name: "concurrentCapacity", label: copy("Concurrent capacity", "Eş zamanlı kapasite"), step: "1", type: "number" },
      { info: copy("Daily available production time used by the scheduler before delay cost starts.", "Gecikme maliyeti başlamadan önce planlayıcının kullandığı günlük çalışma süresi."), name: "availabilityHours", label: copy("Availability hours", "Çalışma saati"), step: "0.25", type: "number" },
      { info: copy("Speed multiplier applied to process time. 1 is normal, 1.2 is 20% faster.", "İşlem süresine uygulanan hız çarpanı. 1 normal, 1.2 yüzde 20 daha hızlıdır."), name: "speedMultiplier", label: copy("Speed multiplier", "Hız çarpanı"), step: "0.01", type: "number" },
      { info: copy("Optional advanced risk input kept on the machine record for future reliability simulations.", "Gelecek güvenilirlik simülasyonları için makine kaydında tutulan opsiyonel risk girdisi."), name: "failureProbabilityPercent", label: copy("Failure probability %", "Arıza ihtimali %"), step: "0.01", type: "number" },
    ];
    const equipmentFields = [
      { name: "name", label: copy("Equipment name", "Ekipman adı") },
      { info: copy("Purchase value per equipment item. Quantity multiplies this value in investment cost.", "Ekipman başına alım değeri. Yatırım maliyetinde adet ile çarpılır."), name: "price", label: copy("Equipment price", "Ekipman fiyatı"), step: "0.01", type: "number" },
      { info: copy("Choose the currency the equipment price is entered in. USD/EUR are converted to TRY in financial analysis.", "Ekipman fiyatının girildiği para birimini seçin. USD/EUR finansal analizde TL'ye çevrilir."), name: "priceCurrency", label: copy("Currency", "Para birimi"), options: operationCurrencyOptions, type: "select" },
      { name: "quantity", label: copy("Equipment quantity", "Ekipman miktarı"), step: "1", type: "number" },
    ];
    const machineColumns = [
      { header: copy("Machine", "Makine"), key: "machine", render: (row) => row.name, value: (row) => row.name },
      { header: copy("Price", "Fiyat"), key: "price", render: (row) => formatOperationMoney(row.price, row.price_currency, exchangeRates), sortValue: (row) => toFiniteNumber(row.price), filterValue: (row) => `${row.price} ${row.price_currency || "TRY"}` },
      { header: copy("Hourly Energy", "Saatlik Enerji"), key: "energy", render: (row) => `${formatNumber(row.hourly_energy_consumption_kwh, 2)} kWh`, sortValue: (row) => toFiniteNumber(row.hourly_energy_consumption_kwh) },
      { header: copy("Capacity", "Kapasite"), key: "capacity", render: (row) => formatNumber(row.concurrent_capacity || 1), sortValue: (row) => toFiniteNumber(row.concurrent_capacity || 1) },
      { header: copy("Availability", "Çalışma"), key: "availability", render: (row) => `${formatNumber(row.availability_hours || 8, 2)} ${copy("hours", "saat")}`, sortValue: (row) => toFiniteNumber(row.availability_hours || 8) },
      { header: copy("Speed", "Hız"), key: "speed", render: (row) => `${formatNumber(row.speed_multiplier || 1, 2)}x`, sortValue: (row) => toFiniteNumber(row.speed_multiplier || 1) },
      { header: copy("Copy", "Kopyala"), render: (row) => (
        <button type="button" className="record-copy-button" onClick={() => copyOperationRecordToForm("machine", row)}>
          {copy("Copy", "Kopyala")}
        </button>
      ), key: "copy", sortable: false },
    ];
    const equipmentColumns = [
      { header: copy("Equipment", "Ekipman"), key: "equipment", render: (row) => row.name, value: (row) => row.name },
      { header: copy("Price", "Fiyat"), key: "price", render: (row) => formatOperationMoney(row.price, row.price_currency, exchangeRates), sortValue: (row) => toFiniteNumber(row.price), filterValue: (row) => `${row.price} ${row.price_currency || "TRY"}` },
      { header: copy("Quantity", "Miktar"), key: "quantity", render: (row) => formatNumber(row.quantity), sortValue: (row) => toFiniteNumber(row.quantity) },
      { header: copy("Copy", "Kopyala"), render: (row) => (
        <button type="button" className="record-copy-button" onClick={() => copyOperationRecordToForm("equipment", row)}>
          {copy("Copy", "Kopyala")}
        </button>
      ), key: "copy", sortable: false },
    ];
    const machineInvestmentTry = operationsWorkspace.machines.reduce(
      (total, machine) => total + convertMoneyToTry(machine.price, machine.price_currency, exchangeRates),
      0,
    );
    const equipmentInvestmentTry = (operationsWorkspace.equipment || []).reduce(
      (total, equipment) => total + convertMoneyToTry(toFiniteNumber(equipment.price) * Math.max(1, toFiniteNumber(equipment.quantity, 1)), equipment.price_currency, exchangeRates),
      0,
    );
    const totalMachineHours = operationsWorkspace.machines.reduce((total, machine) => total + toFiniteNumber(machine.availability_hours, 8), 0);

    return renderDashboardLayout(
      `operations/${activeOperationsSubmodule.key}`,
        <section className="operations-workspace operations-modern operations-entry-page operations-machines-page">
          <div className="operations-header">
            <div>
              <span>Operations / {copy("Machines & Equipment", "Makine & Ekipman")}</span>
              <h1>{copy("Machines & Equipment", "Makine & Ekipman")}</h1>
              <p>{copy("Keep machines used in production plans separate from simple equipment records.", "Üretim planlarında kullanılacak makineleri sade ekipman kayıtlarından ayrı tutun.")}</p>
            </div>
            <div className="operations-actions">
              <button type="button" className="operations-refresh-button" onClick={loadOperationsData}>{copy("Refresh Data", "Verileri Yenile")}</button>
            </div>
          </div>

          <div className="process-summary-grid operations-entry-summary">
            <article className="operation-card process-summary-card">
              <span>{copy("Machines", "Makineler")}</span>
              <strong>{formatNumber(operationsWorkspace.machines.length)}</strong>
              <small>{formatNumber(totalMachineHours, 1)} {copy("available hours", "çalışma saati")}</small>
            </article>
            <article className="operation-card process-summary-card">
              <span>{copy("Equipment", "Ekipman")}</span>
              <strong>{formatNumber((operationsWorkspace.equipment || []).length)}</strong>
              <small>{copy("supporting investment records", "destek yatırım kayıtları")}</small>
            </article>
            <article className="operation-card process-summary-card">
              <span>{copy("Registered investment", "Kayıtlı yatırım")}</span>
              <strong>{formatLira(machineInvestmentTry + equipmentInvestmentTry)}</strong>
              <small>{copy("converted to TRY for finance", "finans için TL'ye çevrilir")}</small>
            </article>
          </div>

          <div className="machine-equipment-grid">
            <div className="operation-data-grid compact operations-record-pair operations-machine-record-pair">
              {renderOperationRecordForm("machine", machineFields, { className: "operations-machine-form-card", formRef: machineFormRef })}
              <article className="operation-card operation-data-table-card operations-record-list-card operations-machine-list-card" style={machineListHeightStyle}>
                <div className="operation-card-heading">
                  <h2>{copy("Machines", "Makineler")}</h2>
                  <span>{operationsWorkspace.machines.length} {copy("records", "kayıt")}</span>
                </div>
                {renderSortableDataTable({
                  columns: machineColumns,
                  gridTemplateColumns: `repeat(${machineColumns.length}, minmax(120px, 1fr))`,
                  rows: operationsWorkspace.machines,
                  tableId: "machines",
                })}
              </article>
            </div>

            <div className="operation-data-grid compact operations-record-pair operations-equipment-record-pair">
              {renderOperationRecordForm("equipment", equipmentFields, { className: "operations-equipment-form-card", formRef: equipmentFormRef })}
              <article className="operation-card operation-data-table-card operations-record-list-card operations-equipment-list-card" style={equipmentListHeightStyle}>
                <div className="operation-card-heading">
                  <h2>{copy("Equipment", "Ekipman")}</h2>
                  <span>{(operationsWorkspace.equipment || []).length} {copy("records", "kayıt")}</span>
                </div>
                {renderSortableDataTable({
                  columns: equipmentColumns,
                  gridTemplateColumns: `repeat(${equipmentColumns.length}, minmax(120px, 1fr))`,
                  rows: operationsWorkspace.equipment || [],
                  tableId: "equipment",
                })}
              </article>
            </div>
          </div>
          {operationsStatus && <p className="status-message">{operationsStatus}</p>}
        </section>,
    );
  }

  const references = [
    { name: copy("Production Planning", "Üretim Planlama"), mark: "PP", tone: "teal" },
    { name: copy("Feasibility Model", "Fizibilite Modeli"), mark: "FM", tone: "cyan" },
    { name: copy("Cash Scenario", "Nakit Senaryosu"), mark: "CS", tone: "amber" },
    { name: copy("Sales Route", "Satış Rotası"), mark: "SR", tone: "green" },
    { name: copy("Risk Review", "Risk Analizi"), mark: "RR", tone: "clay" },
  ];

  const personas = [
    {
      avatarType: "planning",
      title: labels.farmerPersona,
      need: labels.farmerNeed,
      benefit: labels.farmerBenefit,
      difference: labels.farmerDifference,
    },
    {
      avatarType: "production",
      title: labels.factoryOwnerPersona,
      need: labels.factoryOwnerNeed,
      benefit: labels.factoryOwnerBenefit,
      difference: labels.factoryOwnerDifference,
    },
    {
      avatarType: "finance",
      title: labels.entrepreneurPersona,
      need: labels.entrepreneurNeed,
      benefit: labels.entrepreneurBenefit,
      difference: labels.entrepreneurDifference,
    },
    {
      avatarType: "operations",
      title: labels.exporterPersona,
      need: labels.exporterNeed,
      benefit: labels.exporterBenefit,
      difference: labels.exporterDifference,
    },
  ];

  const renderAteraOrbit = (className = "") => (
    <div className={`who-orbit ${className}`.trim()} aria-hidden="true">
      <div className="who-core">Atera</div>
      <span className="who-node node-plan">{copy("Plan", "Planla")}</span>
      <span className="who-node node-test">{copy("Test", "Dene")}</span>
      <span className="who-node node-decide">{copy("Decide", "Karar ver")}</span>
      <span className="who-node node-scale">{copy("Scale", "Büyüt")}</span>
    </div>
  );

  const dashboardModules = [
    { key: "operations", path: "/operations", label: "Operations", category: copy("Production", "Üretim"), tone: "operations" },
    { key: "sales-strategy", path: "/sales-strategy", label: copy("Sales Strategy", "Satış Stratejisi"), category: copy("Market", "Pazar"), tone: "sales" },
    { key: "financial-modelling", path: "/financial-modelling", label: copy("Financial Modelling", "Finansal Modelleme"), category: copy("Finance", "Finans"), tone: "finance" },
    { key: "simulation", path: "/simulation", label: copy("Simulation", "Simülasyon"), category: copy("Decision", "Karar"), tone: "decision" },
    { key: "reports", path: "/reports", label: copy("Reports", "Raporlar"), category: copy("Output", "Çıktı"), tone: "reports" },
  ];
  const operationsSubmodules = [
    { key: "resources", path: "/operations/resources", label: copy("Resources", "Kaynak") },
    { key: "products", path: "/operations/products", label: copy("Products", "Ürünler") },
    { key: "machines-equipment", path: "/operations/machines-equipment", label: copy("Machines & Equipment", "Makine & Ekipman") },
    { key: "data-entry", path: "/operations/data-entry", label: copy("Process Definition", "Süreç Tanımlama") },
    { key: "active-processes", path: "/operations/active-processes", label: copy("Active Processes", "Mevcut Süreçler") },
  ];
  const productPlusSubmodules = [
    { key: "product-tree", path: "/product-plus/product-tree", label: copy("Product Tree", "Ürün Ağacı") },
  ];
  const financialSubmodules = [
    { group: "Girdiler", key: "inputs", path: "/financial-modelling/girdiler", label: "Girdiler" },
    { group: "Krediler", key: "loans", path: "/financial-modelling/krediler", label: "Krediler" },
    { group: "Analiz", key: "overview", path: "/financial-modelling/analiz", label: "Maliyet & Getiri" },
  ];

  const routePath = normalizeRoutePath(path);
  const activeModule = dashboardModules.find((module) => module.path === routePath);
  const activeOperationsSubmodule = operationsSubmodules.find((module) => module.path === routePath);
  const activeProductPlusSubmodule = productPlusSubmodules.find((module) => module.path === routePath);
  const activeFinancialSubmodule = financialSubmodules.find((module) => module.path === routePath);
  const isLegacyFinancialDetailPath = [
    "/financial-modelling/maliyet-hesaplama/urun-maliyeti",
    "/financial-modelling/maliyet-hesaplama/yatirim-maliyeti",
    "/financial-modelling/getiri-hesaplama/urun-getirisi",
    "/financial-modelling/getiri-hesaplama/yatirim-getirisi",
  ].includes(routePath);
  const activeSimulationVariant = simulationVariants.find((variant) => variant.path === routePath);
  const isOperationsRoute = routePath === "/operations" || routePath.startsWith("/operations/");
  const isProductPlusRoute = routePath === "/product-plus" || routePath.startsWith("/product-plus/");
  const isFinancialRoute = routePath === "/financial-modelling" || routePath.startsWith("/financial-modelling/");
  const isSimulationRoute = routePath === "/simulation" || routePath.startsWith("/simulation/");
  const editableAuthorizationRoles = roles.filter((role) => !isAdminRole(role));
  const moduleLabelByKey = Object.fromEntries(dashboardModules.map((module) => [module.key, module.label]));
  const getModuleLabel = (module) => moduleLabelByKey[module.module_key] || module.name;
  const userTableColumns = [
    { header: labels.username, key: "username", render: (row) => row.username, value: (row) => row.username },
    { header: labels.email, key: "email", render: (row) => row.email, value: (row) => row.email },
    { header: labels.department, key: "department", render: (row) => row.department || "-", value: (row) => row.department || "" },
    { header: labels.accessLevel, key: "access-level", render: (row) => row.access_level, value: (row) => row.access_level },
  ];
  const permissionTableRows = editableAuthorizationRoles.flatMap((role) => modules.map((module) => {
    const permission = role.permissions[module.module_key] || {};
    return {
      canRead: Boolean(permission.canRead),
      canWrite: Boolean(permission.canWrite),
      id: `${role.id}-${module.id}`,
      module,
      moduleLabel: getModuleLabel(module),
      role,
      roleName: role.name,
    };
  }));
  const permissionTableColumns = [
    { header: labels.accessLevel, key: "role", render: (row) => row.roleName, value: (row) => row.roleName },
    { header: labels.module, key: "module", render: (row) => row.moduleLabel, value: (row) => row.moduleLabel },
    {
      header: labels.readPermission,
      key: "read",
      render: (row) => (
        <label className="permission-check">
          <input
            checked={row.canRead}
            disabled={!authorizationAccess.write || authorizationLoading}
            type="checkbox"
            onChange={(event) => updatePermission(row.role, row.module, "can_read", event.target.checked)}
          />
          <span>{labels.readPermission}</span>
        </label>
      ),
      sortValue: (row) => (row.canRead ? 1 : 0),
      filterValue: (row) => (row.canRead ? labels.readPermission : copy("No read", "Okuma yok")),
    },
    {
      header: labels.writePermission,
      key: "write",
      render: (row) => (
        <label className="permission-check">
          <input
            checked={row.canWrite}
            disabled={!authorizationAccess.write || authorizationLoading}
            type="checkbox"
            onChange={(event) => updatePermission(row.role, row.module, "can_write", event.target.checked)}
          />
          <span>{labels.writePermission}</span>
        </label>
      ),
      sortValue: (row) => (row.canWrite ? 1 : 0),
      filterValue: (row) => (row.canWrite ? labels.writePermission : copy("No write", "Yazma yok")),
    },
  ];
  const operationsWorkspaceForFinance = withTryOperationWorkspace(operationsWorkspace, exchangeRates);
  const dashboardSelectedProduct = operationsWorkspace.product || operationsWorkspace.products[0] || null;
  const dashboardSelectedProductId = dashboardSelectedProduct?.id || "";
  const dashboardScopedActivePlans = dashboardSelectedProductId
    ? operationsWorkspaceForFinance.activePlans.filter((plan) => getPlanProductId(plan) === dashboardSelectedProductId)
    : operationsWorkspaceForFinance.activePlans;
  const dashboardScopedLatestPlan = dashboardSelectedProductId
    ? dashboardScopedActivePlans.find((plan) => plan.id === operationsWorkspaceForFinance.latestPlan?.id) || dashboardScopedActivePlans[0] || null
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
        channels: salesStrategy.channels.filter((channel) => (channel.productId || channel.product_id) === dashboardSelectedProductId),
      }
    : salesStrategy;
  const financialSettingsForModel = { ...financialSettingsForm, exchangeRates };
  const projectedFinancialModel = buildFinancialFeasibilityModel(financialModel, dashboardSalesStrategy, financialSettingsForModel, dashboardOperationsWorkspace, financialHorizon);
  const financialSummary = projectedFinancialModel.summary || emptyFinancialModel.summary;
  const financialTrendRows = projectedFinancialModel.trendRows || [];
  const financialMonthCount = getProjectionMonthCount(financialHorizon);
  const currentOperationPlans = getCurrentOperationPlans(dashboardOperationsWorkspace);
  const activePlanResults = currentOperationPlans.map((plan) => plan.result || {}).filter(hasViablePlanResult);
  const latestPlan = currentOperationPlans[0] || dashboardOperationsWorkspace.latestPlan || null;
  const latestPlanResult = latestPlan?.result || (operationPlanResult
    ? calculateCurrentPlanResult({ input: operationPlan, result: operationPlanResult }, dashboardOperationsWorkspace, { optimize: false })
    : null);
  const totalDailyProduction = activePlanResults.reduce((total, result) => total + toFiniteNumber(result.producedQuantity), 0);
  const totalDailyTrackedCost = activePlanResults.reduce((total, result) => total + toFiniteNumber(result.totalTrackedDailyCost), 0);
  const totalDailyEnergy = activePlanResults.reduce((total, result) => total + toFiniteNumber(result.energyConsumptionKwh), 0);
  const dashboardProductName = dashboardSelectedProduct?.name || copy("Product input needed", "Ürün girdisi gerekli");
  const dashboardCompanyName = currentProfile?.company?.name || currentProfile?.company_id || "Atera";
  const dashboardProductContext = dashboardSelectedProduct?.product_group || dashboardSelectedProduct?.name || copy("No product selected", "Ürün seçilmedi");
  const hasOperationData = Boolean(operationsWorkspace.products.length || operationsWorkspace.machines.length || operationsWorkspace.materials.length || operationsWorkspace.workforce.length || activePlanResults.length);
  const dashboardExpectedSalesUnits = Array.from({ length: 12 }, (_, index) => index)
    .reduce((total, index) => total + getSalesForecastForMonth(dashboardSalesStrategy, index), 0);
  const hasSalesForecast = dashboardSalesStrategy.channels.some((channel) => channel.productId && toFiniteNumber(channel.monthlySalesUnits) > 0);
  const hasFinancialSourceData = Boolean(activePlanResults.length && hasSalesForecast && financialModel.settingsSaved);
  const noDataValue = "-";
  const moneyOrMissing = (value) => (hasFinancialSourceData ? formatLira(value) : noDataValue);
  const monthlyRevenue = financialMonthCount ? toFiniteNumber(financialSummary.salesRevenue) / financialMonthCount : 0;
  const monthlyCost = financialMonthCount ? toFiniteNumber(financialSummary.totalCost) / financialMonthCount : 0;
  const monthlyNet = financialMonthCount ? toFiniteNumber(financialSummary.netIncome) / financialMonthCount : 0;
  const dashboardStats = [
    { category: copy("Production", "Üretim"), label: copy("Daily Production", "Günlük Üretim"), value: activePlanResults.length ? `${formatNumber(totalDailyProduction, 2)} ${latestPlanResult?.productUnit || operationsWorkspace.product?.unit || copy("units", "adet")}` : noDataValue, delta: copy("Supabase", "Supabase"), detail: copy("active process result", "aktif süreç sonucu"), tone: "operations" },
    { category: copy("Production", "Üretim"), label: copy("Active Plans", "Aktif Plan"), value: formatNumber(operationsWorkspace.activePlans.length), delta: copy("Supabase", "Supabase"), detail: copy("saved process plans", "kayıtlı süreç planları"), tone: "operations" },
    { category: copy("Finance", "Finans"), label: copy("Monthly Revenue", "Aylık Ciro"), value: moneyOrMissing(monthlyRevenue), delta: copy("calculated", "hesaplandı"), detail: copy("from channel sales plan", "kanal satış planından"), tone: "finance" },
    { category: copy("Finance", "Finans"), label: copy("Cash Runway", "Nakit Dayanma"), value: hasFinancialSourceData ? `${formatNumber(financialSummary.cashRunwayMonths)} ${copy("mo", "ay")}` : noDataValue, delta: copy("calculated", "hesaplandı"), detail: copy("from current cash", "mevcut nakitten"), tone: "finance" },
  ];
  const factoryLines = operationsWorkspace.machines.slice(0, 5).map((machine, index) => ({
    name: machine.name,
    status: `${formatOperationMoney(machine.price, machine.price_currency, exchangeRates)} / ${formatNumber(machine.hourly_energy_consumption_kwh, 2)} kWh`,
    tone: ["teal", "cyan", "amber", "navy", "green"][index % 5],
  }));
  const factoryMetrics = [
    [copy("Machines", "Makine"), formatNumber(operationsWorkspace.machines.length)],
    [copy("Materials", "Malzeme"), formatNumber(operationsWorkspace.materials.length)],
    [copy("Workforce Roles", "İş Gücü Rolü"), formatNumber(operationsWorkspace.workforce.length)],
    [copy("Daily Energy", "Günlük Enerji"), activePlanResults.length ? `${formatNumber(totalDailyEnergy, 2)} kWh` : noDataValue],
  ];
  const dashboardFinanceKpis = [
    [copy("Estimated Revenue", "Tahmini Ciro"), moneyOrMissing(monthlyRevenue)],
    [copy("Estimated Cost", "Tahmini Maliyet"), moneyOrMissing(monthlyCost)],
    [copy("Net Profit", "Net Kâr"), moneyOrMissing(monthlyNet)],
  ];
  const dashboardFinancialRisks = [
    [copy("Unsold inventory", "Satılmayan stok"), hasFinancialSourceData ? `${formatNumber(financialSummary.unsoldInventoryUnits)} ${copy("units", "adet")}` : noDataValue],
    [copy("Spoilage / returns", "Fire / iade"), hasFinancialSourceData ? formatLira(financialSummary.expiredWriteOffCost) : noDataValue],
    [copy("Working capital", "İşletme sermayesi"), hasFinancialSourceData ? formatLira(financialSummary.workingCapitalRequirement) : noDataValue],
  ];
  const operationUnitSalePrice = toFiniteNumber(
    latestPlanResult?.productPrice,
    toFiniteNumber(dashboardOperationsWorkspace.product?.price, toFiniteNumber(dashboardOperationsWorkspace.products[0]?.price)),
  );
  const operationUnitCost = toFiniteNumber(latestPlanResult?.producedQuantity)
    ? toFiniteNumber(latestPlanResult.totalTrackedDailyCost) / toFiniteNumber(latestPlanResult.producedQuantity)
    : toFiniteNumber(financialSummary.unitProductionCost);
  const operationUnitProfit = operationUnitSalePrice - operationUnitCost;
  const operationProfitMargin = operationUnitSalePrice ? (operationUnitProfit / operationUnitSalePrice) * 100 : 0;
  const technicalSpecs = [
    [copy("Weight", "Ağırlık"), dashboardSelectedProduct?.weight_kg ? `${formatNumber(dashboardSelectedProduct.weight_kg, 2)} kg` : noDataValue],
    [copy("Dimensions", "Boyut"), dashboardSelectedProduct?.dimensions || noDataValue],
    [copy("Material", "Malzeme"), dashboardSelectedProduct?.material_name || noDataValue],
    [copy("Quality", "Kalite"), dashboardSelectedProduct?.quality_grade || noDataValue],
    [copy("Cycle Time", "Çevrim"), dashboardSelectedProduct?.cycle_time_seconds ? `${formatNumber(dashboardSelectedProduct.cycle_time_seconds, 2)} ${copy("sec", "sn")}` : noDataValue],
    [copy("Labor / Unit", "İşçilik / Birim"), dashboardSelectedProduct?.labor_minutes_per_unit ? `${formatNumber(dashboardSelectedProduct.labor_minutes_per_unit, 2)} ${copy("min", "dk")}` : noDataValue],
    [copy("Material / Unit", "Malzeme / Birim"), dashboardSelectedProduct?.material_kg_per_unit ? `${formatNumber(dashboardSelectedProduct.material_kg_per_unit, 2)} kg` : noDataValue],
    [copy("Scrap Rate", "Fire Oranı"), dashboardSelectedProduct?.scrap_rate ? `${formatNumber(dashboardSelectedProduct.scrap_rate, 2)}%` : noDataValue],
  ];
  const operationProcessSteps = (latestPlanResult?.operationRows || []).map((row) => ({
    id: `operation-${row.operationId || row.operationName}`,
    name: row.operationName,
    station: `${row.machineName || copy("Machine", "Makine")} / ${formatMinutesDuration(row.busyMinutes || 0)}`,
  }));
  const operationFlowSteps = operationProcessSteps.length ? operationProcessSteps : [
    ...(latestPlanResult?.machineRows || []).map((row) => ({
      id: `machine-${row.machineId}`,
      name: row.name,
      station: `${formatNumber(row.dailyHours, 2)} ${copy("hours", "saat")} / ${formatNumber(row.energyConsumptionKwh, 2)} kWh`,
    })),
    ...(latestPlanResult?.workforceRows || []).map((row) => ({
      id: `workforce-${row.workforceId}`,
      name: row.roleName,
      station: `${formatNumber(row.peopleAssigned)} ${copy("people", "kişi")} / ${formatLira(row.cost)}`,
    })),
    ...(latestPlanResult?.materialRows || []).map((row) => ({
      id: `material-${row.materialId}`,
      name: row.name,
      station: `${formatNumber(row.dailyQuantity, 2)} ${row.unit || ""} / ${formatLira(row.cost)}`,
    })),
  ];
  const dashboardInsights = [
    dashboardSelectedProduct
      ? { title: copy("Product data loaded", "Ürün verisi yüklendi"), copy: `${dashboardSelectedProduct.product_code || "-"} / ${dashboardSelectedProduct.name || "-"}`, tone: "teal" }
      : { title: copy("Product input needed", "Ürün girdisi gerekli"), copy: copy("Add a product in Operations so feasibility can use a real item.", "Fizibilitenin gerçek ürün kullanması için Operations'a ürün ekleyin."), tone: "amber" },
    activePlanResults.length
      ? { title: copy("Process result loaded", "Süreç sonucu yüklendi"), copy: `${formatNumber(totalDailyProduction, 2)} ${latestPlanResult?.productUnit || copy("units", "adet")} / ${formatLira(totalDailyTrackedCost)}`, tone: "cyan" }
      : { title: copy("Process result needed", "Süreç sonucu gerekli"), copy: copy("Save a process plan so production and cost numbers are calculated from Supabase.", "Üretim ve maliyet sayıları Supabase'ten hesaplansın diye süreç planı kaydedin."), tone: "amber" },
    hasSalesForecast
      ? { title: copy("Sales plan loaded", "Satış planı yüklendi"), copy: `${formatNumber(dashboardExpectedSalesUnits)} ${copy("expected units across 12 months", "12 ay beklenen adet")}`, tone: "teal" }
      : { title: copy("Sales plan needed", "Satış planı gerekli"), copy: copy("Add product-linked channel quantities in Sales Strategy to unlock revenue, inventory, and runway calculations.", "Ciro, stok ve nakit hesapları için Satış Stratejisi'nde ürüne bağlı kanal adetleri girin."), tone: "amber" },
    hasFinancialSourceData
      ? { title: copy("Payback signal", "Geri dönüş sinyali"), copy: financialSummary.paybackMonth ? `${financialSummary.paybackMonth}. ${copy("month", "ay")}` : copy("Payback is not reached in the selected horizon.", "Seçilen ufukta geri dönüş oluşmuyor."), tone: financialSummary.paybackMonth ? "teal" : "clay" }
      : { title: copy("Financial inputs needed", "Finansal girdi gerekli"), copy: copy("Complete operations, sales, and financial assumptions for real feasibility output.", "Gerçek fizibilite çıktısı için operasyon, satış ve finans varsayımlarını tamamlayın."), tone: "clay" },
  ];
  const reportAuthor = currentProfile?.username || currentProfile?.email || copy("Current user", "Mevcut kullanıcı");
  const financialHorizonOptions = [
    ["6m", copy("Next 6 months", "Gelecek 6 ay")],
    ["1y", copy("Next 12 months", "Gelecek 12 ay")],
    ["5y", copy("Next 60 months", "Gelecek 60 ay")],
  ];
  const periodLabel = financialHorizonOptions.find(([value]) => value === financialHorizon)?.[1] || financialHorizonOptions[0][1];
  const dashboardProductSelectLabel = dashboardSelectedProduct
    ? dashboardSelectedProduct.name || dashboardSelectedProduct.product_code || copy("Unnamed product", "İsimsiz ürün")
    : copy("No products yet", "Henüz ürün yok");
  const dashboardHorizonSelectLabel = periodLabel;
  const recentReports = [
    dashboardSelectedProduct && [
      copy("Product Definition Snapshot", "Ürün Tanımı Anlık Görünümü"),
      copy("Production Reports", "Üretim Raporları"),
      new Date(dashboardSelectedProduct.updated_at || dashboardSelectedProduct.created_at).toLocaleString(locale),
      dashboardSelectedProduct.product_code || "-",
      reportAuthor,
    ],
    latestPlan && [
      latestPlan.plan_name || copy("Latest Process Plan", "Son Süreç Planı"),
      copy("Production Reports", "Üretim Raporları"),
      new Date(latestPlan.created_at).toLocaleString(locale),
      latestPlanResult?.productName || dashboardProductName,
      reportAuthor,
    ],
    hasFinancialSourceData && [
      copy("Financial Feasibility Snapshot", "Finansal Fizibilite Anlık Görünümü"),
      copy("Financial Reports", "Finansal Raporlar"),
      new Date().toLocaleString(locale),
      periodLabel,
      reportAuthor,
    ],
    hasSalesForecast && [
      copy("Sales Strategy Snapshot", "Satış Stratejisi Anlık Görünümü"),
      copy("Sales Reports", "Satış Raporları"),
      new Date().toLocaleString(locale),
      copy("12 month sales plan", "12 aylık satış planı"),
      reportAuthor,
    ],
  ].filter(Boolean);
  const reportTabs = [
    {
      detail: copy("A concise decision pack for investors, founders, and management meetings.", "Yatırımcı, kurucu ve yönetim toplantıları için kısa karar paketi."),
      includes: [copy("Executive overview", "Yönetici özeti"), copy("Cost & return", "Maliyet & getiri"), copy("Scenario signals", "Senaryo sinyalleri")],
      key: "executive",
      label: copy("Executive Decision Pack", "Yönetici Karar Paketi"),
      tone: "blue",
    },
    {
      detail: copy("Financial assumptions, income-expense projection, cash needs, ROI, and payback.", "Finansal varsayımlar, gelir-gider projeksiyonu, nakit ihtiyacı, ROI ve geri dönüş."),
      includes: [copy("Income / expense", "Gelir / gider"), copy("Cash flow", "Nakit akışı"), copy("Investment return", "Yatırım getirisi")],
      key: "financial",
      label: copy("Financial Export", "Finansal Export"),
      tone: "violet",
    },
    {
      detail: copy("Production capacity, resource plan, process outputs, cycle time, and tracked cost.", "Üretim kapasitesi, kaynak planı, süreç çıktıları, çevrim süresi ve takip edilen maliyet."),
      includes: [copy("Process plan", "Süreç planı"), copy("Capacity", "Kapasite"), copy("Tracked cost", "Takip edilen maliyet")],
      key: "operations",
      label: copy("Operations Export", "Operasyon Export"),
      tone: "teal",
    },
    {
      detail: copy("Sales channels, forecast, campaign inputs, market assumptions, and revenue quality.", "Satış kanalları, tahmin, kampanya girdileri, pazar varsayımları ve gelir kalitesi."),
      includes: [copy("Sales forecast", "Satış tahmini"), copy("Channels", "Kanallar"), copy("Revenue quality", "Gelir kalitesi")],
      key: "sales",
      label: copy("Sales Export", "Satış Export"),
      tone: "lime",
    },
    {
      detail: copy("A full model export that combines operations, sales, finance, and simulation outputs.", "Operasyon, satış, finans ve simülasyon çıktılarını birleştiren tam model exportu."),
      includes: [copy("Full model", "Tam model"), copy("All modules", "Tüm modüller"), copy("Appendix", "Ekler")],
      key: "full",
      label: copy("Full Feasibility Pack", "Tam Fizibilite Paketi"),
      tone: "pink",
    },
  ];
  const activeReportTab = reportTabs.find((tab) => tab.key === reportsTab) || reportTabs[0];
  const reportFormats = [
    { extension: "pdf", key: "pdf", label: "PDF", mime: "application/pdf", note: copy("presentation-ready document", "sunuma hazır doküman") },
    { extension: "xlsx", key: "xlsx", label: "XLSX", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", note: copy("spreadsheet model extract", "tablo model çıktısı") },
    { extension: "pptx", key: "pptx", label: "PPTX", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", note: copy("slide deck for meetings", "toplantı sunum dosyası") },
  ];
  const reportStats = [
    [copy("Selected pack", "Seçili paket"), activeReportTab.label, copy("choose one report type", "tek rapor türü seçin")],
    [copy("Output formats", "Çıktı formatları"), "PDF / XLSX / PPTX", copy("download only", "yalnızca indir")],
    [copy("Storage", "Kayıt"), copy("Local file", "Lokal dosya"), copy("not saved to database", "database'e kaydedilmez")],
    [copy("Period", "Dönem"), periodLabel, copy("uses current horizon", "mevcut ufku kullanır")],
  ];
  const financeWindowLabel =
    financeWindow === "custom"
      ? `${financeDateRange.start || copy("Start", "Başlangıç")} - ${financeDateRange.end || copy("End", "Bitiş")}`
      : {
          today: copy("Today", "Bugün"),
          tomorrow: copy("Tomorrow", "Yarın"),
          week: copy("This week", "Bu hafta"),
          month: copy("This month", "Bu ay"),
        }[financeWindow];
  const hasFinancialAssumptions = Boolean(financialModel.settingsSaved) && requiredFinancialSettingFields.every((field) => (
    financialSettingsForm[field] !== "" &&
    financialSettingsForm[field] !== null &&
    financialSettingsForm[field] !== undefined &&
    Number.isFinite(Number(financialSettingsForm[field]))
  ));
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
  const feasibilityReadyCount = feasibilityChecklist.filter((item) => item.done).length;
  const feasibilityReadinessPercent = Math.round((feasibilityReadyCount / Math.max(feasibilityChecklist.length, 1)) * 100);
  const unmetForecastUnits = hasFinancialSourceData
    ? Math.max(0, toFiniteNumber(financialSummary.forecastSalesUnits) - toFiniteNumber(financialSummary.netSoldUnits))
    : 0;
  const hasPositiveNet = hasFinancialSourceData && monthlyNet > 0;
  const hasEnoughRunway = hasFinancialSourceData && financialSummary.cashRunwayMonths >= Math.min(financialMonthCount, 6);
  const hasNoCapacityGap = hasFinancialSourceData && unmetForecastUnits <= 0;
  const feasibilityVerdict = !hasFinancialSourceData
    ? {
        action: missingFeasibilityItem?.action || copy("Complete Inputs", "Girdileri Tamamla"),
        copy: copy("Complete the basic product, process, sales, and finance inputs before using this as a decision report.", "Bunu karar raporu olarak kullanmadan önce temel ürün, süreç, satış ve finans girdilerini tamamlayın."),
        label: copy("Not decision-ready", "Karar için hazır değil"),
        path: missingFeasibilityItem?.path || "/operations/products",
        tone: "amber",
      }
    : (hasPositiveNet && hasEnoughRunway && hasNoCapacityGap)
        ? {
            action: copy("Open Simulation", "Simülasyonu Aç"),
            copy: copy("The current plan covers the sales forecast, keeps cash alive in the selected horizon, and shows positive monthly net.", "Mevcut plan satış tahminini karşılıyor, seçilen ufukta nakdi taşıyor ve pozitif aylık net gösteriyor."),
            label: copy("Looks feasible", "Fizibl görünüyor"),
            path: "/simulation/current-situation",
            tone: "teal",
          }
        : hasPositiveNet
          ? {
              action: copy("Review Risks", "Riskleri İncele"),
              copy: copy("The plan can make money, but capacity, cash runway, or inventory risk needs attention before committing.", "Plan para kazanabilir; fakat kapasite, nakit dayanma veya stok riski karar öncesi kontrol edilmeli."),
              label: copy("Feasible with watchouts", "Dikkatle fizibl"),
              path: "/financial-modelling/analiz",
              tone: "amber",
            }
          : {
              action: copy("Improve Plan", "Planı İyileştir"),
              copy: copy("The current assumptions do not yet support a healthy production decision. Start with price, cost, capacity, or cash.", "Mevcut varsayımlar sağlıklı bir üretim kararını henüz desteklemiyor. Fiyat, maliyet, kapasite veya nakitten başlayın."),
              label: copy("High risk", "Yüksek risk"),
              path: "/financial-modelling/analiz",
              tone: "clay",
            };
  const dashboardQuickActions = [
    { label: copy("Product setup", "Ürün kurulumu"), path: "/operations/products", value: operationsWorkspace.products.length ? copy("Ready", "Hazır") : copy("Needed", "Gerekli") },
    { label: copy("Process plan", "Süreç planı"), path: "/operations/data-entry", value: activePlanResults.length ? copy("Ready", "Hazır") : copy("Needed", "Gerekli") },
    { label: copy("Sales forecast", "Satış tahmini"), path: "/sales-strategy", value: hasSalesForecast ? copy("Ready", "Hazır") : copy("Needed", "Gerekli") },
    { label: copy("Finance model", "Finans modeli"), path: "/financial-modelling/girdiler", value: hasFinancialAssumptions ? copy("Ready", "Hazır") : copy("Needed", "Gerekli") },
  ];
  const improvementFocus = [
    !operationsWorkspace.products.length && copy("Add the product price and recipe so cost is based on a real item.", "Maliyet gerçek ürüne dayansın diye ürün fiyatını ve reçetesini ekleyin."),
    !activePlanResults.length && copy("Save one daily process plan to calculate capacity, labor, material, and energy.", "Kapasite, işçilik, malzeme ve enerjiyi hesaplamak için bir günlük süreç planı kaydedin."),
    !hasSalesForecast && copy("Link sales channels to products so revenue and stock risk become visible.", "Ciro ve stok riski görünsün diye satış kanallarını ürünlere bağlayın."),
    hasFinancialSourceData && unmetForecastUnits > 0 && copy("Sales demand is above available production. Increase capacity or reduce the promise.", "Satış talebi mevcut üretimin üstünde. Kapasiteyi artırın ya da satış sözünü düşürün."),
    hasFinancialSourceData && financialSummary.unsoldInventoryUnits > 0 && copy("Production is above sales. Reduce output, add demand, or plan stock financing.", "Üretim satışın üstünde. Çıktıyı düşürün, talep ekleyin veya stok finansmanı planlayın."),
    hasFinancialSourceData && monthlyNet <= 0 && copy("Net result is weak. Recheck price, material cost, labor hours, and channel commissions.", "Net sonuç zayıf. Fiyatı, malzeme maliyetini, işçilik saatini ve kanal komisyonlarını kontrol edin."),
    hasFinancialSourceData && financialSummary.cashRunwayMonths < Math.min(financialMonthCount, 3) && copy("Cash runway is short. Add starting cash, financing, or delay non-critical spend.", "Nakit dayanma kısa. Başlangıç nakdi/finansman ekleyin ya da kritik olmayan harcamayı erteleyin."),
  ].filter(Boolean).slice(0, 3);
  const dashboardWorkingDays = Math.max(1, toFiniteNumber(financialSummary.workingDaysPerMonth, toFiniteNumber(financialSettingsForm.workingDaysPerMonth, 22)));
  const monthlyProductionCapacity = totalDailyProduction * dashboardWorkingDays;
  const averageMonthlyDemand = dashboardExpectedSalesUnits / 12;
  const capacityCoveragePercent = averageMonthlyDemand && monthlyProductionCapacity ? (monthlyProductionCapacity / averageMonthlyDemand) * 100 : 0;
  const netMarginPercent = monthlyRevenue ? (monthlyNet / monthlyRevenue) * 100 : 0;
  const formatDashboardMonth = (month) => (month ? `${formatNumber(month)} ${copy("mo", "ay")}` : noDataValue);
  const dashboardExecutiveMetrics = [
    {
      category: copy("Decision", "Karar"),
      detail: copy("from readiness and finance checks", "hazırlık ve finans kontrolünden"),
      label: copy("Feasibility verdict", "Fizibilite kararı"),
      tone: feasibilityVerdict.tone,
      value: feasibilityVerdict.label,
    },
    {
      category: copy("Finance", "Finans"),
      detail: copy("monthly estimate", "aylık tahmin"),
      label: copy("Net result", "Net sonuç"),
      tone: hasFinancialSourceData && monthlyNet > 0 ? "teal" : hasFinancialSourceData ? "clay" : "amber",
      value: moneyOrMissing(monthlyNet),
    },
    {
      category: copy("Cash", "Nakit"),
      detail: copy("before cash balance goes negative", "nakit eksiye düşmeden önce"),
      label: copy("Cash runway", "Nakit dayanma"),
      tone: hasFinancialSourceData && hasEnoughRunway ? "teal" : hasFinancialSourceData ? "amber" : "amber",
      value: hasFinancialSourceData ? `${formatNumber(financialSummary.cashRunwayMonths)} ${copy("mo", "ay")}` : noDataValue,
    },
    {
      category: copy("Return", "Geri dönüş"),
      detail: copy("investment recovery month", "yatırım geri dönüş ayı"),
      label: copy("Payback", "Geri dönüş"),
      tone: hasFinancialSourceData && financialSummary.paybackMonth ? "teal" : hasFinancialSourceData ? "clay" : "amber",
      value: hasFinancialSourceData ? formatDashboardMonth(financialSummary.paybackMonth) : noDataValue,
    },
    {
      category: copy("Capacity", "Kapasite"),
      detail: copy("available monthly production", "mevcut aylık üretim"),
      label: copy("Capacity vs demand", "Kapasite / talep"),
      tone: hasSalesForecast && activePlanResults.length && capacityCoveragePercent >= 100 ? "teal" : hasSalesForecast && activePlanResults.length ? "amber" : "amber",
      value: hasSalesForecast && activePlanResults.length ? `${formatNumber(capacityCoveragePercent)}%` : noDataValue,
    },
    {
      category: copy("Funding", "Finansman"),
      detail: copy("own cash after loan and grant", "kredi ve hibe sonrası öz nakit"),
      label: copy("Initial cash needed", "Gerekli başlangıç nakdi"),
      tone: hasFinancialSourceData && financialSummary.initialCashRequired <= 0 ? "teal" : hasFinancialSourceData ? "amber" : "amber",
      value: hasFinancialSourceData ? formatLira(financialSummary.initialCashRequired) : noDataValue,
    },
  ];
  const dashboardModuleRollup = [
    {
      action: operationsWorkspace.products.length ? copy("Review product", "Ürünü incele") : copy("Add product", "Ürün ekle"),
      detail: operationsWorkspace.products.length
        ? `${formatNumber(operationsWorkspace.products.length)} ${copy("product records", "ürün kaydı")}`
        : copy("Product, price, and recipe are needed.", "Ürün, fiyat ve reçete gerekli."),
      done: operationsWorkspace.products.length > 0,
      label: copy("Product definition", "Ürün tanımı"),
      path: "/operations/products",
      tone: "operations",
    },
    {
      action: activePlanResults.length ? copy("Review process", "Süreci incele") : copy("Save process", "Süreç kaydet"),
      detail: activePlanResults.length
        ? `${formatNumber(totalDailyProduction, 2)} ${latestPlanResult?.productUnit || copy("units", "adet")} ${copy("per day", "günlük")}`
        : copy("A saved process plan unlocks capacity and cost.", "Kayıtlı süreç planı kapasite ve maliyeti açar."),
      done: activePlanResults.length > 0,
      label: copy("Production capacity", "Üretim kapasitesi"),
      path: "/operations/data-entry",
      tone: "operations",
    },
    {
      action: hasSalesForecast ? copy("Review sales", "Satışı incele") : copy("Add forecast", "Tahmin ekle"),
      detail: hasSalesForecast
        ? `${formatNumber(averageMonthlyDemand)} ${copy("avg monthly units", "ortalama aylık adet")}`
        : copy("Sales channels are required for revenue and stock risk.", "Ciro ve stok riski için satış kanalları gerekli."),
      done: hasSalesForecast,
      label: copy("Market demand", "Pazar talebi"),
      path: "/sales-strategy",
      tone: "sales",
    },
    {
      action: hasFinancialAssumptions ? copy("Review finance", "Finansı incele") : copy("Add assumptions", "Varsayım ekle"),
      detail: hasFinancialSourceData
        ? `${copy("Margin", "Marj")} ${formatNumber(netMarginPercent, 1)}% / ${copy("Runway", "Dayanma")} ${formatNumber(financialSummary.cashRunwayMonths)} ${copy("mo", "ay")}`
        : copy("Cash, tax, stock, and payment assumptions are needed.", "Nakit, vergi, stok ve ödeme varsayımları gerekli."),
      done: hasFinancialAssumptions,
      label: copy("Financial model", "Finansal model"),
      path: "/financial-modelling/girdiler",
      tone: "finance",
    },
    {
      action: hasFinancialSourceData ? copy("Run scenario", "Senaryo çalıştır") : copy("Complete inputs", "Girdileri tamamla"),
      detail: hasFinancialSourceData
        ? copy("Use simulation to test downside and upside cases.", "Simülasyonda kötü ve iyi senaryoları test edin.")
        : copy("Simulation is useful after core feasibility data exists.", "Simülasyon temel fizibilite verisi oluşunca anlamlıdır."),
      done: hasFinancialSourceData,
      label: copy("Scenario test", "Senaryo testi"),
      path: "/simulation/current-situation",
      tone: "decision",
    },
    {
      action: recentReports.length ? copy("Open reports", "Raporları aç") : copy("Create source data", "Kaynak veri oluştur"),
      detail: recentReports.length
        ? `${formatNumber(recentReports.length)} ${copy("available snapshots", "mevcut anlık rapor")}`
        : copy("Reports become useful after product, process, sales, or finance data exists.", "Raporlar ürün, süreç, satış veya finans verisi oluşunca anlamlı hale gelir."),
      done: recentReports.length > 0,
      label: copy("Report pack", "Rapor paketi"),
      path: "/reports",
      tone: "reports",
    },
  ];
  const dashboardRiskRows = [
    !operationsWorkspace.products.length && {
      action: copy("Add product", "Ürün ekle"),
      detail: copy("Without product price and recipe, cost and revenue are not decision-grade.", "Ürün fiyatı ve reçete olmadan maliyet ve ciro karar seviyesinde değildir."),
      path: "/operations/products",
      severity: copy("Blocker", "Engel"),
      tone: "clay",
      title: copy("Product definition missing", "Ürün tanımı eksik"),
    },
    !activePlanResults.length && {
      action: copy("Save process", "Süreç kaydet"),
      detail: copy("Capacity, labor, material, and energy must come from a saved daily process plan.", "Kapasite, işçilik, malzeme ve enerji kayıtlı günlük süreç planından gelmeli."),
      path: "/operations/data-entry",
      severity: copy("Blocker", "Engel"),
      tone: "clay",
      title: copy("Production plan missing", "Üretim planı eksik"),
    },
    !hasSalesForecast && {
      action: copy("Add sales forecast", "Satış tahmini ekle"),
      detail: copy("Demand, revenue, unmet sales, and inventory risk require product-linked sales channels.", "Talep, ciro, karşılanmayan satış ve stok riski ürüne bağlı satış kanalları ister."),
      path: "/sales-strategy",
      severity: copy("Blocker", "Engel"),
      tone: "clay",
      title: copy("Sales forecast missing", "Satış tahmini eksik"),
    },
    !hasFinancialAssumptions && {
      action: copy("Complete finance", "Finansı tamamla"),
      detail: copy("Cash runway, payback, taxes, and working capital need saved financial assumptions.", "Nakit dayanma, geri dönüş, vergiler ve işletme sermayesi kayıtlı finans varsayımları ister."),
      path: "/financial-modelling/girdiler",
      severity: copy("High", "Yüksek"),
      tone: "amber",
      title: copy("Financial assumptions incomplete", "Finans varsayımları eksik"),
    },
    hasFinancialSourceData && unmetForecastUnits > 0 && {
      action: copy("Fix capacity", "Kapasiteyi düzelt"),
      detail: `${formatNumber(unmetForecastUnits)} ${copy("units of forecast demand cannot be produced.", "adet tahmini talep üretilemiyor.")}`,
      path: "/operations/data-entry",
      severity: copy("High", "Yüksek"),
      tone: "clay",
      title: copy("Capacity gap", "Kapasite açığı"),
    },
    hasFinancialSourceData && financialSummary.unsoldInventoryUnits > 0 && {
      action: copy("Balance output", "Çıktıyı dengele"),
      detail: `${formatNumber(financialSummary.unsoldInventoryUnits)} ${copy("units remain unsold in the selected horizon.", "adet seçilen ufukta satılmadan kalıyor.")}`,
      path: "/sales-strategy",
      severity: copy("Medium", "Orta"),
      tone: "amber",
      title: copy("Inventory risk", "Stok riski"),
    },
    hasFinancialSourceData && monthlyNet <= 0 && {
      action: copy("Repair margin", "Marjı düzelt"),
      detail: copy("Current pricing, cost, or channel assumptions do not produce positive monthly net.", "Mevcut fiyat, maliyet veya kanal varsayımları pozitif aylık net üretmiyor."),
      path: "/financial-modelling/analiz",
      severity: copy("High", "Yüksek"),
      tone: "clay",
      title: copy("Weak profitability", "Zayıf karlılık"),
    },
    hasFinancialSourceData && financialSummary.cashRunwayMonths < Math.min(financialMonthCount, 3) && {
      action: copy("Improve cash", "Nakti iyileştir"),
      detail: copy("Starting cash, financing timing, or non-critical spend should be reviewed.", "Başlangıç nakdi, finansman zamanı veya kritik olmayan harcamalar gözden geçirilmeli."),
      path: "/financial-modelling/girdiler",
      severity: copy("High", "Yüksek"),
      tone: "amber",
      title: copy("Short cash runway", "Kısa nakit dayanma"),
    },
  ].filter(Boolean).slice(0, 5);
  const dashboardAssumptionRows = [
    [copy("Monthly capacity", "Aylık kapasite"), activePlanResults.length ? `${formatNumber(monthlyProductionCapacity, 2)} ${latestPlanResult?.productUnit || copy("units", "adet")}` : noDataValue],
    [copy("Average monthly demand", "Ortalama aylık talep"), hasSalesForecast ? `${formatNumber(averageMonthlyDemand)} ${copy("units", "adet")}` : noDataValue],
    [copy("Unit margin", "Birim marj"), operationUnitSalePrice ? `${formatNumber(operationProfitMargin, 1)}%` : noDataValue],
  ];

  function renderDashboardLayout(activePage, children) {
    return (
      <main className={`dashboard-shell ${dashboardSidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}>
        <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
          <div className="dashboard-brand-block">
            <div className="dashboard-sidebar-top">
              <button type="button" className="landing-brand dashboard-brand" onClick={() => goTo("/dashboard", "login")}>
                <img src={logoUrl} alt="Atera logo" />
                <strong>Atera</strong>
              </button>
              <button
                type="button"
                className="dashboard-sidebar-toggle"
                aria-label={dashboardSidebarOpen ? copy("Close menu", "Menüyü kapat") : copy("Open menu", "Menüyü aç")}
                aria-expanded={dashboardSidebarOpen}
                onClick={() => setDashboardSidebarOpen((isOpen) => !isOpen)}
              >
                <span aria-hidden="true">{dashboardSidebarOpen ? "<" : ">"}</span>
              </button>
            </div>

            <div className="dashboard-controls">
              <label className="language-picker">
                <span>{labels.language}</span>
                <select value={form.language} onChange={(event) => updateField("language", event.target.value)}>
                  <option value="en">EN</option>
                  <option value="tr">TR</option>
                </select>
              </label>
              <ThemeToggle />
            </div>
          </div>

          <nav className="dashboard-nav">
            <button
              type="button"
              className={activePage.startsWith("dashboard") ? "active" : ""}
              onClick={() => goTo("/dashboard", "login")}
            >
              {labels.dashboard}
            </button>
            {dashboardModules.map((module) => (
              <React.Fragment key={module.key}>
                <button
                  type="button"
                  className={`dashboard-nav-item ${module.tone} ${activePage === module.key || (module.key === "operations" && activePage.startsWith("operations/")) || (module.key === "product-plus" && activePage.startsWith("product-plus/")) || (module.key === "financial-modelling" && activePage.startsWith("financial-modelling/")) || (module.key === "simulation" && activePage.startsWith("simulation/")) ? "active" : ""}`}
                  onClick={() => goTo(module.key === "product-plus" ? "/product-plus/product-tree" : module.key === "financial-modelling" ? "/financial-modelling/girdiler" : module.key === "simulation" ? "/simulation/current-situation" : module.path, "login")}
                >
                  <span className="dashboard-nav-category">{module.category}</span>
                  <strong>{module.label}</strong>
                </button>
                {module.key === "operations" && (activePage === "operations" || activePage.startsWith("operations/")) && (
                  <div className="dashboard-subnav" aria-label="Operations submodules">
                    {operationsSubmodules.map((submodule) => (
                      <button
                        type="button"
                        className={activePage === `operations/${submodule.key}` ? "active" : ""}
                        onClick={() => goTo(submodule.path, "login")}
                        key={submodule.key}
                      >
                        {submodule.label}
                      </button>
                    ))}
                  </div>
                )}
                {module.key === "product-plus" && (activePage === "product-plus" || activePage.startsWith("product-plus/")) && (
                  <div className="dashboard-subnav" aria-label="Ürün + submodules">
                    {productPlusSubmodules.map((submodule) => (
                      <button
                        type="button"
                        className={activePage === `product-plus/${submodule.key}` ? "active" : ""}
                        onClick={() => goTo(submodule.path, "login")}
                        key={submodule.key}
                      >
                        {submodule.label}
                      </button>
                    ))}
                  </div>
                )}
                {module.key === "financial-modelling" && (activePage === "financial-modelling" || activePage.startsWith("financial-modelling/")) && (
                  <div className="dashboard-subnav" aria-label="Finansal Modelleme submodules">
                    {[...new Set(financialSubmodules.map((submodule) => submodule.group))].map((group) => (
                      <React.Fragment key={group}>
                        <span className="dashboard-subnav-label">{group}</span>
                        {financialSubmodules.filter((submodule) => submodule.group === group).map((submodule) => (
                          <button
                            type="button"
                            className={activePage === `financial-modelling/${submodule.key}` ? "active" : ""}
                            onClick={() => goTo(submodule.path, "login")}
                            key={submodule.key}
                          >
                            {submodule.label}
                          </button>
                        ))}
                      </React.Fragment>
                    ))}
                  </div>
                )}
                {module.key === "simulation" && (activePage === "simulation" || activePage.startsWith("simulation/")) && (
                  <div className="dashboard-subnav" aria-label={copy("Simulation variants", "Simülasyon varyantları")}>
                    {simulationVariants.map((variant) => (
                      <div className="simulation-subnav-item" key={variant.id}>
                        <button
                          type="button"
                          className={activePage === `simulation/${variant.id}` ? "active" : ""}
                          onClick={() => goTo(variant.path, "login")}
                        >
                          {variant.id === "current-situation" ? copy("Current Situation", "Mevcut Durum") : variant.name || variant.label}
                        </button>
                        {variant.id !== "current-situation" && (
                          <button
                            type="button"
                            className="variant-delete-button"
                            aria-label={copy("Delete variant", "Varyantı sil")}
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteSimulationVariant(variant.id);
                            }}
                          >
                            x
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={addSimulationVariant}>
                      + {copy("Add Variant", "Varyant Ekle")}
                    </button>
                  </div>
                )}
              </React.Fragment>
            ))}
            {authorizationAccess.read && (
              <button
                type="button"
                className={activePage === "authorization" ? "active" : ""}
                onClick={() => goTo("/authorization", "login")}
              >
                {labels.authorizationPage}
              </button>
            )}
          </nav>

          <div className="sidebar-footer">
            <div className="sync-status-card" role="status" aria-label="Data synchronization status">
              <span className="live-dot" />
              <div>
                <strong>{labels.dataSync}</strong>
                <small>{labels.live}</small>
              </div>
            </div>
            <button type="button" className="link-button dashboard-logout" onClick={handleLogout}>
              {labels.logout}
            </button>
          </div>
        </aside>

        <section className="dashboard-content">{children}</section>
      </main>
    );
  }

  if (path === "/") {
    return (
      <main className="landing-page">
        <header className="landing-header">
          <button type="button" className="landing-brand" onClick={() => goTo("/", "login")}>
            <img src={logoUrl} alt="Atera logo" />
            <strong>Atera</strong>
          </button>

          <nav className="landing-nav" aria-label="Landing page sections">
            <a href="#who">{labels.who}</a>
            <a href="#solutions">{labels.solutions}</a>
            <a href="#references">{labels.references}</a>
            <a href="#contact">{labels.contact}</a>
          </nav>

          <div className="landing-controls">
            <label className="language-picker">
              <span>{labels.language}</span>
              <select value={form.language} onChange={(event) => updateField("language", event.target.value)}>
                <option value="en">EN</option>
                <option value="tr">TR</option>
              </select>
            </label>
            <ThemeToggle />
          </div>
        </header>

        <section className="landing-hero">
          <div className="landing-hero-content">
            <span className="hero-eyebrow">{copy("The operating layer behind feasible factories", "Fizibl fabrikaların arkasındaki operasyon katmanı")}</span>
            <h1>{labels.heroTitle}</h1>
            <p>{labels.heroCopy}</p>
            <div className="hero-actions">
              <button type="button" className="submit-button landing-login" onClick={handleUseAtera}>
                {labels.goToLogin}
              </button>
              <a className="hero-secondary-link" href="#solutions">
                {copy("Discover the model", "Modeli keşfet")}
              </a>
            </div>
            <div className="hero-proof-strip" aria-label={copy("Atera model signals", "Atera model sinyalleri")}>
              <span>{copy("Capacity", "Kapasite")}</span>
              <span>{copy("Cash", "Nakit")}</span>
              <span>{copy("Margin", "Marj")}</span>
              <span>{copy("Delivery", "Termin")}</span>
            </div>
          </div>
          <div className="landing-hero-stage" aria-hidden="true">
            {renderAteraOrbit("hero-orbit")}
            <div className="hero-product-card hero-product-card-main">
              <span>{copy("Decision engine", "Karar motoru")}</span>
              <strong>{copy("Feasibility live", "Fizibilite canlı")}</strong>
              <div className="hero-card-bars">
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="hero-product-card hero-product-card-side">
              <span>{copy("Scenario delta", "Senaryo farkı")}</span>
              <strong>+18%</strong>
            </div>
            <div className="hero-app-chip chip-finance">FM</div>
            <div className="hero-app-chip chip-ops">OP</div>
          </div>
        </section>

        <section className="landing-sections" aria-label="Atera information">
          <article id="who" className="landing-section">
            <div className="section-kicker">
              <span>{labels.who}</span>
              <h2>{labels.who}</h2>
            </div>
            <div className="who-content">
              <div className="who-copy-block">
                <p>{labels.whoCopy}</p>
                <div className="who-signal-grid" aria-label={copy("Atera decision signals", "Atera karar sinyalleri")}>
                  <span>{copy("Capacity pressure", "Kapasite baskısı")}</span>
                  <span>{copy("Cash exposure", "Nakit riski")}</span>
                  <span>{copy("Margin impact", "Marj etkisi")}</span>
                  <span>{copy("Delivery confidence", "Termin güveni")}</span>
                </div>
              </div>
              <div className="who-visual-panel">
                {renderAteraOrbit("who-section-orbit")}
                <div className="who-panel-caption">
                  <strong>{copy("Scenario command layer", "Senaryo komuta katmanı")}</strong>
                  <span>{copy("From assumption to decision without spreadsheet fog.", "Varsayımdan karara Excel sisine girmeden.")}</span>
                </div>
              </div>
            </div>
          </article>

          <article id="solutions" className="landing-section solutions-section">
            <div className="section-kicker">
              <h2>{labels.solutions}</h2>
              <p>{copy("Plan. Model. Decide. Scale.", "Planla. Modelle. Karar ver. Büyüt.")}</p>
            </div>
            <div className="solutions-content">
              <p>{labels.solutionsCopy}</p>
              <div className="solution-signal-row" aria-label={copy("Atera solution modules", "Atera çözüm modülleri")}>
                <span>{copy("Operational planning", "Operasyon planlama")}</span>
                <span>{copy("Financial feasibility", "Finansal fizibilite")}</span>
                <span>{copy("Sales simulation", "Satış simülasyonu")}</span>
              </div>
              <div className="persona-carousel" aria-label="Solution personas">
                <div className="persona-track">
                  {[...personas, ...personas].map((persona, index) => (
                    <article className="persona-card" key={`${persona.title}-${index}`}>
                      <PersonaAvatar type={persona.avatarType} title={persona.title} />
                      <div>
                        <h3>{persona.title}</h3>
                        <p>{persona.need}</p>
                        <p>{persona.benefit}</p>
                        <p>{persona.difference}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article id="references" className="landing-section references-section">
            <div className="section-kicker">
              <h2>{labels.references}</h2>
              <p>{copy("One loop for the decisions that usually live apart.", "Genelde ayrı yaşayan kararlar için tek döngü.")}</p>
            </div>
            <div className="references-content">
              <div className="reference-carousel" aria-label="Reference company logos">
                <div className="reference-track">
                  {references.length ? (
                    [...references, ...references].map((reference, index) => (
                      <article className={`reference-logo-card ${reference.tone}`} key={`${reference.name}-${index}`}>
                        <div className="reference-mark">{reference.mark}</div>
                        <strong>{reference.name}</strong>
                      </article>
                    ))
                  ) : (
                    <article className="reference-logo-card teal">
                      <div className="reference-mark">DB</div>
                      <strong>{copy("No reference records yet", "Henüz referans kaydı yok")}</strong>
                    </article>
                  )}
                </div>
              </div>
            </div>
          </article>

          <article id="contact" className="landing-section contact-section">
            <div>
              <span>{labels.contact}</span>
              <h2>{labels.contact}</h2>
            </div>
            <div className="contact-content">
              <div className="contact-card">
                <div className="contact-card-mark" aria-hidden="true">A</div>
                <address className="contact-details">
                  {labels.contactPhone && <a href={`tel:${labels.contactPhone.replaceAll(" ", "")}`}>{labels.contactPhone}</a>}
                  <a href={`mailto:${labels.contactEmail}`}>{labels.contactEmail}</a>
                  <span>{labels.contactLocation}</span>
                </address>
                <div className="contact-status" aria-hidden="true">
                  <span />
                  {copy("Open for onboarding conversations", "Onboarding görüşmeleri için açık")}
                </div>
              </div>
            </div>
          </article>
        </section>
      </main>
    );
  }

  if (session && routePath === "/dashboard") {
    return renderDashboardLayout(
      "dashboard/overview",
        <section className="command-dashboard feasibility-dashboard" aria-label="Atera feasibility dashboard">
          <div className="command-topbar executive-topbar">
            <div className="command-context">
              <strong>{dashboardCompanyName}</strong>
              <span>{dashboardProductContext}</span>
            </div>
            <div className="command-live">
              <span className="live-dot" />
              <strong>{hasOperationData || hasSalesForecast ? copy("Workspace data loaded", "Çalışma alanı verisi yüklendi") : copy("Input needed", "Girdi gerekli")}</strong>
            </div>
            <div className="command-user">
              <span>{currentProfile?.username || form.username || "Atera"}</span>
              <small>{currentProfile?.access_level || "-"}</small>
            </div>
            <button type="button" className="command-run-button" onClick={() => goTo(feasibilityVerdict.path, "login")}>{feasibilityVerdict.action}</button>
          </div>

          <section className={`dashboard-assumption-strip ${feasibilityVerdict.tone}`} aria-label={copy("Assumption snapshot", "Varsayım özeti")}>
            <div className="dashboard-assumption-strip-heading">
              <span>{copy("Assumption snapshot", "Varsayım özeti")}</span>
              <h2>{copy("What this dashboard is based on", "Bu dashboard neye dayanıyor")}</h2>
            </div>
            <div
              className="dashboard-assumption-strip-controls"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setDashboardAssumptionMenu(null);
                }
              }}
            >
              <div className={`assumption-control product-control ${dashboardAssumptionMenu === "product" ? "open" : ""}`}>
                <span>{copy("Product", "Ürün")}</span>
                <button
                  type="button"
                  className="assumption-select-trigger"
                  onClick={() => setDashboardAssumptionMenu((current) => (current === "product" ? null : "product"))}
                  disabled={!operationsWorkspace.products.length}
                  aria-expanded={dashboardAssumptionMenu === "product"}
                >
                  <strong>{dashboardProductSelectLabel}</strong>
                  <i aria-hidden="true">⌄</i>
                </button>
                {dashboardAssumptionMenu === "product" && Boolean(operationsWorkspace.products.length) && (
                  <div className="assumption-select-menu" role="listbox">
                    {operationsWorkspace.products.map((product) => {
                      const label = product.name || product.product_code || copy("Unnamed product", "İsimsiz ürün");
                      const isSelected = product.id === dashboardSelectedProductId;
                      return (
                        <button
                          type="button"
                          className={isSelected ? "selected" : ""}
                          onClick={() => {
                            handleDashboardProductChange(product.id);
                            setDashboardAssumptionMenu(null);
                          }}
                          role="option"
                          aria-selected={isSelected}
                          key={product.id}
                        >
                          <span>{label}</span>
                          <small>{product.product_code || product.product_group || copy("Product", "Ürün")}</small>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className={`assumption-control horizon-control ${dashboardAssumptionMenu === "horizon" ? "open" : ""}`}>
                <span>{copy("Projection horizon", "Projeksiyon ufku")}</span>
                <button
                  type="button"
                  className="assumption-select-trigger"
                  onClick={() => setDashboardAssumptionMenu((current) => (current === "horizon" ? null : "horizon"))}
                  aria-expanded={dashboardAssumptionMenu === "horizon"}
                >
                  <strong>{dashboardHorizonSelectLabel}</strong>
                  <i aria-hidden="true">⌄</i>
                </button>
                {dashboardAssumptionMenu === "horizon" && (
                  <div className="assumption-select-menu" role="listbox">
                    {financialHorizonOptions.map(([value, label]) => {
                      const isSelected = value === financialHorizon;
                      return (
                        <button
                          type="button"
                          className={isSelected ? "selected" : ""}
                          onClick={() => {
                            loadFinancialData(value);
                            setDashboardAssumptionMenu(null);
                          }}
                          role="option"
                          aria-selected={isSelected}
                          key={value}
                        >
                          <span>{label}</span>
                          <small>{value === "6m" ? copy("Short range", "Kısa ufuk") : value === "1y" ? copy("Annual range", "Yıllık ufuk") : copy("Long range", "Uzun ufuk")}</small>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="assumption-strip-list">
              {dashboardAssumptionRows.map(([label, value]) => (
                <span key={label}>{label}<strong>{value}</strong></span>
              ))}
            </div>
          </section>

          <section className={`executive-brief ${feasibilityVerdict.tone}`} aria-label={copy("Feasibility executive brief", "Fizibilite yönetici özeti")}>
            <div className="executive-brief-copy">
              <span>{copy("Feasibility executive brief", "Fizibilite yönetici özeti")}</span>
              <h1>{feasibilityVerdict.label}</h1>
              <p>{feasibilityVerdict.copy}</p>
              <div className="executive-brief-actions">
                <button type="button" onClick={() => goTo(feasibilityVerdict.path, "login")}>{feasibilityVerdict.action}</button>
                <button type="button" className="secondary" onClick={() => goTo("/simulation/current-situation", "login")}>{copy("Test scenario", "Senaryo test et")}</button>
                <button type="button" className="secondary" onClick={() => goTo("/reports", "login")}>{copy("Open report pack", "Rapor paketini aç")}</button>
              </div>
            </div>
            <aside className="executive-readiness-card">
              <span>{copy("Decision readiness", "Karar hazırlığı")}</span>
              <strong>{feasibilityReadinessPercent}%</strong>
              <p>{copy("Core modules ready", "Hazır ana modül")}: {feasibilityReadyCount}/{feasibilityChecklist.length}</p>
              <div className="readiness-progress" aria-hidden="true">
                <span style={{ width: `${feasibilityReadinessPercent}%` }} />
              </div>
              <div className="readiness-step-list">
                {feasibilityChecklist.map((item) => (
                  <button type="button" className={item.done ? "done" : ""} onClick={() => goTo(item.path, "login")} key={item.label}>
                    <i>{item.done ? "OK" : "!"}</i>
                    <span>{item.label}</span>
                    <strong>{item.done ? copy("Ready", "Hazır") : item.action}</strong>
                  </button>
                ))}
              </div>
            </aside>
          </section>

          <section className="dashboard-section-group" aria-label={copy("Business case metrics", "İş modeli metrikleri")}>
            <div className="dashboard-section-heading">
              <div>
                <span>{copy("Business case", "İş modeli")}</span>
                <h2>{copy("The numbers a business owner should see first", "İş sahibinin önce görmesi gereken sayılar")}</h2>
              </div>
              <strong>{periodLabel}</strong>
            </div>
            <div className="executive-metric-grid">
              {dashboardExecutiveMetrics.map((metric) => (
                <article className={`command-card executive-metric-card ${metric.tone}`} key={metric.label}>
                  <span>{metric.category}</span>
                  <h3>{metric.label}</h3>
                  <strong>{metric.value}</strong>
                  <small>{metric.detail}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-two-column" aria-label={copy("Risks and next actions", "Riskler ve sonraki aksiyonlar")}>
            <article className="command-card dashboard-risk-board">
              <div className="card-heading">
                <div>
                  <span>{copy("Risk board", "Risk panosu")}</span>
                  <h2>{copy("What can stop this project", "Bu projeyi ne durdurabilir")}</h2>
                </div>
              </div>
              <div className="dashboard-risk-list">
                {(dashboardRiskRows.length ? dashboardRiskRows : [{
                  action: copy("Run simulation", "Simülasyon çalıştır"),
                  detail: copy("Core feasibility data is in place. Test conservative and optimistic scenarios before committing.", "Ana fizibilite verisi hazır. Karar vermeden önce temkinli ve iyimser senaryoları test edin."),
                  path: "/simulation/current-situation",
                  severity: copy("Controlled", "Kontrollü"),
                  tone: "teal",
                  title: copy("No blocking risk detected", "Engelleyici risk görünmüyor"),
                }]).map((risk) => (
                  <button type="button" className={`dashboard-risk-row ${risk.tone}`} onClick={() => goTo(risk.path, "login")} key={risk.title}>
                    <span>{risk.severity}</span>
                    <strong>{risk.title}</strong>
                    <p>{risk.detail}</p>
                    <b>{risk.action}</b>
                  </button>
                ))}
              </div>
            </article>

            <article className="command-card dashboard-action-board">
              <div className="card-heading">
                <div>
                  <span>{copy("Recommended sequence", "Önerilen sıra")}</span>
                  <h2>{copy("What to do before committing capital", "Sermaye bağlamadan önce ne yapılmalı")}</h2>
                </div>
              </div>
              <div className="action-sequence">
                {(improvementFocus.length ? improvementFocus : [
                  copy("Run at least one conservative scenario and confirm payback, cash runway, and capacity coverage.", "En az bir temkinli senaryo çalıştırın; geri dönüş, nakit dayanma ve kapasite kapsamını doğrulayın."),
                  copy("Export or review the report pack before discussing investment or financing.", "Yatırım veya finansman konuşmadan önce rapor paketini inceleyin."),
                ]).map((item, index) => (
                  <article key={item}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{item}</p>
                  </article>
                ))}
              </div>
            </article>
          </section>

          <section className="dashboard-section-group" aria-label={copy("Module summary", "Modül özeti")}>
            <div className="dashboard-section-heading">
              <div>
                <span>{copy("Across the project", "Proje genelinde")}</span>
                <h2>{copy("Where each source module stands", "Her kaynak modülün durumu")}</h2>
              </div>
            </div>
            <div className="module-rollup-grid">
              {dashboardModuleRollup.map((module) => (
                <button type="button" className={`module-rollup-card ${module.tone} ${module.done ? "done" : ""}`} onClick={() => goTo(module.path, "login")} key={module.label}>
                  <span>{module.done ? copy("Ready", "Hazır") : copy("Needs input", "Girdi gerekli")}</span>
                  <strong>{module.label}</strong>
                  <p>{module.detail}</p>
                  <b>{module.action}</b>
                </button>
              ))}
            </div>
          </section>

          <section className="dashboard-financial-detail" aria-label={copy("Financial detail", "Finans detayı")}>
            <article className="command-card dashboard-business-case">
              <div className="card-heading">
                <div>
                  <span>{copy("Financial and operating detail", "Finansal ve operasyonel detay")}</span>
                  <h2>{copy("Signals behind the verdict", "Kararın arkasındaki sinyaller")}</h2>
                </div>
                <button type="button" onClick={() => goTo("/financial-modelling/analiz", "login")}>{copy("Open analysis", "Analizi aç")}</button>
              </div>
              <div className="business-case-list">
                {[
                  [copy("Monthly revenue", "Aylık ciro"), moneyOrMissing(monthlyRevenue)],
                  [copy("Monthly cost", "Aylık maliyet"), moneyOrMissing(monthlyCost)],
                  [copy("Net margin", "Net marj"), hasFinancialSourceData ? `${formatNumber(netMarginPercent, 1)}%` : noDataValue],
                  [copy("Break-even", "Başa baş"), hasFinancialSourceData ? formatDashboardMonth(financialSummary.breakEvenMonth) : noDataValue],
                  [copy("Working capital", "İşletme sermayesi"), hasFinancialSourceData ? formatLira(financialSummary.workingCapitalRequirement) : noDataValue],
                  [copy("Unsold inventory", "Satılmayan stok"), hasFinancialSourceData ? `${formatNumber(financialSummary.unsoldInventoryUnits)} ${copy("units", "adet")}` : noDataValue],
                  [copy("Unmet sales", "Karşılanmayan satış"), hasFinancialSourceData ? `${formatNumber(unmetForecastUnits)} ${copy("units", "adet")}` : noDataValue],
                  [copy("Unit production cost", "Birim üretim maliyeti"), hasFinancialSourceData ? formatLira(financialSummary.unitProductionCost, 2) : noDataValue],
                ].map(([label, value]) => (
                  <span key={label}>{label}<strong>{value}</strong></span>
                ))}
              </div>
            </article>
          </section>

          <div className="dashboard-logo-row" aria-label={copy("Company and Atera logos", "Şirket ve Atera logoları")}>
            <div className="customer-logo-mark" aria-label={copy("Company logo", "Şirket logosu")}>
              <strong>{dashboardCompanyName.slice(0, 2).toUpperCase()}</strong>
              <span>{dashboardCompanyName}</span>
            </div>
            <div className="atera-logo-mark" aria-label="Atera logo">
              <img src={logoUrl} alt="" />
              <span>Atera</span>
            </div>
          </div>
        </section>,
    );
  }

  if (session && routePath === "/dashboard/riskler-karlilik-mevcut-durum") {
    goTo("/dashboard", "login");
    return null;
  }

  if (session && routePath === "/dashboard/kisa-ozet") {
    goTo("/dashboard", "login");
    return null;
  }

  if (session && (activeModule || isOperationsRoute || isProductPlusRoute || isFinancialRoute || isSimulationRoute)) {
    if (routePath === "/operations") {
      return renderDashboardLayout(
        "operations",
          <section className="module-placeholder operations-overview">
            <div>
              <span>Operations</span>
              <h1>{copy("Operations", "Operations")}</h1>
              <p>{copy("Choose the operational workspace you want to work on: resources, products, machines, process definition, or active processes.", "Çalışmak istediğiniz operasyon alanını seçin: kaynaklar, ürünler, makineler, süreç tanımı veya mevcut süreçler.")}</p>
            </div>
            <div className="placeholder-grid">
              {operationsSubmodules.map((submodule) => (
                <article key={submodule.key}>
                  <strong>{submodule.label}</strong>
                  <p>
                    {submodule.key === "resources" && copy("Define materials and workforce resources used in production plans.", "Üretim planlarında kullanılan malzeme ve iş gücü kaynaklarını tanımlayın.")}
                    {submodule.key === "products" && copy("Create products and connect their material recipes.", "Ürünleri oluşturun ve malzeme reçetelerini bağlayın.")}
                    {submodule.key === "machines-equipment" && copy("Manage machines and equipment before planning capacity.", "Kapasite planlamadan önce makine ve ekipmanları yönetin.")}
                    {submodule.key === "data-entry" && copy("Build and save daily process plans for feasibility analysis.", "Fizibilite analizi için günlük süreç planları oluşturup kaydedin.")}
                    {submodule.key === "active-processes" && copy("Review saved process plans and their latest feasibility output.", "Kayıtlı süreç planlarını ve son fizibilite çıktılarını inceleyin.")}
                  </p>
                  <button type="button" onClick={() => goTo(submodule.path, "login")}>
                    {copy("Open", "Aç")}
                  </button>
                </article>
              ))}
            </div>
          </section>,
      );
    }

    if (isOperationsRoute && !activeOperationsSubmodule) {
      goTo(["/operations/material-definitions", "/operations/human-resources"].includes(routePath) ? "/operations/resources" : "/operations", "login");
      return null;
    }

    if (routePath === "/product-plus") {
      goTo("/product-plus/product-tree", "login");
      return null;
    }

    if (isProductPlusRoute && !activeProductPlusSubmodule) {
      goTo("/product-plus/product-tree", "login");
      return null;
    }

    if (activeOperationsSubmodule?.key === "data-entry") {
      const processSetupItems = [
        {
          isReady: operationsWorkspace.products.length > 0,
          label: copy("Product", "Ürün"),
          path: "/operations/products",
          readyCopy: copy("At least one product is defined.", "En az bir ürün tanımlı."),
          todoCopy: copy("Create a product before defining a process.", "Süreç tanımlamadan önce ürün oluşturun."),
        },
        {
          isReady: operationsWorkspace.machines.length > 0,
          label: copy("Machine", "Makine"),
          path: "/operations/machines-equipment",
          readyCopy: copy("At least one machine is defined.", "En az bir makine tanımlı."),
          todoCopy: copy("Add a machine with daily capacity inputs.", "Günlük kapasite girdileriyle bir makine ekleyin."),
        },
        {
          isReady: operationsWorkspace.workforce.length > 0,
          label: copy("Workforce", "İşgücü"),
          path: "/operations/resources",
          readyCopy: copy("At least one workforce role is defined.", "En az bir işgücü rolü tanımlı."),
          todoCopy: copy("Add a workforce role and hourly cost.", "İşgücü rolü ve saatlik maliyet ekleyin."),
        },
      ];
      const isProcessSetupReady = processSetupItems.every((item) => item.isReady);

      return renderDashboardLayout(
        `operations/${activeOperationsSubmodule.key}`,
          <section className="operations-workspace operations-modern operations-process-page">
            <div className="operations-header">
              <div>
                <span>Operations / {copy("Process Definition", "Süreç Tanımlama")}</span>
                <h1>{copy("Process Definition", "Süreç Tanımlama")}</h1>
                <p>{copy("Build a daily process plan only after the required product, machine, and workforce records exist.", "Gerekli ürün, makine ve işgücü kayıtları oluştuktan sonra günlük süreç planını kurun.")}</p>
              </div>
              <div className="operations-actions">
                <button type="button" className="operations-refresh-button" onClick={loadOperationsData}>{copy("Refresh Data", "Verileri Yenile")}</button>
              </div>
            </div>
            {!isProcessSetupReady ? (
              <div className="process-setup-grid">
                {processSetupItems.map((item) => (
                  <article className={`operation-card process-setup-card ${item.isReady ? "ready" : "todo"}`} key={item.label}>
                    <div>
                      <mark>{item.isReady ? copy("Ready", "Hazır") : copy("Needed", "Gerekli")}</mark>
                      <h2>{item.label}</h2>
                      <p>{item.isReady ? item.readyCopy : item.todoCopy}</p>
                    </div>
                    <button type="button" onClick={() => goTo(item.path, "login")}>
                      {item.isReady ? copy("Review", "İncele") : copy("Add", "Ekle")}
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              renderOperationPlanner()
            )}
          </section>,
      );
    }

    if (activeOperationsSubmodule?.key === "resources") {
      return renderResourcesPage();
    }

    if (activeOperationsSubmodule?.key === "active-processes") {
      return renderActiveProcessesPage();
    }

    if (activeOperationsSubmodule?.key === "machines-equipment") {
      return renderMachinesEquipmentPage();
    }

    if (activeOperationsSubmodule?.key === "products") {
      return renderProductDataPage();
    }

    if (activeProductPlusSubmodule?.key === "product-tree") {
      return renderDashboardLayout(
        `product-plus/${activeProductPlusSubmodule.key}`,
          <section className="operations-workspace">
            <div className="operations-header">
              <div>
                <span>{copy("Product Tree / Product Detail", "Ürün Ağacı / Ürün Detayı")}</span>
                <h1>{operationsWorkspace.product?.name || copy("Operational Definition", "Operasyonel Tanımlama")}</h1>
              </div>
              <div className="operations-actions">
                <button type="button" onClick={() => goTo("/dashboard", "login")}>{copy("Back", "Geri")}</button>
                <button type="button" className="primary" onClick={() => goTo("/operations/products", "login")}>{copy("Edit Product", "Ürünü Düzenle")}</button>
              </div>
            </div>

            <div className="operations-tabs" role="tablist" aria-label={copy("Operation detail tabs", "Operasyon detay sekmeleri")}>
              {[
                ["general", copy("General Information", "Genel Bilgiler")],
                ["technical", copy("Technical Specs", "Teknik Özellikler")],
                ["materials", copy("Materials & Components", "Malzeme & Bileşenler")],
                ["flow", copy("Process Flow", "Süreç Akışı")],
                ["notes", copy("Notes", "Notlar")],
              ].map(([key, tab]) => (
                <button type="button" className={productPlusTab === key ? "active" : ""} onClick={() => setProductPlusTab(key)} key={key}>{tab}</button>
              ))}
            </div>

            <div className="operations-grid">
              <article className="operation-card part-visual-card">
                <div className="part-blueprint" aria-label={copy("Gasket technical visual", "Conta teknik görseli")}>
                  <div className="gasket-shape">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <div className="part-status-row">
                  <span>{copy("Weight", "Ağırlık")} <strong>{operationsWorkspace.product?.weight_kg || "-"}kg</strong></span>
                  <span>{copy("Size", "Boyut")} <strong>{operationsWorkspace.product?.dimensions || "-"}</strong></span>
                  <span>{copy("Material", "Malzeme")} <strong>{operationsWorkspace.product?.material_name || "-"}</strong></span>
                  <span>{copy("Quality", "Kalite")} <strong>{operationsWorkspace.product?.quality_grade || "-"}</strong></span>
                  <span>{copy("Cycle", "Çevrim")} <strong>{operationsWorkspace.product?.cycle_time_seconds || "-"} {copy("sec", "sn")}</strong></span>
                </div>
              </article>

              <article className="operation-card part-info-card">
                <div className="part-title">
                  <span>{operationsWorkspace.product?.status || noDataValue}</span>
                  <h2>{operationsWorkspace.product?.product_code || noDataValue}</h2>
                </div>
                <dl>
                  <div><dt>{copy("Product Code", "Ürün Kodu")}</dt><dd>{operationsWorkspace.product?.product_code || "-"}</dd></div>
                  <div><dt>{copy("Product Name", "Ürün Adı")}</dt><dd>{operationsWorkspace.product?.name || "-"}</dd></div>
                  <div><dt>{copy("Product Group", "Ürün Grubu")}</dt><dd>{operationsWorkspace.product?.product_group || "-"}</dd></div>
                  <div><dt>{copy("Revision", "Revizyon")}</dt><dd>{operationsWorkspace.product?.revision || "-"}</dd></div>
                  <div><dt>{copy("Status", "Durum")}</dt><dd>{operationsWorkspace.product?.status || "-"}</dd></div>
                  <div><dt>{copy("Created Date", "Oluşturma Tarihi")}</dt><dd>{operationsWorkspace.product?.created_at ? new Date(operationsWorkspace.product.created_at).toLocaleDateString(locale) : "-"}</dd></div>
                  <div><dt>{copy("Last Update", "Son Güncelleme")}</dt><dd>{operationsWorkspace.product?.updated_at ? new Date(operationsWorkspace.product.updated_at).toLocaleString(locale) : "-"}</dd></div>
                  <div><dt>{copy("Description", "Açıklama")}</dt><dd>{operationsWorkspace.product?.description || "-"}</dd></div>
                </dl>
              </article>

              <article className="operation-card machine-card">
                <div className="operation-card-heading">
                  <h2>{copy("Machine Pool", "Makine Havuzu")}</h2>
                  <span>{copy("Machine pool", "Makine havuzu")}</span>
                </div>
                <div className="machine-table">
                  <div className="machine-row machine-head"><span>{copy("Machine", "Makine")}</span><span>{copy("Price", "Fiyat")}</span><span>{copy("Energy", "Enerji")}</span><span>{copy("Status", "Durum")}</span></div>
                  {operationsWorkspace.machines.map((machine) => (
                    <div className="machine-row" key={machine.id}>
                      <strong>{machine.name}</strong>
                      <span>{formatOperationMoney(machine.price, machine.price_currency, exchangeRates)}</span>
                      <span>{formatNumber(machine.hourly_energy_consumption_kwh, 2)} {copy("kWh/hour", "kWh/saat")}</span>
                      <mark className="ok">{copy("Defined", "Tanımlı")}</mark>
                    </div>
                  ))}
                </div>
              </article>

              <article className="operation-card technical-card">
                <h2>{copy("Technical Specs", "Teknik Özellikler")}</h2>
                <div className="technical-grid">
                  {technicalSpecs.map(([label, value]) => (
                    <div key={label}><span>{label}</span><strong>{value}</strong></div>
                  ))}
                </div>
              </article>

              <article className="operation-card finance-impact-card">
                <div className="operation-card-heading">
                  <h2>{copy("Financial Impact", "Finansal Etki")}</h2>
                  <select value={financialHorizon} onChange={(event) => loadFinancialData(event.target.value)}>
                    <option value="6m">{copy("Next 6 months", "Gelecek 6 ay")}</option>
                    <option value="1y">{copy("Next 12 months", "Gelecek 12 ay")}</option>
                    <option value="5y">{copy("Next 60 months", "Gelecek 60 ay")}</option>
                  </select>
                </div>
                <div className="impact-kpis">
                  <span>{copy("Unit Sale Price", "Birim Satış Fiyatı")} <strong>{operationUnitSalePrice ? formatLira(operationUnitSalePrice, 2) : noDataValue}</strong></span>
                  <span>{copy("Daily Cost", "Günlük Maliyet")} <strong>{latestPlanResult ? formatLira(latestPlanResult.totalTrackedDailyCost) : noDataValue}</strong></span>
                  <span>{copy("Unit Profit", "Birim Kâr")} <strong>{operationUnitSalePrice && operationUnitCost ? formatLira(operationUnitProfit, 2) : noDataValue}</strong></span>
                  <span>{copy("Profit Margin", "Kâr Marjı")} <strong>{operationUnitSalePrice && operationUnitCost ? `${formatNumber(operationProfitMargin, 1)}%` : noDataValue}</strong></span>
                </div>
                <div className="impact-body">
                  <div className="donut-chart" aria-hidden="true"><span>{latestPlanResult ? formatLira(latestPlanResult.totalTrackedDailyCost) : noDataValue}</span></div>
                  <div className="monthly-impact">
                    <span>{copy("Product", "Ürün")} <strong>{latestPlanResult?.productName || operationsWorkspace.product?.name || noDataValue}</strong></span>
                    <span>{copy("Estimated Revenue", "Tahmini Ciro")} <strong>{moneyOrMissing(monthlyRevenue)}</strong></span>
                    <span>{copy("Estimated Cost", "Tahmini Maliyet")} <strong>{moneyOrMissing(monthlyCost)}</strong></span>
                    <span>{copy("Net Profit Margin", "Net Kâr Marjı")} <strong>{hasFinancialSourceData && monthlyRevenue ? `${formatNumber((monthlyNet / monthlyRevenue) * 100, 1)}%` : noDataValue}</strong></span>
                  </div>
                </div>
              </article>

              <article className="operation-card notes-card">
                <div className="operation-card-heading">
                  <h2>{copy("Notes", "Notlar")}</h2>
                  <button type="button" onClick={handleCreateOperationNote} disabled={operationsLoading}>{copy("New Note", "Yeni Not")}</button>
                </div>
                {(operationsWorkspace.notes.length ? operationsWorkspace.notes : [{ id: "empty", note: copy("No product note yet.", "Henüz ürün notu yok."), created_at: new Date().toISOString() }]).map((note) => (
                  <p key={note.id}>{new Date(note.created_at).toLocaleDateString(locale)}: {note.note}</p>
                ))}
              </article>
            </div>

            <article className="operation-card operation-flow">
              <div className="operation-card-heading">
                <h2>{copy("Operation Flow", "Operasyon Akışı")}</h2>
                <button type="button" onClick={focusOperationFlow}>{copy("View Flow Diagram", "Akış Diyagramını Gör")}</button>
              </div>
              <div className="flow-steps">
                {(operationFlowSteps.length ? operationFlowSteps : [{ id: "empty", name: copy("Save a process plan", "Süreç planı kaydedin"), station: copy("Backend result needed", "Backend sonucu gerekli") }]).map((step, index) => ({ ...step, step_order: index + 1 })).map((step) => (
                  <div className="flow-step" key={step.id}>
                    <span>{step.step_order}</span>
                    <strong>{step.name}</strong>
                    <small>{step.station}</small>
                  </div>
                ))}
              </div>
            </article>
          </section>,
      );
    }

    if (activeOperationsSubmodule) {
      return renderDashboardLayout(
        `operations/${activeOperationsSubmodule.key}`,
          <section className="module-placeholder">
            <div>
              <span>{copy("Operations placeholder", "Operations boş durum")}</span>
              <h1>{activeOperationsSubmodule.label}</h1>
              <p>{copy("This subpage is prepared under the Operations module. Content and business logic will be added later.", "Bu alt sayfa Operations modülü altında hazırlandı. İçerik ve iş mantığı daha sonra eklenecek.")}</p>
            </div>
            <div className="placeholder-grid">
              <article>
                <strong>{copy("Submodule", "Alt Modül")}</strong>
                <p>{copy("The screen structure for", "Ekran yapısı")} {activeOperationsSubmodule.label} {copy("will be developed here.", "için burada geliştirilecek.")}</p>
              </article>
              <article>
                <strong>{copy("Status", "Durum")}</strong>
                <p>{copy("For now, only frontend routing and the empty state screen are available.", "Şimdilik sadece frontend routing ve boş durum ekranı mevcut.")}</p>
              </article>
            </div>
          </section>,
      );
    }

    if (routePath === "/financial-modelling") {
      goTo("/financial-modelling/girdiler", "login");
      return null;
    }

    if (isFinancialRoute && !activeFinancialSubmodule) {
      goTo(isLegacyFinancialDetailPath ? "/financial-modelling/analiz" : "/financial-modelling/girdiler", "login");
      return null;
    }

    if (activeModule?.key === "financial-modelling" || activeFinancialSubmodule) {
      return renderFinancialModellingPage();
    }

    if (isSimulationRoute) {
      if (routePath === "/simulation" || !activeSimulationVariant) {
        goTo("/simulation/current-situation", "login");
        return null;
      }

      return renderSimulationPage();
    }

    if (activeModule?.key === "sales-strategy") {
      return renderSalesStrategyPage();
    }

    if (activeModule.key === "reports") {
      return renderDashboardLayout(
        activeModule.key,
          <section className="reports-workspace">
            <div className="reports-header">
              <div>
                <span>{dashboardCompanyName} / {copy("Export center", "Export merkezi")}</span>
                <h1>{copy("Report Downloads", "Rapor İndirme")}</h1>
                <p>{copy("Choose one report pack and download it as PDF, XLSX, or PPTX. This page does not save reports to Supabase or keep a report archive.", "Bir rapor paketi seçin ve PDF, XLSX veya PPTX olarak indirin. Bu sayfa raporları Supabase'e kaydetmez ve rapor arşivi tutmaz.")}</p>
              </div>
              <div className="reports-header-panel" aria-label={copy("Download behavior", "İndirme davranışı")}>
                <strong>{copy("Download only", "Sadece indir")}</strong>
                <span>{copy("No database save", "Database kaydı yok")}</span>
              </div>
            </div>

            <div className="reports-tabs" role="tablist" aria-label={copy("Report types", "Rapor türleri")}>
              {reportTabs.map((tab) => (
                <button type="button" className={activeReportTab.key === tab.key ? "active" : ""} onClick={() => setReportsTab(tab.key)} key={tab.key}>{tab.label}</button>
              ))}
            </div>

            <div className="report-stat-grid">
              {reportStats.map(([label, value, detail]) => (
                <article className="report-stat-card" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>{detail}</small>
                </article>
              ))}
            </div>

            <div className="reports-export-layout">
              <section className="reports-pack-grid" aria-label={copy("Report packs", "Rapor paketleri")}>
                {reportTabs.map((tab) => (
                  <article className={`reports-pack-card ${tab.tone} ${activeReportTab.key === tab.key ? "active" : ""}`} key={tab.key}>
                    <button type="button" onClick={() => setReportsTab(tab.key)}>
                      <span>{copy("Report pack", "Rapor paketi")}</span>
                      <strong>{tab.label}</strong>
                      <small>{tab.detail}</small>
                    </button>
                    <div className="reports-pack-includes">
                      {tab.includes.map((item) => <em key={item}>{item}</em>)}
                    </div>
                  </article>
                ))}
              </section>

              <aside className="reports-export-panel">
                <article className="reports-card reports-selected-card">
                  <div className="reports-card-heading">
                    <div>
                      <span>{copy("Selected export", "Seçili export")}</span>
                      <h2>{activeReportTab.label}</h2>
                    </div>
                  </div>
                  <p>{activeReportTab.detail}</p>
                  <div className="reports-selected-includes">
                    {activeReportTab.includes.map((item) => <span key={item}>{item}</span>)}
                  </div>
                </article>

                <article className="reports-card reports-format-card">
                  <div className="reports-card-heading">
                    <div>
                      <span>{copy("Download format", "İndirme formatı")}</span>
                      <h2>{copy("Choose file type", "Dosya türü seçin")}</h2>
                    </div>
                  </div>
                  <div className="reports-format-grid">
                    {reportFormats.map((format) => (
                      <button type="button" onClick={() => downloadReportPlaceholder(activeReportTab, format)} key={format.key}>
                        <strong>{format.label}</strong>
                        <span>{format.note}</span>
                        <small>{copy("Download", "İndir")}</small>
                      </button>
                    ))}
                  </div>
                  <p>{copy("These buttons currently download placeholder files with the selected extension. Real report rendering can be connected later.", "Bu butonlar şimdilik seçilen uzantıyla placeholder dosya indirir. Gerçek rapor üretimi daha sonra bağlanabilir.")}</p>
                </article>

                <article className="reports-card reports-readiness-card">
                  <div className="reports-card-heading">
                    <div>
                      <span>{copy("Source readiness", "Kaynak hazırlığı")}</span>
                      <h2>{copy("What the report can use", "Raporun kullanabileceği kaynaklar")}</h2>
                    </div>
                    <button type="button" onClick={loadPlanningData}>{copy("Refresh", "Yenile")}</button>
                  </div>
                  {[
                    [copy("Product record", "Ürün kaydı"), operationsWorkspace.product ? copy("Ready", "Hazır") : copy("Needed", "Gerekli")],
                    [copy("Process backend result", "Süreç backend sonucu"), activePlanResults.length ? copy("Ready", "Hazır") : copy("Needed", "Gerekli")],
                    [copy("Channel sales plan", "Kanal satış planı"), hasSalesForecast ? copy("Ready", "Hazır") : copy("Needed", "Gerekli")],
                    [copy("Financial assumptions", "Finansal varsayımlar"), hasFinancialAssumptions ? copy("Ready", "Hazır") : copy("Needed", "Gerekli")],
                  ].map(([item, state]) => (
                    <div className="schedule-row" key={item}>
                      <strong>{item}</strong>
                      <span>{copy("Used only for export", "Sadece export için kullanılır")}</span>
                      <mark>{state}</mark>
                    </div>
                  ))}
                </article>
              </aside>
            </div>
          </section>,
      );
    }

    if (activeModule.key === "human-resources-plus") {
      return renderDashboardLayout(
        activeModule.key,
          <section className="module-placeholder">
            <div>
              <span>{copy("Workforce module", "İnsan kaynağı modülü")}</span>
              <h1>{activeModule.label}</h1>
              <p>{copy("This workspace is ready for workforce definitions, skills, labor capacity, and planning across operations.", "Bu çalışma alanı iş gücü tanımları, yetkinlikler, işçilik kapasitesi ve operasyon geneli planlama için hazırlandı.")}</p>
            </div>
            <div className="placeholder-grid">
              <article>
                <strong>{copy("Workforce Planning", "İş Gücü Planlama")}</strong>
                <p>{copy("Connect roles, operators, and capacity needs to production workflows.", "Rolleri, operatörleri ve kapasite ihtiyaçlarını üretim iş akışlarına bağlayın.")}</p>
              </article>
              <article>
                <strong>{copy("Status", "Durum")}</strong>
                <p>{copy("Frontend routing is active; data tables and business logic can be added next.", "Frontend routing aktif; veri tabloları ve iş mantığı sonraki adımda eklenebilir.")}</p>
              </article>
            </div>
          </section>,
      );
    }

    return renderDashboardLayout(
      activeModule.key,
        <section className="module-placeholder">
          <div>
            <span>{copy("Module placeholder", "Modül boş durumu")}</span>
            <h1>{activeModule.label}</h1>
            <p>{copy("This module is visible in the dashboard navigation and is ready for its frontend workflow.", "Bu modül dashboard navigasyonunda görünür ve frontend iş akışı için hazırdır.")}</p>
          </div>
          <div className="placeholder-grid">
            <article>
              <strong>{copy("Workspace", "Çalışma Alanı")}</strong>
              <p>{copy("Empty state for upcoming tools, tables, and decision screens.", "Yakında eklenecek araçlar, tablolar ve karar ekranları için boş durum.")}</p>
            </article>
            <article>
              <strong>{copy("Status", "Durum")}</strong>
              <p>{copy("This module will stay empty until its Supabase-backed workflow is added.", "Bu modül Supabase bağlantılı iş akışı eklenene kadar boş kalır.")}</p>
            </article>
          </div>
        </section>,
    );
  }

  if (session && routePath === "/authorization") {
    return renderDashboardLayout(
      "authorization",
        <section className="authorization-page">
          <div className="authorization-heading">
            <span>{labels.dashboard}</span>
            <h1>{labels.authorizationPage}</h1>
            <p>{authorizationAccess.read ? labels.authorizationCopy : labels.authorizationLockedCopy}</p>
          </div>

          {!authorizationAccess.read ? (
            <div className="authorization-locked">
              <strong>{labels.authorizationLocked}</strong>
              <p>{labels.authorizationLockedCopy}</p>
            </div>
          ) : (
            <>
              <div className="authorization-tabs" role="tablist" aria-label={labels.authorizationPage}>
                <button
                  type="button"
                  className={authorizationTab === "roles" ? "active" : ""}
                  onClick={() => setAuthorizationTab("roles")}
                >
                  {labels.roleDefinition}
                </button>
                <button
                  type="button"
                  className={authorizationTab === "users" ? "active" : ""}
                  onClick={() => setAuthorizationTab("users")}
                >
                  {labels.userDefinition}
                </button>
              </div>

              {authorizationTab === "users" ? (
                <div className="authorization-grid user-definition-grid">
                  <form className="authorization-card user-definition-form" onSubmit={handleCreateManagedUser}>
                    <h2>{labels.userDefinition}</h2>
                    <p>{labels.userDefinitionCopy}</p>
                    <label>
                      <span>{labels.username}</span>
                      <input
                        disabled={!authorizationAccess.write || authorizationLoading}
                        required
                        value={managedUserForm.username}
                        onChange={(event) => updateManagedUserForm("username", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>{labels.email}</span>
                      <input
                        disabled={!authorizationAccess.write || authorizationLoading}
                        required
                        type="email"
                        value={managedUserForm.email}
                        onChange={(event) => updateManagedUserForm("email", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>{labels.password}</span>
                      <input
                        disabled={!authorizationAccess.write || authorizationLoading}
                        minLength="6"
                        required
                        type="password"
                        value={managedUserForm.password}
                        onChange={(event) => updateManagedUserForm("password", event.target.value)}
                      />
                    </label>
                    <div className="user-definition-fields">
                      <label>
                        <span>{labels.phoneNumber}</span>
                        <input
                          disabled={!authorizationAccess.write || authorizationLoading}
                          value={managedUserForm.phoneNumber}
                          onChange={(event) => updateManagedUserForm("phoneNumber", event.target.value)}
                        />
                      </label>
                      <label>
                        <span>{labels.department}</span>
                        <input
                          disabled={!authorizationAccess.write || authorizationLoading}
                          value={managedUserForm.department}
                          onChange={(event) => updateManagedUserForm("department", event.target.value)}
                        />
                      </label>
                      <label>
                        <span>{labels.accessLevel}</span>
                        <select
                          disabled={!authorizationAccess.write || authorizationLoading}
                          value={managedUserForm.accessLevel}
                          onChange={(event) => updateManagedUserForm("accessLevel", event.target.value)}
                        >
                          {editableAuthorizationRoles.map((role) => (
                            <option value={role.name} key={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>{labels.language}</span>
                        <select
                          disabled={!authorizationAccess.write || authorizationLoading}
                          value={managedUserForm.language}
                          onChange={(event) => updateManagedUserForm("language", event.target.value)}
                        >
                          <option value="en">EN</option>
                          <option value="tr">TR</option>
                        </select>
                      </label>
                    </div>
                    <button className="submit-button" disabled={!authorizationAccess.write || authorizationLoading} type="submit">
                      {authorizationLoading ? "..." : labels.createManagedUser}
                    </button>
                    <p className="authorization-note">
                      {authorizationAccess.write ? labels.writeAccess : labels.readOnlyMode}
                    </p>
                  </form>

                  <div className="authorization-card users-card">
                    <div className="permissions-header">
                      <h2>{labels.managedUsers}</h2>
                      {currentProfile?.company?.name && <span>{currentProfile.company.name}</span>}
                    </div>
                    {renderSimpleSortableGrid({
                      columns: userTableColumns,
                      gridTemplateColumns: "1fr 1.4fr 1fr 0.8fr",
                      headClassName: "users-row-head",
                      rowClassName: "users-row",
                      rows: profiles,
                      tableClassName: "users-table",
                      tableId: "authorization-users",
                    })}
                  </div>
                </div>
              ) : (
                <div className="authorization-grid">
                  <form className="authorization-card role-form" onSubmit={handleCreateRole}>
                    <h2>{labels.newRole}</h2>
                    <label>
                      <span>{labels.roleName}</span>
                      <input
                        disabled={!authorizationAccess.write || authorizationLoading}
                        value={roleForm.name}
                        onChange={(event) => updateRoleForm("name", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>{labels.roleDescription}</span>
                      <input
                        disabled={!authorizationAccess.write || authorizationLoading}
                        value={roleForm.description}
                        onChange={(event) => updateRoleForm("description", event.target.value)}
                      />
                    </label>
                    <button className="submit-button" disabled={!authorizationAccess.write || authorizationLoading} type="submit">
                      {labels.createRole}
                    </button>
                    <p className="authorization-note">
                      {authorizationAccess.write ? labels.writeAccess : labels.readOnlyMode}
                    </p>
                  </form>

                  <div className="authorization-card permissions-card">
                    <div className="permissions-header">
                      <h2>{labels.permissions}</h2>
                      {currentProfile?.company?.name && <span>{currentProfile.company.name}</span>}
                    </div>
                    {renderSimpleSortableGrid({
                      columns: permissionTableColumns,
                      gridTemplateColumns: "1fr 1fr 0.8fr 0.8fr",
                      headClassName: "permissions-row-head",
                      rowClassName: "permissions-row",
                      rows: permissionTableRows,
                      tableClassName: "permissions-table",
                      tableId: "authorization-permissions",
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {authorizationStatus && <p className="status-message">{authorizationStatus}</p>}
        </section>,
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-label="Atera authentication">
        <header className="brand-bar">
          <div className="brand-mark">
            <img src={logoUrl} alt="Atera logo" />
            <div>
              <strong>Atera</strong>
              <span>{copy("Commodity Workspace", "Emtia Çalışma Alanı")}</span>
            </div>
          </div>

          <div className="auth-controls">
            <label className="language-picker">
              <span>{labels.language}</span>
              <select value={form.language} onChange={(event) => updateField("language", event.target.value)}>
                <option value="en">EN</option>
                <option value="tr">TR</option>
              </select>
            </label>
            <ThemeToggle />
          </div>
        </header>

        <div className="avatar-zone">
          <div className="avatar">
            {profilePreview ? <img src={profilePreview} alt={copy("Profile preview", "Profil önizlemesi")} /> : <span>{initials}</span>}
          </div>
        </div>

        {session ? (
          <div className="signed-in">
            <p>{labels.signedIn}</p>
            <button type="button" onClick={handleLogout}>
              {labels.logout}
            </button>
          </div>
        ) : mode === "reset" ? (
          <form className="auth-form" onSubmit={handleResetPassword}>
            <label>
              <span>{labels.resetPassword}</span>
              <div className="password-field">
                <input
                  autoComplete="new-password"
                  required
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => updateField("password", event.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? labels.hidePassword : labels.showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? labels.hide : labels.show}
                </button>
              </div>
            </label>
            <label>
              <span>{labels.confirmPassword}</span>
              <div className="password-field">
                <input
                  autoComplete="new-password"
                  required
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showConfirmPassword ? labels.hidePassword : labels.showPassword}
                  onClick={() => setShowConfirmPassword((current) => !current)}
                >
                  {showConfirmPassword ? labels.hide : labels.show}
                </button>
              </div>
            </label>
            <button className="submit-button" disabled={loading} type="submit">
              {loading ? "..." : labels.resetPassword}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              <span>{labels.loginEmail}</span>
              <input
                autoComplete="email"
                required
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </label>

            <label>
              <span>{labels.password}</span>
              <div className="password-field">
                <input
                  autoComplete="current-password"
                  required
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => updateField("password", event.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? labels.hidePassword : labels.showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? labels.hide : labels.show}
                </button>
              </div>
            </label>

            <div className="form-options">
              <span>{labels.adminProvisionedAccess}</span>
              <button type="button" className="link-button" onClick={handleForgotPassword}>
                {labels.forgot}
              </button>
            </div>

            <button className="submit-button" disabled={loading} type="submit">
              {loading ? "..." : labels.submitLogin}
            </button>
          </form>
        )}

        {status && <p className="status-message">{status}</p>}
      </section>
    </main>
  );
}

export default App;
