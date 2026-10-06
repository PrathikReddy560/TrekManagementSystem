export default function TrekCard({ trek, isSelected, onSelect, onOpenDetail }) {
  return (
    <article
      className={`card trek-card${isSelected ? " is-selected" : ""}`}
      onClick={() => onSelect(trek.id)}
      tabIndex={0}
      aria-label={`${trek.name}; press Enter to highlight on the map`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(trek.id);
        }
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.5rem" }}>
        <h3>{trek.name}</h3>
        <span className={`difficulty-tag difficulty-${trek.difficulty}`}>{trek.difficulty}</span>
      </div>
      <p className="trek-card-meta">
        {trek.region} <span>·</span> {trek.durationDays}d <span>·</span> {trek.maxElevationM}m
      </p>
      <p className="trek-card-description">{trek.description}</p>
      <button
        className="btn btn-outline"
        style={{ fontSize: "0.82rem", padding: "0.4em 0.9em" }}
        onClick={(e) => {
          e.stopPropagation();
          onOpenDetail(trek.id);
        }}
      >
        View & book
      </button>
    </article>
  );
}
