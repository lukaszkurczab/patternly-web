import { useEffect, useState } from "react";
import { adminApiOrigin } from "../adminConfig";

const number = (value) => Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString("pl-PL") : "—";
const trackLabel = (track) => track.title || track.trackId.split("-").map((word) => ({ aws: "AWS", dsa: "DSA", ai: "AI", az: "AZ" }[word] || word[0].toUpperCase() + word.slice(1))).join(" ");
const names = { overview: "Przegląd", questions: "Baza pytań", usage: "Użycie aplikacji", reports: "Zgłoszenia" };
const contentError = (reason) => reason === "configured_release_invalid"
  ? "Publikacja pytań nie przeszła kontroli integralności. Sprawdź plik publikacji na serwerze."
  : reason === "configured_release_unavailable"
    ? "Nie można odczytać wybranej publikacji pytań. Sprawdź jej dostępność na serwerze."
    : "Baza pytań nie jest podłączona do tego środowiska. Skonfiguruj źródło opublikowanych treści na serwerze.";
const paths = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  questions: "M4 5h16v16H4z M8 2v6 M16 2v6 M8 12h8 M8 16h5",
  usage: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  reports: "M4 3h16v13H9l-5 5z M8 7h8 M8 11h5",
};

function useAdminRead(user, path, validate) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ data: null, error: "", loading: true });
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    setState({ data: null, error: "", loading: true });
    const timer = setTimeout(() => {
      controller.abort();
      if (!disposed) setState({ data: null, loading: false, error: "Odczyt trwa zbyt długo. Spróbuj ponownie." });
    }, 12000);
    void (async () => {
      try {
        const token = await user.getIdToken(attempt > 0);
        if (controller.signal.aborted) return;
        const response = await fetch(`${adminApiOrigin.replace(/\/$/u, "")}/v1/admin/${path}`, {
          headers: { authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403
          ? "Brak dostępu administratora. Sprawdź konto i spróbuj ponownie."
          : payload?.error?.code === "question_inspection_unavailable"
            ? contentError(payload.error.reason)
            : "Nie udało się pobrać danych. Spróbuj ponownie.");
        if (!validate(payload)) throw new Error("Otrzymano nieprawidłowe dane. Spróbuj ponownie.");
        if (!disposed && !controller.signal.aborted) setState({ data: payload, error: "", loading: false });
      } catch (error) {
        if (!disposed && !controller.signal.aborted) setState({ data: null, error: error.message, loading: false });
      } finally { clearTimeout(timer); }
    })();
    return () => { disposed = true; clearTimeout(timer); controller.abort(); };
  }, [user, path, attempt, validate]);
  return { ...state, refresh: () => setAttempt((value) => value + 1) };
}
const count = (value) => Number.isSafeInteger(value) && value >= 0;
const validOverview = (data) => data?.content && Array.isArray(data.content.tracks)
  && count(data.content.publishedTracks) && (data.content.questionCount === null || count(data.content.questionCount))
  && data.content.tracks.every((track) => typeof track.trackId === "string" && typeof track.version === "string" && count(track.questionCount))
  && count(data?.reports?.open)
  && ["available", "unavailable"].includes(data?.questionBank?.status)
  && ["accounts", "progressRecords", "trainingAttempts", "reviewQueueEntries"].every((key) => count(data?.usage?.[key]));
const validQuestions = (data) => Array.isArray(data?.questions) && count(data.total) && count(data.page) && data.page > 0 && count(data.pageSize) && data.pageSize > 0
  && data.questions.every((item) => typeof item.id === "string" && typeof item.prompt === "string");

