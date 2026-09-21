import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer, preview } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const hosting = JSON.parse(await readFile(resolve(root, "firebase.json"), "utf8")).hosting;

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

const ssr = await createServer({ root, appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
try {
  const { PublicPage } = await ssr.ssrLoadModule("/src/pages/PublicPage.jsx");
  const html = renderToStaticMarkup(createElement(PublicPage));
  assert.match(html, /Build /u);
  assert.equal((html.match(/class="track-card"/gu) || []).length, 9);
  assert.match(html, /Claude Certified Architect – Professional/u);
  assert.match(html, /Independent practice for designing and operating production Claude systems, from solution architecture and evaluation to governance and delivery\./u);
  assert.match(html, /Independent study content\. Not affiliated with or endorsed by Anthropic\./u);
  assert.equal((html.match(/data-track-icon="sparkle"/gu) || []).length, 1);
  assert.equal((html.match(/role="radiogroup"/gu) || []).length, 1);
  assert.doesNotMatch(html, /href="\/admin"|privacy-request/u);
} finally { await ssr.close(); }

const local = await createServer({ root, logLevel: "silent", server: { host: "127.0.0.1", port: 0 } });
await local.listen();
try {
  const localUrl = local.resolvedUrls.local[0];
  const admin = await fetch(new URL("/admin", localUrl));
  assert.equal(admin.status, 200);
  assert.match(await admin.text(), /src="\/src\/adminMain\.jsx"/u);
  assert.equal((await fetch(new URL("/privacy-request", localUrl))).status, 404);
} finally { await local.close(); }

const publicPreview = await preview({ root, logLevel: "silent", preview: { host: "127.0.0.1", port: 0 } });
try {
  const address = publicPreview.httpServer.address();
  const base = `http://127.0.0.1:${address.port}`;
  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /src="\/assets\/index-[^"]+\.js"/u);
  for (const path of ["/admin", "/admin/", "/admin.html", "/privacy-request", "/privacy-request/example"]) {
    assert.equal((await fetch(`${base}${path}`, { redirect: "manual" })).status, 404, `${path} must be absent from the public preview.`);
  }
} finally { await new Promise((done) => publicPreview.httpServer.close(done)); }

process.stdout.write("Public build, route boundary, marketing render, and local admin entry verification passed.\n");
