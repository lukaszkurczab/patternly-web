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
const payload = JSON.parse(readFileSync(resolve(root, "src/generated/codingDemoQuestion.json"), "utf8"));

function permutations(values) {
  if (values.length < 2) return [values];
  return values.flatMap((value, index) => permutations([...values.slice(0, index), ...values.slice(index + 1)]).map((rest) => [value, ...rest]));
}

async function bundleFor(optionOrder) {
  const rotated = structuredClone(payload);
  rotated.question.interaction.options = optionOrder;
  const output = await build({
    absWorkingDir: root,
    stdin: { contents: `import React from "react"; import { createRoot } from "react-dom/client"; import { InteractiveQuestion } from "./src/components/InteractiveQuestion.jsx"; createRoot(document.getElementById("root")).render(React.createElement(InteractiveQuestion));`, resolveDir: root, sourcefile: "demo-question-test.jsx", loader: "jsx" },
    bundle: true,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    write: false,
    plugins: [{
      name: "selected-demo-question",
      setup(buildContext) {
        buildContext.onResolve({ filter: /codingDemoQuestion\.json$/ }, () => ({ path: "demo-question", namespace: "selected-demo" }));
        buildContext.onLoad({ filter: /.*/, namespace: "selected-demo" }, () => ({ contents: JSON.stringify(rotated), loader: "json" }));
      },
    }],
  });
  return output.outputFiles[0].text;
}

test("mounted Coding demo binds feedback to stable option IDs under every display permutation", async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const page = await browser.newPage();
    const options = payload.question.interaction.options;
    const answerId = payload.question.answer.optionId;
    const wrongById = new Map(payload.question.feedback.messages.map((message) => [message.targetId, message.text]));
    for (const optionOrder of permutations(options)) {
      const order = optionOrder.map((option) => option.optionId);
      const bundle = await bundleFor(optionOrder);
      await page.setContent('<div id="root"></div>');
      await page.addScriptTag({ content: bundle });
      assert.equal(await page.getByRole("radiogroup").count(), 1);
      assert.equal(await page.getByRole("radio", { checked: true }).count(), 0);
      assert.equal(await page.locator("#session").getAttribute("data-state"), "neutral");
      assert.equal(await page.getByText("Choose an answer to see why.").count(), 1);
      assert.equal(await page.getByText("This page does not offer a link to access the app yet.", { exact: true }).count(), 0);
      assert.equal(await page.getByRole("button", { name: /See the key idea/u }).count(), 0);
      for (const [index, optionId] of order.entries()) {
        assert.equal(await page.locator(`#session-answer-${optionId} + label span`).textContent(), String.fromCharCode(65 + index));
      }
      for (const option of options) {
        await page.locator(`#session-answer-${option.optionId}`).check();
        assert.equal(await page.getByRole("radio", { checked: true }).getAttribute("value"), option.optionId);
        assert.equal(await page.locator("#session").getAttribute("data-state"), option.optionId === answerId ? "resolved" : "focused");
        assert.equal(await page.locator(".practice-feedback > p").nth(1).textContent(), option.optionId === answerId ? payload.question.feedback.reason : wrongById.get(option.optionId));
        assert.match(await page.locator(".practice-status").textContent(), option.optionId === answerId ? /Correct/u : /Not quite/u);
        assert.equal(await page.getByText("This page does not offer a link to access the app yet.", { exact: true }).count(), 1);
        await page.getByRole("button", { name: /See the key idea/u }).click();
        assert.equal(await page.getByRole("button", { name: /See the key idea/u }).getAttribute("aria-expanded"), "true");
        assert.equal(await page.locator("#session-details").textContent(), payload.question.feedback.details.blocks.map((block) => block.text).join("\n\n"));
        await page.getByRole("button", { name: /Try again/u }).click();
        assert.equal(await page.locator("#session").getAttribute("data-state"), "neutral");
        assert.equal(await page.getByRole("radio", { checked: true }).count(), 0);
        assert.equal(await page.locator("#session-details").count(), 0);
        assert.equal(await page.getByRole("button", { name: /See the key idea/u }).count(), 0);
        assert.equal(await page.getByText("This page does not offer a link to access the app yet.", { exact: true }).count(), 0);
      }
    }
  } finally {
    await browser.close();
  }
});
