import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import { AdminPage } from "./pages/AdminPage";
import markMint from "../assets/brand/mark/patternly-mark-mint.svg";

const root = document.getElementById("root");
if (!root) throw new Error("Patternly admin root element is missing.");

let favicon = document.querySelector('link[rel="icon"]');
if (!favicon) {
  favicon = document.createElement("link");
  favicon.rel = "icon";
  document.head.append(favicon);
}
favicon.href = markMint;

createRoot(root).render(
  <StrictMode>
    <AdminPage />
  </StrictMode>,
);
