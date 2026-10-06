import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const DIFFICULTY_COLOR = {
  easy: "#3f5c4a",
  moderate: "#b8862e",
  hard: "#a6402c",
};

// Centered roughly on Karnataka so every seeded trek is in view on load.
const KARNATAKA_CENTER = [13.4, 76.0];

export default function MapView({ treks, selectedId, onSelect, onOpenDetail }) {
  return (
    <MapContainer
      center={KARNATAKA_CENTER}
      zoom={7}
      style={{ height: "100%", width: "100%", borderRadius: "5px" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {treks.map((t) => (
        <CircleMarker
          key={t.id}
          center={[t.lat, t.lng]}
          radius={t.id === selectedId ? 11 : 8}
          pathOptions={{
            color: DIFFICULTY_COLOR[t.difficulty],
            fillColor: DIFFICULTY_COLOR[t.difficulty],
            fillOpacity: t.id === selectedId ? 0.95 : 0.75,
            weight: t.id === selectedId ? 3 : 1.5,
          }}
          eventHandlers={{ click: () => onSelect(t.id) }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            {t.name}
          </Tooltip>
          <Popup className="trek-map-popup">
            <div className="map-popup-content">
              <div className="map-popup-kicker">{t.region}</div>
              <strong>{t.name}</strong>
              <p>{t.description}</p>
              <div className="map-popup-stats">
                <span>{t.difficulty}</span>
                <span>{t.durationDays} {t.durationDays === 1 ? "day" : "days"}</span>
                <span>{t.distanceKm} km</span>
                <span>{t.maxElevationM} m high</span>
              </div>
              <button
                className="btn btn-blaze map-popup-button"
                onClick={() => onOpenDetail(t.id)}
              >
                View trek details <span aria-hidden="true">↗</span>
              </button>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
