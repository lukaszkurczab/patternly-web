import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FINGERPRINT = /^[0-9a-f]{64}$/u;
const SCHEMA_VERSION = "patternly-public-legal-export-v1";
const locales = ["en", "pl"];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Public legal artifact has an invalid field (${field}).`);
  }
}

function requireHttpsUrl(value, field) {
  requireText(value, field);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Public legal artifact has an invalid HTTPS link (${field}).`);
  }
  if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) {
    throw new Error(`Public legal artifact has an invalid HTTPS link (${field}).`);
  }
}

function requireLegalPageUrl(value, field, expectedPath) {
  requireHttpsUrl(value, field);
  const parsed = new URL(value);
  if (parsed.pathname !== expectedPath || parsed.search || parsed.hash) {
    throw new Error(`Public legal artifact has a link that does not target ${expectedPath} (${field}).`);
  }
}

export function validatePublicLegalArtifact(artifact, { expectedFingerprint, mode = "production" } = {}) {
  if (!isRecord(artifact) || artifact.schemaVersion !== SCHEMA_VERSION) {
    throw new Error("Public legal artifact has an unsupported schema.");
  }
  if (typeof artifact.testOnly !== "boolean") {
    throw new Error("Public legal artifact is missing its testOnly marker.");
  }
  if (mode === "production" && artifact.testOnly) {
    throw new Error("Production builds cannot use a test-only public legal artifact.");
  }
  if (mode === "local-test" && !artifact.testOnly) {
    throw new Error("Local test builds require a test-only public legal artifact.");
  }
  if (!isRecord(artifact.documentVersion)) {
    throw new Error("Public legal artifact has an invalid document version.");
  }
  for (const locale of locales) requireText(artifact.documentVersion[locale], `documentVersion.${locale}`);
  if (typeof artifact.sourceFingerprint !== "string" || !FINGERPRINT.test(artifact.sourceFingerprint)) {
    throw new Error("Public legal artifact has an invalid source fingerprint.");
  }
  if (typeof expectedFingerprint !== "string" || !FINGERPRINT.test(expectedFingerprint)) {
    throw new Error("PATTERNLY_PUBLIC_LEGAL_EXPECTED_FINGERPRINT must be 64 lowercase hexadecimal characters.");
  }
  if (artifact.sourceFingerprint !== expectedFingerprint) {
    throw new Error("Public legal artifact fingerprint does not match PATTERNLY_PUBLIC_LEGAL_EXPECTED_FINGERPRINT.");
  }

  for (const profileName of ["controller", "operator"]) {
    const profile = artifact.publicProfile?.[profileName];
    if (!isRecord(profile)) throw new Error(`Public legal artifact is missing publicProfile.${profileName}.`);
    for (const field of ["legalName", "businessForm", "address", "email", "phone", "registrationNumber", "taxIdentifier"]) {
      const localized = profile[field];
      if (!isRecord(localized)) throw new Error(`Public legal artifact is missing publicProfile.${profileName}.${field}.`);
      for (const locale of locales) requireText(localized[locale], `publicProfile.${profileName}.${field}.${locale}`);
    }
  }
  requireLegalPageUrl(artifact.publicLinks?.privacyUrl, "publicLinks.privacyUrl", "/privacy");
  requireLegalPageUrl(artifact.publicLinks?.termsUrl, "publicLinks.termsUrl", "/terms");
  requireHttpsUrl(artifact.publicLinks?.supportUrl, "publicLinks.supportUrl");
  for (const document of ["privacyPolicy", "termsOfService"]) {
    const localized = artifact.documents?.[document];
    if (!isRecord(localized)) throw new Error(`Public legal artifact is missing documents.${document}.`);
    for (const locale of locales) requireText(localized[locale], `documents.${document}.${locale}`);
  }
  return artifact;
}

export function loadPublicLegalArtifact(environment = process.env, mode = "production") {
  if (mode !== "production" && mode !== "local-test") {
    throw new Error("PATTERNLY_PUBLIC_LEGAL_MODE must be production or local-test.");
  }
  const artifactPath = environment.PATTERNLY_PUBLIC_LEGAL_ARTIFACT_PATH;
  if (typeof artifactPath !== "string" || artifactPath.trim().length === 0) {
    throw new Error("PATTERNLY_PUBLIC_LEGAL_ARTIFACT_PATH is required for every build.");
  }
  let artifact;
  try {
    artifact = JSON.parse(readFileSync(resolve(artifactPath), "utf8"));
  } catch {
    throw new Error("Public legal artifact is missing or malformed.");
  }
  return validatePublicLegalArtifact(artifact, {
    expectedFingerprint: environment.PATTERNLY_PUBLIC_LEGAL_EXPECTED_FINGERPRINT,
    mode,
  });
}
