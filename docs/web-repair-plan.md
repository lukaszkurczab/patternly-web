# Web repair — canonical resume plan
Updated 2026-09-03. This file is the current source of task status after context compression.

## Goal and boundaries
Completed repair goal in task `01a065b0-78d0-7090-9162-6cff966ea383`: repair public web icons/cards, one correct SQL practice flow, repetitive sections and spacing; obtain independent validation and QA; verify the running app.

Work only in `patternly-web`. Preserve eight tracks, English copy, brand and admin routes. No backend/mobile/schema changes, dependencies or purchase functionality. The user subsequently authorized commit and push after final checks; no separate deployment action is requested. One write worker at a time; independent QA is read-only. Preserve pre-existing edits. Before each change, assess architecture, clarity, safety and maintainability; minimum score must be >= 0.8.

## Current ledger
| ID | Status | Problem and resolution |
|---|---|---|
| V1 | PASS | Independent plan validator approved revised plan, minimum 0.88. |
| W1 | desktop verified | Eight solid mask squares replaced with exact inline mobile SVGs; all eight mint shapes seen in Opera. |
| W2 | desktop verified | Removed card bottom alignment, including residual auto margin; descriptions use body font. |
| W3 | implemented / code QA PASS | Explicit PostgreSQL B-tree question, distinct answers, specific feedback without optimizer guarantees. Independent content/code review passed. |
| W4 | implemented / code QA PASS | One question and state owner, real #session anchor, nearby feedback/details/reset; duplicate question and DecisionField deleted. |
| W5 | desktop verified | Removed repetitive Evidence/Boundaries sections; three-step Method; primary actions lead to #session. |
| W6 | desktop verified | Shorter heading and spacing, intrinsic normal-flow question panel. Narrow screen and zoom verification outstanding. |
| W7 | skipped by user instruction / unverified | Radio/details/reset interaction, keyboard/focus, 320/390px layouts, 200% zoom. User authorized one local automation attempt and explicitly instructed skipping on renewed failure. Attempt failed; these checks did not pass and are no longer a completion gate. |
| Q1 | fixed / QA PASS | Static and runtime public titles aligned; Opera tab title also confirmed. |
| Q2 | fixed / QA PASS | Controlled details element stays mounted with hidden; semantic assertion passed. |

## Resume: current outcome
S1–S4 implementation and independent code QA are finished. Read this file, `git status`, and [S4 report](web-repair-s4.md) before new work. No worker is writing. Do not restart completed slices or retry browser automation without a new reason.

User explicitly authorized trying a local automated browser and skipping W7 if it failed again, returning to Opera. On 2026-09-03 the browser setup again failed with `trusted Node process exited unexpectedly; kernel reset`. No further retries or alternate automation stack were attempted.

Returned to Opera: navigation to `http://localhost:5173/#session` and accessibility content succeeded, confirming the current title, one labelled four-option question, feedback/details/reset controls, three Method steps and eight tracks. This is a read-only content check, not an interaction test. A fresh screenshot attempt then failed; connector reported `Browser not connected` and requested Allow AI connection / Opera sign-in. Previous saved after screenshots remain the visual evidence; no fresh screenshot is claimed.

The requested repair is complete with W7 explicitly skipped by the user's decision. Browser reconnection is needed for further live Opera inspection if disconnection persists. No deployment was performed.

## Canonical implementation
- Eight repository-owned SVGs imported with Vite `?raw`, exact static markup inside an aria-hidden wrapper. Wrapper supplies mint currentColor; SVG size 32px. Source safety scan passed; no user/API/runtime markup allowed. Assets match mobile byte-for-byte. No mask, image recoloring, second renderer or new library.
- InteractiveQuestion owns the only selected/details state. Hero contains one normal-flow question panel with `id=session`, a real associated heading and native labelled radios. PublicPage owns no question state. No absolute panel or fixed-height clipping.
- PostgreSQL context: `WHERE customer_id = $1 AND order_date >= CURRENT_DATE - INTERVAL '30 days'`. Correct B-tree order `(customer_id, order_date)`; distractors `(order_date, customer_id)`, `(customer_id)`, `(customer_id, status, order_date)`. Explain equality then range, not textual predicate order or guaranteed scan/plan. Planner still considers data and costs.
- Public page is Hero + Method + eight Tracks + Footer. Track cards remain informational. Copy is friendly and honest about no saved progress. Public heading CSS is scoped to `.hero h1` to preserve admin typography.