function Metric({ label, value, note }) {
  return <article className="admin-metric"><span>{label}</span><strong>{number(value)}</strong><small>{note}</small></article>;
}
function ReadState({ state }) {
  if (state.loading) return <p className="admin-status" role="status">Pobieranie danych…</p>;
  if (state.error) return <div className="admin-empty" role="alert"><h3>Dane niedostępne</h3><p>{state.error}</p></div>;
  return null;
}
function ViewHeading({ title, description, state }) {
  return <div className="admin-view-heading"><div><h2>{title}</h2><p>{description}</p></div>
    <button className="button button-secondary" onClick={state.refresh} disabled={state.loading}>Odśwież dane</button></div>;
}
function UsageMetrics({ usage }) {
  return <><div className="admin-metrics">
    <Metric label="Konta użytkowników" value={usage.accounts} note="Konta zapisane na serwerze" />
    <Metric label="Próby treningowe" value={usage.trainingAttempts} note="Zsynchronizowane zapisy prób" />
    <Metric label="Zapisy powtórek" value={usage.reviewQueueEntries} note="Łącznie ze znacznikami usunięcia" />
  </div><div className="admin-note">Statystyki obejmują dane zsynchronizowane z serwerem. Nie obejmują nauki wyłącznie offline ani niezapisanej aktywności gości. Liczba prób nie oznacza liczby sesji lub aktywnych użytkowników.</div></>;
}
function Overview({ user, openQuestions, usageOnly = false }) {
  const state = useAdminRead(user, "overview", validOverview);
  const data = state.data;
  return <section aria-label={usageOnly ? names.usage : names.overview}>
    <ViewHeading title={usageOnly ? "Użycie aplikacji" : "Przegląd"} description={usageOnly ? "Aktywność zapisana przez aplikację." : "Stan treści i pracy administracyjnej w jednym miejscu."} state={state} />
    <ReadState state={state} />
    {data && (usageOnly ? <><UsageMetrics usage={data.usage} /><div className="admin-panel"><div className="admin-panel-heading"><h3>Synchronizacja postępów</h3><span>Stan bieżący</span></div><div className="admin-question"><strong>{number(data.usage.progressRecords)}</strong> zapisów postępu</div></div></> : <>
      <div className="admin-metrics">
        <Metric label="Pytania w bazie" value={data.content.questionCount} note="W wybranej publikacji" />
        <Metric label="Ścieżki z treścią" value={data.content.tracks.length} note="Dostępne do przeglądu" />
        <Metric label="Otwarte zgłoszenia" value={data.reports.open} note="Oczekują na rozpoczęcie analizy" />
      </div>
      <div className="admin-panel"><div className="admin-panel-heading"><h3>Baza pytań według ścieżek</h3><span>Wybrana publikacja treści</span></div>
        {data.content.tracks.length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th scope="col">Ścieżka</th><th scope="col">Pytania</th><th scope="col">Wersja</th></tr></thead><tbody>
          {data.content.tracks.map((track) => <tr key={track.trackId}><td><button className="admin-text-button" onClick={() => openQuestions(track.trackId)}>{trackLabel(track)}</button></td><td>{number(track.questionCount)}</td><td>{track.version}</td></tr>)}
        </tbody></table></div> : <div className="admin-question">Brak pytań w wybranej publikacji.</div>}
      </div>
      {data.questionBank.status !== "available" && <div className="admin-note">{contentError(data.questionBank.reason)}</div>}
      <div className="admin-note">Wybrana publikacja{data.questionBank.releaseId ? `: ${data.questionBank.releaseId}` : ""}. W aplikacji zarejestrowano osobno: {number(data.content.publishedTracks)} ścieżek na serwerze.</div>
    </>)}
    {data?.observedAt && <p className="admin-status">Odczyt: {new Date(data.observedAt).toLocaleString("pl-PL")}</p>}
  </section>;
}
const INTERACTION_LABELS = {
  choice: "Wybór odpowiedzi",
  ordering: "Kolejność",
  complexity: "Złożoność obliczeniowa",
  decision_matrix: "Macierz decyzyjna",
};
const FIELD_LABELS = {
  auxiliary_space: "Pamięć pomocnicza",
  output_space: "Pamięć wyniku",
  time: "Czas",
};
const SCORING_LABELS = {
  adjacent_relations: "Relacje sąsiedztwa",
  dimension_exact: "Dokładne wartości wymiarów",
};
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const firstValue = (...values) => values.find((value) => value !== undefined && value !== null);
const fieldLabel = (value) => {
  if (typeof value !== "string" || !value) return "—";
  if (FIELD_LABELS[value]) return FIELD_LABELS[value];
  const readable = value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return readable ? readable.charAt(0).toUpperCase() + readable.slice(1) : "—";
};
const scoringLabel = (value) => SCORING_LABELS[value] || fieldLabel(value);
const optionId = (option) => firstValue(option?.id, option?.optionId);
const elementId = (element) => firstValue(element?.id, element?.elementId);
const listValues = (value) => Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
const mapEntries = (value) => isRecord(value) ? Object.entries(value) : [];
const feedbackOf = (item) => isRecord(item.feedback) ? item.feedback : {};
const richFeedbackOf = (feedback) => isRecord(feedback.richInteraction) ? feedback.richInteraction : {};
const idText = (id) => typeof id === "string" ? id : "—";

