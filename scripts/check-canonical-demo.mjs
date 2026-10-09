import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = resolve(webRoot, "../patternly");
const args = process.argv.slice(2);
const localAdmittedSource = args.includes("--local-admitted-source");
const write = args.includes("--write");
if (args.some((argument) => !["--write", "--local-admitted-source"].includes(argument)) || new Set(args).size !== args.length) {
  throw new Error("Usage: check-canonical-demo.mjs [--write] [--local-admitted-source]");
}
const exporterArgs = localAdmittedSource
  ? ["--local-admitted-source", ...(write ? ["--write"] : ["--check"])]
  : write ? [] : ["--check"];
const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/exportPublicDemo.mjs", ...exporterArgs], {
  cwd: appRoot,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
