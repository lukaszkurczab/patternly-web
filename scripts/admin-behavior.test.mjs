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
const privacyEntry = (status = "received", revision = 0) => ({ requestId: "pr_11111111-1111-4111-8111-111111111111", right: "access", channel: "account", status, outcome: status === "fulfilled" ? "fulfilled" : null, receivedAt: "2026-09-03T08:00:00Z", deadlineAt: "2026-10-03T08:00:00Z", deliveredAt: status === "fulfilled" ? "2026-09-04T08:00:00Z" : null, revision, narrative: "Proszę o kopię danych", reportSubmissionIds: [], reason: null, executionEvidence: null, responseAvailableUntil: null, subjectVerified: true });
const legalEntry = (overrides = {}) => ({ requestId: "lr_11111111-1111-4111-8111-111111111111", kind: "complaint", status: "received", receivedAt: "2026-09-03T08:00:00Z", responseDueAt: "2026-09-17T08:00:00Z", answeredAt: null, retentionUntil: null, response: null, legalHold: false, revision: 0, ...overrides });
const incidentEntry = (overrides = {}) => ({ incidentId: "si_11111111-1111-4111-8111-111111111111", classification: "triage", authorityDecision: "undecided", authorityDeliveryStatus: "not_started", subjectDecision: "undecided", subjectNotificationStatus: "not_started", awarenessAt: null, authorityDeadlineAt: null, closedAt: null, revision: 0, legalHold: false, nextAction: "acknowledge_awareness", ...overrides });
const incidentAssessment = (overrides = {}) => ({ details: "Poufny opis: recipient@example.com; wewnętrzna ocena.", detectedAt: "2026-09-03T07:00:00Z", occurredAt: "2026-09-03T06:30:00Z", categories: "Dane konta", dataSubjectCount: "2", recordCount: "4", specialData: false, confidentialityImpact: "Niski", integrityImpact: "Brak", availabilityImpact: "Brak", consequences: "Weryfikacja", likelihood: "Niskie", severity: "Niska", containment: "Dostęp ograniczony", remediation: "Dane zweryfikowane", prevention: "Monitoring", postmortem: "Przegląd zakończony", ...overrides });
const incidentDetails = (overrides = {}) => {
  const details = overrides.details ?? overrides.assessment?.details ?? "Poufny opis: recipient@example.com; wewnętrzna ocena.";
  return { ...incidentEntry(), title: "Roboczy tytuł incydentu", details, assessmentVersion: 1, createdAt: "2026-09-03T08:00:00Z", updatedAt: "2026-09-03T09:00:00Z", authorityExportVersion: null, authorityReason: null, subjectReason: null, authoritySubmissionReference: null, preparedRecipients: [], subjectNotifications: [], auditHistory: [{ event: "incident_created", actorPseudonym: "a".repeat(32), at: "2026-09-03T08:00:00Z", revision: null, assessmentVersion: null, snapshot: null }], ...overrides, details, assessment: incidentAssessment({ details, ...(overrides.assessment || {}) }) };
};
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
  const state = { reports: [entry()], privacy: [], legal: [], incidents: [], incidentDetails: {}, requests: [], handler: null };
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
    state.requests.push({ method: request.method(), path: new URL(request.url()).pathname, token: request.headers().authorization, body: request.postDataJSON() });
    if (state.handler && await state.handler(route)) return;
    const path = new URL(request.url()).pathname;
    if (path === "/v1/admin/privacy-requests" && request.method() === "GET") return route.fulfill({ json: { requests: state.privacy } });
    if (path.startsWith("/v1/admin/privacy-requests/") && request.method() === "GET") return route.fulfill({ json: { request: state.privacy[0] } });
    if (path.startsWith("/v1/admin/privacy-requests/") && request.method() === "PATCH") {
      const action = request.postDataJSON().action;
      const current = state.privacy[0];
      const updated = { ...current, revision: current.revision + 1, status: action === "start_review" ? "in_review" : action === "execute_export" ? "response_ready" : current.status, outcome: action === "execute_export" ? "fulfilled" : current.outcome };
      state.privacy = [updated];
      return route.fulfill({ json: { request: updated } });
    }
    if (path === "/v1/admin/legal-requests" && request.method() === "GET") return route.fulfill({ json: { requests: state.legal } });
    if (path.startsWith("/v1/admin/legal-requests/") && request.method() === "GET") return route.fulfill({ json: { request: { ...state.legal[0], email: "customer@example.test", narrative: "Proszę o odpowiedź w sprawie subskrypcji.", transactionId: "transaction-123" } } });
    if (path.startsWith("/v1/admin/legal-requests/") && request.method() === "PATCH") {
      const action = request.postDataJSON();
      const current = state.legal[0];
      const updated = {
        ...current,
        revision: current.revision + 1,
        status: action.action === "start_review" ? "in_review" : action.action === "answer" ? "answered" : action.action === "close" ? "closed" : current.status,
        response: action.action === "answer" ? action.response : current.response,
        answeredAt: action.action === "answer" ? "2026-09-04T08:00:00Z" : current.answeredAt,
        retentionUntil: action.action === "close" ? "2032-09-04T08:00:00Z" : current.retentionUntil,
        legalHold: action.action === "set_legal_hold" ? action.active : current.legalHold,
      };
      state.legal = [updated];
      return route.fulfill({ json: { request: updated } });
    }
    if (path === "/v1/admin/security-incidents" && request.method() === "GET") return route.fulfill({ json: { incidents: state.incidents } });
    if (path === "/v1/admin/security-incidents" && request.method() === "POST") {
      const created = incidentDetails({ incidentId: "si_22222222-2222-4222-8222-222222222222", title: request.postDataJSON().title, details: request.postDataJSON().details });
      state.incidentDetails[created.incidentId] = created;
      state.incidents = [incidentEntry({ incidentId: created.incidentId, nextAction: created.nextAction }), ...state.incidents];
      return route.fulfill({ status: 201, json: { incident: created } });
    }
    if (path.startsWith("/v1/admin/security-incidents/") && request.method() === "GET") {
      if (path.includes("/authority-exports/")) return route.fulfill({ json: { payload: JSON.stringify({ exact: true, version: 1 }), digest: "d".repeat(43), version: 1 } });
      const incidentId = decodeURIComponent(path.split("/").at(-1));
      const incident = state.incidentDetails[incidentId] || incidentDetails(state.incidents.find((item) => item.incidentId === incidentId));
      return route.fulfill({ json: { incident } });
    }
    if (path.startsWith("/v1/admin/security-incidents/") && request.method() === "PATCH") {
      const incidentId = decodeURIComponent(path.split("/").at(-1));
      const current = state.incidentDetails[incidentId] || incidentDetails(state.incidents.find((item) => item.incidentId === incidentId));
      const action = request.postDataJSON();
      let updated = { ...current, revision: current.revision + 1 };
      if (action.action === "acknowledge_awareness") updated = { ...updated, awarenessAt: "2026-09-07T08:00:00Z", authorityDeadlineAt: "2026-09-10T08:00:00Z", nextAction: "classify" };
      if (action.action === "classify") updated = { ...updated, classification: action.classification, nextAction: "decide_authority" };
      if (action.action === "decide_authority") updated = { ...updated, authorityDecision: action.decision, authorityReason: action.reason, nextAction: action.decision === "required" ? "prepare_authority_export" : "decide_subject" };
      if (action.action === "decide_subject") updated = { ...updated, subjectDecision: action.decision, subjectReason: action.reason, nextAction: action.decision === "required" ? "prepare_subject_notification" : "close" };
      if (action.action === "prepare_subject_notification") updated = { ...updated, subjectNotificationStatus: "prepared", preparedRecipients: action.recipients.map((_, index) => ({ recipientPseudonym: `recipient-${String(index).padStart(16, "0")}`, snapshotVersion: 1 })), nextAction: "send_subject_notification" };
      state.incidentDetails[incidentId] = updated;
      state.incidents = state.incidents.map((item) => item.incidentId === incidentId ? incidentEntry({ incidentId, classification: updated.classification, authorityDecision: updated.authorityDecision, authorityDeliveryStatus: updated.authorityDeliveryStatus, subjectDecision: updated.subjectDecision, subjectNotificationStatus: updated.subjectNotificationStatus, awarenessAt: updated.awarenessAt, authorityDeadlineAt: updated.authorityDeadlineAt, closedAt: updated.closedAt, revision: updated.revision, legalHold: updated.legalHold, nextAction: updated.nextAction }) : item);
      return route.fulfill({ json: { incident: updated } });
    }
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