function Explanation({ value }) {
  if (value == null) return null;
  if (typeof value === "string") return <p>{value}</p>;
  if (Array.isArray(value)) return <>{value.map((entry, index) => <Explanation key={index} value={entry} />)}</>;
  if (typeof value !== "object") return <p>{String(value)}</p>;
  if (Array.isArray(value.blocks)) return <div className="admin-explanation-blocks"><Explanation value={value.blocks} /></div>;
  if (value.type === "heading") return value.level === 2 ? <h3>{value.text}</h3> : <h4>{value.text}</h4>;
  if (value.type === "paragraph") return <p>{value.text}</p>;
  if (value.type === "bullet_list" || value.type === "numbered_list" || value.type === "ordered_list") {
    const List = value.type === "bullet_list" ? "ul" : "ol";
    return <List className="admin-explanation-list">{value.items?.map((entry, index) => <li key={index}><Explanation value={entry} /></li>)}</List>;
  }
  if (value.type === "code") return <pre className="admin-explanation-code"><code>{value.code}</code></pre>;
  if (value.type === "image") return <figure className="admin-explanation-image"><figcaption>{value.alt}</figcaption><p className="admin-status">Podgląd obrazu nie jest dostępny w panelu inspekcji (zasób: {idText(value.assetId)}).</p></figure>;
  if (value.type === "callout") return <aside className="admin-explanation-callout">{value.title && <h4>{value.title}</h4>}<p>{value.text}</p></aside>;
  if (typeof value.text === "string") return <>{value.title && <h3>{value.title}</h3>}<p>{value.text}</p></>;
  return <dl className="admin-explanation-fields">{Object.entries(value).map(([key, entry]) => <div key={key}><dt>{fieldLabel(key)}</dt><dd><Explanation value={entry} /></dd></div>)}</dl>;
}

function FeedbackEntries({ title, entries, kind, labelForId }) {
  if (!entries.length) return null;
  return <section className="admin-feedback-section" aria-label={title}>
    <h4>{title}</h4>
    <ul className="admin-feedback-list">{entries.map(([id, explanation], index) => <li key={`${id}-${index}`} data-feedback-type={kind} data-feedback-id={id}>
      <div className="admin-feedback-label"><strong>{labelForId(id)}</strong><small>{idText(id)}</small></div>
      <Explanation value={explanation} />
    </li>)}</ul>
  </section>;
}

function ChoiceInteraction({ interaction, feedback }) {
  const options = Array.isArray(interaction?.options) ? interaction.options : [];
  const accepted = new Set(listValues(interaction?.acceptedOptionIds));
  const optionById = new Map(options.map((option) => [optionId(option), option]));
  const labelForId = (id) => optionById.get(id)?.text || fieldLabel(id);
  const wrong = feedback.wrongOptionExplanationsByOptionId;
  const omitted = firstValue(feedback.omittedCorrectExplanationsByOptionId, feedback.omittedCorrectElementExplanationsByOptionId);
  return <section className="admin-inspection-section" aria-label="Odpowiedzi">
    <h3>Odpowiedzi</h3>
    <ul className="admin-answer-list">{options.map((option, index) => {
      const id = optionId(option) || `option-${index + 1}`;
      const correct = accepted.has(id);
      return <li key={id} className="admin-answer" data-answer-id={id} data-correct={String(correct)}>
        <div className="admin-answer-content"><span className="admin-answer-text">{option.text}</span><span className={`admin-answer-status ${correct ? "admin-answer-status-correct" : "admin-answer-status-wrong"}`}>{correct ? "Poprawna odpowiedź" : "Niepoprawna odpowiedź"}</span></div>
        {!correct && isRecord(wrong) && wrong[id] !== undefined && <div className="admin-answer-feedback" data-feedback-type="wrong-option"><Explanation value={wrong[id]} /></div>}
        {!correct && isRecord(option) && option.explanation !== undefined && (!isRecord(wrong) || wrong[id] === undefined) && <div className="admin-answer-feedback" data-feedback-type="wrong-option"><Explanation value={option.explanation} /></div>}
      </li>;
    })}</ul>
    <FeedbackEntries title="Wyjaśnienia błędnych odpowiedzi" entries={mapEntries(wrong).filter(([id]) => !optionById.has(id))} kind="wrong-option" labelForId={labelForId} />
    <FeedbackEntries title="Pominięte poprawne odpowiedzi" entries={mapEntries(omitted)} kind="omitted-correct" labelForId={labelForId} />
  </section>;
}

