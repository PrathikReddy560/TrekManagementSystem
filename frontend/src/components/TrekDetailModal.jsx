import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";

export default function TrekDetailModal({ trekId, onClose, onBook }) {
  const [trek, setTrek] = useState(null);
  const [stays, setStays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.getTrek(trekId), api.getStays(trekId)])
      .then(([trekRes, staysRes]) => {
        if (cancelled) return;
        setTrek(trekRes.trek);
        setStays(staysRes.stays);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [trekId]);

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal trek-detail-modal" role="dialog" aria-modal="true" aria-labelledby="trek-title" onClick={(e) => e.stopPropagation()}>
        {loading || !trek ? (
          <p>Loading trek details…</p>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <h2 id="trek-title" style={{ marginBottom: "0.2rem" }}>{trek.name}</h2>
              <button className="btn-outline btn" style={{ padding: "0.2em 0.6em" }} onClick={onClose}>
                ✕
              </button>
            </div>
            <p style={{ color: "var(--mist)", marginTop: 0 }}>
              {trek.region} · base village: {trek.baseVillage}
            </p>
            <p>{trek.description}</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", margin: "1rem 0" }}>
              <Fact label="Difficulty" value={trek.difficulty} />
              <Fact label="Duration" value={`${trek.durationDays} day${trek.durationDays > 1 ? "s" : ""}`} />
              <Fact label="Distance" value={`${trek.distanceKm} km`} />
              <Fact label="Max elevation" value={`${trek.maxElevationM} m`} />
              <Fact label="Permit / guide fee" value={`₹${trek.baseFeeInr} per person`} />
              <Fact label="Terrain" value={trek.terrain} />
            </div>

            <h3 style={{ fontSize: "1rem" }}>Highlights</h3>
            <ul style={{ marginTop: 0 }}>
              {trek.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>

            <h3 style={{ fontSize: "1rem" }}>Nearby stays</h3>
            <ul style={{ marginTop: 0, paddingLeft: "1.1rem" }}>
              {stays.map((s) => (
                <li key={s.id} style={{ marginBottom: "0.2rem" }}>
                  {s.name} — {s.type} — ₹{s.pricePerNightInr}/night
                </li>
              ))}
            </ul>

            <button className="btn btn-blaze" style={{ width: "100%", marginTop: "0.8rem" }} onClick={() => onBook(trek, stays)}>
              Book this trek
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: "0.8rem", color: "var(--mist)" }}>{label}</div>
      <div style={{ fontWeight: 500 }}>{value}</div>
    </div>
  );
}
