export const ADMIN_UNAVAILABLE_MESSAGE = "Panel jest niedostępny: brakuje środowiskowej konfiguracji Firebase lub API.";

const environment = import.meta.env || {};

export const adminFirebaseConfig = {
  apiKey: environment.VITE_ADMIN_FIREBASE_API_KEY,
  authDomain: environment.VITE_ADMIN_FIREBASE_AUTH_DOMAIN,
  projectId: environment.VITE_ADMIN_FIREBASE_PROJECT_ID,
  appId: environment.VITE_ADMIN_FIREBASE_APP_ID,
};

export const adminApiOrigin = environment.VITE_ADMIN_API_ORIGIN;
export const adminAuthEmulatorOrigin = environment.VITE_ADMIN_AUTH_EMULATOR_ORIGIN;

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isLocalHttpOrigin(value) {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return value === url.origin && url.protocol === "http:"
      && loopbackHosts.has(url.hostname);
  } catch {
    return false;
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFirebaseConfig(value) {
  return Boolean(
    value
      && typeof value === "object"
      && isNonEmptyString(value.apiKey)
      && isNonEmptyString(value.authDomain)
      && isNonEmptyString(value.projectId)
      && isNonEmptyString(value.appId),
  );
}

function isHttpsOrigin(value) {
  if (!isNonEmptyString(value)) return false;

  const candidate = value.trim();
  if (candidate.includes("?") || candidate.includes("#")) return false;

  try {
    const url = new URL(candidate);
    return url.protocol === "https:"
      && url.pathname === "/"
      && !url.username
      && !url.password
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}

export function getAdminConfigurationError(config, apiOrigin, options = {}) {
  if (options.authEmulatorOrigin !== undefined && options.authEmulatorOrigin !== "") {
    return isFirebaseConfig(config) && options.development === true
      && loopbackHosts.has(options.hostname)
      && config.projectId === "demo-patternly-admin"
      && isLocalHttpOrigin(apiOrigin)
      && isLocalHttpOrigin(options.authEmulatorOrigin)
      ? "" : ADMIN_UNAVAILABLE_MESSAGE;
  }
  return isFirebaseConfig(config) && isHttpsOrigin(apiOrigin) ? "" : ADMIN_UNAVAILABLE_MESSAGE;
}
