import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(resolve(root, "src/generated/demoQuestions.json"), "utf8"));
assert.equal(catalog.schemaVersion, "patternly-canonical-demo-questions-v1");
assert.deepEqual(catalog.demos.map((demo) => demo.provenance.questionId), ["alg-complexity-time-005", "aws-saa-c03-architecture-001-odk096"]);
assert.equal(catalog.demos.length, 2, "The public payload contains exactly the bounded Coding and AWS examples.");
const files = (await readdir(resolve(root, "dist/assets"))).filter((name) => name.endsWith(".js"));
assert.ok(files.length > 0, "Public build has JavaScript assets.");
const bundles = (await Promise.all(files.map((name) => readFile(join(root, "dist/assets", name), "utf8")))).join("\n");
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
for (const staleText of ["For this PostgreSQL query, which B-tree index key order is the best match?", "(order_date, customer_id)", "(customer_id, status, order_date)"]) assert.ok(!bundles.includes(staleText), `Stale manually maintained SQL demo remains in the public bundle: ${staleText}`);
assert.doesNotMatch(bundles, /gcp-ace-gcpace-n01-b02-001|az104-AZ104-N01-B01-001|AI901-N01-B01-Q001/u, "Unselected Certification examples are not included in the bounded payload.");
assert.doesNotMatch(bundles, /patternly-canonical-demo-question-bank|questionBank/u, "No whole question bank enters the public build.");
process.stdout.write("Public bundle contains only the two selected bounded demo questions; display-only Details copies are explicitly accounted for and the former SQL demo is absent.\n");
