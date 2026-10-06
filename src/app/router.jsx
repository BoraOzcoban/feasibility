import React from "react";
import { Navigate, Outlet, createBrowserRouter, redirect } from "react-router";
import App from "../App";
import { useAppContext } from "./AppContext";
import { RouteErrorScreen } from "./ErrorScreen";
import ActiveProcessesPage from "../pages/ActiveProcessesPage";
import AuthPage from "../pages/AuthPage";
import AuthorizationPage from "../pages/AuthorizationPage";
import DashboardPage from "../pages/DashboardPage";
import FinancialModellingPage from "../pages/FinancialModellingPage";
import MachinesEquipmentPage from "../pages/MachinesEquipmentPage";
import OperationsOverviewPage from "../pages/OperationsOverviewPage";
import PrintableReportPage from "../pages/PrintableReportPage";
import ProcessDefinitionPage from "../pages/ProcessDefinitionPage";
import ProductsPage from "../pages/ProductsPage";
import ReportsPage from "../pages/ReportsPage";
import ResourcesPage from "../pages/ResourcesPage";
import SalesStrategyPage from "../pages/SalesStrategyPage";
import SimulationPage from "../pages/SimulationPage";

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
  if (activeSimulationVariant) return <SimulationPage />;
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
  { path: "dashboard", Component: DashboardPage },
  { path: "operations", Component: OperationsOverviewPage },
  { path: "operations/resources", Component: ResourcesPage },
  { path: "operations/products", Component: ProductsPage },
  { path: "operations/machines-equipment", Component: MachinesEquipmentPage },
  { path: "operations/data-entry", Component: ProcessDefinitionPage },
  { path: "operations/active-processes", Component: ActiveProcessesPage },
  { path: "sales-strategy", Component: SalesStrategyPage },
  { path: "financial-modelling/girdiler", Component: FinancialModellingPage },
  { path: "financial-modelling/krediler", Component: FinancialModellingPage },
  { path: "financial-modelling/analiz", Component: FinancialModellingPage },
  { path: "simulation/:variantId", Component: SimulationRoute },
  { path: "reports", Component: ReportsPage },
  { path: "reports/print/:packKey", Component: PrintableReportPage },
  { path: "authorization", Component: AuthorizationPage },
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
