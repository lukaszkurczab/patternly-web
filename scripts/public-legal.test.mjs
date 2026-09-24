import assert from "node:assert/strict";
import test from "node:test";
import { validatePublicLegalArtifact } from "../src/publicLegalArtifact.js";
import { createAppProducedPublicLegalTestArtifact } from "./publicLegalTestArtifact.mjs";

const fixture = createAppProducedPublicLegalTestArtifact();
const expectedFingerprint = fixture.sourceFingerprint;

test("accepts the marked local fixture only in local test mode", () => {
  assert.equal(validatePublicLegalArtifact(fixture, { expectedFingerprint, mode: "local-test" }), fixture);
  assert.throws(() => validatePublicLegalArtifact(fixture, { expectedFingerprint }), /test-only/u);
});

test("rejects absent or malformed artifact contract fields", () => {
  for (const mutate of [
    (copy) => { copy.schemaVersion = "other"; },
    (copy) => { delete copy.testOnly; },
    (copy) => { delete copy.publicProfile.operator.legalName.en; },
    (copy) => { copy.publicLinks.supportUrl = "http://example.invalid"; },
    (copy) => { copy.publicLinks.privacyUrl = "https://example.invalid/privacy-policy"; },
    (copy) => { copy.publicLinks.termsUrl = "https://example.invalid/terms?source=footer"; },
    (copy) => { delete copy.documents.privacyPolicy.pl; },
    (copy) => { copy.documentVersion.en = " "; },
  ]) {
    const copy = structuredClone(fixture);
    mutate(copy);
    assert.throws(() => validatePublicLegalArtifact(copy, { expectedFingerprint, mode: "local-test" }));
  }
});

test("requires a readiness fingerprint and rejects mismatches", () => {
  assert.throws(() => validatePublicLegalArtifact(fixture, { mode: "local-test" }), /EXPECTED_FINGERPRINT/u);
  assert.throws(() => validatePublicLegalArtifact(fixture, { expectedFingerprint: "f".repeat(64), mode: "local-test" }), /does not match/u);
  assert.throws(() => validatePublicLegalArtifact(fixture, { expectedFingerprint: "F".repeat(64), mode: "local-test" }), /lowercase hexadecimal/u);
});

test("rejects a production artifact in the local-only build mode", () => {
  const production = { ...fixture, testOnly: false };
  assert.throws(() => validatePublicLegalArtifact(production, { expectedFingerprint, mode: "local-test" }), /test-only/u);
});