test("privacy queue opens details and runs only the server-owned export executor", async (t) => {
  const { page, state, login, ready } = await screen(t);
  await login(); await ready();
  state.privacy = [privacyEntry()];
  await page.getByRole("button", { name: "Odśwież wnioski" }).click();
  await page.getByRole("button", { name: "Otwórz szczegóły" }).click();
  await expect(page.getByText("Proszę o kopię danych")).toBeVisible();
  await page.getByRole("button", { name: "Rozpocznij analizę" }).last().click();
  await page.getByRole("button", { name: "Wykonaj bezpieczny eksport" }).click();
  assert.equal(state.privacy[0].status, "response_ready");
  const actions = state.requests.filter((request) => request.method === "PATCH");
  assert.equal(actions.length, 2);
});

test("legal request queue performs the canonical consumer-case actions with revisions", async (t) => {
  const { page, state, login } = await screen(t);
  state.legal = [legalEntry({ kind: "complaint" })];
  await login();
  const queue = page.locator(".admin-legal-queue");
  await expect(queue.getByRole("heading", { name: "Reklamacja · Przyjęta", exact: true })).toBeVisible();
  await queue.getByRole("button", { name: "Otwórz sprawę" }).click();
  const detail = page.getByRole("region", { name: "Szczegóły sprawy konsumenckiej" });
  await expect(detail).toContainText("Proszę o odpowiedź w sprawie subskrypcji.");
  await detail.getByRole("button", { name: "Rozpocznij analizę" }).click();
  await detail.getByLabel("Odpowiedź dla klienta").fill("Odpowiedź dla klienta.");
  await detail.getByRole("button", { name: "Wyślij odpowiedź" }).click();
  await detail.getByRole("button", { name: "Zamknij sprawę" }).click();
  await expect(detail).toContainText("Zamknięta");
  await detail.getByLabel("Uzasadnienie blokady retencji").fill("Trwa postępowanie.");
  await detail.getByRole("button", { name: "Ustaw blokadę retencji" }).click();
  await expect(detail).toContainText("Aktywna");
  await detail.getByLabel("Uzasadnienie blokady retencji").fill("Postępowanie zakończone.");
  await detail.getByRole("button", { name: "Zwolnij blokadę retencji" }).click();
  await expect(detail).toContainText("Brak");
  const actions = state.requests.filter((item) => item.path.startsWith("/v1/admin/legal-requests/") && item.method === "PATCH");
  assert.deepEqual(actions.map((item) => item.body.action), ["start_review", "answer", "close", "set_legal_hold", "set_legal_hold"]);
  assert.deepEqual(actions.map((item) => item.body.expectedRevision), [0, 1, 2, 3, 4]);
  assert.equal(state.legal[0].status, "closed");
});

