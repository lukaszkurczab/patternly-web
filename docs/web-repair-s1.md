# Web repair S1 — track SVG rendering

Date: 2026-09-03

## Scope

Repair the eight public track icons and their card alignment without changing the question flow or other sections.

## Facts and assumptions

- The eight SVGs in `assets/icons/` match the mobile `SelectTrackScreen` icon map.
- A source scan found no scripts, event attributes, `foreignObject`, `href`/`src`, `javascript:`, or `data:` content in those immutable local files.
- The approved S1 plan scored 0.88 minimum in independent validation.

## Changes

- Import each track SVG with Vite `?raw` and insert its unchanged static markup in an `aria-hidden` wrapper.
- Give the wrapper mint `currentColor`; size its SVG root to 32px inside the existing 48px tile.
- Remove the CSS-mask rendering path. Card content uses intrinsic flex spacing so all titles begin on the same row; descriptions explicitly use the body font.
- Extend the local verifier with SVG safety checks and rendered assertions for eight cards and eight wrapper SVG roots.

## Verification

- `npm run build` passed (60 modules transformed).
- `node scripts/verify-local.mjs` passed against the existing Vite server at `http://localhost:5173`; this includes the SVG source-safety scan and rendered assertions for eight track cards and eight wrapper SVG roots.
- `git diff --check` passed.
- A dead-code scan found no `TrackGlyph`, `track-glyph`, or CSS-mask path in `src` or `styles.css`.

## Unverified and risks

- Opera visual confirmation of both track rows is controller-owned.
- The current browser connector cannot verify narrow viewport, keyboard, or zoom behaviour; these remain outside S1.
