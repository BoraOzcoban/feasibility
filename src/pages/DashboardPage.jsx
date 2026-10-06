import React from "react";
import { GlossaryTip } from "../components/InfoTip";
import { useAppContext } from "../app/AppContext";
import DashboardLayout from "../components/DashboardLayout";

const riskBadgeByTone = {
  "risk-high": "risky",
  "risk-medium": "wait",
};

// One-screen decision page: the decision, the four KPIs behind it, and the
// three biggest risks. Before the inputs are complete, the KPIs are replaced by
// the list of missing inputs.
export default function DashboardPage() {
  const {
    copy,
    dashboardCompanyName,
    dashboardProductSelectLabel,
    dashboardRiskRows,
    dashboardSelectedProductId,
    decisionBasis,
    decisionKpis,
    feasibilityChecklist,
    feasibilityVerdict,
    form,
    goTo,
    handleDashboardProductChange,
    hasFinancialSourceData,
    operationsWorkspace,
  } = useAppContext();

  const status = feasibilityVerdict.status;
  const risks = dashboardRiskRows.filter((risk) => hasFinancialSourceData || !risk.readinessItem).slice(0, 3);
  const products = operationsWorkspace.products;

  return (
    <DashboardLayout activePage="dashboard/overview">
      <div className="page decision-page">
        <header className="page-header">
          <div>
            <span className="eyebrow">{dashboardCompanyName}</span>
            <h1>{copy("Feasibility decision", "Fizibilite kararı")}</h1>
            <p>{decisionBasis}</p>
          </div>
          {products.length > 1 && (
            <label className="field page-header-field">
              <span>{copy("Product", "Ürün")}</span>
              <select
                value={dashboardSelectedProductId || ""}
                onChange={(event) => handleDashboardProductChange(event.target.value)}
              >
                {products.map((product) => (
                  <option value={product.id} key={product.id}>
                    {product.name || product.product_code || copy("Unnamed product", "İsimsiz ürün")}
                  </option>
                ))}
              </select>
            </label>
          )}
        </header>

        <section className={`card decision-card is-${status}`} aria-label={copy("Decision", "Karar")}>
          <div className="decision-card-body">
            <span className="eyebrow">{dashboardProductSelectLabel}</span>
            <h2 className="decision-card-label">
              <span className="decision-dot" aria-hidden="true" />
              {feasibilityVerdict.label}
            </h2>
            <p>{feasibilityVerdict.copy}</p>
          </div>
          <div className="button-row">
            <button type="button" className="primary" onClick={() => goTo(feasibilityVerdict.path)}>
              {feasibilityVerdict.action}
            </button>
            {status !== "pending" && (
              <button type="button" onClick={() => goTo("/simulation/current-situation")}>
                {copy("Test scenario", "Senaryo test et")}
              </button>
            )}
            {status !== "pending" && feasibilityVerdict.path !== "/reports" && (
              <button type="button" onClick={() => goTo("/reports")}>
                {copy("Open report pack", "Rapor paketini aç")}
              </button>
            )}
          </div>
        </section>

        {hasFinancialSourceData ? (
          <section className="kpi-grid" aria-label={copy("Decision KPIs", "Karar göstergeleri")}>
            {decisionKpis.map((kpi) => (
              <article className={`card kpi ${kpi.ok ? "is-ok" : "is-failed"}`} key={kpi.key}>
                <span className="kpi-label">
                  {kpi.label}
                  <GlossaryTip language={form.language} term={kpi.label} />
                </span>
                <strong className="kpi-value">{kpi.value}</strong>
                <span className="kpi-detail">
                  <span className={`badge badge-${kpi.ok ? "feasible" : "wait"}`}>
                    {kpi.ok ? copy("OK", "Uygun") : copy("Check", "Kontrol et")}
                  </span>
                  {kpi.detail}
                </span>
              </article>
            ))}
          </section>
        ) : (
          <section className="card" aria-label={copy("Missing inputs", "Eksik girdiler")}>
            <div className="card-header">
              <h2>{copy("Inputs needed for a decision", "Karar için gereken girdiler")}</h2>
              <span className="card-header-meta">
                {feasibilityChecklist.filter((item) => item.done).length}/{feasibilityChecklist.length}
              </span>
            </div>
            <ol className="action-list">
              {feasibilityChecklist.map((item) => (
                <li key={item.label}>
                  <button type="button" className="action-row" onClick={() => goTo(item.path)}>
                    <span className={`badge badge-${item.done ? "feasible" : "neutral"}`}>
                      {item.done ? copy("Ready", "Hazır") : copy("Missing", "Eksik")}
                    </span>
                    <span className="action-row-text">
                      <strong>{item.label}</strong>
                    </span>
                    {!item.done && <span className="action-row-link">{item.action} →</span>}
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

        {(hasFinancialSourceData || risks.length > 0) && (
          <section className="card" aria-label={copy("Biggest risks", "En büyük riskler")}>
            <div className="card-header">
              <h2>{copy("Biggest risks", "En büyük riskler")}</h2>
            </div>
            <ol className="action-list">
              {risks.length ? (
                risks.map((risk) => (
                  <li key={risk.title}>
                    <button type="button" className="action-row" onClick={() => goTo(risk.path)}>
                      <span className={`badge badge-${riskBadgeByTone[risk.tone] || "neutral"}`}>{risk.severity}</span>
                      <span className="action-row-text">
                        <strong>{risk.title}</strong>
                        <span>{risk.detail}</span>
                      </span>
                      <span className="action-row-link">{risk.action} →</span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="action-row is-static">
                  <span className="badge badge-feasible">{copy("Controlled", "Kontrollü")}</span>
                  <span className="action-row-text">
                    <strong>{copy("No blocking risk detected", "Engelleyici risk görünmüyor")}</strong>
                    <span>
                      {copy(
                        "Test conservative and optimistic scenarios before committing.",
                        "Karar vermeden önce temkinli ve iyimser senaryoları test edin.",
                      )}
                    </span>
                  </span>
                </li>
              )}
            </ol>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
