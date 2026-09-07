import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { getAdminRedirectPath } from "./src/adminRoute.js";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

function redirectAdminAliases(server) {
  server.middlewares.use((request, response, next) => {
    const requestUrl = new URL(request.url || "/", "http://patternly.local");
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

function canonicalAdminRoutePlugin() {
  return {
    name: "patternly-canonical-admin-route",
    configureServer(server) {
      redirectAdminAliases(server);
      server.middlewares.use((request, _response, next) => {
        const pathname = new URL(request.url || "/", "http://patternly.local").pathname;
        if (pathname === "/privacy-request" || pathname.startsWith("/privacy-request/")) request.url = "/index.html";
        next();
      });
    },
    configurePreviewServer(server) {
      redirectAdminAliases(server);
      server.middlewares.use((request, _response, next) => {
        const pathname = new URL(request.url || "/", "http://patternly.local").pathname;
        if (pathname === "/privacy-request" || pathname.startsWith("/privacy-request/")) request.url = "/index.html";
        next();
      });
    },
  };
}

export default defineConfig({
  appType: "mpa",
  plugins: [canonicalAdminRoutePlugin()],
  esbuild: {
    jsx: "automatic",
  },
  build: {
    rollupOptions: {
      input: {
        public: resolve(projectRoot, "index.html"),
        admin: resolve(projectRoot, "admin.html"),
      },
    },
  },
});
