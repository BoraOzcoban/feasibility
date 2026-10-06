import React from "react";
import { InfoTip } from "../components/InfoTip";
import { operationCurrencyOptions } from "../lib/appDefaults";
import { toFiniteNumber } from "../lib/feasibilityModel";
import { formatNumber, formatOperationMoney } from "../lib/format";
import { useAppContext } from "../app/AppContext";

export default function ResourcesPage() {
  const {
    copy,
    copyOperationRecordToForm,
    exchangeRates,
    goTo,
    handleDeleteOperationRecord,
    handleSaveOperationRecord,
    loadOperationsData,
    materialFormRef,
    materialListHeightStyle,
    operationForms,
    operationsLoading,
    operationsStatus,
    operationsWorkspace,
    renderDashboardLayout,
    renderSortableDataTable,
    updateOperationForm,
    workforceFormRef,
    workforceListHeightStyle,
  } = useAppContext();

  const unitOptions = ["kg", "gr", "mg", "adet", "metre", "litre", "ml"];
  const resourceCurrencyCount = new Set([
    ...operationsWorkspace.materials.map((material) => material.price_currency || "TRY"),
    ...operationsWorkspace.workforce.map((workforce) => workforce.hourly_cost_currency || "TRY"),
  ]).size;
  const pricedMaterialCount = operationsWorkspace.materials.filter((material) => toFiniteNumber(material.price_per_unit) > 0).length;
  const materialColumns = [
    { header: copy("Material", "Malzeme"), key: "material", render: (row) => row.name, value: (row) => row.name },
    { header: copy("Group", "Grup"), key: "group", render: (row) => row.material_group || copy("General", "Genel"), value: (row) => row.material_group || copy("General", "Genel") },
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
            <span>{copy("Operations", "Operasyon")} / {copy("Resources", "Kaynak")}</span>
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
                <input required type="text" value={operationForms.material.name} onChange={(event) => updateOperationForm("material", "name", event.target.value)} />
              </label>
              <label>
                <span>{copy("Material group", "Malzeme grubu")}</span>
                <input
                  placeholder={copy("e.g. Beverage", "örn. İçecek")}
                  required
                  type="text"
                  value={operationForms.material.materialGroup}
                  onChange={(event) => updateOperationForm("material", "materialGroup", event.target.value)}
                />
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
              gridTemplateColumns: "1.2fr 0.8fr 0.6fr 0.9fr 0.7fr",
              onRowClick: (material) => copyOperationRecordToForm("material", material),
              onDeleteRow: (row) => handleDeleteOperationRecord("material", row),
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
              onDeleteRow: (row) => handleDeleteOperationRecord("workforce", row),
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
                "Service costs affect feasibility through optional financial expenses. Add them as initial or recurring expense rows so they are included in the model.",
                "Hizmet maliyetleri fizibiliteyi opsiyonel finans giderleri üzerinden etkiler. Modele dahil olması için başlangıç veya tekrarlayan gider satırı olarak ekleyin.",
              )}
            </p>
          </article>
        </div>
        {operationsStatus && <p className="status-message">{operationsStatus}</p>}
      </section>,
  );
}
