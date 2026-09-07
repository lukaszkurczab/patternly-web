import { useCallback, useEffect, useRef, useState } from "react";
import { adminApiOrigin } from "../adminConfig";

const CLASSIFICATION = {
  triage: "Do oceny",
  breach_confirmed: "Naruszenie potwierdzone",
  not_a_breach: "Brak naruszenia",
};
const DECISION = {
  undecided: "Niepodjęta",
  required: "Wymagane",
  not_required: "Niewymagane",
};
const AUTHORITY_DELIVERY = {
  not_started: "Nie zapisano zgłoszenia",
  submitted: "Zgłoszenie zapisane",
  supplemented: "Uzupełnienie zapisane",
};
const SUBJECT_NOTIFICATION = {
  not_started: "Nieprzygotowane",
  prepared: "Przygotowane",
  pending: "W trakcie wysyłki",
  sent: "Wysłane",
  failed: "Wysyłka nieudana",
  unknown: "Wynik nieznany — wymaga sprawdzenia",
  superseded: "Historyczny wynik — zastąpiony nowszym zawiadomieniem",
};
const NEXT_ACTION = {
  acknowledge_awareness: "Potwierdź świadomość incydentu",
  classify: "Ustal klasyfikację incydentu",
  decide_authority: "Podejmij decyzję dotyczącą UODO",
  prepare_authority_export: "Przygotuj eksport UODO",
  record_authority_submission: "Zapisz ręczny dowód zgłoszenia UODO",
  decide_subject: "Podejmij decyzję dotyczącą osób",
  prepare_subject_notification: "Przygotuj zawiadomienie osób",
  resolve_subject_notification_unknown: "Sprawdź i rozstrzygnij nieznany wynik doręczenia",
  send_subject_notification: "Wyślij zawiadomienie osób",
  close: "Zamknij sprawę po zapisaniu wymaganych dowodów",
  none: "Brak — sprawa zamknięta",
};
const ACTIONS = new Set([
  "acknowledge_awareness",
  "classify",
  "correct_assessment",
  "decide_authority",
  "prepare_authority_export",
  "record_authority_submission",
  "decide_subject",
  "prepare_subject_notification",
  "send_subject_notification",
  "resolve_subject_notification_unknown",
  "reconcile_subject_notifications",
  "set_legal_hold",
  "release_legal_hold",
  "close",
]);
const isText = (value) => typeof value === "string";
const isDateText = (value) => value === null || (typeof value === "string" && !Number.isNaN(new Date(value).getTime()));
const isSafeRevision = (value) => Number.isSafeInteger(value) && value >= 0;
const isDecision = (value) => Object.hasOwn(DECISION, value);
const isClassification = (value) => Object.hasOwn(CLASSIFICATION, value);
const isSubjectNotification = (value) => Object.hasOwn(SUBJECT_NOTIFICATION, value);
const isAuthorityDelivery = (value) => Object.hasOwn(AUTHORITY_DELIVERY, value);
const isNextAction = (value) => Object.hasOwn(NEXT_ACTION, value);
const ASSESSMENT_FIELDS = [
  "details",
  "detectedAt",
  "occurredAt",
  "containedAt",
  "categories",
  "dataSubjectCount",
  "recordCount",
  "specialData",
  "confidentialityImpact",
  "integrityImpact",
  "availabilityImpact",
  "consequences",
  "likelihood",
  "severity",
  "containment",
  "remediation",
  "prevention",
  "postmortem",
];
const ASSESSMENT_LABELS = {
  details: "Opis i ocena",
  detectedAt: "Wykryto",
  occurredAt: "Początek zdarzenia",
  containedAt: "Opanowano",
  categories: "Kategorie danych",
  dataSubjectCount: "Szacowana liczba osób",
  recordCount: "Szacowana liczba rekordów",
  specialData: "Dane szczególnej kategorii",
  confidentialityImpact: "Wpływ na poufność",
  integrityImpact: "Wpływ na integralność",
  availabilityImpact: "Wpływ na dostępność",
  consequences: "Możliwe konsekwencje",
  likelihood: "Prawdopodobieństwo",
  severity: "Dotkliwość",
  containment: "Działania ograniczające",
  remediation: "Działania naprawcze",
  prevention: "Działania zapobiegawcze",
  postmortem: "Podsumowanie po incydencie",
};
const AUDIT_EVENT_LABELS = {
  incident_created: "Utworzono incydent",
  details_read: "Odczytano szczegóły",
  acknowledge_awareness: "Potwierdzono świadomość",
  classify: "Zmieniono klasyfikację",
  correct_assessment: "Skorygowano ocenę",
  decide_authority: "Podjęto decyzję dotyczącą UODO",
  prepare_authority_export: "Przygotowano eksport UODO",
  record_authority_submission: "Zapisano ręczny dowód zgłoszenia UODO",
  decide_subject: "Podjęto decyzję dotyczącą osób",
  prepare_subject_notification: "Przygotowano zawiadomienie osób",
  subject_notification_pending: "Rozpoczęto wysyłkę zawiadomień",
  subject_notification_sent: "Zapisano doręczenie zawiadomienia",
  subject_notification_failed: "Zapisano nieudane doręczenie",
  subject_notification_unknown: "Zapisano nieznany wynik doręczenia",
  reconcile_subject_notifications: "Uzgodniono statusy doręczeń",
  resolve_subject_notification_unknown: "Wyjaśniono nieznany wynik doręczenia",
  set_legal_hold: "Ustawiono blokadę retencji",
  release_legal_hold: "Zwolniono blokadę retencji",
  close: "Zamknięto sprawę",
  authority_export_read: "Odczytano eksport UODO",
};

