import { Brand } from "../components/Brand";
import { useEffect, useState } from "react";
import { availablePublicLegalLocales, PUBLIC_LEGAL_LOCALE_LABELS } from "../publicLegalLocales.js";

const legal = __PATTERNLY_PUBLIC_LEGAL__;
const availableLocales = availablePublicLegalLocales(legal);
const labels = {
  privacyPolicy: {
    en: "Privacy policy", pl: "Polityka prywatności", de: "Datenschutzerklärung", fr: "Politique de confidentialité",
    es: "Política de privacidad", it: "Informativa sulla privacy", et: "Privaatsuspoliitika",
  },
  termsOfService: {
    en: "Terms of service", pl: "Warunki korzystania", de: "Nutzungsbedingungen", fr: "Conditions d’utilisation",
    es: "Términos del servicio", it: "Termini di servizio", et: "Kasutustingimused",
  },
};

function Document({ title, document, version, locale, onLocaleChange }) {
  const text = legal.documents[document][locale];
  const paragraphs = text.split(/\n{2,}/u).map((paragraph) => paragraph.trim()).filter(Boolean);

  return (
    <>
      <header className="legal-header">
        <Brand className="legal-brand" />
        <label className="legal-locale-label" htmlFor="legal-locale">Language</label>
        <select id="legal-locale" className="legal-locale" value={locale} onChange={(event) => onLocaleChange(event.target.value)}>
          {availableLocales.map((availableLocale) => <option key={availableLocale} value={availableLocale}>{PUBLIC_LEGAL_LOCALE_LABELS[availableLocale]}</option>)}
        </select>
      </header>
      <main className="legal-document" id="main-content">
        <a className="legal-back" href="/">← Patternly</a>
        <p className="eyebrow">Legal information</p>
        <h1>{title}</h1>
        <p className="legal-version">Document version: {version}</p>
        <article className="legal-copy" lang={locale}>
          {paragraphs.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>)}
        </article>
      </main>
      <footer className="legal-footer"><a href={legal.publicLinks.privacyUrl}>Privacy</a><a href={legal.publicLinks.termsUrl}>Terms</a><a href={legal.publicLinks.supportUrl}>Support</a></footer>
    </>
  );
}

export function PublicLegalPage({ document, initialLocale = "en" }) {
  const [locale, setLocale] = useState(availableLocales.includes(initialLocale) ? initialLocale : "en");
  useEffect(() => {
    window.document.documentElement.lang = locale;
    window.document.title = `${labels[document][locale]} — Patternly`;
  }, [document, locale]);
  return <Document
    title={labels[document][locale]}
    document={document}
    version={legal.documentVersion[locale]}
    locale={locale}
    onLocaleChange={setLocale}
  />;
}
