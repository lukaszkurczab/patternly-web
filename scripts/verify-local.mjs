import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer, preview } from "vite";
import { addSyntheticPublicLegalLocales, createAppProducedPublicLegalTestArtifact } from "./publicLegalTestArtifact.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const legalArtifact = createAppProducedPublicLegalTestArtifact();
const fixtureDirectory = await mkdtemp(resolve(tmpdir(), "patternly-public-legal-verify-"));
const legalFixturePath = resolve(fixtureDirectory, "public-legal.json");
await writeFile(legalFixturePath, `${JSON.stringify(legalArtifact, null, 2)}\n`);
process.env.PATTERNLY_PUBLIC_LEGAL_ARTIFACT_PATH = legalFixturePath;
process.env.PATTERNLY_PUBLIC_LEGAL_EXPECTED_FINGERPRINT = legalArtifact.sourceFingerprint;
const hosting = JSON.parse(await readFile(resolve(root, "firebase.json"), "utf8")).hosting;
const publicTracks = [
  ["coding-interview-dsa-problem-solving", "Coding Interview: DSA & Problem Solving"],
  ["backend-system-design-interview", "Backend System Design Interview"],
  ["object-oriented-design-interview", "Object-Oriented Design Interview"],
  ["frontend-system-design-interview", "Frontend System Design Interview"],
  ["google-cloud-associate-cloud-engineer", "Google Cloud Associate Cloud Engineer", "Independent study content. Not affiliated with or endorsed by Google."],
  ["aws-certified-solutions-architect-associate", "AWS Certified Solutions Architect - Associate", "Independent study content. Not affiliated with or endorsed by Amazon Web Services."],
  ["microsoft-azure-administrator-associate-az-104", "Microsoft Azure Administrator Associate AZ-104", "Independent study content. Not affiliated with or endorsed by Microsoft."],
  ["microsoft-azure-ai-fundamentals-ai-901", "Microsoft Azure AI Fundamentals AI-901", "Independent study content. Not affiliated with or endorsed by Microsoft."],
  ["claude-certified-architect-professional-certification", "Claude Certified Architect – Professional", "Independent study content. Not affiliated with or endorsed by Anthropic."],
];

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }));
  return nested.flat();
}

assert.equal(hosting.public, "dist");
assert.equal(hosting.redirects, undefined, "Hosting must not redirect to an admin route.");
assert.equal(hosting.rewrites, undefined, "Hosting must not rewrite privacy routes.");
assert.equal(hosting.headers, undefined, "Admin noindex headers cannot substitute for exclusion.");

const builtFiles = await files(dist);
assert.ok(builtFiles.some((path) => path.endsWith("/index.html")));
assert.ok(builtFiles.some((path) => path.endsWith("/privacy.html")));
assert.ok(builtFiles.some((path) => path.endsWith("/terms.html")));
assert.ok(!builtFiles.some((path) => path.endsWith("/admin.html")));
const textAssets = builtFiles.filter((path) => /\.(?:html|js|css|json|svg)$/u.test(path));
const builtText = (await Promise.all(textAssets.map((path) => readFile(path, "utf8")))).join("\n");
for (const forbidden of [
  /PrivacyRequestPage/u,
  /privacy-request/u,
  /AdminPage/u,
  /admin-report/u,
  /admin-auth/u,
  /Admin sign in/u,
  /VITE_ADMIN_/u,
  /Panel jest niedostępny/u,
  /firebase\/auth/u,
]) assert.doesNotMatch(builtText, forbidden, `Public dist contains ${forbidden}.`);

const sourceMain = await readFile(resolve(root, "src/main.jsx"), "utf8");
const sourceAdminMain = await readFile(resolve(root, "src/adminMain.jsx"), "utf8");
assert.match(sourceMain, /PublicPage/u);
assert.doesNotMatch(sourceMain, /AdminPage|PrivacyRequestPage|\.\/App/u);
assert.match(sourceAdminMain, /AdminPage/u);
assert.doesNotMatch(sourceAdminMain, /PublicPage|PrivacyRequestPage/u);

