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
const forwarded = process.argv.slice(2);
for (let index = 0; index < forwarded.length; index += 1) {
  const argument = forwarded[index];
  if (argument === "--strictPort") continue;
  if (argument === "--host") {
    const host = forwarded[index + 1];
    if (host !== "localhost" && host !== "127.0.0.1") throw new Error("Local web development must bind to localhost or 127.0.0.1.");
    index += 1;
    continue;
  }
  if (argument === "--port") {
    const port = forwarded[index + 1];
    if (!/^[1-9][0-9]{0,4}$/u.test(port ?? "") || Number(port) > 65535) throw new Error("Local web development port must be valid.");
    index += 1;
    continue;
  }
  throw new Error(`Unsupported local web development argument: ${argument ?? "missing"}.`);
}
const server = spawn(process.execPath, [resolve(root, "node_modules/vite/bin/vite.js"), "--mode", "local-test", "--host", "localhost", ...forwarded], {
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
