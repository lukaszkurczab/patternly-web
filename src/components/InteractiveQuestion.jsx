import { useState } from "react";

const heroAnswers = [
  ["a", "Use a single-column index on the most selective column."],
  ["b", "Use a composite index with the filter column first."],
  ["c", "Always use a full table scan for consistency."],
  ["d", "Use a covering index with all columns in the query."],
];

const sessionAnswers = [
  ["a", "Filter by date range first, then by customer_id."],
  ["b", "Filter by customer_id first, then by date range within that customer."],
  ["c", "Use OR to combine customer_id and date range conditions."],
  ["d", "Query all orders and filter in application code."],
];

const feedback = {
  correct: "The composite index follows leftmost-prefix ordering. Filtering by customer_id first lets the query narrow both dimensions without a scan.",
  incorrect: "Not yet. Inspect the index order: the leading column needs to narrow the search before the date range can help. Try another option.",
  empty: "Choose an answer to inspect the reason behind the decision.",
};

function AnswerOption({ answer, label, name, selected, correct, session, onSelect }) {
  const inputId = `${name}-${answer}`;

  return (
    <>
      <input
        checked={selected}
        className="choice-input"
        id={inputId}
        name={name}
        onChange={() => onSelect(answer)}
        type="radio"
        value={answer}
      />
      <label
        htmlFor={inputId}
        className={`${session ? "session-option" : "choice-button"} ${selected && correct ? "is-correct" : ""}`.trim()}
        data-answer={answer}
        data-state={selected ? "selected" : undefined}
      >
        <span className={session ? undefined : "choice-key"}>{answer.toUpperCase()}</span>
        {session ? <strong>{label}</strong> : label}
      </label>
    </>
  );
}

export function HeroQuestionCard() {
  const [selected, setSelected] = useState("");
  const correct = selected === "b";

  return (
    <div className="product-card hero-card" data-interactive-card data-state={selected ? (correct ? "resolved" : "focused") : "neutral"}>
      <div className="product-card-topbar">
        <span className="product-label">SQL · Indexing</span>
        <span className="live-label"><span className="live-dot" aria-hidden="true" /> Guided</span>
      </div>
      <p className="question-label">Question</p>
      <h2>Which approach avoids a full table scan on a composite index?</h2>
      <div className="choice-stack" role="radiogroup" aria-label="Choose an answer">
        {heroAnswers.map(([answer, label]) => (
          <AnswerOption key={answer} answer={answer} label={label} name="hero-answer" selected={selected === answer} correct={correct} onSelect={setSelected} />
        ))}
      </div>
      <div className="next-action">
        <span>Next action</span>
        <strong>{selected ? (correct ? "Review: composite index ordering" : "Inspect: leftmost-prefix ordering") : "Choose an answer to inspect the decision"}</strong>
      </div>
    </div>
  );
}

export function SessionQuestionCard() {
  const [selected, setSelected] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const correct = selected === "b";

  const reset = () => {
    setSelected("");
    setDetailsOpen(false);
  };

  return (
    <div className="session-panel" data-interactive-card data-state={selected ? (correct ? "resolved" : "focused") : "neutral"}>
      <div className="session-topbar"><span>No timer</span><span>SQL · Indexing</span><span>Local demo</span></div>
      <div className="session-question">
        <p className="question-label">Question</p>
        <h3>You need to find all orders placed in the last 30 days for a specific customer. The orders table has a composite index on (customer_id, order_date). Which query structure uses the index most efficiently?</h3>
      </div>
      <div className="session-options" role="radiogroup" aria-label="Choose a query structure">
        {sessionAnswers.map(([answer, label]) => (
          <AnswerOption key={answer} answer={answer} label={label} name="session-answer" selected={selected === answer} correct={correct} session onSelect={setSelected} />
        ))}
      </div>
      <div className="session-feedback" id="session-feedback" aria-live="polite">
        <p className="question-label">Reason</p>
        <p>{selected ? (correct ? feedback.correct : feedback.incorrect) : feedback.empty}</p>
        <button className="details-button" type="button" aria-controls="session-details" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}>
          Details <span aria-hidden="true">{detailsOpen ? "－" : "＋"}</span>
        </button>
        {detailsOpen && <p className="details-copy" id="session-details">The useful transfer is simple: when a composite index is ordered by customer_id first, constrain that leading column before applying the order_date range.</p>}
      </div>
      <div className="session-actions">
        <button className="button button-primary" type="button" onClick={reset}>Reset question <span aria-hidden="true">↺</span></button>
        <span className="session-status">{selected ? (correct ? "Decision resolved" : "Selection noted — inspect the reason") : "Ready when you are"}</span>
      </div>
    </div>
  );
}
