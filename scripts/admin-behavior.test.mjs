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
const inspectionQuestions = [
  {
    id: "choice-inspection",
    prompt: "Which choice preserves the ordering contract?",
    interaction: {
      type: "choice", selectionMode: "single",
      options: [
        { id: "stable", text: "Keep first appearance order." },
        { id: "sorted", text: "Sort the distinct values." },
        { id: "unchanged", text: "Keep every input occurrence." },
      ],
      acceptedOptionIds: ["stable"],
    },
    feedback: {
      reason: "The output contract preserves first appearance order while removing repeats.",
      details: { blocks: [{ type: "paragraph", text: "The accepted choice follows the declared postcondition." }] },
      wrongOptionExplanationsByOptionId: {
        sorted: "Sorting changes the required first appearance order.",
        unchanged: "Keeping every occurrence does not remove duplicates.",
      },
    },
  },
  {
    id: "ordering-id-inspection",
    prompt: "What is the canonical evidence sequence?",
    interaction: {
      type: "ordering",
      elements: [
        { id: "compare", text: "Compare the result with the postcondition." },
        { id: "state", text: "State the required contract." },
        { id: "counterexample", text: "Construct a counterexample." },
      ],
      canonicalOrder: ["state", "counterexample", "compare"],
      scoringMethod: "adjacent_relations",
    },
    feedback: {
      reason: "The contract is stated before a counterexample tests it.",
      details: { blocks: [{ type: "ordered_list", items: ["State the contract.", "Test the boundary."] }] },
      richInteraction: {
        wrongElementExplanationsByElementId: {
          state: "Without the contract, later evidence has no reference point.",
          counterexample: "A counterexample belongs after the contract is explicit.",
          compare: "Comparison is meaningful only after the boundary is tested.",
        },
        brokenRelationExplanationsByRelationId: {
          "state->counterexample": "Testing before stating the contract loses the required boundary.",
        },
      },
    },
  },
  {
    id: "ordering-element-id-inspection",
    prompt: "How should a rollout sequence be ordered?",
    interaction: {
      type: "ordering",
      elements: [
        { elementId: "retire", text: "Retire the old path after evidence." },
        { elementId: "measure", text: "Measure the current contract." },
        { elementId: "stage", text: "Stage the new representation." },
      ],
      canonicalOrder: ["measure", "stage", "retire"],
      scoringMethod: "adjacent_relations",
    },
    feedback: {
      reason: "A rollout starts with evidence and retires the old path last.",
      details: { blocks: [{ type: "paragraph", text: "Mixed versions need an observable migration path." }] },
      richInteraction: {
        wrongElementExplanationsByElementId: {
          retire: "Retiring before migration evidence can strand existing consumers.",
        },
      },
    },
  },
  {
    id: "ordering-unavailable-order-inspection",
    prompt: "Which rollout elements are declared?",
    interaction: {
      type: "ordering",
      elements: [
        { elementId: "measure", text: "Measure the current contract." },
        { elementId: "stage", text: "Stage the new representation." },
      ],
      scoringMethod: "adjacent_relations",
    },
    feedback: {
      reason: "The published question does not declare its canonical order.",
      richInteraction: {
        wrongElementExplanationsByElementId: {
          stage: "Staging without evidence leaves the rollout ungrounded.",
        },
      },
    },
  },
  {
    id: "complexity-inspection",
    prompt: "What is the complexity of the distinct-value scan?",
    interaction: {
      type: "complexity",
      checkedDimensions: ["time", "auxiliary_space", "output_space"],
      availableValuesByDimension: {
        time: ["O(1)", "O(n)", "O(n log n)"],
        auxiliary_space: ["O(1)", "O(k)", "O(n)"],
        output_space: ["O(1)", "O(k)", "O(n)"],
      },
      acceptedValuesByDimension: { time: ["O(n)"], auxiliary_space: ["O(k)"], output_space: ["O(k)"] },
      normalizedAliasesByDimension: { time: { linear: "O(n)" }, auxiliary_space: { distinct: "O(k)" }, output_space: { distinct: "O(k)" } },
      maxPoints: 3,
    },
    feedback: {
      reason: "Each occurrence is inspected once and k distinct values are retained.",
      details: { blocks: [{ type: "bullet_list", items: ["The scan is linear.", "Retained state scales with k."] }] },
    },
  },
  {
    id: "decision-matrix-inspection",
    prompt: "Which design choices preserve the interaction contract?",
    interaction: {
      type: "decision_matrix",
      dimensions: [
        {
          dimensionId: "semantics", label: "Control semantics",
          values: [
            { valueId: "native", text: "Use native semantics." },
            { valueId: "visual", text: "Style a generic element." },
          ],
          acceptedValueIds: ["native"],
        },
        {
          dimensionId: "state", label: "Dynamic state",
          values: [
            { valueId: "announced", text: "Announce meaningful state changes." },
            { valueId: "color", text: "Use color as the only signal." },
          ],
          acceptedValueIds: ["announced"],
        },
      ],
      scoringMethod: "dimension_exact",
    },
    feedback: {
      reason: "The interface keeps semantics and state changes observable.",
      details: { blocks: [{ type: "callout", kind: "decision_rule", title: "Decision rule", text: "Keep each requirement at the owner that can enforce it." }] },
      richInteraction: {
        wrongValueExplanationsByDimensionIdAndValueId: {
          "semantics|visual": "Visual styling does not provide the promised control contract.",
          "state|color": "Color alone does not expose dynamic state to every user.",
        },
        omittedCorrectValueExplanationsByDimensionId: {
          semantics: "Without native semantics, the control loses its accessible name and behavior.",
        },
      },
    },
  },
];

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
  page.on("pageerror", (error) => t.diagnostic(error.message));
  const state = { reports: [entry()], requests: [], handler: null };
  await page.route(`${api}/**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (new URL(request.url()).pathname === "/v1/admin/overview") return route.fulfill({ json: {
      content: { publishedTracks: 1, questionCount: 2, tracks: [{ trackId: "test-track", version: "v1", questionCount: 2 }] },
      reports: { open: 1 }, questionBank: { status: "available" }, usage: { accounts: 7, progressRecords: 12, trainingAttempts: 9, reviewQueueEntries: 3 },
    } });
    if (new URL(request.url()).pathname === "/v1/admin/questions") {
      const q = new URL(request.url()).searchParams.get("q");
      const questions = q === "missing" ? [] : q === "rich" ? inspectionQuestions : [{ id: "question-1", prompt: "Which choice preserves ordering?", interaction: { type: "choice", options: [{ id: "a", text: "Stable sort" }], acceptedOptionIds: ["a"] }, feedback: { reason: "Equal elements retain their order." } }];
      return route.fulfill({ json: { total: questions.length, page: 1, pageSize: 25,
        questions,
      } });
    }
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
  const ready = async () => {
    await page.getByRole("button", { name: /^Zgłoszenia/ }).click();
    await expect(page.getByRole("button", { name: "Rozpocznij analizę" })).toBeEnabled();
  };
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
      await page.getByRole("button", { name: /^Zgłoszenia/ }).click();
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
    await page.getByRole("button", { name: /^Zgłoszenia/ }).click();
    await expect(page.getByText("Kolejka jest pusta.")).toBeVisible();
    await page.evaluate(({ heldMethod, report }) => {
      window.finishAdminRequest(heldMethod === "GET" ? { reports: [report] } : { report });
    }, { heldMethod: method, report: entry("in_review") });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await expect(page.locator(".admin-report")).toHaveCount(0);
    await page.getByRole("button", { name: /^Zgłoszenia/ }).click();
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
    await page.getByRole("button", { name: /^Zgłoszenia/ }).click();
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


test("administrator can inspect statistics, question content, search and usage", async (t) => {
  const { page, login } = await screen(t);
  await login();
  await expect(page.getByRole("heading", { name: "Przegląd", exact: true })).toBeVisible();
  await expect(page.getByText("Pytania w bazie", { exact: true })).toBeVisible();
  if (process.env.ADMIN_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.ADMIN_SCREENSHOT_DIR, "admin-overview.png"), fullPage: true });
  await page.getByRole("button", { name: "Test Track", exact: true }).click();
  await expect(page.getByLabel("Ścieżka", { exact: true })).toHaveValue("test-track");
  await page.locator(".admin-question > summary").click();
  await expect(page.getByText("Equal elements retain their order.", { exact: true })).toBeVisible();
  await expect(page.locator('[data-correct="true"]')).toContainText("Stable sort");
  if (process.env.ADMIN_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.ADMIN_SCREENSHOT_DIR, "admin-questions.png"), fullPage: true });
  await page.getByLabel("Szukaj pytania").fill("missing");
  await page.getByRole("button", { name: "Szukaj", exact: true }).click();
  await expect(page.getByText("Brak pytań spełniających kryteria.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Użycie aplikacji", exact: true }).click();
  await expect(page.getByText("Konta użytkowników", { exact: true })).toBeVisible();
  await expect(page.getByText("Nie obejmują nauki wyłącznie offline", { exact: false })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  if (process.env.ADMIN_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.ADMIN_SCREENSHOT_DIR, "admin-mobile.png"), fullPage: true });
});

test("question inspection renders canonical interaction shapes and authored wrong-answer feedback", async (t) => {
  const { page, login } = await screen(t);
  await login();
  await page.getByRole("button", { name: "Baza pytań", exact: true }).click();
  await page.getByLabel("Szukaj pytania").fill("rich");
  await page.getByRole("button", { name: "Szukaj", exact: true }).click();
  await expect(page.locator('.admin-question[data-interaction-type="choice"] > summary')).toHaveCount(1);
  await expect(page.locator('.admin-question[data-interaction-type="ordering"] > summary')).toHaveCount(3);
  await expect(page.locator('.admin-question[data-interaction-type="complexity"] > summary')).toHaveCount(1);
  await expect(page.locator('.admin-question[data-interaction-type="decision_matrix"] > summary')).toHaveCount(1);

  const choice = page.locator('.admin-question[data-interaction-type="choice"]');
  await choice.locator("summary").first().click();
  await expect(choice.locator('[data-answer-id="stable"][data-correct="true"]')).toContainText("Poprawna odpowiedź");
  await expect(choice.locator('[data-feedback-type="wrong-option"]')).toHaveCount(2);
  await expect(choice.locator('[data-feedback-type="wrong-option"]').nth(0)).toContainText("Sorting changes");
  await expect(choice.locator('[data-feedback-type="wrong-option"]').nth(1)).toContainText("every occurrence");

  const orderingById = page.locator('.admin-question[data-interaction-type="ordering"]').nth(0);
  await orderingById.locator("summary").first().click();
  assert.deepEqual(await orderingById.locator(".admin-ordering-list .admin-answer-text").allTextContents(), [
    "State the required contract.", "Construct a counterexample.", "Compare the result with the postcondition.",
  ]);
  await expect(orderingById.locator('[data-feedback-type="wrong-element"]')).toHaveCount(3);
  await expect(orderingById.locator('[data-feedback-type="broken-relation"]')).toContainText("Testing before stating");

  const orderingByElementId = page.locator('.admin-question[data-interaction-type="ordering"]').nth(1);
  await orderingByElementId.locator("summary").first().click();
  await expect(orderingByElementId.locator('[data-element-id="measure"]')).toContainText("Measure the current contract");
  await expect(orderingByElementId.locator('[data-feedback-type="wrong-element"]')).toContainText("Retiring before migration");

  const orderingWithoutCanonicalOrder = page.locator('.admin-question[data-interaction-type="ordering"]').nth(2);
  await orderingWithoutCanonicalOrder.locator("summary").first().click();
  await expect(orderingWithoutCanonicalOrder.locator("h3").first()).toHaveText("Zadeklarowane elementy");
  await expect(orderingWithoutCanonicalOrder.locator('[data-correct="unknown"]')).toHaveCount(2);
  await expect(orderingWithoutCanonicalOrder.locator('[data-feedback-type="wrong-element"]')).toContainText("Staging without evidence");

  const complexity = page.locator('.admin-question[data-interaction-type="complexity"]');
  await complexity.locator("summary").first().click();
  await expect(complexity.getByRole("rowheader", { name: "Czas", exact: true })).toBeVisible();
  await expect(complexity.locator('tr[data-dimension-id="time"] td:nth-child(2) li[data-value-id="O(n)"][data-correct="true"]')).toHaveCount(1);
  await expect(complexity.getByText("Aliasy normalizacji", { exact: true })).toBeVisible();

  const matrix = page.locator('.admin-question[data-interaction-type="decision_matrix"]');
  await matrix.locator("summary").first().click();
  await expect(matrix.locator('tr[data-dimension-id="semantics"][data-value-id="native"][data-correct="true"]')).toContainText("Poprawna wartość");
  await expect(matrix.locator('[data-feedback-type="wrong-value"]').first()).toContainText("Visual styling");
  await expect(matrix.locator('[data-feedback-type="omitted-value"]')).toContainText("accessible name");
  await expect(matrix.locator("[data-json-diagnostic='true']")).toHaveCount(1);

  const questionPanel = page.locator(".admin-panel");
  await page.evaluate(() => document.activeElement?.blur());
  await page.addStyleTag({ content: ".skip-link, .site-header { visibility: hidden !important; }" });
  if (process.env.ADMIN_SCREENSHOT_DIR) await questionPanel.screenshot({ path: resolve(process.env.ADMIN_SCREENSHOT_DIR, "admin-rich-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const complexityTableRegion = complexity.getByRole("region", { name: "Tabela złożoności obliczeniowej" });
  await complexityTableRegion.focus();
  assert.equal(await complexityTableRegion.evaluate((element) => document.activeElement === element), true);
  await page.evaluate(() => document.activeElement?.blur());
  if (process.env.ADMIN_SCREENSHOT_DIR) await questionPanel.screenshot({ path: resolve(process.env.ADMIN_SCREENSHOT_DIR, "admin-rich-mobile.png") });
});

test("overview clears previously loaded statistics when access is revoked", async (t) => {
  const { page, login } = await screen(t);
  await login();
  await expect(page.getByRole("button", { name: "Test Track", exact: true })).toBeVisible();
  await page.route(`${api}/v1/admin/overview`, (route) => route.fulfill({ status: 403, json: {} }));
  await page.getByRole("button", { name: "Odśwież dane", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Brak dostępu administratora");
  await expect(page.locator(".admin-metric")).toHaveCount(0);
});

test("question read failure is explicit and retry restores results", async (t) => {
  const { page, login } = await screen(t);
  await login();
  await page.route(`${api}/v1/admin/questions?**`, (route) => route.fulfill({ status: 503, json: { error: { code: "question_inspection_unavailable" } } }));
  await page.getByRole("button", { name: "Baza pytań", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Baza pytań nie jest podłączona");
  await page.unroute(`${api}/v1/admin/questions?**`);
  await page.getByRole("button", { name: "Odśwież dane", exact: true }).click();
  await expect(page.locator(".admin-question > summary")).toContainText("Which choice preserves ordering?");
});
