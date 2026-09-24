import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createAppProducedPublicLegalTestArtifact } from "./publicLegalTestArtifact.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifact = createAppProducedPublicLegalTestArtifact();
const fixtureDirectory = mkdtempSync(resolve(tmpdir(), "patternly-public-legal-test-"));
const fixturePath = resolve(fixtureDirectory, "public-legal.json");
writeFileSync(fixturePath, `${JSON.stringify(artifact, null, 2)}\n`);
try {
  const result = spawnSync(process.execPath, [resolve(root, "node_modules/vite/bin/vite.js"), "build", "--mode", "local-test"], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      PATTERNLY_PUBLIC_LEGAL_ARTIFACT_PATH: fixturePath,
      PATTERNLY_PUBLIC_LEGAL_EXPECTED_FINGERPRINT: artifact.sourceFingerprint,
    },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(fixtureDirectory, { recursive: true, force: true });
}
