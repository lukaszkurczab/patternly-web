// Controlled browser tests of the real React component. Firebase aliases live only here.
// Real SDK/Auth Emulator/API/Firestore integration is a separate acceptance check.
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test, before, after } from "node:test";
import { createServer } from "vite";
import { chromium, expect } from "playwright/test";
import viteConfig from "../vite.config.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.ADMIN_BEHAVIOR_PORT || 25188);
const origin = `http://127.0.0.1:${port}`;
const api = "https://admin-api.test";
let server;
let browser;
const entry = (status = "open", id = "11111111-1111-4111-8111-111111111111") => ({
  clientSubmissionId: id, itemId: "test-question", trackId: "test-track",
  reason: "other", description: "Opis zgłoszenia do testu komponentu.", status,
  createdAt: "2026-09-03T08:00:00Z", context: {},
});

before(async () => {
  server = await createServer({
    ...viteConfig, configFile: false, root,
    server: { host: "127.0.0.1", port, strictPort: true },
    resolve: { alias: {
      "firebase/app": resolve(root, "scripts/admin-behavior/firebase-app.mjs"),
      "firebase/auth": resolve(root, "scripts/admin-behavior/firebase-auth.mjs"),
    } },
    define: Object.fromEntries(Object.entries({
      VITE_ADMIN_FIREBASE_API_KEY: "component-test-key",
      VITE_ADMIN_FIREBASE_AUTH_DOMAIN: "auth.test",
      VITE_ADMIN_FIREBASE_PROJECT_ID: "component-test",
      VITE_ADMIN_FIREBASE_APP_ID: "component-test-app",
      VITE_ADMIN_API_ORIGIN: api,
    }).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])),
  });
  await server.listen();
  browser = await chromium.launch({ headless: true,
    ...(process.env.ADMIN_BROWSER_EXECUTABLE ? { executablePath: process.env.ADMIN_BROWSER_EXECUTABLE } : {}),
  });
});
after(async () => { await browser?.close(); await server?.close(); });

