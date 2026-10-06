import React from "react";
import { InfoTip } from "../components/InfoTip";
import { operationCurrencyOptions } from "../lib/appDefaults";
import { asObjectArray, toFiniteNumber } from "../lib/feasibilityModel";
import { formatCycleTime, formatNumber, formatOperationMoney, getCycleTimeInputFromMinutes } from "../lib/format";
import { useAppContext } from "../app/AppContext";
import DataTable from "../components/DataTable";
import DashboardLayout from "../components/DashboardLayout";

export default function ProductsPage() {
  const {
    activeOperationsSubmodule,
    addProductMaterialRow,
    addProductProcessRow,
    copy,
    exchangeRates,
    getProductFlowDefaults,
    getProductProcessRows,
    handleDeleteOperationRecord,
    handleSaveOperationRecord,
    loadOperationsData,
    moveProductProcessRow,
    operationForms,
    operationsLoading,
    operationsStatus,
    operationsWorkspace,
    removeProductMaterialRow,
    removeProductProcessRow,
    setOperationForms,
    updateOperationForm,
    updateProductMaterialRow,
    updateProductProcessRow,
    updateProductProcessRowFields,
  } = useAppContext();

  const productMaterialRows = operationForms.product.materialRows || [];
  const productProcessRows = operationForms.product.processRows || [];
  const productsWithRecipe = operationsWorkspace.products.filter(
    (product) => asObjectArray(product.material_rows).length > 0,
  ).length;
  const productsWithProcesses = operationsWorkspace.products.filter(
    (product) => getProductProcessRows(product).length > 0,
  ).length;
  const productRecipeLinkCount = operationsWorkspace.products.reduce(
    (total, product) => total + asObjectArray(product.material_rows).length,
    0,
  );
  const pricedProductCount = operationsWorkspace.products.filter((product) => toFiniteNumber(product.price) > 0).length;
  const productFlowStrategyLabels = {
    pull: copy("Pull system", "Çekme sistemi"),
    push: copy("Push system", "İtme sistemi"),
  };
  const getProductRecipeSummary = (product) =>
    (product.material_rows || [])
      .map(
        (row) =>
          `${[row.material?.material_group, row.material?.name].filter(Boolean).join(" / ") || "-"}: ${formatNumber(row.quantity_per_unit, 4)} ${row.material?.unit || ""}`,
      )
      .join(", ") || "-";
  const getProductProcessSummary = (product) =>
    getProductProcessRows(product)
      .map((row, index) => `${index + 1}. ${row.operationName}`)
      .join(" → ") || "-";
  const getProductFlowSummary = (product) => {
    const flowDefaults = getProductFlowDefaults(product);
    return flowDefaults.flowStrategy === "pull"
      ? `${productFlowStrategyLabels.pull} / ${copy("lot", "lot")} ${formatNumber(flowDefaults.batchSize, 0)} / ${copy("safety", "güvenli")} ${formatNumber(flowDefaults.safetyStockQuantity, 0)}`
      : `${productFlowStrategyLabels.push} / ${copy("no safety stock", "güvenli stok yok")}`;
  };
  const productColumns = [
    { header: copy("Product", "Ürün"), key: "product", render: (row) => row.name, value: (row) => row.name },
    {
      header: copy("Unit", "Birim"),
      key: "unit",
      render: (row) => row.unit || "adet",
      value: (row) => row.unit || "adet",
    },
    {
      header: copy("Price", "Fiyat"),
      key: "price",
      render: (row) => formatOperationMoney(row.price, row.price_currency, exchangeRates, 2),
      sortValue: (row) => toFiniteNumber(row.price),
      filterValue: (row) =>
        `${row.price} ${row.price_currency || "TRY"} ${formatOperationMoney(row.price, row.price_currency, exchangeRates, 2)}`,
    },
    {
      header: copy("Cycle", "Çevrim"),
      key: "cycle",
      render: (row) => formatCycleTime(row.cycle_time_minutes || 1, row.cycle_time_unit || "minute"),
      sortValue: (row) => toFiniteNumber(row.cycle_time_minutes || 1),
    },
    {
      header: copy("Push / Pull defaults", "İtme / Çekme varsayılanı"),
      key: "flow",
      render: getProductFlowSummary,
      value: getProductFlowSummary,
    },
    {
      header: copy("Process order", "Süreç sırası"),
      key: "processes",
      // Count in the cell, the full order on hover; the form shows the detail.
      render: (row) => (
        <span title={getProductProcessSummary(row)}>
          {formatNumber(getProductProcessRows(row).length)} {copy("steps", "süreç")}
        </span>
      ),
      value: getProductProcessSummary,
    },
    {
      header: copy("Materials", "Malzemeler"),
      key: "materials",
      render: (row) => (
        <span title={getProductRecipeSummary(row)}>
          {formatNumber((row.material_rows || []).length)} {copy("materials", "malzeme")}
        </span>
      ),
      value: getProductRecipeSummary,
    },
  ];
  const copyProductToForm = (product) => {
    const flowDefaults = getProductFlowDefaults(product);

    setOperationForms((current) => ({
      ...current,
      product: {
        ...getCycleTimeInputFromMinutes(product.cycle_time_minutes || 1, product.cycle_time_unit || "minute"),
        defaultBatchSize: flowDefaults.batchSize,
        defaultFlowStrategy: flowDefaults.flowStrategy,
        defaultSafetyStockQuantity: flowDefaults.safetyStockQuantity,
        id: product.id,
        materialRows: (product.material_rows || []).map((row) => ({
          materialId: row.material_id,
          quantityPerUnit: row.quantity_per_unit,
        })),
        processRows: getProductProcessRows(product),
        minimumTransferQuantity: flowDefaults.minimumTransferQuantity,
        name: product.name || "",
        price: product.price || 0,
        priceCurrency: product.price_currency || "TRY",
        unit: product.unit || "adet",
      },
    }));
  };

  return (
    <DashboardLayout activePage={`operations/${activeOperationsSubmodule.key}`}>
      <section className="page operations-page operations-products-page">
        <div className="page-header">
          <div>
            <span>
              {copy("Operations", "Operasyon")} / {copy("Products", "Ürünler")}
            </span>
            <h1>{copy("Products", "Ürünler")}</h1>
            <p>
              {copy(
                "Keep the product recipe, unit, price, cycle time, and default Push/Pull rules used in process calculations.",
                "Süreç hesaplamalarında kullanılacak ürün reçetesini, birimini, fiyatını, çevrim süresini ve varsayılan İtme/Çekme kurallarını tutun.",
              )}
            </p>
          </div>
          <div className="button-row">
            <button type="button" onClick={loadOperationsData}>
              {copy("Refresh Data", "Verileri Yenile")}
            </button>
          </div>
        </div>

        <div className="kpi-grid">
          <article className="card kpi">
            <span>{copy("Products", "Ürünler")}</span>
            <strong>{formatNumber(operationsWorkspace.products.length)}</strong>
            <small>
              {copy("priced", "fiyatlı")}: {formatNumber(pricedProductCount)}
            </small>
          </article>
          <article className="card kpi">
            <span>{copy("Recipes", "Reçeteler")}</span>
            <strong>{formatNumber(productsWithRecipe)}</strong>
            <small>
              {formatNumber(productRecipeLinkCount)} {copy("material links", "malzeme bağlantısı")}
            </small>
          </article>
          <article className="card kpi">
            <span>{copy("Process templates", "Süreç şablonları")}</span>
            <strong>{formatNumber(productsWithProcesses)}</strong>
            <small>{copy("products ready for planning", "planlamaya hazır ürün")}</small>
          </article>
        </div>

        <div className="operation-data-grid">
          <form
            className="card operation-data-form operations-product-form-card"
            onSubmit={(event) => handleSaveOperationRecord("product", event)}
          >
            <div className="card-header">
              <div>
                <span>{copy("Product definition", "Ürün tanımı")}</span>
                <h2>{copy("Commercial and production defaults", "Ticari ve üretim varsayılanları")}</h2>
              </div>
            </div>
            <div className="form-grid">
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
                    <option value={unit} key={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label-with-info">
                  {copy("Price", "Fiyat")}
                  <InfoTip
                    label={copy("Product price info", "Ürün fiyatı bilgisi")}
                    text={copy(
                      "Sales revenue uses this product price x sold units, then applies channel discounts, commissions, and collection timing.",
                      "Satış cirosu bu ürün fiyatı x satılan adet ile başlar; sonra kanal indirimi, komisyonu ve tahsilat zamanlaması uygulanır.",
                    )}
                  />
                </span>
                <input
                  min="0"
                  step="any"
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
                    text={copy(
                      "Choose the currency for the sales price. Financial analysis converts USD/EUR product prices to TRY before revenue calculations.",
                      "Satış fiyatının para birimini seçin. Finansal analiz USD/EUR ürün fiyatlarını ciro hesaplarından önce TL'ye çevirir.",
                    )}
                  />
                </span>
                <select
                  value={operationForms.product.priceCurrency}
                  onChange={(event) => updateOperationForm("product", "priceCurrency", event.target.value)}
                >
                  {operationCurrencyOptions.map((currency) => (
                    <option value={currency} key={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label-with-info">
                  {copy("Cycle time", "Çevrim süresi")}
                  <InfoTip
                    label={copy("Cycle time info", "Çevrim süresi bilgisi")}
                    text={copy(
                      "Cycle time defines how long one unit takes. Capacity is roughly available machine minutes divided by cycle time.",
                      "Çevrim süresi bir ürünün ne kadar sürdüğünü belirtir. Kapasite kabaca kullanılabilir makine dakikası / çevrim süresi olarak hesaplanır.",
                    )}
                  />
                </span>
                <div className="cycle-time-control">
                  <input
                    min="0.0001"
                    step="any"
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
                  {copy("Default production system", "Varsayılan üretim sistemi")}
                  <InfoTip
                    label={copy("Default flow strategy info", "Varsayılan akış stratejisi bilgisi")}
                    text={copy(
                      "Pull starts from downstream demand and maintains safety stock. Push starts from the production plan and maintains none.",
                      "Çekme sonraki proses talebiyle başlar ve güvenli stok tutar. İtme üretim planıyla başlar ve güvenli stok tutmaz.",
                    )}
                  />
                </span>
                <select
                  value={operationForms.product.defaultFlowStrategy}
                  onChange={(event) => updateOperationForm("product", "defaultFlowStrategy", event.target.value)}
                >
                  <option value="pull">{productFlowStrategyLabels.pull}</option>
                  <option value="push">{productFlowStrategyLabels.push}</option>
                </select>
              </label>
              <label>
                <span className="label-with-info">
                  {copy("Default Pull replenishment lot", "Varsayılan Çekme ikmal lotu")}
                  <InfoTip
                    label={copy("Default batch size info", "Varsayılan batch boyutu bilgisi")}
                    text={copy(
                      "The normal replenishment lot triggered by downstream demand in Pull mode.",
                      "Çekme modunda sonraki proses talebiyle tetiklenen normal ikmal lotudur.",
                    )}
                  />
                </span>
                <input
                  min="1"
                  step="any"
                  disabled={operationForms.product.defaultFlowStrategy === "push"}
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
                    text={copy(
                      "Smallest accepted quantity that can move to the next operation for this product.",
                      "Bu ürün için sonraki operasyona aktarılabilecek kabul edilen en küçük miktar.",
                    )}
                  />
                </span>
                <input
                  min="1"
                  step="any"
                  disabled={operationForms.product.defaultFlowStrategy === "push"}
                  type="number"
                  value={operationForms.product.minimumTransferQuantity}
                  onChange={(event) => updateOperationForm("product", "minimumTransferQuantity", event.target.value)}
                />
              </label>
              <label>
                <span className="label-with-info">
                  {copy("Minimum Pull safety stock", "Minimum Çekme güvenli stoku")}
                  <InfoTip
                    label={copy("Default safety stock info", "Varsayılan güvenli stok bilgisi")}
                    text={copy(
                      "The minimum intermediate stock to reserve in Pull. The scheduler automatically raises it when needed to eliminate material starvation.",
                      "Çekme sisteminde ayrılacak minimum ara stoktur. Planlayıcı malzeme beklemesini sıfırlamak için gerektiğinde otomatik yükseltir.",
                    )}
                  />
                </span>
                <input
                  disabled={operationForms.product.defaultFlowStrategy === "push"}
                  min="0"
                  step="any"
                  type="number"
                  value={
                    operationForms.product.defaultFlowStrategy === "push"
                      ? 0
                      : operationForms.product.defaultSafetyStockQuantity
                  }
                  onChange={(event) => updateOperationForm("product", "defaultSafetyStockQuantity", event.target.value)}
                />
              </label>
            </div>

            <div className="resource-section">
              <div className="resource-section-header">
                <div>
                  <span>{copy("Required materials", "Gerekli malzemeler")}</span>
                  <p>
                    {copy(
                      "Enter the materials and quantities required to produce one product unit.",
                      "Bir ürün birimi üretmek için gereken malzemeleri ve miktarları girin.",
                    )}
                  </p>
                </div>
                <button type="button" onClick={addProductMaterialRow}>
                  {copy("Add Material", "Malzeme Ekle")}
                </button>
              </div>
              <div className="resource-row-list">
                {productMaterialRows.length ? (
                  productMaterialRows.map((row, index) => {
                    const selectedMaterial = operationsWorkspace.materials.find(
                      (material) => material.id === row.materialId,
                    );

                    return (
                      <div className="resource-row-grid material-plan-row" key={`product-material-${index}`}>
                        <label>
                          <span>{copy("Material", "Malzeme")}</span>
                          <select
                            value={row.materialId || ""}
                            onChange={(event) => updateProductMaterialRow(index, "materialId", event.target.value)}
                          >
                            <option value="">{copy("Select material", "Malzeme seç")}</option>
                            {operationsWorkspace.materials.map((material) => (
                              <option value={material.id} key={material.id}>
                                {material.material_group
                                  ? `${material.material_group} / ${material.name}`
                                  : material.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>{copy("Quantity per unit", "Birim başına miktar")}</span>
                          <input
                            min="0"
                            step="any"
                            type="number"
                            value={row.quantityPerUnit ?? ""}
                            onChange={(event) => updateProductMaterialRow(index, "quantityPerUnit", event.target.value)}
                          />
                        </label>
                        <div className="resource-row-meta">
                          <strong>{selectedMaterial?.unit || "-"}</strong>
                          <small>
                            {selectedMaterial
                              ? `${selectedMaterial.material_group || copy("General", "Genel")} · ${formatOperationMoney(selectedMaterial.price_per_unit, selectedMaterial.price_currency, exchangeRates, 2)} / ${selectedMaterial.unit}`
                              : copy("No record selected", "Kayıt seçilmedi")}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="resource-remove-button"
                          onClick={() => removeProductMaterialRow(index)}
                        >
                          {copy("Delete", "Sil")}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <p className="planner-empty-state">
                    {copy(
                      "No recipe materials yet. Add materials on Material Definitions first, then connect them to the product here.",
                      "Henüz reçete malzemesi yok. Önce Malzeme Tanımları ekranında malzeme ekleyin, sonra buradan ürüne bağlayın.",
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="resource-section product-process-template-section">
              <div className="resource-section-header">
                <div>
                  <span>{copy("Ordered process template", "Sıralı süreç şablonu")}</span>
                  <p>
                    {copy(
                      "Define every process and its order here. Process Definition will use this template without allowing changes.",
                      "Tüm süreçleri ve sıralarını burada tanımlayın. Süreç Tanımlama bu şablonu değişikliğe izin vermeden kullanır.",
                    )}
                  </p>
                </div>
                <button type="button" onClick={addProductProcessRow}>
                  {copy("Add Process", "Süreç Ekle")}
                </button>
              </div>

              <div className="process-step-list">
                {productProcessRows.length ? (
                  productProcessRows.map((row, index) => {
                    const recipeMaterial = productMaterialRows.find(
                      (materialRow) => materialRow.materialId === row.materialId,
                    );
                    const selectedMaterial = operationsWorkspace.materials.find(
                      (material) => material.id === row.materialId,
                    );

                    return (
                      <article className="process-step-card" key={`product-process-${index}`}>
                        <div className="process-step-card-header">
                          <div className="process-step-index">{formatNumber(index + 1, 0)}</div>
                          <div>
                            <span>{copy("Process order", "Süreç sırası")}</span>
                            <strong>{row.operationName || `${copy("Process", "Süreç")} ${index + 1}`}</strong>
                            <small>{copy("Saved as part of the product", "Ürünün parçası olarak kaydedilir")}</small>
                          </div>
                          <div className="resource-row-actions">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveProductProcessRow(index, -1)}
                              aria-label={copy("Move process up", "Süreci yukarı taşı")}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={index === productProcessRows.length - 1}
                              onClick={() => moveProductProcessRow(index, 1)}
                              aria-label={copy("Move process down", "Süreci aşağı taşı")}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="resource-remove-button"
                              onClick={() => removeProductProcessRow(index)}
                            >
                              {copy("Delete", "Sil")}
                            </button>
                          </div>
                        </div>

                        <div className="process-step-grid">
                          <label>
                            <span>{copy("Process name", "Süreç adı")}</span>
                            <input
                              type="text"
                              value={row.operationName || ""}
                              onChange={(event) => updateProductProcessRow(index, "operationName", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>{copy("Machine", "Makine")}</span>
                            <select
                              value={row.machineId || ""}
                              onChange={(event) => updateProductProcessRow(index, "machineId", event.target.value)}
                            >
                              <option value="">{copy("Select machine", "Makine seç")}</option>
                              {operationsWorkspace.machines.map((machine) => (
                                <option value={machine.id} key={machine.id}>
                                  {machine.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>{copy("Min / unit", "Dk / birim")}</span>
                            <input
                              min="0.0001"
                              step="any"
                              type="number"
                              value={row.processTimeMinutes ?? ""}
                              onChange={(event) =>
                                updateProductProcessRow(index, "processTimeMinutes", event.target.value)
                              }
                            />
                          </label>
                          <label>
                            <span>{copy("Machine hours", "Makine saati")}</span>
                            <input
                              min="0"
                              step="any"
                              type="number"
                              value={row.dailyHours ?? ""}
                              onChange={(event) => updateProductProcessRow(index, "dailyHours", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>{copy("Recipe material", "Reçete malzemesi")}</span>
                            <select
                              value={row.materialId || ""}
                              onChange={(event) => {
                                const materialRow = productMaterialRows.find(
                                  (item) => item.materialId === event.target.value,
                                );
                                updateProductProcessRowFields(index, {
                                  materialId: event.target.value,
                                  materialQuantityPerUnit: materialRow?.quantityPerUnit ?? 0,
                                });
                              }}
                            >
                              <option value="">{copy("Optional", "Opsiyonel")}</option>
                              {productMaterialRows.map((materialRow, materialIndex) => {
                                const material = operationsWorkspace.materials.find(
                                  (item) => item.id === materialRow.materialId,
                                );
                                const materialLabel = material
                                  ? [material.material_group, material.name].filter(Boolean).join(" / ")
                                  : copy("Unnamed material", "İsimsiz malzeme");
                                return (
                                  <option
                                    value={materialRow.materialId}
                                    key={materialRow.materialId || `recipe-material-${materialIndex}`}
                                  >
                                    {materialLabel}
                                  </option>
                                );
                              })}
                            </select>
                          </label>
                          <label>
                            <span>{copy("Recipe qty", "Reçete miktarı")}</span>
                            <input
                              min="0"
                              step="any"
                              type="number"
                              value={row.materialQuantityPerUnit ?? recipeMaterial?.quantityPerUnit ?? ""}
                              onChange={(event) =>
                                updateProductProcessRow(index, "materialQuantityPerUnit", event.target.value)
                              }
                            />
                            <small>{selectedMaterial?.unit || ""}</small>
                          </label>
                          <label>
                            <span>{copy("Equipment", "Ekipman")}</span>
                            <select
                              value={row.equipmentId || ""}
                              onChange={(event) => updateProductProcessRow(index, "equipmentId", event.target.value)}
                            >
                              <option value="">{copy("Optional", "Opsiyonel")}</option>
                              {operationsWorkspace.equipment.map((equipment) => (
                                <option value={equipment.id} key={equipment.id}>
                                  {equipment.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>{copy("Crew role", "Ekip rolü")}</span>
                            <select
                              value={row.workforceId || ""}
                              onChange={(event) => updateProductProcessRow(index, "workforceId", event.target.value)}
                            >
                              <option value="">{copy("Optional", "Opsiyonel")}</option>
                              {operationsWorkspace.workforce.map((workforce) => (
                                <option value={workforce.id} key={workforce.id}>
                                  {workforce.role_name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>{copy("People", "Kişi")}</span>
                            <input
                              min="0"
                              step="any"
                              type="number"
                              value={row.peopleAssigned ?? ""}
                              onChange={(event) => updateProductProcessRow(index, "peopleAssigned", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>{copy("Crew hours", "Ekip saati")}</span>
                            <input
                              min="0"
                              step="any"
                              type="number"
                              value={row.workforceDailyHours ?? ""}
                              onChange={(event) =>
                                updateProductProcessRow(index, "workforceDailyHours", event.target.value)
                              }
                            />
                          </label>
                          <label>
                            <span>{copy("Capacity", "Kapasite")}</span>
                            <input
                              min="1"
                              step="any"
                              type="number"
                              value={row.capacity ?? ""}
                              onChange={(event) => updateProductProcessRow(index, "capacity", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>{copy("Setup min", "Setup dk")}</span>
                            <input
                              min="0"
                              step="any"
                              type="number"
                              value={row.setupMinutes ?? ""}
                              onChange={(event) => updateProductProcessRow(index, "setupMinutes", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>{copy("Speed", "Hız")}</span>
                            <input
                              min="0.0001"
                              step="any"
                              type="number"
                              value={row.speedMultiplier ?? ""}
                              onChange={(event) =>
                                updateProductProcessRow(index, "speedMultiplier", event.target.value)
                              }
                            />
                          </label>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <p className="planner-empty-state">
                    {copy(
                      "No process template yet. Add the first process; products cannot be saved without one.",
                      "Henüz süreç şablonu yok. İlk süreci ekleyin; ürün en az bir süreç olmadan kaydedilemez.",
                    )}
                  </p>
                )}
              </div>
            </div>

            <button className="primary" disabled={operationsLoading} type="submit">
              {operationsLoading ? copy("Saving...", "Kaydediliyor...") : copy("Save", "Kaydet")}
            </button>
          </form>

          <article className="card operation-data-table-card operations-product-list-card">
            <div className="card-header">
              <h2>{copy("Records", "Kayıtlar")}</h2>
              <span>
                {operationsWorkspace.products.length} {copy("records", "kayıt")}
              </span>
            </div>
            <DataTable
              columns={productColumns}
              onRowClick={copyProductToForm}
              onDeleteRow={(row) => handleDeleteOperationRecord("product", row)}
              rows={operationsWorkspace.products}
            />
          </article>
        </div>
        {operationsStatus && <p className="status-message">{operationsStatus}</p>}
      </section>
    </DashboardLayout>
  );
}
