import React from "react";
import { InfoTip } from "./InfoTip";
import { buildWorkforceRowsFromOperationRows } from "../lib/appDefaults";
import { asObjectArray, calculatePlanDailyCost, toFiniteNumber } from "../lib/feasibilityModel";
import {
  formatCycleTime,
  formatLira,
  formatMinutesDuration,
  formatNumber,
  formatOperationMoney,
  formatQuantity,
} from "../lib/format";
import { calculateCurrentPlanResult } from "../lib/operationsCalculations";
import { useAppContext } from "../app/AppContext";
import SimpleSortableGrid from "./SimpleSortableGrid";

export default function OperationPlanner() {
  const {
    buildProductOperationRows,
    copy,
    exchangeRates,
    financialSettingsForm,
    getProductFlowDefaults,
    getProductProcessRows,
    getRecipeMaterialId,
    handleSaveOperationPlan,
    normalizeFlowStrategy,
    operationPlan,
    operationPlanResult,
    operationsLoading,
    operationsStatus,
    operationsWorkspace,
    operationsWorkspaceForFinance,
    processDefinitionOpen,
    setOperationPlan,
    setOperationPlanResult,
    setOperationsStatus,
    setProcessDefinitionOpen,
    updateOperationPlan,
    updateOperationPlanRow,
    updateOperationPlanRowFields,
  } = useAppContext();

  const result = operationPlanResult
    ? calculateCurrentPlanResult({ input: operationPlan, result: operationPlanResult }, operationsWorkspaceForFinance, {
        optimize: false,
      })
    : null;
  const latestProcess = asObjectArray(operationsWorkspace.activePlans)[0] || operationsWorkspace.latestPlan;
  const latestProcessName = latestProcess?.plan_name || latestProcess?.input?.planName || result?.planName || "";
  const operationRows = asObjectArray(operationPlan.operationRows);
  const workforceRows = asObjectArray(operationPlan.workforceRows);
  const selectedProduct = operationsWorkspace.products.find((product) => product.id === operationPlan.productId);
  const selectedProductFlowDefaults = getProductFlowDefaults(selectedProduct);
  const selectedProductMaterials = asObjectArray(selectedProduct?.material_rows);
  const planDailyCost = result
    ? calculatePlanDailyCost(result, operationsWorkspaceForFinance, financialSettingsForm)
    : null;
  const flowStrategyLabels = {
    batch: copy("Push system", "İtme sistemi"),
    flow: copy("Pull system", "Çekme sistemi"),
    parallel: copy("Pull system", "Çekme sistemi"),
    pull: copy("Pull system", "Çekme sistemi"),
    push: copy("Push system", "İtme sistemi"),
  };
  const infoLabel = (label, info) => (
    <span className="label-with-info">
      {label}
      <InfoTip label={`${label} ${copy("info", "bilgi")}`} text={info} />
    </span>
  );
  const resultSummaryColumns = [
    { header: copy("Category", "Kategori"), key: "category", render: (row) => row.group, value: (row) => row.group },
    {
      header: copy("Metric", "Metrik"),
      key: "metric",
      render: (row) => (row.info ? infoLabel(row.label, row.info) : row.label),
      value: (row) => row.label,
    },
    { header: copy("Value", "Değer"), key: "value", render: (row) => row.value, value: (row) => row.value },
  ];
  const resultTableRows = result
    ? [
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
          value: `${formatQuantity(result.producedQuantity, result.productUnit)} ${result.productUnit || copy("pcs", "adet")}`,
        },
        {
          id: "strategy",
          group: copy("Plan", "Plan"),
          label: copy("Strategy", "Strateji"),
          value: flowStrategyLabels[result.flowStrategy] || result.flowStrategy || "-",
          info: copy(
            "Pull responds to customer or downstream demand and automatically protects the line with safety stock. Push produces from the plan or forecast and uses no safety stock.",
            "Çekme müşteri veya sonraki proses talebine yanıt verir ve hattı otomatik güvenli stokla korur. İtme plan veya tahmine göre üretir ve güvenli stok kullanmaz.",
          ),
        },
        {
          id: "transfer-batch",
          group: copy("Plan", "Plan"),
          label: copy("Transfer Batch", "Transfer batch"),
          value: result.transferBatchSize ? formatQuantity(result.transferBatchSize, result.productUnit) : "-",
          info: copy(
            "In Pull, this is the replenishment lot moved by downstream demand. In Push, the planned production quantity is sent forward as one lot.",
            "Çekme sisteminde sonraki proses talebiyle ikmal edilen transfer lotudur. İtme sisteminde planlanan üretim miktarı tek lot olarak ileri gönderilir.",
          ),
        },
        {
          id: "recommended-batch",
          group: copy("Plan", "Plan"),
          label: copy("Best batch size", "En iyi batch"),
          value: result.optimization?.recommendedBatchSize
            ? formatQuantity(result.optimization.recommendedBatchSize, result.productUnit)
            : "-",
          info: copy(
            "Recommended transfer batch size from the optimizer, based on total time plus waiting, inventory, delay, and capacity-loss costs.",
            "Toplam süre, bekleme, stok, gecikme ve kapasite kaybı maliyetlerine göre optimizasyonun önerdiği transfer batch boyutudur.",
          ),
        },
        {
          id: "safety-stock",
          group: copy("Production system", "Üretim sistemi"),
          label: copy("Safety Stock", "Güvenli stok"),
          value: result.safetyStockEnabled
            ? `${formatQuantity(result.safetyStockQuantity, result.productUnit)} ${copy("max / buffer", "maks / buffer")} · ${formatQuantity(result.totalSafetyStockQuantity, result.productUnit)} ${copy("total", "toplam")} ${result.productUnit || copy("pcs", "adet")}`
            : copy("Not used", "Kullanılmaz"),
          info: copy(
            "Pull automatically calculates at least enough intermediate safety stock to prevent downstream material starvation. Push always keeps this at zero.",
            "Çekme sistemi sonraki prosesin malzemesiz kalmasını önleyecek en düşük ara güvenli stoku otomatik hesaplar. İtme sisteminde bu değer her zaman sıfırdır.",
          ),
        },
        {
          id: "stockout-wait",
          group: copy("Production system", "Üretim sistemi"),
          label: copy("Material starvation wait", "Stok bekleme süresi"),
          value: `${formatNumber(result.stockoutWaitTimeHours, 2)} ${copy("hours", "saat")}`,
          info: copy(
            "Time a station cannot run because input stock has not arrived. Pull safety stock keeps this at zero; Push can show waiting.",
            "Girdi stoku gelmediği için istasyonun çalışamadığı süredir. Çekme güvenli stoku bunu sıfırda tutar; İtme sisteminde bekleme oluşabilir.",
          ),
        },
        {
          id: "production-time",
          group: copy("Production system", "Üretim sistemi"),
          label: copy("Production Time", "Toplam üretim süresi"),
          value: result.totalProductionTimeMinutes ? formatMinutesDuration(result.totalProductionTimeMinutes) : "-",
          info: copy(
            "The simulated time from the first operation start until the last batch finishes the final operation.",
            "İlk operasyonun başlamasından son batch'in son operasyonu bitirmesine kadar simüle edilen süredir.",
          ),
        },
        {
          id: "cycle-time",
          group: copy("Production system", "Üretim sistemi"),
          label: copy("Cycle Time", "Çevrim Süresi"),
          value: formatCycleTime(result.cycleTimeMinutes, selectedProduct?.cycle_time_unit || "minute"),
        },
        {
          id: "effective-cycle",
          group: copy("Production system", "Üretim sistemi"),
          label: copy("Effective Cycle", "Efektif çevrim"),
          value: result.effectiveCycleTimeMinutes ? formatMinutesDuration(result.effectiveCycleTimeMinutes) : "-",
          info: copy(
            "Average elapsed production time per finished unit after flow, waiting, setup, and bottlenecks are included.",
            "Akış, bekleme, setup ve darboğazlar dahil edildikten sonra biten ürün başına ortalama geçen üretim süresidir.",
          ),
        },
        {
          id: "bottleneck",
          group: copy("Production system", "Üretim sistemi"),
          label: copy("Bottleneck", "Darboğaz"),
          value: result.bottleneck?.operationName || "-",
          info: copy(
            "The operation with the highest total busy time. It limits the line and is usually the first place to improve capacity.",
            "Toplam meşgul süresi en yüksek operasyondur. Hattı sınırlar ve kapasite iyileştirmesinde genellikle ilk bakılacak yerdir.",
          ),
        },
        {
          id: "max-wip",
          group: copy("Production system", "Üretim sistemi"),
          label: copy("Max WIP", "Maks WIP"),
          value: formatQuantity(result.maxWipQuantity, result.productUnit),
          info: copy(
            "Maximum intermediate inventory in a process buffer, including Pull safety stock. Push has no starting safety stock.",
            "Proses tamponundaki, Çekme güvenli stoku dahil maksimum ara stoktur. İtme sisteminde başlangıç güvenli stoku yoktur.",
          ),
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
          info: copy(
            "Machine time that remains unused while the simulated line is constrained by another operation or demand timing.",
            "Simüle edilen hat başka bir operasyon veya talep zamanlaması tarafından sınırlandığında kullanılmadan kalan makine süresidir.",
          ),
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
          label: copy("Material / Unit", "Malzeme / Birim"),
          value: planDailyCost ? formatLira(planDailyCost.unit.material, 2) : "-",
        },
        {
          id: "workforce-cost",
          group: copy("Cost", "Maliyet"),
          label: copy("Labor / Unit", "İşçilik / Birim"),
          value: planDailyCost ? formatLira(planDailyCost.unit.labor, 2) : "-",
        },
        {
          id: "daily-cost",
          group: copy("Cost", "Maliyet"),
          label: copy("Daily Production Cost", "Günlük Üretim Maliyeti"),
          value: planDailyCost ? formatLira(planDailyCost.daily.total) : "-",
          info: copy(
            "Recipe materials, workforce hours and machine energy priced with the current records and the electricity price from financial inputs.",
            "Reçete malzemeleri, işgücü saatleri ve makine enerjisi; güncel kayıtlar ve finans girdilerindeki elektrik fiyatıyla hesaplanır.",
          ),
        },
        {
          id: "waiting-cost",
          group: copy("Cost", "Maliyet"),
          label: copy("Waiting Cost", "Bekleme maliyeti"),
          value: formatLira(result.waitingCost),
          info: copy(
            "Cost of machine queue time plus material-starvation waiting. Pull safety stock removes the starvation part; Push can incur it.",
            "Makine kuyruğu ile stok yetersizliği beklemesinin maliyetidir. Çekme güvenli stoku stok beklemesi kısmını kaldırır; İtme sisteminde bu maliyet oluşabilir.",
          ),
        },
        {
          id: "inventory-cost",
          group: copy("Cost", "Maliyet"),
          label: copy("Inventory Cost", "Stok maliyeti"),
          value: formatLira(result.inventoryCost),
          info: copy(
            "Cost generated by WIP held in buffers. It uses unit-hours, so both quantity and time in buffer matter.",
            "Buffer'da tutulan WIP nedeniyle oluşan maliyettir. Birim-saat mantığıyla çalışır; yani hem miktar hem de buffer'da kalma süresi önemlidir.",
          ),
        },
        {
          id: "delay-capacity",
          group: copy("Cost", "Maliyet"),
          label: copy("Delay / Capacity Loss", "Gecikme / kapasite kaybı"),
          value: formatLira(toFiniteNumber(result.delayCost) + toFiniteNumber(result.capacityLossCost)),
          info: copy(
            "Combined penalty for exceeding available production time and leaving machine capacity idle because of line imbalance.",
            "Kullanılabilir üretim süresini aşma ve hat dengesizliği yüzünden makine kapasitesinin boş kalması için birleşik cezadır.",
          ),
        },
        {
          id: "objective-score",
          group: copy("Cost", "Maliyet"),
          label: copy("Objective Score", "Amaç skoru"),
          value: formatNumber(result.objectiveScore, 2),
          info: copy(
            "Optimizer score: total production minutes plus waiting, inventory, delay, and capacity-loss costs. Lower is better.",
            "Optimizasyon skoru: toplam üretim dakikası ile bekleme, stok, gecikme ve kapasite kaybı maliyetlerinin toplamı. Düşük olması daha iyidir.",
          ),
        },
      ]
    : [];

  const processWorkforceRows = buildWorkforceRowsFromOperationRows(operationRows);
  const activeWorkforceRows = processWorkforceRows.length ? processWorkforceRows : workforceRows;
  const showProcessSteps = Boolean(processDefinitionOpen && selectedProduct);
  const hasProductProcessTemplate = getProductProcessRows(selectedProduct).length > 0;
  const recipeHasPositiveQuantity = selectedProductMaterials.some(
    (row) => toFiniteNumber(row.quantity_per_unit ?? row.quantityPerUnit) > 0,
  );
  const selectedProductRecipeLabel = selectedProductMaterials.length
    ? `${formatNumber(selectedProductMaterials.length)} ${copy("materials", "malzeme")}`
    : copy("No recipe", "Reçete yok");
  const getSelectedRecipeMaterial = (materialId) =>
    selectedProductMaterials.find((row) => getRecipeMaterialId(row) === materialId);
  const handleProcessProductChange = (productId) => {
    const product = operationsWorkspace.products.find((item) => item.id === productId);

    setProcessDefinitionOpen(false);
    setOperationPlan((current) => ({
      ...current,
      ...getProductFlowDefaults(product),
      operationRows: buildProductOperationRows(product),
      productId: product?.id || "",
      productName: product?.name || "",
    }));
    setOperationPlanResult(null);
  };
  const handleOpenProcessSteps = () => {
    if (!selectedProduct) return;
    if (!hasProductProcessTemplate) {
      setOperationsStatus(
        copy(
          "This product has no process template. Define its ordered processes on the Products screen first.",
          "Bu ürünün süreç şablonu yok. Önce Ürünler ekranında sıralı süreçlerini tanımlayın.",
        ),
      );
      setProcessDefinitionOpen(false);
      return;
    }

    setOperationPlan((current) => ({
      ...current,
      operationRows: buildProductOperationRows(selectedProduct),
      productName: selectedProduct.name || "",
    }));
    setProcessDefinitionOpen(true);
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
              <select
                value={operationPlan.productId || ""}
                onChange={(event) => handleProcessProductChange(event.target.value)}
              >
                <option value="">{copy("Select product", "Ürün seç")}</option>
                {operationsWorkspace.products.map((product) => (
                  <option value={product.id} key={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="process-open-button"
              disabled={!selectedProduct || !hasProductProcessTemplate}
              onClick={handleOpenProcessSteps}
            >
              {showProcessSteps
                ? copy("Refresh defined processes", "Tanımlı süreçleri yenile")
                : copy("View defined processes", "Tanımlı süreçleri görüntüle")}
            </button>
          </div>
          {selectedProduct && (
            <div
              className="process-product-selected"
              aria-label={copy("Selected product summary", "Seçili ürün özeti")}
            >
              <span>
                {copy("Unit price", "Birim fiyat")}
                <strong>
                  {formatOperationMoney(selectedProduct.price, selectedProduct.price_currency, exchangeRates, 2)}
                </strong>
              </span>
              <span>
                {copy("Recipe", "Reçete")}
                <strong>{selectedProductRecipeLabel}</strong>
              </span>
              <span>
                {copy("Default system", "Varsayılan sistem")}
                <strong>{flowStrategyLabels[selectedProductFlowDefaults.flowStrategy]}</strong>
              </span>
            </div>
          )}
          {selectedProduct && !hasProductProcessTemplate && (
            <p className="planner-empty-state process-recipe-warning">
              {copy(
                "Define and save this product's ordered processes on the Products screen before process planning.",
                "Süreç planlamadan önce Ürünler ekranında bu ürünün sıralı süreçlerini tanımlayıp kaydedin.",
              )}
            </p>
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
                <span>
                  {operationPlan.flowStrategy === "push"
                    ? copy("Planned production quantity", "Planlanan üretim adedi")
                    : copy("Customer / downstream demand", "Müşteri / sonraki proses talebi")}
                </span>
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
                {copy(
                  "This product needs a positive saved recipe before calculation.",
                  "Hesaplama için bu ürünün pozitif miktarlı kayıtlı reçetesi olmalı.",
                )}
              </p>
            )}

            <section className="process-step-workspace" aria-label={copy("Process steps", "Süreç adımları")}>
              <div className="process-step-toolbar">
                <div>
                  <span>{copy("Required processes", "Gerekli süreçler")}</span>
                  <strong>
                    {formatNumber(operationRows.length)} {copy("process boxes", "süreç kutusu")}
                  </strong>
                </div>
                <small>{copy("Locked to the product template", "Ürün şablonuna bağlı ve kilitli")}</small>
              </div>

              <fieldset className="process-step-list process-step-list-locked" disabled>
                {operationRows.length ? (
                  operationRows.map((row, index) => {
                    const selectedMachine = operationsWorkspace.machines.find(
                      (machine) => machine.id === row.machineId,
                    );
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
                          <small>{copy("Defined on Products", "Ürünler ekranında tanımlandı")}</small>
                        </div>

                        <div className="process-step-grid">
                          <label>
                            <span>{copy("Process name", "Süreç adı")}</span>
                            <input
                              type="text"
                              value={row.operationName || ""}
                              onChange={(event) =>
                                updateOperationPlanRow("operationRows", index, "operationName", event.target.value)
                              }
                            />
                          </label>
                          <label>
                            <span>{copy("Machine", "Makine")}</span>
                            <select
                              value={row.machineId || ""}
                              onChange={(event) =>
                                updateOperationPlanRow("operationRows", index, "machineId", event.target.value)
                              }
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
                              step="0.01"
                              type="number"
                              value={row.processTimeMinutes ?? ""}
                              onChange={(event) =>
                                updateOperationPlanRow("operationRows", index, "processTimeMinutes", event.target.value)
                              }
                            />
                          </label>
                          <label>
                            <span>{copy("Machine hours", "Makine saati")}</span>
                            <input
                              min="0"
                              step="0.25"
                              type="number"
                              value={row.dailyHours ?? ""}
                              onChange={(event) =>
                                updateOperationPlanRow("operationRows", index, "dailyHours", event.target.value)
                              }
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
                                  materialQuantityPerUnit:
                                    materialRow?.quantity_per_unit ??
                                    materialRow?.quantityPerUnit ??
                                    row.materialQuantityPerUnit ??
                                    "",
                                });
                              }}
                            >
                              <option value="">{copy("Select material", "Malzeme seç")}</option>
                              {selectedProductMaterials.map((materialRow, materialIndex) => {
                                const materialId = getRecipeMaterialId(materialRow);
                                return (
                                  <option value={materialId} key={materialId || `material-${materialIndex}`}>
                                    {materialRow.material?.name ||
                                      materialRow.name ||
                                      `${copy("Material", "Malzeme")} ${materialIndex + 1}`}
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
                              onChange={(event) =>
                                updateOperationPlanRow(
                                  "operationRows",
                                  index,
                                  "materialQuantityPerUnit",
                                  event.target.value,
                                )
                              }
                            />
                            <small>{selectedMaterial?.material?.unit || selectedMaterial?.unit || ""}</small>
                          </label>
                          <label>
                            <span>{copy("Equipment", "Ekipman")}</span>
                            <select
                              value={row.equipmentId || ""}
                              onChange={(event) =>
                                updateOperationPlanRow("operationRows", index, "equipmentId", event.target.value)
                              }
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
                              onChange={(event) =>
                                updateOperationPlanRow("operationRows", index, "workforceId", event.target.value)
                              }
                            >
                              <option value="">{copy("Select role", "Rol seç")}</option>
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
                              step="1"
                              type="number"
                              value={row.peopleAssigned ?? ""}
                              onChange={(event) =>
                                updateOperationPlanRow("operationRows", index, "peopleAssigned", event.target.value)
                              }
                            />
                          </label>
                          <label>
                            <span>{copy("Crew hours", "Ekip saati")}</span>
                            <input
                              min="0"
                              step="0.25"
                              type="number"
                              value={row.workforceDailyHours ?? ""}
                              onChange={(event) =>
                                updateOperationPlanRow(
                                  "operationRows",
                                  index,
                                  "workforceDailyHours",
                                  event.target.value,
                                )
                              }
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
                                onChange={(event) =>
                                  updateOperationPlanRow("operationRows", index, "capacity", event.target.value)
                                }
                              />
                            </label>
                            <label>
                              <span>{copy("Setup min", "Setup dk")}</span>
                              <input
                                min="0"
                                step="0.1"
                                type="number"
                                value={row.setupMinutes ?? ""}
                                onChange={(event) =>
                                  updateOperationPlanRow("operationRows", index, "setupMinutes", event.target.value)
                                }
                              />
                            </label>
                            <label>
                              <span>{copy("Speed", "Hız")}</span>
                              <input
                                min="0.0001"
                                step="0.01"
                                type="number"
                                value={row.speedMultiplier ?? ""}
                                onChange={(event) =>
                                  updateOperationPlanRow("operationRows", index, "speedMultiplier", event.target.value)
                                }
                              />
                            </label>
                          </div>
                        </details>
                      </article>
                    );
                  })
                ) : (
                  <p className="planner-empty-state">
                    {copy("This product has no saved process template.", "Bu ürünün kayıtlı süreç şablonu yok.")}
                  </p>
                )}
              </fieldset>
            </section>

            <details className="process-advanced-options process-accordion">
              <summary className="process-accordion-summary">
                <div>
                  <span>{copy("Push / Pull and optimization", "İtme / Çekme ve optimizasyon")}</span>
                  <p>
                    {copy(
                      "Demand logic, replenishment lot, safety stock, buffer, and optional cost weights.",
                      "Talep mantığı, ikmal lotu, güvenli stok, buffer ve opsiyonel maliyet ağırlıkları.",
                    )}
                  </p>
                </div>
                <small>{flowStrategyLabels[operationPlan.flowStrategy] || flowStrategyLabels.pull}</small>
              </summary>
              <div className="process-accordion-body">
                <div className="planner-fields compact-planner-fields process-compact-options">
                  <label>
                    <span>{copy("Production system", "Üretim sistemi")}</span>
                    <div>
                      <select
                        value={normalizeFlowStrategy(operationPlan.flowStrategy)}
                        onChange={(event) => updateOperationPlan("flowStrategy", event.target.value)}
                      >
                        <option value="pull">{flowStrategyLabels.pull}</option>
                        <option value="push">{flowStrategyLabels.push}</option>
                      </select>
                    </div>
                    <small>
                      {operationPlan.flowStrategy === "push"
                        ? copy(
                            "Plan/forecast driven; no safety stock.",
                            "Plan/tahmin odaklıdır; güvenli stok kullanılmaz.",
                          )
                        : copy(
                            "Demand driven; safety stock prevents material starvation.",
                            "Talep odaklıdır; güvenli stok malzeme beklemesini önler.",
                          )}
                    </small>
                  </label>
                  <label>
                    <span>{copy("Pull replenishment lot", "Çekme ikmal lotu")}</span>
                    <div>
                      <input
                        disabled={operationPlan.flowStrategy === "push"}
                        min="1"
                        step="1"
                        type="number"
                        value={operationPlan.batchSize ?? ""}
                        onChange={(event) => updateOperationPlan("batchSize", event.target.value)}
                      />
                    </div>
                  </label>
                  <label>
                    <span>{copy("Minimum transfer", "Minimum transfer")}</span>
                    <div>
                      <input
                        disabled={operationPlan.flowStrategy === "push"}
                        min="1"
                        step="1"
                        type="number"
                        value={operationPlan.minimumTransferQuantity ?? ""}
                        onChange={(event) => updateOperationPlan("minimumTransferQuantity", event.target.value)}
                      />
                    </div>
                  </label>
                  <label>
                    <span>{copy("Minimum safety stock", "Minimum güvenli stok")}</span>
                    <div>
                      <input
                        disabled={operationPlan.flowStrategy === "push"}
                        min="0"
                        step="1"
                        type="number"
                        value={operationPlan.flowStrategy === "push" ? 0 : (operationPlan.safetyStockQuantity ?? "")}
                        onChange={(event) => updateOperationPlan("safetyStockQuantity", event.target.value)}
                      />
                    </div>
                    <small>
                      {copy(
                        "Pull raises this automatically if more stock is needed to keep every station running.",
                        "Çekme, tüm istasyonları çalışır tutmak için gerekirse bu miktarı otomatik yükseltir.",
                      )}
                    </small>
                  </label>
                  <label>
                    <span>{copy("Max buffer", "Maks buffer")}</span>
                    <div>
                      <input
                        min="0"
                        step="1"
                        type="number"
                        value={operationPlan.bufferMaxQuantity ?? ""}
                        onChange={(event) => updateOperationPlan("bufferMaxQuantity", event.target.value)}
                      />
                    </div>
                  </label>
                  <label>
                    <span>{copy("Waiting cost / hour", "Bekleme maliyeti / saat")}</span>
                    <div>
                      <input
                        min="0"
                        step="0.01"
                        type="number"
                        value={operationPlan.waitingCostPerHour ?? ""}
                        onChange={(event) => updateOperationPlan("waitingCostPerHour", event.target.value)}
                      />
                    </div>
                  </label>
                  <label>
                    <span>{copy("Inventory cost / unit-hour", "Stok maliyeti / birim-saat")}</span>
                    <div>
                      <input
                        min="0"
                        step="0.01"
                        type="number"
                        value={operationPlan.inventoryCostPerUnitHour ?? ""}
                        onChange={(event) => updateOperationPlan("inventoryCostPerUnitHour", event.target.value)}
                      />
                    </div>
                  </label>
                  <label>
                    <span>{copy("Delay cost / hour", "Gecikme maliyeti / saat")}</span>
                    <div>
                      <input
                        min="0"
                        step="0.01"
                        type="number"
                        value={operationPlan.delayCostPerHour ?? ""}
                        onChange={(event) => updateOperationPlan("delayCostPerHour", event.target.value)}
                      />
                    </div>
                  </label>
                  <label>
                    <span>{copy("Capacity loss / hour", "Kapasite kaybı / saat")}</span>
                    <div>
                      <input
                        min="0"
                        step="0.01"
                        type="number"
                        value={operationPlan.capacityLossCostPerHour ?? ""}
                        onChange={(event) => updateOperationPlan("capacityLossCostPerHour", event.target.value)}
                      />
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
                {operationsLoading
                  ? copy("Saving...", "Kaydediliyor...")
                  : copy("Calculate and Save", "Hesapla ve Kaydet")}
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
              <h2>{copy("Production system and cost summary", "Üretim sistemi ve maliyet özeti")}</h2>
            </div>
            <mark className="ok">{`${formatNumber(result.energyConsumptionKwh, 2)} kWh`}</mark>
          </div>
          {
            <SimpleSortableGrid
              {...{
                columns: resultSummaryColumns,
                gridTemplateColumns: "0.72fr 1.15fr 1fr",
                headClassName: "process-result-table-head",
                rowClassName: "process-result-table-row",
                rows: resultTableRows,
                tableClassName: "process-result-table",
                tableId: "process-result-summary",
              }}
            />
          }
        </article>
      )}
    </section>
  );
}
