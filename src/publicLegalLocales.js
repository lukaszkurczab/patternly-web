export const PUBLIC_LEGAL_LOCALE_LABELS = Object.freeze({
  en: "English",
  pl: "Polski",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  et: "Eesti",
});

const LOCALIZED_PROFILE_FIELDS = ["legalName", "businessForm", "address", "email", "phone", "registrationNumber", "taxIdentifier"];

function hasLocaleContent(artifact, locale) {
  if (typeof artifact.documentVersion?.[locale] !== "string" || artifact.documentVersion[locale].trim().length === 0) return false;
  for (const profileName of ["controller", "operator"]) {
    for (const field of LOCALIZED_PROFILE_FIELDS) {
      const value = artifact.publicProfile?.[profileName]?.[field]?.[locale];
      if (typeof value !== "string" || value.trim().length === 0) return false;
    }
  }
  for (const document of ["privacyPolicy", "termsOfService"]) {
    const value = artifact.documents?.[document]?.[locale];
    if (typeof value !== "string" || value.trim().length === 0) return false;
  }
  return true;
}

export function availablePublicLegalLocales(artifact) {
  return Object.keys(PUBLIC_LEGAL_LOCALE_LABELS).filter((locale) => hasLocaleContent(artifact, locale));
}
