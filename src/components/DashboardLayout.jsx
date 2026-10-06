import React from "react";
import logoUrl from "../assets/atera-logo.svg";
import ThemeToggle from "./ThemeToggle";
import UnsavedChangesPrompt from "./UnsavedChangesPrompt";
import { useAppContext } from "../app/AppContext";

export default function DashboardLayout({ activePage, children }) {
  const {
    addSimulationVariant,
    authorizationAccess,
    copy,
    dashboardModules,
    dashboardSidebarOpen,
    deleteSimulationVariant,
    financialSubmodules,
    form,
    goTo,
    handleLogout,
    labels,
    operationsSubmodules,
    setDashboardSidebarOpen,
    simulationVariants,
    updateField,
  } = useAppContext();

  return (
    <>
      <main className={`dashboard-shell ${dashboardSidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}>
        <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
          <div className="dashboard-brand-block">
            <div className="dashboard-sidebar-top">
              <button
                type="button"
                className="landing-brand dashboard-brand"
                onClick={() => goTo("/dashboard", "login")}
              >
                <img src={logoUrl} alt="Atera logo" />
                <strong>Atera</strong>
              </button>
              <button
                type="button"
                className="dashboard-sidebar-toggle"
                aria-label={dashboardSidebarOpen ? copy("Close menu", "Menüyü kapat") : copy("Open menu", "Menüyü aç")}
                aria-expanded={dashboardSidebarOpen}
                onClick={() => setDashboardSidebarOpen((isOpen) => !isOpen)}
              >
                <span aria-hidden="true">{dashboardSidebarOpen ? "<" : ">"}</span>
              </button>
            </div>

            <div className="dashboard-controls">
              <label className="language-picker">
                <span>{labels.language}</span>
                <select value={form.language} onChange={(event) => updateField("language", event.target.value)}>
                  <option value="en">EN</option>
                  <option value="tr">TR</option>
                </select>
              </label>
              <ThemeToggle />
            </div>
          </div>

          <nav className="dashboard-nav">
            <button
              type="button"
              className={activePage.startsWith("dashboard") ? "active" : ""}
              onClick={() => goTo("/dashboard", "login")}
            >
              {labels.dashboard}
            </button>
            {dashboardModules.map((module) => (
              <React.Fragment key={module.key}>
                <button
                  type="button"
                  className={`dashboard-nav-item ${module.tone} ${activePage === module.key || (module.key === "operations" && activePage.startsWith("operations/")) || (module.key === "financial-modelling" && activePage.startsWith("financial-modelling/")) || (module.key === "simulation" && activePage.startsWith("simulation/")) ? "active" : ""}`}
                  onClick={() =>
                    goTo(
                      module.key === "financial-modelling"
                        ? "/financial-modelling/girdiler"
                        : module.key === "simulation"
                          ? "/simulation/current-situation"
                          : module.path,
                      "login",
                    )
                  }
                >
                  <span className="dashboard-nav-category">{module.category}</span>
                  <strong>{module.label}</strong>
                </button>
                {module.key === "operations" &&
                  (activePage === "operations" || activePage.startsWith("operations/")) && (
                    <div className="dashboard-subnav" aria-label="Operations submodules">
                      {operationsSubmodules.map((submodule) => (
                        <button
                          type="button"
                          className={activePage === `operations/${submodule.key}` ? "active" : ""}
                          onClick={() => goTo(submodule.path, "login")}
                          key={submodule.key}
                        >
                          {submodule.label}
                        </button>
                      ))}
                    </div>
                  )}
                {module.key === "financial-modelling" &&
                  (activePage === "financial-modelling" || activePage.startsWith("financial-modelling/")) && (
                    <div className="dashboard-subnav" aria-label="Finansal Modelleme submodules">
                      {[...new Set(financialSubmodules.map((submodule) => submodule.group))].map((group) => (
                        <React.Fragment key={group}>
                          <span className="dashboard-subnav-label">{group}</span>
                          {financialSubmodules
                            .filter((submodule) => submodule.group === group)
                            .map((submodule) => (
                              <button
                                type="button"
                                className={activePage === `financial-modelling/${submodule.key}` ? "active" : ""}
                                onClick={() => goTo(submodule.path, "login")}
                                key={submodule.key}
                              >
                                {submodule.label}
                              </button>
                            ))}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                {module.key === "simulation" &&
                  (activePage === "simulation" || activePage.startsWith("simulation/")) && (
                    <div
                      className="dashboard-subnav"
                      aria-label={copy("Simulation variants", "Simülasyon varyantları")}
                    >
                      {simulationVariants.map((variant) => (
                        <div className="simulation-subnav-item" key={variant.id}>
                          <button
                            type="button"
                            className={activePage === `simulation/${variant.id}` ? "active" : ""}
                            onClick={() => goTo(variant.path, "login")}
                          >
                            {variant.id === "current-situation"
                              ? copy("Current Situation", "Mevcut Durum")
                              : variant.name || variant.label}
                          </button>
                          {variant.id !== "current-situation" && (
                            <button
                              type="button"
                              className="variant-delete-button"
                              aria-label={copy("Delete variant", "Varyantı sil")}
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteSimulationVariant(variant.id);
                              }}
                            >
                              x
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={addSimulationVariant}>
                        + {copy("Add Variant", "Varyant Ekle")}
                      </button>
                    </div>
                  )}
              </React.Fragment>
            ))}
            {authorizationAccess.read && (
              <button
                type="button"
                className={activePage === "authorization" ? "active" : ""}
                onClick={() => goTo("/authorization", "login")}
              >
                {labels.authorizationPage}
              </button>
            )}
          </nav>

          <div className="sidebar-footer">
            <div className="sync-status-card" role="status" aria-label="Data synchronization status">
              <span className="live-dot" />
              <div>
                <strong>{labels.dataSync}</strong>
                <small>{labels.live}</small>
              </div>
            </div>
            <button type="button" className="link-button dashboard-logout" onClick={handleLogout}>
              {labels.logout}
            </button>
          </div>
        </aside>

        <section className="dashboard-content">{children}</section>
      </main>
      {<UnsavedChangesPrompt />}
    </>
  );
}
