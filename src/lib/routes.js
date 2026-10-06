// URL normalisation and which paths belong to the signed-in app.

export const routeAliasMap = {
  "/operations/process-definition": "/operations/data-entry",
  "/operations/process": "/operations/data-entry",
  "/operations/data": "/operations/data-entry",
};

export function normalizeRoutePath(pathname) {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return routeAliasMap[normalized] || normalized;
}

export const signedInRoutePrefixes = ["/dashboard", "/operations", "/sales-strategy", "/financial-modelling", "/simulation", "/reports", "/authorization"];

export function isSignedInRoute(routePath) {
  return signedInRoutePrefixes.some((prefix) => routePath === prefix || routePath.startsWith(`${prefix}/`));
}
