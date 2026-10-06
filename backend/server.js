const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const trekRoutes = require("./routes/treks");
const bookingRoutes = require("./routes/bookings");
const aiRoutes = require("./routes/ai");
const tripDemoRoutes = require("./routes/tripDemo");
const adminRoutes = require("./routes/admin");
const { ensureDb } = require("./data/store");

const app = express();
const PORT = process.env.PORT || 4000;

ensureDb();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    aiMode: process.env.OPENROUTER_API_KEY ? "agentic (OpenRouter)" : "fallback (rule-based, no API key set)",
    aiModel: process.env.OPENROUTER_API_KEY ? (process.env.OPENROUTER_MODEL || "openrouter/free") : null,
    n8nWorkflowConfigured: Boolean(process.env.N8N_PLAN_WEBHOOK_URL),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/treks", trekRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/trip-demo", tripDemoRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our end." });
});

app.listen(PORT, () => {
  console.log(`TrekAI backend listening on http://localhost:${PORT}`);
  console.log(
    process.env.OPENROUTER_API_KEY
      ? `AI planner: agentic mode (OpenRouter: ${process.env.OPENROUTER_MODEL || "openrouter/free"})`
      : "AI planner: fallback mode (no OPENROUTER_API_KEY set — add one to .env to enable the full agent)"
  );
});
