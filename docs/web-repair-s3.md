# Web repair S3 — concise public journey

Date: 2026-09-03

## Scope

Finish the public-page simplification after S2 without moving or changing the canonical practice component.

## Facts and assumptions

- The approved S3 contract scored a minimum of 0.88.
- The hero’s one normal-flow `#session` practice panel remains owned by S2; S3 changed only surrounding copy and dimensions.
- Desktop visual review and browser interaction checks remain controller-owned. W7 is still open for keyboard, narrow viewport, and zoom evidence.

## Changes

- Removed the redundant Evidence and Boundaries sections, their repeat CTAs, and their now-unreachable styles.
- Condensed the method into three steps: answer, see why, try again.
- Sent public primary CTAs to `#session`; the hero secondary action leads to tracks.
- Shortened hero copy and reduced hero/panel spacing so the question is reached sooner without fixed heights or clipping.
- Scoped the reduced heading sizes to `.hero h1`; shared/admin heading sizes retain their prior values.
- Updated README and semantic verifier expectations for the reduced public surface.

## Verification

- `npm run build` passed (59 modules transformed).
- `node scripts/verify-local.mjs` passed against `http://localhost:5173`.
- Rendered assertions confirm the one labelled question, four uniquely labelled radios, unique IDs, all primary CTA targets at `#session`, and eight inline track SVGs.
- `git diff --check` passed.
- Dead-code scan found no runtime Evidence/Boundaries section or associated styles.

## Unverified and risks

- Opera visual review is still required after this layout change.
- Browser interaction, keyboard focus, 320/390px viewport, and 200% zoom remain W7; no substitute test harness was added.
