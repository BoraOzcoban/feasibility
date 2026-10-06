// Sidebar modules and submodules, labelled in the current language.

export function getNavigation(copy) {
  const dashboardModules = [
    {
      key: "operations",
      path: "/operations",
      label: copy("Operations", "Operasyon"),
      category: copy("Production", "Üretim"),
      tone: "operations",
    },
    {
      key: "sales-strategy",
      path: "/sales-strategy",
      label: copy("Sales Strategy", "Satış Stratejisi"),
      category: copy("Market", "Pazar"),
      tone: "sales",
    },
    {
      key: "financial-modelling",
      path: "/financial-modelling",
      label: copy("Financial Modelling", "Finansal Modelleme"),
      category: copy("Finance", "Finans"),
      tone: "finance",
    },
    {
      key: "simulation",
      path: "/simulation",
      label: copy("Simulation", "Simülasyon"),
      category: copy("Decision", "Karar"),
      tone: "decision",
    },
    {
      key: "reports",
      path: "/reports",
      label: copy("Reports", "Raporlar"),
      category: copy("Output", "Çıktı"),
      tone: "reports",
    },
  ];
  const operationsSubmodules = [
    { key: "resources", path: "/operations/resources", label: copy("Resources", "Kaynak") },
    { key: "products", path: "/operations/products", label: copy("Products", "Ürünler") },
    {
      key: "machines-equipment",
      path: "/operations/machines-equipment",
      label: copy("Machines & Equipment", "Makine & Ekipman"),
    },
    { key: "data-entry", path: "/operations/data-entry", label: copy("Process Definition", "Süreç Tanımlama") },
    {
      key: "active-processes",
      path: "/operations/active-processes",
      label: copy("Active Processes", "Mevcut Süreçler"),
    },
  ];
  const financialSubmodules = [
    {
      group: copy("Inputs", "Girdiler"),
      key: "inputs",
      path: "/financial-modelling/girdiler",
      label: copy("Inputs", "Girdiler"),
    },
    {
      group: copy("Loans", "Krediler"),
      key: "loans",
      path: "/financial-modelling/krediler",
      label: copy("Loans", "Krediler"),
    },
    {
      group: copy("Analysis", "Analiz"),
      key: "overview",
      path: "/financial-modelling/analiz",
      label: copy("Cost & Return", "Maliyet & Getiri"),
    },
  ];

  return { dashboardModules, financialSubmodules, operationsSubmodules };
}
