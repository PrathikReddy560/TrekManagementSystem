export default function AgentTrace({ trace, mode }) {
  if (!trace?.length) return null;

  return (
    <div className="card" style={{ padding: "0.9rem 1rem", background: "var(--ink)", color: "#d9e2d6" }}>
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", color: "var(--mist)" }}>
        {mode === "agentic" ? "Agent trace — tool calls made while planning" : "Planner trace (fallback / rule-based mode)"}
      </p>
      <div className="mono" style={{ fontSize: "0.78rem", display: "grid", gap: "0.35rem" }}>
        {trace.map((step, i) => (
          <div key={i}>
            <span style={{ color: "var(--moss-light)" }}>→ {step.tool}</span>(
            {Object.entries(step.input || {})
              .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
              .join(", ")}
            )
            <div style={{ color: "#a9b5a6", paddingLeft: "1.2rem" }}>
              ✓ {summarize(step.tool, step.output)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function summarize(tool, output) {
  if (output?.error) return `error: ${output.error}`;
  if (tool === "search_treks" && Array.isArray(output)) return `${output.length} candidate(s) returned`;
  if (tool === "check_season_fit") return `${output.fit} — ${output.reason}`;
  if (tool === "estimate_budget") return `total ₹${output.totalInr} (₹${output.perPersonInr}/person)`;
  if (tool === "get_trip_logistics") return `railhead ${output.railhead}; group estimate ₹${output.costEstimateGroupInr?.low}–₹${output.costEstimateGroupInr?.high}; train fare is illustrative`;
  if (tool === "get_stays_near" && Array.isArray(output)) return `${output.length} stay option(s) returned`;
  return "done";
}