const validAssessment = (value) => Boolean(
  value
    && typeof value === "object"
    && isText(value.details)
    && typeof value.detectedAt === "string"
    && !Number.isNaN(new Date(value.detectedAt).getTime())
    && (value.occurredAt === undefined || value.occurredAt === null || (typeof value.occurredAt === "string" && !Number.isNaN(new Date(value.occurredAt).getTime())))
    && (value.containedAt === undefined || value.containedAt === null || (typeof value.containedAt === "string" && !Number.isNaN(new Date(value.containedAt).getTime())))
    && isText(value.categories)
    && isText(value.dataSubjectCount)
    && isText(value.recordCount)
    && typeof value.specialData === "boolean"
    && isText(value.confidentialityImpact)
    && isText(value.integrityImpact)
    && isText(value.availabilityImpact)
    && isText(value.consequences)
    && isText(value.likelihood)
    && isText(value.severity)
    && isText(value.containment)
    && isText(value.remediation)
    && isText(value.prevention)
    && isText(value.postmortem),
);

const validListItem = (value) => Boolean(
  value
    && typeof value.incidentId === "string"
    && isClassification(value.classification)
    && isDecision(value.authorityDecision)
    && isAuthorityDelivery(value.authorityDeliveryStatus)
    && isDecision(value.subjectDecision)
    && isSubjectNotification(value.subjectNotificationStatus)
    && isNextAction(value.nextAction)
    && isDateText(value.awarenessAt)
    && isDateText(value.authorityDeadlineAt)
    && isDateText(value.closedAt)
    && isSafeRevision(value.revision)
    && typeof value.legalHold === "boolean",
);

const validDetails = (value) => Boolean(
  validListItem(value)
    && isText(value.title)
    && isText(value.details)
    && validAssessment(value.assessment)
    && value.details === value.assessment.details
    && Number.isSafeInteger(value.assessmentVersion)
    && value.assessmentVersion > 0
    && typeof value.createdAt === "string"
    && !Number.isNaN(new Date(value.createdAt).getTime())
    && typeof value.updatedAt === "string"
    && !Number.isNaN(new Date(value.updatedAt).getTime())
    && (value.authorityReason === null || isText(value.authorityReason))
    && (value.subjectReason === null || isText(value.subjectReason))
    && (value.authoritySubmissionReference === null || isText(value.authoritySubmissionReference))
    && Array.isArray(value.preparedRecipients)
    && value.preparedRecipients.every((recipient) => isText(recipient?.recipientPseudonym) && Number.isSafeInteger(recipient?.snapshotVersion) && recipient.snapshotVersion > 0)
    && Array.isArray(value.subjectNotifications)
    && value.subjectNotifications.every((notification) => isText(notification?.recipientPseudonym)
      && Number.isSafeInteger(notification?.snapshotVersion)
      && notification.snapshotVersion > 0
      && ["pending", "sent", "failed", "unknown", "superseded"].includes(notification?.status)
      && typeof notification?.deliveryId === "string")
    && Array.isArray(value.auditHistory)
    && value.auditHistory.every((entry) => isText(entry?.event)
      && isText(entry?.actorPseudonym)
      && typeof entry?.at === "string"
      && (entry.revision === null || isSafeRevision(entry.revision))
      && (entry.assessmentVersion === null || (Number.isSafeInteger(entry.assessmentVersion) && entry.assessmentVersion > 0))
      && (entry.snapshot === null || (typeof entry.snapshot === "object" && !Array.isArray(entry.snapshot))))
    && (value.authorityExportVersion === null || (Number.isSafeInteger(value.authorityExportVersion) && value.authorityExportVersion > 0)),
);

const LIST_ITEM_FIELDS = [
  "incidentId",
  "classification",
  "authorityDecision",
  "authorityDeliveryStatus",
  "subjectDecision",
  "subjectNotificationStatus",
  "awarenessAt",
  "authorityDeadlineAt",
  "closedAt",
  "revision",
  "legalHold",
  "nextAction",
];
const toListItem = (value) => Object.fromEntries(LIST_ITEM_FIELDS.map((field) => [field, value?.[field]]));

function errorFor(response, payload, writing = false) {
  const error = new Error(
    response.status === 401 || response.status === 403
      ? "Brak dostępu administratora. Sprawdź konto i spróbuj ponownie."
      : response.status === 404
        ? "Incydent nie jest już dostępny. Odśwież listę przed kolejną zmianą."
        : response.status === 409
          ? "Stan incydentu zmienił się na serwerze. Odśwież listę przed kolejną zmianą."
          : response.status === 503
            ? "Nie można wysłać zawiadomienia. Sprawdź konfigurację SMTP i odśwież listę."
            : writing
              ? "Wynik zapisu jest niepewny. Odśwież listę przed kolejną zmianą."
              : "Nie udało się pobrać incydentów. Spróbuj ponownie.",
  );
  error.status = response.status;
  error.code = payload?.error?.code;
  return error;
}

