import React from "react";
import OperationPlanner from "../components/OperationPlanner";
import { useAppContext } from "../app/AppContext";
import DashboardLayout from "../components/DashboardLayout";

export default function ProcessDefinitionPage() {
  const { activeOperationsSubmodule, copy, goTo, loadOperationsData, operationsWorkspace } = useAppContext();

  const processSetupItems = [
    {
      isReady: operationsWorkspace.products.length > 0,
      label: copy("Product", "Ürün"),
      path: "/operations/products",
      readyCopy: copy("At least one product is defined.", "En az bir ürün tanımlı."),
      todoCopy: copy("Create a product before defining a process.", "Süreç tanımlamadan önce ürün oluşturun."),
    },
    {
      isReady: operationsWorkspace.machines.length > 0,
      label: copy("Machine", "Makine"),
      path: "/operations/machines-equipment",
      readyCopy: copy("At least one machine is defined.", "En az bir makine tanımlı."),
      todoCopy: copy("Add a machine with daily capacity inputs.", "Günlük kapasite girdileriyle bir makine ekleyin."),
    },
    {
      isReady: operationsWorkspace.workforce.length > 0,
      label: copy("Workforce", "İşgücü"),
      path: "/operations/resources",
      readyCopy: copy("At least one workforce role is defined.", "En az bir işgücü rolü tanımlı."),
      todoCopy: copy("Add a workforce role and hourly cost.", "İşgücü rolü ve saatlik maliyet ekleyin."),
    },
  ];
  const isProcessSetupReady = processSetupItems.every((item) => item.isReady);

  return (
    <DashboardLayout activePage={`operations/${activeOperationsSubmodule.key}`}>
      <section className="operations-workspace operations-modern operations-process-page">
        <div className="operations-header">
          <div>
            <span>
              {copy("Operations", "Operasyon")} / {copy("Process Definition", "Süreç Tanımlama")}
            </span>
            <h1>{copy("Process Definition", "Süreç Tanımlama")}</h1>
            <p>
              {copy(
                "Build a daily process plan only after the required product, machine, and workforce records exist.",
                "Gerekli ürün, makine ve işgücü kayıtları oluştuktan sonra günlük süreç planını kurun.",
              )}
            </p>
          </div>
          <div className="operations-actions">
            <button type="button" className="operations-refresh-button" onClick={loadOperationsData}>
              {copy("Refresh Data", "Verileri Yenile")}
            </button>
          </div>
        </div>
        {!isProcessSetupReady ? (
          <div className="process-setup-grid">
            {processSetupItems.map((item) => (
              <article
                className={`operation-card process-setup-card ${item.isReady ? "ready" : "todo"}`}
                key={item.label}
              >
                <div>
                  <mark>{item.isReady ? copy("Ready", "Hazır") : copy("Needed", "Gerekli")}</mark>
                  <h2>{item.label}</h2>
                  <p>{item.isReady ? item.readyCopy : item.todoCopy}</p>
                </div>
                <button type="button" onClick={() => goTo(item.path, "login")}>
                  {item.isReady ? copy("Review", "İncele") : copy("Add", "Ekle")}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <OperationPlanner />
        )}
      </section>
    </DashboardLayout>
  );
}
