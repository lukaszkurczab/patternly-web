import { publicSitePlugin } from "./scripts/public-site.mjs";
import { publicPages } from "./src/publicPages.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { getAdminRedirectPath } from "./src/adminRoute.js";
import { loadPublicLegalArtifact } from "./src/publicLegalArtifact.js";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

function redirectAdminAliases(server, legal) {
  server.middlewares.use((request, response, next) => {
    const requestUrl = new URL(request.url || "/", "http://patternly.local");
    const page = publicPages(legal).find((candidate) => candidate.path === requestUrl.pathname.replace(/\.html$/u, ""));
    if (page && page.path !== "/") {
      request.url = `/${page.template}${requestUrl.search}`;
      next();
      return;
    }
    const redirectPath = getAdminRedirectPath(requestUrl.pathname);

    if (!redirectPath) {
      next();
      return;
    }

    response.statusCode = 308;
    response.setHeader("Location", `${redirectPath}${requestUrl.search}`);
    response.end();
  });
}

function localAdminRoutePlugin(legal) {
  return {
    name: "patternly-local-admin-route",
    configureServer(server) {
      redirectAdminAliases(server, legal);
    },
  };
}

export default defineConfig(({ mode }) => {
  const legal = loadPublicLegalArtifact(process.env, mode === "local-test" ? "local-test" : "production");
  return {
    appType: "mpa",
    plugins: [localAdminRoutePlugin(legal), publicSitePlugin(legal, mode === "local-test")],
    esbuild: {
      jsx: "automatic",
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(projectRoot, "index.html"),
          privacy: resolve(projectRoot, "privacy.html"),
          terms: resolve(projectRoot, "terms.html"),
        },
      },
    },
    define: {
      __PATTERNLY_PUBLIC_LEGAL__: JSON.stringify(legal),
    },
  };
});
