import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function MyTripsPage({ onRequireAuth }) {
  const { token, user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      onRequireAuth();
      setLoading(false);
      return;
    }
    api
      .myBookings(token)
      .then((res) => setBookings(res.bookings))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) {
    return (
      <div style={{ maxWidth: "600px", margin: "3rem auto", textAlign: "center" }}>
        <p>Sign in to see your trips.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "1.5rem" }}>
      <h1>My trips</h1>
      {loading && <p>Loading…</p>}
      {!loading && bookings.length === 0 && <p style={{ color: "var(--mist)" }}>No bookings yet — go plan one.</p>}
      <div style={{ display: "grid", gap: "0.8rem" }}>
        {bookings.map((b) => (
          <div key={b.id} className="card" style={{ padding: "1rem" }}>
            <h3 style={{ margin: "0 0 0.3rem" }}>{b.trekName}</h3>
            <p style={{ margin: 0, color: "var(--mist)", fontSize: "0.88rem" }}>
              {b.travelers} traveler(s) · from {b.startDate} · {b.nights} night(s)
              {b.stayName ? ` at ${b.stayName}` : ""}
            </p>
            <p style={{ margin: "0.3rem 0 0" }}>Total: ₹{b.totalInr}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
