import { useState } from "react";

export function InteractiveQuestion({ demo, trackLabel, progressNote, titleRef }) {
  const question = demo.question;
  const options = question.interaction.options;
  const correctOptionId = question.answer.optionId;
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isCorrect = submitted && selected === correctOptionId;
  const state = !submitted ? "neutral" : isCorrect ? "resolved" : "focused";
  const feedbackMessage = isCorrect
      ? question.feedback.reason
      : question.feedback.messages.find((message) => message.kind === "wrong_option" && message.targetId === selected)?.text;

  const reset = () => {
    setSelected(null);
    setSubmitted(false);
    setDetailsOpen(false);
  };

  return (
    <section className="practice-panel" id="session" aria-labelledby="session-title" data-state={state}>
      <div className="practice-topbar"><span>{trackLabel}</span><span>No timer</span></div>
      <div className="practice-question">
        <p className="question-label">Practice question</p>
        <h2 id="session-title" ref={titleRef} tabIndex={-1}>{question.prompt}</h2>
      </div>
      <div className="practice-options" role="radiogroup" aria-labelledby="session-title">
        {options.map((option, index) => {
          const inputId = `session-answer-${option.optionId}`;
          const isSelected = selected === option.optionId;
          return (
            <div className="practice-option" key={option.optionId} data-state={isSelected ? "selected" : undefined}>
              <input checked={isSelected} className="choice-input" id={inputId} name="session-answer" onChange={() => { setSelected(option.optionId); setSubmitted(false); setDetailsOpen(false); }} type="radio" value={option.optionId} />
              <label htmlFor={inputId}><span>{String.fromCharCode(65 + index)}</span><strong>{option.text}</strong></label>
            </div>
          );
        })}
      </div>
      {submitted && <div className="practice-feedback" aria-live="polite">
        <p className="question-label">Reason</p>
        <p>{feedbackMessage}</p>
        <button className="details-button" type="button" aria-controls={detailsOpen ? "session-details" : undefined} aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}>
          See the key idea <span aria-hidden="true">{detailsOpen ? "－" : "＋"}</span>
        </button>
        {detailsOpen && <div className="details-copy" id="session-details">{demo.detailsParagraphs.map((paragraph, index) => <p key={`${question.questionId}:detail:${index}`}>{paragraph}</p>)}</div>}
      </div>}
      <div className="practice-actions">
        <button className="button button-primary" disabled={!submitted && selected === null} type="button" onClick={() => {
          if (submitted) reset();
          else { setSubmitted(true); setDetailsOpen(false); }
        }}>
          {submitted ? <>Try again <span aria-hidden="true">↺</span></> : "Check answer"}
        </button>
        {submitted && <span className="practice-status" aria-live="polite">{isCorrect ? "Correct — well done" : "Not quite — take another look"}</span>}
      </div>
      {submitted && <p className="practice-note">Patternly is coming to the App Store. Download is not available yet.</p>}
      <p className="practice-note">{progressNote}</p>
    </section>
  );
}
