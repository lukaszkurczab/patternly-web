# Patternly Web

Public, static-facing surface for Patternly. It introduces the product, its
Free and Premium access, and the administrator entry point.

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