function OrderingInteraction({ interaction, feedback }) {
  const elements = Array.isArray(interaction?.elements) ? interaction.elements : [];
  const elementById = new Map(elements.map((element) => [elementId(element), element]));
  const canonicalOrder = listValues(interaction?.canonicalOrder);
  const richFeedback = richFeedbackOf(feedback);
  const wrongElements = richFeedback.wrongElementExplanationsByElementId;
  const omittedElements = firstValue(richFeedback.omittedCorrectElementExplanationsByElementId, feedback.omittedCorrectElementExplanationsByOptionId);
  const labelForId = (id) => elementById.get(id)?.text || fieldLabel(id);
  const relationLabel = (relation) => {
    if (typeof relation !== "string") return fieldLabel(relation);
    const ids = relation.split("->");
    return ids.length === 2 ? `${labelForId(ids[0])} → ${labelForId(ids[1])}` : fieldLabel(relation);
  };
  const brokenRelations = richFeedback.brokenRelationExplanationsByRelationId;
  const elementIds = elements.map(elementId);
  const hasCanonicalOrder = canonicalOrder.length > 0
    && canonicalOrder.length === elements.length
    && elementIds.every((id) => typeof id === "string")
    && new Set(elementIds).size === elements.length
    && new Set(canonicalOrder).size === elements.length
    && canonicalOrder.every((id) => elementById.has(id));
  const visibleOrder = hasCanonicalOrder ? canonicalOrder : elements.map(elementId).filter(Boolean);
  return <section className="admin-inspection-section" aria-label="Prawidłowa kolejność">
    <div className="admin-inspection-heading"><h3>{hasCanonicalOrder ? "Prawidłowa kolejność" : "Zadeklarowane elementy"}</h3><span>{scoringLabel(interaction?.scoringMethod)}</span></div>
    <ol className="admin-answer-list admin-ordering-list">{visibleOrder.map((id, index) => {
      const element = elementById.get(id);
      return <li key={`${id}-${index}`} className="admin-answer" data-element-id={idText(id)} data-correct={hasCanonicalOrder ? "true" : "unknown"}>
        <div className="admin-answer-content"><span className="admin-answer-position">{index + 1}</span><span className="admin-answer-text">{element?.text || idText(id)}</span><span className={`admin-answer-status ${hasCanonicalOrder ? "admin-answer-status-correct" : "admin-answer-status-unknown"}`}>{hasCanonicalOrder ? "Prawidłowa pozycja" : "Pozycja zadeklarowana"}</span></div>
      </li>;
    })}</ol>
    {!hasCanonicalOrder && <p className="admin-status admin-status-warning">Pytanie nie zawiera kompletnej, jawnej kolejności kanonicznej.</p>}
    <FeedbackEntries title="Wyjaśnienia pominiętych elementów" entries={mapEntries(omittedElements)} kind="omitted-element" labelForId={labelForId} />
    <FeedbackEntries title="Wyjaśnienia błędnych relacji" entries={mapEntries(brokenRelations)} kind="broken-relation" labelForId={relationLabel} />
    <FeedbackEntries title="Wyjaśnienia błędnych elementów" entries={mapEntries(wrongElements)} kind="wrong-element" labelForId={labelForId} />
  </section>;
}

