import React from "react";
import logoUrl from "../assets/atera-logo.svg";
import { GlossaryTip } from "../components/InfoTip";
import { useAppContext } from "../app/AppContext";
import DashboardLayout from "../components/DashboardLayout";

export default function DashboardPage() {
  const {
    copy,
    currentProfile,
    dashboardAssumptionMenu,
    dashboardCompanyName,
    dashboardEditorGroups,
    dashboardEditorOpen,
    dashboardHorizonSelectLabel,
    dashboardModuleRollup,
    dashboardProductContext,
    dashboardProductSelectLabel,
    dashboardRiskPriority,
    dashboardRiskRows,
    dashboardSelectedProductId,
    decisionKpis,
    feasibilityChecklist,
    feasibilityReadinessStatus,
    feasibilityReadyCount,
    feasibilityVerdict,
    financialHorizon,
    financialHorizonOptions,
    form,
    goTo,
    handleDashboardProductChange,
    hasFinancialSourceData,
    hasOperationData,
    hasSalesForecast,
    improvementFocus,
    loadFinancialData,
    normalizedDashboardVisibleSections,
    operationsWorkspace,
    periodLabel,
    resetDashboardVisibleSections,
    setDashboardAssumptionMenu,
    setDashboardEditorOpen,
    toggleDashboardVisibleSection,
    visibleDashboardAssumptionRows,
    visibleDashboardExecutiveMetrics,
    visibleDashboardFinancialDetailRows,
  } = useAppContext();

  return (
    <DashboardLayout activePage="dashboard/overview">
      <section className="command-dashboard feasibility-dashboard" aria-label="Atera feasibility dashboard">
        <div className="command-topbar executive-topbar">
          <div className="command-context">
            <strong>{dashboardCompanyName}</strong>
            <span>{dashboardProductContext}</span>
          </div>
          <div className="command-live">
            <span className="live-dot" />
            <strong>
              {hasOperationData || hasSalesForecast
                ? copy("Workspace data loaded", "Çalışma alanı verisi yüklendi")
                : copy("Input needed", "Girdi gerekli")}
            </strong>
          </div>
          <div className="command-user">
            <span>{currentProfile?.username || form.username || "Atera"}</span>
            <small>{currentProfile?.access_level || "-"}</small>
          </div>
          <button
            type="button"
            className={`dashboard-edit-toggle ${dashboardEditorOpen ? "active" : ""}`}
            onClick={() => setDashboardEditorOpen((isOpen) => !isOpen)}
            aria-controls="dashboard-editor-panel"
            aria-expanded={dashboardEditorOpen}
          >
            <span>
              {dashboardEditorOpen ? copy("Done editing", "Düzenlemeyi bitir") : copy("Edit screen", "Ekranı düzenle")}
            </span>
          </button>
          <button type="button" className="command-run-button" onClick={() => goTo(feasibilityVerdict.path, "login")}>
            {feasibilityVerdict.action}
          </button>
        </div>

        {dashboardEditorOpen && (
          <section
            id="dashboard-editor-panel"
            className="dashboard-editor-panel"
            aria-label={copy("Dashboard editor", "Dashboard düzenleyici")}
          >
            <div className="dashboard-editor-heading">
              <div>
                <span>{copy("Dashboard view", "Dashboard görünümü")}</span>
                <h2>{copy("Visible data groups", "Görünür veri grupları")}</h2>
                <p>{copy("Selections are saved for this browser.", "Seçimler bu tarayıcı için saklanır.")}</p>
              </div>
              <div className="dashboard-editor-actions">
                <button type="button" onClick={resetDashboardVisibleSections}>
                  {copy("Reset", "Sıfırla")}
                </button>
                <button type="button" className="primary" onClick={() => setDashboardEditorOpen(false)}>
                  {copy("Done", "Bitti")}
                </button>
              </div>
            </div>
            <div className="dashboard-editor-grid">
              {dashboardEditorGroups.map((group) => {
                const visibleKeys = normalizedDashboardVisibleSections[group.key] || [];

                return (
                  <article className="dashboard-editor-group" key={group.key}>
                    <div className="dashboard-editor-group-heading">
                      <div>
                        <span>{group.title}</span>
                        <p>{group.description}</p>
                      </div>
                      <strong>
                        {visibleKeys.length}/{group.options.length}
                      </strong>
                    </div>
                    {Boolean(group.fixedItems?.length) && (
                      <div className="dashboard-editor-fixed-items">
                        {group.fixedItems.map(([label, value]) => (
                          <span key={label}>
                            <small>{label}</small>
                            <strong>{value}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="dashboard-editor-options">
                      {group.options.map((option) => {
                        const isSelected = visibleKeys.includes(option.id);

                        return (
                          <label className={`dashboard-editor-option ${isSelected ? "selected" : ""}`} key={option.id}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleDashboardVisibleSection(group.key, option.id)}
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
          className={`dashboard-assumption-strip ${feasibilityVerdict.tone}`}
          aria-label={copy("Assumption snapshot", "Varsayım özeti")}
        >
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
            <div
              className={`assumption-control product-control ${dashboardAssumptionMenu === "product" ? "open" : ""}`}
            >
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
            <div
              className={`assumption-control horizon-control ${dashboardAssumptionMenu === "horizon" ? "open" : ""}`}
            >
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
                        <small>
                          {value === "6m"
                            ? copy("Short range", "Kısa ufuk")
                            : value === "1y"
                              ? copy("Annual range", "Yıllık ufuk")
                              : copy("Long range", "Uzun ufuk")}
                        </small>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="assumption-strip-list">
            {visibleDashboardAssumptionRows.length ? (
              visibleDashboardAssumptionRows.map((row) => (
                <span key={row.id}>
                  {row.label}
                  <strong>{row.value}</strong>
                </span>
              ))
            ) : (
              <span className="dashboard-empty-selection">
                {copy("No extra assumptions selected", "Ek varsayım alanı seçilmedi")}
                <strong>{copy("Edit screen", "Ekranı düzenle")}</strong>
              </span>
            )}
          </div>
        </section>

        <section
          className={`executive-brief ${feasibilityVerdict.tone}`}
          aria-label={copy("Feasibility executive brief", "Fizibilite yönetici özeti")}
        >
          <div className="executive-brief-copy">
            <span>{copy("Feasibility executive brief", "Fizibilite yönetici özeti")}</span>
            <h1>{feasibilityVerdict.label}</h1>
            <p>{feasibilityVerdict.copy}</p>
            {hasFinancialSourceData && (
              <div className="decision-kpi-grid">
                {decisionKpis.map((kpi) => (
                  <article className={`decision-kpi ${kpi.ok ? "ok" : "failed"}`} key={kpi.key}>
                    <span className="label-with-info">
                      {kpi.label}
                      <GlossaryTip language={form.language} term={kpi.label} />
                    </span>
                    <strong>{kpi.value}</strong>
                    <small>{kpi.detail}</small>
                  </article>
                ))}
              </div>
            )}
            <div className="executive-brief-actions">
              <button type="button" onClick={() => goTo(feasibilityVerdict.path, "login")}>
                {feasibilityVerdict.action}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => goTo("/simulation/current-situation", "login")}
              >
                {copy("Test scenario", "Senaryo test et")}
              </button>
              <button type="button" className="secondary" onClick={() => goTo("/reports", "login")}>
                {copy("Open report pack", "Rapor paketini aç")}
              </button>
            </div>
          </div>
          <aside className="executive-readiness-card">
            <span>{copy("Decision readiness", "Karar hazırlığı")}</span>
            <strong className="executive-readiness-status">{feasibilityReadinessStatus}</strong>
            <p>
              {copy("Core modules ready", "Hazır ana modül")}: {feasibilityReadyCount}/{feasibilityChecklist.length}
            </p>
            <div className="readiness-step-list">
              {feasibilityChecklist.map((item) => (
                <button
                  type="button"
                  className={item.done ? "done" : ""}
                  onClick={() => goTo(item.path, "login")}
                  key={item.label}
                >
                  <i>{item.done ? "OK" : "!"}</i>
                  <span>{item.label}</span>
                  <strong>
                    {item.done ? copy("Ready", "Hazır") : copy("Data entry needed", "Veri girişi gerekiyor")}
                  </strong>
                </button>
              ))}
            </div>
          </aside>
        </section>

        <section className="dashboard-section-group" aria-label={copy("Business case metrics", "İş modeli metrikleri")}>
          <div className="dashboard-section-heading">
            <div>
              <span>{copy("Business case", "İş modeli")}</span>
              <h2>
                {copy("The numbers a business owner should see first", "İş sahibinin önce görmesi gereken sayılar")}
              </h2>
            </div>
            <strong>{periodLabel}</strong>
          </div>
          <div className="executive-metric-grid">
            {visibleDashboardExecutiveMetrics.length ? (
              visibleDashboardExecutiveMetrics.map((metric) => (
                <article className={`command-card executive-metric-card ${metric.tone}`} key={metric.id}>
                  <span>{metric.category}</span>
                  <h3 className="label-with-info">
                    {metric.label}
                    <GlossaryTip language={form.language} term={metric.label} />
                  </h3>
                  <strong>{metric.value}</strong>
                  <small>{metric.detail}</small>
                </article>
              ))
            ) : (
              <article className="command-card dashboard-empty-selection-card">
                <span>{copy("Business case", "İş modeli")}</span>
                <h3>{copy("No metrics selected", "Metrik seçilmedi")}</h3>
                <strong>{copy("Edit screen", "Ekranı düzenle")}</strong>
                <small>
                  {copy(
                    "Open the editor to show business model numbers.",
                    "İş modeli sayılarını göstermek için düzenleyiciyi açın.",
                  )}
                </small>
              </article>
            )}
          </div>
        </section>

        <section
          className="dashboard-two-column"
          aria-label={copy("Risks and next actions", "Riskler ve sonraki aksiyonlar")}
        >
          <article className="command-card dashboard-risk-board">
            <div className="card-heading">
              <div>
                <span>{copy("Risk board", "Risk panosu")}</span>
                <h2>{copy("What can stop this project", "Bu projeyi ne durdurabilir")}</h2>
              </div>
            </div>
            <div className="dashboard-risk-list">
              {(dashboardRiskRows.length
                ? dashboardRiskRows
                : [
                    {
                      action: copy("Run simulation", "Simülasyon çalıştır"),
                      detail: copy(
                        "Core feasibility data is in place. Test conservative and optimistic scenarios before committing.",
                        "Ana fizibilite verisi hazır. Karar vermeden önce temkinli ve iyimser senaryoları test edin.",
                      ),
                      path: "/simulation/current-situation",
                      priority: dashboardRiskPriority.controlled,
                      severity: copy("Controlled", "Kontrollü"),
                      tone: "teal",
                      title: copy("No blocking risk detected", "Engelleyici risk görünmüyor"),
                    },
                  ]
              ).map((risk) => (
                <button
                  type="button"
                  className={`dashboard-risk-row ${risk.tone}`}
                  onClick={() => goTo(risk.path, "login")}
                  key={risk.title}
                >
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
              {(improvementFocus.length
                ? improvementFocus
                : [
                    copy(
                      "Run at least one conservative scenario and confirm payback, cash runway, and capacity coverage.",
                      "En az bir temkinli senaryo çalıştırın; geri dönüş, nakit dayanma ve kapasite kapsamını doğrulayın.",
                    ),
                    copy(
                      "Export or review the report pack before discussing investment or financing.",
                      "Yatırım veya finansman konuşmadan önce rapor paketini inceleyin.",
                    ),
                  ]
              ).map((item, index) => (
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
              <button
                type="button"
                className={`module-rollup-card ${module.tone} ${module.done ? "done" : ""}`}
                onClick={() => goTo(module.path, "login")}
                key={module.label}
              >
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
              <button type="button" onClick={() => goTo("/financial-modelling/analiz", "login")}>
                {copy("Open analysis", "Analizi aç")}
              </button>
            </div>
            <div className="business-case-list">
              {visibleDashboardFinancialDetailRows.length ? (
                visibleDashboardFinancialDetailRows.map((row) => (
                  <span key={row.id}>
                    {row.label}
                    <strong>{row.value}</strong>
                  </span>
                ))
              ) : (
                <span className="dashboard-empty-selection">
                  {copy("No detail metrics selected", "Detay metriği seçilmedi")}
                  <strong>{copy("Edit screen", "Ekranı düzenle")}</strong>
                </span>
              )}
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
      </section>
    </DashboardLayout>
  );
}
