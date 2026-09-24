import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createAppProducedPublicLegalTestArtifact } from "./publicLegalTestArtifact.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifact = createAppProducedPublicLegalTestArtifact();
const fixtureDirectory = mkdtempSync(resolve(tmpdir(), "patternly-public-legal-dev-"));
const fixturePath = resolve(fixtureDirectory, "public-legal.json");
writeFileSync(fixturePath, `${JSON.stringify(artifact, null, 2)}\n`);
const server = spawn(process.execPath, [resolve(root, "node_modules/vite/bin/vite.js"), "--mode", "local-test", "--host", "localhost"], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    PATTERNLY_PUBLIC_LEGAL_ARTIFACT_PATH: fixturePath,
    PATTERNLY_PUBLIC_LEGAL_EXPECTED_FINGERPRINT: artifact.sourceFingerprint,
  },
});
server.on("exit", (code) => {
  rmSync(fixtureDirectory, { recursive: true, force: true });
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
