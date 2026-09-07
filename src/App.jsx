import { useEffect } from "react";
import markMint from "../assets/brand/mark/patternly-mark-mint.svg";
import { isCanonicalAdminPath } from "./adminRoute";
import { AdminPage } from "./pages/AdminPage";
import { PublicPage } from "./pages/PublicPage";
import { PrivacyRequestPage } from "./pages/PrivacyRequestPage";

export default function App() {
  const admin = isCanonicalAdminPath(window.location.pathname);
  const privacyRequest = window.location.pathname === "/privacy-request"
    || window.location.pathname.startsWith("/privacy-request/");

  useEffect(() => {
    document.documentElement.lang = admin || privacyRequest ? "pl" : "en";
    document.title = admin ? "Patternly — Administracja" : privacyRequest ? "Patternly — Wniosek dotyczący danych" : "Patternly — Build confidence through practice";

    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.append(favicon);
    }
    favicon.href = markMint;
  }, [admin, privacyRequest]);

  return admin ? <AdminPage /> : privacyRequest ? <PrivacyRequestPage /> : <PublicPage />;
}
