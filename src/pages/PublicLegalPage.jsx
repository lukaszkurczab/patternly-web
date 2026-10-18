import { useEffect } from "react";
import { useClientReady } from "../hooks/useClientReady";
import { Brand } from "../components/Brand";
import { availablePublicLegalLocales, PUBLIC_LEGAL_LOCALE_LABELS, PUBLIC_LEGAL_TITLES, publicLegalPath } from "../publicLegalLocales.js";

const legal = __PATTERNLY_PUBLIC_LEGAL__;
const availableLocales = availablePublicLegalLocales(legal);

function Document({ title, document, version, locale, onLocaleChange, ready }) {
  const text = legal.documents[document][locale];
  const paragraphs = text.split(/\n{2,}/u).map((paragraph) => paragraph.trim()).filter(Boolean);

  return (
    <>
      <header className="legal-header">
        <Brand className="legal-brand" />
        <label className="legal-locale-label" htmlFor="legal-locale">Language</label>
        <select disabled={!ready} id="legal-locale" className="legal-locale" value={locale} onChange={(event) => onLocaleChange(event.target.value)}>
          {availableLocales.map((availableLocale) => <option key={availableLocale} value={availableLocale}>{PUBLIC_LEGAL_LOCALE_LABELS[availableLocale]}</option>)}
        </select>
      </header>
      <main className="legal-document" id="main-content">
        <a className="legal-back" href="/">← Patternly</a>
        <p className="eyebrow">Legal information</p>
        <h1>{title}</h1>
        <p className="legal-version">Document version: {version}</p>
        <nav className="legal-language-links" aria-label="Document languages">
          {availableLocales.map((language) => <a key={language} href={publicLegalPath(document, language)} lang={language} aria-current={language === locale ? "page" : undefined}>{PUBLIC_LEGAL_LOCALE_LABELS[language]}</a>)}
        </nav>
        <article className="legal-copy" lang={locale}>
          {paragraphs.map((paragraph, index) => <p
            key={`${index}-${paragraph.slice(0, 24)}`}
            id={document === "termsOfService" && /^16\.\s/u.test(paragraph) ? "support" : undefined}
          >{paragraph}</p>)}
        </article>
      </main>
      <footer className="legal-footer"><a href={publicLegalPath("privacyPolicy", locale)}>{PUBLIC_LEGAL_TITLES.privacyPolicy[locale]}</a><a href={publicLegalPath("termsOfService", locale)}>{PUBLIC_LEGAL_TITLES.termsOfService[locale]}</a><a href={`${publicLegalPath("termsOfService", locale)}#support`}>Support</a></footer>
    </>
  );
}

export function PublicLegalPage({ document, initialLocale = "en" }) {
  const ready = useClientReady();
  if (!availableLocales.includes(initialLocale)) throw new Error("Legal document locale is unavailable.");
  const locale = initialLocale;
  useEffect(() => {
    window.document.documentElement.lang = locale;
    window.document.title = `${PUBLIC_LEGAL_TITLES[document][locale]} — Patternly`;
  }, [document, locale]);
  return <Document
    ready={ready}
    title={PUBLIC_LEGAL_TITLES[document][locale]}
    document={document}
    version={legal.documentVersion[locale]}
    locale={locale}
    onLocaleChange={(language) => window.location.assign(`${publicLegalPath(document, language)}${window.location.hash}`)}
  />;
}
