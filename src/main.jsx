import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "../styles.css";
import { PublicPage } from "./pages/PublicPage";
const root = document.getElementById("root");

if (!root) {
  throw new Error("Patternly root element is missing.");
}

const content = (
  <StrictMode>
    <PublicPage />
  </StrictMode>
);

if (root.hasChildNodes()) hydrateRoot(root, content);
else createRoot(root).render(content);
