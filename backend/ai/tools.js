// ai/tools.js
//
// These are the "hands" of the agent: small, deterministic, auditable
// functions over our own data. We deliberately do NOT ask the language
// model to filter treks, judge seasonal safety, or do arithmetic itself —
// those are exactly the things a rule/lookup/calculator does reliably and
// a language model does inconsistently. The model's job (see agent.js) is
// the part code can't do: weighing several correct-but-competing facts
// against a person's fuzzy, natural-language goals and explaining the
// trade-off in plain language.
//
// Each tool below is exported twice: once as a plain function (used by the
// deterministic fallback planner when no API key is configured) and once
// wrapped with a JSON Schema description (converted to OpenRouter's
// OpenAI-compatible function tool format in agent.js).

const { readJsonAsset } = require("../data/store");
const { getTripLogistics } = require("./tripLogistics");

const DIFFICULTY_RANK = { easy: 1, moderate: 2, hard: 3 };
const FITNESS_CEILING = { beginner: "easy", intermediate: "moderate", advanced: "hard" };

function searchTreks({ maxDays, fitness, region } = {}) {
  const treks = readJsonAsset("treks.json");
  const ceiling = FITNESS_CEILING[fitness] || "hard";
  return treks
    .filter((t) => (maxDays ? t.durationDays <= Number(maxDays) : true))
    .filter((t) => DIFFICULTY_RANK[t.difficulty] <= DIFFICULTY_RANK[ceiling])
    .filter((t) => (region ? t.region.toLowerCase().includes(String(region).toLowerCase()) : true))
    .map((t) => ({
      id: t.id,
      name: t.name,
      region: t.region,
      difficulty: t.difficulty,
      durationDays: t.durationDays,
      distanceKm: t.distanceKm,
      maxElevationM: t.maxElevationM,
      baseFeeInr: t.baseFeeInr,
      bestMonths: t.bestMonths,
      highlights: t.highlights,
    }));
}

function getStaysNear({ trekId } = {}) {
  const stays = readJsonAsset("stays.json");
  return stays.filter((s) => s.trekId === trekId);
}

function checkSeasonFit({ trekId, month } = {}) {
  const treks = readJsonAsset("treks.json");
  const trek = treks.find((t) => t.id === trekId);
  if (!trek) return { error: `Unknown trekId "${trekId}"` };
  const m = Number(month);

  if (trek.avoidMonths.includes(m)) {
    return {
      trekId,
      month: m,
      fit: "avoid",
      reason: `${trek.name} is in its monsoon/off window that month — expect leeches, slippery rock and possible trail closures.`,
    };
  }
  if (trek.bestMonths.includes(m)) {
    return {
      trekId,
      month: m,
      fit: "ideal",
      reason: `${trek.name} is within its best trekking window that month — clear trails and good visibility are typical.`,
    };
  }
  return {
    trekId,
    month: m,
    fit: "caution",
    reason: `${trek.name} is trekkable that month but outside its ideal window — check local conditions closer to the date.`,
  };
}

function estimateBudget({ trekId, travelers, nights, stayId } = {}) {
  const treks = readJsonAsset("treks.json");
  const stays = readJsonAsset("stays.json");
  const trek = treks.find((t) => t.id === trekId);
  if (!trek) return { error: `Unknown trekId "${trekId}"` };

  const trekStays = stays.filter((s) => s.trekId === trekId);
  let stay = stayId ? trekStays.find((s) => s.id === stayId) : null;
  if (!stay && trekStays.length) {
    stay = trekStays.reduce((a, b) => (a.pricePerNightInr <= b.pricePerNightInr ? a : b));
  }

  const nWights = Number(nights ?? Math.max(trek.durationDays - 1, 0));
  const nTravelers = Number(travelers || 1);
  const trekFeeTotal = trek.baseFeeInr * nTravelers;
  const stayTotal = stay ? stay.pricePerNightInr * nWights : 0;
  const totalInr = trekFeeTotal + stayTotal;

  return {
    trekId,
    trekName: trek.name,
    stayUsed: stay ? { id: stay.id, name: stay.name, pricePerNightInr: stay.pricePerNightInr } : null,
    nights: nWights,
    travelers: nTravelers,
    trekFeeTotalInr: trekFeeTotal,
    stayTotalInr: stayTotal,
    totalInr,
    perPersonInr: Math.round(totalInr / nTravelers),
  };
}

// --- Function tool schemas -----------------------------------------------

const TOOL_DEFINITIONS = [
  {
    name: "search_treks",
    description:
      "Find candidate treks that fit hard constraints: max trip length in days, the trekker's fitness level (beginner/intermediate/advanced, which caps how hard a trek can be), and optionally a region name. Returns a list of trek summaries. Call this first.",
    input_schema: {
      type: "object",
      properties: {
        maxDays: { type: "number", description: "Maximum trip length in days" },
        fitness: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
        region: { type: "string", description: "Optional free-text region filter, e.g. 'Chikmagalur'" },
      },
      required: ["fitness"],
    },
    handler: searchTreks,
  },
  {
    name: "get_stays_near",
    description: "List available nearby stays (homestay, camp, guesthouse) for one trek, with price per night.",
    input_schema: {
      type: "object",
      properties: { trekId: { type: "string" } },
      required: ["trekId"],
    },
    handler: getStaysNear,
  },
  {
    name: "check_season_fit",
    description:
      "Check whether a given calendar month (1-12) is a safe/ideal time to attempt a specific trek. Returns fit: 'ideal' | 'caution' | 'avoid' with a reason. Call this for every candidate trek before recommending it.",
    input_schema: {
      type: "object",
      properties: {
        trekId: { type: "string" },
        month: { type: "number", minimum: 1, maximum: 12 },
      },
      required: ["trekId", "month"],
    },
    handler: checkSeasonFit,
  },
  {
    name: "estimate_budget",
    description:
      "Compute the total and per-person cost in INR for a trek: trek permit/guide fee x travelers, plus a stay x nights (cheapest available stay unless a stayId is given). Use this instead of doing the arithmetic yourself.",
    input_schema: {
      type: "object",
      properties: {
        trekId: { type: "string" },
        travelers: { type: "number" },
        nights: { type: "number" },
        stayId: { type: "string" },
      },
      required: ["trekId", "travelers"],
    },
    handler: estimateBudget,
  },
  {
    name: "get_trip_logistics",
    description:
      "Build an approximate end-to-end demo budget and travel checklist for a trek. Includes nearest railhead, indicative return train-fare allowance, local transfer, nearby stays, food allowance, trek fee, and packing checklist. This is not live rail inventory or a ticket quote. Call this for every recommended trek.",
    input_schema: {
      type: "object",
      properties: {
        trekId: { type: "string" },
        travelers: { type: "number", minimum: 1 },
        days: { type: "number", minimum: 1 },
        origin: { type: "string", description: "User's starting city or station" },
      },
      required: ["trekId", "travelers", "days"],
    },
    handler: getTripLogistics,
  },
];

module.exports = { searchTreks, getStaysNear, checkSeasonFit, estimateBudget, getTripLogistics, TOOL_DEFINITIONS };