function ComplexityInteraction({ interaction }) {
  const dimensions = listValues(interaction?.checkedDimensions);
  const available = isRecord(interaction?.availableValuesByDimension) ? interaction.availableValuesByDimension : {};
  const accepted = isRecord(interaction?.acceptedValuesByDimension) ? interaction.acceptedValuesByDimension : {};
  const aliases = isRecord(interaction?.normalizedAliasesByDimension) ? interaction.normalizedAliasesByDimension : {};
  return <section className="admin-inspection-section" aria-label="Złożoność obliczeniowa">
    <div className="admin-inspection-heading"><h3>Złożoność obliczeniowa</h3><span>Maksymalnie {interaction?.maxPoints ?? "—"} pkt</span></div>
    <div className="admin-table-scroll admin-inspection-table-scroll" role="region" aria-label="Tabela złożoności obliczeniowej" tabIndex={0}><table className="admin-table admin-inspection-table" data-complexity-table="true"><thead><tr><th scope="col">Wymiar</th><th scope="col">Dostępne wartości</th><th scope="col">Poprawne wartości</th></tr></thead><tbody>
      {dimensions.map((dimension) => {
        const availableValues = listValues(available[dimension]);
        const acceptedValues = listValues(accepted[dimension]);
        return <tr key={dimension} data-dimension-id={dimension}><th scope="row">{fieldLabel(dimension)}</th><td><ul className="admin-value-list">{availableValues.map((value) => <li key={value} data-value-id={value} data-correct={String(acceptedValues.includes(value))}><span>{value}</span>{acceptedValues.includes(value) && <small>Poprawna</small>}</li>)}</ul></td><td><ul className="admin-value-list admin-accepted-value-list">{acceptedValues.map((value) => <li key={value} data-value-id={value} data-correct="true">{value}</li>)}</ul></td></tr>;
      })}
    </tbody></table></div>
    {mapEntries(aliases).length > 0 && <details className="admin-aliases"><summary>Aliasy normalizacji</summary><dl>{mapEntries(aliases).map(([dimension, values]) => <div key={dimension}><dt>{fieldLabel(dimension)}</dt><dd>{mapEntries(values).map(([alias, target]) => <span key={alias}>{alias} → {target}</span>)}</dd></div>)}</dl></details>}
  </section>;
}

function DecisionMatrixInteraction({ interaction, feedback }) {
  const dimensions = Array.isArray(interaction?.dimensions) ? interaction.dimensions : [];
  const richFeedback = richFeedbackOf(feedback);
  const wrongValues = richFeedback.wrongValueExplanationsByDimensionIdAndValueId;
  const omittedValues = richFeedback.omittedCorrectValueExplanationsByDimensionId;
  const valueLookup = new Map(dimensions.flatMap((dimension) => (Array.isArray(dimension.values) ? dimension.values : []).map((value) => [`${dimension.dimensionId}|${value.valueId}`, { dimension, value }])));
  const explanationFor = (dimensionId, valueId) => isRecord(wrongValues) ? wrongValues[`${dimensionId}|${valueId}`] : undefined;
  const labelForDimension = (dimensionId) => dimensions.find((dimension) => dimension.dimensionId === dimensionId)?.label || fieldLabel(dimensionId);
  return <section className="admin-inspection-section" aria-label="Macierz decyzyjna">
    <div className="admin-inspection-heading"><h3>Macierz decyzyjna</h3><span>{scoringLabel(interaction?.scoringMethod)}</span></div>
    <div className="admin-table-scroll admin-inspection-table-scroll" role="region" aria-label="Tabela macierzy decyzyjnej" tabIndex={0}><table className="admin-table admin-inspection-table" data-decision-matrix="true"><thead><tr><th scope="col">Wymiar</th><th scope="col">Wartość</th><th scope="col">Status</th></tr></thead><tbody>
      {dimensions.flatMap((dimension) => (Array.isArray(dimension.values) ? dimension.values : []).map((value) => {
        const correct = listValues(dimension.acceptedValueIds).includes(value.valueId);
        const explanation = explanationFor(dimension.dimensionId, value.valueId);
        return <tr key={`${dimension.dimensionId}-${value.valueId}`} data-dimension-id={dimension.dimensionId} data-value-id={value.valueId} data-correct={String(correct)}><th scope="row">{dimension.label || fieldLabel(dimension.dimensionId)}</th><td>{value.text}</td><td><span className={`admin-answer-status ${correct ? "admin-answer-status-correct" : "admin-answer-status-wrong"}`}>{correct ? "Poprawna wartość" : "Alternatywa"}</span>{explanation !== undefined && <div className="admin-answer-feedback" data-feedback-type="wrong-value"><Explanation value={explanation} /></div>}</td></tr>;
      }))}
    </tbody></table></div>
    <FeedbackEntries title="Wyjaśnienia pominiętych poprawnych wartości" entries={mapEntries(omittedValues)} kind="omitted-value" labelForId={labelForDimension} />
    <FeedbackEntries title="Wyjaśnienia błędnych wartości" entries={mapEntries(wrongValues).filter(([id]) => !valueLookup.has(id))} kind="wrong-value" labelForId={(id) => fieldLabel(id)} />
  </section>;
}

