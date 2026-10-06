import React from "react";
import { calculatePlanDailyCost } from "../lib/feasibilityModel";
import { formatCycleTime, formatLira, formatMinutesDuration, formatNumber, formatQuantity } from "../lib/format";
import { getCurrentOperationPlans } from "../lib/operationsCalculations";
import { useAppContext } from "../app/AppContext";
import DashboardLayout from "../components/DashboardLayout";

export default function ActiveProcessesPage() {
  const {
    activeOperationsSubmodule,
    copy,
    financialSettingsForm,
    goTo,
    loadOperationsData,
    locale,
    normalizeFlowStrategy,
    operationsStatus,
    operationsWorkspaceForFinance,
  } = useAppContext();

  const activePlans = getCurrentOperationPlans(operationsWorkspaceForFinance);
  const processStrategyLabels = {
    batch: copy("Push system", "İtme sistemi"),
    flow: copy("Pull system", "Çekme sistemi"),
    parallel: copy("Pull system", "Çekme sistemi"),
    pull: copy("Pull system", "Çekme sistemi"),
    push: copy("Push system", "İtme sistemi"),
  };

  return (
    <DashboardLayout activePage={`operations/${activeOperationsSubmodule.key}`}>
      <section className="page operations-page operations-active-processes-page">
        <div className="page-header">
          <div>
            <span>
              {copy("Operations", "Operasyon")} / {copy("Active Processes", "Mevcut Süreçler")}
            </span>
            <h1>{copy("Active Processes", "Mevcut Süreçler")}</h1>
            <p>
              {copy(
                "Track saved production plans and their calculated production and cost results.",
                "Kaydedilen üretim planlarını ve hesaplanan üretim/maliyet sonuçlarını takip edin.",
              )}
            </p>
          </div>
          <div className="button-row">
            <button type="button" onClick={loadOperationsData}>
              {copy("Refresh Data", "Verileri Yenile")}
            </button>
            <button
              type="button"

              onClick={() => goTo("/operations/data-entry")}
            >
              {copy("New Plan", "Yeni Plan")}
            </button>
          </div>
        </div>

        <div className="kpi-grid">
          <article className="card kpi">
            <span>{copy("Active Plan", "Aktif Plan")}</span>
            <strong>{activePlans.length}</strong>
          </article>
          <article className="card kpi">
            <span>{copy("Total Production", "Toplam Üretim")}</span>
            <strong>
              {formatQuantity(
                activePlans.reduce((total, plan) => total + (Number(plan.result?.producedQuantity) || 0), 0),
                activePlans[0]?.result?.productUnit,
              )}
            </strong>
          </article>
          <article className="card kpi">
            <span>{copy("Daily Production Cost", "Günlük Üretim Maliyeti")}</span>
            <strong>
              {activePlans.length
                ? formatLira(
                    activePlans.reduce(
                      (total, plan) =>
                        total +
                        calculatePlanDailyCost(plan.result, operationsWorkspaceForFinance, financialSettingsForm).daily
                          .total,
                      0,
                    ),
                  )
                : "-"}
            </strong>
          </article>
        </div>

        <div className="process-list">
          {activePlans.length ? (
            activePlans.map((plan) => {
              const result = plan.result || {};
              const productName = plan.product?.name || result.productName || plan.input?.productName || "-";
              const productUnit = result.productUnit || plan.product?.unit || copy("pcs", "adet");
              const machineRows = Array.isArray(result.machineRows) ? result.machineRows : [];
              const materialRows = Array.isArray(result.materialRows) ? result.materialRows : [];
              const operationRows = Array.isArray(result.operationRows) ? result.operationRows : [];
              const bufferRows = Array.isArray(result.bufferRows) ? result.bufferRows : [];
              // Plans calculated by the database function store no step or
              // buffer rows; say so instead of showing "- / 0 min".
              const missingFlowDetail = copy(
                "Step detail is not stored for this plan.",
                "Bu planda adım ayrıntısı saklanmıyor.",
              );

              return (
                <article className="card process-card" key={plan.id}>
                  <div className="card-header">
                    <div>
                      <span>{new Date(plan.created_at).toLocaleString(locale)}</span>
                      <h2>{plan.plan_name || copy("Daily production plan", "Günlük üretim planı")}</h2>
                    </div>
                    <span className="badge badge-feasible">{copy("Active", "Aktif")}</span>
                  </div>

                  <div className="facts process-metrics">
                    <span>
                      {copy("Product", "Ürün")} <strong>{productName}</strong>
                    </span>
                    <span>
                      {copy("Quantity to Produce", "Üretilecek Miktar")}{" "}
                      <strong>
                        {formatQuantity(result.producedQuantity, productUnit)} {productUnit}
                      </strong>
                    </span>
                    <span>
                      {copy("Cycle", "Çevrim")}{" "}
                      <strong>
                        {formatCycleTime(result.cycleTimeMinutes, plan.product?.cycle_time_unit || "minute")}
                      </strong>
                    </span>
                    <span>
                      {copy("Production Time", "Toplam süre")}{" "}
                      <strong>
                        {result.totalProductionTimeMinutes
                          ? formatMinutesDuration(result.totalProductionTimeMinutes)
                          : "-"}
                      </strong>
                    </span>
                    <span>
                      {copy("Strategy", "Strateji")}{" "}
                      <strong>{processStrategyLabels[result.flowStrategy] || result.flowStrategy || "-"}</strong>
                    </span>
                    <span>
                      {copy("Batch / Transfer", "Batch / Transfer")}{" "}
                      <strong>
                        {result.transferBatchSize ? formatQuantity(result.transferBatchSize, productUnit) : "-"}
                      </strong>
                    </span>
                    <span>
                      {copy("Safety Stock", "Güvenli stok")}{" "}
                      <strong>
                        {result.safetyStockEnabled || normalizeFlowStrategy(result.flowStrategy) === "pull"
                          ? `${formatQuantity(result.safetyStockQuantity, productUnit)} ${copy("max / buffer", "maks / buffer")}`
                          : copy("Not used", "Kullanılmaz")}
                      </strong>
                    </span>
                    <span>
                      {copy("Stock Wait", "Stok bekleme")}{" "}
                      <strong>
                        {formatNumber(result.stockoutWaitTimeHours, 2)} {copy("hours", "saat")}
                      </strong>
                    </span>
                    <span>
                      {copy("Max WIP", "Maks WIP")}{" "}
                      <strong>{formatQuantity(result.maxWipQuantity, productUnit)}</strong>
                    </span>
                    <span>
                      {copy("Bottleneck", "Darboğaz")} <strong>{result.bottleneck?.operationName || "-"}</strong>
                    </span>
                    <span>
                      {copy("Main Machine Hours", "Ana Makine Saati")}{" "}
                      <strong>
                        {formatNumber(result.primaryMachineDailyHours, 2)} {copy("hours", "saat")}
                      </strong>
                    </span>
                    <span>
                      {copy("Energy", "Enerji")} <strong>{formatNumber(result.energyConsumptionKwh, 2)} kWh</strong>
                    </span>
                    <span>
                      {copy("Daily Cost", "Günlük Maliyet")}{" "}
                      <strong>
                        {formatLira(
                          calculatePlanDailyCost(result, operationsWorkspaceForFinance, financialSettingsForm).daily
                            .total,
                        )}
                      </strong>
                    </span>
                  </div>

                  <div className="process-detail-grid">
                    <div>
                      <h3>{copy("Operations", "Operasyonlar")}</h3>
                      {operationRows.length ? (
                        operationRows.map((row, index) => (
                          <span key={row.operationId || `operation-${index}`}>
                            {row.operationName}{" "}
                            <strong>
                              {row.machineName || "-"} / {formatMinutesDuration(row.busyMinutes || 0)}
                            </strong>
                          </span>
                        ))
                      ) : (
                        <p className="planner-empty-state">{missingFlowDetail}</p>
                      )}
                    </div>
                    <div>
                      <h3>{copy("Buffers", "Buffer")}</h3>
                      {!bufferRows.length && <p className="planner-empty-state">{missingFlowDetail}</p>}
                      {bufferRows.map((row, index) => (
                        <span key={`${row.fromOperationName}-${row.toOperationName}-${index}`}>
                          {row.fromOperationName} -&gt; {row.toOperationName}{" "}
                          <strong>
                            {formatQuantity(row.maxWip, productUnit)} WIP /{" "}
                            {formatQuantity(row.safetyStockQuantity, productUnit)} {copy("safety", "güvenli")}
                          </strong>
                        </span>
                      ))}
                    </div>
                    <div>
                      <h3>{copy("Machines", "Makineler")}</h3>
                      {(machineRows.length ? machineRows : [{ machineId: "empty", name: "-", dailyHours: 0 }]).map(
                        (row) => (
                          <span key={row.machineId}>
                            {row.name}{" "}
                            <strong>
                              {formatNumber(row.dailyHours, 2)} {copy("hours", "saat")}
                              {Number.isFinite(Number(row.utilizationPercent))
                                ? ` / ${formatNumber(row.utilizationPercent, 1)}%`
                                : ""}
                            </strong>
                          </span>
                        ),
                      )}
                    </div>
                    <div>
                      <h3>{copy("Material Usage", "Malzeme Kullanımı")}</h3>
                      {(materialRows.length
                        ? materialRows
                        : [{ materialId: "empty", name: "-", dailyQuantity: 0, unit: "" }]
                      ).map((row) => (
                        <span key={row.materialId}>
                          {row.name}{" "}
                          <strong>
                            {formatNumber(row.dailyQuantity, 4)} {row.unit || ""}
                          </strong>
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <article className="card process-card">
              <p className="planner-empty-state">
                {copy(
                  "No production plans saved yet. Save a plan from the process definition screen and it will appear here.",
                  "Henüz kaydedilmiş üretim planı yok. Süreç tanımlama ekranından plan kaydedince burada görünecek.",
                )}
              </p>
            </article>
          )}
        </div>

        {operationsStatus && <p className="status-message">{operationsStatus}</p>}
      </section>
    </DashboardLayout>
  );
}
