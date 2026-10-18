import { useEffect } from "react";
import { Brand } from '../components/Brand';
import { AppAvailability } from '../components/AppAvailability';

const legal = __PATTERNLY_PUBLIC_LEGAL__;

export function PublicTrackPage({ page }) {
  useEffect(() => {
    document.documentElement.lang = "en";
    document.title = page.title;
  }, [page.title]);
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="legal-header"><Brand /><a href="/#tracks">All tracks</a></header>
    <main className="track-guide" id="main-content" tabIndex={-1}>
      <p className="eyebrow">Practice guide</p>
      <h1>{page.heading}</h1>
      <p className="track-guide-intro">{page.introduction}</p>
      {page.sections.map((section) => <section key={section.heading}>
        <h2>{section.heading}</h2>
        {section.steps && <ol>{section.steps.map((step) => <li key={step}>{step}</li>)}</ol>}
        {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </section>)}
      <section><h2>Sources and further study</h2><ul>{page.sources.map((source) => <li key={source.url}><a href={source.url}>{source.label}</a><p>{source.note}</p></li>)}</ul><p>This guide is published by {legal.publicProfile.operator.legalName.en}. For a content issue, <a href={`mailto:${encodeURIComponent(legal.publicProfile.operator.email.en)}`}>email the Patternly operator</a> with the track and the point you want to check.</p></section>
      <section><h2>Your next step</h2><p>{page.next.note}</p><a className="button button-primary" href={page.next.href}>{page.next.label}</a><AppAvailability /><p><a href="/#help">Free, Premium and questions about the app</a></p></section>
    </main>
    <footer className="legal-footer"><a href="/#tracks">All tracks</a><a href={legal.publicLinks.privacyUrl}>Privacy</a><a href={legal.publicLinks.termsUrl}>Terms</a><a href={legal.publicLinks.supportUrl}>Support</a></footer>
  </>;
}
