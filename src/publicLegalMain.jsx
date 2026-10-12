import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "../styles.css";
import { PublicLegalPage } from "./pages/PublicLegalPage";

const root = document.getElementById("root");
if (!root) throw new Error("Patternly root element is missing.");

const legalDocument = window.location.pathname.startsWith("/terms") ? "termsOfService" : "privacyPolicy";
const content = (<StrictMode><PublicLegalPage document={legalDocument} /></StrictMode>);

if (root.hasChildNodes()) hydrateRoot(root, content);
else createRoot(root).render(content);
