import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = resolve(web, "../patternly");
const output = resolve(process.argv[2] || "/tmp/patternly-web03c-local-manifest.json");

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

const verify = spawnSync("npm", ["run", "verify:local"], { cwd: web, stdio: "inherit" });
if (verify.error) throw verify.error;
if (verify.status !== 0) process.exit(verify.status || 1);

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
  hosting: { project, site: hosting.site, public: hosting.public, firebaseJsonSha256: sha(resolve(web, "firebase.json")), firebasercSha256: sha(resolve(web, ".firebaserc")) },
  source: {
    web: { head: git(web, "rev-parse", "HEAD"), status: git(web, "status", "--porcelain=v1", "--untracked-files=all") },
    app: { head: git(app, "rev-parse", "HEAD"), status: git(app, "status", "--porcelain=v1", "--untracked-files=all") },
    legalReleaseSourceSha256: sha(resolve(app, "config/public-legal.release.json")),
    legalExporterSha256: sha(resolve(app, "scripts/exportPublicLegal.mjs")),
    testArtifactProducerSha256: sha(resolve(web, "scripts/publicLegalTestArtifact.mjs")),
  },
  assets,
};
writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`Local-only WEB-03C manifest: ${output}\n`);
