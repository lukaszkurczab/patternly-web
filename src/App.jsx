import { useEffect } from "react";
import markMint from "../assets/brand/mark/patternly-mark-mint.svg";
import { isCanonicalAdminPath } from "./adminRoute";
import { AdminPage } from "./pages/AdminPage";
import { PublicPage } from "./pages/PublicPage";

export default function App() {
  const admin = isCanonicalAdminPath(window.location.pathname);

  useEffect(() => {
    document.documentElement.lang = admin ? "pl" : "en";
    document.title = admin ? "Patternly — Administracja" : "Patternly — Practice the decision";

    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.append(favicon);
    }
    favicon.href = markMint;
  }, [admin]);

  return admin ? <AdminPage /> : <PublicPage />;
}
