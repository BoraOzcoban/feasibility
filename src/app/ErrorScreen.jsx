import React from "react";
import { useRouteError } from "react-router";

// Shown instead of a blank page when rendering throws.
export function ErrorScreen({ error }) {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Atera</h1>
        <p className="status-message">{error?.message || "A runtime error prevented the page from rendering."}</p>
      </section>
    </main>
  );
}

// The router catches errors thrown inside routes before any outer boundary.
export function RouteErrorScreen() {
  return <ErrorScreen error={useRouteError()} />;
}
