export const ADMIN_UNAVAILABLE_MESSAGE = "Panel jest niedostępny: brakuje środowiskowej konfiguracji Firebase lub API.";

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

export function getAdminConfigurationError(config, apiOrigin) {
  return isFirebaseConfig(config) && isHttpsOrigin(apiOrigin) ? "" : ADMIN_UNAVAILABLE_MESSAGE;
}