function Question({ item }) {
  const interaction = isRecord(item.interaction) ? item.interaction : {};
  const feedback = feedbackOf(item);
  const reason = firstValue(feedback.reason, feedback.Reason);
  const details = firstValue(feedback.details, feedback.Details);
  const type = interaction.type;
  const interactionView = type === "choice" ? <ChoiceInteraction interaction={interaction} feedback={feedback} />
    : type === "ordering" ? <OrderingInteraction interaction={interaction} feedback={feedback} />
    : type === "complexity" ? <ComplexityInteraction interaction={interaction} />
        : type === "decision_matrix" ? <DecisionMatrixInteraction interaction={interaction} feedback={feedback} />
          : null;
  return <details className="admin-question" data-interaction-type={type || "unknown"}><summary>{item.prompt}<small>{item.id} · {INTERACTION_LABELS[type] || fieldLabel(type)}</small></summary>
    <div className="admin-question-body">
      {interactionView}
      {typeof reason === "string" && <section className="admin-inspection-section admin-reason" aria-label="Wyjaśnienie"><h3>Wyjaśnienie</h3><p>{reason}</p></section>}
      <Explanation value={details} />
      <details data-json-diagnostic="true"><summary>Pełna treść i reguły pytania</summary><pre>{JSON.stringify(item, null, 2)}</pre></details>
    </div></details>;
}
function Questions({ user, initialTrack }) {
  const [trackId, setTrackId] = useState(initialTrack);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const catalog = useAdminRead(user, "overview", validOverview);
  const params = new URLSearchParams({ page: String(page), q: search, ...(trackId ? { trackId } : {}) });
  const state = useAdminRead(user, `questions?${params}`, validQuestions);
  return <section aria-label="Baza pytań">
    <ViewHeading title="Baza pytań" description="Sprawdzaj treść, odpowiedzi i wyjaśnienia w opublikowanej bazie." state={state} />
    <form className="admin-filters" onSubmit={(event) => { event.preventDefault(); setSearch(query.trim()); setPage(1); }}>
      <label><span>Ścieżka</span><select aria-label="Ścieżka" value={trackId} onChange={(event) => { setTrackId(event.target.value); setPage(1); }}><option value="">Wszystkie ścieżki</option>{catalog.data?.content.tracks.map((track) => <option key={track.trackId} value={track.trackId}>{trackLabel(track)}</option>)}</select></label>
      <label>Szukaj pytania<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Treść lub identyfikator" maxLength={160} /></label>
      <button className="button button-secondary" type="submit">Szukaj</button>
    </form>
    {catalog.error && <p className="admin-status admin-status-warning" role="status">Lista ścieżek jest niedostępna. <button className="admin-text-button" onClick={catalog.refresh}>Ponów odczyt listy</button></p>}
    <ReadState state={state} />
    {state.data && <><div className="admin-panel"><div className="admin-panel-heading"><h3>Wyniki wyszukiwania</h3><span>{number(state.data.total)} pytań</span></div>
      {state.data.questions.length ? state.data.questions.map((item) => <Question key={`${item.trackId || trackId}:${item.id}`} item={item} />) : <div className="admin-question">Brak pytań spełniających kryteria. Zmień ścieżkę lub wyszukiwane słowo.</div>}
      </div><div className="admin-pagination"><button className="button button-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Poprzednia</button><span>Strona {page} z {Math.max(1, Math.ceil(state.data.total / state.data.pageSize))}</span><button className="button button-secondary" disabled={page * state.data.pageSize >= state.data.total} onClick={() => setPage(page + 1)}>Następna</button></div></>}
  </section>;
}
export function AdminWorkspace({ user, reports, reportsReady, children }) {
  const [view, setView] = useState("overview");
  const [track, setTrack] = useState("");
  return <div className="admin-workspace"><nav className="admin-navigation" aria-label="Obszary administracji">
    {Object.entries(names).map(([key, label]) => <button key={key} aria-current={view === key ? "page" : undefined} onClick={() => { setView(key); if (key !== "questions") setTrack(""); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true"><path d={paths[key]} /></svg>{label}{key === "reports" && reportsReady && <span className="admin-nav-count">{reports.length}</span>}</button>)}
  </nav><div className="admin-content">
    {view === "reports" ? children : view === "questions" ? <Questions user={user} initialTrack={track} /> : <Overview user={user} usageOnly={view === "usage"} openQuestions={(id) => { setTrack(id); setView("questions"); }} />}
  </div></div>;
}
