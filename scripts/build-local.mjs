import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createAppProducedPublicLegalTestArtifact } from "./publicLegalTestArtifact.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Resolve existing ancestors so a symlink cannot redirect a test build into the repo.
const explicitOutput = process.env.PATTERNLY_WEB_TEST_OUT_DIR;
let output;
if (explicitOutput !== undefined) {
  if (!explicitOutput.trim()) throw new Error("Test output directory must be nonempty.");
  let ancestor = resolve(root, explicitOutput);
  const missing = [];
  while (!existsSync(ancestor)) { missing.unshift(basename(ancestor)); ancestor = dirname(ancestor); }
  output = resolve(realpathSync(ancestor), ...missing);
  const repository = realpathSync(root);
  const contains = (parent, child) => { const path = relative(parent, child); return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path)); };
  if (contains(repository, output) || contains(output, repository)) throw new Error("Test output directory must be outside the repository and cannot contain it.");
}
const demoCheck = spawnSync(process.execPath, [resolve(root, "scripts/check-canonical-demo.mjs")], { cwd: root, stdio: "inherit" });
if (demoCheck.error) throw demoCheck.error;
if (demoCheck.status !== 0) process.exit(demoCheck.status ?? 1);
const artifact = createAppProducedPublicLegalTestArtifact();
const fixtureDirectory = mkdtempSync(resolve(tmpdir(), "patternly-public-legal-test-"));
const fixturePath = resolve(fixtureDirectory, "public-legal.json");
writeFileSync(fixturePath, `${JSON.stringify(artifact, null, 2)}\n`);
try {
  const result = spawnSync(process.execPath, [resolve(root, "node_modules/vite/bin/vite.js"), "build", "--mode", "local-test", ...(output ? ["--outDir", output] : [])], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      PATTERNLY_PUBLIC_LEGAL_ARTIFACT_PATH: fixturePath,
      PATTERNLY_PUBLIC_LEGAL_EXPECTED_FINGERPRINT: artifact.sourceFingerprint,
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  else {
    const demoVerification = spawnSync(process.execPath, [resolve(root, "scripts/verify-demo-bundle.mjs")], { cwd: root, stdio: "inherit" });
    if (demoVerification.error) throw demoVerification.error;
    process.exitCode = demoVerification.status ?? 1;
  }
} finally {
  rmSync(fixtureDirectory, { recursive: true, force: true });
}
