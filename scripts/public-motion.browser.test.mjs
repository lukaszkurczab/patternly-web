import assert from 'node:assert/strict';
import test from 'node:test';
import { preview } from 'vite';
import { chromium } from 'playwright';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppProducedPublicLegalTestArtifact } from './publicLegalTestArtifact.mjs';

test('homepage motion runs automatically without pause controls and cleans up desktop pins on resize', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'patternly-motion-'));
  const artifact = createAppProducedPublicLegalTestArtifact();
  const path = join(directory, 'legal.json');
  await writeFile(path, JSON.stringify(artifact));
  process.env.PATTERNLY_PUBLIC_LEGAL_ARTIFACT_PATH = path;
  process.env.PATTERNLY_PUBLIC_LEGAL_EXPECTED_FINGERPRINT = artifact.sourceFingerprint;
  let server;
  let browser;
  try {
    server = await preview({ mode: 'local-test', preview: { host: '127.0.0.1', port: 0 } });
    browser = await chromium.launch({ headless: true, ...(process.env.PATTERNLY_TEST_BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.PATTERNLY_TEST_BROWSER_EXECUTABLE_PATH } : { channel: 'chrome' }) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
    await page.locator('#session input:enabled').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.querySelectorAll('.pin-spacer').length === 1);
    assert.equal(await page.locator('.motion-toggle, .marquee-control').count(), 0);
    const readMotion = () => page.evaluate(() => ({
      float: document.querySelector('.pattern-float').style.transform,
      rail: document.querySelector('.marquee-rail').style.transform,
    }));
    const assertMoving = async (label) => {
      const before = await readMotion();
      await page.waitForTimeout(200);
      const after = await readMotion();
      assert.notEqual(after.float, before.float, `${label}: hero moves without scrolling`);
      assert.notEqual(after.rail, before.rail, `${label}: marquee moves automatically`);
    };
    await assertMoving('desktop');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await assertMoving('system preference does not stop owner-required motion');
    assert.equal(await page.locator('.pin-spacer').count(), 1);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      // ScrollTrigger debounces its resize refresh; inspect the settled layout.
      await page.waitForTimeout(350);
      await page.waitForFunction(() => {
        const heading = document.querySelector('h1');
        const lines = heading.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(heading).lineHeight);
        return Math.abs(lines - 2) < .01;
      });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No overflow at ${width}`);
      const lines = await page.locator('h1').evaluate((element) => element.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(element).lineHeight));
      assert.ok(Math.abs(lines - 2) < .01, `Two heading lines at ${width}, allowing subpixel rounding`);
    }
    for (let cycle = 0; cycle < 2; cycle += 1) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForFunction(() => !document.querySelector('.pin-spacer'));
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.waitForFunction(() => document.querySelectorAll('.pin-spacer').length === 1);
    }
    await page.getByRole('button', { name: 'Next practice tip' }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.learning-note h3').textContent(), 'Make a choice first.');
    await page.getByRole('button', { name: 'Previous practice tip' }).click();
    assert.equal(await page.locator('.learning-note h3').textContent(), 'Stay with the why.');
    await page.locator('.nav-action').click();
    await page.waitForFunction(() => { const box = document.querySelector('#session').getBoundingClientRect(); return box.top >= 70 && box.top < innerHeight; });
    for (const selector of ['#method .section-intro', '#app .section-intro', '#tracks .section-intro', '#help .section-intro', '.footer-cta']) {
      const chapterTop = await page.locator(selector).evaluate((element) => element.getBoundingClientRect().top + scrollY);
      await page.evaluate((top) => scrollTo({ top: Math.max(0, top - innerHeight * .92), behavior: 'instant' }), chapterTop);
      await page.waitForTimeout(750);
      const heading = page.locator(`${selector} h2`);
      const before = await heading.evaluate((element) => element.style.transform);
      await page.evaluate((top) => scrollTo({ top: Math.max(0, top - innerHeight * .3), behavior: 'instant' }), chapterTop);
      await page.waitForFunction(({ selector, before }) => document.querySelector(`${selector} h2`).style.transform !== before, { selector, before });
      assert.equal(await heading.evaluate((element) => getComputedStyle(element).opacity), '1', `${selector}: semantic heading remains readable`);
    }
    assert.notEqual(await page.locator('.scroll-progress').evaluate((element) => element.style.transform), 'scale(0, 1)');
    // Legacy query parameters no longer disable or gate motion.
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    await page.goto(`${base}/?motion=off`);
    await page.locator('#session input:enabled').first().waitFor();
    await assertMoving('legacy off URL');
    assert.equal(await page.locator('.motion-toggle, .marquee-control').count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => !document.querySelector('.pin-spacer'));
    await assertMoving('mobile');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    if (server) await new Promise((done) => server.httpServer.close(done));
    await rm(directory, { recursive: true, force: true });
  }
});