test("security incident list is minimal and details are lazy", async (t) => {
  const { page, state, login } = await screen(t);
  const incident = incidentEntry({ nextAction: "decide_authority" });
  state.incidents = [incident];
  const details = incidentDetails({
    ...incident,
    title: "Tytuł, którego nie pokazujemy na liście",
    details: "Sekretny opis recipient@example.com",
    assessment: incidentAssessment({ details: "Sekretny opis recipient@example.com", detectedAt: "2026-09-03T07:00:00.000Z", occurredAt: "2026-09-03T06:30:00.000Z", containedAt: "2026-09-03T06:45:00.000Z", specialData: true }),
    authorityReason: "Powód poufny",
    subjectReason: "Inny powód",
    authorityDecision: "required",
    authorityExportVersion: 1,
  });
  state.incidentDetails[incident.incidentId] = details;
  await login();
  const list = page.locator(".admin-security-queue .admin-report-list");
  await expect(list.getByRole("heading", { name: "Do oceny", exact: true })).toBeVisible();
  const listText = await list.innerText();
  assert.match(listText, /Podejmij decyzję dotyczącą UODO/u);
  assert.equal(listText.includes(incident.incidentId), false);
  assert.equal(listText.includes(details.title), false);
  assert.equal(listText.includes("Sekretny opis"), false);
  assert.equal(listText.includes("recipient@example.com"), false);
  assert.equal(state.requests.filter((request) => request.path === `/v1/admin/security-incidents/${incident.incidentId}`).length, 0);
  await list.getByRole("button", { name: "Otwórz szczegóły" }).click();
  const region = page.getByRole("region", { name: "Szczegóły incydentu" });
  await expect(region).toContainText("Sekretny opis recipient@example.com");
  await expect(region).toContainText("Kategorie danych");
  await expect(region).toContainText("Dane szczególnej kategorii");
  await expect(region).toContainText("Opanowano");
  await expect(region).toContainText("Utworzono");
  await region.locator("summary").filter({ hasText: "Historia" }).click();
  await expect(region).toContainText("Utworzono incydent");
  await region.locator("summary").filter({ hasText: "Eksport i ręczny dowód dla UODO" }).click();
  await page.evaluate(() => {
    window.securityExportTest = { created: 0, revoked: [], download: null, mime: null };
    URL.createObjectURL = (blob) => { window.securityExportTest.created += 1; window.securityExportTest.mime = blob.type; return "blob:security-export"; };
    URL.revokeObjectURL = (value) => { window.securityExportTest.revoked.push(value); };
    HTMLAnchorElement.prototype.click = function click() { window.securityExportTest.download = { href: this.href, name: this.download }; };
  });
  await region.getByRole("button", { name: /Pobierz eksport UODO/u }).click();
  await expect(region.getByText("Pobrano dokładny eksport UODO, wersja 1.", { exact: true })).toBeVisible();
  const exportRuntime = await page.evaluate(() => window.securityExportTest);
  assert.equal(exportRuntime.created, 1);
  assert.equal(exportRuntime.mime, "application/json;charset=utf-8");
  assert.deepEqual(exportRuntime.revoked, ["blob:security-export"]);
  assert.match(exportRuntime.download.name, /authority-export-v1\.json/u);
  const download = state.requests.find((request) => request.path === `/v1/admin/security-incidents/${incident.incidentId}/authority-exports/1`);
  assert.ok(download);
  assert.equal(download.token, "Bearer token:admin@example.test");
  assert.equal(download.path.includes("token"), false);
  assert.equal(state.requests.filter((request) => request.path === `/v1/admin/security-incidents/${incident.incidentId}`).length, 1);
  state.handler = async (route) => {
    if (route.request().url().includes("/authority-exports/") && route.request().method() === "GET") {
      await route.fulfill({ json: { payload: "", digest: "d".repeat(42), version: 1, extra: true } });
      return true;
    }
    return false;
  };
  await region.getByRole("button", { name: /Pobierz eksport UODO/u }).click();
  await expect(region.getByRole("status")).toContainText("Serwer nie potwierdził dokładnej wersji eksportu");
  assert.equal((await page.evaluate(() => window.securityExportTest)).created, 1);
});

