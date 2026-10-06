import { useEffect, useState } from "react";
import { api } from "../api/client";
import MapView from "../components/MapView";
import FilterPanel from "../components/FilterPanel";
import TrekCard from "../components/TrekCard";
import TrekDetailModal from "../components/TrekDetailModal";
import BookingModal from "../components/BookingModal";
import { useAuth } from "../context/AuthContext";

export default function ExplorePage({ onRequireAuth }) {
  const { user } = useAuth();
  const [filters, setFilters] = useState({});
  const [treks, setTreks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [bookingCtx, setBookingCtx] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .searchTreks(filters)
      .then((res) => setTreks(res.treks))
      .finally(() => setLoading(false));
  }, [filters]);

  function handleBookClick(trek, stays) {
    if (!user) {
      onRequireAuth();
      return;
    }
    setDetailId(null);
    setBookingCtx({ trek, stays });
  }

  return (
    <div className="explore-page">
      <div className="explore-heading">
        <div className="section-label">FIELD GUIDE · KARNATAKA</div>
        <div className="explore-heading-row">
          <div>
            <h1>Find your trail.</h1>
            <p>Pick a marker or a trek card to see the details.</p>
          </div>
          <span className="explore-count">{loading ? "Searching" : `${treks.length} trails`}</span>
        </div>
      </div>
      <div className="explore-layout">
        <aside className="explore-filters">
          <div className="panel-heading"><span>Refine the route</span><span>FILTERS</span></div>
          <FilterPanel filters={filters} onChange={setFilters} />
        </aside>

        <section className="explore-map" aria-label="Map of trekking locations">
          <div className="map-caption"><span className="map-caption-dot" /> Western Ghats · Karnataka</div>
          <MapView
            treks={treks}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpenDetail={(id) => {
              setSelectedId(id);
              setDetailId(id);
            }}
          />
          <div className="map-legend">
            <span><i className="legend-dot easy" />Easy</span>
            <span><i className="legend-dot moderate" />Moderate</span>
            <span><i className="legend-dot hard" />Hard</span>
          </div>
        </section>

        <section className="explore-results" aria-label="Trek results">
          <div className="panel-heading"><span>Trail notes</span><span>{loading ? "UPDATING" : `${treks.length} FOUND`}</span></div>
          <div className="trek-card-list">
        {treks.map((t) => (
          <TrekCard
            key={t.id}
            trek={t}
            isSelected={t.id === selectedId}
            onSelect={setSelectedId}
            onOpenDetail={setDetailId}
          />
        ))}
          {!loading && treks.length === 0 && (
            <div className="empty-trails"><span>⌁</span><strong>No trails match</strong><p>Try widening your filters.</p></div>
          )}
          </div>
        </section>
      </div>

        {detailId && (
          <TrekDetailModal trekId={detailId} onClose={() => setDetailId(null)} onBook={handleBookClick} />
        )}
        {bookingCtx && (
          <BookingModal trek={bookingCtx.trek} stays={bookingCtx.stays} onClose={() => setBookingCtx(null)} />
        )}
    </div>
  );
}
