import { useCallback, useEffect, useRef, useState } from "react";
import { adminApiOrigin } from "../adminConfig";

const KIND = {
  complaint: "Reklamacja",
  withdrawal: "Odstąpienie od umowy",
  data_recovery: "Odzyskanie danych nieosobowych",
  suspension_appeal: "Odwołanie od zawieszenia",
};
const STATUS = { received: "Przyjęta", in_review: "W analizie", answered: "Odpowiedziana", closed: "Zamknięta" };
const text = (value) => typeof value === "string";
const date = (value) => value === null || (text(value) && !Number.isNaN(new Date(value).getTime()));
const validItem = (value) => Boolean(value
  && text(value.requestId)
  && Object.hasOwn(KIND, value.kind)
  && Object.hasOwn(STATUS, value.status)
  && date(value.receivedAt)
  && date(value.responseDueAt)
  && date(value.answeredAt)
  && date(value.retentionUntil)
  && (value.response === null || text(value.response))
  && typeof value.legalHold === "boolean"
  && Number.isSafeInteger(value.revision)
  && value.revision >= 0);
const validDetails = (value) => validItem(value)
  && text(value.email)
  && (value.narrative === null || text(value.narrative))
  && (value.transactionId === null || text(value.transactionId));

function errorFor(response, payload, write = false) {
  if (response.status === 401 || response.status === 403) return new Error("Brak dostępu administratora. Sprawdź konto i spróbuj ponownie.");
  if (response.status === 404) return new Error("Sprawa nie jest już dostępna. Odśwież kolejkę przed kolejną zmianą.");
  if (response.status === 409) return new Error("Stan sprawy zmienił się na serwerze. Odśwież kolejkę przed kolejną zmianą.");
  if (response.status === 503) return new Error("Doręczenie odpowiedzi jest chwilowo niedostępne. Sprawa nie została zakończona.");
  if (payload?.error?.code === "invalid_request") return new Error("Dane działania są nieprawidłowe. Sprawdź formularz i spróbuj ponownie.");
  return new Error(write ? "Wynik zapisu jest niepewny. Odśwież kolejkę przed kolejną zmianą." : "Nie udało się pobrać kolejki spraw. Spróbuj ponownie.");
}

