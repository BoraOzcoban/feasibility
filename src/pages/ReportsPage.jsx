import React from "react";
import { useAppContext } from "../app/AppContext";
import DashboardLayout from "../components/DashboardLayout";

export default function ReportsPage() {
  const {
    activeModule,
    activePlanResults,
    activeReportTab,
    copy,
    dashboardCompanyName,
    downloadReport,
    hasFinancialAssumptions,
    hasSalesForecast,
    loadPlanningData,
    operationsWorkspace,
    periodLabel,
    reportFormats,
    reportTabs,
    setReportsTab,
  } = useAppContext();

  const sources = [
    [copy("Product record", "Ürün kaydı"), Boolean(operationsWorkspace.product)],
    [copy("Process result", "Süreç sonucu"), activePlanResults.length > 0],
    [copy("Channel sales plan", "Kanal satış planı"), hasSalesForecast],
    [copy("Financial assumptions", "Finansal varsayımlar"), hasFinancialAssumptions],
  ];

  return (
    <DashboardLayout activePage={activeModule.key}>
      <section className="page reports-workspace">
        <div className="page-header">
          <div>
            <span>
              {dashboardCompanyName} / {copy("Export center", "Export merkezi")}
            </span>
            <h1>{copy("Report Downloads", "Rapor İndirme")}</h1>
            <p>
              {copy(
                "Choose a report pack and download it as PDF or XLSX. Reports are built from the current data and are not archived.",
                "Bir rapor paketi seçin ve PDF ya da XLSX olarak indirin. Raporlar güncel veriden üretilir, arşivlenmez.",
              )}
            </p>
          </div>
        </div>

        <div className="reports-layout">
          <section className="card" aria-label={copy("Report packs", "Rapor paketleri")}>
            <div className="card-header">
              <h2>{copy("Report packs", "Rapor paketleri")}</h2>
            </div>
            <div className="choice-list" role="radiogroup" aria-label={copy("Report packs", "Rapor paketleri")}>
              {reportTabs.map((tab) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={activeReportTab.key === tab.key}
                  className={`choice${activeReportTab.key === tab.key ? " is-selected" : ""}`}
                  onClick={() => setReportsTab(tab.key)}
                  key={tab.key}
                >
                  <strong>{tab.label}</strong>
                  <span>{tab.detail}</span>
                </button>
              ))}
            </div>
          </section>

          <div className="stack">
            <article className="card">
              <div className="card-header">
                <div>
                  <span>{copy("Selected export", "Seçili export")}</span>
                  <h2>{activeReportTab.label}</h2>
                  <p>{activeReportTab.detail}</p>
                </div>
              </div>
              <div className="badge-row">
                {activeReportTab.includes.map((item) => (
                  <span className="badge badge-neutral" key={item}>
                    {item}
                  </span>
                ))}
                <span className="badge badge-neutral">{periodLabel}</span>
              </div>
              <div className="button-row">
                {reportFormats.map((format) => (
                  <button
                    type="button"
                    className={format.key === "pdf" ? "primary" : undefined}
                    onClick={() => downloadReport(activeReportTab, format)}
                    key={format.key}
                  >
                    {copy(`Download ${format.label}`, `${format.label} indir`)}
                  </button>
                ))}
              </div>
              <p className="planner-empty-state">
                {copy(
                  'PDF opens a print-ready report; choose "Save as PDF" in the print dialog. XLSX downloads the statements as a spreadsheet.',
                  'PDF, yazdırmaya hazır raporu açar; yazdırma penceresinde "PDF olarak kaydet"i seçin. XLSX tabloları Excel dosyası olarak indirir.',
                )}
              </p>
            </article>

            <article className="card">
              <div className="card-header">
                <div>
                  <span>{copy("Source readiness", "Kaynak hazırlığı")}</span>
                  <h2>{copy("What the report can use", "Raporun kullanabileceği kaynaklar")}</h2>
                </div>
                <button type="button" onClick={loadPlanningData}>
                  {copy("Refresh", "Yenile")}
                </button>
              </div>
              <ul className="action-list">
                {sources.map(([item, ready]) => (
                  <li className="action-row is-static" key={item}>
                    <span className={`badge badge-${ready ? "feasible" : "neutral"}`}>
                      {ready ? copy("Ready", "Hazır") : copy("Needed", "Gerekli")}
                    </span>
                    <span className="action-row-text">
                      <strong>{item}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