async function screen(t) {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const state = { reports: [entry()], requests: [], handler: null };
  await page.route(`${api}/**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    state.requests.push({ method: request.method(), token: request.headers().authorization });
    if (state.handler && await state.handler(route)) return;
    if (request.method() === "GET") return route.fulfill({ json: { reports: state.reports } });
    const report = entry(request.postDataJSON().status);
    state.reports = report.status === "closed" ? [] : [report];
    await route.fulfill({ json: { report } });
  });
  await page.goto(`${origin}/admin`);
  await expect(page.getByLabel("Adres e-mail")).toBeVisible();
  const login = async () => {
    await page.getByLabel("Adres e-mail").fill("admin@example.test");
    await page.getByLabel("Hasło").fill("test-password");
    await page.getByRole("button", { name: "Zaloguj się", exact: true }).click();
  };
  const ready = () => expect(page.getByRole("button", { name: "Rozpocznij analizę" })).toBeEnabled();
  return { page, state, login, ready };
}

test("full cycle and callback-before-promise login/logout clear credentials", async (t) => {
  const { page, state, login, ready } = await screen(t);
  await login(); await ready();
  for (const label of ["Rozpocznij analizę", "Oznacz jako rozwiązane", "Zamknij zgłoszenie"]) {
    await page.getByRole("button", { name: label }).click();
  }
  await expect(page.locator(".admin-report")).toHaveCount(0);
  assert.equal(state.requests.filter((r) => r.method === "PATCH").length, 3);
  await page.getByRole("button", { name: "Wyloguj się" }).click();
  await expect(page.getByText("Wylogowano.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Adres e-mail")).toHaveValue("");
  await expect(page.getByLabel("Hasło")).toHaveValue("");
});

test("delayed logout prevents another authentication operation", async (t) => {
  const { page, login, ready } = await screen(t);
  await login(); await ready();
  await page.evaluate(() => { adminTestAuth.logoutMode = "pending"; });
  await page.getByRole("button", { name: "Wyloguj się" }).click();
  await expect(page.getByLabel("Adres e-mail")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Wyloguj się" })).toBeDisabled();
  await expect(page.locator(".admin-report")).toHaveCount(0);
  await page.evaluate(() => adminTestAuth.logout.resolve());
  await expect(page.getByRole("button", { name: "Zaloguj się", exact: true })).toBeEnabled();
});

for (const mode of ["failure", "cleared-failure"]) {
  test(`failed logout (${mode}) is explicit and retryable`, async (t) => {
    const { page, login, ready } = await screen(t);
    await login(); await ready();
    await page.evaluate((value) => { adminTestAuth.logoutMode = value; }, mode);
    await page.getByRole("button", { name: "Wyloguj się" }).click();
    await expect(page.getByText(/Nie udało się wylogować/)).toBeVisible();
    await expect(page.getByLabel("Hasło")).toHaveCount(0);
    await expect(page.locator(".admin-report")).toHaveCount(0);
    await page.evaluate(() => { adminTestAuth.logoutMode = "success"; });
    await page.getByRole("button", { name: "Ponów wylogowanie" }).click();
    await expect(page.getByLabel("Hasło")).toHaveValue("");
  });
}

for (const status of [401, 403]) {
  test(`GET ${status} removes previously visible data`, async (t) => {
    const { page, state, login, ready } = await screen(t);
    await login(); await ready();
    state.handler = async (route) => { await route.fulfill({ status, json: {} }); return true; };
    await page.getByRole("button", { name: "Odśwież kolejkę" }).click();
    await expect(page.getByRole("alert")).toContainText("Dostęp administratora");
    await expect(page.locator(".admin-report")).toHaveCount(0);
  });
}

for (const status of [404, 409]) {
  test(`PATCH ${status} requires successful refresh before another write`, async (t) => {
    const { page, state, login, ready } = await screen(t);
    await login(); await ready();
    state.handler = async (route) => { await route.fulfill({ status, json: {} }); return true; };
    await page.getByRole("button", { name: "Rozpocznij analizę" }).click();
    await expect(page.getByRole("alert")).toContainText("Odśwież kolejkę");
    await expect(page.getByRole("button", { name: "Rozpocznij analizę" })).toBeDisabled();
    state.handler = null;
    await page.getByRole("button", { name: "Odśwież kolejkę" }).click();
    await ready();
  });
}

test("uncertain PATCH and failed refresh keep writes locked until a successful read", async (t) => {
  const { page, state, login, ready } = await screen(t);
  await login(); await ready();
  state.handler = async (route) => { await route.abort("failed"); return true; };
  await page.getByRole("button", { name: "Rozpocznij analizę" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Odśwież kolejkę" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rozpocznij analizę" })).toBeDisabled();
  state.handler = null;
  await page.getByRole("button", { name: "Odśwież kolejkę" }).click();
  await ready();
  assert.equal(state.requests.filter((r) => r.method === "PATCH").length, 1);
});

test("manual refresh asks Firebase for refreshed claims", async (t) => {
  const { page, login, ready } = await screen(t);
  await login(); await ready();
  assert.equal(await page.evaluate(() => adminTestAuth.tokenRequests[0].force), false);
  await page.getByRole("button", { name: "Odśwież kolejkę" }).click();
  await ready();
  assert.equal(await page.evaluate(() => adminTestAuth.tokenRequests.at(-1).force), true);
});

test("token timeout locks writes and a late token cannot issue a stale request", async (t) => {
  const { page, state, login, ready } = await screen(t);
  await login(); await ready();
  await page.clock.install();
  await page.evaluate(() => { adminTestAuth.tokenMode = "pending"; });
  await page.getByRole("button", { name: "Odśwież kolejkę" }).click();
  await page.clock.runFor(12001);
  await expect(page.getByRole("alert")).toContainText("Przekroczono czas");
  await expect(page.getByRole("button", { name: "Rozpocznij analizę" })).toBeDisabled();
  await page.evaluate(() => { adminTestAuth.tokens.forEach((finish) => finish()); adminTestAuth.tokenMode = "success"; });
  assert.equal(state.requests.length, 1);
  await page.getByRole("button", { name: "Odśwież kolejkę" }).click();
  await ready();
});

test("duplicate sign-in and duplicate PATCH produce one operation each", async (t) => {
  const { page, state, login, ready } = await screen(t);
  await page.evaluate(() => { adminTestAuth.loginMode = "pending"; });
  await login();
  await page.locator("form").evaluate((form) => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  assert.equal(await page.evaluate(() => adminTestAuth.loginCalls), 1);
  await page.evaluate(() => adminTestAuth.login.resolve());
  await ready();
  await page.getByRole("button", { name: "Rozpocznij analizę" }).evaluate((button) => { button.click(); button.click(); });
  await expect(page.getByRole("button", { name: "Oznacz jako rozwiązane" })).toBeEnabled();
  assert.equal(state.requests.filter((r) => r.method === "PATCH").length, 1);
});

for (const changedSession of [false, true]) {
  test(`late GET cannot restore data after ${changedSession ? "user change" : "logout"}`, async (t) => {
    const { page, state, login, ready } = await screen(t);
    await login(); await ready();
    let finish;
    state.handler = async (route) => {
      await new Promise((resolve) => { finish = resolve; });
      await route.fulfill({ json: { reports: [entry("resolved")] } }).catch(() => {});
      return true;
    };
    await page.getByRole("button", { name: "Odśwież kolejkę" }).click();
    await expect.poll(() => Boolean(finish)).toBe(true);
    state.handler = null;
    if (changedSession) {
      state.reports = [];
      await page.evaluate(() => adminTestAuth.emit("second@example.test"));
      await expect(page.getByText("Kolejka jest pusta.")).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Wyloguj się" }).click();
      await expect(page.getByLabel("Hasło")).toBeVisible();
    }
    finish();
    await expect(page.locator(".admin-report")).toHaveCount(0);
  });
}

test("timeout covers a response body that never completes", async (t) => {
  const { page, login, ready } = await screen(t);
  await login(); await ready();
  await page.clock.install();
  await page.evaluate(() => {
    const original = window.fetch;
    window.fetch = (url, options) => options?.method === "PATCH"
      ? Promise.resolve(new Response(new ReadableStream({ start(controller) {
        controller.enqueue(new TextEncoder().encode('{"report":'));
      } }), { headers: { "content-type": "application/json" } }))
      : original(url, options);
  });
  await page.getByRole("button", { name: "Rozpocznij analizę" }).click();
  await page.clock.runFor(12001);
  await expect(page.getByRole("alert")).toContainText("Wynik zapisu jest niepewny");
  await expect(page.getByRole("button", { name: "Rozpocznij analizę" })).toBeDisabled();
  await page.getByRole("button", { name: "Odśwież kolejkę" }).click();
  await ready();
});

for (const method of ["GET", "PATCH"]) {
  test(`late ${method} success ignoring abort cannot alter a different session`, async (t) => {
    const { page, state, login, ready } = await screen(t);
    await login(); await ready();
    await page.evaluate((heldMethod) => {
      const original = window.fetch;
      window.fetch = (url, options) => (options?.method || "GET") === heldMethod
        ? new Promise((resolve) => {
          window.finishAdminRequest = (payload) => resolve(new Response(JSON.stringify(payload)));
          window.restoreAdminFetch = () => { window.fetch = original; };
        }) : original(url, options);
    }, method);
    await page.getByRole("button", { name: method === "GET" ? "Odśwież kolejkę" : "Rozpocznij analizę" }).click();
    await expect.poll(() => page.evaluate(() => Boolean(window.finishAdminRequest))).toBe(true);
    state.reports = [];
    await page.evaluate(() => { window.restoreAdminFetch(); adminTestAuth.emit("second@example.test"); });
    await expect(page.getByText("Kolejka jest pusta.")).toBeVisible();
    await page.evaluate(({ heldMethod, report }) => {
      window.finishAdminRequest(heldMethod === "GET" ? { reports: [report] } : { report });
    }, { heldMethod: method, report: entry("in_review") });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await expect(page.locator(".admin-report")).toHaveCount(0);
    await expect(page.getByText("Kolejka jest pusta.")).toBeVisible();
  });
}

for (const kind of ["login", "logout"]) {
  test(`late ${kind} error cannot overwrite a newer auth session`, async (t) => {
    const { page, state, login, ready } = await screen(t);
    if (kind === "logout") { await login(); await ready(); }
    await page.evaluate((value) => { adminTestAuth[`${value}Mode`] = "pending"; }, kind);
    if (kind === "login") await login();
    else await page.getByRole("button", { name: "Wyloguj się" }).click();
    await expect.poll(() => page.evaluate((value) => Boolean(adminTestAuth[value]), kind)).toBe(true);
    state.reports = [];
    await page.evaluate(() => adminTestAuth.emit("second@example.test"));
    await page.evaluate((value) => adminTestAuth[value].reject(new Error("late auth rejection")), kind);
    await expect(page.getByText("Kolejka jest pusta.")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Wyloguj się" })).toBeEnabled();
  });
}

test("malformed queue and mismatched PATCH confirmation never unlock stale data", async (t) => {
  const { page, state, login, ready } = await screen(t);
  await login(); await ready();
  state.handler = async (route) => { await route.fulfill({ json: { report: entry("resolved", "wrong-report") } }); return true; };
  await page.getByRole("button", { name: "Rozpocznij analizę" }).click();
  await expect(page.getByRole("alert")).toContainText("Serwer nie potwierdził");
  state.handler = async (route) => { await route.fulfill({ json: { reports: [null] } }); return true; };
  await page.getByRole("button", { name: "Odśwież kolejkę" }).click();
  await expect(page.getByRole("alert")).toContainText("Nie udało się odczytać");
  await expect(page.getByRole("button", { name: "Rozpocznij analizę" })).toBeDisabled();
});

test("GET and PATCH are serialized, so an older read cannot roll back a write", async (t) => {
  const { page, state, login, ready } = await screen(t);
  await login(); await ready();
  let finish;
  state.handler = async (route) => {
    await new Promise((resolve) => { finish = resolve; });
    await route.fulfill({ json: { reports: state.reports } });
    return true;
  };
  await page.getByRole("button", { name: "Odśwież kolejkę" }).click();
  await expect.poll(() => Boolean(finish)).toBe(true);
  await expect(page.getByRole("button", { name: "Rozpocznij analizę" })).toBeDisabled();
  assert.equal(state.requests.filter((r) => r.method === "PATCH").length, 0);
  state.handler = null;
  finish();
  await ready();
  await page.getByRole("button", { name: "Rozpocznij analizę" }).click();
  await expect(page.getByRole("button", { name: "Oznacz jako rozwiązane" })).toBeEnabled();
});

test("auth events after a settled logout failure restore the current session UI", async (t) => {
  const { page, login, ready } = await screen(t);
  await login(); await ready();
  await page.evaluate(() => { adminTestAuth.logoutMode = "failure"; });
  await page.getByRole("button", { name: "Wyloguj się" }).click();
  await expect(page.getByRole("button", { name: "Ponów wylogowanie" })).toBeEnabled();
  await page.evaluate(() => adminTestAuth.emit(null));
  await expect(page.getByRole("button", { name: "Zaloguj się", exact: true })).toBeEnabled();
  await page.evaluate(() => adminTestAuth.emit("second@example.test"));
  await ready();
  await expect(page.getByRole("button", { name: "Ponów wylogowanie" })).toHaveCount(0);
});