async function request(user, path, options = {}) {
  const token = await user.getIdToken(options.forceRefresh === true);
  const { forceRefresh: _forceRefresh, ...fetchOptions } = options;
  const response = await fetch(`${adminApiOrigin.replace(/\/$/u, "")}${path}`, {
    ...fetchOptions,
    headers: { authorization: `Bearer ${token}`, ...(options.body ? { "content-type": "application/json" } : {}) },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw errorFor(response, payload, options.method === "PATCH");
  return payload;
}

function TimeValue({ value }) {
  if (!value) return <>—</>;
  const parsed = new Date(value);
  return <time dateTime={parsed.toISOString()}>{parsed.toLocaleString("pl-PL")}</time>;
}

export function LegalRequestsPanel({ user }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  const busyRef = useRef(false);

  const load = useCallback(async (forceRefresh = false) => {
    if (busyRef.current) return;
    const current = ++epoch.current;
    busyRef.current = true;
    setBusy(true); setStatus("Pobieranie spraw…"); setSelected(null); setItems([]);
    try {
      const payload = await request(user, "/v1/admin/legal-requests", { forceRefresh });
      if (epoch.current !== current) return;
      if (!Array.isArray(payload?.requests) || !payload.requests.every(validItem)) throw new Error("Otrzymano nieprawidłową kolejkę spraw.");
      setItems(payload.requests);
      setStatus(payload.requests.length ? `Spraw w kolejce: ${payload.requests.length}` : "Brak spraw w kolejce.");
    } catch (error) { if (epoch.current === current) setStatus(error.message); }
    finally { if (epoch.current === current) { busyRef.current = false; setBusy(false); } }
  }, [user]);

  useEffect(() => { void load(); return () => { epoch.current += 1; busyRef.current = false; }; }, [load]);

  async function open(item) {
    if (busyRef.current) return;
    const current = epoch.current;
    busyRef.current = true;
    setBusy(true); setStatus("Pobieranie szczegółów sprawy…");
    try {
      const payload = await request(user, `/v1/admin/legal-requests/${encodeURIComponent(item.requestId)}`);
      if (epoch.current !== current) return;
      if (!validDetails(payload?.request)) throw new Error("Otrzymano nieprawidłowe szczegóły sprawy.");
      setSelected(payload.request); setResponseText(payload.request.response || ""); setHoldReason(""); setStatus("");
    } catch (error) { if (epoch.current === current) setStatus(error.message); }
    finally { if (epoch.current === current) { busyRef.current = false; setBusy(false); } }
  }

  async function act(action) {
    if (!selected || busyRef.current) return;
    const current = epoch.current;
    busyRef.current = true;
    setBusy(true); setStatus("Zapisywanie…");
    try {
      const payload = await request(user, `/v1/admin/legal-requests/${encodeURIComponent(selected.requestId)}`, {
        method: "PATCH", body: JSON.stringify({ ...action, expectedRevision: selected.revision }),
      });
      if (epoch.current !== current) return;
      if (!validItem(payload?.request)) throw new Error("Serwer nie potwierdził zmiany sprawy.");
      setSelected((details) => details ? { ...details, ...payload.request } : payload.request); setResponseText(payload.request.response || ""); setHoldReason("");
      setItems((currentItems) => currentItems.map((item) => item.requestId === payload.request.requestId ? payload.request : item));
      setStatus("Zmiana została zapisana.");
    } catch (error) { if (epoch.current === current) setStatus(error.message); }
    finally { if (epoch.current === current) { busyRef.current = false; setBusy(false); } }
  }

  return <section className="admin-queue admin-legal-queue" aria-labelledby="legal-queue-title">
    <div className="section-heading"><p className="eyebrow">SPRAWY KONSUMENCKIE</p><h2 id="legal-queue-title">Kolejka spraw</h2><p>Reklamacje, odstąpienia, odzyskanie danych nieosobowych i odwołania od zawieszenia.</p></div>
    <button className="button button-secondary admin-refresh" disabled={busy} onClick={() => load(true)} type="button">Odśwież sprawy</button>
    {status && <div className="admin-status" role="status">{status}</div>}
    <div className="admin-report-list">{items.map((item) => <article className="admin-report admin-legal-list-item" key={item.requestId}>
      <h3>{KIND[item.kind]} · {STATUS[item.status]}</h3>
      <dl><div><dt>Identyfikator</dt><dd>{item.requestId}</dd></div><div><dt>Przyjęto</dt><dd><TimeValue value={item.receivedAt} /></dd></div>{item.responseDueAt && <div><dt>Termin odpowiedzi</dt><dd><TimeValue value={item.responseDueAt} /></dd></div>}</dl>
      <button className="button button-secondary admin-report-action" disabled={busy} onClick={() => open(item)} type="button">Otwórz sprawę</button>
    </article>)}</div>
    {selected && <section className="admin-report admin-legal-detail" role="region" aria-label="Szczegóły sprawy konsumenckiej">
      <div className="admin-panel-heading"><h3>{KIND[selected.kind]} · {STATUS[selected.status]}</h3><button className="admin-text-button" onClick={() => setSelected(null)} type="button">Zamknij szczegóły</button></div>
      <dl><div><dt>Identyfikator</dt><dd>{selected.requestId}</dd></div><div><dt>E-mail klienta</dt><dd>{selected.email}</dd></div><div><dt>Identyfikator transakcji</dt><dd>{selected.transactionId || "Nie podano"}</dd></div><div><dt>Termin odpowiedzi</dt><dd><TimeValue value={selected.responseDueAt} /></dd></div><div><dt>Odpowiedziano</dt><dd><TimeValue value={selected.answeredAt} /></dd></div><div><dt>Retencja do</dt><dd><TimeValue value={selected.retentionUntil} /></dd></div><div><dt>Blokada retencji</dt><dd>{selected.legalHold ? "Aktywna" : "Brak"}</dd></div><div><dt>Rewizja</dt><dd>{selected.revision}</dd></div></dl>
      <div className="admin-privacy-form"><label htmlFor="legal-narrative">Treść zgłoszenia<textarea id="legal-narrative" value={selected.narrative || "Nie podano"} readOnly /></label></div>
      {selected.status === "received" && <div className="admin-action-row"><button className="button button-secondary" disabled={busy} onClick={() => act({ action: "start_review" })} type="button">Rozpocznij analizę</button></div>}
      {["received", "in_review"].includes(selected.status) && <div className="admin-privacy-form"><label htmlFor="legal-response">Odpowiedź dla klienta<textarea disabled={busy} id="legal-response" maxLength={50000} value={responseText} onChange={(event) => setResponseText(event.target.value)} /></label><button className="button button-primary" disabled={busy || !responseText.trim()} onClick={() => act({ action: "answer", response: responseText })} type="button">Wyślij odpowiedź</button></div>}
      {selected.status === "answered" && <div className="admin-action-row"><button className="button button-secondary" disabled={busy} onClick={() => act({ action: "close" })} type="button">Zamknij sprawę</button></div>}
      {selected.response && <div className="admin-privacy-form"><label htmlFor="legal-sent-response">Doręczona odpowiedź<textarea id="legal-sent-response" value={selected.response} readOnly /></label></div>}
      <div className="admin-privacy-form"><label htmlFor="legal-hold-reason">Uzasadnienie blokady retencji<textarea disabled={busy} id="legal-hold-reason" maxLength={1000} value={holdReason} onChange={(event) => setHoldReason(event.target.value)} /></label><div className="admin-action-row">{selected.legalHold ? <button className="button button-secondary" disabled={busy || !holdReason.trim()} onClick={() => act({ action: "set_legal_hold", active: false, reason: holdReason })} type="button">Zwolnij blokadę retencji</button> : <button className="button button-secondary" disabled={busy || !holdReason.trim()} onClick={() => act({ action: "set_legal_hold", active: true, reason: holdReason })} type="button">Ustaw blokadę retencji</button>}</div></div>
    </section>}
  </section>;
}
