import React from "react";
import { operationCurrencyOptions } from "../lib/appDefaults";
import { convertMoneyToTry, toFiniteNumber } from "../lib/feasibilityModel";
import { formatLira, formatNumber, formatOperationMoney } from "../lib/format";
import { useAppContext } from "../app/AppContext";

export default function MachinesEquipmentPage() {
  const {
    activeOperationsSubmodule,
    copy,
    copyOperationRecordToForm,
    equipmentFormRef,
    equipmentListHeightStyle,
    exchangeRates,
    handleDeleteOperationRecord,
    loadOperationsData,
    machineFormRef,
    machineListHeightStyle,
    operationsStatus,
    operationsWorkspace,
    renderDashboardLayout,
    renderOperationRecordForm,
    renderSortableDataTable,
  } = useAppContext();

  const machineFields = [
    { name: "name", label: copy("Machine name", "Makine adı") },
    { info: copy("Purchase value of the selected machine. If currency is USD/EUR, financial analysis converts it to TRY using the current FX rate.", "Seçili makinenin alım değeri. Para birimi USD/EUR ise finansal analiz güncel kurla TL'ye çevirir."), name: "price", label: copy("Machine price", "Makine fiyatı"), step: "0.01", type: "number" },
    { info: copy("Choose the currency the price is entered in. TRY stays unchanged; USD/EUR are multiplied by their TRY rates in financial outputs.", "Fiyatın girildiği para birimini seçin. TL aynen kalır; USD/EUR finans çıktılarında ilgili TL kuru ile çarpılır."), name: "priceCurrency", label: copy("Currency", "Para birimi"), options: operationCurrencyOptions, type: "select" },
    { name: "hourlyEnergyConsumptionKwh", label: copy("Hourly energy consumption", "Saatlik enerji tüketimi"), step: "0.01", type: "number" },
    { info: copy("How many product units this machine can process at the same time.", "Makinenin aynı anda kaç ürün işleyebildiği."), name: "concurrentCapacity", label: copy("Concurrent capacity", "Eş zamanlı kapasite"), step: "1", type: "number" },
    { info: copy("Daily available production time used by the scheduler before delay cost starts.", "Gecikme maliyeti başlamadan önce planlayıcının kullandığı günlük çalışma süresi."), name: "availabilityHours", label: copy("Availability hours", "Çalışma saati"), step: "0.25", type: "number" },
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
            <span>{copy("Operations", "Operasyon")} / {copy("Machines & Equipment", "Makine & Ekipman")}</span>
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
                onDeleteRow: (row) => handleDeleteOperationRecord("machine", row),
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
                onDeleteRow: (row) => handleDeleteOperationRecord("equipment", row),
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