async function request(user, path, options = {}) {
  const token = await user.getIdToken(options.forceRefresh === true);
  const { forceRefresh: _forceRefresh, ...fetchOptions } = options;
  const response = await fetch(`${adminApiOrigin.replace(/\/$/u, "")}${path}`, {
    ...fetchOptions,
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw errorFor(response, payload, options.method === "PATCH" || options.method === "POST");
  return payload;
}

function TimeValue({ value }) {
  if (!value) return <span>Nie zarejestrowano</span>;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span>Nieprawidłowa data</span>;
  return <time dateTime={date.toISOString()}>{date.toLocaleString("pl-PL")}</time>;
}

function deadlineState(value) {
  if (!value) return { label: "Nie rozpoczęto pomiaru", overdue: false };
  const deadline = new Date(value).getTime();
  const difference = deadline - Date.now();
  if (!Number.isFinite(deadline)) return { label: "Nieprawidłowy termin", overdue: false };
  if (difference <= 0) return { label: "Po terminie 72 godzin", overdue: true };
  const hours = Math.floor(difference / 3_600_000);
  const minutes = Math.floor((difference % 3_600_000) / 60_000);
  return { label: `Pozostało około ${hours} godz. ${minutes} min.`, overdue: false };
}

function LabelValue({ label, children }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

function IncidentListItem({ item, disabled, onOpen }) {
  const deadline = deadlineState(item.authorityDeadlineAt);
  return <article className="admin-report security-incident-list-item">
    <h3>{CLASSIFICATION[item.classification]}</h3>
    <dl>
      <LabelValue label="Termin 72 godzin"><span className={deadline.overdue ? "admin-incident-overdue" : ""}>{deadline.label}</span>{item.authorityDeadlineAt && <><span> · </span><TimeValue value={item.authorityDeadlineAt} /></>}</LabelValue>
      <LabelValue label="Najpilniejsze działanie">{NEXT_ACTION[item.nextAction]}</LabelValue>
    </dl>
    <button className="button button-secondary admin-report-action" disabled={disabled} onClick={() => onOpen(item)} type="button">Otwórz szczegóły</button>
  </article>;
}

function ActionForm({ label, children, buttonLabel, busy, disabled, onSubmit }) {
  return <form className="admin-privacy-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
    <fieldset disabled={busy || disabled}>
      <legend>{label}</legend>
      {children}
      <button className="button button-secondary" type="submit">{busy ? "Zapisywanie…" : buttonLabel}</button>
    </fieldset>
  </form>;
}

const emptyAssessment = () => ({
  details: "",
  detectedAt: "",
  occurredAt: "",
  containedAt: "",
  categories: "",
  dataSubjectCount: "",
  recordCount: "",
  specialData: false,
  confidentialityImpact: "",
  integrityImpact: "",
  availabilityImpact: "",
  consequences: "",
  likelihood: "",
  severity: "",
  containment: "",
  remediation: "",
  prevention: "",
  postmortem: "",
});
function readAssessment(selected) {
  const source = selected.assessment;
  return ASSESSMENT_FIELDS.reduce((assessment, field) => {
    const value = source[field];
    if (value !== undefined && value !== null) assessment[field] = value;
    return assessment;
  }, { ...emptyAssessment(), details: selected.details });
}
function assessmentForDisplay(selected) {
  const assessment = readAssessment(selected);
  return assessment;
}
function localDateTimeValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function assessmentDraft(selected) {
  const assessment = readAssessment(selected);
  return {
    ...assessment,
    detectedAt: localDateTimeValue(assessment.detectedAt),
    occurredAt: localDateTimeValue(assessment.occurredAt),
    containedAt: localDateTimeValue(assessment.containedAt),
    specialData: assessment.specialData === true,
  };
}
const dateTimeValue = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
};
const serializeAssessment = (value) => ({
  details: value.details.trim(),
  detectedAt: dateTimeValue(value.detectedAt),
  ...(value.occurredAt ? { occurredAt: dateTimeValue(value.occurredAt) } : {}),
  ...(value.containedAt ? { containedAt: dateTimeValue(value.containedAt) } : {}),
  categories: value.categories.trim(),
  dataSubjectCount: value.dataSubjectCount.trim(),
  recordCount: value.recordCount.trim(),
  specialData: value.specialData === true,
  confidentialityImpact: value.confidentialityImpact.trim(),
  integrityImpact: value.integrityImpact.trim(),
  availabilityImpact: value.availabilityImpact.trim(),
  consequences: value.consequences.trim(),
  likelihood: value.likelihood.trim(),
  severity: value.severity.trim(),
  containment: value.containment.trim(),
  remediation: value.remediation.trim(),
  prevention: value.prevention.trim(),
  postmortem: value.postmortem.trim(),
});

function AssessmentFields({ value, setValue, idPrefix }) {
  const update = (field) => (event) => setValue((current) => ({ ...current, [field]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const id = (field) => `${idPrefix}-${field}`;
  return <>
    <label htmlFor={id("details")}>Opis i ocena<textarea id={id("details")} maxLength={50_000} value={value.details} onChange={update("details")} required /></label>
    <label htmlFor={id("detectedAt")}>Wykryto (data i czas)<input id={id("detectedAt")} type="datetime-local" value={value.detectedAt} onChange={update("detectedAt")} required /></label>
    <label htmlFor={id("occurredAt")}>Zdarzenie rozpoczęło się (opcjonalnie)<input id={id("occurredAt")} type="datetime-local" value={value.occurredAt} onChange={update("occurredAt")} /></label>
    <label htmlFor={id("containedAt")}>Opanowano (data i czas, opcjonalnie)<input id={id("containedAt")} type="datetime-local" value={value.containedAt} onChange={update("containedAt")} /></label>
    <label htmlFor={id("categories")}>Kategorie danych<textarea id={id("categories")} maxLength={4_000} value={value.categories} onChange={update("categories")} required /></label>
    <label htmlFor={id("dataSubjectCount")}>Szacowana liczba osób<input id={id("dataSubjectCount")} maxLength={256} value={value.dataSubjectCount} onChange={update("dataSubjectCount")} required /></label>
    <label htmlFor={id("recordCount")}>Szacowana liczba rekordów<input id={id("recordCount")} maxLength={256} value={value.recordCount} onChange={update("recordCount")} required /></label>
    <label className="admin-checkbox" htmlFor={id("specialData")}><input id={id("specialData")} type="checkbox" checked={value.specialData} onChange={update("specialData")} /> Obejmuje dane szczególnej kategorii</label>
    <label htmlFor={id("confidentialityImpact")}>Wpływ na poufność<textarea id={id("confidentialityImpact")} maxLength={2_000} value={value.confidentialityImpact} onChange={update("confidentialityImpact")} required /></label>
    <label htmlFor={id("integrityImpact")}>Wpływ na integralność<textarea id={id("integrityImpact")} maxLength={2_000} value={value.integrityImpact} onChange={update("integrityImpact")} required /></label>
    <label htmlFor={id("availabilityImpact")}>Wpływ na dostępność<textarea id={id("availabilityImpact")} maxLength={2_000} value={value.availabilityImpact} onChange={update("availabilityImpact")} required /></label>
    <label htmlFor={id("consequences")}>Możliwe konsekwencje<textarea id={id("consequences")} maxLength={8_000} value={value.consequences} onChange={update("consequences")} required /></label>
    <label htmlFor={id("likelihood")}>Prawdopodobieństwo<textarea id={id("likelihood")} maxLength={1_000} value={value.likelihood} onChange={update("likelihood")} required /></label>
    <label htmlFor={id("severity")}>Dotkliwość<textarea id={id("severity")} maxLength={1_000} value={value.severity} onChange={update("severity")} required /></label>
    <label htmlFor={id("containment")}>Działania ograniczające<textarea id={id("containment")} maxLength={8_000} value={value.containment} onChange={update("containment")} required /></label>
    <label htmlFor={id("remediation")}>Działania naprawcze<textarea id={id("remediation")} maxLength={8_000} value={value.remediation} onChange={update("remediation")} required /></label>
    <label htmlFor={id("prevention")}>Działania zapobiegawcze<textarea id={id("prevention")} maxLength={8_000} value={value.prevention} onChange={update("prevention")} required /></label>
    <label htmlFor={id("postmortem")}>Podsumowanie po incydencie<textarea id={id("postmortem")} maxLength={8_000} value={value.postmortem} onChange={update("postmortem")} required /></label>
  </>;
}

function DecisionForm({ label, value, setValue, reason, setReason, legalException, setLegalException, busy, disabled, onSubmit }) {
  return <ActionForm label={label} buttonLabel="Zapisz decyzję" busy={busy} disabled={disabled} onSubmit={onSubmit}>
    <label>Decyzja<select value={value} onChange={(event) => setValue(event.target.value)} required>
      <option value="required">Wymagane</option>
      <option value="not_required">Niewymagane</option>
    </select></label>
    <label>Uzasadnienie<textarea maxLength={4_000} value={reason} onChange={(event) => setReason(event.target.value)} required /></label>
    <label>Wyjątek prawny, jeśli decyzja brzmi „niewymagane”<textarea maxLength={4_000} value={legalException} onChange={(event) => setLegalException(event.target.value)} /></label>
  </ActionForm>;
}

function SubjectNotificationForms({ selected, busy, disabled, act }) {
  const [recipients, setRecipients] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [resolution, setResolution] = useState({});
  const prepared = selected.preparedRecipients;
  const snapshotVersion = prepared[0]?.snapshotVersion;
  const recipientList = recipients.split(/[\n,;]/u).map((value) => value.trim()).filter(Boolean);
  const unknowns = selected.subjectNotifications.filter((notification) => notification.status === "unknown");
  return <>
    {(selected.subjectNotificationStatus === "not_started" || selected.subjectNotificationStatus === "failed") && <ActionForm label="Przygotuj zawiadomienie osób" buttonLabel="Przygotuj zawiadomienie" busy={busy} disabled={disabled} onSubmit={() => act({ action: "prepare_subject_notification", recipients: recipientList, subject, text })}>
      <label>Adresy odbiorców — nie będą ponownie wyświetlane<textarea maxLength={500 * 321} value={recipients} onChange={(event) => setRecipients(event.target.value)} required /></label>
      <label>Temat<textarea maxLength={300} value={subject} onChange={(event) => setSubject(event.target.value)} required /></label>
      <label>Treść zawiadomienia<textarea maxLength={50_000} value={text} onChange={(event) => setText(event.target.value)} required /></label>
    </ActionForm>}
    {prepared.length > 0 && snapshotVersion && <section className="admin-incident-operation" aria-labelledby="incident-send-title">
      <h4 id="incident-send-title">Zawiadomienie osób</h4>
      <p>Adresy są przechowywane po stronie serwera i nie są ponownie wyświetlane. Wyślij tylko po sprawdzeniu zamrożonej treści.</p>
      <div className="admin-action-row">{prepared.map((recipient, index) => {
        const notification = selected.subjectNotifications.find((entry) => entry.recipientPseudonym === recipient.recipientPseudonym && entry.snapshotVersion === recipient.snapshotVersion);
        const done = notification && ["sent", "failed", "unknown", "superseded"].includes(notification.status);
        return <button className="button button-secondary" key={`${recipient.recipientPseudonym}-${recipient.snapshotVersion}`} disabled={busy || disabled || done} onClick={() => act({ action: "send_subject_notification", recipientPseudonym: recipient.recipientPseudonym, snapshotVersion: recipient.snapshotVersion })} type="button">{done ? `Adresat ${index + 1}: ${SUBJECT_NOTIFICATION[notification.status]}` : `Wyślij zawiadomienie — adresat ${index + 1}`}</button>;
      })}</div>
    </section>}
    {unknowns.map((notification, index) => {
      const value = resolution[notification.deliveryId] || { outcome: "sent", reason: "" };
      return <ActionForm key={notification.deliveryId} label={`Wyjaśnij nieznany wynik doręczenia ${index + 1}`} buttonLabel="Zapisz wynik" busy={busy} disabled={disabled} onSubmit={() => act({ action: "resolve_subject_notification_unknown", deliveryId: notification.deliveryId, outcome: value.outcome, reason: value.reason })}>
        <p>System nie potwierdził wyniku wysyłki. Wymagana jest ręczna weryfikacja.</p>
        <label>Potwierdzony wynik<select value={value.outcome} onChange={(event) => setResolution((current) => ({ ...current, [notification.deliveryId]: { ...value, outcome: event.target.value } }))}><option value="sent">Doręczono</option><option value="failed">Nie doręczono</option></select></label>
        <label>Uzasadnienie<textarea maxLength={4_000} value={value.reason} onChange={(event) => setResolution((current) => ({ ...current, [notification.deliveryId]: { ...value, reason: event.target.value } }))} required /></label>
      </ActionForm>;
    })}
    {selected.subjectNotifications.some((notification) => notification.status === "superseded") && <section className="admin-incident-operation" aria-labelledby="incident-history-notifications-title">
      <h4 id="incident-history-notifications-title">Historyczne wyniki doręczeń</h4>
      <p>Te próby dotyczą wcześniejszej wersji zawiadomienia i są nieaktywne.</p>
      <ul className="admin-incident-history-notifications">{selected.subjectNotifications.filter((notification) => notification.status === "superseded").map((notification, index) => <li key={notification.deliveryId}>Adresat {index + 1} · wersja {notification.snapshotVersion}: {SUBJECT_NOTIFICATION.superseded}</li>)}</ul>
    </section>}
  </>;
}

function AssessmentSummary({ selected }) {
  const assessment = assessmentForDisplay(selected);
  return <dl className="admin-incident-assessment-summary">
    {ASSESSMENT_FIELDS.map((field) => {
      const value = assessment[field];
      if (value === undefined || value === null || value === "") return null;
      return <LabelValue key={field} label={ASSESSMENT_LABELS[field]}>
        {field === "detectedAt" || field === "occurredAt" || field === "containedAt"
          ? <TimeValue value={value} />
          : field === "specialData" ? (value === true ? "Tak" : "Nie") : String(value)}
      </LabelValue>;
    })}
    <LabelValue label="Wersja oceny">{selected.assessmentVersion}</LabelValue>
  </dl>;
}

function AuditHistory({ entries }) {
  if (!entries.length) return <p>Brak zarejestrowanych zdarzeń.</p>;
  return <ol className="admin-incident-history">
    {entries.map((entry, index) => {
      const snapshot = entry.snapshot || {};
      return <li key={`${entry.at}-${entry.event}-${index}`}>
        <strong>{AUDIT_EVENT_LABELS[entry.event] || entry.event}</strong>
        <TimeValue value={entry.at} />
        <dl>
          {entry.revision !== null && <LabelValue label="Rewizja">{entry.revision}</LabelValue>}
          {entry.assessmentVersion !== null && <LabelValue label="Wersja oceny">{entry.assessmentVersion}</LabelValue>}
          {isClassification(snapshot.classification) && <LabelValue label="Klasyfikacja">{CLASSIFICATION[snapshot.classification]}</LabelValue>}
          {isDecision(snapshot.authorityDecision) && <LabelValue label="Decyzja UODO">{DECISION[snapshot.authorityDecision]}</LabelValue>}
          {isDecision(snapshot.subjectDecision) && <LabelValue label="Decyzja wobec osób">{DECISION[snapshot.subjectDecision]}</LabelValue>}
        </dl>
      </li>;
    })}
  </ol>;
}

function isAuthorityExport(value, version) {
  const keys = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : [];
  return Boolean(
    keys.length === 3
      && keys.every((key) => ["payload", "digest", "version"].includes(key))
      && typeof value.payload === "string"
      && value.payload.length > 0
      && typeof value.digest === "string"
      && /^[A-Za-z0-9_-]{43}$/u.test(value.digest)
      && Number.isSafeInteger(value.version)
      && value.version > 0
      && value.version === version,
  );
}

function IncidentDetails({ selected, busy, disabled, act, onClose, user }) {
  const [classification, setClassification] = useState(selected.classification);
  const [classificationReason, setClassificationReason] = useState("");
  const [authorityDecision, setAuthorityDecision] = useState(selected.authorityDecision === "undecided" ? "required" : selected.authorityDecision);
  const [authorityReason, setAuthorityReason] = useState("");
  const [authorityException, setAuthorityException] = useState("");
  const [authorityPayload, setAuthorityPayload] = useState("");
  const [submission, setSubmission] = useState({ channel: "UODO portal", reference: "", evidence: "", supplementary: false });
  const [subjectDecision, setSubjectDecision] = useState(selected.subjectDecision === "undecided" ? "required" : selected.subjectDecision);
  const [subjectDecisionReason, setSubjectDecisionReason] = useState("");
  const [subjectException, setSubjectException] = useState("");
  const [assessment, setAssessment] = useState(() => assessmentDraft(selected));
  const [assessmentReason, setAssessmentReason] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const detailRef = useRef(null);

  useEffect(() => {
    detailRef.current?.focus();
  }, [selected.incidentId, selected.revision]);

  async function downloadExport() {
    const version = selected.authorityExportVersion;
    if (exportBusy || !Number.isSafeInteger(version) || version < 1) return;
    setExportBusy(true);
    setExportStatus("Pobieranie eksportu…");
    try {
      const exported = await request(user, `/v1/admin/security-incidents/${encodeURIComponent(selected.incidentId)}/authority-exports/${version}`);
      if (!isAuthorityExport(exported, version)) throw new Error("Serwer nie potwierdził dokładnej wersji eksportu.");
      const blob = new Blob([exported.payload], { type: "application/json;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      try {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = `patternly-security-incident-${selected.incidentId}-authority-export-v${version}.json`;
        link.rel = "noopener";
        link.click();
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
      setExportStatus(`Pobrano dokładny eksport UODO, wersja ${version}.`);
    } catch (error) {
      setExportStatus(error.message || "Nie udało się pobrać eksportu.");
    } finally {
      setExportBusy(false);
    }
  }

  return <div className="admin-report admin-privacy-detail security-incident-detail" ref={detailRef} role="region" aria-label="Szczegóły incydentu" tabIndex={-1}>
    <div className="admin-panel-heading"><div><p className="eyebrow">SZCZEGÓŁY INCYDENTU</p><h3>{selected.title}</h3></div><button className="admin-text-button" onClick={onClose} type="button">Zamknij szczegóły</button></div>
    <section className="admin-incident-operation" aria-labelledby="incident-times-title">
      <h4 id="incident-times-title">Czasy</h4>
      <dl>
        {selected.createdAt && <LabelValue label="Utworzono"><TimeValue value={selected.createdAt} /></LabelValue>}
        <LabelValue label="Świadomość"><TimeValue value={selected.awarenessAt} /></LabelValue>
        <LabelValue label="Termin 72 godzin"><TimeValue value={selected.authorityDeadlineAt} /></LabelValue>
        {selected.updatedAt && <LabelValue label="Zaktualizowano"><TimeValue value={selected.updatedAt} /></LabelValue>}
        <LabelValue label="Zamknięto"><TimeValue value={selected.closedAt} /></LabelValue>
      </dl>
    </section>
    <details className="admin-incident-disclosure"><summary>Opis i ocena — wersja {selected.assessmentVersion}</summary>
      <AssessmentSummary selected={selected} />
      <ActionForm label="Korekta oceny" buttonLabel="Zapisz nową wersję oceny" busy={busy} disabled={disabled || Boolean(selected.closedAt)} onSubmit={() => act({ action: "correct_assessment", reason: assessmentReason, ...serializeAssessment(assessment) })}>
        <AssessmentFields value={assessment} setValue={setAssessment} idPrefix="incident-assessment" />
        <label>Uzasadnienie korekty<textarea maxLength={4_000} value={assessmentReason} onChange={(event) => setAssessmentReason(event.target.value)} required /></label>
      </ActionForm>
    </details>
    <section className="admin-incident-operation" aria-labelledby="incident-decisions-title">
      <h4 id="incident-decisions-title">Decyzje</h4>
      <p>Każda decyzja prawna wymaga jawnego uzasadnienia operatora.</p>
      <ActionForm label="Klasyfikacja" buttonLabel="Zapisz klasyfikację" busy={busy} disabled={disabled || Boolean(selected.closedAt)} onSubmit={() => act({ action: "classify", classification, reason: classificationReason })}>
        <label>Klasyfikacja<select value={classification} onChange={(event) => setClassification(event.target.value)}><option value="triage">Do oceny</option><option value="breach_confirmed">Naruszenie potwierdzone</option><option value="not_a_breach">Brak naruszenia</option></select></label>
        <label>Uzasadnienie<textarea maxLength={4_000} value={classificationReason} onChange={(event) => setClassificationReason(event.target.value)} required /></label>
      </ActionForm>
      <div className="admin-incident-status-grid"><p>Decyzja UODO: <strong>{DECISION[selected.authorityDecision]}</strong>{selected.authorityReason && <><br />Uzasadnienie: {selected.authorityReason}</>}</p><p>Decyzja wobec osób: <strong>{DECISION[selected.subjectDecision]}</strong>{selected.subjectReason && <><br />Uzasadnienie: {selected.subjectReason}</>}</p></div>
      <DecisionForm label="Decyzja dotycząca UODO" value={authorityDecision} setValue={setAuthorityDecision} reason={authorityReason} setReason={setAuthorityReason} legalException={authorityException} setLegalException={setAuthorityException} busy={busy} disabled={disabled || Boolean(selected.closedAt)} onSubmit={() => act({ action: "decide_authority", decision: authorityDecision, reason: authorityReason, ...(authorityException.trim() ? { legalException: authorityException } : {}) })} />
      <DecisionForm label="Decyzja dotycząca osób" value={subjectDecision} setValue={setSubjectDecision} reason={subjectDecisionReason} setReason={setSubjectDecisionReason} legalException={subjectException} setLegalException={setSubjectException} busy={busy} disabled={disabled || Boolean(selected.closedAt)} onSubmit={() => act({ action: "decide_subject", decision: subjectDecision, reason: subjectDecisionReason, ...(subjectException.trim() ? { legalException: subjectException } : {}) })} />
    </section>
    <details className="admin-incident-disclosure"><summary>Eksport i ręczny dowód dla UODO</summary>
      <p className="admin-note">System nie wysyła zgłoszeń do UODO. Zapisuje wyłącznie ręczny dowód.</p>
      <p>Stan ręcznego zgłoszenia: <strong>{AUTHORITY_DELIVERY[selected.authorityDeliveryStatus]}</strong></p>
      {selected.authorityDecision === "required" ? <>
        <ActionForm label="Przygotuj eksport" buttonLabel="Przygotuj eksport UODO" busy={busy} disabled={disabled || Boolean(selected.closedAt)} onSubmit={() => act({ action: "prepare_authority_export", payload: authorityPayload })}>
          <label>Treść eksportu do skopiowania do kanału UODO<textarea maxLength={100_000} value={authorityPayload} onChange={(event) => setAuthorityPayload(event.target.value)} required /></label>
        </ActionForm>
        <ActionForm label="Zapisz ręczny dowód zgłoszenia" buttonLabel={submission.supplementary ? "Zapisz uzupełnienie" : "Zapisz zgłoszenie"} busy={busy} disabled={disabled || Boolean(selected.closedAt)} onSubmit={() => act({ action: "record_authority_submission", ...submission })}>
          <label>Kanał zgłoszenia<input maxLength={128} value={submission.channel} onChange={(event) => setSubmission((current) => ({ ...current, channel: event.target.value }))} required /></label>
          <label>Referencja zgłoszenia<input maxLength={512} value={submission.reference} onChange={(event) => setSubmission((current) => ({ ...current, reference: event.target.value }))} required /></label>
          <label>Dowód zgłoszenia<textarea maxLength={20_000} value={submission.evidence} onChange={(event) => setSubmission((current) => ({ ...current, evidence: event.target.value }))} required /></label>
          <label>Powód opóźnienia, jeśli termin 72 godzin minął (opcjonalnie)<textarea maxLength={4_000} value={submission.delayReason || ""} onChange={(event) => setSubmission((current) => ({ ...current, delayReason: event.target.value }))} /></label>
          <label className="admin-checkbox"><input type="checkbox" checked={submission.supplementary} onChange={(event) => setSubmission((current) => ({ ...current, supplementary: event.target.checked }))} /> To jest uzupełnienie wcześniejszego zgłoszenia</label>
        </ActionForm>
        {selected.authoritySubmissionReference && <p>Referencja ostatniego zapisu: {selected.authoritySubmissionReference}</p>}
        {selected.authorityExportVersion && <div className="admin-incident-export-download">
          <p>Udostępniono przygotowany, wersjonowany artefakt. Pobranie wymaga zalogowania administratora.</p>
          <button className="button button-secondary" disabled={busy || disabled || exportBusy} onClick={() => void downloadExport()} type="button">{exportBusy ? "Pobieranie eksportu…" : `Pobierz eksport UODO (wersja ${selected.authorityExportVersion})`}</button>
          {exportStatus && <p className="admin-status" role="status">{exportStatus}</p>}
        </div>}
      </> : <p>Eksport i ręczny dowód nie są wymagane przy tej decyzji.</p>}
    </details>
    <details className="admin-incident-disclosure"><summary>Zawiadomienie osób</summary>
      <p>Stan zawiadomienia: <strong>{SUBJECT_NOTIFICATION[selected.subjectNotificationStatus]}</strong></p>
      {selected.subjectDecision === "required" ? <SubjectNotificationForms selected={selected} busy={busy} disabled={disabled || Boolean(selected.closedAt)} act={act} /> : <p>Zawiadomienie nie jest wymagane przy tej decyzji.</p>}
      {selected.subjectNotificationStatus === "unknown" && <button className="button button-secondary" disabled={busy || disabled || Boolean(selected.closedAt)} onClick={() => act({ action: "reconcile_subject_notifications" })} type="button">Uzgodnij statusy doręczeń</button>}
    </details>
    <details className="admin-incident-disclosure"><summary>Blokada retencji</summary>
      <p>Stan: <strong>{selected.legalHold ? "Blokada aktywna" : "Brak blokady"}</strong></p>
      <ActionForm label={selected.legalHold ? "Zwolnij z blokady retencji" : "Ustaw blokadę retencji"} buttonLabel={selected.legalHold ? "Zwolnij blokadę" : "Ustaw blokadę"} busy={busy} disabled={disabled} onSubmit={() => act({ action: selected.legalHold ? "release_legal_hold" : "set_legal_hold", reason: holdReason })}>
        <label>Uzasadnienie<textarea maxLength={4_000} value={holdReason} onChange={(event) => setHoldReason(event.target.value)} required /></label>
      </ActionForm>
    </details>
    <details className="admin-incident-disclosure"><summary>Historia</summary>
      <AuditHistory entries={selected.auditHistory} />
    </details>
    <div className="admin-action-row"><button className="button button-primary" disabled={busy || disabled || Boolean(selected.closedAt) || Boolean(selected.awarenessAt)} onClick={() => act({ action: "acknowledge_awareness" })} type="button">{selected.awarenessAt ? "Świadomość potwierdzona" : "Potwierdź świadomość 72 godzin"}</button><button className="button button-secondary" disabled={busy || disabled || Boolean(selected.closedAt)} onClick={() => act({ action: "close" })} type="button">Zamknij sprawę</button></div>
    <p className="admin-status">Rewizja zapisu: {selected.revision}. Po konflikcie rewizji wymagane jest odświeżenie listy.</p>
  </div>;
}

export function SecurityIncidentsPanel({ user }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflictLocked, setConflictLocked] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createAssessment, setCreateAssessment] = useState(emptyAssessment);
  const epoch = useRef(0);
  const busyRef = useRef(false);

  const load = useCallback(async (forceRefresh = false) => {
    if (busyRef.current) return;
    const current = ++epoch.current;
    busyRef.current = true;
    setBusy(true);
    setItems([]);
    setSelected(null);
    setConflictLocked(true);
    setStatus("Odczytywanie incydentów…");
    setStatusKind("");
    try {
      const payload = await request(user, "/v1/admin/security-incidents", { forceRefresh });
      if (epoch.current !== current) return;
      if (!Array.isArray(payload?.incidents) || !payload.incidents.every(validListItem)) throw new Error("Nieprawidłowy read model incydentów.");
      setItems(payload.incidents);
      setConflictLocked(false);
      setStatus(payload.incidents.length ? `Incydentów: ${payload.incidents.length}` : "Brak incydentów.");
      setStatusKind("success");
    } catch (error) {
      if (epoch.current !== current) return;
      setStatus(error.message);
      setStatusKind("warning");
    } finally {
      if (epoch.current === current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }, [user]);

  useEffect(() => {
    void load();
    return () => {
      epoch.current += 1;
      busyRef.current = false;
    };
  }, [load]);

  async function open(item) {
    if (busyRef.current || conflictLocked) return;
    const current = epoch.current;
    busyRef.current = true;
    setBusy(true);
    setSelected(null);
    setStatus("Pobieranie szczegółów…");
    setStatusKind("");
    try {
      const payload = await request(user, `/v1/admin/security-incidents/${encodeURIComponent(item.incidentId)}`);
      if (epoch.current !== current) return;
      if (!validDetails(payload?.incident)) throw new Error("Nieprawidłowe szczegóły incydentu.");
      setSelected(payload.incident);
      setStatus("");
    } catch (error) {
      if (epoch.current === current) {
        setStatus(error.message);
        setStatusKind("warning");
      }
    } finally {
      if (epoch.current === current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  async function create(event) {
    event.preventDefault();
    if (busyRef.current || conflictLocked || !createTitle.trim() || !createAssessment.details.trim()) return;
    const current = ++epoch.current;
    busyRef.current = true;
    setBusy(true);
    setStatus("Zapisywanie incydentu…");
    setStatusKind("");
    try {
      const payload = await request(user, "/v1/admin/security-incidents", { method: "POST", body: JSON.stringify({ title: createTitle.trim(), ...serializeAssessment(createAssessment) }) });
      if (epoch.current !== current) return;
      if (!validDetails(payload?.incident)) throw new Error("Serwer nie potwierdził utworzenia incydentu.");
      const created = toListItem(payload.incident);
      if (!validListItem(created)) throw new Error("Serwer nie zwrócił prawidłowej pozycji listy.");
      setItems((currentItems) => [created, ...currentItems]);
      setCreateTitle("");
      setCreateAssessment(emptyAssessment());
      setStatus("Incydent zapisano. Otwórz szczegóły, aby rozpocząć obsługę.");
      setStatusKind("success");
    } catch (error) {
      if (epoch.current === current) {
        if (error.status === 409 || error.status === 503 || !error.status) setConflictLocked(true);
        setStatus(error.message);
        setStatusKind("warning");
      }
    } finally {
      if (epoch.current === current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  async function act(body) {
    if (!selected || busyRef.current || conflictLocked || !ACTIONS.has(body.action)) return;
    const current = epoch.current;
    busyRef.current = true;
    setBusy(true);
    setStatus("Zapisywanie…");
    setStatusKind("");
    try {
      const payload = await request(user, `/v1/admin/security-incidents/${encodeURIComponent(selected.incidentId)}`, { method: "PATCH", body: JSON.stringify({ ...body, expectedRevision: selected.revision }) });
      if (epoch.current !== current) return;
      if (!validDetails(payload?.incident)) throw new Error("Serwer nie potwierdził zmiany.");
      setSelected(payload.incident);
      const updatedItem = toListItem(payload.incident);
      if (!validListItem(updatedItem)) throw new Error("Serwer nie zwrócił prawidłowej pozycji listy.");
      setItems((currentItems) => currentItems.map((item) => item.incidentId === updatedItem.incidentId ? updatedItem : item));
      setStatus("Zmiana została zapisana i zarejestrowana w audycie.");
      setStatusKind("success");
    } catch (error) {
      if (epoch.current !== current) return;
      if (error.status === 409 || error.status === 503 || !error.status) setConflictLocked(true);
      setStatus(error.message);
      setStatusKind("warning");
    } finally {
      if (epoch.current === current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  return <section className="admin-queue admin-security-queue" aria-labelledby="security-incidents-title">
    <div className="section-heading"><p className="eyebrow">BEZPIECZEŃSTWO</p><h2 id="security-incidents-title">Incydenty bezpieczeństwa</h2><p>Lista pokazuje tylko klasyfikację, termin 72 godzin i najpilniejsze działanie. Szczegóły są pobierane dopiero po otwarciu.</p></div>
    <div className="admin-action-row"><button className="button button-secondary admin-refresh" disabled={busy} onClick={() => void load(true)} type="button">Odśwież incydenty</button></div>
    {status && <div className={`admin-status ${statusKind ? `admin-status-${statusKind}` : ""}`.trim()} role={statusKind === "warning" ? "alert" : "status"}>{status}</div>}
    <details className="admin-panel security-incident-create"><summary>Dodaj incydent</summary>
      <form className="admin-privacy-form" onSubmit={create}>
        <label>Tytuł roboczy<input maxLength={200} value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} required /></label>
        <AssessmentFields value={createAssessment} setValue={setCreateAssessment} idPrefix="incident-create" />
        <button className="button button-primary" disabled={busy || conflictLocked || !createTitle.trim() || !createAssessment.details.trim()} type="submit">Utwórz incydent</button>
      </form>
    </details>
    <div className="admin-report-list">{items.map((item) => <IncidentListItem key={item.incidentId} item={item} disabled={busy || conflictLocked} onOpen={open} />)}</div>
    {selected && <IncidentDetails key={`${selected.incidentId}-${selected.revision}`} selected={selected} busy={busy} disabled={conflictLocked} act={act} onClose={() => setSelected(null)} user={user} />}
  </section>;
}
