import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const payload = JSON.parse(await readFile(resolve(root, "src/generated/codingDemoQuestion.json"), "utf8"));
const files = (await readdir(resolve(root, "dist/assets"))).filter((name) => name.endsWith(".js"));
assert.ok(files.length > 0, "Public build has JavaScript assets.");
const bundles = (await Promise.all(files.map((name) => readFile(join(root, "dist/assets", name), "utf8")))).join("\n");
const expectedTexts = [
  payload.question.prompt,
  payload.question.feedback.reason,
  ...payload.question.feedback.messages.map((message) => message.text),
  ...payload.question.interaction.options.map((option) => option.text),
  ...payload.question.feedback.details.blocks.map((block) => block.text),
];
for (const text of expectedTexts) assert.equal(bundles.split(text).length - 1, 1, `Expected one authored occurrence in the demo bundle: ${text.slice(0, 80)}`);
for (const staleText of ["For this PostgreSQL query, which B-tree index key order is the best match?", "(order_date, customer_id)", "(customer_id, status, order_date)"]) assert.ok(!bundles.includes(staleText), `Stale manually maintained SQL demo remains in the public bundle: ${staleText}`);
process.stdout.write("Public bundle contains only the selected canonical demo copy; former SQL demo copy is absent.\n");
