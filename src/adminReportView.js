const UNAVAILABLE_VALUE = "niedostępny";
const STATUS_LABELS = { open: "otwarte", in_review: "w analizie", resolved: "rozwiązane", closed: "zamknięte" };
const REASON_LABELS = { incorrect_answer: "niepoprawna odpowiedź", unclear_explanation: "niejasne wyjaśnienie", outdated_content: "nieaktualna treść", technical_issue: "problem techniczny", other: "inne" };

function displayValue(value) {
  return typeof value === "string" && value.trim() ? value : UNAVAILABLE_VALUE;
}

function displayLabel(value, labels) {
  return typeof value === "string" && labels[value] ? labels[value] : displayValue(value);
}

export function buildAdminReportView(report) {
  const source = report && typeof report === "object" ? report : {};
  const context = source.context && typeof source.context === "object" ? source.context : {};

  return {
    heading: `${displayLabel(source.reason, REASON_LABELS)} · ${displayLabel(source.status, STATUS_LABELS)}`,
    description: displayValue(source.description),
    fields: [
      ["Element", displayValue(source.itemId)],
      ["Ścieżka", displayValue(source.trackId)],
      ["Wydanie", displayValue(context.releasePackageId)],
      ["Powierzchnia", displayValue(context.modeRoute)],
      ["Węzeł", displayValue(context.trackNode)],
      ["Utworzono", displayValue(source.createdAt)],
    ],
  };
}
