import { useState } from "react";

const answers = [
  { id: "a", label: "(order_date, customer_id)", feedback: "The date range leads this index, so it cannot first narrow to one customer’s orders." },
  { id: "b", label: "(customer_id, order_date)", feedback: "Correct. Equality on customer_id comes first, then the date range narrows that customer’s orders. PostgreSQL still considers the data and query costs when it chooses a plan.", correct: true },
  { id: "c", label: "(customer_id)", feedback: "This can narrow to one customer, but order_date is not in the index key to narrow the requested 30-day range." },
  { id: "d", label: "(customer_id, status, order_date)", feedback: "status sits between the two useful keys, but this query has no status condition to constrain it before order_date." },
];

export function InteractiveQuestion() {
  const [selected, setSelected] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const selectedAnswer = answers.find((answer) => answer.id === selected);
  const state = selectedAnswer ? (selectedAnswer.correct ? "resolved" : "focused") : "neutral";

  const reset = () => {
    setSelected("");
    setDetailsOpen(false);
  };

  return (
    <section className="practice-panel" id="session" aria-labelledby="session-title" data-state={state}>
      <div className="practice-topbar"><span>SQL · Indexing</span><span>No timer</span></div>
      <div className="practice-question">
        <p className="question-label">Practice question</p>
        <h2 id="session-title">For this PostgreSQL query, which B-tree index key order is the best match?</h2>
        <p className="query-context">Find orders for one customer from the last 30 days: <code>WHERE customer_id = $1 AND order_date &gt;= CURRENT_DATE - INTERVAL '30 days'</code></p>
      </div>
      <div className="practice-options" role="radiogroup" aria-labelledby="session-title">
        {answers.map((answer) => {
          const inputId = `session-answer-${answer.id}`;
          const isSelected = selected === answer.id;
          return (
            <div className="practice-option" key={answer.id} data-state={isSelected ? "selected" : undefined}>
              <input checked={isSelected} className="choice-input" id={inputId} name="session-answer" onChange={() => setSelected(answer.id)} type="radio" value={answer.id} />
              <label htmlFor={inputId}><span>{answer.id.toUpperCase()}</span><strong>{answer.label}</strong></label>
            </div>
          );
        })}
      </div>
      <div className="practice-feedback" aria-live="polite">
        <p className="question-label">Why?</p>
        <p>{selectedAnswer ? selectedAnswer.feedback : "Choose an index key order to see what it supports."}</p>
        <button className="details-button" type="button" aria-controls="session-details" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}>
          See the key idea <span aria-hidden="true">{detailsOpen ? "－" : "＋"}</span>
        </button>
        <p className="details-copy" hidden={!detailsOpen} id="session-details">For a multicolumn B-tree index, the leading key columns determine how the index can narrow the search. The order of predicates in the SQL text does not set that key order.</p>
      </div>
      <div className="practice-actions">
        <button className="button button-primary" type="button" onClick={reset}>Try again <span aria-hidden="true">↺</span></button>
        <span className="practice-status" aria-live="polite">{selectedAnswer ? (selectedAnswer.correct ? "Correct — well done" : "Not quite — take another look") : "Ready when you are"}</span>
      </div>
      <p className="practice-note">This example does not save your progress or schedule reviews.</p>
    </section>
  );
}
