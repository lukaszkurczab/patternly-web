import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPublicLegalArtifact, validatePublicLegalArtifact } from "../src/publicLegalArtifact.js";
import { availablePublicLegalLocales } from "../src/publicLegalLocales.js";
import { addSyntheticPublicLegalLocales, createAppProducedPublicLegalTestArtifact } from "./publicLegalTestArtifact.mjs";

const fixture = createAppProducedPublicLegalTestArtifact();
const expectedFingerprint = fixture.sourceFingerprint;

function productionContractFixture() {
  // Contract fixture only: no legal approval or publishable output is created.
  const copy = addSyntheticPublicLegalLocales(fixture, ["de", "fr", "es", "it", "et"]);
  copy.testOnly = false;
  copy.approvalStatus = "APPROVED";
  return copy;
}

test("production requires all seven locales in every localized field", () => {
  const complete = productionContractFixture();
  assert.equal(validatePublicLegalArtifact(complete, { expectedFingerprint }), complete);
  for (const locale of ["en", "pl", "de", "fr", "es", "it", "et"]) {
    for (const field of [complete.documentVersion, ...Object.values(complete.publicProfile).flatMap(Object.values), ...Object.values(complete.documents)]) {
      const original = field[locale];
      delete field[locale];
      assert.throws(() => validatePublicLegalArtifact(complete, { expectedFingerprint }), /invalid field/u);
      field[locale] = original;
    }
  }
  const unresolved = structuredClone(complete);
  unresolved.documents.privacyPolicy.fr += "\n[UNRESOLVED: privacy.processingRegisterDisclosure]";
  assert.throws(() => validatePublicLegalArtifact(unresolved, { expectedFingerprint }), /unresolved content/u);
  for (const approvalStatus of [undefined, null, "UNAPPROVED", "approved", true]) {
    assert.throws(() => validatePublicLegalArtifact({ ...complete, approvalStatus }, { expectedFingerprint }), /explicitly approved/u);
  }
  assert.throws(() => validatePublicLegalArtifact(complete, { expectedFingerprint, mode: "unknown" }), /Unsupported/u);
});

test("production pins exact export bytes even when the source fingerprint stays unchanged", () => {
  const directory = mkdtempSync(join(tmpdir(), "patternly-export-bytes-"));
  const artifactPath = join(directory, "legal.json");
  const complete = productionContractFixture();
  const bytes = `${JSON.stringify(complete, null, 2)}\n`;
  const environment = {
    PATTERNLY_PUBLIC_LEGAL_ARTIFACT_PATH: artifactPath,
    PATTERNLY_PUBLIC_LEGAL_EXPECTED_FINGERPRINT: expectedFingerprint,
    PATTERNLY_PUBLIC_LEGAL_EXPECTED_ARTIFACT_SHA256: createHash("sha256").update(bytes).digest("hex"),
  };
  try {
    writeFileSync(artifactPath, bytes);
    assert.deepEqual(loadPublicLegalArtifact(environment), complete);
    assert.throws(() => loadPublicLegalArtifact({ ...environment, PATTERNLY_PUBLIC_LEGAL_EXPECTED_ARTIFACT_SHA256: undefined }), /EXPECTED_ARTIFACT_SHA256/u);
    complete.documents.termsOfService.en += "\nChanged template prose with identical source variables.";
    writeFileSync(artifactPath, `${JSON.stringify(complete, null, 2)}\n`);
    assert.throws(() => loadPublicLegalArtifact(environment), /export bytes do not match/u);
    writeFileSync(artifactPath, JSON.stringify(productionContractFixture()));
    assert.throws(() => loadPublicLegalArtifact(environment), /export bytes do not match/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("accepts the marked local fixture only in local test mode", () => {
  assert.equal(validatePublicLegalArtifact(fixture, { expectedFingerprint, mode: "local-test" }), fixture);
  assert.equal(validatePublicLegalArtifact(fixture, { expectedFingerprint, mode: "contract-test" }), fixture);
  assert.throws(() => validatePublicLegalArtifact(fixture, { expectedFingerprint }), /test-only/u);
  assert.throws(() => validatePublicLegalArtifact(fixture, { expectedFingerprint, mode: "production" }), /test-only/u);
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

test("keeps legacy v1 artifacts limited to their required English and Polish content", () => {
  const legacy = structuredClone(fixture);
  for (const locale of ["de", "fr", "es", "it", "et"]) {
    delete legacy.documentVersion[locale];
    for (const profile of Object.values(legacy.publicProfile)) {
      for (const localized of Object.values(profile)) delete localized[locale];
    }
    for (const localized of Object.values(legacy.documents)) delete localized[locale];
  }
  assert.deepEqual(availablePublicLegalLocales(legacy), ["en", "pl"]);
  assert.equal(validatePublicLegalArtifact(legacy, { expectedFingerprint, mode: "local-test" }), legacy);
});

test("offers an additional locale only when every localized v1 field is complete", () => {
  const locales = ["en", "pl", "de", "fr", "es", "it", "et"];
  const complete = addSyntheticPublicLegalLocales(fixture, locales.slice(2));
  assert.deepEqual(availablePublicLegalLocales(complete), locales);
  assert.equal(validatePublicLegalArtifact(complete, { expectedFingerprint, mode: "local-test" }), complete);

  const incomplete = structuredClone(complete);
  delete incomplete.publicProfile.operator.taxIdentifier.et;
  incomplete.documentVersion.fr = " ";
  assert.deepEqual(availablePublicLegalLocales(incomplete), ["en", "pl", "de", "es", "it"]);
  assert.equal(validatePublicLegalArtifact(incomplete, { expectedFingerprint, mode: "local-test" }), incomplete);

  const brokenRequiredLocale = structuredClone(fixture);
  delete brokenRequiredLocale.documents.termsOfService.pl;
  assert.throws(() => validatePublicLegalArtifact(brokenRequiredLocale, { expectedFingerprint, mode: "local-test" }));
});
