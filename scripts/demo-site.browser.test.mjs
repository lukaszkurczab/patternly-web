import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const demo = JSON.parse(await readFile(resolve(root, "src/generated/codingDemoQuestion.json"), "utf8"));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };

test("built public site displays and resets the canonical demo at desktop and narrow widths", async () => {
  const server = createServer(async (request, response) => {
    const requestedPath = new URL(request.url, "http://localhost").pathname;
    const path = resolve(dist, `.${requestedPath === "/" ? "/index.html" : requestedPath}`);
    if (!path.startsWith(`${dist}${sep}`)) { response.writeHead(404).end(); return; }
    try {
      const bytes = await readFile(path);
      response.writeHead(200, { "Content-Type": types[extname(path)] ?? "application/octet-stream" }).end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "chrome" });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1800 });
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.locator("#session-title").waitFor();
      await page.evaluate(() => document.fonts.ready);
      const panel = page.locator("#session");
      await panel.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
      await page.waitForFunction(() => {
        const reveal = document.querySelector("#session").closest(".reveal");
        return !reveal || (reveal.classList.contains("is-visible") && !reveal.inert && Number(getComputedStyle(reveal).opacity) >= 0.999);
      });
      assert.equal(await page.locator("#session-title").textContent(), demo.question.prompt);
      assert.equal(await page.getByRole("radio").count(), 4);
      assert.equal(await page.getByRole("radio", { checked: true }).count(), 0);
      assert.equal(await page.locator("#session-details").count(), 0);
      assert.ok(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), `Demo panel overflows at width ${width}`);
      const screenshot = async (state) => {
        assert.ok(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), `Demo panel overflows in ${state} at width ${width}`);
        if (process.env.PATTERNLY_DEMO_SCREENSHOT_DIR) {
          await mkdir(process.env.PATTERNLY_DEMO_SCREENSHOT_DIR, { recursive: true });
          await panel.screenshot({ path: resolve(process.env.PATTERNLY_DEMO_SCREENSHOT_DIR, `${width}-${state}.png`) });
        }
      };
      await screenshot("neutral");
      const wrong = demo.question.feedback.messages[0];
      await page.locator(`#session-answer-${wrong.targetId} + label`).click();
      assert.equal(await page.locator(".practice-feedback > p").nth(1).textContent(), wrong.text);
      await page.getByRole("button", { name: /See the key idea/u }).click();
      assert.equal(await page.locator("#session-details").textContent(), demo.question.feedback.details.blocks.map((block) => block.text).join("\n\n"));
      await screenshot("wrong-details");
      await page.getByRole("button", { name: /Try again/u }).click();
      assert.equal(await page.getByRole("radio", { checked: true }).count(), 0);
      assert.equal(await page.locator("#session-details").count(), 0);
      await page.locator(`#session-answer-${demo.question.answer.optionId} + label`).click();
      assert.equal(await page.locator(".practice-feedback > p").nth(1).textContent(), demo.question.feedback.reason);
      await screenshot("correct");
    }
    assert.deepEqual(errors, [], "Built site has no browser runtime errors.");
  } finally {
    if (browser) await browser.close();
    await new Promise((done) => server.close(done));
  }
});
