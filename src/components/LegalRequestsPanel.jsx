import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AdminRequestError,
  clearAdminOperation,
  isAdminMutationBlocked,
  markAdminOperationPending,
  pendingAdminOperations,
  sha256Text,
  useAdminRequestLifecycle,
} from "../adminRequestLifecycle";

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
  if (response.status === 503) return new Error(write
    ? "Wynik zapisu jest niepewny. Nie ponawiaj działania; odśwież sprawę przed kolejną zmianą."
    : "Usługa jest chwilowo niedostępna. Spróbuj ponownie.");
  if (payload?.error?.code === "invalid_request") return new Error("Dane działania są nieprawidłowe. Sprawdź formularz i spróbuj ponownie.");
  return new Error(write ? "Wynik zapisu jest niepewny. Odśwież kolejkę przed kolejną zmianą." : "Nie udało się pobrać kolejki spraw. Spróbuj ponownie.");
}

const legalResource = (requestId) => `legal:${requestId}`;
const legalError = (error, write = false) => {
  if (write && error?.dispatched && error?.status !== 401 && error?.status !== 403
    && !(error?.status === 400 && error?.code === "invalid_request")
    && !(error?.status === 409 && error?.code === "legal_request_revision_conflict")) {
    return "Wynik zapisu jest niepewny. Nie ponawiaj działania; odśwież sprawę przed kolejną zmianą.";
  }
  if (error?.status !== undefined) return errorFor({ status: error.status }, error.payload, write).message;
  if (error?.kind === "timeout") return error.dispatched && write
    ? "Wynik zapisu jest niepewny. Odśwież sprawę przed kolejną zmianą."
    : "Przekroczono czas żądania. Spróbuj ponownie.";
  if (error?.dispatched && write) return "Wynik zapisu jest niepewny. Odśwież sprawę przed kolejną zmianą.";
  if (error?.kind === "fetch") return write ? "Nie udało się połączyć. Wynik zapisu jest niepewny; odśwież sprawę przed kolejną zmianą." : "Nie udało się połączyć z usługą. Spróbuj ponownie.";
  if (error?.kind === "token") return "Nie udało się potwierdzić konta administratora. Sprawdź konto i spróbuj ponownie.";
  return write ? "Nie udało się wykonać działania." : "Nie udało się pobrać kolejki spraw. Spróbuj ponownie.";
};

async function resolveLegalOperation(item, operation) {
  if (operation.action === "answer") {
    if (!(item.status === "answered" || item.status === "closed") || !item.answeredAt || typeof item.response !== "string") return false;
    try { return await sha256Text(item.response) === operation.responseDigest; } catch { return false; }
  }
  if (item.revision <= operation.beforeRevision) return false;
  switch (operation.action) {
    case "start_review": return item.status === "in_review";
    case "close": return item.status === "closed" && Boolean(item.retentionUntil);
    case "set_legal_hold": return item.legalHold === operation.targetActive;
    default: return false;
  }
}

