import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = resolve(web, "../patternly");
const defaultOutput = "/tmp/patternly-web03c-local-manifest.json";

function git(root, ...args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim());
  return result.stdout.trim();
}
function sha(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

function isInside(root, path) {
  const pathFromRoot = relative(root, path);
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
}

export function resolveSafeOutputPath(argument = defaultOutput) {
  const output = resolve(argument);
  assert.ok(!isInside(web, output) && !isInside(app, output), "WEB-03C manifest must be written outside the app and web repositories.");
  return output;
}

export function assertCleanSourceState(webStatus, appStatus) {
  assert.equal(webStatus, "", "WEB-03C preparation requires a clean web worktree.");
  assert.equal(appStatus, "", "WEB-03C preparation requires a clean app worktree.");
}

export function runWeb03cPreparation(outputArgument = defaultOutput) {
  const output = resolveSafeOutputPath(outputArgument);
  const before = {
    webHead: git(web, "rev-parse", "HEAD"),
    webStatus: git(web, "status", "--porcelain=v1", "--untracked-files=all"),
    appHead: git(app, "rev-parse", "HEAD"),
    appStatus: git(app, "status", "--porcelain=v1", "--untracked-files=all"),
  };
  assertCleanSourceState(before.webStatus, before.appStatus);

  const verify = spawnSync("npm", ["run", "verify:local"], { cwd: web, stdio: "inherit" });
  if (verify.error) throw verify.error;
  if (verify.status !== 0) throw new Error(`verify:local failed with exit ${verify.status ?? "unknown"}.`);

  const after = {
    webHead: git(web, "rev-parse", "HEAD"),
    webStatus: git(web, "status", "--porcelain=v1", "--untracked-files=all"),
    appHead: git(app, "rev-parse", "HEAD"),
    appStatus: git(app, "status", "--porcelain=v1", "--untracked-files=all"),
  };
  assert.deepEqual(after, before, "App or web source changed while WEB-03C preparation was running.");

  const hosting = JSON.parse(readFileSync(resolve(web, "firebase.json"), "utf8")).hosting;
  const project = JSON.parse(readFileSync(resolve(web, ".firebaserc"), "utf8")).projects.default;
  assert.equal(hosting.site, "patternly-app-sandbox");
  assert.equal(project, hosting.site);
  assert.equal(hosting.public, "dist");
  assert.equal(hosting.rewrites, undefined);
  assert.equal(hosting.redirects, undefined);

  const dist = resolve(web, hosting.public);
  const assets = files(dist).map((path) => ({
    path: relative(dist, path).replaceAll("\\", "/"),
    bytes: statSync(path).size,
    sha256: sha(path),
  })).sort((a, b) => a.path.localeCompare(b.path));
  assert.ok(assets.some(({ path }) => path === "index.html"));
  assert.ok(!assets.some(({ path }) => /(^|\/)(?:admin|privacy-request)(?:\/|\.|$)/u.test(path)));

  const manifest = {
    schema: "patternly-web03c-local-preparation-v1",
    mode: "local-test",
    deployable: false,
    sourceClean: true,
    toolchain: { node: process.version, packageLockSha256: sha(resolve(web, "package-lock.json")) },
    hosting: { project, site: hosting.site, public: hosting.public, firebaseJsonSha256: sha(resolve(web, "firebase.json")), firebasercSha256: sha(resolve(web, ".firebaserc")) },
    source: {
      web: { head: before.webHead },
      app: { head: before.appHead },
      legalReleaseSourceSha256: sha(resolve(app, "config/public-legal.release.json")),
      legalExporterSha256: sha(resolve(app, "scripts/exportPublicLegal.mjs")),
      testArtifactProducerSha256: sha(resolve(web, "scripts/publicLegalTestArtifact.mjs")),
    },
    assets,
  };
  writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`Local-only WEB-03C manifest: ${output}\n`);
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runWeb03cPreparation(process.argv[2]);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
