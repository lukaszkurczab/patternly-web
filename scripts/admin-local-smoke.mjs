import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const credentials = JSON.parse(await readFile(resolve(root, "../patternly-backend/.local/admin/credentials.json"), "utf8"));
const browser = await chromium.launch({ headless: true,
  ...(process.env.ADMIN_BROWSER_EXECUTABLE ? { executablePath: process.env.ADMIN_BROWSER_EXECUTABLE } : {}),
});
try {
  const context = await browser.newContext();
  const externalRequests = [];
  const requests = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" && ["25173", "28080", "29199"].includes(url.port)) return route.continue();
    externalRequests.push(url.origin);
    await route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (["28080", "29199"].includes(url.port)) requests.push({ method: response.request().method(), path: url.pathname, port: url.port, status: response.status() });
  });
  await page.goto("http://127.0.0.1:25173/admin");
  await page.getByLabel("Adres e-mail").fill(credentials.email);
  await page.getByLabel("Hasło").fill(credentials.password);
  const queueResponse = page.waitForResponse((response) => response.url() === "http://127.0.0.1:28080/v1/admin/content-reports" && response.request().method() === "GET");
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  const response = await queueResponse;
  assert.equal(response.status(), 200);
  const reports = (await response.json()).reports;
  assert.ok(Array.isArray(reports));
  await page.getByRole("button", { name: /^Zgłoszenia/ }).click();
  await expect(page.getByText(reports.length ? `Odczytano ${reports.length} zgłoszeń.` : "Kolejka jest pusta.")).toBeVisible();
  await page.getByRole("button", { name: "Przegląd", exact: true }).click();
  await expect(page.locator(".admin-table tbody tr")).toHaveCount(8);
  if (process.env.ADMIN_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.ADMIN_SCREENSHOT_DIR, "admin-live-overview.png"), fullPage: true });
  await page.getByRole("button", { name: "Baza pytań", exact: true }).click();
  await page.getByLabel("Ścieżka", { exact: true }).selectOption("aws-certified-solutions-architect-associate");
  await expect(page.locator(".admin-question > summary").first()).toBeVisible();
  await page.locator(".admin-question > summary").first().click();
  await expect(page.locator('[data-correct="true"]').first()).toBeVisible();
  if (process.env.ADMIN_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.ADMIN_SCREENSHOT_DIR, "admin-live-questions.png"), fullPage: true });
  await page.getByRole("button", { name: "Użycie aplikacji", exact: true }).click();
  await expect(page.getByText("Konta użytkowników", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Wyloguj się" }).click();
  await expect(page.getByText("Wylogowano.")).toBeVisible();
  assert.deepEqual(externalRequests, [], "Browser must not contact cloud services");
  assert.ok(requests.some((item) => item.port === "29199" && item.path.endsWith("accounts:signInWithPassword") && item.status === 200));
  console.log(JSON.stringify({ result: "PASS", reportsRead: reports.length, externalRequests: externalRequests.length, requests }));
} finally {
  await browser.close();
}
