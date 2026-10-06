import React from "react";
import { InfoTip } from "../components/InfoTip";
import {
  convertMoneyToTry,
  getBaseMonthlySalesUnits,
  getMonthlyProductProductionMap,
  getOperationProductMap,
  getOptionalPositiveNumber,
  getProjectedChannelSalesUnits,
  getSalesExpectationInputMultipliers,
  getSalesExpectationMultipliers,
  getSalesForecastForMonth,
  getSalesMultiplierPeriod,
  toFiniteNumber,
} from "../lib/feasibilityModel";
import { formatLira, formatNumber, formatQuantity } from "../lib/format";
import { normalizeSalesVisibleSections } from "../lib/uiPreferences";
import { useAppContext } from "../app/AppContext";
import TableToolbar from "../components/TableToolbar";
import DashboardLayout from "../components/DashboardLayout";

export default function SalesStrategyPage() {
  const {
    addSalesItem,
    copy,
    dashboardCompanyName,
    exchangeRates,
    financialSettingsForm,
    form,
    getNextTableSortPatch,
    getSortableTableRows,
    getTableColumnKey,
    getTableSortIndicator,
    goTo,
    handleSaveSalesStrategy,
    loadPlanningData,
    operationsWorkspace,
    removeSalesItem,
    resetSalesVisibleSections,
    salesEditorOpen,
    salesLoading,
    salesStatus,
    salesStrategy,
    salesVisibleSections,
    setSalesEditorOpen,
    setSalesStrategy,
    tableControls,
    toggleSalesVisibleSection,
    updateSalesChannelSeasonality,
    updateSalesCompany,
    updateSalesForecast,
    updateSalesItem,
    updateTableControl,
  } = useAppContext();

  const monthlyMultipliers = getSalesExpectationMultipliers(salesStrategy);
  const multiplierPeriod = getSalesMultiplierPeriod(salesStrategy);
  const multiplierInputs = getSalesExpectationInputMultipliers(salesStrategy);
  const workingDaysPerMonth = Math.max(1, toFiniteNumber(financialSettingsForm.workingDaysPerMonth, 22));
  const monthlyProductionByProduct = getMonthlyProductProductionMap(operationsWorkspace, workingDaysPerMonth);
  const productMap = getOperationProductMap(operationsWorkspace);
  const baseMonthlySalesUnits = getBaseMonthlySalesUnits(salesStrategy);
  const expectedAnnualSalesUnits = monthlyMultipliers.reduce(
    (total, _multiplier, index) => total + getSalesForecastForMonth(salesStrategy, index),
    0,
  );
  const averageMultiplier =
    monthlyMultipliers.reduce((total, multiplier) => total + multiplier, 0) / Math.max(monthlyMultipliers.length, 1);
  const totalCampaignBudget = salesStrategy.campaigns.reduce(
    (total, campaign) => total + (Number(campaign.budget) || 0),
    0,
  );
  const getProductAvailability = (productId) => {
    const monthlyProduced = Math.max(0, monthlyProductionByProduct.get(productId) || 0);
    const plannedSales = salesStrategy.channels.reduce(
      (total, channel) =>
        channel.productId === productId ? total + Math.max(0, toFiniteNumber(channel.monthlySalesUnits)) : total,
      0,
    );

    return {
      monthlyProduced,
      plannedSales,
      remaining: monthlyProduced - plannedSales,
    };
  };
  const totalReadyUnits = operationsWorkspace.products.reduce(
    (total, product) => total + Math.max(0, getProductAvailability(product.id).remaining),
    0,
  );
  const totalMonthlyCommission = salesStrategy.channels.reduce((total, channel) => {
    const product = productMap.get(channel.productId) || channel.product || {};
    const productPriceTry =
      getOptionalPositiveNumber(channel.unitSalesPrice) ??
      convertMoneyToTry(product.price, product.price_currency, exchangeRates);
    const grossRevenue = Math.max(0, toFiniteNumber(channel.monthlySalesUnits)) * Math.max(0, productPriceTry);
    return total + (grossRevenue * Math.max(0, toFiniteNumber(channel.commissionPercent))) / 100;
  }, 0);
  const activeProductCount = new Set(salesStrategy.channels.map((channel) => channel.productId).filter(Boolean)).size;
  const salesReadinessItems = [
    { done: operationsWorkspace.products.length > 0, label: copy("Products", "Ürünler"), path: "/operations/products" },
    {
      done: salesStrategy.channels.some((channel) => channel.name && channel.productId),
      label: copy("Channels", "Kanallar"),
      path: "/sales-strategy",
    },
    {
      done: salesStrategy.channels.some((channel) => toFiniteNumber(channel.monthlySalesUnits) > 0),
      label: copy("Quantities", "Adetler"),
      path: "/sales-strategy",
    },
    {
      done: salesStrategy.campaigns.some((campaign) => campaign.name && toFiniteNumber(campaign.budget) > 0),
      label: copy("Campaigns", "Kampanyalar"),
      path: "/sales-strategy",
    },
  ];
  const salesReadyCount = salesReadinessItems.filter((item) => item.done).length;
  const salesReadinessPercent = Math.round((salesReadyCount / Math.max(salesReadinessItems.length, 1)) * 100);
  const salesForecastPreview = Array.from({ length: 12 }, (_, monthIndex) => {
    const channels = salesStrategy.channels.map((channel, channelIndex) => ({
      id: channel.id || `channel-${channelIndex}`,
      name: channel.name?.trim() || `${copy("Channel", "Kanal")} ${channelIndex + 1}`,
      units: getProjectedChannelSalesUnits(channel, monthIndex, salesStrategy),
    }));
    const totalUnits = channels.reduce((total, channel) => total + channel.units, 0);

    return {
      channels,
      label: `${copy("Month", "Ay")} ${monthIndex + 1}`,
      value: totalUnits,
    };
  });
  const maxSalesForecastPreview = Math.max(1, ...salesForecastPreview.map((item) => item.value));
  const salesStrategyTone = salesReadinessPercent >= 75 ? "teal" : salesReadinessPercent >= 50 ? "amber" : "clay";
  const salesChannelTypeOptions = salesStrategy.channelTypes?.length
    ? salesStrategy.channelTypes
    : [
        {
          averageCommissionPercent: 0,
          averageCustomerAcquisitionRate: 18,
          descriptionEn: "Direct sales owned by the company.",
          descriptionTr: "Şirketin doğrudan yönettiği satış.",
          id: "direct",
          nameEn: "Direct sales",
          nameTr: "Direkt satış",
        },
        {
          averageCommissionPercent: 8,
          averageCustomerAcquisitionRate: 8,
          descriptionEn: "Digital storefront or online flow.",
          descriptionTr: "Dijital mağaza veya online akış.",
          id: "online",
          nameEn: "Online",
          nameTr: "Online",
        },
        {
          averageCommissionPercent: 20,
          averageCustomerAcquisitionRate: 5,
          descriptionEn: "Retail shelf or store channel.",
          descriptionTr: "Perakende raf veya mağaza kanalı.",
          id: "retail",
          nameEn: "Retail",
          nameTr: "Perakende",
        },
        {
          averageCommissionPercent: 25,
          averageCustomerAcquisitionRate: 4,
          descriptionEn: "Distributor-led sales route.",
          descriptionTr: "Distribütör üzerinden satış rotası.",
          id: "distributor",
          nameEn: "Distributor",
          nameTr: "Distribütör",
        },
        {
          averageCommissionPercent: 15,
          averageCustomerAcquisitionRate: 7,
          descriptionEn: "Marketplace platform channel.",
          descriptionTr: "Pazaryeri platform kanalı.",
          id: "marketplace",
          nameEn: "Marketplace",
          nameTr: "Pazaryeri",
        },
      ];
  const campaignTypeOptions = salesStrategy.campaignTypes?.length
    ? salesStrategy.campaignTypes
    : [
        {
          averageConversionRate: 3,
          averageCustomerAcquisitionRate: 6,
          averageDurationDays: 30,
          descriptionEn: "Paid digital acquisition campaign.",
          descriptionTr: "Ücretli dijital müşteri kazanım kampanyası.",
          id: "digital",
          nameEn: "Digital advertising",
          nameTr: "Dijital reklam",
        },
        {
          averageConversionRate: 2.5,
          averageCustomerAcquisitionRate: 5,
          averageDurationDays: 21,
          descriptionEn: "Organic and paid social campaign.",
          descriptionTr: "Organik ve ücretli sosyal medya kampanyası.",
          id: "social",
          nameEn: "Social media",
          nameTr: "Sosyal medya",
        },
        {
          averageConversionRate: 4,
          averageCustomerAcquisitionRate: 7,
          averageDurationDays: 14,
          descriptionEn: "Creator or influencer-led campaign.",
          descriptionTr: "İçerik üretici veya influencer odaklı kampanya.",
          id: "influencer",
          nameEn: "Influencer",
          nameTr: "Influencer",
        },
        {
          averageConversionRate: 5,
          averageCustomerAcquisitionRate: 4,
          averageDurationDays: 30,
          descriptionEn: "Trade promotion for partners.",
          descriptionTr: "Ticari iş ortakları için promosyon.",
          id: "trade",
          nameEn: "Trade promotion",
          nameTr: "Ticari promosyon",
        },
        {
          averageConversionRate: 6,
          averageCustomerAcquisitionRate: 3,
          averageDurationDays: 7,
          descriptionEn: "Event, fair, or field activation.",
          descriptionTr: "Etkinlik, fuar veya saha aktivasyonu.",
          id: "event",
          nameEn: "Event / fair",
          nameTr: "Etkinlik / fuar",
        },
        {
          averageConversionRate: 2,
          averageCustomerAcquisitionRate: 4,
          averageDurationDays: 14,
          descriptionEn: "Email and CRM lifecycle campaign.",
          descriptionTr: "E-posta ve CRM yaşam döngüsü kampanyası.",
          id: "email",
          nameEn: "Email / CRM",
          nameTr: "E-posta / CRM",
        },
      ];
  const getSalesTypeLabel = (type) =>
    (form.language === "tr" ? type.nameTr || type.nameEn : type.nameEn || type.nameTr) || type.id;
  const getSalesTypeDescription = (type) =>
    (form.language === "tr" ? type.descriptionTr || type.descriptionEn : type.descriptionEn || type.descriptionTr) ||
    "";
  const getCampaignTypeLabel = (campaign) => {
    const selectedType = campaignTypeOptions.find((type) => type.id === (campaign.typeId || "digital"));
    return selectedType ? getSalesTypeLabel(selectedType) : "";
  };
  const campaignTableColumns = [
    {
      header: copy("Campaign", "Kampanya"),
      key: "campaign",
      render: (row) => row.name || "",
      value: (row) => row.name || "",
    },
    { header: copy("Type", "Tip"), key: "type", render: getCampaignTypeLabel, value: getCampaignTypeLabel },
    {
      header: copy("Channel", "Kanal"),
      key: "channel",
      render: (row) => row.channel || "",
      value: (row) => row.channel || "",
    },
    {
      header: copy("Budget", "Bütçe"),
      key: "budget",
      render: (row) => formatLira(toFiniteNumber(row.budget)),
      sortValue: (row) => toFiniteNumber(row.budget),
    },
    {
      header: copy("Duration", "Süre"),
      key: "duration",
      render: (row) => toFiniteNumber(row.durationDays),
      sortValue: (row) => toFiniteNumber(row.durationDays),
    },
  ];
  const visibleCampaignRows = getSortableTableRows("sales-campaigns", salesStrategy.campaigns, campaignTableColumns);
  const salesChannelRequiredFields = [
    {
      field: "startMonth",
      info: copy(
        "The first model month where this channel can sell. Earlier months contribute zero sales for this channel.",
        "Bu kanalın satışa başlayacağı ilk model ayı. Önceki aylar bu kanal için sıfır satış üretir.",
      ),
      label: copy("Start month", "Başlangıç Ayı"),
      min: 1,
      step: "1",
    },
    {
      field: "monthlySalesUnits",
      info: copy(
        "Base sales promise for the first active month. Forecast then applies growth, expectation multiplier, seasonality, traffic score, returns, and limits.",
        "İlk aktif ay için temel satış vaadi. Tahmin sonrasında büyüme, beklenti çarpanı, sezonsallık, trafik skoru, iadeler ve limitler uygulanır.",
      ),
      label: copy("First month sales (units)", "İlk Ay Satış (Adet)"),
      min: 0,
      step: "1",
    },
    {
      field: "growthMonths1To6Percent",
      info: copy(
        "Monthly growth applied after launch for elapsed months 1-6.",
        "Lansmandan sonra geçen 1-6. aylar için uygulanan aylık büyüme oranı.",
      ),
      label: copy("Growth (1-6 mo) (%)", "Büyüme (1-6 Ay) (%)"),
      min: 0,
      step: "0.01",
    },
    {
      field: "growthMonths7To18Percent",
      info: copy(
        "Monthly growth applied for elapsed months 7-18 after the channel start.",
        "Kanal başlangıcından sonra geçen 7-18. aylar için uygulanan aylık büyüme oranı.",
      ),
      label: copy("Growth (7-18 mo) (%)", "Büyüme (7-18 Ay) (%)"),
      min: 0,
      step: "0.01",
    },
    {
      field: "growthMonths19To24Percent",
      info: copy(
        "Monthly growth applied for elapsed months 19-24 after the channel start.",
        "Kanal başlangıcından sonra geçen 19-24. aylar için uygulanan aylık büyüme oranı.",
      ),
      label: copy("Growth (19-24 mo) (%)", "Büyüme (19-24 Ay) (%)"),
      min: 0,
      step: "0.01",
    },
    {
      field: "growthYears3To5Percent",
      info: copy(
        "Monthly growth used after month 24 when longer horizons are selected.",
        "24. aydan sonra, daha uzun projeksiyonlarda kullanılan aylık büyüme oranı.",
      ),
      label: copy("Year 3-5 growth (%)", "Yıl 3-5 Büyüme (%)"),
      min: 0,
      step: "0.01",
    },
    {
      field: "collectionDays",
      info: copy(
        "Average delay before channel revenue becomes cash. The model shifts cash receipts by this delay.",
        "Kanal cirosunun nakde dönüşme ortalama gecikmesi. Model nakit girişini bu gecikmeye göre kaydırır.",
      ),
      label: copy("Collection (days)", "Tahsilat (Gün)"),
      min: 0,
      step: "1",
    },
    {
      field: "customerAcquisitionCost",
      label: copy("Unit marketing (CAC) TL", "Birim Pazarlama (CAC) TL"),
      min: 0,
      step: "0.01",
    },
    {
      field: "commissionPercent",
      info: copy(
        "Commission is deducted from gross channel revenue before net revenue is reported.",
        "Komisyon, net ciro raporlanmadan önce brüt kanal cirosundan düşülür.",
      ),
      label: copy("Channel commission (%)", "Kanal Komisyonu (%)"),
      max: 100,
      min: 0,
      step: "0.1",
    },
  ];
  const advancedChannelFields = [
    {
      field: "trafficScore",
      info: copy(
        "A simple demand strength multiplier. 1 keeps demand unchanged, 1.2 lifts it by 20%, 0.8 lowers it by 20%.",
        "Basit talep gücü çarpanı. 1 talebi değiştirmez, 1,2 %20 artırır, 0,8 %20 düşürür.",
      ),
      label: copy("Traffic Score", "Trafik Skoru"),
      min: 0,
      step: "0.01",
    },
    {
      field: "unitSalesPrice",
      info: copy(
        "Optional channel-specific TRY price. If empty, finance uses the selected product price.",
        "Opsiyonel kanala özel TL satış fiyatı. Boş bırakılırsa finans seçili ürün fiyatını kullanır.",
      ),
      label: copy("Channel Unit Price (TRY)", "Kanal Birim Fiyatı (TL)"),
      min: 0,
      step: "0.01",
    },
    { field: "discountRatePercent", label: copy("Discount Rate (%)", "İndirim Oranı (%)"), min: 0, step: "0.01" },
    { field: "returnRatePercent", label: copy("Return Rate (%)", "İade Oranı (%)"), min: 0, step: "0.001" },
    {
      field: "capacityLimit",
      info: copy(
        "Maximum units this channel can sell in a month after all multipliers are applied.",
        "Tüm çarpanlardan sonra bu kanalın bir ayda satabileceği maksimum adet.",
      ),
      label: copy("Capacity Limit", "Kapasite Limiti"),
      min: 0,
      step: "1",
    },
    { field: "launchFee", label: copy("Launch Fee", "Lansman Bedeli"), min: 0, step: "0.01" },
    { field: "moqMonthly", label: copy("MOQ Monthly", "Aylık MOQ"), min: 0, step: "1" },
    {
      field: "failureProbabilityPercent",
      label: copy("Failure Prob. (%)", "Başarısızlık Olas. (%)"),
      min: 0,
      step: "0.001",
    },
    { field: "rampUpMonths", label: copy("Ramp-Up Months", "Ramp-Up Ayı"), min: 0, step: "1" },
  ];
  const seasonalityMonthLabels =
    form.language === "tr"
      ? ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"]
      : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const normalizedSalesVisibleSections = normalizeSalesVisibleSections(salesVisibleSections);
  const isSalesOptionalSectionVisible = (sectionId) => normalizedSalesVisibleSections.optional.includes(sectionId);
  const salesReadoutCards = [
    {
      detail: copy("selected from Operations products", "Operasyon ürünlerinden seçildi"),
      id: "productsInChannels",
      label: copy("Products in channels", "Kanallardaki ürün"),
      value: formatNumber(activeProductCount),
    },
    {
      detail: copy("total planned marketing spend", "toplam planlanan pazarlama bütçesi"),
      id: "campaignBudget",
      label: copy("Campaign budget", "Kampanya bütçesi"),
      value: formatLira(totalCampaignBudget),
    },
    {
      detail:
        multiplierPeriod === "quarterly"
          ? copy("quarterly values expanded to 12 months", "çeyrek değerleri 12 aya yayıldı")
          : copy("across 12 months", "12 ay genelinde"),
      id: "averageMultiplier",
      label: copy("Average multiplier", "Ortalama çarpan"),
      value: `${formatNumber(averageMultiplier, 2)}x`,
    },
    {
      detail: copy("after planned channel quantities", "planlanan kanal adetlerinden sonra"),
      id: "readyRemaining",
      label: copy("Ready remaining", "Hazır kalan"),
      value: formatNumber(totalReadyUnits),
    },
    {
      detail: copy("sum of channel quantities", "kanal adetleri toplamı"),
      id: "monthlyChannelPlan",
      label: copy("Monthly channel plan", "Aylık kanal planı"),
      value: formatNumber(baseMonthlySalesUnits),
    },
    {
      detail:
        multiplierPeriod === "quarterly"
          ? copy("channel plan x quarterly multipliers", "kanal planı x çeyreklik çarpanlar")
          : copy("channel plan x monthly multipliers", "kanal planı x aylık çarpanlar"),
      id: "expectedAnnualUnits",
      label: copy("12M expected units", "12A beklenen adet"),
      value: formatNumber(expectedAnnualSalesUnits),
    },
    {
      detail: copy("based on product prices", "ürün fiyatlarına göre"),
      id: "monthlyCommission",
      label: copy("Monthly commission", "Aylık komisyon"),
      value: formatLira(totalMonthlyCommission),
    },
  ];
  const visibleSalesReadoutCards = salesReadoutCards.filter((card) =>
    normalizedSalesVisibleSections.readout.includes(card.id),
  );
  const salesEditorGroups = [
    {
      description: copy(
        "These sections are optional controls on the sales page.",
        "Bu bölümler satış sayfasındaki opsiyonel kontrol alanlarıdır.",
      ),
      key: "optional",
      options: [
        {
          detail: copy(
            "Monthly or quarterly expectation multipliers that scale the sales forecast.",
            "Satış tahminini ölçekleyen aylık veya çeyreklik beklenti çarpanları.",
          ),
          id: "expectationMultipliers",
          label: copy("Expectation multiplier period", "Beklenti çarpanı periyodu"),
        },
        {
          detail: copy(
            "Traffic, capacity, seasonality, ramp-up, returns and channel-specific price fields.",
            "Trafik, kapasite, sezonsallık, ramp-up, iade ve kanala özel fiyat alanları.",
          ),
          id: "advancedChannelParameters",
          label: copy("Advanced channel parameters", "Gelişmiş kanal parametreleri"),
        },
      ],
      title: copy("Optional sections", "Opsiyonel kısımlar"),
    },
    {
      description: copy(
        "Choose which strategy readout cards appear at the bottom of the page.",
        "Sayfanın altındaki strateji okumasında hangi kartların görüneceğini seçin.",
      ),
      key: "readout",
      options: salesReadoutCards,
      title: copy("Strategy readout", "Strateji okuması"),
    },
  ];

  return (
    <DashboardLayout activePage="sales-strategy">
      <section className="sales-workspace">
        <div className="sales-header">
          <div>
            <span>
              {dashboardCompanyName} / {copy("Sales Strategy", "Satış Stratejisi")}
            </span>
            <h1>{copy("Sales Strategy", "Satış Stratejisi")}</h1>
            <p>
              {copy(
                "Plan sales channels by product, monthly sales quantity, commission, campaign duration, and monthly or quarterly expectation multipliers. Financial Modelling reads these product-linked quantities directly.",
                "Satış kanallarını ürün, aylık satış adedi, komisyon, kampanya süresi ve aylık ya da çeyreklik beklenti çarpanlarıyla planlayın. Finansal Modelleme bu ürün bağlantılı adetleri doğrudan kullanır.",
              )}
            </p>
          </div>
          <div className="sales-header-actions">
            <button
              type="button"
              className={`sales-edit-toggle ${salesEditorOpen ? "active" : ""}`}
              onClick={() => setSalesEditorOpen((isOpen) => !isOpen)}
              aria-controls="sales-editor-panel"
              aria-expanded={salesEditorOpen}
            >
              {salesEditorOpen ? copy("Done editing", "Düzenlemeyi bitir") : copy("Edit page", "Sayfayı düzenle")}
            </button>
            <button type="button" className="app-command-button" onClick={loadPlanningData} disabled={salesLoading}>
              {copy("Refresh Data", "Verileri Yenile")}
            </button>
            <button
              type="button"
              className="primary app-command-button"
              onClick={handleSaveSalesStrategy}
              disabled={salesLoading}
            >
              {salesLoading ? copy("Saving...", "Kaydediliyor...") : copy("Save Strategy", "Stratejiyi Kaydet")}
            </button>
          </div>
        </div>

        {salesStatus && <p className="status-message">{salesStatus}</p>}

        {salesEditorOpen && (
          <section
            id="sales-editor-panel"
            className="sales-editor-panel"
            aria-label={copy("Sales page editor", "Satış sayfası düzenleyici")}
          >
            <div className="sales-editor-heading">
              <div>
                <span>{copy("Sales view", "Satış görünümü")}</span>
                <h2>{copy("Visible optional content", "Görünecek opsiyonel içerikler")}</h2>
                <p>
                  {copy(
                    "Selections are saved for this browser and do not change the saved sales data.",
                    "Seçimler bu tarayıcıda saklanır; kayıtlı satış verisini değiştirmez.",
                  )}
                </p>
              </div>
              <div className="sales-editor-actions">
                <button type="button" onClick={resetSalesVisibleSections}>
                  {copy("Reset", "Sıfırla")}
                </button>
                <button type="button" className="primary" onClick={() => setSalesEditorOpen(false)}>
                  {copy("Done", "Bitti")}
                </button>
              </div>
            </div>
            <div className="sales-editor-grid">
              {salesEditorGroups.map((group) => {
                const visibleKeys = normalizedSalesVisibleSections[group.key] || [];

                return (
                  <article className="sales-editor-group" key={group.key}>
                    <div className="sales-editor-group-heading">
                      <div>
                        <span>{group.title}</span>
                        <p>{group.description}</p>
                      </div>
                      <strong>
                        {visibleKeys.length}/{group.options.length}
                      </strong>
                    </div>
                    <div className="sales-editor-options">
                      {group.options.map((option) => {
                        const isSelected = visibleKeys.includes(option.id);

                        return (
                          <label className={`sales-editor-option ${isSelected ? "selected" : ""}`} key={option.id}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSalesVisibleSection(group.key, option.id)}
                            />
                            <span>
                              <strong>{option.label}</strong>
                              <small>{option.detail}</small>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section
          className={`sales-command-hero ${salesStrategyTone}`}
          aria-label={copy("Sales strategy readiness", "Satış stratejisi hazırlığı")}
        >
          <div className="sales-command-copy">
            <span>{copy("Strategy readiness", "Strateji hazırlığı")}</span>
            <h2>
              {salesReadinessPercent >= 75
                ? copy("Sales plan is model-ready", "Satış planı modele hazır")
                : copy("Turn channels into a usable forecast", "Kanalları kullanılabilir tahmine çevirin")}
            </h2>
            <p>
              {copy(
                "Connect products, channel quantities, commissions, and campaigns so finance can read a reliable sales signal.",
                "Finansın güvenilir satış sinyali okuyabilmesi için ürünleri, kanal adetlerini, komisyonları ve kampanyaları bağlayın.",
              )}
            </p>
            <div className="sales-readiness-list">
              {salesReadinessItems.map((item) => (
                <button
                  type="button"
                  className={item.done ? "done" : ""}
                  onClick={() => goTo(item.path, "login")}
                  key={item.label}
                >
                  <span>{item.label}</span>
                  <strong>{item.done ? copy("Ready", "Hazır") : copy("Needed", "Gerekli")}</strong>
                </button>
              ))}
            </div>
          </div>
          <div className="sales-forecast-preview">
            <div
              className="sales-mini-chart"
              aria-label={copy("12 month sales forecast preview", "12 aylık satış tahmini önizlemesi")}
            >
              {salesForecastPreview.map((item) => (
                <button
                  type="button"
                  className="sales-mini-bar"
                  style={{ "--bar-height": `${(item.value / maxSalesForecastPreview) * 100}%` }}
                  key={item.label}
                >
                  <i />
                  <small>{item.label}</small>
                  <span className="sales-mini-tooltip" role="tooltip">
                    <strong>{item.label}</strong>
                    <b>
                      {copy("Total sales units", "Toplam satış adedi")}: {formatNumber(item.value)}
                    </b>
                    {item.channels.length ? (
                      item.channels.map((channel) => (
                        <em key={channel.id}>
                          <span>{channel.name}</span>
                          <small>
                            {formatNumber(channel.units)} {copy("units", "adet")}
                          </small>
                        </em>
                      ))
                    ) : (
                      <em>
                        <span>{copy("No channel", "Kanal yok")}</span>
                        <small>
                          {formatNumber(0)} {copy("units", "adet")}
                        </small>
                      </em>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="sales-stat-grid">
          {[
            [
              copy("Monthly channel plan", "Aylık kanal planı"),
              formatNumber(baseMonthlySalesUnits),
              copy("sum of channel quantities", "kanal adetleri toplamı"),
            ],
            [
              copy("12M expected units", "12A beklenen adet"),
              formatNumber(expectedAnnualSalesUnits),
              multiplierPeriod === "quarterly"
                ? copy("channel plan x quarterly multipliers", "kanal planı x çeyreklik çarpanlar")
                : copy("channel plan x monthly multipliers", "kanal planı x aylık çarpanlar"),
            ],
            [
              copy("Ready to sell", "Satmaya hazır"),
              formatNumber(totalReadyUnits),
              copy("remaining after channel quantities", "kanal adetlerinden sonra kalan"),
            ],
            [
              copy("Monthly commission", "Aylık komisyon"),
              formatLira(totalMonthlyCommission),
              copy("based on product prices", "ürün fiyatlarına göre"),
            ],
          ].map(([label, value, detail]) => (
            <article className="sales-stat-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{detail}</small>
            </article>
          ))}
        </div>

        <div className="sales-grid">
          {isSalesOptionalSectionVisible("expectationMultipliers") && (
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
                <div
                  className="sales-period-toggle"
                  aria-label={copy("Expectation multiplier period", "Beklenti çarpanı periyodu")}
                >
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
                    <span>
                      {multiplierPeriod === "quarterly" ? copy("Quarter", "Çeyrek") : copy("Month", "Ay")} {index + 1}
                    </span>
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
          )}

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
              >
                {copy("Add Channel", "Kanal Ekle")}
              </button>
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
                        <small>
                          {[channelProduct.name, channelType ? getSalesTypeLabel(channelType) : ""]
                            .filter(Boolean)
                            .join(" / ") || copy("No product selected", "Ürün seçilmedi")}
                        </small>
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
                        <label>
                          <span>{copy("Channel name", "Kanal adı")} *</span>
                          <input
                            required
                            value={channel.name}
                            onChange={(event) => updateSalesItem("channels", channel.id, "name", event.target.value)}
                          />
                        </label>
                      </div>
                      <label>
                        <span>{copy("Channel type", "Kanal tipi")} *</span>
                        <select
                          required
                          value={channel.typeId || "direct"}
                          onChange={(event) => updateSalesItem("channels", channel.id, "typeId", event.target.value)}
                        >
                          {salesChannelTypeOptions.map((type) => (
                            <option value={type.id} key={type.id}>
                              {getSalesTypeLabel(type)}
                            </option>
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
                              channels: current.channels.map((item) =>
                                item.id === channel.id
                                  ? {
                                      ...item,
                                      product: product || null,
                                      productId: product?.id || "",
                                      productName: product?.name || "",
                                    }
                                  : item,
                              ),
                            }));
                          }}
                        >
                          <option value="">{copy("Select product", "Ürün seç")}</option>
                          {operationsWorkspace.products.map((product) => (
                            <option value={product.id} key={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {salesChannelRequiredFields.map((field) => (
                        <label key={field.field}>
                          <span className="label-with-info">
                            {field.label} *
                            {field.info && (
                              <InfoTip label={`${field.label} ${copy("info", "bilgi")}`} text={field.info} />
                            )}
                          </span>
                          <input
                            max={field.max}
                            min={field.min}
                            required
                            step={field.step}
                            type="number"
                            value={channel[field.field] ?? ""}
                            onChange={(event) =>
                              updateSalesItem("channels", channel.id, field.field, event.target.value)
                            }
                          />
                        </label>
                      ))}
                      {isSalesOptionalSectionVisible("advancedChannelParameters") && (
                        <details
                          className="advanced-channel-panel wide-field"
                          open={channel.advancedOpen ?? false}
                          onToggle={(event) =>
                            updateSalesItem("channels", channel.id, "advancedOpen", event.currentTarget.open)
                          }
                        >
                          <summary>{copy("Advanced Channel Parameters", "Gelişmiş Kanal Parametreleri")}</summary>
                          <div className="advanced-channel-grid">
                            {advancedChannelFields.map((field) => (
                              <label key={field.field}>
                                <span className="label-with-info">
                                  {field.label}
                                  {field.info && (
                                    <InfoTip label={`${field.label} ${copy("info", "bilgi")}`} text={field.info} />
                                  )}
                                </span>
                                <input
                                  min={field.min}
                                  step={field.step}
                                  type="number"
                                  value={channel[field.field] ?? ""}
                                  onChange={(event) =>
                                    updateSalesItem("channels", channel.id, field.field, event.target.value)
                                  }
                                />
                              </label>
                            ))}
                            <div className="seasonality-inputs">
                              <strong>
                                {copy(
                                  "Seasonality Curve (Jan-Dec multipliers):",
                                  "Sezonluk Eğri (Oca-Ara çarpanları):",
                                )}
                              </strong>
                              <div>
                                {seasonalityMonthLabels.map((month, index) => (
                                  <label key={`${channel.id}-season-${month}`}>
                                    <span>{month}</span>
                                    <input
                                      min="0"
                                      step="0.01"
                                      type="number"
                                      value={
                                        (Array.isArray(channel.seasonalityCurve)
                                          ? channel.seasonalityCurve[index]
                                          : "") ?? ""
                                      }
                                      onChange={(event) =>
                                        updateSalesChannelSeasonality(channel.id, index, event.target.value)
                                      }
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        </details>
                      )}
                      {(() => {
                        const product = productMap.get(channel.productId) || channel.product || {};
                        const availability = getProductAvailability(channel.productId);
                        const unit = product.unit || copy("units", "adet");

                        return (
                          <div className="sales-channel-capacity wide-field">
                            <span>
                              {copy("Monthly produced", "Aylık üretilen")}
                              <strong>
                                {formatQuantity(availability.monthlyProduced, unit)} {unit}
                              </strong>
                            </span>
                            <span>
                              {copy("Planned in channels", "Kanallarda planlanan")}
                              <strong>
                                {formatQuantity(availability.plannedSales, unit)} {unit}
                              </strong>
                            </span>
                            <span>
                              {copy("Ready to sell remaining", "Satmaya hazır kalan")}
                              <strong>
                                {formatNumber(Math.max(0, availability.remaining), 2)} {unit}
                              </strong>
                            </span>
                          </div>
                        );
                      })()}
                      {(() => {
                        const selectedType = salesChannelTypeOptions.find(
                          (type) => type.id === (channel.typeId || "direct"),
                        );

                        return selectedType ? (
                          <div className="sales-type-info wide-field">
                            <span>
                              {copy("Avg acquisition", "Ort. müşteri kazanımı")}
                              <strong>{formatNumber(selectedType.averageCustomerAcquisitionRate, 1)}%</strong>
                            </span>
                            <span>
                              {copy("Avg commission", "Ort. komisyon")}
                              <strong>{formatNumber(selectedType.averageCommissionPercent, 1)}%</strong>
                            </span>
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
                <h2>
                  {copy(
                    "Budget, campaign type, duration in days and target channel",
                    "Bütçe, kampanya tipi, gün bazlı süre ve hedef kanal",
                  )}
                </h2>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  addSalesItem("campaigns");
                }}
              >
                {copy("Add Campaign", "Kampanya Ekle")}
              </button>
            </summary>
            {
              <TableToolbar
                tableId="sales-campaigns"
                rows={salesStrategy.campaigns}
                visibleRows={visibleCampaignRows}
              />
            }
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
                      <small className="sort-indicator" aria-hidden="true">
                        {getTableSortIndicator(control, key)}
                      </small>
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
                  <details
                    className="sales-table-row campaign-row campaign-row-layout progressive-input-box sales-campaign-box"
                    key={campaign.id}
                  >
                    <summary className="sales-item-summary progressive-section-summary">
                      <div>
                        <span>{`${copy("Campaign", "Kampanya")} ${index + 1}`}</span>
                        <strong>{campaign.name?.trim() || copy("Unnamed campaign", "Adsız kampanya")}</strong>
                        <small>
                          {[
                            selectedType ? getSalesTypeLabel(selectedType) : "",
                            campaign.channel,
                            formatLira(toFiniteNumber(campaign.budget)),
                          ]
                            .filter(Boolean)
                            .join(" / ")}
                        </small>
                      </div>
                    </summary>
                    <div className="sales-campaign-fields campaign-row-layout">
                      <label>
                        <input
                          value={campaign.name}
                          onChange={(event) => updateSalesItem("campaigns", campaign.id, "name", event.target.value)}
                        />
                      </label>
                      <label>
                        <select
                          value={campaign.typeId || "digital"}
                          onChange={(event) => updateSalesItem("campaigns", campaign.id, "typeId", event.target.value)}
                        >
                          {campaignTypeOptions.map((type) => (
                            <option value={type.id} key={type.id}>
                              {getSalesTypeLabel(type)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <select
                          value={campaign.channel || ""}
                          onChange={(event) => updateSalesItem("campaigns", campaign.id, "channel", event.target.value)}
                        >
                          <option value="">{copy("Select channel", "Kanal seç")}</option>
                          {salesStrategy.channels.map((channel) => (
                            <option value={channel.name || channel.id} key={channel.id}>
                              {channel.name || channel.id}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <input
                          min="0"
                          step="1000"
                          type="number"
                          value={campaign.budget}
                          onChange={(event) => updateSalesItem("campaigns", campaign.id, "budget", event.target.value)}
                        />
                      </label>
                      <label>
                        <input
                          min="0"
                          step="1"
                          type="number"
                          value={campaign.durationDays}
                          onChange={(event) =>
                            updateSalesItem("campaigns", campaign.id, "durationDays", event.target.value)
                          }
                        />
                      </label>
                      {(() => {
                        return selectedType ? (
                          <div className="sales-type-info campaign-type-info">
                            <span>
                              {copy("Avg acquisition", "Ort. müşteri kazanımı")}
                              <strong>{formatNumber(selectedType.averageCustomerAcquisitionRate, 1)}%</strong>
                            </span>
                            <span>
                              {copy("Avg conversion", "Ort. dönüşüm")}
                              <strong>{formatNumber(selectedType.averageConversionRate, 1)}%</strong>
                            </span>
                            <span>
                              {copy("Avg duration", "Ort. süre")}
                              <strong>
                                {formatNumber(selectedType.averageDurationDays, 0)} {copy("days", "gün")}
                              </strong>
                            </span>
                            <small>{getSalesTypeDescription(selectedType)}</small>
                          </div>
                        ) : null;
                      })()}
                      <textarea
                        value={campaign.goal}
                        onChange={(event) => updateSalesItem("campaigns", campaign.id, "goal", event.target.value)}
                      />
                    </div>
                  </details>
                );
              })}
            </div>
          </details>

          {Boolean(visibleSalesReadoutCards.length) && (
            <details className="sales-card sales-decision-card progressive-input-box">
              <summary className="sales-card-heading progressive-section-summary">
                <div>
                  <span>{copy("Strategy readout", "Strateji okuması")}</span>
                  <h2>
                    {copy("Manual inputs translated into decision signals", "Manuel girdilerden karar sinyalleri")}
                  </h2>
                </div>
              </summary>
              <div className="sales-signal-grid">
                {visibleSalesReadoutCards.map((card) => (
                  <span key={card.id}>
                    {card.label}
                    <strong>{card.value}</strong>
                    <small>{card.detail}</small>
                  </span>
                ))}
              </div>
            </details>
          )}
        </div>
      </section>
    </DashboardLayout>
  );
}
