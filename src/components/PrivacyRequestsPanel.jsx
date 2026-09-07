import { useCallback, useEffect, useRef, useState } from "react";
import { adminApiOrigin } from "../adminConfig";

const RIGHT = { access: "Dostęp", rectification: "Sprostowanie", erasure: "Usunięcie", restriction: "Ograniczenie", objection: "Sprzeciw", portability: "Przenoszenie", consent_withdrawal: "Wycofanie zgody" };
const STATUS = { received: "Przyjęty", identity_verification_required: "Weryfikacja", in_review: "W analizie", response_ready: "Odpowiedź gotowa", fulfilled: "Zrealizowany", partially_fulfilled: "Częściowo", refused: "Odmowa", closed: "Zamknięty" };
const validItem = (value) => value && typeof value.requestId === "string" && RIGHT[value.right] && STATUS[value.status] && Number.isSafeInteger(value.revision);

async function request(user, path, options = {}) {
  const token = await user.getIdToken();
  const response = await fetch(`${adminApiOrigin.replace(/\/$/u, "")}${path}`, { ...options, headers: { authorization: `Bearer ${token}`, ...(options.body ? { "content-type": "application/json" } : {}) } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status === 409 ? "Stan sprawy zmienił się. Odśwież dane." : response.status === 503 ? "Doręczenie jest chwilowo niedostępne." : "Nie udało się wykonać działania.");
  return payload;
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

  const load = useCallback(async () => {
    if (busyRef.current) return;
    const current = ++epoch.current;
    busyRef.current = true;
    setBusy(true); setStatus("Pobieranie wniosków…");
    setItems([]); setSelected(null);
    try {
      const payload = await request(user, "/v1/admin/privacy-requests");
      if (epoch.current !== current) return;
      if (!Array.isArray(payload?.requests) || !payload.requests.every(validItem)) throw new Error("Otrzymano nieprawidłową kolejkę.");
      setItems(payload.requests); setStatus(payload.requests.length ? `Wniosków: ${payload.requests.length}` : "Brak wniosków.");
    } catch (error) { if (epoch.current === current) setStatus(error.message); }
    finally { if (epoch.current === current) { busyRef.current = false; setBusy(false); } }
  }, [user]);

  useEffect(() => { void load(); return () => { epoch.current += 1; busyRef.current = false; }; }, [load]);

  async function open(item) {
    if (busyRef.current) return;
    const current = epoch.current;
    busyRef.current = true;
    setBusy(true); setStatus("Pobieranie szczegółów…");
    try {
      const payload = await request(user, `/v1/admin/privacy-requests/${encodeURIComponent(item.requestId)}`);
      if (epoch.current !== current) return;
      if (!validItem(payload?.request)) throw new Error("Otrzymano nieprawidłowe szczegóły.");
      setSelected(payload.request); setReason(payload.request.reason || ""); setStatus("");
    } catch (error) { if (epoch.current === current) setStatus(error.message); }
    finally { if (epoch.current === current) { busyRef.current = false; setBusy(false); } }
  }

  async function act(body) {
    if (!selected || busyRef.current) return;
    const current = epoch.current;
    busyRef.current = true;
    setBusy(true); setStatus("Zapisywanie…");
    try {
      const payload = await request(user, `/v1/admin/privacy-requests/${encodeURIComponent(selected.requestId)}`, { method: "PATCH", body: JSON.stringify({ ...body, expectedRevision: selected.revision }) });
      if (epoch.current !== current) return;
      if (!validItem(payload?.request)) throw new Error("Serwer nie potwierdził zmiany.");
      setSelected(payload.request);
      setItems((current) => current.map((item) => item.requestId === payload.request.requestId ? payload.request : item));
      setStatus("Zmiana została zapisana i zarejestrowana w audycie.");
    } catch (error) { if (epoch.current === current) setStatus(error.message); }
    finally { if (epoch.current === current) { busyRef.current = false; setBusy(false); } }
  }

  return <section className="admin-queue admin-privacy-queue" aria-labelledby="privacy-queue-title">
    <div className="section-heading"><p className="eyebrow">PRYWATNOŚĆ</p><h2 id="privacy-queue-title">Wnioski dotyczące danych</h2><p>Lista zawiera tylko rodzaj prawa, status i termin. Szczegóły są pobierane i audytowane dopiero po otwarciu.</p></div>
    <button className="button button-secondary admin-refresh" disabled={busy} onClick={load} type="button">Odśwież wnioski</button>
    {status && <div className="admin-status" role="status">{status}</div>}
    <div className="admin-report-list">{items.map((item) => <article className="admin-report" key={item.requestId}>
      <h3>{RIGHT[item.right]} · {STATUS[item.status]}</h3>
      <dl><div><dt>Identyfikator</dt><dd>{item.requestId}</dd></div><div><dt>Termin</dt><dd>{new Date(item.deadlineAt).toLocaleString("pl-PL")}</dd></div><div><dt>Kanał</dt><dd>{item.channel === "account" ? "Konto" : "Publiczny"}</dd></div></dl>
      <button className="button button-secondary admin-report-action" disabled={busy} onClick={() => open(item)} type="button">Otwórz szczegóły</button>
    </article>)}</div>
    {selected && <div className="admin-report admin-privacy-detail" role="region" aria-label="Szczegóły wniosku">
      <div className="admin-panel-heading"><h3>{RIGHT[selected.right]} · {STATUS[selected.status]}</h3><button className="admin-text-button" onClick={() => setSelected(null)} type="button">Zamknij szczegóły</button></div>
      <dl><div><dt>Opis</dt><dd>{selected.narrative || "Nie podano"}</dd></div><div><dt>Identyfikatory raportów</dt><dd>{selected.reportSubmissionIds?.join(", ") || "Brak"}</dd></div><div><dt>Rewizja</dt><dd>{selected.revision}</dd></div></dl>
      {(selected.status === "received" || selected.status === "identity_verification_required") && (selected.channel === "account" || selected.subjectVerified === true) && <div className="admin-action-row"><button className="button button-secondary" disabled={busy} onClick={() => act({ action: "start_review" })} type="button">Rozpocznij analizę</button></div>}
      {selected.channel === "public" && (selected.status === "received" || selected.status === "identity_verification_required") && <ActionWithReason label="Potwierdź powiązanie osoby z danymi" reason={reason} setReason={setReason} busy={busy} onAction={() => act({ action: "verify_subject", reason })} />}
      {selected.status === "received" && <ActionWithReason label="Poproś o dodatkową weryfikację" reason={reason} setReason={setReason} busy={busy} onAction={() => act({ action: "require_verification", reason })} />}
      {["received", "identity_verification_required", "in_review"].includes(selected.status) && <ActionWithReason label="Przedłuż termin" reason={reason} setReason={setReason} busy={busy} onAction={() => act({ action: "extend", reason, noticeLocale: "pl" })} />}
      {selected.extensionNoticeStatus === "failed" && <button className="button button-secondary" disabled={busy} onClick={() => act({ action: "retry_extension_notice" })} type="button">Ponów powiadomienie o przedłużeniu</button>}
      {selected.status === "in_review" && <div className="admin-privacy-form">
        {selected.channel === "account" && ["access", "portability"].includes(selected.right) && <button className="button button-primary" disabled={busy} onClick={() => act({ action: "execute_export" })} type="button">Wykonaj bezpieczny eksport</button>}
        <p>Pozytywna realizacja wymaga wykonawcy systemowego. Ten formularz służy wyłącznie do zapisania uzasadnionej odmowy.</p>
        <label htmlFor="privacy-reason">Uzasadnienie odmowy</label><textarea id="privacy-reason" maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} />
        <label htmlFor="privacy-response">Odpowiedź dla osoby wraz z informacją o prawie do skargi</label><textarea id="privacy-response" maxLength={250000} value={responseText} onChange={(event) => setResponseText(event.target.value)} />
        <button className="button button-secondary" disabled={busy || !reason.trim() || !responseText.trim()} onClick={() => act({ action: "prepare_response", outcome: "refused", reason, response: responseText, executionEvidence: "operator_refusal_decision", complaintInformationIncluded: true })} type="button">Zatwierdź odmowę</button>
      </div>}
      {selected.status === "response_ready" && <button className="button button-primary" disabled={busy} onClick={() => act({ action: "deliver" })} type="button">Udostępnij odpowiedź</button>}
      {["fulfilled", "partially_fulfilled", "refused"].includes(selected.status) && <button className="button button-secondary" disabled={busy} onClick={() => act({ action: "close" })} type="button">Zamknij sprawę</button>}
    </div>}
  </section>;
}

function ActionWithReason({ label, reason, setReason, busy, onAction }) {
  return <div className="admin-privacy-form"><label>{label} — uzasadnienie<input maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className="button button-secondary" disabled={busy || !reason.trim()} onClick={onAction} type="button">{label}</button></div>;
}
