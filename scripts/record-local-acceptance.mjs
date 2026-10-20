import { verifyCurrentDemoCatalog, verifyCaptureQuestion } from "./current-demo-contract.mjs";
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, lstatSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppProducedPublicLegalTestArtifact } from './publicLegalTestArtifact.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [browserReceiptPath, outputPath, ...extra] = process.argv.slice(2);
assert.ok(browserReceiptPath && outputPath && !extra.length, 'Usage: node scripts/record-local-acceptance.mjs <browser-receipt.json> <private-output.json>');
const outputRelative = relative(root, resolve(outputPath));
assert.ok(outputRelative.startsWith('..') || isAbsolute(outputRelative), 'Keep runtime receipts outside the WEB repository.');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const file = (directory, path) => {
  const fullPath = resolve(directory, path);
  assert.ok(lstatSync(fullPath).isFile(), `Expected regular input file: ${path}`);
  const bytes = readFileSync(fullPath);
  return { path, bytes: bytes.length, sha256: hash(bytes) };
};
const tree = (directory, prefix = '') => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
  ? tree(resolve(directory, entry.name), `${prefix}${entry.name}/`)
  : [file(resolve(root, 'dist'), `${prefix}${entry.name}`)]).sort((a, b) => a.path.localeCompare(b.path));
const git = (directory, args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const sources = (directory, paths = []) => {
  const files = git(directory, ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...paths]).split('\0').filter(Boolean);
  return {
    head: git(directory, ['rev-parse', 'HEAD']).trim(),
    status: git(directory, ['status', '--porcelain', '--', ...paths]).trim().split('\n').filter(Boolean),
    files: [...new Set(files)].filter((path) => { try { return lstatSync(resolve(directory, path)).isFile(); } catch { return false; } }).sort().map((path) => file(directory, path)),
  };
};
const browserReceipt = JSON.parse(readFileSync(resolve(browserReceiptPath)));
const manifest = tree(resolve(root, 'dist'));
assert.equal(browserReceipt.result, 'PASS');
assert.equal(browserReceipt.mode, 'local-test');
assert.equal(browserReceipt.testOnly, true);
assert.equal(browserReceipt.deployable, false);
assert.deepEqual(manifest, browserReceipt.manifest, 'The tested build changed after the Opera crawl.');
const legal = createAppProducedPublicLegalTestArtifact();
const demo = verifyCurrentDemoCatalog();
const capture = verifyCaptureQuestion(demo);
const appRoot = resolve(root, '../patternly');
const contentRoot = resolve(process.env.PATTERNLY_CONTENT_CURRENT_ROOT ?? resolve(root, '../patternly-content'));
const receipt = {
  mode: 'local-test', deployable: false, testOnly: true,
  recordedAt: new Date().toISOString(),
  nodeVersion: process.version,
  browserExecutable: process.env.PATTERNLY_TEST_BROWSER_EXECUTABLE_PATH,
  browserReceipt: { path: resolve(browserReceiptPath), sha256: hash(readFileSync(resolve(browserReceiptPath))), browserVersion: browserReceipt.browserVersion },
  installedWebPackages: Object.fromEntries(['vite', 'playwright', 'react', 'react-dom'].map((name) => [name, JSON.parse(readFileSync(resolve(root, 'node_modules', name, 'package.json'))).version])),
  web: sources(root),
  app: sources(appRoot, ['src', 'scripts', 'integration', 'config', 'native', 'plugins', 'package.json', 'package-lock.json', 'app.config.js', 'eas.json']),
  content: sources(contentRoot, ['content', 'config', 'scripts', 'package.json', 'package-lock.json']),
  legal: { documentVersion: legal.documentVersion, sourceFingerprint: legal.sourceFingerprint, approvalStatus: legal.approvalStatus, artifactSha256: hash(Buffer.from(JSON.stringify(legal))) },
  currentSource: { sourceInputFingerprint: demo.publicSamples[0].sourceInputFingerprint, releaseId: demo.publicSamples[0].releaseId,
    identity: JSON.parse(readFileSync(resolve(appRoot, 'integration/contracts/content-release/release.lock.json'))).currentIdentity },
  capture,
  publicSamples: demo.publicSamples,
  manifest,
  limitations: ['R01 unresolved; no approved production legal artifact or independent production fingerprint.', 'Dirty APP/WEB are recorded, not hidden or approved as clean release pins.', 'Current-source identity is derived from validated inputs; exact selected-source, lock and Free-pool checks establish only the public sample scope.', 'No production build, production mobile performance measurement, publish or live R02 acceptance.'],
};
writeFileSync(resolve(outputPath), `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify({ path: resolve(outputPath), mode: receipt.mode, deployable: false, files: manifest.length, sha256: hash(readFileSync(resolve(outputPath))) })}\n`);