test("security incident creation sends the complete current assessment contract", async (t) => {
  const { page, state, login } = await screen(t);
  await login();
  const panel = page.locator(".admin-security-queue");
  await panel.locator("summary").filter({ hasText: "Dodaj incydent" }).click();
  await panel.getByLabel("Tytuł roboczy").fill("Nowy incydent");
  const fields = {
    "Opis i ocena": "Pierwsza ocena incydentu.",
    "Wykryto (data i czas)": "2026-09-07T10:00",
    "Opanowano (data i czas, opcjonalnie)": "2026-09-07T12:00",
    "Kategorie danych": "Dane konta",
    "Szacowana liczba osób": "1",
    "Szacowana liczba rekordów": "1",
    "Wpływ na poufność": "Niski",
    "Wpływ na integralność": "Brak",
    "Wpływ na dostępność": "Brak",
    "Możliwe konsekwencje": "Konieczność weryfikacji.",
    "Prawdopodobieństwo": "Niskie",
    "Dotkliwość": "Niska",
    "Działania ograniczające": "Dostęp ograniczony.",
    "Działania naprawcze": "Dane zweryfikowane.",
    "Działania zapobiegawcze": "Dodano monitoring.",
    "Podsumowanie po incydencie": "Przegląd zakończony.",
  };
  for (const [label, value] of Object.entries(fields)) await panel.getByLabel(label, { exact: true }).fill(value);
  await panel.getByRole("button", { name: "Utwórz incydent" }).click();
  await expect(panel.getByText("Incydent zapisano.", { exact: false })).toBeVisible();
  const post = state.requests.find((request) => request.method === "POST" && request.path === "/v1/admin/security-incidents");
  assert.equal(post.body.title, "Nowy incydent");
  assert.equal(post.body.details, fields["Opis i ocena"]);
  assert.match(post.body.detectedAt, /T/u);
  assert.match(post.body.containedAt, /T/u);
  assert.equal(post.body.specialData, false);
  for (const key of ["categories", "dataSubjectCount", "recordCount", "confidentialityImpact", "integrityImpact", "availabilityImpact", "consequences", "likelihood", "severity", "containment", "remediation", "prevention", "postmortem"]) assert.ok(post.body[key]);
  assert.equal(Object.hasOwn(post.body, "occurredAt"), false);
  const listText = await panel.locator(".admin-report-list").innerText();
  assert.equal(listText.includes("Nowy incydent"), false);
  assert.equal(listText.includes(fields["Opis i ocena"]), false);
  await expect(panel.getByLabel("Tytuł roboczy")).toHaveValue("");
  await expect(panel.getByLabel("Opis i ocena")).toHaveValue("");
  assert.equal(Object.hasOwn(post.body, "clientRequestId"), false);
});

