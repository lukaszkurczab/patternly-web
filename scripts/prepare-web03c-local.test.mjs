import assert from "node:assert/strict";
import test from "node:test";
import { assertCleanSourceState, resolveSafeOutputPath } from "./prepare-web03c-local.mjs";

test("requires clean app and web sources", () => {
  assert.doesNotThrow(() => assertCleanSourceState("", ""));
  assert.throws(() => assertCleanSourceState(" M src/a.js", ""), /clean web worktree/u);
  assert.throws(() => assertCleanSourceState("", "?? src/a.ts"), /clean app worktree/u);
});

test("keeps generated evidence outside both repositories", () => {
  assert.equal(resolveSafeOutputPath("/tmp/patternly-web03c-test.json"), "/tmp/patternly-web03c-test.json");
  assert.throws(() => resolveSafeOutputPath("docs/manifest.json"), /outside the app and web repositories/u);
  assert.throws(() => resolveSafeOutputPath("../patternly/docs/manifest.json"), /outside the app and web repositories/u);
});
