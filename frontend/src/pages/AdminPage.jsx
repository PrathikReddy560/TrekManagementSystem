import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

const EMPTY_FORM = {
  name: "",
  altName: "",
  region: "",
  baseVillage: "",
  lat: "",
  lng: "",
  difficulty: "easy",
  durationDays: "1",
  distanceKm: "",
  maxElevationM: "",
  baseFeeInr: "",
  bestMonths: "9, 10, 11, 12, 1, 2",
  avoidMonths: "6, 7, 8",
  terrain: "",
  highlights: "",
  description: "",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parseMonths(value) {
  return value.split(",").map((month) => Number(month.trim())).filter((month) => Number.isInteger(month));
}

function parseList(value) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function formatInr(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}

export default function AdminPage() {
  const { token, user } = useAuth();
  const [treks, setTreks] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [overview, setOverview] = useState(null);
  const [question, setQuestion] = useState("");
  const [advisor, setAdvisor] = useState(null);
  const [asking, setAsking] = useState(false);

  async function loadTreks() {
    setLoading(true);
    try {
      const data = await api.searchTreks();
      setTreks(data.treks);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadOverview() {
    try {
      setOverview(await api.adminOverview(token));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (user?.isAdmin) {
      loadTreks();
      loadOverview();
    }
    else setLoading(false);
  }, [user, token]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const payload = {
        ...form,
        bestMonths: parseMonths(form.bestMonths),
        avoidMonths: parseMonths(form.avoidMonths),
        highlights: parseList(form.highlights),
      };
      const data = await api.createTrek(payload, token);
      setTreks((current) => [...current, data.trek]);
      setForm(EMPTY_FORM);
      setNotice(`${data.trek.name} added to the catalogue.`);
      loadOverview();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(trek) {
    if (!window.confirm(`Delete ${trek.name} from the catalogue?`)) return;
    setError("");
    setNotice("");
    try {
      await api.deleteTrek(trek.id, token);
      setTreks((current) => current.filter((item) => item.id !== trek.id));
      setNotice(`${trek.name} was deleted.`);
      loadOverview();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAskAdvisor(event) {
    event.preventDefault();
    setAsking(true);
    setError("");
    try {
      setAdvisor(await api.askAdminAdvisor(question, token));
    } catch (err) {
      setError(err.message);
    } finally {
      setAsking(false);
    }
  }

  if (!user) {
    return <main className="admin-page"><div className="admin-empty card"><span className="section-label">CATALOGUE ACCESS</span><h1>Sign in to manage treks.</h1><p>Ask an administrator to add your email to the backend admin allowlist.</p></div></main>;
  }

  if (!user.isAdmin) {
    return <main className="admin-page"><div className="admin-empty card"><span className="section-label">CATALOGUE ACCESS</span><h1>This area is restricted.</h1><p>Your account does not have catalogue management permissions.</p></div></main>;
  }

  return (
    <main className="admin-page">
      <header className="admin-heading">
        <div>
          <span className="section-label">ADMIN · TREK CATALOGUE</span>
          <h1>Shape the trail list.</h1>
          <p>Add a new route or remove one that is no longer available.</p>
        </div>
        <span className="admin-count">{treks.length} routes</span>
      </header>

      {error && <p className="admin-message is-error">{error}</p>}
      {notice && <p className="admin-message is-success">{notice}</p>}

      {overview && (
        <>
          <section className="admin-metrics" aria-label="Sales overview">
            <article className="admin-metric"><span>Gross booked value</span><strong>{formatInr(overview.metrics.grossRevenueInr)}</strong><small>All confirmed bookings · not profit</small></article>
            <article className="admin-metric"><span>Confirmed bookings</span><strong>{overview.metrics.confirmedBookings}</strong><small>{overview.metrics.travelersBooked} travelers booked</small></article>
            <article className="admin-metric"><span>Avg. booking value</span><strong>{formatInr(overview.metrics.averageBookingValueInr)}</strong><small>Gross value per booking</small></article>
            <article className="admin-metric"><span>Current month</span><strong>{formatInr(overview.metrics.currentMonthGrossRevenueInr)}</strong><small>{overview.metrics.currentMonthBookings} bookings</small></article>
          </section>

          <section className="admin-insight-grid">
            <div className="admin-panel">
              <div className="panel-heading"><span>Sales trend</span><span>last 6 months</span></div>
              <div className="sales-chart" role="img" aria-label="Gross booking revenue by month">
                {overview.monthlySales.map((month) => {
                  const max = Math.max(...overview.monthlySales.map((item) => item.grossRevenueInr), 1);
                  return <div className="sales-column" key={month.key} title={`${month.label}: ${formatInr(month.grossRevenueInr)} from ${month.bookings} bookings`}>
                    <strong>{month.grossRevenueInr ? formatInr(month.grossRevenueInr) : ""}</strong>
                    <div className="sales-bar-track"><span style={{ height: `${Math.max(3, month.grossRevenueInr / max * 100)}%` }} /></div>
                    <small>{month.label}</small>
                  </div>;
                })}
              </div>
              <p className="admin-data-note">Based on booking creation date. A zero bar means no confirmed booking was recorded for that month.</p>
            </div>

            <div className="admin-panel">
              <div className="panel-heading"><span>Season ahead</span><span>next 6 months</span></div>
              <div className="season-coverage">
                {overview.seasonalCoverage.map((month) => <div className="season-row" key={`${month.month}-${month.label}`}>
                  <span>{month.label}</span><div className="coverage-track"><span style={{ width: `${Math.max(0, month.trekCount / Math.max(overview.metrics.catalogTreks, 1) * 100)}%` }} /></div><strong>{month.trekCount}</strong>
                </div>)}
              </div>
              <p className="admin-data-note">Counts are based on each trek’s configured best-season months, not live access or demand.</p>
            </div>
          </section>

          <section className="admin-panel admin-recommendations">
            <div className="panel-heading"><span>Portfolio signals</span><span>data-led · no automatic changes</span></div>
            <div className="recommendation-list">
              {overview.recommendations.map((item) => <article className="recommendation-row" key={item.title}>
                <span className={`priority-mark priority-${item.priority}`} />
                <div><strong>{item.title}</strong><p>{item.detail}</p></div>
              </article>)}
            </div>
          </section>

          <section className="admin-panel admin-performance">
            <div className="panel-heading"><span>Trek performance</span><span>ranked by gross revenue</span></div>
            <div className="admin-table-wrap"><table className="admin-table">
              <thead><tr><th>Trek</th><th>Bookings</th><th>Travelers</th><th>Gross booked</th><th>Base fee</th></tr></thead>
              <tbody>{overview.trekPerformance.map((trek) => <tr key={trek.trekId}>
                <td><strong>{trek.trekName}</strong><small>{trek.region} · {trek.difficulty}</small></td>
                <td>{trek.bookings}</td><td>{trek.travelers}</td><td>{formatInr(trek.grossRevenueInr)}</td><td>{formatInr(trek.baseFeeInr)}</td>
              </tr>)}</tbody>
            </table></div>
            <p className="admin-data-note">This demo records a booking total when a booking is confirmed. It does not record operating cost, refunds or payment settlement, so profit is unavailable.</p>
          </section>

          <section className="admin-panel admin-advisor">
            <div className="panel-heading"><span>AI portfolio advisor</span><span>{advisor?.mode === "ai" ? advisor.model : "grounded in dashboard data"}</span></div>
            <p>Ask about sales, seasonal gaps, pricing signals or which listings deserve review. The advisor only receives aggregate dashboard data.</p>
            <form className="advisor-form" onSubmit={handleAskAdvisor}>
              <input aria-label="Question for the AI advisor" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What should we prioritize for the next season?" required maxLength={1200} />
              <button className="btn btn-blaze" disabled={asking}>{asking ? "Reviewing…" : "Ask advisor"}</button>
            </form>
            {advisor && <div className="advisor-answer"><p>{advisor.answer}</p>{advisor.actions?.length > 0 && <ul>{advisor.actions.map((action, index) => <li key={`${action.title}-${index}`}><strong>{action.title}</strong><span>{action.detail}</span></li>)}</ul>}</div>}
          </section>
          <p className="admin-caveat">{overview.caveats.join(" ")}</p>
        </>
      )}

      <div className="admin-layout">
        <form className="card admin-form" onSubmit={handleSubmit}>
          <div className="panel-heading"><span>New trek</span><span>all fields matter</span></div>
          <div className="admin-form-grid">
            <div className="admin-field admin-field-wide"><label>Name</label><input value={form.name} onChange={set("name")} required /></div>
            <div className="admin-field"><label>Also known as</label><input value={form.altName} onChange={set("altName")} /></div>
            <div className="admin-field"><label>Region</label><input value={form.region} onChange={set("region")} required /></div>
            <div className="admin-field"><label>Base village</label><input value={form.baseVillage} onChange={set("baseVillage")} required /></div>
            <div className="admin-field"><label>Difficulty</label><select value={form.difficulty} onChange={set("difficulty")}><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="hard">Hard</option></select></div>
            <div className="admin-field"><label>Duration (days)</label><input type="number" min="1" value={form.durationDays} onChange={set("durationDays")} required /></div>
            <div className="admin-field"><label>Distance (km)</label><input type="number" min="0" step="0.1" value={form.distanceKm} onChange={set("distanceKm")} required /></div>
            <div className="admin-field"><label>Elevation (m)</label><input type="number" min="0" value={form.maxElevationM} onChange={set("maxElevationM")} required /></div>
            <div className="admin-field"><label>Base fee (INR)</label><input type="number" min="0" value={form.baseFeeInr} onChange={set("baseFeeInr")} required /></div>
            <div className="admin-field"><label>Latitude</label><input type="number" step="0.001" value={form.lat} onChange={set("lat")} required /></div>
            <div className="admin-field"><label>Longitude</label><input type="number" step="0.001" value={form.lng} onChange={set("lng")} required /></div>
            <div className="admin-field"><label>Best months</label><input value={form.bestMonths} onChange={set("bestMonths")} required /><small>{MONTHS.join(" · ")}</small></div>
            <div className="admin-field"><label>Avoid months</label><input value={form.avoidMonths} onChange={set("avoidMonths")} /><small>Comma-separated month numbers</small></div>
            <div className="admin-field admin-field-wide"><label>Terrain</label><input value={form.terrain} onChange={set("terrain")} required /></div>
            <div className="admin-field admin-field-wide"><label>Highlights <small>one per line</small></label><textarea rows="3" value={form.highlights} onChange={set("highlights")} required /></div>
            <div className="admin-field admin-field-wide"><label>Description</label><textarea rows="4" value={form.description} onChange={set("description")} required /></div>
          </div>
          <button className="btn btn-blaze" type="submit" disabled={saving}>{saving ? "Adding route…" : "Add trek"}</button>
        </form>

        <section className="admin-list">
          <div className="panel-heading"><span>Current routes</span><span>{loading ? "loading" : "catalogue"}</span></div>
          {loading ? <div className="card admin-loading">Loading routes…</div> : treks.map((trek) => (
            <article className="card admin-trek" key={trek.id}>
              <div><span className="admin-trek-meta">{trek.region} · {trek.durationDays} day{trek.durationDays === 1 ? "" : "s"}</span><h2>{trek.name}</h2><p>{trek.description}</p></div>
              <button className="admin-delete" type="button" onClick={() => handleDelete(trek)} aria-label={`Delete ${trek.name}`} title={`Delete ${trek.name}`}>×</button>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
