import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AdminRequestError,
  clearAdminOperation,
  isAdminMutationBlocked,
  markAdminOperationPending,
  pendingAdminOperations,
  useAdminRequestLifecycle,
} from "../adminRequestLifecycle";

const RIGHT = { access: "Dostęp", rectification: "Sprostowanie", erasure: "Usunięcie", restriction: "Ograniczenie", objection: "Sprzeciw", portability: "Przenoszenie", consent_withdrawal: "Wycofanie zgody" };
const STATUS = { received: "Przyjęty", identity_verification_required: "Weryfikacja", in_review: "W analizie", response_ready: "Odpowiedź gotowa", fulfilled: "Zrealizowany", partially_fulfilled: "Częściowo", refused: "Odmowa", closed: "Zamknięty" };
// These two wire shapes mirror the backend list projection and readAdmin details.
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const nullableString = (value) => value === null || typeof value === "string";
const validDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === (value.includes(".") ? value : value.replace(/Z$/u, ".000Z"));
};
const nullableDate = (value) => value === null || validDate(value);
const validListItem = (value) => isRecord(value)
  && typeof value.requestId === "string" && value.requestId.trim().length > 0
  && typeof value.right === "string" && Object.hasOwn(RIGHT, value.right)
  && typeof value.status === "string" && Object.hasOwn(STATUS, value.status)
  && ["account", "public"].includes(value.channel)
  && (value.outcome === null || ["fulfilled", "partially_fulfilled", "refused"].includes(value.outcome))
  && validDate(value.receivedAt) && validDate(value.deadlineAt)
  && nullableDate(value.deliveredAt) && nullableDate(value.extendedAt)
  && Number.isSafeInteger(value.revision) && value.revision >= 0;
const validDetails = (value, requestId) => validListItem(value) && value.requestId === requestId
  && nullableString(value.narrative) && nullableString(value.reason) && nullableString(value.executionEvidence)
  && Array.isArray(value.reportSubmissionIds) && value.reportSubmissionIds.every((id) => typeof id === "string")
  && nullableDate(value.responseAvailableUntil) && typeof value.subjectVerified === "boolean"
  && (value.extensionNoticeStatus === null || ["available_in_app", "pending", "delivered", "failed"].includes(value.extensionNoticeStatus));

const privacyResource = (requestId) => `privacy:${requestId}`;
const privacyEffect = (action, channel) => action === "extend" && channel === "public"
  ? "public-extension-notice"
  : action === "retry_extension_notice" ? "public-extension-notice"
    : action === "deliver" && channel === "public" ? "public-response-delivery" : action;
const privacyExternal = (action, channel) => (action === "extend" || action === "retry_extension_notice") && channel === "public"
  || action === "deliver" && channel === "public";
const privacyWriteError = (error, external = false) => {
  if (error?.status === 409 && !external) return "Stan sprawy zmienił się. Odśwież dane.";
  if (error?.status === 503 && !external) return "Doręczenie jest chwilowo niedostępne.";
  if (error?.dispatched && external) return "Wynik doręczenia jest niepewny. Odśwież szczegóły i nie ponawiaj działania, dopóki stan nie będzie rozstrzygnięty.";
  if (error?.kind === "timeout" || error?.kind === "fetch") return error?.dispatched
    ? "Wynik zapisu jest niepewny. Odśwież szczegóły przed kolejną zmianą."
    : "Przekroczono czas żądania. Spróbuj ponownie.";
  if (error?.status === 409) return "Stan sprawy zmienił się. Odśwież dane.";
  if (error?.status === 503) return "Doręczenie jest chwilowo niedostępne.";
  return error?.dispatched ? "Wynik zapisu jest niepewny. Odśwież szczegóły przed kolejną zmianą." : "Nie udało się wykonać działania.";
};
const privacyReadError = (error, fallback) => {
  if (!(error instanceof AdminRequestError)) return error?.message || fallback;
  if (error.status === 401 || error.status === 403) return "Brak dostępu administratora. Sprawdź konto i spróbuj ponownie.";
  if (error.kind === "timeout") return "Przekroczono czas pobierania. Odśwież wnioski, aby sprawdzić aktualny stan.";
  if (error.kind === "fetch") return "Nie udało się połączyć z usługą. Sprawdź połączenie i spróbuj ponownie.";
  return "Nie udało się pobrać danych. Spróbuj ponownie.";
};

