# Patternly Web

Public, static-facing surface for Patternly. It introduces the product, its
Free and Premium access, and the administrator entry point.

## Local preview

Open `index.html` directly in a browser, or serve this repository with any
static HTTP server.

## Production boundary

The administrator route is intentionally unavailable until Firebase web
configuration and the backend's configured administrator identity are
available. It does not expose learner data in the browser.

The public page identifies the seller as Łukasz Kurczab and does not offer a
purchase action. Before a sales launch it still needs the seller's publishable
contact address, complete consumer documents, public origins, and a payment
integration.