async function reconcileLegal(item) {
  for (const operation of pendingAdminOperations("legal-requests", legalResource(item.requestId))) {
    if (await resolveLegalOperation(item, operation)) clearAdminOperation(operation);
  }
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
  const lifecycle = useAdminRequestLifecycle(user);

  useLayoutEffect(() => {
    epoch.current += 1; busyRef.current = false;
    setItems([]); setSelected(null); setStatus(""); setBusy(false); setResponseText(""); setHoldReason("");
  }, [user?.uid]);

  const load = useCallback(async (forceRefresh = false) => {
    if (busyRef.current) return;
    const current = ++epoch.current;
    const lease = lifecycle.capture();
    busyRef.current = true;
    setBusy(true); setStatus("Pobieranie spraw…"); setSelected(null); setItems([]);
    try {
      const payload = await lifecycle.request("/v1/admin/legal-requests", { forceRefresh }, lease);
      if (epoch.current !== current || !lifecycle.isCurrent(lease)) return;
      if (!Array.isArray(payload?.requests) || !payload.requests.every(validItem)) throw new Error("Otrzymano nieprawidłową kolejkę spraw.");
      await Promise.all(payload.requests.map(reconcileLegal));
      if (epoch.current !== current || !lifecycle.isCurrent(lease)) return;
      setItems(payload.requests);
      setStatus(payload.requests.length ? `Spraw w kolejce: ${payload.requests.length}` : "Brak spraw w kolejce.");
    } catch (error) { if (epoch.current === current && lifecycle.isCurrent(lease)) setStatus(legalError(error)); }
    finally { if (epoch.current === current && lifecycle.isCurrent(lease)) { busyRef.current = false; setBusy(false); } }
  }, [user, lifecycle]);

  useEffect(() => { void load(); return () => { epoch.current += 1; busyRef.current = false; }; }, [load]);

  async function open(item) {
    if (busyRef.current) return;
    const current = epoch.current;
    const lease = lifecycle.capture();
    busyRef.current = true;
    setBusy(true); setStatus("Pobieranie szczegółów sprawy…");
    try {
      const payload = await lifecycle.request(`/v1/admin/legal-requests/${encodeURIComponent(item.requestId)}`, {}, lease);
      if (epoch.current !== current || !lifecycle.isCurrent(lease)) return;
      if (payload?.request?.requestId !== item.requestId) throw new Error("Serwer zwrócił inną sprawę niż wybrano.");
      if (!validDetails(payload?.request)) throw new Error("Otrzymano nieprawidłowe szczegóły sprawy.");
      await reconcileLegal(payload.request);
      if (epoch.current !== current || !lifecycle.isCurrent(lease)) return;
      setSelected(payload.request); setResponseText(payload.request.response || ""); setHoldReason(""); setStatus("");
    } catch (error) { if (epoch.current === current && lifecycle.isCurrent(lease)) setStatus(legalError(error)); }
    finally { if (epoch.current === current && lifecycle.isCurrent(lease)) { busyRef.current = false; setBusy(false); } }
  }

  async function act(action) {
    if (!selected || busyRef.current) return;
    if (isAdminMutationBlocked("legal-requests", legalResource(selected.requestId))) {
      setStatus("Wynik poprzedniej zmiany jest nadal niepewny. Odśwież sprawę; nie ponawiaj ani nie zmieniaj jej do czasu rozstrzygnięcia.");
      return;
    }
    const current = epoch.current;
    const lease = lifecycle.capture();
    const selectedAtStart = selected;
    busyRef.current = true;
    setBusy(true); setStatus("Sprawdzanie odpowiedzi…");
    let responseDigest;
    if (action.action === "answer") {
      try { responseDigest = await sha256Text(action.response.trim()); }
      catch {
        if (epoch.current === current && lifecycle.isCurrent(lease)) {
          setStatus("Nie można bezpiecznie porównać odpowiedzi w tej przeglądarce. Wysyłanie zostało zablokowane.");
          busyRef.current = false; setBusy(false);
        }
        return;
      }
      if (epoch.current !== current || !lifecycle.isCurrent(lease) || selectedAtStart.requestId !== selected?.requestId
        || selectedAtStart.revision !== selected?.revision) {
        if (epoch.current === current && lifecycle.isCurrent(lease)) { busyRef.current = false; setBusy(false); }
        return;
      }
    }
    const operation = {
      domain: "legal-requests", resource: legalResource(selectedAtStart.requestId), effect: action.action,
      action: action.action, beforeRevision: selectedAtStart.revision,
      ...(action.action === "answer" ? { responseDigest } : {}),
      ...(action.action === "set_legal_hold" ? { targetActive: action.active } : {}),
    };
    setStatus("Zapisywanie…");
    try {
      const payload = await lifecycle.request(`/v1/admin/legal-requests/${encodeURIComponent(selectedAtStart.requestId)}`, {
        method: "PATCH", body: JSON.stringify({ ...action, ...(action.action === "answer" ? { response: action.response.trim() } : {}), expectedRevision: selectedAtStart.revision }),
      }, lease, () => {
        if (isAdminMutationBlocked("legal-requests", operation.resource)) throw new AdminRequestError("admin_operation_already_pending", { kind: "blocked", dispatched: false });
        operation.key = markAdminOperationPending(operation);
      });
      if (epoch.current !== current || !lifecycle.isCurrent(lease)) return;
      if (payload?.request?.requestId !== selectedAtStart.requestId) throw new Error("Serwer zwrócił inną sprawę niż zmieniana.");
      if (!validItem(payload?.request)) throw new Error("Serwer nie potwierdził zmiany sprawy.");
      if (await resolveLegalOperation(payload.request, operation)) clearAdminOperation(operation);
      if (epoch.current !== current || !lifecycle.isCurrent(lease)) return;
      setSelected((details) => details ? { ...details, ...payload.request } : payload.request); setResponseText(payload.request.response || ""); setHoldReason("");
      setItems((currentItems) => currentItems.map((item) => item.requestId === payload.request.requestId ? payload.request : item));
      setStatus(pendingAdminOperations("legal-requests", legalResource(selected.requestId)).length
        ? "Serwer nie potwierdził zakończenia działania. Stan pozostaje niepewny; nie ponawiaj go. Odśwież szczegóły później."
        : "Zmiana została zapisana.");
    } catch (error) {
      const definitiveNoEffect = error?.status === 401 || error?.status === 403 || (error?.status === 400 && error?.code === "invalid_request")
        || (error?.status === 409 && error?.code === "legal_request_revision_conflict");
      if (definitiveNoEffect) clearAdminOperation(operation);
      if (epoch.current === current && lifecycle.isCurrent(lease)) {
        const unresolved = operation.key && pendingAdminOperations("legal-requests", operation.resource).some((entry) => entry.key === operation.key);
        setStatus(unresolved ? "Wynik zapisu jest niepewny. Nie ponawiaj działania; odśwież sprawę przed kolejną zmianą." : legalError(error, true));
      }
    }
    finally { if (epoch.current === current && lifecycle.isCurrent(lease)) { busyRef.current = false; setBusy(false); } }
  }

  const selectedLocked = selected && isAdminMutationBlocked("legal-requests", legalResource(selected.requestId));
  const selectedOperations = selected ? pendingAdminOperations("legal-requests", legalResource(selected.requestId)) : [];

  return <section className="admin-queue admin-legal-queue" aria-labelledby="legal-queue-title">
    <div className="section-heading"><p className="eyebrow">SPRAWY KONSUMENCKIE</p><h2 id="legal-queue-title">Kolejka spraw</h2><p>Reklamacje, odstąpienia, odzyskanie danych nieosobowych i odwołania od zawieszenia.</p></div>
    <button className="button button-secondary admin-refresh" disabled={busy} onClick={() => load(true)} type="button">Odśwież sprawy</button>
    {status && <div className="admin-status" role="status">{status}</div>}
    {selectedLocked && <p className="admin-note">{selectedOperations.some((operation) => operation.action === "answer")
      ? "Odczyt nie potwierdził dokładnej odpowiedzi wysłanej do klienta. Nie ponawiaj odpowiedzi; poczekaj na zgodny wynik końcowy sprawy."
      : "Wynik poprzedniej zmiany pozostaje niepewny. Nie ponawiaj jej; odśwież szczegóły przed kolejną zmianą."}</p>}
    <div className="admin-report-list">{items.map((item) => <article className="admin-report admin-legal-list-item" key={item.requestId}>
      <h3>{KIND[item.kind]} · {STATUS[item.status]}</h3>
      <dl><div><dt>Identyfikator</dt><dd>{item.requestId}</dd></div><div><dt>Przyjęto</dt><dd><TimeValue value={item.receivedAt} /></dd></div>{item.responseDueAt && <div><dt>Termin odpowiedzi</dt><dd><TimeValue value={item.responseDueAt} /></dd></div>}</dl>
      <button className="button button-secondary admin-report-action" disabled={busy} onClick={() => open(item)} type="button">Otwórz sprawę</button>
    </article>)}</div>
    {selected && <section className="admin-report admin-legal-detail" role="region" aria-label="Szczegóły sprawy konsumenckiej">
      <div className="admin-panel-heading"><h3>{KIND[selected.kind]} · {STATUS[selected.status]}</h3><button className="admin-text-button" onClick={() => setSelected(null)} type="button">Zamknij szczegóły</button></div>
      <dl><div><dt>Identyfikator</dt><dd>{selected.requestId}</dd></div><div><dt>E-mail klienta</dt><dd>{selected.email}</dd></div><div><dt>Identyfikator transakcji</dt><dd>{selected.transactionId || "Nie podano"}</dd></div><div><dt>Termin odpowiedzi</dt><dd><TimeValue value={selected.responseDueAt} /></dd></div><div><dt>Odpowiedziano</dt><dd><TimeValue value={selected.answeredAt} /></dd></div><div><dt>Retencja do</dt><dd><TimeValue value={selected.retentionUntil} /></dd></div><div><dt>Blokada retencji</dt><dd>{selected.legalHold ? "Aktywna" : "Brak"}</dd></div><div><dt>Rewizja</dt><dd>{selected.revision}</dd></div></dl>
      <div className="admin-privacy-form"><label htmlFor="legal-narrative">Treść zgłoszenia<textarea id="legal-narrative" value={selected.narrative || "Nie podano"} readOnly /></label></div>
      {selected.status === "received" && <div className="admin-action-row"><button className="button button-secondary" disabled={busy || selectedLocked} onClick={() => act({ action: "start_review" })} type="button">Rozpocznij analizę</button></div>}
      {["received", "in_review"].includes(selected.status) && <div className="admin-privacy-form"><label htmlFor="legal-response">Odpowiedź dla klienta<textarea disabled={busy || selectedLocked} id="legal-response" maxLength={50000} value={responseText} onChange={(event) => setResponseText(event.target.value)} /></label><button className="button button-primary" disabled={busy || selectedLocked || !responseText.trim()} onClick={() => act({ action: "answer", response: responseText })} type="button">Wyślij odpowiedź</button></div>}
      {selected.status === "answered" && <div className="admin-action-row"><button className="button button-secondary" disabled={busy || selectedLocked} onClick={() => act({ action: "close" })} type="button">Zamknij sprawę</button></div>}
      {selected.response && <div className="admin-privacy-form"><label htmlFor="legal-sent-response">Doręczona odpowiedź<textarea id="legal-sent-response" value={selected.response} readOnly /></label></div>}
      <div className="admin-privacy-form"><label htmlFor="legal-hold-reason">Uzasadnienie blokady retencji<textarea disabled={busy || selectedLocked} id="legal-hold-reason" maxLength={1000} value={holdReason} onChange={(event) => setHoldReason(event.target.value)} /></label><div className="admin-action-row">{selected.legalHold ? <button className="button button-secondary" disabled={busy || selectedLocked || !holdReason.trim()} onClick={() => act({ action: "set_legal_hold", active: false, reason: holdReason })} type="button">Zwolnij blokadę retencji</button> : <button className="button button-secondary" disabled={busy || selectedLocked || !holdReason.trim()} onClick={() => act({ action: "set_legal_hold", active: true, reason: holdReason })} type="button">Ustaw blokadę retencji</button>}</div></div>
    </section>}
  </section>;
}
