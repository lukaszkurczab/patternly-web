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
const demoCatalog = JSON.parse(await readFile(resolve(root, "src/generated/demoQuestions.json"), "utf8"));
const codingDemo = demoCatalog.demos.find((entry) => entry.provenance.trackId === "coding-interview-dsa-problem-solving");
const awsDemo = demoCatalog.demos.find((entry) => entry.provenance.trackId === "aws-certified-solutions-architect-associate");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };

async function assertDetailsParagraphs(page, demo) {
  const paragraphs = page.locator("#session-details > p");
  assert.equal(await paragraphs.count(), demo.detailsParagraphs.length);
  assert.deepEqual(await paragraphs.allTextContents(), demo.detailsParagraphs);
}

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
    const externalRequests = [];
    const mutatingRequests = [];
    const localOrigin = `http://127.0.0.1:${server.address().port}`;
    const observePublicRequests = (observedPage) => observedPage.on("request", (request) => {
      const url = new URL(request.url());
      if (url.origin !== localOrigin) externalRequests.push({ method: request.method(), origin: url.origin, path: url.pathname });
      if (request.method() !== "GET" && request.method() !== "HEAD") mutatingRequests.push({ method: request.method(), origin: url.origin, path: url.pathname });
    });
    page.on("pageerror", (error) => errors.push(error.message));
    observePublicRequests(page);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1800 });
      await page.goto(localOrigin);
      await page.locator("#session-title").waitFor();
      assert.equal(await page.locator('[data-track-id="aws-certified-solutions-architect-associate"]').getByRole("button", { name: "Try an AWS question", exact: true }).count(), 1, "The existing AWS catalog card must select its own bounded example.");
      assert.equal(await page.locator('[data-track-id="coding-interview-dsa-problem-solving"]').getByRole("button", { name: "Try a coding question", exact: true }).count(), 1, "The existing Coding catalog card selects its bounded example.");
      await page.evaluate(() => document.fonts.ready);
      const panel = page.locator("#session");
      await panel.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
      await page.waitForFunction(() => {
        const reveal = document.querySelector("#session").closest(".reveal");
        return !reveal || (reveal.classList.contains("is-visible") && !reveal.inert && Number(getComputedStyle(reveal).opacity) >= 0.999);
      });
      assert.equal(await page.locator("#session-title").textContent(), codingDemo.question.prompt);
      assert.equal(await page.getByRole("radio").count(), 4);
      assert.equal(await page.getByRole("radio", { checked: true }).count(), 0);
      assert.equal(await page.locator("#session-details").count(), 0);
      assert.equal(await page.getByText("Patternly is coming to the App Store. Download is not available yet.", { exact: true }).count(), 1);
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
      assert.equal(await page.locator("#session input:focus").getAttribute("value"), codingDemo.question.interaction.options[0].optionId);
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
      assert.match(await page.locator(":focus").textContent(), /Check answer/u);
      assert.equal(await page.locator(".practice-feedback").count(), 0);
      assert.equal(await page.locator(".practice-status").count(), 0);
      const checkButton = await page.locator(".practice-actions button").elementHandle();
      await page.keyboard.press("Space");
      assert.equal(await page.evaluate((button) => document.activeElement === button, checkButton), true, "Submitting preserves focus on the same action control.");
      assert.equal(await page.locator(".practice-feedback > p").nth(1).textContent(), codingDemo.question.feedback.messages.find((message) => message.targetId === codingDemo.question.interaction.options[0].optionId)?.text ?? codingDemo.question.feedback.reason);
      await page.keyboard.press("Shift+Tab");
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
      for (let step = 0; step < 25; step += 1) {
        await page.keyboard.press("Tab");
        if (await page.evaluate(() => document.activeElement?.matches("#session input[type=radio]"))) break;
      }
      const keyboardEntry = await page.locator("#session input:focus").getAttribute("value");
      let keyboardIndex = codingDemo.question.interaction.options.findIndex((option) => option.optionId === keyboardEntry);
      assert.ok(keyboardIndex >= 0, "Tab navigation reaches the native radio group after reset.");
      for (let move = 0; move < 2; move += 1) {
        await page.keyboard.press("ArrowDown");
        keyboardIndex = (keyboardIndex + 1) % codingDemo.question.interaction.options.length;
        const keyboardChoice = codingDemo.question.interaction.options[keyboardIndex].optionId;
        assert.equal(await page.getByRole("radio", { checked: true }).getAttribute("value"), keyboardChoice);
        assert.equal(await page.locator(".practice-feedback").count(), 0, "Changing a draft after submission clears feedback until the next explicit check.");
        assert.equal(await page.getByRole("button", { name: "Check answer" }).isEnabled(), true);
      }
      await page.keyboard.press("Tab");
      assert.match(await page.locator(":focus").textContent(), /Check answer/u);
      await page.keyboard.press("Space");
      const checkedChoice = codingDemo.question.interaction.options[keyboardIndex];
      assert.equal(await page.locator(".practice-feedback > p").nth(1).textContent(), checkedChoice.optionId === codingDemo.question.answer.optionId ? codingDemo.question.feedback.reason : codingDemo.question.feedback.messages.find((message) => message.targetId === checkedChoice.optionId).text);
      await screenshot("keyboard-focus");
      await page.getByRole("button", { name: /Try again/u }).click();
      const wrong = codingDemo.question.feedback.messages[0];
      await page.locator(`#session-answer-${wrong.targetId} + label`).click();
      assert.equal(await page.locator(".practice-feedback").count(), 0);
      await page.getByRole("button", { name: "Check answer" }).click();
      assert.equal(await page.locator(".practice-feedback > p").nth(1).textContent(), wrong.text);
      assert.equal(await panel.locator("a").count(), 0, "Unavailable access state does not invent a destination.");
      await page.getByRole("button", { name: /See the key idea/u }).click();
      await assertDetailsParagraphs(page, codingDemo);
      await screenshot("wrong-details");
      await page.getByRole("button", { name: /Try again/u }).click();
      assert.equal(await page.getByRole("radio", { checked: true }).count(), 0);
      assert.equal(await page.locator("#session-details").count(), 0);
      await page.locator(`#session-answer-${codingDemo.question.answer.optionId} + label`).click();
      assert.equal(await page.locator(".practice-feedback").count(), 0);
      await page.getByRole("button", { name: "Check answer" }).click();
      assert.equal(await page.locator(".practice-feedback > p").nth(1).textContent(), codingDemo.question.feedback.reason);
      await screenshot("correct");

      const chooseCoding = page.locator('[data-track-id="coding-interview-dsa-problem-solving"] button');
      await chooseCoding.scrollIntoViewIfNeeded();
      await chooseCoding.click();
      assert.equal(await page.evaluate(() => document.activeElement?.id), "session-title", "Reactivating the current demo still returns focus to its question.");
      assert.equal(await page.locator("#session").getAttribute("data-state"), "resolved", "Selecting the already active goal preserves the current answer.");

      const chooseAws = page.locator('[data-track-id="aws-certified-solutions-architect-associate"] button');
      await chooseAws.scrollIntoViewIfNeeded();
      await chooseAws.click();
      await page.waitForFunction((expectedPrompt) => document.querySelector("#session-title")?.textContent === expectedPrompt, awsDemo.question.prompt);
      assert.equal(await page.locator("#session").getAttribute("data-state"), "neutral", "Changing the demo clears Coding answer state.");
      assert.equal(await page.getByRole("radiogroup").count(), 1);
      assert.equal(await page.getByRole("radio", { checked: true }).count(), 0);
      assert.equal(await page.locator("#session-details").count(), 0);
      assert.equal(await page.evaluate(() => document.activeElement?.id), "session-title", "Keyboard activation moves focus to the newly selected question.");
      await page.keyboard.press("Tab");
      assert.equal(await page.locator("#session input:focus").getAttribute("value"), awsDemo.question.interaction.options[0].optionId, "The selected question's native radio follows the focused heading in tab order.");
      await page.keyboard.press("Space");
      const awsSelected = awsDemo.question.interaction.options[0];
      assert.equal(await page.locator(".practice-feedback").count(), 0);
      await page.getByRole("button", { name: "Check answer" }).click();
      assert.equal(await page.locator(".practice-feedback > p").nth(1).textContent(), awsSelected.optionId === awsDemo.question.answer.optionId ? awsDemo.question.feedback.reason : awsDemo.question.feedback.messages.find((message) => message.targetId === awsSelected.optionId).text);
      await page.getByRole("button", { name: /See the key idea/u }).click();
      await assertDetailsParagraphs(page, awsDemo);
      await screenshot("aws-details");
      await chooseCoding.scrollIntoViewIfNeeded();
      await chooseCoding.click();
      await page.waitForFunction((expectedPrompt) => document.querySelector("#session-title")?.textContent === expectedPrompt, codingDemo.question.prompt);
      assert.equal(await page.locator("#session").getAttribute("data-state"), "neutral", "Switching back clears AWS answer state.");
      assert.equal(await page.locator("#session-details").count(), 0);
      assert.equal(await page.getByRole("radio", { checked: true }).count(), 0);
      assert.equal(await page.getByRole("radiogroup").count(), 1);
      assert.equal(await page.getByText("This page does not offer a link to access the app yet.", { exact: true }).count(), 0);
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
    observePublicRequests(zoomPage);
    await zoomPage.goto(localOrigin);
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
    await zoomPage.keyboard.press("Shift+Tab");
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
    const zoomAwsAction = zoomPage.locator('[data-track-id="aws-certified-solutions-architect-associate"] button');
    await zoomAwsAction.scrollIntoViewIfNeeded();
    await zoomAwsAction.click();
    await zoomPage.waitForFunction((expectedPrompt) => document.querySelector("#session-title")?.textContent === expectedPrompt, awsDemo.question.prompt);
    assert.equal(await zoomPage.evaluate(() => document.activeElement?.id), "session-title");
    await zoomPage.keyboard.press("Tab");
    assert.equal(await zoomPanel.locator("input:focus").count(), 1, "Focus transfers from the selected card to the newly rendered AWS sample.");
    await zoomPage.keyboard.press("Space");
    await zoomPage.keyboard.press("Tab");
    await zoomPage.keyboard.press("Space");
    await zoomPage.keyboard.press("Shift+Tab");
    await zoomPage.keyboard.press("Space");
    await assertDetailsParagraphs(zoomPage, awsDemo);
    assert.ok(await zoomPanel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), "AWS details fit the panel at real 200% Chrome zoom.");
    assert.equal(await zoomPage.getByRole("radiogroup").count(), 1, "Only one demo remains mounted at real browser zoom.");
    assert.deepEqual(externalRequests, [], "Public practice must not send requests outside its loopback assets.");
    assert.deepEqual(mutatingRequests, [], "Public practice must not issue POST or other mutating requests.");
    assert.deepEqual(errors, [], "Built site has no browser runtime errors.");
  } finally {
    if (zoomContext) await zoomContext.close();
    if (browser) await browser.close();
    if (zoomProfile) await rm(zoomProfile, { recursive: true, force: true });
    await new Promise((done) => server.close(done));
  }
});