test("uncertain security incident creation blocks retry until a refresh", async (t) => {
  const { page, state, login } = await screen(t);
  await login();
  const panel = page.locator(".admin-security-queue");
  await panel.locator("summary").filter({ hasText: "Dodaj incydent" }).click();
  await panel.getByLabel("Tytuł roboczy").fill("Niepewny zapis");
  const fields = {
    "Opis i ocena": "Ocena zapisu oczekującego na potwierdzenie.",
    "Wykryto (data i czas)": "2026-09-07T10:00",
    "Kategorie danych": "Dane konta",
    "Szacowana liczba osób": "1",
    "Szacowana liczba rekordów": "1",
    "Wpływ na poufność": "Niski",
    "Wpływ na integralność": "Brak",
    "Wpływ na dostępność": "Brak",
    "Możliwe konsekwencje": "Weryfikacja.",
    "Prawdopodobieństwo": "Niskie",
    "Dotkliwość": "Niska",
    "Działania ograniczające": "Dostęp ograniczony.",
    "Działania naprawcze": "Dane zweryfikowane.",
    "Działania zapobiegawcze": "Monitoring.",
    "Podsumowanie po incydencie": "Przegląd.",
  };
  for (const [label, value] of Object.entries(fields)) await panel.getByLabel(label, { exact: true }).fill(value);
  state.handler = async (route) => {
    if (route.request().url().endsWith("/v1/admin/security-incidents") && route.request().method() === "POST") {
      await route.fulfill({ status: 503, json: { error: { code: "security_incident_email_unavailable" } } });
      return true;
    }
    return false;
  };
  const createButton = panel.getByRole("button", { name: "Utwórz incydent" });
  await createButton.click();
  await expect(panel.getByRole("alert")).toContainText(/odśwież listę/u);
  await expect(createButton).toBeDisabled();
  assert.equal(state.requests.filter((request) => request.method === "POST" && request.path === "/v1/admin/security-incidents").length, 1);
  state.handler = null;
  await panel.getByRole("button", { name: "Odśwież incydenty" }).click();
  await expect(createButton).toBeEnabled();
});

