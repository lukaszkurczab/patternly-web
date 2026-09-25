import assert from "node:assert/strict";
import test from "node:test";
import { loadPublicLegalArtifact } from "../src/publicLegalArtifact.js";
import { availablePublicLegalLocales } from "../src/publicLegalLocales.js";

test("accepts an explicitly supplied seven-locale test artifact from the app producer", () => {
  const artifact = loadPublicLegalArtifact(process.env, "contract-test");
  assert.equal(artifact.testOnly, true);
  assert.equal(artifact.sourceFingerprint, process.env.PATTERNLY_PUBLIC_LEGAL_EXPECTED_FINGERPRINT);
  assert.deepEqual(availablePublicLegalLocales(artifact), ["en", "pl", "de", "fr", "es", "it", "et"]);
});

test("production mode rejects the same app producer artifact marked test-only", () => {
  const expectedFingerprint = process.env.PATTERNLY_PUBLIC_LEGAL_EXPECTED_FINGERPRINT;
  assert.ok(expectedFingerprint, "PATTERNLY_PUBLIC_LEGAL_EXPECTED_FINGERPRINT must come from producer readiness");
  const artifactPath = process.env.PATTERNLY_PUBLIC_LEGAL_ARTIFACT_PATH;
  assert.ok(artifactPath, "PATTERNLY_PUBLIC_LEGAL_ARTIFACT_PATH must point to an app-produced artifact");
  assert.throws(() => loadPublicLegalArtifact({
    PATTERNLY_PUBLIC_LEGAL_ARTIFACT_PATH: artifactPath,
    PATTERNLY_PUBLIC_LEGAL_EXPECTED_FINGERPRINT: expectedFingerprint,
  }, "production"), /test-only/u);
});
