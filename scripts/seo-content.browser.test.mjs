import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer, preview } from 'vite';
import { chromium } from 'playwright';
import { createAppProducedPublicLegalTestArtifact } from './publicLegalTestArtifact.mjs';
import { publicPages } from '../src/publicPages.js';
import { publicLegalRoute } from '../src/publicLegalLocales.js';
import { publicSitePlugin } from './public-site.mjs';

const marketingPaths = ['/', '/tracks/coding-interview', '/tracks/aws-solutions-architect-associate', '/tracks/claude-architecture-practice'];
const dist = resolve(process.env.PATTERNLY_WEB_TEST_OUT_DIR ?? 'dist');
const locales = ['en', 'pl', 'de', 'fr', 'es', 'it', 'et'];
const legalPaths = locales.flatMap((locale) => ['privacy', 'terms'].map((name) => `${locale === 'en' ? '' : `/${locale}`}/${name}`));
const fixture = createAppProducedPublicLegalTestArtifact();

test('route projection excludes unavailable locales and never advertises UNAPPROVED drafts', () => {
  const pages = publicPages(fixture);
  assert.deepEqual(pages.filter((page) => page.indexable).map((page) => page.path), marketingPaths);
  assert.equal(pages.length, 18);
  for (const path of legalPaths) {
    assert.equal(publicLegalRoute(path, fixture)?.locale, path.split('/').length === 2 ? 'en' : path.split('/')[1]);
    const transformed = publicSitePlugin(fixture, true).transformIndexHtml('<html><head></head></html>', { filename: '/privacy.html' });
    assert.ok(!transformed.tags.some((tag) => tag.attrs.rel === 'alternate'));
  }
  const partial = structuredClone(fixture);
  delete partial.documents.privacyPolicy.de;
  assert.equal(publicLegalRoute('/de/terms', partial), null);
  assert.ok(!publicPages(partial).some((page) => page.locale === 'de'));
  assert.equal(publicLegalRoute('/ja/terms', fixture), null);
  // Structural metadata branch only; this fixture is never built or treated as an approved export.
  const shape = { ...partial, testOnly: false };
  const metadata = publicSitePlugin(shape, false).transformIndexHtml('<html><head></head></html>', { filename: '/terms.html' });
  assert.deepEqual(metadata.tags.filter((tag) => tag.attrs.rel === 'alternate').map((tag) => tag.attrs.hrefLang), ['en', 'pl', 'fr', 'es', 'it', 'et']);
});

