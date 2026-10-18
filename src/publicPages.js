import { publicTrackPages } from './publicTrackPages.js';
import { availablePublicLegalLocales, publicLegalPath, PUBLIC_LEGAL_TITLES, PUBLIC_LEGAL_DESCRIPTIONS } from './publicLegalLocales.js';

export const publicOrigin = 'https://patternly.it';

// Routes, prerender, metadata and sitemap all use this projection. This does not grant R01 approval.
export function publicPages(legal) {
  return [
    { path: '/', template: 'index.html', kind: 'home', locale: 'en', title: 'Patternly — Build confidence through practice', description: 'Prepare for technical interviews and cloud certifications with practice questions and clear explanations.', indexable: true },
    ...publicTrackPages.map((page) => ({ ...page, template: 'index.html', kind: 'track', locale: 'en', indexable: true })),
    ...availablePublicLegalLocales(legal).flatMap((locale) => ['privacyPolicy', 'termsOfService'].map((document) => ({
      path: publicLegalPath(document, locale), template: document === 'privacyPolicy' ? 'privacy.html' : 'terms.html',
      kind: 'legal', document, locale, title: `${PUBLIC_LEGAL_TITLES[document][locale]} — Patternly`, description: PUBLIC_LEGAL_DESCRIPTIONS[document][locale],
      // A test export contains UNAPPROVED drafts. Never advertise them as indexable alternatives.
      // A production export still requires the separate, complete R01 acceptance before publication.
      indexable: legal.testOnly === false,
    }))),
  ];
}

export function publicPageFile(page) {
  return page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`;
}
