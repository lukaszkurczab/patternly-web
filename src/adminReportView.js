const UNAVAILABLE_VALUE = "niedostępny";

function displayValue(value) {
  return typeof value === "string" && value.trim() ? value : UNAVAILABLE_VALUE;
}

export function buildAdminReportView(report) {
  const source = report && typeof report === "object" ? report : {};
  const context = source.context && typeof source.context === "object" ? source.context : {};

  return {
    heading: `${displayValue(source.reason)} · ${displayValue(source.status)}`,
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
