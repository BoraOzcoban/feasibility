import React from "react";
import { Navigate, Outlet, createBrowserRouter, redirect } from "react-router";
import App from "../App";
import { useAppContext } from "./AppContext";
import { RouteErrorScreen } from "./ErrorScreen";
import AuthPage from "../pages/AuthPage";

// Each page is its own chunk, fetched the first time one of its URLs opens.
// The login form ships with the app so a signed-out visitor waits for nothing.
const lazyPage = (load) => ({ lazy: { Component: async () => (await load()).default } });

// Redirects that do not depend on data run as loaders, before anything renders.
const redirectTo = (path) => () => redirect(path);

// Redirects decided by app state. `force` lets them through the unsaved-changes guard.
function RedirectTo({ path }) {
  return <Navigate to={path} replace state={{ force: true }} />;
}

// Signed-out visitors see the login form at whatever URL they opened, and
// stay on that URL once they sign in.
function RequireSession() {
  const { session } = useAppContext();
  return session ? <Outlet /> : <AuthPage />;
}

// The login form, or the dashboard once signed in. A password recovery link
// also signs the user in, so the reset form stays until the password is set.
function LoginRoute() {
  const { mode, session } = useAppContext();
  return session && mode !== "reset" ? <RedirectTo path="/dashboard" /> : <AuthPage />;
}

// Variants are loaded after sign-in, so an unknown id is only sent back to
// the current situation once that load has finished.
function SimulationRoute() {
  const { activeSimulationVariant, planningLoaded } = useAppContext();
  if (activeSimulationVariant) return <Outlet />;
  return planningLoaded ? <RedirectTo path="/simulation/current-situation" /> : null;
}

const legacyRoutes = [
  { path: "dashboard/*", loader: redirectTo("/dashboard") },
  { path: "operations/process-definition", loader: redirectTo("/operations/data-entry") },
  { path: "operations/process", loader: redirectTo("/operations/data-entry") },
  { path: "operations/data", loader: redirectTo("/operations/data-entry") },
  { path: "operations/material-definitions", loader: redirectTo("/operations/resources") },
  { path: "operations/human-resources", loader: redirectTo("/operations/resources") },
  { path: "operations/*", loader: redirectTo("/operations") },
  { path: "financial-modelling", loader: redirectTo("/financial-modelling/girdiler") },
  { path: "financial-modelling/maliyet-hesaplama/*", loader: redirectTo("/financial-modelling/analiz") },
  { path: "financial-modelling/getiri-hesaplama/*", loader: redirectTo("/financial-modelling/analiz") },
  { path: "financial-modelling/*", loader: redirectTo("/financial-modelling/girdiler") },
  { path: "simulation", loader: redirectTo("/simulation/current-situation") },
  { path: "simulation/*", loader: redirectTo("/simulation/current-situation") },
];

const signedInRoutes = [
  { path: "dashboard", ...lazyPage(() => import("../pages/DashboardPage")) },
  { path: "operations", ...lazyPage(() => import("../pages/OperationsOverviewPage")) },
  { path: "operations/resources", ...lazyPage(() => import("../pages/ResourcesPage")) },
  { path: "operations/products", ...lazyPage(() => import("../pages/ProductsPage")) },
  { path: "operations/machines-equipment", ...lazyPage(() => import("../pages/MachinesEquipmentPage")) },
  { path: "operations/data-entry", ...lazyPage(() => import("../pages/ProcessDefinitionPage")) },
  { path: "operations/active-processes", ...lazyPage(() => import("../pages/ActiveProcessesPage")) },
  { path: "sales-strategy", ...lazyPage(() => import("../pages/SalesStrategyPage")) },
  { path: "financial-modelling/girdiler", ...lazyPage(() => import("../pages/FinancialModellingPage")) },
  { path: "financial-modelling/krediler", ...lazyPage(() => import("../pages/FinancialModellingPage")) },
  { path: "financial-modelling/analiz", ...lazyPage(() => import("../pages/FinancialModellingPage")) },
  {
    path: "simulation/:variantId",
    Component: SimulationRoute,
    children: [{ index: true, ...lazyPage(() => import("../pages/SimulationPage")) }],
  },
  { path: "reports", ...lazyPage(() => import("../pages/ReportsPage")) },
  { path: "reports/print/:packKey", ...lazyPage(() => import("../pages/PrintableReportPage")) },
  { path: "authorization", ...lazyPage(() => import("../pages/AuthorizationPage")) },
];

export const router = createBrowserRouter([
  {
    path: "/",
    Component: App,
    ErrorBoundary: RouteErrorScreen,
    HydrateFallback: () => null,
    children: [
      { index: true, loader: redirectTo("/login") },
      { path: "login", Component: LoginRoute },
      ...legacyRoutes,
      { Component: RequireSession, children: signedInRoutes },
      { path: "*", Component: LoginRoute },
    ],
  },
]);
