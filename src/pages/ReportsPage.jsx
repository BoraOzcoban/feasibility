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
    reportFormats,
    reportStats,
    reportTabs,
    setReportsTab,
  } = useAppContext();

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
          <div className="reports-header-panel" aria-label={copy("Download behavior", "İndirme davranışı")}>
            <strong>{copy("Download only", "Sadece indir")}</strong>
            <span>{copy("Not archived", "Arşivlenmez")}</span>
          </div>
        </div>

        <div className="reports-tabs" role="tablist" aria-label={copy("Report types", "Rapor türleri")}>
          {reportTabs.map((tab) => (
            <button
              type="button"
              className={activeReportTab.key === tab.key ? "active" : ""}
              onClick={() => setReportsTab(tab.key)}
              key={tab.key}
            >
              {tab.label}
            </button>
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
              <article
                className={`reports-pack-card ${tab.tone} ${activeReportTab.key === tab.key ? "active" : ""}`}
                key={tab.key}
              >
                <button type="button" onClick={() => setReportsTab(tab.key)}>
                  <span>{copy("Report pack", "Rapor paketi")}</span>
                  <strong>{tab.label}</strong>
                  <small>{tab.detail}</small>
                </button>
                <div className="reports-pack-includes">
                  {tab.includes.map((item) => (
                    <em key={item}>{item}</em>
                  ))}
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
                {activeReportTab.includes.map((item) => (
                  <span key={item}>{item}</span>
                ))}
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
                  <button type="button" onClick={() => downloadReport(activeReportTab, format)} key={format.key}>
                    <strong>{format.label}</strong>
                    <span>{format.note}</span>
                    <small>{copy("Download", "İndir")}</small>
                  </button>
                ))}
              </div>
              <p>
                {copy(
                  'PDF opens a print-ready report; choose "Save as PDF" in the print dialog. XLSX downloads the statements as a spreadsheet.',
                  'PDF, yazdırmaya hazır raporu açar; yazdırma penceresinde "PDF olarak kaydet"i seçin. XLSX tabloları Excel dosyası olarak indirir.',
                )}
              </p>
            </article>

            <article className="reports-card reports-readiness-card">
              <div className="reports-card-heading">
                <div>
                  <span>{copy("Source readiness", "Kaynak hazırlığı")}</span>
                  <h2>{copy("What the report can use", "Raporun kullanabileceği kaynaklar")}</h2>
                </div>
                <button type="button" onClick={loadPlanningData}>
                  {copy("Refresh", "Yenile")}
                </button>
              </div>
              {[
                [copy("Product record", "Ürün kaydı"), Boolean(operationsWorkspace.product)],
                [copy("Process result", "Süreç sonucu"), activePlanResults.length > 0],
                [copy("Channel sales plan", "Kanal satış planı"), hasSalesForecast],
                [copy("Financial assumptions", "Finansal varsayımlar"), hasFinancialAssumptions],
              ].map(([item, ready]) => (
                <div className="schedule-row" key={item}>
                  <strong>{item}</strong>
                  <span>{copy("Used in the report", "Raporda kullanılır")}</span>
                  <mark className={`status-badge ${ready ? "ready" : "needed"}`}>
                    {ready ? copy("Ready", "Hazır") : copy("Needed", "Gerekli")}
                  </mark>
                </div>
              ))}
            </article>
          </aside>
        </div>
      </section>
    </DashboardLayout>
  );
}
