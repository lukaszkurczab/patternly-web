import assert from 'node:assert/strict';
import test from 'node:test';
import { preview } from 'vite';
import { chromium } from 'playwright';
import { createAppProducedPublicLegalTestArtifact } from './publicLegalTestArtifact.mjs';
import { publicSitePlugin } from './public-site.mjs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const errors = [];
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base);
      await page.waitForFunction(() => document.querySelector('#session input')?.disabled === false);
      await page.evaluate(() => document.fonts.ready);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow at ${width}: ${JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("body *")].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 10).map(el => [el.className, el.getBoundingClientRect().right])))}`);
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
      await page.waitForFunction(() => document.documentElement.lang === 'pl');
      assert.ok(await page.locator('h1').textContent());
    }
    await context.close();
    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
    const staticPage = await noJs.newPage();
    await staticPage.goto(base);
    assert.ok(await staticPage.locator('h1').isVisible());
    assert.ok(await staticPage.locator('#tracks h2').isVisible());
    assert.equal(await staticPage.locator('#tracks .reveal').first().evaluate((element) => getComputedStyle(element).opacity), '1');
    assert.ok(await staticPage.locator('.no-script-nav a').first().isVisible());
    assert.equal(await staticPage.locator('#session input:enabled').count(), 0);
    assert.equal(await staticPage.locator('.track-demo-button:enabled').count(), 0);
    for (const route of ['/privacy.html', '/terms.html']) {
      await staticPage.goto(base + route);
      assert.ok(await staticPage.locator('.legal-copy').isVisible());
      assert.ok(await staticPage.locator('select').isDisabled());
    }
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