test('explicit test output rejects the repository, its descendants, ancestors and symlink aliases before building', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'patternly-web-output-guard-'));
  try {
    const alias = join(directory, 'repo-alias');
    await symlink(resolve('.'), alias);
    for (const output of ['', '.', 'dist', 'src/nested-output', '..', '/', alias, join(alias, 'new-output')]) {
      const result = spawnSync(process.execPath, ['scripts/build-local.mjs'], { encoding: 'utf8', env: { ...process.env, PATTERNLY_WEB_TEST_OUT_DIR: output } });
      assert.equal(result.status, 1, output);
      assert.match(result.stderr, /Test output directory must be/u, output);
      assert.doesNotMatch(result.stdout, /vite|canonical demo/iu, 'Rejected before build or demo preparation');
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

async function manifest(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) result.push(...await manifest(path, `${name}/`));
    else {
      const bytes = await readFile(path);
      result.push({ path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
  return result.sort((a, b) => a.path.localeCompare(b.path));
}

test('exact local test build: Opera crawl, no-JS content, persistent locale URLs and bounded samples', async () => {
  assert.ok(process.env.PATTERNLY_TEST_BROWSER_EXECUTABLE_PATH, 'Set PATTERNLY_TEST_BROWSER_EXECUTABLE_PATH to Opera.');
  const directory = await mkdtemp(join(tmpdir(), 'patternly-web-seo-'));
  const artifactPath = join(directory, 'legal.json');
  await writeFile(artifactPath, JSON.stringify(fixture));
  process.env.PATTERNLY_PUBLIC_LEGAL_ARTIFACT_PATH = artifactPath;
  process.env.PATTERNLY_PUBLIC_LEGAL_EXPECTED_FINGERPRINT = fixture.sourceFingerprint;
  const before = await manifest(dist);
  let server;
  let browser;
  const receipt = { mode: 'local-test', deployable: false, testOnly: true, urls: [], manifest: before };
  try {
    server = await preview({ mode: 'local-test', build: { outDir: dist }, preview: { host: '127.0.0.1', port: 0 } });
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ executablePath: process.env.PATTERNLY_TEST_BROWSER_EXECUTABLE_PATH, headless: true });
    receipt.browserVersion = await browser.version();
    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
    const page = await noJs.newPage();
    const titles = new Set();
    const descriptions = new Set();
    const internalLinks = new Set();
    const expectedPaths = [...marketingPaths, ...legalPaths];
    for (const path of expectedPaths) {
      const raw = await fetch(base + path, { redirect: 'manual' });
      assert.equal(raw.status, 200, path);
      const response = await page.goto(base + path);
      assert.equal(response.status(), 200, path);
      assert.equal(new URL(page.url()).pathname, path, `Unexpected redirect for ${path}`);
      assert.equal(await page.locator('h1').count(), 1, path);
      const title = await page.title();
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      assert.ok(title && description);
      assert.ok(!titles.has(title), `Duplicate title: ${path}`);
      assert.ok(!descriptions.has(description), `Duplicate description: ${path}`);
      titles.add(title); descriptions.add(description);
      assert.equal(await page.locator('link[rel="canonical"]').count(), 1);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://patternly.it${path}`);
      assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), `https://patternly.it${path}`);
      assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
      assert.equal(await page.locator('link[rel="alternate"]').count(), 0, 'UNAPPROVED test legal must have no hreflang');
      const locale = legalPaths.includes(path) ? (path.split('/').length === 2 ? 'en' : path.split('/')[1]) : 'en';
      assert.equal(await page.locator('html').getAttribute('lang'), locale);
      if (path === '/tracks/claude-architecture-practice') {
        const content = await page.locator('main').textContent();
        assert.match(content, /Solution Design and Architecture/u);
        assert.match(content, /review modes depend on eligible prior learning evidence/u);
        assert.match(content, /There is no interactive Claude sample on this website/u);
        assert.match(content, /not affiliated with or endorsed by Anthropic/u);
        assert.match(content, /does not establish certification readiness/u);
        assert.equal(await page.locator('a[href="https://platform.claude.com/docs/en/build-with-claude/overview"]').count(), 1);
        assert.equal(await page.locator('a.button-primary').getAttribute('href'), '/#claude-certified-architect-professional-certification');
      }
      if (legalPaths.includes(path)) {
        assert.equal(await page.locator('.legal-copy').getAttribute('lang'), locale);
        const document = path.endsWith('/terms') ? 'termsOfService' : 'privacyPolicy';
        const paragraphs = fixture.documents[document][locale].split(/\n{2,}/u).map((text) => text.trim()).filter(Boolean);
        assert.deepEqual(await page.locator('.legal-copy > p').allTextContents(), paragraphs, `Producer text changed: ${path}`);
        assert.equal(await page.locator('.legal-language-links a').count(), 7);
        const prefix = locale === 'en' ? '' : `/${locale}`;
        assert.deepEqual(await page.locator('.legal-footer a').evaluateAll((links) => links.map((link) => link.getAttribute('href'))), [`${prefix}/privacy`, `${prefix}/terms`, `${prefix}/terms#support`]);
        await page.reload();
        assert.equal(await page.locator('html').getAttribute('lang'), locale);
      }
      if (path.startsWith('/tracks/')) {
        assert.equal(await page.locator('.track-guide section').count(), 6);
        assert.ok(await page.locator('.track-guide').innerText().then((text) => text.split(/\s+/u).length > 350));
        assert.equal(await page.locator('input[type="radio"]').count(), 0, 'No additional question sample on guide pages');
        assert.ok(await page.locator('.track-guide ol li').count() >= 5);
      }
      for (const href of await page.locator('a[href]').evaluateAll((links) => links.map((link) => link.getAttribute('href')))) {
        if (href.startsWith('/') || href.startsWith('#')) internalLinks.add(new URL(href, base + path).href);
      }
      receipt.urls.push({ path, status: response.status(), redirected: false, locale, title, description, canonical: `https://patternly.it${path}` });
    }
    for (const url of internalLinks) {
      const response = await fetch(url, { redirect: "manual" });
      assert.equal(response.status, 200, `Broken internal link: ${url}`);
      await page.goto(url);
      const hash = new URL(url).hash.slice(1);
      if (hash) assert.equal(await page.locator(`[id="${hash}"]`).count(), 1, `Missing fragment: ${url}`);
    }
    await page.goto(base + '/');
    assert.deepEqual(await page.locator('#tracks a[href^="/tracks/"]').evaluateAll((links) => links.map((link) => link.getAttribute("href"))), marketingPaths.slice(1));
    const sitemap = await (await fetch(base + '/sitemap.xml')).text();
    assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]), marketingPaths.map((path) => `https://patternly.it${path}`));
    assert.doesNotMatch(sitemap, /privacy|terms|admin|\.example/u);
    assert.match(await (await fetch(base + '/robots.txt')).text(), /Disallow: \//u);
    for (const path of ['/ja/terms', '/en/terms', '/pl/unknown', '/tracks/unknown', '/admin', '/privacy-request']) {
      assert.equal((await fetch(base + path, { redirect: 'manual' })).status, 404, path);
    }
    for (const path of ['/privacy.html', '/terms.html', '/pl/terms.html', '/tracks/coding-interview.html']) {
      const response = await page.goto(base + path);
      assert.equal(response.status(), 200);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://patternly.it${path.replace(/\.html$/u, '')}`);
    }
    await noJs.close();
    const context = await browser.newContext();
    const live = await context.newPage();
    const errors = [];
    live.on('pageerror', (error) => errors.push(error.message));
    live.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    for (const path of expectedPaths.slice(1)) {
      await live.goto(base + path);
      await live.waitForTimeout(80);
      assert.equal(await live.locator('h1').count(), 1);
      assert.equal(await live.locator('html').getAttribute('lang'), receipt.urls.find((url) => url.path === path).locale);
    }
    for (const width of [320, 390, 768, 1440]) {
      await live.setViewportSize({ width, height: 900 });
      for (const path of marketingPaths.slice(1)) {
        await live.goto(base + path);
        await live.evaluate(() => document.fonts.ready);
        assert.ok(await live.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow ${width}: ${path}`);
        if (process.env.PATTERNLY_PUBLIC_SCREENSHOT_DIR && [390, 1440].includes(width)) {
          await mkdir(process.env.PATTERNLY_PUBLIC_SCREENSHOT_DIR, { recursive: true });
          await live.screenshot({ path: join(process.env.PATTERNLY_PUBLIC_SCREENSHOT_DIR, `${path.split('/').pop()}-${width}.png`), fullPage: true });
        }
      }
    }
    await live.goto(base + '/pl/terms');
    await live.locator('.legal-footer a').first().click();
    await live.waitForURL('**/pl/privacy');
    await live.locator('select:not(:disabled)').waitFor();
    assert.equal(await live.locator('html').getAttribute('lang'), 'pl');
    await live.goto(base + '/terms#support');
    await live.locator('select:not(:disabled)').waitFor();
    await live.locator('select').selectOption('pl');
    await live.waitForURL('**/pl/terms#support');
    await live.locator('select:not(:disabled)').waitFor();
    assert.equal(await live.locator('html').getAttribute('lang'), 'pl');
    assert.match(await live.locator('#support').textContent(), /^16\./u);
    await live.reload();
    assert.equal(await live.locator('html').getAttribute('lang'), 'pl');
    await live.locator('select:not(:disabled)').waitFor();
    await live.locator('select').selectOption('en');
    await live.waitForURL('**/terms#support');
    await live.locator('select:not(:disabled)').waitFor();
    assert.equal(await live.locator('html').getAttribute('lang'), 'en');
    await live.goto(base + '/tracks/aws-solutions-architect-associate');
    await live.getByRole('link', { name: 'Choose the AWS example' }).click();
    const aws = live.locator('#aws-certified-solutions-architect-associate .track-demo-button');
    await aws.waitFor({ state: 'visible' });
    await live.waitForFunction(() => !document.querySelector('#aws-certified-solutions-architect-associate .track-demo-button').disabled);
    await aws.click();
    assert.match(await live.locator('#session').textContent(), /AWS certification/u);
    const development = await createServer({ mode: 'local-test', logLevel: 'silent', server: { host: '127.0.0.1', port: 0 } });
    try {
      await development.listen();
      const developmentBase = development.resolvedUrls.local[0];
      await live.goto(new URL('/pl/terms#support', developmentBase).href);
      await live.locator('select:not(:disabled)').waitFor();
      assert.equal(await live.locator('html').getAttribute('lang'), 'pl');
      assert.equal(await live.title(), 'Warunki korzystania — Patternly');
      await live.reload();
      await live.locator('select:not(:disabled)').waitFor();
      assert.equal(await live.locator('html').getAttribute('lang'), 'pl');
      await live.goto(new URL('/tracks/coding-interview', developmentBase).href);
      await live.locator('.track-guide h1').waitFor();
      assert.equal(await live.title(), 'Coding interview practice: constraints and reasoning — Patternly');
      // Leave the dev page before shutting its server down, so HMR can close normally.
      await live.goto(base + '/');
    } finally { await development.close(); }
    assert.deepEqual(errors, []);
    await context.close();
    const manifestSource = JSON.parse(await readFile('scripts/app-preview-manifest.json', 'utf8'));
    for (const entry of manifestSource.images) {
      assert.equal(createHash('sha256').update(await readFile(entry.path)).digest('hex'), entry.sha256);
    }
    assert.equal(manifestSource.images.filter((entry) => entry.questionId).length, 1);
    assert.equal(manifestSource.images.find((entry) => entry.questionId).questionId, 'alg-complexity-amortized-001');
    assert.deepEqual(await manifest(dist), before, 'Build changed during verification');
    receipt.internalLinksChecked = internalLinks.size;
    receipt.result = 'PASS';
    if (process.env.PATTERNLY_SEO_RECEIPT_PATH) await writeFile(process.env.PATTERNLY_SEO_RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`);
  } finally {
    await browser?.close();
    if (server) await new Promise((done) => server.httpServer.close(done));
    await rm(directory, { recursive: true, force: true });
  }
});
