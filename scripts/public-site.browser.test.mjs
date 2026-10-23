import assert from 'node:assert/strict';
import { assertBasicTextContrast } from './basic-text-contrast.mjs';
import test from 'node:test';
import { preview } from 'vite';
import { chromium } from 'playwright';
import { createAppProducedPublicLegalTestArtifact } from './publicLegalTestArtifact.mjs';
import { publicSitePlugin } from './public-site.mjs';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const browserOptions = process.env.PATTERNLY_TEST_BROWSER_EXECUTABLE_PATH
  ? { executablePath: process.env.PATTERNLY_TEST_BROWSER_EXECUTABLE_PATH, headless: true }
  : { channel: 'chrome', headless: true };

test('production metadata permits indexing while local metadata does not', () => {
  const html = '<html><head></head></html>';
  const production = publicSitePlugin({}, false).transformIndexHtml(html, { filename: '/index.html' });
  const local = publicSitePlugin({}, true).transformIndexHtml(html, { filename: '/index.html' });
  assert.ok(!production.tags.some((tag) => tag.attrs.name === 'robots'));
  assert.ok(local.tags.some((tag) => tag.attrs.name === 'robots' && tag.attrs.content === 'noindex, nofollow'));
});

test('public pages hydrate, remain readable without JS, and fit responsive widths', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'patternly-web-browser-'));
  const artifact = createAppProducedPublicLegalTestArtifact();
  const path = join(directory, 'legal.json');
  await writeFile(path, JSON.stringify(artifact));
  process.env.PATTERNLY_PUBLIC_LEGAL_ARTIFACT_PATH = path;
  process.env.PATTERNLY_PUBLIC_LEGAL_EXPECTED_FINGERPRINT = artifact.sourceFingerprint;
  let server;
  let browser;
  try {
    server = await preview({ mode: 'local-test', preview: { host: '127.0.0.1', port: 0 } });
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch(browserOptions);
    const errors = [];
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base);
      await page.waitForFunction(() => document.querySelector('#session input')?.disabled === false);
      await page.evaluate(() => document.fonts.ready);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow at ${width}: ${JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("body *")].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 10).map(el => [el.className, el.getBoundingClientRect().right])))}`);
      assert.equal(await page.locator('[data-app-availability]').count(), 2);
      assert.deepEqual(await page.locator('[data-app-availability]').allTextContents(), [
        'Android is planned first; iOS will follow. Neither app is available to download yet.',
        'Android is planned first; iOS will follow. Neither app is available to download yet.',
      ]);
      assert.equal(await page.locator('a[href*="apps.apple.com"], a[href*="play.google.com"]').count(), 0);
      await page.locator('.app-previews').scrollIntoViewIfNeeded();
      for (const previewImage of await page.locator('.app-previews img').all()) {
        await previewImage.scrollIntoViewIfNeeded();
        await previewImage.evaluate((element) => element.decode());
        assert.equal(await previewImage.evaluate((element) => element.naturalWidth), 1206);
        assert.ok(await previewImage.getAttribute('alt'));
      }
      if (width === 390) {
        const contrast = await assertBasicTextContrast(page, ['.hero h1', '.practice-note', '.practice-option label', '#help summary', 'footer a']);
        if (process.env.PATTERNLY_CONTRAST_RECEIPT_PATH) await writeFile(process.env.PATTERNLY_CONTRAST_RECEIPT_PATH, JSON.stringify({ mode: 'local-test', browserVersion: await browser.version(), scope: 'bounded computed text colors, conservative gradient bounds; not full WCAG', contrast }, null, 2));
      }
    const help = page.locator('#help details').last();
      await help.locator('summary').focus();
      await page.keyboard.press('Enter');
      assert.equal(await help.getAttribute('open'), '');
      const contact = help.getByRole('link', { name: 'Email the Patternly operator' });
      assert.equal(await contact.getAttribute('href'), `mailto:${encodeURIComponent(artifact.publicProfile.operator.email.en)}`);
      await page.keyboard.press('Tab');
      assert.equal(await contact.evaluate((element) => document.activeElement === element), true);
      assert.equal(await help.getByRole('link', { name: 'Support information' }).getAttribute('href'), artifact.publicLinks.supportUrl);
      if (process.env.PATTERNLY_PUBLIC_SCREENSHOT_DIR && [390, 1440].includes(width)) {
        await mkdir(process.env.PATTERNLY_PUBLIC_SCREENSHOT_DIR, { recursive: true });
        await contact.evaluate((element) => element.blur());
        for (const section of ['help', 'app']) {
          await page.evaluate((id) => { document.getElementById(id).scrollIntoView({ behavior: 'instant' }); }, section);
          await page.screenshot({ path: join(process.env.PATTERNLY_PUBLIC_SCREENSHOT_DIR, `${width}-${section}.png`) });
        }
      }
      await help.locator('summary').click();
      assert.ok(await page.locator('.nav-action').isVisible());
      await page.locator('.nav-action').click();
      await page.waitForFunction(() => Math.abs(document.querySelector('#session').getBoundingClientRect().top) < innerHeight);
      assert.ok(await page.locator('.nav-action').evaluate((element) => { const box = element.getBoundingClientRect(); return box.top >= 0 && box.bottom <= innerHeight; }), `Sticky CTA leaves viewport at ${width}`);
      if (width <= 768) {
        await page.getByRole('button', { name: 'Open navigation' }).click();
        await page.locator('.compact-navigation a').first().waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
      }
    }
    for (const route of ['/privacy.html', '/terms.html']) {
      await page.goto(base + route);
      await page.locator('select:not(:disabled)').waitFor();
      await page.locator('select').selectOption('pl');
      await page.waitForURL('**/pl/*');
      await page.waitForFunction(() => document.documentElement.lang === 'pl');
      assert.ok(await page.locator('h1').textContent());
    }
    await page.goto(base + '/terms.html#support');
    await page.locator('select:not(:disabled)').waitFor();
    assert.equal(await page.locator('#support').count(), 1);
    await page.waitForFunction(() => Math.abs(document.querySelector('#support').getBoundingClientRect().top) < innerHeight);
    assert.ok(await page.locator('#support').evaluate((element) => Math.abs(element.getBoundingClientRect().top) < innerHeight), 'Support fragment scrolls after hydration');
    await page.locator('select').selectOption('pl');
    await page.waitForURL('**/pl/terms#support');
    await page.locator('select:not(:disabled)').waitFor();
    assert.equal(await page.locator('#support').count(), 1);
    assert.match(await page.locator('#support').textContent(), /^16\./u);
    await context.close();
    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
    const staticPage = await noJs.newPage();
    await staticPage.goto(base);
    assert.ok(await staticPage.locator('h1').isVisible());
    assert.ok(await staticPage.locator('#tracks h2').isVisible());
    await staticPage.locator('#help details').last().locator('summary').click();
    assert.ok(await staticPage.getByRole('link', { name: 'Email the Patternly operator' }).isVisible());
    assert.ok(await staticPage.locator('#app h2').isVisible());
    assert.ok(await staticPage.locator('.app-previews img').count() > 0);
    assert.equal(await staticPage.locator('#tracks .reveal').first().evaluate((element) => getComputedStyle(element).opacity), '1');
    assert.ok(await staticPage.locator('.no-script-nav a').first().isVisible());
    assert.equal(await staticPage.locator('#session input:enabled').count(), 0);
    assert.equal(await staticPage.locator('.track-demo-button:enabled').count(), 0);
    for (const route of ['/privacy.html', '/terms.html']) {
      await staticPage.goto(base + route);
      assert.ok(await staticPage.locator('.legal-copy').isVisible());
      assert.ok(await staticPage.locator('select').isDisabled());
    }
    await staticPage.goto(base + '/terms.html#support');
    assert.equal(await staticPage.locator('#support').count(), 1);
    // Poll from Node: page waitForFunction uses a page timer/RAF, disabled in this context.
    let supportVisible = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      supportVisible = await staticPage.locator('#support').evaluate((element) => Math.abs(element.getBoundingClientRect().top) < innerHeight);
      if (supportVisible) break;
      await new Promise((done) => setTimeout(done, 100));
    }
    assert.ok(supportVisible, 'Prerendered support fragment scrolls without JavaScript');
    await staticPage.goto(base + '/404.html');
    assert.equal(await staticPage.locator('h1').textContent(), 'Page not found');
    for (const route of ['/unknown-page', '/admin', '/admin/', '/admin.html', '/privacy-request', '/privacy-request/example']) assert.equal((await fetch(base + route)).status, 404);
    await noJs.close();
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    if (server) await new Promise((done) => server.httpServer.close(done));
    await rm(directory, { recursive: true, force: true });
  }
});

test('visible reveal content stays exposed to keyboard and accessibility before intersection', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'patternly-web-reveal-browser-'));
  const artifact = createAppProducedPublicLegalTestArtifact();
  const path = join(directory, 'legal.json');
  await writeFile(path, JSON.stringify(artifact));
  process.env.PATTERNLY_PUBLIC_LEGAL_ARTIFACT_PATH = path;
  process.env.PATTERNLY_PUBLIC_LEGAL_EXPECTED_FINGERPRINT = artifact.sourceFingerprint;
  let server;
  let browser;
  try {
    server = await preview({ mode: 'local-test', preview: { host: '127.0.0.1', port: 0 } });
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch(browserOptions);
    const context = await browser.newContext({ reducedMotion: 'no-preference' });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const observers = [];
      window.__patternlyRevealObservers = observers;
      window.__triggerPatternlyReveal = (selector) => {
        const observer = observers.find((candidate) => candidate.target?.matches(selector));
        if (!observer) return false;
        observer.callback([{ target: observer.target, isIntersecting: true, intersectionRatio: 1 }], observer);
        return true;
      };
      window.IntersectionObserver = class HeldIntersectionObserver {
        constructor(callback) { this.callback = callback; observers.push(this); }
        observe(target) { this.target = target; }
        disconnect() {}
        unobserve() {}
        takeRecords() { return []; }
      };
    });
    await page.goto(base);
    await page.waitForFunction(() => document.querySelector('#session input')?.disabled === false);

    const reveal = page.locator('#tracks .track-atlas');
    const accessibleHeading = reveal.getByRole('heading', { name: 'Coding Interview: DSA & Problem Solving' });
    const keyboardButton = page.locator('#tracks [data-track-id="aws-certified-solutions-architect-associate"] .track-demo-button');
    await keyboardButton.waitFor({ state: 'visible' });
    assert.equal(await keyboardButton.isDisabled(), false);

    const inspectReveal = () => reveal.evaluate((element) => ({
      ariaHidden: element.getAttribute('aria-hidden'),
      inert: element.inert,
      buttonTabIndex: element.querySelector('.track-demo-button')?.getAttribute('tabindex') ?? null,
      visibleClass: element.classList.contains('is-visible'),
    }));
    assert.deepEqual(await inspectReveal(), { ariaHidden: null, inert: false, buttonTabIndex: null, visibleClass: false });
    assert.equal(await accessibleHeading.count(), 1, 'Browser role lookup exposes the visible heading before intersection');

    const cdp = await context.newCDPSession(page);
    const headingIsInAxTree = async () => {
      const { nodes } = await cdp.send('Accessibility.getFullAXTree');
      return nodes.some((node) => node.ignored === false && node.role?.value === 'heading' && node.name?.value === 'Coding Interview: DSA & Problem Solving');
    };
    assert.equal(await headingIsInAxTree(), true, 'Browser AX tree exposes the visible heading before intersection');

    const focusByKeyboard = async () => {
      await page.evaluate(() => document.activeElement?.blur?.());
      for (let attempt = 0; attempt < 64; attempt += 1) {
        await page.keyboard.press('Tab');
        if (await keyboardButton.evaluate((element) => document.activeElement === element)) return true;
      }
      return false;
    };
    assert.equal(await focusByKeyboard(), true, 'Tab reaches the visible demo button before intersection');
    assert.equal(await keyboardButton.evaluate((element) => document.activeElement === element), true);

    assert.equal(await page.evaluate(() => window.__triggerPatternlyReveal('#tracks .track-atlas')), true, 'the held observer can release the actual reveal target');
    await page.waitForFunction(() => document.querySelector('#tracks .track-atlas')?.classList.contains('is-visible'));
    assert.deepEqual(await inspectReveal(), { ariaHidden: null, inert: false, buttonTabIndex: null, visibleClass: true });
    assert.equal(await accessibleHeading.count(), 1);
    assert.equal(await headingIsInAxTree(), true, 'Browser AX tree still exposes the heading after intersection');

    assert.equal(await focusByKeyboard(), true, 'Tab still reaches the demo button after intersection');
    await page.keyboard.press('Enter');
    assert.equal(await keyboardButton.getAttribute('aria-pressed'), 'true', 'keyboard activation remains available after intersection');
    await cdp.detach();
    await context.close();
  } finally {
    await browser?.close();
    if (server) await new Promise((done) => server.httpServer.close(done));
    await rm(directory, { recursive: true, force: true });
  }
});
