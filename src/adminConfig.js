export const ADMIN_UNAVAILABLE_MESSAGE = "Panel jest dostępny tylko lokalnie z konfiguracją Firebase Auth, API i emulatorów.";

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

export function getAdminConfigurationError(config, apiOrigin, options = {}) {
  return isFirebaseConfig(config) && options.development === true
    && loopbackHosts.has(options.hostname)
    && config.projectId === "demo-patternly-admin"
    && isLocalHttpOrigin(apiOrigin)
    && isLocalHttpOrigin(options.authEmulatorOrigin)
    ? "" : ADMIN_UNAVAILABLE_MESSAGE;
}
