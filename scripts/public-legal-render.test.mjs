import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { createAppProducedPublicLegalTestArtifact } from "./publicLegalTestArtifact.mjs";

test("support target reaches the unchanged Terms section in every app-produced test locale", async () => {
  const source = JSON.parse(await readFile(new URL("../../patternly/config/public-legal.release.json", import.meta.url), "utf8"));
  assert.equal(source.publicLinks.supportUrl, `${source.publicLinks.termsUrl}#support`);
  const artifact = createAppProducedPublicLegalTestArtifact();
  assert.equal(artifact.testOnly, true);
  assert.equal(artifact.approvalStatus, "UNAPPROVED");
  const server = await createServer({
    configFile: false, appType: "custom", logLevel: "error",
    esbuild: { jsx: "automatic" },
    define: { __PATTERNLY_PUBLIC_LEGAL__: JSON.stringify(artifact) },
    server: { middlewareMode: true },
  });
  try {
    const { PublicLegalPage } = await server.ssrLoadModule("/src/pages/PublicLegalPage.jsx");
    for (const locale of ["en", "pl", "de", "fr", "es", "it", "et"]) {
      for (const document of ["termsOfService", "privacyPolicy"]) {
        const html = renderToStaticMarkup(createElement(PublicLegalPage, { document, initialLocale: locale }));
        const paragraphs = artifact.documents[document][locale].split(/\n{2,}/u).map((paragraph) => paragraph.trim()).filter(Boolean);
        assert.equal((html.match(/id="support"/gu) ?? []).length, document === "termsOfService" ? 1 : 0, `${document}/${locale} anchor count`);
        const expected = paragraphs.map((paragraph) => renderToStaticMarkup(createElement("p", {
          id: document === "termsOfService" && /^16\.\s/u.test(paragraph) ? "support" : undefined,
        }, paragraph))).join("");
        assert.ok(html.includes(`<article class="legal-copy" lang="${locale}">${expected}</article>`), `${document}/${locale} preserves every producer paragraph`);
        if (document === "termsOfService") {
          const section = paragraphs.findIndex((paragraph) => /^16\.\s/u.test(paragraph));
          assert.ok(section >= 0 && paragraphs[section + 2]?.length > 0, `${locale} support commitment follows requirements`);
        }
      }
    }
  } finally {
    await server.close();
  }
});
