import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { dirname, extname, resolve, sep, join } from "node:path";
import { tmpdir } from "node:os";
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
  let zoomContext;
  let zoomProfile;
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
      assert.equal(await page.getByText("This page does not offer a link to access the app yet.", { exact: true }).count(), 0);
      assert.ok(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), `Demo panel overflows at width ${width}`);
      const screenshot = async (state) => {
        assert.ok(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), `Demo panel overflows in ${state} at width ${width}`);
        if (process.env.PATTERNLY_DEMO_SCREENSHOT_DIR) {
          await mkdir(process.env.PATTERNLY_DEMO_SCREENSHOT_DIR, { recursive: true });
          await panel.screenshot({ path: resolve(process.env.PATTERNLY_DEMO_SCREENSHOT_DIR, `${width}-${state}.png`) });
        }
      };
      await screenshot("neutral");
      // Reach the native radio through the page's real tab order, without focus injection.
      for (let step = 0; step < 25; step += 1) {
        await page.keyboard.press("Tab");
        if (await page.evaluate(() => document.activeElement?.matches("#session input[type=radio]"))) break;
      }
      assert.equal(await page.locator("#session input:focus").getAttribute("value"), demo.question.interaction.options[0].optionId);
      const focusedAppearance = () => page.locator("#session input:focus + label").evaluate(async (label) => {
        await new Promise(requestAnimationFrame);
        await Promise.all(label.getAnimations().map((animation) => animation.finished));
        const style = getComputedStyle(label);
        return { outline: style.outlineStyle, width: Number.parseFloat(style.outlineWidth), shadow: style.boxShadow };
      });
      const unselectedFocus = await focusedAppearance();
      await page.keyboard.press("Space");
      const selectedFocus = await focusedAppearance();
      await page.keyboard.press("Tab");
      assert.match(await page.locator(":focus").textContent(), /See the key idea/u);
      const selectedBlur = await page.locator("#session input:checked + label").evaluate((label) => {
        const style = getComputedStyle(label);
        return { outline: style.outlineStyle, width: Number.parseFloat(style.outlineWidth), shadow: style.boxShadow };
      });
      assert.notDeepEqual(selectedFocus, selectedBlur, "Selected keyboard focus needs a visible indicator separate from selection.");
      assert.notEqual(unselectedFocus.outline, "none", "Unselected keyboard focus is painted on the visible label.");
      assert.ok(unselectedFocus.width > 0 && selectedFocus.width > 0);
      await page.keyboard.press("Space");
      assert.equal(await page.locator("#session-details").count(), 1);
      await page.keyboard.press("Tab");
      assert.match(await page.locator(":focus").textContent(), /Try again/u);
      await page.keyboard.press("Space");
      assert.equal(await page.getByRole("radio", { checked: true }).count(), 0);
      assert.equal(await page.locator("#session-details").count(), 0);
      await page.keyboard.press("Shift+Tab");
      const keyboardEntry = await page.locator("#session input:focus").getAttribute("value");
      let keyboardIndex = demo.question.interaction.options.findIndex((option) => option.optionId === keyboardEntry);
      assert.ok(keyboardIndex >= 0, "Reverse tab enters the native radio group.");
      for (let move = 0; move < 2; move += 1) {
        await page.keyboard.press("ArrowDown");
        keyboardIndex = (keyboardIndex + 1) % demo.question.interaction.options.length;
        const keyboardChoice = demo.question.interaction.options[keyboardIndex].optionId;
        assert.equal(await page.getByRole("radio", { checked: true }).getAttribute("value"), keyboardChoice);
        assert.equal(await page.locator(".practice-feedback > p").nth(1).textContent(), keyboardChoice === demo.question.answer.optionId ? demo.question.feedback.reason : demo.question.feedback.messages.find((message) => message.targetId === keyboardChoice).text);
      }
      await screenshot("keyboard-focus");
      await page.getByRole("button", { name: /Try again/u }).click();
      const wrong = demo.question.feedback.messages[0];
      await page.locator(`#session-answer-${wrong.targetId} + label`).click();
      assert.equal(await page.locator(".practice-feedback > p").nth(1).textContent(), wrong.text);
      assert.equal(await page.getByText("This page does not offer a link to access the app yet.", { exact: true }).count(), 1);
      assert.equal(await panel.locator("a").count(), 0, "Unavailable access state does not invent a destination.");
      await page.getByRole("button", { name: /See the key idea/u }).click();
      assert.equal(await page.locator("#session-details").textContent(), demo.question.feedback.details.blocks.map((block) => block.text).join("\n\n"));
      await screenshot("wrong-details");
      await page.getByRole("button", { name: /Try again/u }).click();
      assert.equal(await page.getByRole("radio", { checked: true }).count(), 0);
      assert.equal(await page.locator("#session-details").count(), 0);
      assert.equal(await page.getByText("This page does not offer a link to access the app yet.", { exact: true }).count(), 0);
      await page.locator(`#session-answer-${demo.question.answer.optionId} + label`).click();
      assert.equal(await page.locator(".practice-feedback > p").nth(1).textContent(), demo.question.feedback.reason);
      assert.equal(await page.getByText("This page does not offer a link to access the app yet.", { exact: true }).count(), 1);
      await screenshot("correct");
    }
    await browser.close();
    browser = null;
    // Chromium's real default page-zoom preference, in a disposable test profile.
    // The runtime metrics below must prove zoom; CSS injection/device scale is insufficient.
    zoomProfile = await mkdtemp(join(tmpdir(), "patternly-demo-zoom-"));
    await mkdir(join(zoomProfile, "Default"));
    await writeFile(join(zoomProfile, "Default/Preferences"), JSON.stringify({ partition: { default_zoom_level: { x: Math.log(2) / Math.log(1.2) } } }));
    zoomContext = await chromium.launchPersistentContext(zoomProfile, { headless: true, channel: "chrome", viewport: null, args: ["--window-size=1440,3600"] });
    const zoomPage = zoomContext.pages()[0];
    zoomPage.on("pageerror", (error) => errors.push(error.message));
    await zoomPage.goto(`http://127.0.0.1:${server.address().port}/`);
    await zoomPage.locator("#session-title").waitFor();
    await zoomPage.evaluate(() => document.fonts.ready);
    const cdp = await zoomContext.newCDPSession(zoomPage);
    const metrics = await cdp.send("Page.getLayoutMetrics");
    assert.equal(metrics.cssVisualViewport.zoom, 2, "Chrome actually applies 200% page zoom.");
    assert.equal(metrics.cssVisualViewport.scale, 1, "Pinch/page scale is not substituted for browser zoom.");
    assert.equal(await zoomPage.evaluate(() => outerWidth / innerWidth), 2, "Layout reflows at half the physical window width.");
    const zoomPanel = zoomPage.locator("#session");
    await zoomPanel.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
    await zoomPage.waitForFunction(() => {
      const reveal = document.querySelector("#session").closest(".reveal");
      return !reveal || (reveal.classList.contains("is-visible") && !reveal.inert && Number(getComputedStyle(reveal).opacity) >= 0.999);
    });
    for (let step = 0; step < 25; step += 1) {
      await zoomPage.keyboard.press("Tab");
      if (await zoomPage.evaluate(() => document.activeElement?.matches("#session input[type=radio]"))) break;
    }
    assert.equal(await zoomPanel.locator("input:focus").count(), 1);
    await zoomPage.keyboard.press("Space");
    const zoomFocus = await zoomPanel.locator("input:focus + label").evaluate((label) => ({ outline: getComputedStyle(label).outlineStyle, width: Number.parseFloat(getComputedStyle(label).outlineWidth) }));
    assert.notEqual(zoomFocus.outline, "none");
    assert.ok(zoomFocus.width > 0, "Focus indicator remains visible at browser zoom 200%.");
    await zoomPage.keyboard.press("Tab");
    await zoomPage.keyboard.press("Space");
    assert.equal(await zoomPanel.locator("#session-details").count(), 1);
    assert.ok(await zoomPanel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1));
    const overflow = await zoomPage.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const hero = document.querySelector(".hero");
      const decoration = getComputedStyle(hero, "::before");
      const textOverflows = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width > 0 && (rect.left < -1 || rect.right > width + 1)) textOverflows.push({ text: node.textContent.slice(0, 80), left: rect.left, right: rect.right });
        }
      }
      return { width, scrollWidth: document.documentElement.scrollWidth, bodyOverflowX: getComputedStyle(document.body).overflowX, decoration: { right: decoration.right, width: decoration.width }, textOverflows, elements: [...document.querySelectorAll("body *")].map((element) => ({ tag: element.tagName, className: typeof element.className === "string" ? element.className : "", right: element.getBoundingClientRect().right })).filter((element) => element.right > width + 1).slice(0, 12) };
    });
    // Decorative pseudo-elements extend the raw scrollWidth behind overflow-x:hidden.
    // Verify rendered content bounds, including text ranges, rather than that paint extent.
    assert.deepEqual(overflow.elements, [], `Content extends past the zoomed viewport: ${JSON.stringify(overflow)}`);
    assert.deepEqual(overflow.textOverflows, [], `Text extends past the zoomed viewport: ${JSON.stringify(overflow)}`);
    if (process.env.PATTERNLY_DEMO_SCREENSHOT_DIR) {
      const capture = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      const pixels = Buffer.from(capture.data, "base64");
      assert.equal(pixels.readUInt32BE(16), metrics.layoutViewport.clientWidth, "Native zoom capture preserves physical viewport width.");
      assert.equal(pixels.readUInt32BE(20), metrics.layoutViewport.clientHeight, "Native zoom capture preserves physical viewport height.");
      await writeFile(resolve(process.env.PATTERNLY_DEMO_SCREENSHOT_DIR, "zoom200-details.png"), pixels);
      await writeFile(resolve(process.env.PATTERNLY_DEMO_SCREENSHOT_DIR, "zoom200-metrics.json"), `${JSON.stringify({ browserVersion: zoomContext.browser()?.version(), cssVisualViewport: metrics.cssVisualViewport, cssLayoutViewport: metrics.cssLayoutViewport, focus: zoomFocus, overflow }, null, 2)}\n`);
    }
    await zoomPage.keyboard.press("Tab");
    await zoomPage.keyboard.press("Space");
    assert.equal(await zoomPanel.locator("input:checked").count(), 0);
    assert.equal(await zoomPanel.locator("#session-details").count(), 0);
    assert.deepEqual(errors, [], "Built site has no browser runtime errors.");
  } finally {
    if (zoomContext) await zoomContext.close();
    if (browser) await browser.close();
    if (zoomProfile) await rm(zoomProfile, { recursive: true, force: true });
    await new Promise((done) => server.close(done));
  }
});
