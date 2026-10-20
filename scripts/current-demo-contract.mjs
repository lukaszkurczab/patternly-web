import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = resolve(root, "../patternly");
const contentRoot = resolve(process.env.PATTERNLY_CONTENT_CURRENT_ROOT ?? resolve(root, "../patternly-content"));
export const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
export function currentDemoCatalog() {
  // Use the real producer: validation, current identity, exact locks and Free pools.
  return JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e",
    'import { createPublicDemoCatalog } from "./scripts/exportPublicDemo.mjs"; console.log(JSON.stringify(await createPublicDemoCatalog()));'],
  { cwd: appRoot, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }));
}
export function assertCurrentDemoCatalog(actual, expected) {
  assert.deepEqual(actual, expected, "Public demo differs from the validated current-source projection.");
}
export function verifyCurrentDemoCatalog() {
  const catalog = readJson(resolve(root, "src/generated/demoQuestions.json"));
  assertCurrentDemoCatalog(catalog, currentDemoCatalog());
  return catalog;
}
export function assertCaptureQuestion({ historicalBytes, manifest, sample, currentQuestion }) {
  assert.equal(createHash("sha256").update(historicalBytes).digest("hex"), manifest.syntheticProgressFixture.sourceArtifactSha256,
    "Historical capture bank differs from its recorded hash.");
  const historical = JSON.parse(historicalBytes);
  assert.equal(historical.trackId, sample.trackId);
  const matches = historical.questions.filter((question) => question.questionId === sample.questionId);
  assert.equal(matches.length, 1, "Historical capture question is missing or ambiguous.");
  assert.ok(currentQuestion, "Current capture source question is missing.");
  assert.deepEqual(currentQuestion, matches[0], "The current image question differs from the historical capture question.");
}
export function verifyCaptureQuestion(catalog) {
  const manifest = readJson(resolve(root, "scripts/app-preview-manifest.json"));
  const sample = catalog.publicSamples.find((entry) => entry.presentation === "image");
  assert.ok(sample, "Image sample metadata is missing.");
  assert.match(manifest.appSourceRevision, /^[a-f0-9]{7,40}$/u);
  const artifactPath = `src/content/generated/canonical-content/${sample.trackId}.json`;
  const historicalBytes = execFileSync("git", ["show", `${manifest.appSourceRevision}:${artifactPath}`],
    { cwd: appRoot, maxBuffer: 8 * 1024 * 1024 });
  const questions = readJson(resolve(contentRoot, sample.sourcePath));
  assert.equal(questions.filter((question) => question.questionId === sample.questionId).length, 1);
  assertCaptureQuestion({ historicalBytes, manifest, sample, currentQuestion: questions.find((question) => question.questionId === sample.questionId) });
  return { appSourceRevision: manifest.appSourceRevision, artifactPath, artifactSha256: manifest.syntheticProgressFixture.sourceArtifactSha256, questionId: sample.questionId };
}
