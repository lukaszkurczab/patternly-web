# ODK-117/B-CONTRACT — Web report

Status: done; locally verified with the app producer's seven-locale test artifact; independent QA PASS WITH ISSUES before this documentation correction.

## Scope and behavior

- Kept `patternly-public-legal-export-v1` unchanged and retained EN/PL as the only required locales.
- Public legal pages offer `de`, `fr`, `es`, `it`, and `et` only when the document version, all seven localized controller and operator fields, and both rendered legal documents are non-empty for that locale. An incomplete optional locale is omitted without invalidating EN/PL.
- Added a small explicit selector-label map and localized page titles. The selected locale drives document content, `lang`, and displayed document version.
- Production validation continues to reject `testOnly` artifacts and to compare the artifact fingerprint against the separately supplied readiness fingerprint.
- Added `npm run test:public-legal:producer`, which requires an explicit producer artifact path and expected fingerprint, validates seven locales in the dedicated `contract-test` mode, then asserts that production rejects this same `testOnly` artifact. The hook has no fixture fallback.
- No legal document text was authored or copied into the web repository.

## Verification

- `npm run test:public-legal`: passed, 6/6.
- `npm run verify:local`: passed. This builds the local-test site and checks the legacy EN/PL artifact, seven-locale SSR rendering, public routes, and existing local admin boundary.
- `git diff --check`: passed.
- `npm run test:public-legal:producer`: passed, 2/2, using the app-produced artifact in `/tmp` and a separately calculated fingerprint (`4fbdb23b…adbdb8c`). Contract-test accepted all seven locales; production rejected the same `testOnly` artifact.
- No deployment, commit, or push was performed for this web-only subtask.

## Review

Implementation briefings independently approved by GPT-6 Luna High. Initial locale-completeness scope scored minimum 0.89; the updated producer hook contract scored consistency 0.92, simplicity 0.86, risk 0.88, maintainability 0.89 (minimum 0.86). The contract-test mode consumes the producer's explicit test-only output while production remains strict. Independent cross-repo QA issued `PASS WITH ISSUES`; the only actionable issue was stale app/web reporting, corrected before commit. Production release readiness remains blocked by intentionally incomplete ODK-116-B values, outside B-CONTRACT.
