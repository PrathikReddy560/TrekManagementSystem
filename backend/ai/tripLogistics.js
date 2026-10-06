const { readJsonAsset } = require("../data/store");

const RAILHEADS = {
  "kumara-parvatha": "Subrahmanya Road",
  kudremukh: "Mangaluru Central",
  kodachadri: "Byndoor Mookambika Road",
  mullayanagiri: "Kadur Junction",
  bababudangiri: "Kadur Junction",
  skandagiri: "Chikkaballapur",
  "nandi-hills": "Chikkaballapur",
  savandurga: "Ramanagara",
  anthargange: "Kolar",
  tadiandamol: "Mysuru Junction",
  "kunti-betta": "Pandavapura",
  yana: "Kumta",
};

const FOOD_PER_PERSON_PER_DAY_INR = 450;
const LOCAL_TRANSFER_GROUP_INR = 900;
const TRAIN_RETURN_RANGE_PER_PERSON_INR = [500, 1400];
const PACKING_CHECKLIST = [
  "Sturdy shoes with grip",
  "Two litres of water per person",
  "Electrolyte sachets and high-energy snacks",
  "Light rain shell and dry change of clothes",
  "Small first-aid kit and personal medication",
  "Sun protection and a headlamp",
  "Photo ID and a charged phone",
];

function getTripLogistics({ trekId, travelers = 1, days = 1, origin = "Bengaluru" } = {}) {
  const treks = readJsonAsset("treks.json");
  const stays = readJsonAsset("stays.json");
  const trek = treks.find((item) => item.id === trekId);
  if (!trek) return { error: `Unknown trekId "${trekId}"` };

  const people = Math.max(1, Number(travelers) || 1);
  const tripDays = Math.max(1, Number(days) || trek.durationDays);
  const nights = Math.max(0, tripDays - 1);
  const trekStays = stays
    .filter((stay) => stay.trekId === trekId)
    .sort((a, b) => a.pricePerNightInr - b.pricePerNightInr);
  const cheapestStay = trekStays[0] || null;

  const trainLow = TRAIN_RETURN_RANGE_PER_PERSON_INR[0] * people;
  const trainHigh = TRAIN_RETURN_RANGE_PER_PERSON_INR[1] * people;
  const food = FOOD_PER_PERSON_PER_DAY_INR * people * tripDays;
  const stay = cheapestStay ? cheapestStay.pricePerNightInr * nights : 0;
  const ticket = trek.baseFeeInr * people;
  const totalLow = trainLow + food + stay + ticket + LOCAL_TRANSFER_GROUP_INR;
  const totalHigh = trainHigh + food + stay + ticket + LOCAL_TRANSFER_GROUP_INR;

  return {
    origin: String(origin || "Bengaluru"),
    railhead: RAILHEADS[trekId] || "Nearest regional station",
    trainFareReturnPerPersonInr: { low: 500, high: 1400 },
    trainFareGroupInr: { low: trainLow, high: trainHigh },
    trainSearchUrl: "https://www.irctc.co.in/nget/train-search",
    transportNote: "Demo fare allowance only; it is not a live train, timetable, seat-availability, or ticket quote. Check the exact route and fare on IRCTC before travelling.",
    localTransferGroupInr: LOCAL_TRANSFER_GROUP_INR,
    stay: cheapestStay
      ? { name: cheapestStay.name, type: cheapestStay.type, pricePerNightInr: cheapestStay.pricePerNightInr, nights, groupTotalInr: stay }
      : null,
    otherStayOptions: trekStays.slice(1).map(({ name, type, pricePerNightInr }) => ({ name, type, pricePerNightInr })),
    food: { perPersonPerDayInr: FOOD_PER_PERSON_PER_DAY_INR, days: tripDays, groupTotalInr: food, note: "Planning allowance; meals are not included in stay prices." },
    trekTicketAndGuideGroupInr: ticket,
    costEstimateGroupInr: { low: totalLow, high: totalHigh },
    costEstimateNote: "Approximate demo budget for the group. Excludes travel to your origin city and incidental purchases; hotel estimate assumes one shared room.",
    packingChecklist: PACKING_CHECKLIST,
  };
}

module.exports = { getTripLogistics, PACKING_CHECKLIST };