SQL sources: [PostgreSQL multicolumn indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html), [expression evaluation](https://www.postgresql.org/docs/current/sql-expressions.html#SYNTAX-EXPRESS-EVAL).

## Validation and execution history
Initial independent plan review FAILED: architecture 0.72, simplicity 0.82, safety 0.78, maintainability/verification 0.74; minimum 0.72. Reviewer identified underspecified SVG currentColor handling, overlapping layout ownership, unclear question/anchor state contract and brittle source-only assertions.

Revised plan fixed those contracts: exact static inline SVGs, S2 owns entire question/state/hero layout, S3 only content/visual polish, rendered semantic verifier, W7 explicitly required. Independent qa_terra revalidation PASSED: architecture 0.95, simplicity 0.91, safety 0.88, maintainability/verification 0.90; minimum **0.88**. Controller gates for S2 and S3 were also 0.88. Documentation consolidation gate: architecture 0.96, clarity 0.95, safety 0.95, maintainability 0.95; minimum 0.95. Consolidation removes stale competing NEXT instructions while preserving decisions and evidence.

- [S1 report](web-repair-s1.md): exact mobile SVG rendering/card typography. Build, live verifier, eight SVG/card assertions, safety scan, diff check passed. Opera confirmed shapes. Residual auto margin subsequently removed in S2.
- [S2 report](web-repair-s2.md): single canonical question, SQL feedback, accessible anchor, normal-flow hero. Build (59 modules), live verifier, semantic group/radio/label/anchor/unique-ID assertions and diff check passed.
- [S3 report](web-repair-s3.md): deleted repeated sections, shorter Method and hero, consistent CTAs. Build (59 modules), live verifier, semantic CTA checks and diff check passed. Opera confirmed desktop result.
- Initial final QA: FAIL on Q1/Q2 above. Otherwise confirmed exact mobile assets/map, one canonical question, valid SQL explanation, no retained DecisionField runtime references and no removed CSS overlap with admin. It explicitly did not verify W7.

Dead-code checks covered imports, exports, routes, styles, verifier and README. Removed DecisionField.jsx, duplicate question variants/arrays/state and Session section, Evidence/Boundaries and exclusively dependent styles. Retained SVG assets are canonical render inputs; retained shared styles serve admin/public routes. No fallback or fake interaction harness added.

Final independent QA recheck: **PASS for S4**, both findings resolved; admin title preserved, no new fallback, diff check clean. S4 gate minimum 0.91. [S4 report](web-repair-s4.md): build (59 modules), live verifier and focused title/details assertions passed. Controller confirmed updated Opera tab title. W7 was subsequently skipped by explicit user instruction after renewed automation failure; see current outcome above.

## Evidence and verification limits
[Original visual audit](evidence/web-repair-2026-09-03/audit.md) and six before screenshots are durable repo copies. After screenshots:
- [S1 tracks](evidence/web-repair-2026-09-03/s1-tracks-after.png)
- [S3 hero](evidence/web-repair-2026-09-03/s3-hero-after.png)
- [S3 tracks](evidence/web-repair-2026-09-03/s3-tracks-after.png)
- [S3 method](evidence/web-repair-2026-09-03/s3-method-after.png)

Opera direct connector works: tab `773011612`, `http://localhost:5173/` (rediscover tab if stale). Navigation, accessibility content and screenshots work. Connector has no click, keyboard or viewport controls. Generic Node REPL/Computer Use runtime crashed, including after reset. Text fragments did not scroll reliably; do not reuse them as evidence. Screenshots prove only the actual desktop view, not CSS viewport dimensions, zoom or interaction. Live verifier needs running Vite and may require network escalation.

## Repository and storage context
No web-specific AGENTS.md found; user AGENTS instructions apply. Pre-existing dirty paths at task start: README.md, index.html, scripts/verify-local.mjs, DecisionField.jsx, InteractiveQuestion.jsx, PublicPage.jsx, styles.css and untracked assets/icons. Do not attribute the whole diff solely to this repair or revert prior work.

Initial ENOSPC blocked plan writes. Only ignored reproducible web dist (~640KB) and node_modules/.vite (~3.9MB) were removed. Space later became available, builds regenerated outputs, all six before screenshots were copied from /tmp into the repo. Never remove unrelated user data to recover space.

Final documentation-update assessment: architecture 0.96, clarity 0.96, safety 0.95, maintainability 0.95; minimum 0.95. Records the user-authorized scope change and actual tool evidence without converting skipped checks into passing tests. No application code changed in this follow-up.

## Final pre-push check — 2026-09-03
User requested another Opera attempt and push if no remaining repair was found. Opera tab discovery, navigation to #tracks and full accessibility content succeeded; screenshot endpoint still returned Browser not connected. No fresh visual evidence is claimed. Earlier after screenshots and independent QA remain valid for the unchanged application code. W7 remains skipped per the prior explicit instruction.

Fresh production build passed (59 modules). The local verifier first could not access localhost inside the sandbox; rerun with network permission passed against the existing server at localhost:5173. Diff whitespace check passed. Fetched origin/main and confirmed local HEAD matched it before creating the repair commit. No new defect found in the available checks.

Publication scope: reviewed web source, exact mobile SVG copies, verifier, README, repair plan/reports and evidence. No credentials, runtime configuration changes or build outputs are included. Documentation and publication gate: architecture 0.95, clarity 0.95, safety 0.95, maintainability 0.95; minimum 0.95.
