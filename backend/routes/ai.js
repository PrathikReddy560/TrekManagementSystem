const express = require("express");
const { runAgent } = require("../ai/agent");

const router = express.Router();

// POST /api/ai/plan
// body: { message, daysAvailable, fitness, budgetInr, month, travelers, region? }
router.post("/plan", async (req, res) => {
  const { message, daysAvailable, fitness, budgetInr, month, travelers, region } = req.body || {};

  if (!daysAvailable || !fitness || !budgetInr || !month || !travelers) {
    return res.status(400).json({
      error: "daysAvailable, fitness, budgetInr, month and travelers are all required.",
    });
  }
  if (!["beginner", "intermediate", "advanced"].includes(fitness)) {
    return res.status(400).json({ error: "fitness must be beginner, intermediate or advanced." });
  }

  try {
    const result = await runAgent({
      message: message || "Plan me a good trek.",
      daysAvailable: Number(daysAvailable),
      fitness,
      budgetInr: Number(budgetInr),
      month: Number(month),
      travelers: Number(travelers),
      region,
    });
    res.json(result);
  } catch (err) {
    console.error("AI planning failed:", err);
    const message = String(err.message || "");
    res.status(502).json({
      error: message.startsWith("OpenRouter request failed")
        ? message
        : "The planning agent couldn't complete right now. Check the backend log and OpenRouter key, model, and rate limits.",
    });
  }
});

module.exports = router;
