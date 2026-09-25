import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPublicLegalArtifactForTest } from "../../patternly/scripts/exportPublicLegal.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../patternly");
const releaseSource = JSON.parse(readFileSync(resolve(appRoot, "config/public-legal.release.json"), "utf8"));

function syntheticValue(value, path = "legal") {
  if (Array.isArray(value)) return value.map((entry, index) => syntheticValue(entry, `${path}.${index}`));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, syntheticValue(entry, `${path}.${key}`)]));
  }
  if (typeof value === "string") return `Synthetic ${path}`;
  return value;
}

export function createAppProducedPublicLegalTestArtifact() {
  const source = syntheticValue(releaseSource);
  source.documentVersion = { en: "test-2026-09-24", pl: "test-2026-09-24" };
  source.publicLinks = {
    privacyUrl: "https://patternly.example/privacy",
    termsUrl: "https://patternly.example/terms",
    supportUrl: "https://patternly.example/support",
  };
  source.terms.operatorLegalName = { en: "<script>alert(1)</script>", pl: "<script>alert(1)</script>" };
  return buildPublicLegalArtifactForTest(source);
}

export function addSyntheticPublicLegalLocales(artifact, locales) {
  const copy = structuredClone(artifact);
  for (const locale of locales) {
    copy.documentVersion[locale] = `test-${locale}-2026-09-24`;
    for (const profile of Object.values(copy.publicProfile)) {
      for (const localized of Object.values(profile)) localized[locale] = `Synthetic ${locale} profile value`;
    }
    for (const localized of Object.values(copy.documents)) localized[locale] = `Synthetic ${locale} legal document`;
  }
  return copy;
}
