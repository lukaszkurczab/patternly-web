import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import { PublicLegalPage } from "./pages/PublicLegalPage";

const root = document.getElementById("root");
if (!root) throw new Error("Patternly root element is missing.");

const document = window.location.pathname.startsWith("/terms") ? "termsOfService" : "privacyPolicy";
createRoot(root).render(<StrictMode><PublicLegalPage document={document} /></StrictMode>);
