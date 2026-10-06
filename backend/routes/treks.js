const express = require("express");
const crypto = require("crypto");
const { readJsonAsset, writeJsonAsset } = require("../data/store");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

const REQUIRED_FIELDS = [
  "name", "region", "baseVillage", "lat", "lng", "difficulty", "durationDays",
  "distanceKm", "maxElevationM", "baseFeeInr", "terrain", "description",
];

function normalizeTrek(body = {}) {
  const trek = {
    id: String(body.id || body.name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name: String(body.name || "").trim(),
    altName: body.altName ? String(body.altName).trim() : null,
    region: String(body.region || "").trim(),
    baseVillage: String(body.baseVillage || "").trim(),
    lat: Number(body.lat),
    lng: Number(body.lng),
    mapX: Number(body.mapX || 0),
    mapY: Number(body.mapY || 0),
    difficulty: String(body.difficulty || "").trim(),
    durationDays: Number(body.durationDays),
    distanceKm: Number(body.distanceKm),
    maxElevationM: Number(body.maxElevationM),
    bestMonths: Array.isArray(body.bestMonths) ? body.bestMonths.map(Number).filter(Number.isInteger) : [],
    avoidMonths: Array.isArray(body.avoidMonths) ? body.avoidMonths.map(Number).filter(Number.isInteger) : [],
    baseFeeInr: Number(body.baseFeeInr),
    terrain: String(body.terrain || "").trim(),
    highlights: Array.isArray(body.highlights) ? body.highlights.map(String).map((value) => value.trim()).filter(Boolean) : [],
    description: String(body.description || "").trim(),
  };
  return trek;
}

function validateTrek(trek) {
  if (REQUIRED_FIELDS.some((field) => !trek[field] && trek[field] !== 0)) return "Name, location, route details, difficulty and description are required.";
  if (!/^(easy|moderate|hard)$/.test(trek.difficulty)) return "Difficulty must be easy, moderate or hard.";
  if ([trek.lat, trek.lng, trek.durationDays, trek.distanceKm, trek.maxElevationM, trek.baseFeeInr].some((value) => !Number.isFinite(value) || value < 0)) return "Numeric trek details must be valid positive numbers.";
  if (!trek.bestMonths.length || trek.bestMonths.some((month) => month < 1 || month > 12)) return "Add at least one valid best month.";
  if (trek.avoidMonths.some((month) => month < 1 || month > 12)) return "Avoid months must be between 1 and 12.";
  if (!trek.highlights.length) return "Add at least one highlight.";
  return null;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// GET /api/treks?difficulty=&maxDays=&month=&region=&near=lat,lng&radiusKm=
router.get("/", (req, res) => {
  const treks = readJsonAsset("treks.json");
  const { difficulty, maxDays, month, region, near, radiusKm } = req.query;

  let results = treks;

  if (difficulty) {
    results = results.filter((t) => t.difficulty === difficulty);
  }
  if (maxDays) {
    results = results.filter((t) => t.durationDays <= Number(maxDays));
  }
  if (region) {
    results = results.filter((t) => t.region.toLowerCase().includes(String(region).toLowerCase()));
  }
  if (month) {
    const m = Number(month);
    results = results.filter((t) => t.bestMonths.includes(m));
  }
  if (near) {
    const [lat, lng] = String(near).split(",").map(Number);
    const radius = radiusKm ? Number(radiusKm) : 150;
    results = results
      .map((t) => ({ ...t, distanceFromYouKm: Math.round(haversineKm(lat, lng, t.lat, t.lng)) }))
      .filter((t) => t.distanceFromYouKm <= radius)
      .sort((a, b) => a.distanceFromYouKm - b.distanceFromYouKm);
  }

  res.json({ count: results.length, treks: results });
});

// GET /api/treks/:id
router.get("/:id", (req, res) => {
  const treks = readJsonAsset("treks.json");
  const trek = treks.find((t) => t.id === req.params.id);
  if (!trek) return res.status(404).json({ error: "Trek not found." });
  res.json({ trek });
});

// GET /api/treks/:id/stays
router.get("/:id/stays", (req, res) => {
  const stays = readJsonAsset("stays.json");
  const matches = stays.filter((s) => s.trekId === req.params.id);
  res.json({ count: matches.length, stays: matches });
});

router.post("/", requireAdmin, (req, res) => {
  const trek = normalizeTrek(req.body);
  const error = validateTrek(trek);
  if (error) return res.status(400).json({ error });

  const treks = readJsonAsset("treks.json");
  if (treks.some((item) => item.id === trek.id)) return res.status(409).json({ error: "A trek with that ID already exists." });
  trek.id = trek.id || crypto.randomUUID();
  treks.push(trek);
  writeJsonAsset("treks.json", treks);
  res.status(201).json({ trek });
});

router.delete("/:id", requireAdmin, (req, res) => {
  const treks = readJsonAsset("treks.json");
  const nextTreks = treks.filter((trek) => trek.id !== req.params.id);
  if (nextTreks.length === treks.length) return res.status(404).json({ error: "Trek not found." });
  writeJsonAsset("treks.json", nextTreks);
  res.json({ deletedId: req.params.id });
});

module.exports = router;
