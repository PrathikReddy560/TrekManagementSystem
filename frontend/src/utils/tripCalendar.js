function escapeIcs(value = "") {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function dateOnly(value) {
  return String(value || "").replaceAll("-", "");
}

export function downloadTripCalendar(plan, pick, form) {
  const start = new Date(`${form.travelDate}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + Number(form.daysAvailable || 1));
  const checklist = (pick.packingChecklist || pick.logistics?.packingChecklist || []).map((item) => `- ${item}`).join("\n");
  const budget = pick.estimatedTotalRangeInr || pick.logistics?.costEstimateGroupInr;
  const description = [
    `Starting from: ${form.origin || "Bengaluru"}`,
    `Nearest railhead: ${pick.logistics?.railhead || "Check route"}`,
    budget ? `Demo group estimate: ₹${budget.low}–₹${budget.high}` : "",
    "Train fares and schedules are estimates; confirm before travel.",
    "Packing checklist:",
    checklist,
    "Plan notes:",
    plan.summary || "",
  ].filter(Boolean).join("\n");

  const event = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TrekAI//Trip Plan//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:trekai-${pick.trekId}-${Date.now()}@trekai.local`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
    `DTSTART;VALUE=DATE:${dateOnly(form.travelDate)}`,
    `DTEND;VALUE=DATE:${dateOnly(end.toISOString().slice(0, 10))}`,
    `SUMMARY:${escapeIcs(`TrekAI trek plan · ${pick.trekName}`)}`,
    `LOCATION:${escapeIcs(`${pick.trekName}, ${pick.logistics?.railhead || "Karnataka"}`)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([event], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `trekai-${pick.trekId}-${form.travelDate}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
