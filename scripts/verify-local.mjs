import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { ADMIN_UNAVAILABLE_MESSAGE, getAdminConfigurationError } from "../src/adminConfig.js";
import { buildAdminReportView } from "../src/adminReportView.js";
import { ADMIN_ROUTE_PATH, ADMIN_ROUTE_REDIRECT_PATHS, isCanonicalAdminPath } from "../src/adminRoute.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.PATTERNLY_LOCAL_URL || "http://localhost:5173";
const robotsMetaPattern = /<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["']noindex,nofollow["'])[^>]*>/iu;
const moduleScriptPattern = /<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/iu;
const automaticJsxRuntimePattern = /react(?:-|_)jsx(?:-|_)(?:dev(?:-|_))?runtime/u;

const validConfig = {
  apiKey: "local-api-key",
  authDomain: "local.example",
  projectId: "local-project",
  appId: "local-app-id",
};

assert.equal(getAdminConfigurationError(null, ""), ADMIN_UNAVAILABLE_MESSAGE);
assert.equal(getAdminConfigurationError(validConfig, "http://localhost:8080"), ADMIN_UNAVAILABLE_MESSAGE);
assert.equal(getAdminConfigurationError(validConfig, "https://user:password@api.example.test"), ADMIN_UNAVAILABLE_MESSAGE);
assert.equal(getAdminConfigurationError(validConfig, "https://user@api.example.test"), ADMIN_UNAVAILABLE_MESSAGE);
assert.equal(getAdminConfigurationError(validConfig, "https://api.example.test/?token=local"), ADMIN_UNAVAILABLE_MESSAGE);
assert.equal(getAdminConfigurationError(validConfig, "https://api.example.test/#admin"), ADMIN_UNAVAILABLE_MESSAGE);
assert.equal(getAdminConfigurationError(validConfig, "https://api.example.test/?"), ADMIN_UNAVAILABLE_MESSAGE);
assert.equal(getAdminConfigurationError(validConfig, "https://api.example.test/#"), ADMIN_UNAVAILABLE_MESSAGE);
assert.equal(getAdminConfigurationError(validConfig, "https://api.example.test"), "");

assert.deepEqual(buildAdminReportView({
  itemId: "item-42",
  trackId: "algorithms",
  reason: "incorrect-answer",
  status: "open",
  description: "Needs review.",
  createdAt: "2026-08-25T10:00:00Z",
  context: { modeRoute: "/practice", releasePackageId: "release-9", trackNode: "arrays" },
}), {
  heading: "incorrect-answer · open",
  description: "Needs review.",
  fields: [
    ["Element", "item-42"],
    ["Ścieżka", "algorithms"],
    ["Wydanie", "release-9"],
    ["Powierzchnia", "/practice"],
    ["Węzeł", "arrays"],
    ["Utworzono", "2026-08-25T10:00:00Z"],
  ],
});
assert.deepEqual(buildAdminReportView({ context: { trackNode: "" } }), {
  heading: "niedostępny · niedostępny",
  description: "niedostępny",
  fields: [
    ["Element", "niedostępny"],
    ["Ścieżka", "niedostępny"],
    ["Wydanie", "niedostępny"],
    ["Powierzchnia", "niedostępny"],
    ["Węzeł", "niedostępny"],
    ["Utworzono", "niedostępny"],
  ],
});

const sourceHtml = await readFile(resolve(root, "index.html"), "utf8");
const sourceAdminHtml = await readFile(resolve(root, "admin.html"), "utf8");
const sourceApp = await readFile(resolve(root, "src/App.jsx"), "utf8");
const sourcePublicPage = await readFile(resolve(root, "src/pages/PublicPage.jsx"), "utf8");
const sourceAdminPage = await readFile(resolve(root, "src/pages/AdminPage.jsx"), "utf8");
const sourceQuestions = await readFile(resolve(root, "src/components/InteractiveQuestion.jsx"), "utf8");
const sourceDecisionField = await readFile(resolve(root, "src/components/DecisionField.jsx"), "utf8");
const sourceStyles = await readFile(resolve(root, "styles.css"), "utf8");
const sourceReveal = await readFile(resolve(root, "src/hooks/useReveal.jsx"), "utf8");
assert.match(sourceHtml, /<div id="root"><\/div>/u);
assert.match(sourceHtml, /src="\/src\/main\.jsx"/u);
assert.doesNotMatch(sourceHtml, /<script(?![^>]*type="module")[^>]*src=/u);
assert.doesNotMatch(sourceHtml, /<meta\b[^>]*name=["']robots["']/iu);
assert.match(sourceAdminHtml, /<div id="root"><\/div>/u);
assert.match(sourceAdminHtml, /src="\/src\/main\.jsx"/u);
assert.match(sourceAdminHtml, robotsMetaPattern);
assert.equal(ADMIN_ROUTE_PATH, "/admin");
assert.deepEqual(ADMIN_ROUTE_REDIRECT_PATHS, ["/admin/", "/admin.html"]);
assert.equal(isCanonicalAdminPath("/admin"), true);
assert.equal(isCanonicalAdminPath("/admin/"), false);
assert.equal(isCanonicalAdminPath("/admin.html"), false);
assert.match(sourceApp, /isCanonicalAdminPath\(window\.location\.pathname\)/u);
assert.doesNotMatch(sourceApp, /startsWith\(["']\/admin\//u);
assert.match(sourcePublicPage, /<main id="main-content" tabIndex=\{-1\}>/u);
assert.match(sourceAdminPage, /<a className="skip-link" href="#main-content">/u);
assert.match(sourceAdminPage, /<main id="main-content" className="section-shell" tabIndex=\{-1\}/u);
assert.match(sourceQuestions, /type="radio"/u);
assert.match(sourceQuestions, /role="radiogroup"/u);
assert.doesNotMatch(sourceQuestions, /aria-pressed/u);
assert.match(sourceQuestions, /const \[selected, setSelected\] = useState\(""\);/u);
assert.match(sourceQuestions, /: "neutral"\}/u);
assert.match(sourceQuestions, /Choose an answer to inspect the decision/u);
assert.match(sourceQuestions, />Reset question <span aria-hidden="true">↺<\/span><\/button>/u);
assert.doesNotMatch(sourceQuestions, /Next question/u);
assert.match(sourceQuestions, /aria-controls="session-details" aria-expanded=\{detailsOpen\}/u);
assert.match(sourceQuestions, /className="details-copy" id="session-details"/u);
assert.match(sourceDecisionField, /data-state=\{state\}/u);
assert.match(sourceDecisionField, /className="decision-route decision-route-resolved"/u);
assert.match(sourceDecisionField, /className="decision-module decision-module-action"/u);
assert.doesNotMatch(sourceDecisionField, /<canvas|requestAnimationFrame|ResizeObserver/u);
assert.match(sourceReveal, /element\.inert = true/u);
assert.match(sourceReveal, /element\.inert = false/u);
assert.match(sourceReveal, /function suppressFocusableDescendants/u);
assert.match(sourceReveal, /new MutationObserver/u);
assert.match(sourceReveal, /control\.setAttribute\("tabindex", "-1"\)/u);
assert.match(sourceReveal, /if \(tabIndex === "-1"\) return;/u);
assert.match(sourceReveal, /attributes: true/u);
assert.match(sourceReveal, /attributeFilter: \["disabled", "tabindex", "href", "contenteditable"\]/u);
assert.match(sourceReveal, /control\.getAttribute\("tabindex"\) !== "-1"/u);
assert.match(sourcePublicPage, /Practice: composite index ordering\./u);
assert.match(sourcePublicPage, /No timer — local demo/u);
assert.match(sourcePublicPage, /It does not save attempts or calculate a review schedule; reset to retry the same question\./u);
assert.match(sourcePublicPage, /className="button button-small button-primary nav-action" href="#session"/u);
assert.match(sourcePublicPage, /compact-navigation/u);
assert.doesNotMatch(sourcePublicPage, /Elapsed time/u);
assert.match(sourcePublicPage, /href="#session">Open the SQL question<\/a>/u);
assert.match(sourcePublicPage, /It shows the current response, explains what matters, and makes the next action explicit\./u);
assert.match(sourcePublicPage, /Show what the current response supports and state when evidence is limited\./u);
assert.doesNotMatch(sourcePublicPage, /It records what happened|recorded attempts/u);
assert.match(sourcePublicPage, /href="#method">See the practice loop <span aria-hidden="true">→<\/span><\/a>/u);
assert.match(sourcePublicPage, /href="#session">Try the local practice demo <span aria-hidden="true">→<\/span><\/a>/u);
assert.doesNotMatch(sourcePublicPage, /href="#product">Explore (Algorithms|Certification)/u);
assert.doesNotMatch(sourcePublicPage, /Two families|family-card|family-grid/u);
for (const trackName of [
  "Coding Interview: DSA & Problem Solving",
  "Backend System Design Interview",
  "Object-Oriented Design Interview",
  "Frontend System Design Interview",
  "Google Cloud Associate Cloud Engineer",
  "AWS Certified Solutions Architect – Associate",
  "Microsoft Azure Administrator Associate (AZ-104)",
  "Microsoft Azure AI Fundamentals (AI-901)",
]) {
  assert.ok(sourcePublicPage.includes(trackName), `Missing canonical launch track: ${trackName}`);
}
assert.equal((sourcePublicPage.match(/glyph: /gu) || []).length, 8, "The public catalogue must expose exactly eight canonical launch tracks.");
assert.doesNotMatch(sourcePublicPage, /boundary errors|Review due: repeated strategy error|Continue guided practice/u);
assert.match(sourceAdminPage, /initializationState === "loading"/u);
assert.match(sourceAdminPage, /initializationState === "ready"/u);
assert.match(sourceAdminPage, /initializationState === "error"/u);
assert.match(sourceAdminPage, /className="admin-unavailable"/u);
assert.match(sourceAdminPage, /role="alert">\{configError\}<\/div>/u);
assert.match(sourceAdminPage, /Wróć na stronę główną/u);
assert.match(sourceAdminPage, /ariaLabel="Patternly — strona główna"/u);
assert.doesNotMatch(sourcePublicPage, />Open Patternly</u);
assert.match(sourceStyles, /scroll-margin-top: 88px/u);
assert.doesNotMatch(sourcePublicPage, /data-page-progress|page-progress/u);
assert.doesNotMatch(sourceStyles, /\.page-progress/u);
assert.match(sourceStyles, /--text-muted: #9aa8bb;/u);
assert.match(sourceStyles, /--section-space: clamp\(6rem, 8vw, 8rem\)/u);
assert.match(sourceStyles, /\.session-layout \{[^}]*margin-top: 44px/u);
assert.match(sourceStyles, /\.track-atlas \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/u);
assert.match(sourceStyles, /@media \(max-width: 620px\)[\s\S]*\.track-atlas \{ grid-template-columns: 1fr; \}/u);
assert.match(sourceStyles, /@media \(prefers-reduced-motion: reduce\)/u);
assert.doesNotMatch(sourceStyles, /animation(?:-iteration-count)?:\s*[^;}]*(?:infinite)/u);
assert.match(sourceStyles, /@media \(max-width: 840px\)[\s\S]*\.nav-menu-toggle \{ display: inline-flex/u);
assert.match(sourceStyles, /@media \(max-width: 480px\)[\s\S]*\.nav-action \{ display: none; \}/u);
assert.equal((sourceStyles.match(/@font-face/gu) || []).length, 4, "Only Latin and Latin Extended font faces should ship.");
assert.doesNotMatch(sourceStyles, /cyrillic|greek|vietnamese/u);

const moduleServer = await createServer({ root, appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
try {
  const { PublicPage } = await moduleServer.ssrLoadModule("/src/pages/PublicPage.jsx");
  const renderedPublicPage = renderToStaticMarkup(createElement(PublicPage));
  assert.match(renderedPublicPage, /Practice the/u, "The public React tree must render without an undefined runtime dependency.");
  assert.match(renderedPublicPage, /decision-instrument/u, "The rendered public tree must include the decision instrument.");
} finally {
  await moduleServer.close();
}

const distHtml = await readFile(resolve(root, "dist/index.html"), "utf8");
const distAdminHtml = await readFile(resolve(root, "dist/admin.html"), "utf8");
assert.match(distHtml, /<div id="root"><\/div>/u);
const bundlePathMatch = distHtml.match(moduleScriptPattern);
const adminBundlePathMatch = distAdminHtml.match(moduleScriptPattern);
assert.ok(bundlePathMatch, "The public production HTML must reference the built React bundle.");
assert.ok(adminBundlePathMatch, "The admin production HTML must reference the built React bundle.");
assert.doesNotMatch(distHtml, /<meta\b[^>]*name=["']robots["']/iu);
assert.match(distAdminHtml, robotsMetaPattern);
const bundleJs = await readFile(resolve(root, `dist${bundlePathMatch[1]}`), "utf8");
assert.match(bundleJs, /Panel jest niedostępny: brakuje środowiskowej konfiguracji Firebase lub API\./u);

async function fetchRoute(pathname, options = {}) {
  try {
    return await fetch(`${baseUrl}${pathname}`, { redirect: "manual", ...options });
  } catch (error) {
    throw new Error(`Could not reach the existing Vite server at ${baseUrl}: ${error.message}`);
  }
}

async function fetchHtml(pathname) {
  const response = await fetchRoute(pathname, { redirect: "follow" });
  assert.equal(response.status, 200, `Expected a successful direct request for ${pathname}.`);
  return { headers: response.headers, html: await response.text() };
}

for (const aliasPath of ADMIN_ROUTE_REDIRECT_PATHS) {
  const response = await fetchRoute(aliasPath);
  assert.equal(response.status, 308, `Expected ${aliasPath} to redirect permanently to ${ADMIN_ROUTE_PATH}.`);
  assert.equal(response.headers.get("location"), ADMIN_ROUTE_PATH, `${aliasPath} must redirect to the canonical admin path.`);
  assert.equal((await response.text()).trim(), "", `${aliasPath} must not render a second admin document.`);
}

const [rootResponse, adminResponse] = await Promise.all([fetchHtml("/"), fetchHtml("/admin")]);
assert.notEqual(adminResponse.html, rootResponse.html, "Direct /admin and / responses must use different route entries.");
assert.doesNotMatch(rootResponse.html, /<meta\b[^>]*name=["']robots["']/iu);
assert.match(adminResponse.html, robotsMetaPattern, "Direct /admin must contain static noindex,nofollow metadata.");
assert.match(rootResponse.html, /<div id="root"><\/div>/u);
assert.match(adminResponse.html, /<div id="root"><\/div>/u);
assert.match(rootResponse.html, moduleScriptPattern);
assert.match(adminResponse.html, moduleScriptPattern);
assert.doesNotMatch(rootResponse.headers.get("x-robots-tag") || "", /noindex|nofollow/iu);
assert.doesNotMatch(adminResponse.html, /updateRobotsMetadata/u);

const sourceEntry = await fetch(`${baseUrl}/src/main.jsx`);
assert.equal(sourceEntry.status, 200, "The active Vite server must serve the React entry module.");
assert.match(await sourceEntry.text(), automaticJsxRuntimePattern, "The active Vite JSX transform must provide the automatic React runtime.");

process.stdout.write(`Local build/direct-request/config verification passed against ${baseUrl}.\n`);
