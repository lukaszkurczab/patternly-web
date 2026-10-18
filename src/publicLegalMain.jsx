import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "../styles.css";
import { PublicLegalPage } from "./pages/PublicLegalPage";
import { publicLegalRoute } from "./publicLegalLocales.js";

const root = document.getElementById("root");
if (!root) throw new Error("Patternly root element is missing.");

const route = publicLegalRoute(window.location.pathname, __PATTERNLY_PUBLIC_LEGAL__);
if (!route) throw new Error("Legal document route is unavailable.");
const content = (<StrictMode><PublicLegalPage document={route.document} initialLocale={route.locale} /></StrictMode>);

if (root.hasChildNodes()) hydrateRoot(root, content);
else createRoot(root).render(content);