const ssr = await createServer({ root, mode: "local-test", appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
try {
  const { PublicPage } = await ssr.ssrLoadModule("/src/pages/PublicPage.jsx");
  const html = renderToStaticMarkup(createElement(PublicPage));
  assert.match(html, /Build /u);
  assert.equal((html.match(/class="track-card"/gu) || []).length, 9);
  const renderedTrackIds = [...html.matchAll(/data-track-id="([^"]+)"/gu)].map((match) => match[1]);
  assert.equal(new Set(renderedTrackIds).size, publicTracks.length, "Public track IDs must be unique.");
  assert.deepEqual(renderedTrackIds, publicTracks.map(([id]) => id), "Public catalog IDs and ordering must match the reviewed mobile registry.");
  for (const [, title, disclaimer] of publicTracks) {
    assert.ok(html.includes(title.replaceAll("&", "&amp;")), `Public catalog is missing the reviewed track title: ${title}`);
    if (disclaimer) assert.ok(html.includes(disclaimer), `Public catalog is missing the independence note for: ${title}`);
  }
  assert.equal((html.match(/data-track-icon="sparkle"/gu) || []).length, 1);
  assert.equal((html.match(/role="radiogroup"/gu) || []).length, 1);
  assert.match(html, /Seller: &lt;script&gt;alert\(1\)&lt;\/script&gt;/u);
  assert.doesNotMatch(html, /<script>alert/u);
  assert.ok(html.includes(legalArtifact.publicLinks.privacyUrl));
  assert.ok(html.includes(legalArtifact.publicLinks.termsUrl));
  assert.ok(html.includes(legalArtifact.publicLinks.supportUrl));
  assert.doesNotMatch(html, /href="\/admin"|privacy-request/u);

  const { PublicLegalPage } = await ssr.ssrLoadModule("/src/pages/PublicLegalPage.jsx");
  const privacy = renderToStaticMarkup(createElement(PublicLegalPage, { document: "privacyPolicy" }));
  assert.match(privacy, /Privacy policy/u);
  assert.match(privacy, /test-2026-09-24/u);
  assert.ok(privacy.includes("Synthetic legal.privacy.controllerLegalName.en"));
  assert.ok(privacy.includes(legalArtifact.publicLinks.privacyUrl));
  assert.ok(privacy.includes(legalArtifact.publicLinks.termsUrl));
  assert.doesNotMatch(privacy, /<script>alert|onerror=/iu);
  const terms = renderToStaticMarkup(createElement(PublicLegalPage, { document: "termsOfService" }));
  assert.match(terms, /Terms of service/u);
  assert.match(terms, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/u);
  assert.doesNotMatch(terms, /<script>alert/u);
  const privacyPl = renderToStaticMarkup(createElement(PublicLegalPage, { document: "privacyPolicy", initialLocale: "pl" }));
  assert.match(privacyPl, /Polityka prywatności/u);
  assert.match(privacyPl, /lang="pl"/u);
  assert.match(privacyPl, /test-2026-09-24/u);
  assert.ok(privacyPl.includes("Synthetic legal.privacy.controllerLegalName.pl"));
  const termsPl = renderToStaticMarkup(createElement(PublicLegalPage, { document: "termsOfService", initialLocale: "pl" }));
  assert.match(termsPl, /Warunki korzystania/u);
  assert.match(termsPl, /lang="pl"/u);
  assert.match(termsPl, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/u);

  const allLocales = addSyntheticPublicLegalLocales(legalArtifact, ["de", "fr", "es", "it", "et"]);
  const localeSsr = await createServer({
    configFile: false,
    root,
    mode: "local-test",
    appType: "custom",
    logLevel: "silent",
    esbuild: { jsx: "automatic" },
    define: { __PATTERNLY_PUBLIC_LEGAL__: JSON.stringify(allLocales) },
    server: { middlewareMode: true },
  });
  try {
    const { PublicLegalPage: AllLocaleLegalPage } = await localeSsr.ssrLoadModule("/src/pages/PublicLegalPage.jsx");
    const germanPrivacy = renderToStaticMarkup(createElement(AllLocaleLegalPage, { document: "privacyPolicy", initialLocale: "de" }));
    assert.match(germanPrivacy, /Datenschutzerklärung/u);
    assert.match(germanPrivacy, /lang="de"/u);
    assert.match(germanPrivacy, /test-de-2026-09-24/u);
    assert.match(germanPrivacy, /<option value="et">Eesti<\/option>/u);
    const estonianTerms = renderToStaticMarkup(createElement(AllLocaleLegalPage, { document: "termsOfService", initialLocale: "et" }));
    assert.match(estonianTerms, /Kasutustingimused/u);
    assert.match(estonianTerms, /lang="et"/u);
    assert.match(estonianTerms, /test-et-2026-09-24/u);
  } finally { await localeSsr.close(); }
} finally { await ssr.close(); }

const local = await createServer({ root, mode: "local-test", logLevel: "silent", server: { host: "127.0.0.1", port: 0 } });
await local.listen();
try {
  const localUrl = local.resolvedUrls.local[0];
  const admin = await fetch(new URL("/admin", localUrl));
  assert.equal(admin.status, 200);
  assert.match(await admin.text(), /src="\/src\/adminMain\.jsx"/u);
  assert.equal((await fetch(new URL("/privacy-request", localUrl))).status, 404);
  for (const route of ["/privacy", "/terms"]) {
    const response = await fetch(new URL(route, localUrl));
    assert.equal(response.status, 200);
    assert.match(await response.text(), /publicLegalMain\.jsx/u);
  }
} finally { await local.close(); }

const publicPreview = await preview({ root, mode: "local-test", logLevel: "silent", preview: { host: "127.0.0.1", port: 0 } });
try {
  const address = publicPreview.httpServer.address();
  const base = `http://127.0.0.1:${address.port}`;
  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /src="\/assets\/index-[^"]+\.js"/u);
  for (const path of ["/privacy.html", "/terms.html"]) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /src="\/assets\/publicLegalMain-[^"]+\.js"/u);
  }
  for (const path of ["/admin", "/admin/", "/admin.html", "/privacy-request", "/privacy-request/example"]) {
    assert.equal((await fetch(`${base}${path}`, { redirect: "manual" })).status, 404, `${path} must be absent from the public preview.`);
  }
} finally { await new Promise((done) => publicPreview.httpServer.close(done)); }

await rm(fixtureDirectory, { recursive: true, force: true });
process.stdout.write("Public build, legal pages, locale content, route boundary, marketing render, and local admin entry verification passed.\n");
