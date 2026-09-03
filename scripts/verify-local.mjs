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
  heading: "incorrect-answer · otwarte",
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
const sourceQuestions = await readFile(resolve(root, "src/components/InteractiveQuestion.jsx"), "utf8");
const sourceStyles = await readFile(resolve(root, "styles.css"), "utf8");
const sourceReveal = await readFile(resolve(root, "src/hooks/useReveal.jsx"), "utf8");
const trackIconNames = ["route", "database", "grid", "device-phone", "server-stack", "cloud", "settings", "cpu"];
const trackIconSources = await Promise.all(trackIconNames.map(async (iconName) => [
  iconName,
  await readFile(resolve(root, `assets/icons/${iconName}.svg`), "utf8"),
]));
assert.match(sourceHtml, /<div id="root"><\/div>/u);
assert.match(sourceHtml, /src="\/src\/main\.jsx"/u);
assert.match(sourceHtml, /<title>Patternly — Build confidence through practice<\/title>/u);
assert.doesNotMatch(sourceHtml, /<script(?![^>]*type="module")[^>]*src=/u);
assert.doesNotMatch(sourceHtml, /<meta\b[^>]*name=["']robots["']/iu);
assert.match(sourceAdminHtml, /<div id="root"><\/div>/u);
assert.match(sourceAdminHtml, /src="\/src\/main\.jsx"/u);
assert.match(sourceAdminHtml, robotsMetaPattern);
assert.doesNotMatch(sourceHtml + sourceAdminHtml, /PATTERNLY_ADMIN_(CONFIG|API_ORIGIN)/u);
assert.match(await readFile(resolve(root, "src/adminConfig.js"), "utf8"), /VITE_ADMIN_FIREBASE_API_KEY/u);
assert.equal(ADMIN_ROUTE_PATH, "/admin");
assert.deepEqual(ADMIN_ROUTE_REDIRECT_PATHS, ["/admin/", "/admin.html"]);
assert.equal(isCanonicalAdminPath("/admin"), true);
assert.equal(isCanonicalAdminPath("/admin/"), false);
assert.equal(isCanonicalAdminPath("/admin.html"), false);
assert.match(sourceApp, /isCanonicalAdminPath\(window\.location\.pathname\)/u);
assert.doesNotMatch(sourceApp, /startsWith\(["']\/admin\//u);
assert.match(sourceApp, /document\.title = admin \? "Patternly — Administracja" : "Patternly — Build confidence through practice"/u);
assert.match(sourcePublicPage, /<main id="main-content" tabIndex=\{-1\}>/u);
assert.match(sourceQuestions, /type="radio"/u);
assert.match(sourceQuestions, /role="radiogroup"/u);
assert.doesNotMatch(sourceQuestions, /aria-pressed/u);
assert.match(sourceQuestions, /const \[selected, setSelected\] = useState\(""\);/u);
assert.doesNotMatch(sourceQuestions, /Next question/u);
assert.match(sourceQuestions, /onClick=\{reset\}/u);
assert.doesNotMatch(sourcePublicPage + sourceStyles, /TrackGlyph|track-glyph/u);
assert.doesNotMatch(sourcePublicPage + sourceQuestions + sourceStyles, /HeroQuestionCard|SessionQuestionCard|DecisionField|decision-instrument|hero-stage|session-layout/u);
assert.match(sourceReveal, /element\.inert = true/u);
assert.match(sourceReveal, /element\.inert = false/u);
assert.match(sourceReveal, /function suppressFocusableDescendants/u);
assert.match(sourceReveal, /new MutationObserver/u);
assert.match(sourceReveal, /control\.setAttribute\("tabindex", "-1"\)/u);
assert.match(sourceReveal, /if \(tabIndex === "-1"\) return;/u);
assert.match(sourceReveal, /attributes: true/u);
assert.match(sourceReveal, /attributeFilter: \["disabled", "tabindex", "href", "contenteditable"\]/u);
assert.match(sourceReveal, /control\.getAttribute\("tabindex"\) !== "-1"/u);
assert.match(sourcePublicPage, /className="button button-small button-primary nav-action" href="#session"/u);
assert.match(sourcePublicPage, /compact-navigation/u);
assert.doesNotMatch(sourcePublicPage, /Elapsed time/u);
assert.doesNotMatch(sourcePublicPage, /It records what happened|recorded attempts/u);
assert.doesNotMatch(sourcePublicPage, /href="#product">Explore (Algorithms|Certification)/u);
assert.doesNotMatch(sourcePublicPage, /Two families|family-card|family-grid/u);
assert.doesNotMatch(sourcePublicPage + sourceStyles, /EvidenceSection|BoundariesSection|evidence-layout|boundary-card/u);
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
assert.equal((sourcePublicPage.match(/svg: /gu) || []).length, 8, "The public catalogue must expose exactly eight canonical launch tracks.");
assert.doesNotMatch(sourcePublicPage + sourceStyles, /mask(?:-image|-position|-repeat|-size)?/iu, "Track icons must not use CSS masks.");
for (const [iconName, iconSource] of trackIconSources) {
  assert.match(iconSource, /^<svg\b[^>]*>/u, `${iconName} must remain an SVG root.`);
  assert.match(iconSource, /currentColor/u, `${iconName} must inherit the mint icon color.`);
  assert.doesNotMatch(iconSource, /<script\b|\son[a-z]+\s*=|<foreignObject\b|\s(?:href|src)\s*=|javascript:|data:/iu, `${iconName} must not contain executable or external SVG content.`);
}
assert.doesNotMatch(sourcePublicPage, /boundary errors|Review due: repeated strategy error|Continue guided practice/u);
assert.doesNotMatch(sourcePublicPage, />Open Patternly</u);
assert.match(sourceStyles, /scroll-margin-top: 88px/u);
assert.doesNotMatch(sourcePublicPage, /data-page-progress|page-progress/u);
assert.doesNotMatch(sourceStyles, /\.page-progress/u);
assert.match(sourceStyles, /--text-muted: #9aa8bb;/u);
assert.match(sourceStyles, /--section-space: clamp\(4\.75rem, 6vw, 6\.5rem\)/u);
assert.match(sourceStyles, /\.track-atlas \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/u);
assert.match(sourceStyles, /@media \(max-width: 620px\)[\s\S]*\.track-atlas \{ grid-template-columns: 1fr; \}/u);
assert.match(sourceStyles, /@media \(prefers-reduced-motion: reduce\)/u);
assert.doesNotMatch(sourceStyles, /animation(?:-iteration-count)?:\s*[^;}]*(?:infinite)/u);
assert.match(sourceStyles, /@media \(max-width: 840px\)[\s\S]*\.nav-menu-toggle \{ display: inline-flex/u);
assert.match(sourceStyles, /@media \(max-width: 480px\)[\s\S]*\.nav-action \{ display: none; \}/u);
assert.equal((sourceStyles.match(/@font-face/gu) || []).length, 4, "Only Latin and Latin Extended font faces should ship.");
assert.doesNotMatch(sourceStyles, /cyrillic|greek|vietnamese/u);

const moduleServer = await createServer({ root, appType: "custom", logLevel: "silent", server: { middlewareMode: true }, define: { "import.meta.env.VITE_ADMIN_FIREBASE_API_KEY": '""' } });
try {
  const { AdminPage } = await moduleServer.ssrLoadModule("/src/pages/AdminPage.jsx");
  const renderedAdminPage = renderToStaticMarkup(createElement(AdminPage));
  assert.match(renderedAdminPage, /<main\b(?=[^>]*\bid="main-content")(?=[^>]*\btabindex="-1")[^>]*>/iu);
  assert.match(renderedAdminPage, /href="#main-content"/u);
  assert.match(renderedAdminPage, /role="alert"/u);
  assert.ok(renderedAdminPage.includes(ADMIN_UNAVAILABLE_MESSAGE));
  assert.match(renderedAdminPage, /Wróć na stronę główną/u);
  assert.doesNotMatch(renderedAdminPage, /<form\b/u);
  const { PublicPage } = await moduleServer.ssrLoadModule("/src/pages/PublicPage.jsx");
  const renderedPublicPage = renderToStaticMarkup(createElement(PublicPage));
  assert.match(renderedPublicPage, /Build /u, "The public React tree must render without an undefined runtime dependency.");
  assert.equal((renderedPublicPage.match(/role="radiogroup"/gu) || []).length, 1, "The public page must render one answer group.");
  const radioIds = [...renderedPublicPage.matchAll(/<input\b(?=[^>]*\bid="([^"]+)")(?=[^>]*\bname="session-answer")(?=[^>]*\btype="radio")[^>]*>/gu)].map((match) => match[1]);
  assert.equal(radioIds.length, 4, "The practice question must render four radios.");
  assert.equal(new Set(radioIds).size, 4, "Each practice radio must have a unique id.");
  for (const radioId of radioIds) assert.match(renderedPublicPage, new RegExp(`<label\\b(?=[^>]*\\bfor="${radioId}")[^>]*>`, "u"), `The ${radioId} radio must have a label.`);
  assert.equal((renderedPublicPage.match(/\bid="session"/gu) || []).length, 1, "The page must render one #session anchor target.");
  assert.match(renderedPublicPage, /<section\b(?=[^>]*\bid="session")(?=[^>]*\baria-labelledby="session-title")[^>]*>/u, "The #session target must be labelled by its question heading.");
  assert.match(renderedPublicPage, /<h2\b[^>]*\bid="session-title"[^>]*>/u, "The #session target must contain a question heading.");
  assert.match(renderedPublicPage, /<button\b(?=[^>]*\baria-controls="session-details")[^>]*>/u, "The details control must reference its explanation.");
  assert.match(renderedPublicPage, /<p\b(?=[^>]*\bid="session-details")(?=[^>]*\bhidden="")[^>]*>/u, "The details target must remain in the DOM while closed.");
  const primaryCtaTargets = [...renderedPublicPage.matchAll(/<a\b(?=[^>]*\bclass="[^"]*\bbutton-primary\b[^"]*")(?=[^>]*\bhref="([^"]+)")[^>]*>/gu)].map((match) => match[1]);
  assert.ok(primaryCtaTargets.length > 0 && primaryCtaTargets.every((target) => target === "#session"), "Every primary public CTA must lead to the real practice question.");
  const renderedIds = [...renderedPublicPage.matchAll(/\bid="([^"]+)"/gu)].map((match) => match[1]);
  assert.equal(new Set(renderedIds).size, renderedIds.length, "Rendered public ids must be unique.");
  assert.equal((renderedPublicPage.match(/class="track-card"/gu) || []).length, 8, "The public catalogue must render eight track cards.");
  assert.equal((renderedPublicPage.match(/data-track-icon="[^"]+"[^>]*><svg\b/gu) || []).length, 8, "Every track card must render its local SVG inside the decorative icon wrapper.");
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
