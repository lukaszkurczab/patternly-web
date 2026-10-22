// Bounded local laboratory observation, separate from production acceptance.
// Run only after verify-production PASS with the same legal artifact and candidate.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const contains = (parent, child) => {
  const path = relative(parent, child);
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path));
};
const buildRoot = await realpath(process.env.PATTERNLY_PRODUCTION_BUILD_DIR ?? '');
const repository = await realpath('.');
assert.ok(!contains(repository, buildRoot) && !contains(buildRoot, repository), 'Select a separate production candidate.');
assert.ok(process.env.PATTERNLY_MOBILE_LAB_RECEIPT_DIR?.trim(), 'Supply an existing private lab evidence directory.');
const output = await realpath(process.env.PATTERNLY_MOBILE_LAB_RECEIPT_DIR);
assert.ok(!contains(repository, output) && !contains(output, repository), 'Lab evidence must be outside the repository and cannot contain it.');
assert.ok(!contains(buildRoot, output) && !contains(output, buildRoot), 'Lab evidence and candidate must be disjoint.');
const acceptance = JSON.parse(await readFile(process.env.PATTERNLY_PRODUCTION_ACCEPTANCE_PATH, 'utf8'));
assert.equal(acceptance.status, 'PASS');
assert.equal(acceptance.mode, 'local-production');
assert.equal(acceptance.buildRoot, buildRoot);
assert.ok(process.env.PATTERNLY_TEST_BROWSER_EXECUTABLE_PATH, 'Supply the verified Opera executable.');
async function manifest(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) files.push(...await manifest(resolve(directory, entry.name), `${path}/`));
    else {
      assert.ok(entry.isFile(), `Unexpected candidate entry: ${path}`);
      const bytes = await readFile(resolve(directory, entry.name));
      files.push({ path, bytes: bytes.length, sha256: hash(bytes) });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
const files = await manifest(buildRoot);
assert.deepEqual(files, acceptance.files, 'Candidate differs from production acceptance.');
const receipt = {
  status: 'RUNNING', time: new Date().toISOString(), buildRoot,
  manifestSha256: hash(JSON.stringify(files)),
  sourceFingerprint: acceptance.sourceFingerprint,
  approvedDocumentsSha256: acceptance.approvedDocumentsSha256,
  profile: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    cpuRate: 4, latencyMs: 150, downloadBytesPerSecond: 200000, uploadBytesPerSecond: 93750 },
  navigationTimeoutMs: 30000, observationAfterLoadMs: 10000,
  observationReason: 'Fixed ten seconds after load permits font/reveal settling without interaction or indefinite stabilization.',
  limits: ['Synthetic mobile profile on host Opera, not a physical phone.',
    'Six cold local samples; no INP, p75 field CWV, Lighthouse score, CrUX or Search Console.',
    'Loopback transfer timings and synthetic throttling are laboratory observations, not production-user measurements.'],
  samples: [],
};
let server;
let browser;
try {
  server = await preview({ mode: 'production', build: { outDir: buildRoot }, preview: { host: '127.0.0.1', port: 0 } });
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.PATTERNLY_TEST_BROWSER_EXECUTABLE_PATH, headless: true });
  receipt.browserVersion = browser.version();
  for (const path of ['/', '/tracks/claude-architecture-practice']) {
    for (let run = 1; run <= 3; run += 1) {
      const sample = { path, run, cold: true, externalRequests: [], browserErrors: [] };
      receipt.samples.push(sample);
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      try {
        await context.route('**/*', (route) => {
          const url = new URL(route.request().url());
          if (url.origin === base) return route.continue();
          sample.externalRequests.push(url.origin);
          return route.abort();
        });
        await context.addInitScript(() => {
          window.__patternlyLab = { lcp: [], shifts: [], errors: [] };
          for (const type of ['largest-contentful-paint', 'layout-shift']) {
            try {
              new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                  if (type === 'largest-contentful-paint') window.__patternlyLab.lcp.push({ startTime: entry.startTime, size: entry.size, renderTime: entry.renderTime, loadTime: entry.loadTime });
                  else window.__patternlyLab.shifts.push({ startTime: entry.startTime, value: entry.value, hadRecentInput: entry.hadRecentInput });
                }
              }).observe({ type, buffered: true });
            } catch (error) { window.__patternlyLab.errors.push(`${type}: ${error.message}`); }
          }
        });
        const page = await context.newPage();
        page.on('pageerror', (error) => sample.browserErrors.push(error.message));
        const cdp = await context.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750, connectionType: 'cellular4g' });
        const response = await page.goto(base + path, { waitUntil: 'load', timeout: receipt.navigationTimeoutMs });
        assert.equal(response.status(), 200);
        assert.equal(page.url(), base + path);
        await page.waitForTimeout(receipt.observationAfterLoadMs);
        sample.raw = await page.evaluate(() => ({
          ...window.__patternlyLab,
          supportedEntryTypes: PerformanceObserver.supportedEntryTypes,
          observedAtMs: performance.now(),
          navigation: performance.getEntriesByType('navigation').map(({ duration, domContentLoadedEventEnd, loadEventEnd, responseEnd, transferSize }) => ({ duration, domContentLoadedEventEnd, loadEventEnd, responseEnd, transferSize })),
          resourceCount: performance.getEntriesByType('resource').length,
        }));
        assert.deepEqual(sample.externalRequests, []);
        assert.deepEqual(sample.browserErrors, []);
        assert.deepEqual(sample.raw.errors, []);
        sample.lcpMs = sample.raw.lcp.length ? sample.raw.lcp.at(-1).startTime : 'NOT_AVAILABLE';
        // Bounded-window shift sum, deliberately not labelled field/session-window CLS.
        sample.layoutShiftSum = sample.raw.supportedEntryTypes.includes('layout-shift')
          ? sample.raw.shifts.filter((entry) => !entry.hadRecentInput).reduce((sum, entry) => sum + entry.value, 0) : 'NOT_AVAILABLE';
        sample.status = sample.lcpMs === 'NOT_AVAILABLE' ? 'METRIC_NOT_AVAILABLE' : 'OBSERVED';
        console.log(JSON.stringify({ path, run, status: sample.status, lcpMs: sample.lcpMs, layoutShiftSum: sample.layoutShiftSum }));
      } finally { await context.close(); }
    }
  }
  assert.deepEqual(await manifest(buildRoot), files, 'Lab changed candidate bytes.');
  receipt.status = receipt.samples.every((sample) => sample.status === 'OBSERVED') ? 'OBSERVED' : 'PARTIAL_METRICS';
} catch (error) {
  receipt.status = 'FAIL'; receipt.failure = error.message; process.exitCode = 1;
} finally {
  await browser?.close(); await server?.close();
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'mobile-lab.json'), `${JSON.stringify(receipt, null, 2)}\n`);
}
console.log(JSON.stringify({ status: receipt.status, samples: receipt.samples.length, failure: receipt.failure }));
