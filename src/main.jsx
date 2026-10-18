import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "../styles.css";
import { PublicPage } from "./pages/PublicPage";
import { PublicTrackPage } from "./pages/PublicTrackPage";
import { publicTrackPages } from "./publicTrackPages.js";
const trackPage = publicTrackPages.find((page) => page.path === window.location.pathname.replace(/\.html$/u, ""));
const root = document.getElementById("root");

if (!root) {
  throw new Error("Patternly root element is missing.");
}

const content = (
  <StrictMode>
    {trackPage ? <PublicTrackPage page={trackPage} /> : <PublicPage />}
  </StrictMode>
);

if (root.hasChildNodes()) hydrateRoot(root, content);
else createRoot(root).render(content);