function resolvePrivacyRead(request, operation) {
  if (operation.action === "deliver") return request.deliveredAt !== null && request.deliveredAt !== undefined
    && ["fulfilled", "partially_fulfilled", "refused", "closed"].includes(request.status);
  if (operation.action === "extend" || operation.action === "retry_extension_notice") {
    if (operation.action === "extend" && operation.channel === "account") return request.revision > operation.beforeRevision
      && request.extendedAt !== null && request.extendedAt !== operation.beforeExtendedAt;
    return request.extensionNoticeStatus === "delivered" || request.extensionNoticeStatus === "available_in_app";
  }
  if (request.revision <= operation.beforeRevision) return false;
  switch (operation.action) {
    case "start_review": return request.status === "in_review";
    case "verify_subject": return request.subjectVerified === true;
    case "require_verification": return request.status === "identity_verification_required";
    case "prepare_response": return false;
    case "execute_export": return request.status === "response_ready" && request.outcome === "fulfilled";
    case "close": return request.status === "closed";
    default: return false;
  }
}

async function reconcilePrivacy(request) {
  for (const operation of pendingAdminOperations("privacy-requests", privacyResource(request.requestId))) {
    if (resolvePrivacyRead(request, operation)) clearAdminOperation(operation);
  }
}

export function PrivacyRequestsPanel({ user }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [responseText, setResponseText] = useState("");
  const epoch = useRef(0);
  const busyRef = useRef(false);
  const lifecycle = useAdminRequestLifecycle(user);

  useLayoutEffect(() => {
    epoch.current += 1; busyRef.current = false;
    setItems([]); setSelected(null); setStatus(""); setBusy(false); setReason(""); setResponseText("");
  }, [user?.uid]);

  const load = useCallback(async () => {
    if (busyRef.current) return;
    const current = ++epoch.current;
    const lease = lifecycle.capture();
    busyRef.current = true;
    setBusy(true); setStatus("Pobieranie wniosków…");
    setItems([]); setSelected(null);
    try {
      const payload = await lifecycle.request("/v1/admin/privacy-requests", {}, lease);
      if (epoch.current !== current || !lifecycle.isCurrent(lease)) return;
      if (!Array.isArray(payload?.requests) || !payload.requests.every(validListItem)) throw new Error("Otrzymano nieprawidłową kolejkę.");
      await Promise.all(payload.requests.map(reconcilePrivacy));
      if (epoch.current !== current || !lifecycle.isCurrent(lease)) return;
      setItems(payload.requests); setStatus(payload.requests.length ? `Wniosków: ${payload.requests.length}` : "Brak wniosków.");
    } catch (error) { if (epoch.current === current && lifecycle.isCurrent(lease)) setStatus(privacyReadError(error, "Nie udało się pobrać wniosków.")); }
    finally { if (epoch.current === current && lifecycle.isCurrent(lease)) { busyRef.current = false; setBusy(false); } }
  }, [user, lifecycle]);

  useEffect(() => { void load(); return () => { epoch.current += 1; busyRef.current = false; }; }, [load]);

  async function open(item) {
    if (busyRef.current) return;
    const current = epoch.current;
    const lease = lifecycle.capture();
    busyRef.current = true;
    setBusy(true); setStatus("Pobieranie szczegółów…");
    setSelected(null);
    try {
      const payload = await lifecycle.request(`/v1/admin/privacy-requests/${encodeURIComponent(item.requestId)}`, {}, lease);
      if (epoch.current !== current || !lifecycle.isCurrent(lease)) return;
      if (!validDetails(payload?.request, item.requestId)) throw new Error("Otrzymano nieprawidłowe szczegóły.");
      await reconcilePrivacy(payload.request);
      if (epoch.current !== current || !lifecycle.isCurrent(lease)) return;
      setSelected(payload.request); setReason(payload.request.reason || ""); setStatus("");
    } catch (error) { if (epoch.current === current && lifecycle.isCurrent(lease)) setStatus(privacyReadError(error, "Nie udało się pobrać szczegółów.")); }
    finally { if (epoch.current === current && lifecycle.isCurrent(lease)) { busyRef.current = false; setBusy(false); } }
  }

  async function act(body) {
    if (!selected || busyRef.current) return;
    if (isAdminMutationBlocked("privacy-requests", privacyResource(selected.requestId))) {
      setStatus("Wynik poprzedniej zmiany jest nadal niepewny. Odśwież szczegóły; nie ponawiaj ani nie zmieniaj tej sprawy do czasu rozstrzygnięcia.");
      return;
    }
    const current = epoch.current;
    const lease = lifecycle.capture();
    const selectedAtStart = selected;
    const external = privacyExternal(body.action, selected.channel);
    busyRef.current = true;
    setBusy(true);
    setStatus("Zapisywanie…");
    const operation = {
      domain: "privacy-requests", resource: privacyResource(selected.requestId), effect: privacyEffect(body.action, selected.channel),
      action: body.action, beforeRevision: selected.revision, external,
      channel: selected.channel, beforeExtendedAt: selected.extendedAt,
    };
    try {
      const payload = await lifecycle.request(`/v1/admin/privacy-requests/${encodeURIComponent(selected.requestId)}`, { method: "PATCH", body: JSON.stringify({ ...body, expectedRevision: selectedAtStart.revision }) }, lease, () => {
        if (isAdminMutationBlocked("privacy-requests", operation.resource)) throw new AdminRequestError("admin_operation_already_pending", { kind: "blocked", dispatched: false });
        operation.key = markAdminOperationPending(operation);
      });
      if (epoch.current !== current || !lifecycle.isCurrent(lease)) return;
      if (!validDetails(payload?.request, selectedAtStart.requestId)) {
        setSelected(null);
        throw new Error("Serwer nie potwierdził zmiany.");
      }
      if (resolvePrivacyRead(payload.request, operation)
        || (body.action === "prepare_response" && payload.request.status === "response_ready"
          && payload.request.outcome === "refused" && payload.request.revision === operation.beforeRevision + 1)) clearAdminOperation(operation);
      if (epoch.current !== current || !lifecycle.isCurrent(lease)) return;
      setSelected(payload.request);
      setItems((current) => current.map((item) => item.requestId === payload.request.requestId ? payload.request : item));
      setStatus(pendingAdminOperations("privacy-requests", privacyResource(selected.requestId)).length
        ? "Serwer nie potwierdził zakończenia działania. Stan pozostaje niepewny; nie ponawiaj go. Odśwież szczegóły później."
        : "Zmiana została zapisana i zarejestrowana w audycie.");
    } catch (error) {
      if (error instanceof AdminRequestError && !external
        && (error.status === 401 || error.status === 403 || (error.status === 400 && error.code === "invalid_request"))) clearAdminOperation(operation);
      if (epoch.current === current && lifecycle.isCurrent(lease)) {
        const unresolved = operation.key && pendingAdminOperations("privacy-requests", operation.resource).some((entry) => entry.key === operation.key);
        setStatus(unresolved
          ? external ? "Wynik doręczenia jest niepewny. Nie ponawiaj działania; odśwież szczegóły i sprawdź dostępny wynik." : "Wynik zapisu jest niepewny. Odśwież szczegóły przed kolejną zmianą."
          : error instanceof AdminRequestError ? privacyWriteError(error, external) : (error.message || "Nie udało się wykonać działania."));
      }
    }
    finally { if (epoch.current === current && lifecycle.isCurrent(lease)) { busyRef.current = false; setBusy(false); } }
  }

  const selectedLocked = selected && isAdminMutationBlocked("privacy-requests", privacyResource(selected.requestId));
  const selectedOperations = selected ? pendingAdminOperations("privacy-requests", privacyResource(selected.requestId)) : [];
  return <section className="admin-queue admin-privacy-queue" aria-labelledby="privacy-queue-title">
    <div className="section-heading"><p className="eyebrow">PRYWATNOŚĆ</p><h2 id="privacy-queue-title">Wnioski dotyczące danych</h2><p>Lista zawiera tylko rodzaj prawa, status i termin. Szczegóły są pobierane i audytowane dopiero po otwarciu.</p></div>
    <button className="button button-secondary admin-refresh" disabled={busy} onClick={load} type="button">Odśwież wnioski</button>
    {status && <div className="admin-status" role="status">{status}</div>}
    {selectedLocked && <p className="admin-note">{selectedOperations.some((operation) => operation.action === "prepare_response")
      ? "Nie można zweryfikować dokładnej odpowiedzi z odczytu serwera, który nie udostępnia jej treści. Nie ponawiaj tej zmiany; wniosek pozostaje zablokowany do czasu bezpośredniego potwierdzenia."
      : selectedOperations.some((operation) => operation.external)
        ? "Wynik wcześniejszego powiadomienia lub doręczenia pozostaje niepewny. Nie ponawiaj go; poczekaj na dokładny wynik końcowy w szczegółach."
        : "Wynik wcześniejszej zmiany pozostaje niepewny. Nie ponawiaj jej; odśwież szczegóły przed kolejną zmianą."}</p>}
    <div className="admin-report-list">{items.map((item) => <article className="admin-report" key={item.requestId}>
      <h3>{RIGHT[item.right]} · {STATUS[item.status]}</h3>
      <dl><div><dt>Identyfikator</dt><dd>{item.requestId}</dd></div><div><dt>Termin</dt><dd>{new Date(item.deadlineAt).toLocaleString("pl-PL")}</dd></div><div><dt>Kanał</dt><dd>{item.channel === "account" ? "Konto" : "Publiczny"}</dd></div></dl>
      <button className="button button-secondary admin-report-action" disabled={busy} onClick={() => open(item)} type="button">Otwórz szczegóły</button>
    </article>)}</div>
    {selected && <div className="admin-report admin-privacy-detail" role="region" aria-label="Szczegóły wniosku">
      <div className="admin-panel-heading"><h3>{RIGHT[selected.right]} · {STATUS[selected.status]}</h3><button className="admin-text-button" onClick={() => setSelected(null)} type="button">Zamknij szczegóły</button></div>
      <dl><div><dt>Opis</dt><dd>{selected.narrative || "Nie podano"}</dd></div><div><dt>Identyfikatory raportów</dt><dd>{selected.reportSubmissionIds?.join(", ") || "Brak"}</dd></div><div><dt>Rewizja</dt><dd>{selected.revision}</dd></div></dl>
      {(selected.status === "received" || selected.status === "identity_verification_required") && (selected.channel === "account" || selected.subjectVerified === true) && <div className="admin-action-row"><button className="button button-secondary" disabled={busy || selectedLocked} onClick={() => act({ action: "start_review" })} type="button">Rozpocznij analizę</button></div>}
      {selected.channel === "public" && (selected.status === "received" || selected.status === "identity_verification_required") && <ActionWithReason label="Potwierdź powiązanie osoby z danymi" reason={reason} setReason={setReason} busy={busy || selectedLocked} onAction={() => act({ action: "verify_subject", reason })} />}
      {selected.status === "received" && <ActionWithReason label="Poproś o dodatkową weryfikację" reason={reason} setReason={setReason} busy={busy || selectedLocked} onAction={() => act({ action: "require_verification", reason })} />}
      {["received", "identity_verification_required", "in_review"].includes(selected.status) && <ActionWithReason label="Przedłuż termin" reason={reason} setReason={setReason} busy={busy || selectedLocked} onAction={() => act({ action: "extend", reason, noticeLocale: "pl" })} />}
      {selected.extensionNoticeStatus === "failed" && <button className="button button-secondary" disabled={busy || selectedLocked} onClick={() => act({ action: "retry_extension_notice" })} type="button">Ponów powiadomienie o przedłużeniu</button>}
      {selected.status === "in_review" && <div className="admin-privacy-form">
        {selected.channel === "account" && ["access", "portability"].includes(selected.right) && <button className="button button-primary" disabled={busy || selectedLocked} onClick={() => act({ action: "execute_export" })} type="button">Wykonaj bezpieczny eksport</button>}
        <p>Pozytywna realizacja wymaga wykonawcy systemowego. Ten formularz służy wyłącznie do zapisania uzasadnionej odmowy.</p>
        <label htmlFor="privacy-reason">Uzasadnienie odmowy</label><textarea disabled={selectedLocked} id="privacy-reason" maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} />
        <label htmlFor="privacy-response">Odpowiedź dla osoby wraz z informacją o prawie do skargi</label><textarea disabled={selectedLocked} id="privacy-response" maxLength={250000} value={responseText} onChange={(event) => setResponseText(event.target.value)} />
        <button className="button button-secondary" disabled={busy || selectedLocked || !reason.trim() || !responseText.trim()} onClick={() => act({ action: "prepare_response", outcome: "refused", reason, response: responseText, executionEvidence: "operator_refusal_decision", complaintInformationIncluded: true })} type="button">Zatwierdź odmowę</button>
      </div>}
      {selected.status === "response_ready" && <button className="button button-primary" disabled={busy || selectedLocked} onClick={() => act({ action: "deliver" })} type="button">Udostępnij odpowiedź</button>}
      {["fulfilled", "partially_fulfilled", "refused"].includes(selected.status) && <button className="button button-secondary" disabled={busy || selectedLocked} onClick={() => act({ action: "close" })} type="button">Zamknij sprawę</button>}
    </div>}
  </section>;
}

function ActionWithReason({ label, reason, setReason, busy, onAction }) {
  return <div className="admin-privacy-form"><label>{label} — uzasadnienie<input maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className="button button-secondary" disabled={busy || !reason.trim()} onClick={onAction} type="button">{label}</button></div>;
}
