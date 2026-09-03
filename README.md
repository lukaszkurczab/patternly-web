# Patternly Web

React/Vite surface for Patternly. The homepage introduces interview and certification practice through one
interactive SQL example, a concise practice method, eight learning tracks, and the administrator entry point.
Track SVGs in `assets/icons` are copied unchanged from the mobile app’s
`src/assets/icons`, using its `SelectTrackScreen` icon mapping.
It does not expose a purchase action.

The page uses React components for the public experience and `/admin`, with the
visual system kept in `styles.css`. The hero contains one local SQL practice
question with answer feedback, details, and retry controls; it does not save
progress or schedule reviews. Manrope and IBM Plex Sans are bundled locally
through Fontsource.

Vite builds two thin HTML entry documents—`index.html` for `/` and `admin.html`
for the canonical `/admin` route—that both load `src/main.jsx`. The Vite dev and
preview servers redirect `/admin/` and `/admin.html` to `/admin`, so those paths
are not separate administrator routes. The administrator entry carries static
`noindex,nofollow` metadata in the direct HTTP response; the public entry has no
global robots exclusion.

## Local development

Requirements: Node.js 20.19 or newer.

```sh
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The administrator surface
is available at [http://localhost:5173/admin](http://localhost:5173/admin).

For a production-shaped local check:

```sh
npm run build
npm run preview
```

The local verifier builds first, checks direct requests to `/`, `/admin`,
`/admin/`, and `/admin.html`, and validates the explicitly unavailable admin
configuration without contacting external services:

```sh
npm run verify:local
```

The verifier also renders the public React tree through Vite's SSR transform,
which catches undefined render-time dependencies that a production build alone
does not detect. It does not claim browser layout, viewport behavior, visual
quality, or complete accessibility conformance; those still require browser QA.

## Production boundary

The administrator route requires deployment-time `window.PATTERNLY_ADMIN_CONFIG`
with the real Firebase web configuration and
`window.PATTERNLY_ADMIN_API_ORIGIN` with the HTTPS backend origin. Without both
values it remains explicitly unavailable. After sign-in, the browser sends only
the Firebase ID token to the backend API; it never reads Firestore directly and
does not decide administrator access.

The public page identifies the seller as Łukasz Kurczab and does not offer a
purchase action. Before a sales launch it still needs the seller's publishable
contact address, complete consumer documents, public origins, and a payment
integration.
