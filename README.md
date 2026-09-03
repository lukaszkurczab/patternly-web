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

## Local administrator workspace

From `../patternly-backend`, run `npm run dev:admin`, then open
[http://127.0.0.1:25173/admin](http://127.0.0.1:25173/admin).
This starts the real local API and Firebase Auth/Firestore emulators, and supplies
all web configuration. Credentials and persistent local data are described in
`../patternly-backend/docs/local-admin.md`. No cloud account is needed.

`VITE_ADMIN_AUTH_EMULATOR_ORIGIN` explicitly selects the local SDK connection.
It is accepted only by Vite development mode, on a loopback browser host, with
HTTP loopback API/emulator origins and project `demo-patternly-admin`.
Production builds reject emulator configuration. Restart the dev server and
reload the page after changing Firebase environments.

Run `npm run test:admin-config` for configuration boundary checks. With the local
stack running, `npm run test:admin-local` checks real login, reads the existing
queue, verifies all eight configured publication tracks, opens a certification
question with its correct answer, checks usage statistics, and logs out; it does
not add or remove reports. Set
`ADMIN_BROWSER_EXECUTABLE` when using an installed Chrome instead of Playwright
Chromium.

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

Browser regression tests use Playwright and a separate local Vite server:

```sh
npx playwright install chromium
npm run test:admin-behavior
```

To use an installed browser instead, set `ADMIN_BROWSER_EXECUTABLE` to its
executable path. `ADMIN_BEHAVIOR_PORT` selects the isolated test port (25188 by
default). Firebase aliases exist only in the test runner, never in production
configuration. Tests exercise session races, timeouts, failed logout/retry,
access denial, status changes and uncertain writes. Use `npm run test:admin-local`
with the local stack running to check real Firebase SDK/Auth Emulator/API
login, queue retrieval and logout.

The panel provides overview, question search with track filtering and pagination,
full question/answer/explanation inspection, synchronized usage counts, and
report triage. Question statistics refer to the backend-selected immutable
publication, whose ID is shown separately from live deployment counts. Usage
counts describe stored synchronized records, including review deletion markers;
they are not active-user or session analytics. The backend owns publication
configuration and administrator authorization. Admin-specific styles live in
`admin.css`; public page typography does not control the dashboard.

## Production boundary

The administrator route reads its build-time configuration from `.env` (start
with `.env.example`): `VITE_ADMIN_FIREBASE_API_KEY`,
`VITE_ADMIN_FIREBASE_AUTH_DOMAIN`, `VITE_ADMIN_FIREBASE_PROJECT_ID`,
`VITE_ADMIN_FIREBASE_APP_ID`, and `VITE_ADMIN_API_ORIGIN`. The API origin must
be HTTPS. These Firebase web values are public client configuration, but service
account credentials must never be put in this project. Changing a value requires
a new build. Without a complete valid configuration the panel remains explicitly
unavailable. After sign-in, the browser sends only the Firebase ID token to the
backend API; it never reads Firestore directly and does not decide administrator
access.

The configured Firebase Hosting site is `https://patternly-app-sandbox.web.app`;
the administrator entry is `https://patternly-app-sandbox.web.app/admin`.
`firebase.json` deploys only `dist`, redirects `/admin/` and `/admin.html` to
that canonical path, and serves no SPA catch-all. The selected backend origin
is `https://patternly-backend-sandbox-ix2onccfaq-lm.a.run.app`.

The queue shows all non-closed reports. Use the action on each report to move it
through `open`, `in_review`, `resolved`, and `closed`. A server confirmation is
required before the displayed status changes. Refresh the queue after an access
denial, conflict, missing report, or uncertain write result.

Before publishing, build with the real public Firebase configuration and set
the backend's `ADMIN_WEB_ORIGIN` to `https://patternly-app-sandbox.web.app`.
The administrator account must support email/password sign-in and have a
verified email matching backend `ADMINISTRATOR_EMAIL`. The address is an
environment setting, not a frontend permission. Never put an administrator
password or service-account key in a `VITE_` variable.

Deploy from this repository with an explicit target project:

```sh
npm run build
npx -y firebase-tools@latest deploy --only hosting --project patternly-app-sandbox
```

This command publishes the build; local checks alone do not establish that
the panel is deployed. Backend deployment instructions are in
`../patternly-backend/docs/cloud-run-manual-deploy.md`.

The public page identifies the seller as Łukasz Kurczab and does not offer a
purchase action. Before a sales launch it still needs the seller's publishable
contact address, complete consumer documents, public origins, and a payment
integration.
