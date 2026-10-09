import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { build } = require("esbuild");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const component = resolve(root, "src/components/InteractiveQuestion.jsx");
const catalog = JSON.parse(readFileSync(resolve(root, "src/generated/demoQuestions.json"), "utf8"));
const demoCases = [
  { trackId: "coding-interview-dsa-problem-solving", label: "Coding Interview", action: "Try a coding question" },
  { trackId: "aws-certified-solutions-architect-associate", label: "AWS certification", action: "Try an AWS question" },
];

async function assertDetailsParagraphs(page, demo) {
  const paragraphs = page.locator("#session-details > p");
  assert.equal(await paragraphs.count(), demo.detailsParagraphs.length);
  assert.deepEqual(await paragraphs.allTextContents(), demo.detailsParagraphs);
}

function permutations(values) {
  if (values.length < 2) return [values];
  return values.flatMap((value, index) => permutations([...values.slice(0, index), ...values.slice(index + 1)]).map((rest) => [value, ...rest]));
}

async function bundleFor(trackId, optionOrder) {
  const rotated = structuredClone(catalog);
  const demo = rotated.demos.find((entry) => entry.provenance.trackId === trackId);
  demo.question.interaction.options = optionOrder;
  const output = await build({
    absWorkingDir: root,
    stdin: { contents: `import React from "react"; import { createRoot } from "react-dom/client"; import demos from "./src/generated/demoQuestions.json"; import { InteractiveQuestion } from "./src/components/InteractiveQuestion.jsx"; const demo = demos.demos.find((entry) => entry.provenance.trackId === ${JSON.stringify(trackId)}); createRoot(document.getElementById("root")).render(React.createElement(InteractiveQuestion, { demo, trackLabel: ${JSON.stringify(demoCases.find((entry) => entry.trackId === trackId).label)}, progressNote: "One Free question.", titleRef: React.createRef() }));`, resolveDir: root, sourcefile: "demo-question-test.jsx", loader: "jsx" },
    bundle: true,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    write: false,
    plugins: [{
      name: "selected-demo-catalog",
      setup(buildContext) {
        buildContext.onResolve({ filter: /demoQuestions\.json$/ }, () => ({ path: "demo-catalog", namespace: "selected-demo" }));
        buildContext.onLoad({ filter: /.*/, namespace: "selected-demo" }, () => ({ contents: JSON.stringify(rotated), loader: "json" }));
      },
    }],
  });
  return output.outputFiles[0].text;
}

test("mounted Coding and AWS demos bind feedback to stable IDs under all display permutations", async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const page = await browser.newPage();
    for (const { trackId, label } of demoCases) {
      const demo = catalog.demos.find((entry) => entry.provenance.trackId === trackId);
      const question = demo.question;
      const answerId = question.answer.optionId;
      const wrongById = new Map(question.feedback.messages.map((message) => [message.targetId, message.text]));
      for (const optionOrder of permutations(question.interaction.options)) {
        const bundle = await bundleFor(trackId, optionOrder);
        await page.setContent('<div id="root"></div>');
        await page.addScriptTag({ content: bundle });
        assert.equal(await page.getByRole("radiogroup").count(), 1);
        assert.equal(await page.getByRole("radio", { checked: true }).count(), 0);
        assert.equal(await page.locator("#session").getAttribute("data-state"), "neutral");
        assert.equal(await page.locator(".practice-topbar span").first().textContent(), label);
        assert.equal(await page.getByRole("button", { name: "Check answer" }).isDisabled(), true);
        assert.equal(await page.locator(".practice-feedback").count(), 0);
        assert.equal(await page.locator(".practice-status").count(), 0);
        assert.equal(await page.getByText("Patternly is coming to the App Store. Download is not available yet.", { exact: true }).count(), 0);
        assert.equal(await page.getByRole("button", { name: /See the key idea/u }).count(), 0);
        for (const [index, option] of optionOrder.entries()) assert.equal(await page.locator(`#session-answer-${option.optionId} + label span`).textContent(), String.fromCharCode(65 + index));
        for (const option of question.interaction.options) {
          await page.locator(`#session-answer-${option.optionId} + label`).click();
          assert.equal(await page.getByRole("radio", { checked: true }).getAttribute("value"), option.optionId);
          assert.equal(await page.locator("#session").getAttribute("data-state"), "neutral");
          assert.equal(await page.locator(".practice-feedback").count(), 0, "Selection alone must not publish feedback to visual or accessibility trees.");
          assert.equal(await page.locator(".practice-status").count(), 0);
          assert.equal(await page.getByText(question.feedback.reason, { exact: true }).count(), 0);
          for (const wrongReason of wrongById.values()) assert.equal(await page.getByText(wrongReason, { exact: true }).count(), 0);
          assert.equal(await page.getByRole("button", { name: "Check answer" }).isEnabled(), true);
          await page.getByRole("button", { name: "Check answer" }).click();
          assert.equal(await page.locator("#session").getAttribute("data-state"), option.optionId === answerId ? "resolved" : "focused");
          assert.equal(await page.locator(".practice-feedback > p").nth(1).textContent(), option.optionId === answerId ? question.feedback.reason : wrongById.get(option.optionId));
          assert.match(await page.locator(".practice-status").textContent(), option.optionId === answerId ? /Correct/u : /Not quite/u);
          assert.equal(await page.getByRole("button", { name: /Try again/u }).count(), 1);
          assert.equal(await page.getByText("Patternly is coming to the App Store. Download is not available yet.", { exact: true }).count(), 1);
          await page.getByRole("button", { name: /See the key idea/u }).click();
          await assertDetailsParagraphs(page, demo);
          const alternate = question.interaction.options.find((candidate) => candidate.optionId !== option.optionId);
          await page.locator(`#session-answer-${alternate.optionId} + label`).click();
          assert.equal(await page.locator("#session").getAttribute("data-state"), "neutral");
          assert.equal(await page.locator(".practice-feedback").count(), 0, "Changing an answer clears the submitted result and Details.");
          assert.equal(await page.locator("#session-details").count(), 0);
          assert.equal(await page.getByRole("button", { name: "Check answer" }).isEnabled(), true);
          await page.locator(`#session-answer-${option.optionId} + label`).click();
          await page.getByRole("button", { name: "Check answer" }).click();
          assert.equal(await page.locator(".practice-feedback > p").nth(1).textContent(), option.optionId === answerId ? question.feedback.reason : wrongById.get(option.optionId));
          await page.getByRole("button", { name: /See the key idea/u }).click();
          assert.equal(await page.getByRole("button", { name: /See the key idea/u }).getAttribute("aria-expanded"), "true");
          await assertDetailsParagraphs(page, demo);
          await page.getByRole("button", { name: /Try again/u }).click();
          assert.equal(await page.locator("#session").getAttribute("data-state"), "neutral");
          assert.equal(await page.getByRole("button", { name: "Check answer" }).isDisabled(), true);
          assert.equal(await page.getByRole("radio", { checked: true }).count(), 0);
          assert.equal(await page.locator("#session-details").count(), 0);
          assert.equal(await page.getByRole("button", { name: /See the key idea/u }).count(), 0);
          assert.equal(await page.getByText("Patternly is coming to the App Store. Download is not available yet.", { exact: true }).count(), 0);
        }
      }
    }
  } finally {
    await browser.close();
  }
});
