export const ADMIN_ROUTE_PATH = "/admin";

export const ADMIN_ROUTE_REDIRECT_PATHS = Object.freeze([
  "/admin/",
  "/admin.html",
]);

export function isCanonicalAdminPath(pathname) {
  return pathname === ADMIN_ROUTE_PATH;
}

export function getAdminRedirectPath(pathname) {
  return ADMIN_ROUTE_REDIRECT_PATHS.includes(pathname) ? ADMIN_ROUTE_PATH : null;
}
