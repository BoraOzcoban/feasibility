import React from "react";
import { useAppContext } from "../app/AppContext";
import DashboardLayout from "../components/DashboardLayout";

export default function OperationsOverviewPage() {
  const { copy, goTo, operationsSubmodules } = useAppContext();

  return (
    <DashboardLayout activePage="operations">
      <section className="page">
        <div className="page-header">
          <div>
            <span>{copy("Production", "Üretim")}</span>
            <h1>{copy("Operations", "Operasyon")}</h1>
            <p>
              {copy(
                "Choose the operational workspace you want to work on: resources, products, machines, process definition, or active processes.",
                "Çalışmak istediğiniz operasyon alanını seçin: kaynaklar, ürünler, makineler, süreç tanımı veya mevcut süreçler.",
              )}
            </p>
          </div>
        </div>
        <div className="tile-grid">
          {operationsSubmodules.map((submodule) => (
            <article className="card tile" key={submodule.key}>
              <h2>{submodule.label}</h2>
              <p>
                {submodule.key === "resources" &&
                  copy(
                    "Define materials and workforce resources used in production plans.",
                    "Üretim planlarında kullanılan malzeme ve iş gücü kaynaklarını tanımlayın.",
                  )}
                {submodule.key === "products" &&
                  copy(
                    "Create products and connect their material recipes.",
                    "Ürünleri oluşturun ve malzeme reçetelerini bağlayın.",
                  )}
                {submodule.key === "machines-equipment" &&
                  copy(
                    "Manage machines and equipment before planning capacity.",
                    "Kapasite planlamadan önce makine ve ekipmanları yönetin.",
                  )}
                {submodule.key === "data-entry" &&
                  copy(
                    "Build and save daily process plans for feasibility analysis.",
                    "Fizibilite analizi için günlük süreç planları oluşturup kaydedin.",
                  )}
                {submodule.key === "active-processes" &&
                  copy(
                    "Review saved process plans and their latest feasibility output.",
                    "Kayıtlı süreç planlarını ve son fizibilite çıktılarını inceleyin.",
                  )}
              </p>
              <div className="button-row">
                <button type="button" onClick={() => goTo(submodule.path)}>
                  {copy("Open", "Aç")}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </DashboardLayout>
  );
}
