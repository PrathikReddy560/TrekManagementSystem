const express = require("express");
const crypto = require("crypto");
const { readTable, writeTable, readJsonAsset } = require("../data/store");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// POST /api/bookings  (auth required)
// body: { trekId, stayId?, travelers, startDate }
router.post("/", requireAuth, (req, res) => {
  const { trekId, stayId, travelers, startDate } = req.body || {};
  if (!trekId || !travelers || !startDate) {
    return res.status(400).json({ error: "trekId, travelers and startDate are required." });
  }

  const treks = readJsonAsset("treks.json");
  const trek = treks.find((t) => t.id === trekId);
  if (!trek) return res.status(404).json({ error: "Trek not found." });

  let stay = null;
  if (stayId) {
    const stays = readJsonAsset("stays.json");
    stay = stays.find((s) => s.id === stayId && s.trekId === trekId) || null;
    if (!stay) return res.status(404).json({ error: "That stay isn't available for this trek." });
  }

  const nights = Math.max(trek.durationDays - 1, 0);
  const totalInr = trek.baseFeeInr * Number(travelers) + (stay ? stay.pricePerNightInr * nights : 0);

  const booking = {
    id: crypto.randomUUID(),
    userId: req.user.id,
    trekId,
    trekName: trek.name,
    stayId: stay?.id || null,
    stayName: stay?.name || null,
    travelers: Number(travelers),
    startDate,
    nights,
    totalInr,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };

  const bookings = readTable("bookings");
  bookings.push(booking);
  writeTable("bookings", bookings);

  res.status(201).json({ booking });
});

// GET /api/bookings/my  (auth required)
router.get("/my", requireAuth, (req, res) => {
  const bookings = readTable("bookings").filter((b) => b.userId === req.user.id);
  res.json({ count: bookings.length, bookings });
});

module.exports = router;
