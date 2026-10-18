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

export const PUBLIC_LEGAL_TITLES = Object.freeze({
  privacyPolicy: {
    en: "Privacy policy", pl: "Polityka prywatności", de: "Datenschutzerklärung", fr: "Politique de confidentialité",
    es: "Política de privacidad", it: "Informativa sulla privacy", et: "Privaatsuspoliitika",
  },
  termsOfService: {
    en: "Terms of service", pl: "Warunki korzystania", de: "Nutzungsbedingungen", fr: "Conditions d’utilisation",
    es: "Términos del servicio", it: "Termini di servizio", et: "Kasutustingimused",
  },
});

export const PUBLIC_LEGAL_DESCRIPTIONS = Object.freeze({
  privacyPolicy: {
    en: "Read how Patternly handles personal data and how to contact us about privacy.",
    pl: "Przeczytaj, jak Patternly przetwarza dane osobowe i jak skontaktować się w sprawach prywatności.",
    de: "Erfahren Sie, wie Patternly personenbezogene Daten verarbeitet und wie Sie uns zum Datenschutz kontaktieren.",
    fr: "Découvrez comment Patternly traite les données personnelles et comment nous contacter au sujet de la confidentialité.",
    es: "Consulta cómo Patternly trata los datos personales y cómo contactar sobre privacidad.",
    it: "Scopri come Patternly tratta i dati personali e come contattarci per la privacy.",
    et: "Lugege, kuidas Patternly töötleb isikuandmeid ja kuidas meiega privaatsuse küsimustes ühendust võtta.",
  },
  termsOfService: {
    en: "Read the terms for using Patternly, the independent technical interview and certification practice tool.",
    pl: "Przeczytaj warunki korzystania z Patternly, niezależnego narzędzia do nauki przed rozmowami technicznymi i certyfikacją.",
    de: "Lesen Sie die Nutzungsbedingungen für Patternly, das unabhängige Lernwerkzeug für technische Interviews und Zertifizierungen.",
    fr: "Consultez les conditions d’utilisation de Patternly, outil indépendant de préparation aux entretiens techniques et aux certifications.",
    es: "Consulta los términos de uso de Patternly, herramienta independiente de práctica para entrevistas técnicas y certificaciones.",
    it: "Leggi i termini di utilizzo di Patternly, strumento indipendente di preparazione a colloqui tecnici e certificazioni.",
    et: "Lugege Patternly kasutustingimusi tehnilisteks intervjuudeks ja sertifitseerimiseks harjutamisel.",
  },
});

export function publicLegalPath(document, locale) {
  const name = document === "termsOfService" ? "terms" : "privacy";
  return `${locale === "en" ? "" : `/${locale}`}/${name}`;
}

export function publicLegalRoute(pathname, artifact) {
  const path = pathname.replace(/\.html$/u, "");
  for (const locale of availablePublicLegalLocales(artifact)) {
    for (const document of ["privacyPolicy", "termsOfService"]) {
      if (path === publicLegalPath(document, locale)) return { document, locale };
    }
  }
  return null;
}
