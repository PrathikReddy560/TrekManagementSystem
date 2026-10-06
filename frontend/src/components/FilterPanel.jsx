const MONTHS = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function FilterPanel({ filters, onChange }) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value });

  return (
    <div className="card" style={{ padding: "1rem", display: "grid", gap: "0.8rem" }}>
      <div>
        <label>Difficulty</label>
        <select value={filters.difficulty || ""} onChange={set("difficulty")}>
          <option value="">Any</option>
          <option value="easy">Easy</option>
          <option value="moderate">Moderate</option>
          <option value="hard">Hard</option>
        </select>
      </div>
      <div>
        <label>Max trip length (days)</label>
        <select value={filters.maxDays || ""} onChange={set("maxDays")}>
          <option value="">Any</option>
          <option value="1">1 day</option>
          <option value="2">2 days</option>
        </select>
      </div>
      <div>
        <label>Travel month</label>
        <select value={filters.month || ""} onChange={set("month")}>
          <option value="">Any</option>
          {MONTHS.slice(1).map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label>Region</label>
        <input
          type="text"
          placeholder="e.g. Chikmagalur"
          value={filters.region || ""}
          onChange={set("region")}
        />
      </div>
    </div>
  );
}