test("security incident writes send expectedRevision and a 409 locks until refresh", async (t) => {
  const { page, state, login } = await screen(t);
  const incident = incidentEntry();
  state.incidents = [incident];
  state.incidentDetails[incident.incidentId] = incidentDetails(incident);
  await login();
  const panel = page.locator(".admin-security-queue");
  await panel.getByRole("button", { name: "Otwórz szczegóły" }).click();
  await panel.getByRole("button", { name: "Potwierdź świadomość 72 godzin" }).click();
  await expect(panel.getByRole("button", { name: "Świadomość potwierdzona" })).toBeDisabled();
  const awareness = state.requests.filter((request) => request.method === "PATCH" && request.path.includes("security-incidents")).at(-1);
  assert.equal(awareness.body.expectedRevision, 0);
  state.handler = async (route) => { if (route.request().url().includes("/v1/admin/security-incidents/") && route.request().method() === "PATCH") { await route.fulfill({ status: 409, json: { error: { code: "security_incident_revision_conflict" } } }); return true; } return false; };
  const classification = panel.locator("form").filter({ hasText: "Klasyfikacja" }).first();
  await classification.getByRole("combobox").selectOption("breach_confirmed");
  await classification.getByRole("textbox").fill("Ocena po potwierdzeniu świadomości");
  await classification.getByRole("button", { name: "Zapisz klasyfikację" }).click();
  await expect(panel.getByRole("alert")).toContainText("Odśwież listę");
  await expect(classification.getByRole("button", { name: "Zapisz klasyfikację" })).toBeDisabled();
  state.handler = null;
  await panel.getByRole("button", { name: "Odśwież incydenty" }).click();
  await expect(panel.getByRole("heading", { name: "Do oceny", exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Otwórz szczegóły" }).click();
  await expect(panel.locator("form").filter({ hasText: "Klasyfikacja" }).first().getByRole("button", { name: "Zapisz klasyfikację" })).toBeEnabled();
});

test("security incident copy explains manual UODO handling and unknown SMTP is explicit", async (t) => {
  const { page, state, login } = await screen(t);
  const incident = incidentEntry({ classification: "breach_confirmed", awarenessAt: "2026-09-07T08:00:00Z", authorityDeadlineAt: "2026-09-10T08:00:00Z", authorityDecision: "not_required", subjectDecision: "required", subjectNotificationStatus: "prepared" });
  state.incidents = [incident];
  state.incidentDetails[incident.incidentId] = incidentDetails({ ...incident, preparedRecipients: [{ recipientPseudonym: "recipient-0000000000000000", snapshotVersion: 1 }], subjectNotifications: [{ recipientPseudonym: "recipient-1111111111111111", snapshotVersion: 0 + 1, status: "superseded", deliveryId: "33333333-3333-4333-8333-333333333333" }] });
  await login();
  const panel = page.locator(".admin-security-queue");
  await panel.getByRole("button", { name: "Otwórz szczegóły" }).click();
  await panel.locator("summary").filter({ hasText: "Eksport i ręczny dowód dla UODO" }).click();
  await expect(panel.getByText("System nie wysyła zgłoszeń do UODO. Zapisuje wyłącznie ręczny dowód.", { exact: true })).toBeVisible();
  await panel.locator("summary").filter({ hasText: "Zawiadomienie osób" }).click();
  await expect(panel.getByText("Te próby dotyczą wcześniejszej wersji zawiadomienia i są nieaktywne.", { exact: true })).toBeVisible();
  state.handler = async (route) => { if (route.request().url().includes("/v1/admin/security-incidents/") && route.request().method() === "PATCH") { await route.fulfill({ status: 503, json: { error: { code: "security_incident_email_unavailable" } } }); return true; } return false; };
  await panel.getByRole("button", { name: "Wyślij zawiadomienie — adresat 1" }).click();
  await expect(panel.getByRole("alert")).toContainText("SMTP");
  await expect(panel.getByRole("button", { name: "Wyślij zawiadomienie — adresat 1" })).toBeDisabled();
});

test("late incident details cannot restore sensitive UI after logout", async (t) => {
  const { page, state, login } = await screen(t);
  const incident = incidentEntry();
  state.incidents = [incident];
  state.incidentDetails[incident.incidentId] = incidentDetails({ ...incident, details: "Nie powinno wrócić po wylogowaniu" });
  await login();
  let finish;
  state.handler = async (route) => { if (route.request().url().includes(`/v1/admin/security-incidents/${incident.incidentId}`) && route.request().method() === "GET") { await new Promise((resolve) => { finish = resolve; }); await route.fulfill({ json: { incident: state.incidentDetails[incident.incidentId] } }).catch(() => {}); return true; } return false; };
  await page.locator(".admin-security-queue").getByRole("button", { name: "Otwórz szczegóły" }).click();
  await expect.poll(() => Boolean(finish)).toBe(true);
  state.handler = null;
  await page.getByRole("button", { name: "Wyloguj się" }).click();
  await expect(page.getByLabel("Adres e-mail")).toBeVisible();
  finish();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(page.locator(".security-incident-detail")).toHaveCount(0);
});

test("public privacy page submits non-enumerating intake and consumes a fragment token", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  const bodies = [];
  await page.route(`${api}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    bodies.push(route.request().postDataJSON());
    if (path.endsWith("/session")) return route.fulfill({ json: { sessionToken: "s".repeat(32) } });
    if (path.endsWith("/response")) return route.fulfill({ json: { request: privacyEntry("fulfilled", 4), response: "Gotowa odpowiedź", responseAvailableUntil: "2026-10-04T08:00:00Z", complaintInformationIncluded: true } });
    return route.fulfill({ status: 202, json: { status: "accepted" } });
  });
  await page.goto(`${origin}/privacy-request`);
  await page.getByLabel("Adres e-mail").fill("guest@example.com");
  await page.getByRole("button", { name: "Wyślij wniosek" }).click();
  await expect(page.getByText(/Jeśli adres może zostać powiązany/u)).toBeVisible();
  await page.goto(`${origin}/privacy-request/pr_11111111-1111-4111-8111-111111111111#token=${"t".repeat(32)}`);
  await expect(page.getByText("Gotowa odpowiedź")).toBeVisible();
  assert.deepEqual(bodies.at(-2), { token: "t".repeat(32) });
  assert.deepEqual(bodies.at(-1), { sessionToken: "s".repeat(32) });
  assert.equal(page.url().includes("#token="), false);
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
  const requestsBeforeRefresh = state.requests.length;
  await page.getByRole("button", { name: "Odśwież kolejkę" }).click();
  await page.clock.runFor(12001);
  await expect(page.getByRole("alert")).toContainText("Przekroczono czas");
  await expect(page.getByRole("button", { name: "Rozpocznij analizę" })).toBeDisabled();
  await page.evaluate(() => { adminTestAuth.tokens.forEach((finish) => finish()); adminTestAuth.tokenMode = "success"; });
  assert.equal(state.requests.length, requestsBeforeRefresh);
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
