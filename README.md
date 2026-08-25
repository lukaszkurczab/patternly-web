# Patternly Web

Public, static-facing surface for Patternly. The homepage follows the current
Figma handoff: product surface, practice method, an inspectable session,
evidence-led next steps, track families, brand boundaries, and the administrator
entry point. It does not expose a purchase action.

Visual assets live under `assets/`: the canonical Patternly marks and the
generated `decision-field.png` / `evidence-plate.png` material studies used for
the hero and evidence surfaces.

The hero uses a pinned Three.js ES module from jsDelivr for the live WebGL
decision field. The local PNG remains an explicit visual fallback for browsers
without WebGL and for reduced-motion preferences.

## Local preview

Open `index.html` directly in a browser, or serve this repository with any
static HTTP server.

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
