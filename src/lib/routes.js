// Path comparison ignores a trailing slash, which the route table also accepts.

export function normalizeRoutePath(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}
