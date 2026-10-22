import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';
import { loadPublicLegalArtifact } from '../src/publicLegalArtifact.js';
import { publicPages, publicPageFile, publicOrigin } from '../src/publicPages.js';

// Verify the existing production dist without rebuilding or substituting fixtures.
// Supply the same three legal artifact environment variables as the production build.
// Optional PATTERNLY_VERIFY_BASE_URL verifies remote bytes against this local dist.
const legal = loadPublicLegalArtifact(process.env, 'production');
const remote = process.env.PATTERNLY_VERIFY_BASE_URL;
const hosting = JSON.parse(await readFile('firebase.json', 'utf8'));
const hostingOrigin = `https://${hosting.hosting.site}.web.app`;
if (remote) assert.ok([publicOrigin, hostingOrigin].includes(remote), 'Remote verification requires the canonical domain or configured Firebase host.');
// This selector only reads an existing separate candidate; it never builds it.
const explicitBuild = process.env.PATTERNLY_PRODUCTION_BUILD_DIR;
const repository = realpathSync('.');
const contains = (parent, child) => {
  const path = relative(parent, child);
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path));
};
function resolveThroughExistingAncestor(path) {
  let ancestor = resolve(path);
  const missing = [];
  while (!existsSync(ancestor)) { missing.unshift(basename(ancestor)); ancestor = dirname(ancestor); }
  return resolve(realpathSync(ancestor), ...missing);
}
let buildRoot;
if (explicitBuild !== undefined) {
  assert.ok(explicitBuild.trim(), 'Production build directory must be nonempty.');
  assert.ok(!remote, 'A separate candidate cannot be combined with remote verification.');
  buildRoot = realpathSync(explicitBuild);
  assert.ok(statSync(buildRoot).isDirectory(), 'Production build directory must exist as a directory.');
  assert.ok(!contains(repository, buildRoot) && !contains(buildRoot, repository), 'Production candidate must be outside the repository and cannot contain it.');
} else buildRoot = realpathSync('dist');
const outputSelector = process.env.PATTERNLY_PRODUCTION_RECEIPT_DIR;
assert.ok(outputSelector?.trim(), 'PATTERNLY_PRODUCTION_RECEIPT_DIR must be a private evidence directory.');
const output = resolveThroughExistingAncestor(outputSelector);
assert.ok(!contains(buildRoot, output) && !contains(output, buildRoot), 'Evidence and production build directories must be disjoint.');
assert.ok(process.env.PATTERNLY_TEST_BROWSER_EXECUTABLE_PATH, 'Supply the Opera executable path.');
await mkdir(output, { recursive: true });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function manifest(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) files.push(...await manifest(resolve(directory, entry.name), `${path}/`));
    else {
      assert.ok(entry.isFile(), `Unexpected non-file: ${path}`);
      const bytes = await readFile(resolve(directory, entry.name));
      files.push({ path, bytes: bytes.length, sha256: hash(bytes) });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
const files = await manifest(buildRoot);
const pages = publicPages(legal);
const receipt = { mode: remote === publicOrigin ? 'remote-production' : remote ? 'firebase-hosting-production' : 'local-production', time: new Date().toISOString(), baseUrl: null, buildRoot,
  sourceFingerprint: legal.sourceFingerprint, approvedDocumentsSha256: legal.approvedDocumentsSha256,
  files, pages: [], negativeRoutes: [], browserErrors: [] };
let server;
let browser;
try {
  if (!remote) server = await preview({ mode: 'production', build: { outDir: buildRoot }, preview: { host: '127.0.0.1', port: 0 } });
  const base = remote ?? `http://127.0.0.1:${server.httpServer.address().port}`;
  receipt.baseUrl = base;
  if (remote === publicOrigin) {
    receipt.redirects = [];
    for (const origin of ['http://patternly.it', 'http://www.patternly.it', 'https://www.patternly.it']) {
      const response = await fetch(origin);
      assert.equal(response.status, 200, origin);
      assert.equal(new URL(response.url).origin, publicOrigin, origin);
      receipt.redirects.push({ origin, finalUrl: response.url, status: response.status });
    }
  }
  for (const file of files) {
    assert.ok(!/(?:^|\/)(?:admin|privacy-request)(?:[./]|$)/u.test(file.path), `Private route in dist: ${file.path}`);
    // Firebase cleanUrls redirects *.html to extensionless canonical paths.
    const path = remote && file.path.endsWith('.html')
      ? (file.path === 'index.html' ? '' : file.path.slice(0, -5)) : file.path;
    const response = await fetch(`${base}/${path}`, { redirect: 'manual' });
    assert.equal(response.status, 200, file.path);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())), file.sha256, `Byte mismatch: ${file.path}`);
  }
  browser = await chromium.launch({ executablePath: process.env.PATTERNLY_TEST_BROWSER_EXECUTABLE_PATH, headless: true });
  receipt.browserVersion = await browser.version();
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const page = await noJs.newPage();
  for (const route of pages) {
    const raw = await fetch(base + route.path, { redirect: 'manual' });
    assert.equal(raw.status, 200, route.path);
    const response = await page.goto(base + route.path);
    assert.equal(response.status(), 200, route.path);
    assert.equal(page.url(), base + route.path, `Unexpected redirect: ${route.path}`);
    const html = await page.content();
    assert.doesNotMatch(html, /UNAPPROVED TEST ONLY|\[(?:UNAPPROVED|UNRESOLVED|TO BE COMPLETED|DO UZUPEŁNIENIA)/u, route.path);
    assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), publicOrigin + route.path);
    assert.equal(await page.locator('html').getAttribute('lang'), route.locale);
    assert.ok((await page.locator('h1').innerText()).trim(), route.path);
    assert.equal(await page.locator('meta[name=robots][content*=noindex]').count(), 0, route.path);
    if (route.kind === 'legal') assert.equal(await page.locator('.legal-document').count(), 1, route.path);
    receipt.pages.push({ path: route.path, file: publicPageFile(route), status: response.status() });
  }
  await noJs.close();
  for (const path of ['/admin', '/admin/', '/admin.html', '/privacy-request', '/privacy-request/example', '/does-not-exist']) {
    const response = await fetch(base + path, { redirect: 'manual' });
    assert.equal(response.status, 404, path);
    receipt.negativeRoutes.push({ path, status: response.status });
  }
  const context = await browser.newContext();
  const interactive = await context.newPage();
  interactive.on('pageerror', (error) => receipt.browserErrors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await interactive.setViewportSize({ width, height: 900 });
    await interactive.goto(base);
    await interactive.locator('#session input:enabled').first().waitFor();
    assert.ok(await interactive.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow: ${width}`);
    await interactive.locator('#session label').first().click();
    assert.equal(await interactive.locator('#session input').first().isChecked(), true);
    await interactive.getByRole('button', { name: 'Check answer', exact: true }).click();
    await interactive.locator('.practice-feedback').waitFor();
    if (width === 390 || width === 1440) await interactive.screenshot({ path: resolve(output, `production-${width}.png`), fullPage: true });
  }
  await interactive.goto(base + '/pl/privacy');
  await interactive.locator('select:enabled').waitFor();
  await interactive.locator('select').selectOption('it');
  await interactive.waitForURL('**/it/privacy');
  assert.deepEqual(receipt.browserErrors, []);
  assert.deepEqual(await manifest(buildRoot), files, 'Verification changed dist.');
  receipt.status = 'PASS';
} catch (error) {
  receipt.status = 'FAIL';
  receipt.failure = error.message;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
  await writeFile(resolve(output, 'production-verification.json'), `${JSON.stringify(receipt, null, 2)}\n`);
}
console.log(JSON.stringify({ status: receipt.status, pages: receipt.pages.length, files: files.length, failure: receipt.failure }));
