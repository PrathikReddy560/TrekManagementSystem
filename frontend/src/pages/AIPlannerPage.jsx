import { useEffect, useState } from "react";
import { api } from "../api/client";
import AgentTrace from "../components/AgentTrace";
import { downloadTripCalendar } from "../utils/tripCalendar";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function nextSaturday() {
  const day = new Date();
  day.setDate(day.getDate() + ((6 - day.getDay() + 7) % 7 || 7));
  return day.toISOString().slice(0, 10);
}

const DEFAULT_TRAVEL_DATE = nextSaturday();

export default function AIPlannerPage() {
  const [form, setForm] = useState({
    message: "",
    daysAvailable: 1,
    fitness: "intermediate",
    budgetInr: 3000,
    month: new Date(`${DEFAULT_TRAVEL_DATE}T12:00:00`).getMonth() + 1,
    travelers: 2,
    region: "",
    origin: "Bengaluru",
    travelDate: DEFAULT_TRAVEL_DATE,
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverHealth, setServerHealth] = useState(null);
  const [selectedPickId, setSelectedPickId] = useState(null);
  const [reminderEmail, setReminderEmail] = useState("");
  const [reminderResult, setReminderResult] = useState(null);
  const [reminderError, setReminderError] = useState("");
  const [reminderLoading, setReminderLoading] = useState(false);

  useEffect(() => {
    api.health().then(setServerHealth).catch(() => setServerHealth(null));
  }, []);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "travelDate" && value ? { month: new Date(`${value}T12:00:00`).getMonth() + 1 } : {}),
    }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const res = await api.planDemoTrip(form);
      setResult(res);
      setSelectedPickId(res.plan.picks?.[0]?.trekId || null);
      setReminderResult(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReminders(e) {
    e.preventDefault();
    const pick = result?.plan?.picks?.find((candidate) => candidate.trekId === selectedPickId);
    if (!pick) return;
    setReminderError("");
    setReminderResult(null);
    setReminderLoading(true);
    try {
      const response = await api.scheduleTripReminders({
        email: reminderEmail,
        travelDate: form.travelDate,
        trekName: pick.trekName,
        origin: form.origin,
        packingChecklist: pick.packingChecklist || pick.logistics?.packingChecklist || [],
      });
      setReminderResult(response);
    } catch (err) {
      setReminderError(err.message);
    } finally {
      setReminderLoading(false);
    }
  }

  const selectedPick = result?.plan?.picks?.find((candidate) => candidate.trekId === selectedPickId);

  return (
    <div className="planner-page">
      <header className="planner-intro">
        <div className="section-label">TRIP PLANNER · WESTERN GHATS</div>
        <h1>Plan with the trail in mind.</h1>
        <p>Tell us what kind of weekend you want. The planner checks the route, season and estimated stay costs before it makes a shortlist.</p>
        <div className={`planner-status${serverHealth?.aiMode?.includes("OpenRouter") ? " is-connected" : ""}`}>
          <span className="status-orb" />
          {serverHealth ? (
            serverHealth.aiMode.includes("OpenRouter")
              ? <>OpenRouter key loaded <span>·</span> {serverHealth.aiModel} <span>·</span> {serverHealth.n8nWorkflowConfigured ? "n8n workflow" : "direct backend"}</>
              : <>Local planner active <span>·</span> no OpenRouter key loaded by backend <span>·</span> {serverHealth.n8nWorkflowConfigured ? "n8n workflow" : "direct backend"}</>
          ) : "Checking planner service…"}
        </div>
        {serverHealth?.n8nWorkflowConfigured && <a className="n8n-workflow-link" href="http://localhost:5678" target="_blank" rel="noreferrer">Open the n8n workflow canvas ↗</a>}
      </header>

      <details className="ai-explainer">
        <summary>
          <span className="explainer-icon">✳</span>
          <span><strong>How the AI planner works</strong><small>A tool-using language model, with facts checked by the app</small></span>
          <span className="explainer-toggle">＋</span>
        </summary>
        <div className="explainer-body">
          <p><strong>The model:</strong> OpenRouter connects the app to a language model. By default, TrekAI requests <span className="mono">openrouter/free</span>, which routes to an available free model that supports the needed features. The provider can vary; after a plan runs, its response shows the model ID actually used.</p>
          <p><strong>The AI feature:</strong> this is an LLM agent with function calling (also called tool use). The model reads the trip request, chooses which app function to call, receives its result, and can make another call before writing a recommendation. When n8n is connected, its Webhook → Agent → Response workflow coordinates that request.</p>
          <div className="tool-steps">
            <span><b>01</b> Find matching treks</span>
            <span><b>02</b> Check season windows</span>
            <span><b>03</b> Compare stays and costs</span>
            <span><b>04</b> Explain the trade-offs</span>
          </div>
          <p><strong>What the app controls:</strong> filtering, season labels and arithmetic come from deterministic JavaScript functions over the bundled trek data. The model handles the flexible language and ranking judgment. It is not a custom-trained TrekAI model, and the seed data is not a live source of trail closures or availability.</p>
          <p><strong>Travel and prices:</strong> nearby stays and trek fees come from the demo catalogue. Food, local transfers, and train fares are planning allowances. The train link opens IRCTC to check current services and fares; this project does not book tickets or query live hotel inventory.</p>
          <p><strong>Why use it:</strong> the model can adapt its explanation to a person’s goals while the trace shows which checks informed the result. Without an API key, a fixed local scoring method returns suggestions instead.</p>
          <p><strong>How it differs from a general travel chatbot:</strong> TrekAI focuses on a small Karnataka trek catalogue, checks season and costs with app functions, and exposes the tool trace. Its n8n workflow can hand the chosen plan into reminder automation, while calendar export is available from the same result. The project is a focused demo, not a claim that trip-planning AI is new.</p>
        </div>
      </details>

      <form onSubmit={handleSubmit} className="card planner-form">
        <div className="planner-form-heading"><span>YOUR TRIP BRIEF</span><span>THE START OF THE ROUTE</span></div>
        <div className="planner-message">
          <label>What are you looking for?</label>
          <textarea
            rows={3}
            placeholder="e.g. Two of us, decent fitness, want something scenic but not brutal, weekend trip from Bengaluru"
            value={form.message}
            onChange={set("message")}
            style={{ width: "100%" }}
          />
        </div>
        <div className="planner-fields">
          <div className="planner-field">
            <label>Days available</label>
            <select value={form.daysAvailable} onChange={set("daysAvailable")}>
              <option value={1}>1 day</option>
              <option value={2}>2 days</option>
              <option value={3}>3 days</option>
              <option value={4}>4 days</option>
              <option value={5}>5 days</option>
              <option value={6}>6 days</option>
              <option value={7}>7 days</option>
            </select>
          </div>
          <div className="planner-field">
            <label>Fitness level</label>
            <select value={form.fitness} onChange={set("fitness")}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div className="planner-field">
            <label>Travelers</label>
            <input type="number" min="1" max="12" value={form.travelers} onChange={set("travelers")} />
          </div>
          <div className="planner-field">
            <label>Budget (₹ total)</label>
            <input type="number" min="0" value={form.budgetInr} onChange={set("budgetInr")} />
          </div>
          <div className="planner-field">
            <label>Travel month</label>
            <select value={form.month} onChange={set("month")}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="planner-field">
            <label>Region (optional)</label>
            <input type="text" placeholder="e.g. Kodagu" value={form.region} onChange={set("region")} />
          </div>
          <div className="planner-field">
            <label>Starting city or station</label>
            <input type="text" placeholder="e.g. Bengaluru" value={form.origin} onChange={set("origin")} required />
          </div>
          <div className="planner-field">
            <label>Departure date</label>
            <input type="date" min={new Date().toISOString().slice(0, 10)} value={form.travelDate} onChange={set("travelDate")} required />
          </div>
        </div>
        <button className="btn btn-blaze planner-submit" type="submit" disabled={loading}>
          {loading ? <><span className="loading-spark" /> Checking trails…</> : <>Build my shortlist <span aria-hidden="true">↗</span></>}
        </button>
        {error && <p className="planner-error">{error}</p>}
      </form>

      {result && (
        <div className="planner-results">
          {result.mode === "fallback" && (
            <p className="fallback-note">
              This response used local rules, not a language model. {serverHealth?.aiMode?.includes("OpenRouter")
                ? <>The health check reports OpenRouter is configured, so the frontend may be reaching an older or different backend. Confirm <span className="mono">VITE_API_BASE_URL</span> and restart the server.</>
                : <>The backend did not load an OpenRouter key when it started. Add it to <span className="mono">backend/.env</span>, stop the backend process, and start it again. The key is read at startup; check <span className="mono">http://localhost:4000/api/health</span> for the loaded mode.</>}
            </p>
          )}
          <div className="model-used"><span className="status-orb" />
            {result.mode === "agentic"
              ? <>Generated with <span className="mono">{result.model || serverHealth?.aiModel || "OpenRouter model"}</span> through tool calls</>
              : <>Generated using the local demo scorer</>}
            <span>·</span>{result.orchestration === "n8n-workflow" ? "n8n workflow" : "direct backend demo"}
          </div>
          <p className="planner-summary">{result.plan.summary}</p>

          <div className="planner-picks">
          {result.plan.picks.length === 0 && <p className="empty-trails">No treks match those constraints. Try a wider region, more days, or a different fitness level.</p>}
          {result.plan.picks.map((pick, i) => (
            <div key={pick.trekId} className={`card planner-pick${selectedPickId === pick.trekId ? " is-going" : ""}`} style={{ "--pick-index": i }}>
              <div className="pick-heading">
                <div><span className="pick-index">OPTION 0{i + 1}</span><h3>
                  {i + 1}. {pick.trekName}
                </h3></div>
                <span className={`difficulty-tag difficulty-${pick.seasonFit === "ideal" ? "easy" : pick.seasonFit === "caution" ? "moderate" : "hard"}`}>
                  season: {pick.seasonFit}
                </span>
              </div>
              <p className="pick-reason">{pick.whyThisPick}</p>
              <div className="full-trip-budget">
                <span>ESTIMATED WHOLE-TRIP BUDGET · GROUP</span>
                <strong>₹{pick.estimatedTotalRangeInr?.low ?? pick.logistics?.costEstimateGroupInr?.low ?? pick.estimatedTotalInr}–₹{pick.estimatedTotalRangeInr?.high ?? pick.logistics?.costEstimateGroupInr?.high ?? pick.estimatedTotalInr}</strong>
              </div>
              {pick.logistics && <TripLogistics logistics={pick.logistics} />}
              <h4>Day by day</h4>
              <ol style={{ paddingLeft: "1.2rem" }}>
                {pick.itinerary.map((d) => (
                  <li key={d.day}>{d.plan}</li>
                ))}
              </ol>
              <PackingChecklist items={pick.packingChecklist || pick.logistics?.packingChecklist || pick.packingTips || []} />
              <div className="plan-actions">
                <button className={`btn ${selectedPickId === pick.trekId ? "btn-blaze" : "btn-outline"}`} onClick={() => setSelectedPickId(pick.trekId)}>
                  {selectedPickId === pick.trekId ? "✓ My chosen plan" : "Choose this plan"}
                </button>
                <button className="btn btn-outline" onClick={() => downloadTripCalendar(result.plan, pick, form)}>
                  Add to calendar <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
          ))}
          </div>

          {result.plan.notConsidered && (
            <p className="not-considered">{result.plan.notConsidered}</p>
          )}

          {selectedPick && <form className="reminder-card" onSubmit={handleReminders}>
            <div><span className="modal-kicker">A LITTLE NUDGE BEFORE YOU GO</span><h3>Email me the checklist</h3><p>n8n can schedule a one-week and one-day reminder with your trek details and packing list.</p></div>
            <div className="reminder-form-row"><input type="email" value={reminderEmail} onChange={(e) => setReminderEmail(e.target.value)} placeholder="you@example.com" required aria-label="Email address for reminders" /><button className="btn btn-blaze" disabled={reminderLoading}>{reminderLoading ? "Setting reminders…" : "Schedule reminders"}</button></div>
            {reminderError && <p className="planner-error">{reminderError}</p>}
            {reminderResult && <div className="reminder-confirmation"><strong>{reminderResult.mode === "preview" ? "Reminder preview ready" : "Reminder workflow started"}</strong><span>{reminderResult.message}</span>{reminderResult.schedule?.map((item) => <small key={item.label}>{item.label} · {new Date(item.at).toLocaleString()}</small>)}</div>}
          </form>}

          <AgentTrace trace={result.trace} mode={result.mode} />
        </div>
      )}
    </div>
  );
}

function TripLogistics({ logistics }) {
  return <div className="logistics-panel">
    <div className="logistics-panel-heading"><span>THE GETTING THERE & BACK</span><span>DEMO ESTIMATES</span></div>
    <div className="logistics-grid">
      <div><span>TRAIN ROUTE</span><strong>{logistics.origin} → {logistics.railhead}</strong><small>Return budget / person ₹{logistics.trainFareReturnPerPersonInr.low}–₹{logistics.trainFareReturnPerPersonInr.high}</small><a href={logistics.trainSearchUrl} target="_blank" rel="noreferrer">Check live trains & fares ↗</a></div>
      <div><span>NEARBY STAY</span><strong>{logistics.stay?.name || "No seeded stay listed"}</strong><small>{logistics.stay ? `₹${logistics.stay.pricePerNightInr}/night · ${logistics.stay.nights} night(s)` : "Check locally"}</small></div>
      <div><span>FOOD ALLOWANCE</span><strong>₹{logistics.food.groupTotalInr} group total</strong><small>₹{logistics.food.perPersonPerDayInr} / person / day · demo estimate</small></div>
      <div><span>TREK TICKET / GUIDE</span><strong>₹{logistics.trekTicketAndGuideGroupInr} group total</strong><small>From the app's trek seed data</small></div>
      <div><span>LOCAL TRANSFER</span><strong>₹{logistics.localTransferGroupInr} group allowance</strong><small>Station to trailhead · demo estimate</small></div>
    </div>
    <p className="logistics-disclaimer">{logistics.transportNote} {logistics.costEstimateNote}</p>
    {logistics.otherStayOptions?.length > 0 && <details className="other-stays"><summary>More nearby stays</summary>{logistics.otherStayOptions.map((stay) => <span key={stay.name}>{stay.name} · ₹{stay.pricePerNightInr}/night</span>)}</details>}
  </div>;
}

function PackingChecklist({ items }) {
  const [checked, setChecked] = useState({});
  return <div className="packing-note">
    <div className="packing-heading"><span>PACKING CHECKLIST</span><span>{Object.values(checked).filter(Boolean).length}/{items.length} READY</span></div>
    <div className="packing-list">{items.map((item) => <label key={item} className={checked[item] ? "is-packed" : ""}><input type="checkbox" checked={Boolean(checked[item])} onChange={(e) => setChecked((current) => ({ ...current, [item]: e.target.checked }))} /><span>{item}</span></label>)}</div>
  </div>;
}
