import assert from "node:assert/strict";
import { test } from "node:test";
import { getAdminConfigurationError } from "../src/adminConfig.js";

const config = { apiKey: "local", authDomain: "localhost", projectId: "demo-patternly-admin", appId: "local" };
const local = { development: true, hostname: "127.0.0.1", authEmulatorOrigin: "http://127.0.0.1:29199" };
const api = "http://127.0.0.1:28080";

test("local SDK environment requires an explicit complete development configuration", () => {
  assert.equal(getAdminConfigurationError(config, api, local), "");
  for (const options of [{}, { ...local, development: false }, { ...local, hostname: "public.example" }, { ...local, authEmulatorOrigin: "" }]) {
    assert.notEqual(getAdminConfigurationError(config, api, options), "");
  }
  assert.notEqual(getAdminConfigurationError({ ...config, projectId: "patternly-app-sandbox" }, api, local), "");
  assert.notEqual(getAdminConfigurationError(config, "https://api.example", local), "");
  assert.notEqual(getAdminConfigurationError(config, "https://api.example", { ...local, development: false }), "");
});

test("local origins reject remote destinations and ambiguous URLs", () => {
  for (const origin of ["http://127.0.0.1.example:28080", "http://192.168.1.1:28080", "https://localhost:28080", "http://user@localhost:28080", "http://localhost:28080/", "http://localhost:28080/path", "http://localhost:28080?", "http://localhost:28080#", " http://localhost:28080", "http://2130706433:28080", "http://localhost:080"]) {
    assert.notEqual(getAdminConfigurationError(config, origin, local), "", origin);
    assert.notEqual(getAdminConfigurationError(config, api, { ...local, authEmulatorOrigin: origin }), "", origin);
  }
  for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
    assert.equal(getAdminConfigurationError(config, `http://${host}:28080`, { ...local, hostname: host, authEmulatorOrigin: `http://${host}:29199` }), "");
  }
});

test("production configuration continues to require HTTPS without emulator configuration", () => {
  assert.equal(getAdminConfigurationError(config, "https://api.example"), "");
  assert.notEqual(getAdminConfigurationError(config, api), "");
});
