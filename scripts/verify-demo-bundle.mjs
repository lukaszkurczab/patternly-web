import { verifyCurrentDemoCatalog, verifyCaptureQuestion } from "./current-demo-contract.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, process.env.PATTERNLY_WEB_TEST_OUT_DIR ?? "dist");
const catalog = verifyCurrentDemoCatalog();
verifyCaptureQuestion(catalog);
assert.equal(catalog.schemaVersion, "patternly-canonical-demo-questions-v1");
assert.deepEqual(catalog.demos.map((demo) => demo.provenance.questionId), ["alg-complexity-time-005", "aws-saa-c03-architecture-001-odk096"]);
assert.equal(catalog.demos.length, 2, "The public payload contains exactly the bounded Coding and AWS examples.");
assert.deepEqual(catalog.publicSamples.map((sample) => [sample.presentation, sample.questionId]), [
  ["interactive", "alg-complexity-time-005"],
  ["interactive", "aws-saa-c03-architecture-001-odk096"],
  ["image", "alg-complexity-amortized-001"],
]);
for (const sample of catalog.publicSamples) {
  assert.ok(!Object.hasOwn(sample, "question"), "Sample inventory carries metadata only.");
  assert.equal(sample.sourceInputFingerprint, catalog.demos[0].provenance.sourceInputFingerprint);
  assert.match(sample.sourceInputFingerprint, /^[a-f0-9]{64}$/u);
  assert.equal(sample.releaseId, catalog.demos[0].provenance.releaseId);
}
const imageSample = catalog.publicSamples.find((sample) => sample.presentation === "image");
const preview = JSON.parse(await readFile(resolve(root, "scripts/app-preview-manifest.json"), "utf8"));
// The capture bank is historical; selected-question equality is checked above.
assert.deepEqual((await readdir(resolve(dist, "app-preview"))).sort(), preview.images.map((image) => image.path.split("/").at(-1)).sort());
for (const image of preview.images) {
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(hash(await readFile(resolve(root, image.path))), image.sha256);
  assert.equal(hash(await readFile(resolve(dist, image.path.replace(/^public\//u, "")))), image.sha256);
}
assert.equal(imageSample.imageSha256, preview.images.find((image) => image.questionId === imageSample.questionId).sha256);

const files = (await readdir(resolve(dist, "assets"))).filter((name) => name.endsWith(".js"));
assert.ok(files.length > 0, "Public build has JavaScript assets.");
const bundles = (await Promise.all(files.map((name) => readFile(join(dist, "assets", name), "utf8")))).join("\n");
for (const demo of catalog.demos) {
  const rawDetails = demo.question.feedback.details;
  const expectedTexts = [
    demo.question.prompt,
    demo.question.feedback.reason,
    ...demo.question.feedback.messages.map((message) => message.text),
    ...demo.question.interaction.options.map((option) => option.text),
  ];
  const intentionalDetailsText = new Set(demo.detailsParagraphs.filter((line) => Object.values(rawDetails).includes(line) || Object.values(rawDetails.blocks ?? {}).some((block) => block.text === line)));
  for (const line of demo.detailsParagraphs) intentionalDetailsText.add(line);
  for (const text of expectedTexts) assert.equal(bundles.split(text).length - 1, 1, `Expected one authored occurrence in the bounded demo bundle: ${text.slice(0, 80)}`);
  for (const text of intentionalDetailsText) assert.equal(bundles.split(text).length - 1, 2, `Raw authored Details plus display-only paragraph projection should appear exactly twice: ${text.slice(0, 80)}`);
}
assert.ok(!bundles.includes("What does an amortized O(1) operation guarantee?"), "The third image sample must not add an interactive question payload.");
for (const staleText of ["For this PostgreSQL query, which B-tree index key order is the best match?", "(order_date, customer_id)", "(customer_id, status, order_date)"]) assert.ok(!bundles.includes(staleText), `Stale manually maintained SQL demo remains in the public bundle: ${staleText}`);
assert.doesNotMatch(bundles, /gcp-ace-gcpace-n01-b02-001|az104-AZ104-N01-B01-001|AI901-N01-B01-Q001/u, "Unselected Certification examples are not included in the bounded payload.");
assert.doesNotMatch(bundles, /patternly-canonical-demo-question-bank|questionBank/u, "No whole question bank enters the public build.");
process.stdout.write("Current-source verification covers two interactive questions and the pinned third image; the bundle contains only the two selected question payloads; display-only Details copies are explicitly accounted for and the former SQL demo is absent.\n");
