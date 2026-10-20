import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { currentDemoCatalog, assertCurrentDemoCatalog, assertCaptureQuestion, verifyCaptureQuestion } from "./current-demo-contract.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expected = currentDemoCatalog();
test("actual current-source catalog and historical image question pass", () => {
  assertCurrentDemoCatalog(JSON.parse(readFileSync(resolve(root, "src/generated/demoQuestions.json"))), expected);
  assert.ok(verifyCaptureQuestion(expected).artifactSha256);
});
for (const [name, mutate] of [
  ["source identity", (c) => { c.publicSamples[0].sourceInputFingerprint = "0".repeat(64); }],
  ["release identity", (c) => { c.demos[0].provenance.releaseId = "foreign"; }],
  ["app lock", (c) => { c.demos[0].provenance.appContentLockSha256 = "0".repeat(64); }],
  ["source path", (c) => { c.publicSamples[0].sourcePath = "content/foreign.json"; }],
  ["question payload", (c) => { c.demos[0].question.prompt += " changed"; }],
  ["Free modes", (c) => { c.demos[0].provenance.modeIds = ["premium"]; }],
  ["whole bank", (c) => { c.questionBank = [c.demos[0].question]; }],
  ["third interactive payload", (c) => { c.publicSamples[2].question = c.demos[0].question; }],
]) test(`reject changed ${name}`, () => {
  const catalog = structuredClone(expected);
  mutate(catalog);
  assert.throws(() => assertCurrentDemoCatalog(catalog, expected), /validated current-source projection/u);
});
test("capture binds exact historical bank and selected question, independent of current bank digest", () => {
  const manifest = JSON.parse(readFileSync(resolve(root, "scripts/app-preview-manifest.json")));
  const sample = expected.publicSamples[2];
  const historicalBytes = execFileSync("git", ["show", `${manifest.appSourceRevision}:src/content/generated/canonical-content/${sample.trackId}.json`], { cwd: resolve(root, "../patternly"), maxBuffer: 8 * 1024 * 1024 });
  const currentQuestion = JSON.parse(readFileSync(resolve(root, "../patternly-content", sample.sourcePath))).find((q) => q.questionId === sample.questionId);
  const input = { historicalBytes, manifest, sample, currentQuestion };
  assertCaptureQuestion(input);
  assertCaptureQuestion({ ...input, sample: { ...sample, artifactSha256: "0".repeat(64) } });
  assert.throws(() => assertCaptureQuestion({ ...input, currentQuestion: { ...currentQuestion, prompt: "Changed sample" } }), /differs from the historical capture/u);
  assert.throws(() => assertCaptureQuestion({ ...input, historicalBytes: Buffer.from("{}") }), /recorded hash/u);
  const bank = JSON.parse(historicalBytes);
  bank.questions = bank.questions.filter((q) => q.questionId !== sample.questionId);
  const missingBytes = Buffer.from(JSON.stringify(bank));
  assert.throws(() => assertCaptureQuestion({ ...input, historicalBytes: missingBytes, manifest: { syntheticProgressFixture: { sourceArtifactSha256: createHash("sha256").update(missingBytes).digest("hex") } } }), /missing or ambiguous/u);
});
