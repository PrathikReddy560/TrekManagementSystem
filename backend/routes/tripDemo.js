const express = require("express");
const { runAgent } = require("../ai/agent");
const { getTripLogistics } = require("../ai/tripLogistics");

const router = express.Router();

function normalizePlanInput(body = {}) {
  return {
    message: String(body.message || "Plan a safe, budget-conscious trek for me."),
    daysAvailable: Number(body.daysAvailable),
    fitness: body.fitness,
    budgetInr: Number(body.budgetInr),
    month: Number(body.month),
    travelers: Number(body.travelers),
    region: body.region ? String(body.region) : "",
    origin: String(body.origin || "Bengaluru"),
    travelDate: String(body.travelDate || ""),
  };
}

function validatePlan(input) {
  if (!input.daysAvailable || !input.budgetInr || !input.month || !input.travelers) {
    return "Days, budget, travel month, and traveler count are required.";
  }
  if (!Number.isFinite(input.budgetInr) || input.budgetInr < 1) return "Enter a budget greater than ₹0.";
  if (!Number.isInteger(input.daysAvailable) || input.daysAvailable < 1 || input.daysAvailable > 7) return "Days available must be between 1 and 7.";
  if (!Number.isInteger(input.travelers) || input.travelers < 1 || input.travelers > 12) return "Traveler count must be between 1 and 12.";
  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) return "Choose a valid travel month.";
  if (!["beginner", "intermediate", "advanced"].includes(input.fitness)) return "Choose a valid fitness level.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.travelDate)) return "Choose a travel date.";
  if (new Date(`${input.travelDate}T00:00:00`).getTime() < new Date(new Date().toDateString()).getTime()) return "Choose a future travel date.";
  return null;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(180000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Workflow request failed (${response.status}).`);
  return data;
}

async function runBackendAgent(input) {
  const result = await runAgent(input);
  const picks = result.plan?.picks || [];
  result.plan.picks = picks.map((pick) => {
    const logistics = getTripLogistics({
      trekId: pick.trekId,
      travelers: input.travelers,
      days: Math.max(1, Math.min(input.daysAvailable, pick.itinerary?.length || input.daysAvailable, 7)),
      origin: input.origin,
    });
    if (!result.trace.some((step) => step.tool === "get_trip_logistics" && step.input?.trekId === pick.trekId)) {
      result.trace.push({
        tool: "get_trip_logistics",
        input: { trekId: pick.trekId, travelers: input.travelers, days: input.daysAvailable, origin: input.origin },
        output: logistics,
      });
    }
    return {
      ...pick,
      estimatedTotalInr: logistics.costEstimateGroupInr.low,
      estimatedTotalRangeInr: logistics.costEstimateGroupInr,
      logistics,
      packingChecklist: logistics.packingChecklist,
    };
  });
  return { ...result, orchestration: "backend-demo" };
}

router.post("/plan", async (req, res) => {
  const input = normalizePlanInput(req.body);
  const validationError = validatePlan(input);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    if (process.env.N8N_PLAN_WEBHOOK_URL) {
      const result = await postJson(process.env.N8N_PLAN_WEBHOOK_URL, input);
      return res.json({ ...result, orchestration: "n8n-workflow" });
    }

    return res.json(await runBackendAgent(input));
  } catch (error) {
    console.error("Trip workflow failed:", error);
    return res.status(502).json({
      error: process.env.N8N_PLAN_WEBHOOK_URL
        ? `The n8n planning workflow could not complete: ${error.message}`
        : "The trip planner could not complete. Check the backend log and OpenRouter configuration.",
    });
  }
});

// n8n's imported workflow calls this endpoint after receiving the user's brief.
router.post("/agent", async (req, res) => {
  const input = normalizePlanInput(req.body);
  const validationError = validatePlan(input);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    return res.json(await runBackendAgent(input));
  } catch (error) {
    console.error("Trip agent failed:", error);
    return res.status(502).json({ error: "The trip agent could not complete. Check the OpenRouter key, model, and rate limits." });
  }
});

router.post("/reminders", async (req, res) => {
  const { email, travelDate, trekName, origin, packingChecklist = [] } = req.body || {};
  if (!/^\S+@\S+\.\S+$/.test(String(email || ""))) return res.status(400).json({ error: "Enter a valid email address for reminders." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(travelDate || ""))) return res.status(400).json({ error: "Choose a travel date before scheduling reminders." });
  if (new Date(`${travelDate}T00:00:00`).getTime() < new Date(new Date().toDateString()).getTime()) return res.status(400).json({ error: "Choose a future travel date." });

  const reminder = {
    email: String(email),
    travelDate: String(travelDate),
    trekName: String(trekName || "Your trek"),
    origin: String(origin || "Bengaluru"),
    packingChecklist: Array.isArray(packingChecklist) ? packingChecklist.map(String).slice(0, 20) : [],
  };

  try {
    if (process.env.N8N_REMINDER_WEBHOOK_URL) {
      const result = await postJson(process.env.N8N_REMINDER_WEBHOOK_URL, reminder);
      return res.json({ ...result, orchestration: "n8n-workflow" });
    }

    const tripStart = new Date(`${travelDate}T09:00:00`).getTime();
    const schedule = [
      { label: "One week before", at: new Date(tripStart - 7 * 86400000) },
      { label: "One day before", at: new Date(tripStart - 86400000) },
    ].filter(({ at }) => at.getTime() > Date.now());
    return res.json({
      mode: "preview",
      orchestration: "local-preview",
      message: "Reminder preview created. Connect the n8n reminder workflow and configure its email credential to schedule real messages.",
      schedule: schedule.map(({ label, at }) => ({ label, at: at.toISOString() })),
      email: reminder.email,
    });
  } catch (error) {
    console.error("Reminder workflow failed:", error);
    return res.status(502).json({ error: `The n8n reminder workflow could not be reached: ${error.message}` });
  }
});

module.exports = router;
