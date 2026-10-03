import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = resolve(webRoot, "../patternly");
const write = process.argv.includes("--write");
const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/exportPublicDemo.mjs", ...(write ? [] : ["--check"])], {
  cwd: appRoot,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
