import { useEffect, useRef, useState } from "react";
import { Brand } from "../components/Brand";

const RIGHTS = [
  ["access", "Dostęp do danych"],
  ["rectification", "Sprostowanie danych"],
  ["erasure", "Usunięcie danych"],
  ["restriction", "Ograniczenie przetwarzania"],
  ["objection", "Sprzeciw"],
  ["portability", "Przeniesienie danych"],
  ["consent_withdrawal", "Wycofanie zgody"],
];
const API_ORIGIN = (import.meta.env.VITE_PUBLIC_API_ORIGIN || import.meta.env.VITE_ADMIN_API_ORIGIN || "").replace(/\/$/u, "");

async function post(path, body, signal) {
  if (!API_ORIGIN) throw new Error("Kanał wniosków jest chwilowo niedostępny.");
  const response = await fetch(`${API_ORIGIN}${path}`, { method: "POST", signal, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status === 429 ? "Wysłano zbyt wiele wniosków. Spróbuj później." : "Nie udało się wykonać operacji. Spróbuj ponownie.");
  return payload;
}

export function PrivacyRequestPage() {
  const [email, setEmail] = useState("");
  const [right, setRight] = useState("access");
  const [narrative, setNarrative] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [responseText, setResponseText] = useState(null);
  const [extensionReason, setExtensionReason] = useState(null);
  const active = useRef(null);
  const exchange = useRef(null);
  const requestId = decodeURIComponent(window.location.pathname.split("/")[2] || "");

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (!requestId || !token) return undefined;
    let mounted = true;
    setBusy(true); setMessage("Sprawdzamy bezpieczny link…");
    exchange.current ??= (async () => {
      const session = await post(`/v1/public/privacy-requests/${encodeURIComponent(requestId)}/session`, { token });
      window.history.replaceState(null, "", window.location.pathname);
      return post(`/v1/public/privacy-requests/${encodeURIComponent(requestId)}/response`, { sessionToken: session.sessionToken });
    })();
    void (async () => {
      try {
        const result = await exchange.current;
        if (!mounted) return;
        if (typeof result?.request?.status !== "string") throw new Error("Otrzymano nieprawidłową odpowiedź.");
        setResponseText(typeof result.response === "string" ? result.response : null);
        setExtensionReason(typeof result.extensionReason === "string" ? result.extensionReason : null);
        setMessage(result.response ? "Odpowiedź na wniosek" : "Wniosek jest w trakcie realizacji. O zakończeniu poinformujemy e-mailem.");
      } catch (error) {
        if (mounted && error?.name !== "AbortError") setMessage(error.message);
      } finally {
        if (mounted) setBusy(false);
      }
    })();
    return () => { mounted = false; };
  }, [requestId]);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true); setMessage("");
    try {
      await post("/v1/public/privacy-requests", { email, right, ...(narrative.trim() ? { narrative: narrative.trim() } : {}) }, controller.signal);
      setMessage("Jeśli adres może zostać powiązany z danymi w Patternly, wyślemy bezpieczny link do potwierdzenia wniosku.");
      setEmail(""); setNarrative("");
    } catch (error) {
      if (error?.name !== "AbortError") setMessage(error.message);
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  }

  return <><header className="site-header"><div className="header-inner"><Brand /><a href="/">Wróć do Patternly</a></div></header><main className="privacy-public section-shell" id="main-content">
    <p className="eyebrow">PRYWATNOŚĆ</p><h1>Wniosek dotyczący danych</h1>
    <p className="privacy-public-intro">Masz konto? Najprościej złóż wniosek w aplikacji. Bez konta możesz użyć formularza poniżej. Zwykle odpowiadamy w ciągu miesiąca.</p>
    {requestId ? <section className="privacy-public-card" aria-live="polite"><h2>Status wniosku</h2><p>{message || "Otwórz pełny link otrzymany e-mailem."}</p>{extensionReason && <p><strong>Powód przedłużenia:</strong> {extensionReason}</p>}{responseText && <div className="privacy-public-response">{responseText}</div>}</section> : <form className="privacy-public-card" onSubmit={submit}>
      <label htmlFor="privacy-email">Adres e-mail</label><input autoComplete="email" id="privacy-email" maxLength={320} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
      <label htmlFor="privacy-right">Czego dotyczy wniosek?</label><select id="privacy-right" onChange={(event) => setRight(event.target.value)} value={right}>{RIGHTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <label htmlFor="privacy-details">Szczegóły (opcjonalnie)</label><textarea id="privacy-details" maxLength={2000} onChange={(event) => setNarrative(event.target.value)} rows={5} value={narrative} />
      <button className="button button-primary" disabled={busy} type="submit">{busy ? "Wysyłanie…" : "Wyślij wniosek"}</button>
      {message && <p aria-live="polite" className="privacy-public-message">{message}</p>}
    </form>}
  </main></>;
}
