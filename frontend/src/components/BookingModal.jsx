import { useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function BookingModal({ trek, stays, onClose }) {
  const { token } = useAuth();
  const [travelers, setTravelers] = useState(2);
  const [startDate, setStartDate] = useState("");
  const [stayId, setStayId] = useState(stays[0]?.id || "");
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!startDate) {
      setError("Pick a start date.");
      return;
    }
    setSubmitting(true);
    try {
      const { booking } = await api.createBooking(
        { trekId: trek.id, stayId: stayId || undefined, travelers: Number(travelers), startDate },
        token
      );
      setBooking(booking);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title" onClick={(e) => e.stopPropagation()}>
        {booking ? (
          <>
            <div className="modal-heading"><div><span className="modal-kicker">YOUR TRAIL IS SET</span><h2 id="booking-title">Booking confirmed</h2></div><button className="modal-close" onClick={onClose} aria-label="Close booking confirmation">×</button></div>
            <p>
              You're booked on <strong>{booking.trekName}</strong> for {booking.travelers} traveler(s) starting{" "}
              {booking.startDate}.
            </p>
            <p style={{ color: "var(--mist)" }}>
              Confirmation ID: <span className="mono">{booking.id}</span>
              <br />
              Total: ₹{booking.totalInr}
            </p>
            <button className="btn" style={{ width: "100%" }} onClick={onClose}>
              Done
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-heading"><div><span className="modal-kicker">TRAIL RESERVATION</span><h2 id="booking-title">Book {trek.name}</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label="Close booking form">×</button></div>
            <div style={{ display: "grid", gap: "0.8rem" }}>
              <div>
                <label>Number of travelers</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={travelers}
                  onChange={(e) => setTravelers(e.target.value)}
                />
              </div>
              <div>
                <label>Start date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              {stays.length > 0 && (
                <div>
                  <label>Stay</label>
                  <select value={stayId} onChange={(e) => setStayId(e.target.value)}>
                    <option value="">No stay — trek only</option>
                    {stays.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — ₹{s.pricePerNightInr}/night
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {error && <p style={{ color: "var(--blaze)", margin: 0 }}>{error}</p>}
              <button className="btn btn-blaze" type="submit" disabled={submitting}>
                {submitting ? "Booking…" : "Confirm booking"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
