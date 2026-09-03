# Web repair S2 — one PostgreSQL practice flow

Date: 2026-09-03

## Scope

Replace the duplicate public SQL exercises with one accessible question in the hero, without restructuring the remaining public sections.

## Facts and assumptions

- The approved S2 contract scored a minimum of 0.88.
- The question uses a PostgreSQL B-tree scenario with an equality predicate on `customer_id` and a range predicate on `order_date`.
- The browser connector cannot exercise radio selection, details, retry, keyboard navigation, narrow viewports, or zoom. W7 remains open.

## Changes

- `InteractiveQuestion` now owns the sole selected-answer and details state. It renders the actual `#session` section, a labelled question heading, four native labelled radios, feedback, details, retry, and an honest no-saving note.
- The correct answer is `(customer_id, order_date)`. Each incorrect key order has its own feedback; the correct feedback does not promise a particular PostgreSQL plan.
- The hero mounts that component in normal document flow. The duplicate `SessionSection`, its second state, and the absolute/fixed-height hero construction are removed.
- Removed `DecisionField.jsx` and all CSS that only served the removed decision graphic or duplicate cards.
- Updated README and the local verifier. The verifier now checks rendered question structure and identifier relationships instead of requiring prior copy or component details.
- Corrected the S1 track-card invariant while editing the same CSS: removed `margin-top: auto` from the text block, so variable-height descriptions remain naturally below the fixed icon margin instead of being pushed to the card bottom.

## Verification

- `npm run build` passed (59 modules transformed).
- `node scripts/verify-local.mjs` passed against `http://localhost:5173`.
- Rendered verification confirms one radiogroup, four uniquely identified labelled radios, one labelled `#session` target with a question heading, unique public IDs, and the eight S1 track SVG wrappers.
- `git diff --check` passed.
- Dead-code scan found no remaining decision graphic, duplicate-question component, prior session layout, or S1 text-block bottom-alignment rule in runtime source or styles.

## Unverified and risks

- Interaction state transitions and keyboard focus behavior need browser-capable W7 verification; no fake harness was added.
- S3 still owns removal of the redundant Evidence and Boundaries sections and the remaining page-wide spacing work.
