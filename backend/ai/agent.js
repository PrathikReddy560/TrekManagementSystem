// ai/agent.js
//
// This is the "agentic" part of the app: rather than sending the whole
// trek database into one big prompt and hoping a model reasons over it
// correctly, we give the model a small set of callable tools (ai/tools.js)
// and let it decide, turn by turn, which ones to call, with what
// arguments, and when it has gathered enough to answer. That is the
// actual definition of agentic tool use: the control flow is decided by
// the model at inference time, not hard-coded by us.
//
// Why put the model in charge of *orchestration* but not *arithmetic or
// filtering*? Because those are different kinds of work:
//   - "Which treks are <= 2 days and no harder than 'moderate'?" is a
//     deterministic query. A model can get this right most of the time,
//     but "most of the time" is not good enough for a filter a booking
//     flow depends on, and a lookup table is also far cheaper and faster.
//   - "Given three season-safe, budget-fitting options with different
//     trade-offs, which should a first-time trekker with 2 days and a
//     modest budget actually pick, and how do I explain that clearly?"
//     is a judgment call over soft, competing goals in natural language —
//     exactly what a language model is for.
// So: deterministic code owns facts, the model owns judgment, and tool
// calls are the seam between them. See TOOL_DEFINITIONS in tools.js.
//
const { TOOL_DEFINITIONS, searchTreks, checkSeasonFit, estimateBudget, getTripLogistics } = require("./tools");

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";
const MAX_TOOL_ROUNDS = 6;

const SYSTEM_PROMPT = `You are the trek-planning agent inside TrekAI, a Karnataka trekking app.
A user will describe their trip in their own words (days available, fitness, rough budget in INR, a target month, and any region preference).

Use the tools to gather real facts before you recommend anything:
1. Call search_treks to get candidates that fit their hard constraints (days, fitness).
2. For every real candidate, call check_season_fit for their travel month. Do not recommend a trek whose fit is "avoid" unless no other option exists — and if you must, say so plainly.
3. Call get_stays_near, estimate_budget, and get_trip_logistics for every finalist so lodging, food, trek fees, rail allowance, local transfer, and packing notes come from tool results.
4. Only after you have this evidence, write your final answer.

Your final message must be ONLY a single JSON object (no prose outside it, no markdown fences), matching this shape:
{
  "picks": [
    {
      "trekId": string,
      "trekName": string,
      "whyThisPick": string (2-3 sentences, reference the concrete season/budget facts you gathered),
      "seasonFit": "ideal" | "caution" | "avoid",
      "estimatedTotalInr": number (use the low end of the full-trip logistics estimate),
      "estimatedTotalRangeInr": { "low": number, "high": number },
      "logistics": object returned by get_trip_logistics,
      "packingChecklist": [string],
      "itinerary": [ { "day": number, "plan": string } ],
      "packingTips": [string, string, string]
    }
  ],
  "notConsidered": string (1-2 sentences on any strong-looking option you ruled out and why, or empty string),
  "summary": string (2-3 sentences, addressed to the user, in plain conversational language)
}
Rank "picks" best-first. Return 1 to 3 picks. Ground every claim in a tool result you actually received — never invent a fee, elevation, or season window.`;

function buildUserPrompt({ message, daysAvailable, fitness, budgetInr, month, travelers, region, origin, travelDate }) {
  return `Trip request from a user of the app:
"${message}"

Structured constraints the app already parsed from their inputs (trust these over anything ambiguous in the free text):
- Days available: ${daysAvailable}
- Fitness level: ${fitness}
- Budget: up to ₹${budgetInr} total for the group
- Travel month (1-12): ${month}
- Number of travelers: ${travelers}
- Region preference: ${region || "none stated"}
- Starting city or station: ${origin || "Bengaluru"}
- Planned departure date: ${travelDate || "not selected"}

Plan their trek now using the tools available to you.`;
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[{[]/);
  if (start === -1) throw new Error("No JSON object found in model output.");
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  return JSON.parse(body.slice(start, end + 1));
}

function toOpenRouterTools() {
  return TOOL_DEFINITIONS.map(({ name, description, input_schema }) => ({
    type: "function",
    function: { name, description, parameters: input_schema },
  }));
}

async function requestCompletion(messages, tools) {
  const requestBody = {
    model: MODEL,
    messages,
    max_tokens: 4000,
  };
  if (tools?.length) {
    requestBody.tools = tools;
    requestBody.tool_choice = "required";
  } else {
    // Used for the final synthesis pass: once the bounded tool budget is
    // exhausted, require an answer instead of letting the model loop again.
    requestBody.tool_choice = "none";
    requestBody.response_format = { type: "json_object" };
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:5173",
      "X-OpenRouter-Title": "TrekAI",
    },
    body: JSON.stringify(requestBody),
  });

  const payload = await response.json();
  if (!response.ok) {
    const detail = payload?.error?.message || response.statusText;
    throw new Error(`OpenRouter request failed (${response.status}): ${detail}`);
  }

  const choice = payload?.choices?.[0];
  if (!choice?.message) throw new Error("OpenRouter returned no assistant message.");
  return choice;
}

async function runAgent(input) {
  if (!process.env.OPENROUTER_API_KEY) {
    return runDeterministicFallback(input);
  }

  const trace = [];
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(input) },
  ];
  const tools = toOpenRouterTools();
  const handlersByName = Object.fromEntries(TOOL_DEFINITIONS.map((t) => [t.name, t.handler]));

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const choice = await requestCompletion(messages, tools);
    const assistantMessage = choice.message;
    messages.push(assistantMessage);

    const toolCalls = assistantMessage.tool_calls || [];
    if (toolCalls.length === 0) {
      try {
        const plan = extractJson(assistantMessage.content || "");
        return { plan, trace, mode: "agentic", model: choice.model || MODEL };
      } catch (error) {
        const fallback = runDeterministicFallback(input);
        fallback.plan.summary = `The model returned an invalid final response, so a rule-based plan was generated instead. ${fallback.plan.summary}`;
        return {
          ...fallback,
          trace: [...trace, ...fallback.trace],
          fallbackReason: error.message,
        };
      }
    }
    for (const call of toolCalls) {
      const toolName = call.function?.name;
      const handler = handlersByName[toolName];
      let input = {};
      let output;
      try {
        input = typeof call.function?.arguments === "string"
          ? JSON.parse(call.function.arguments || "{}")
          : (call.function?.arguments || {});
        output = handler ? handler(input) : { error: `Unknown tool ${toolName}` };
      } catch (err) {
        output = { error: String(err.message || err) };
      }
      trace.push({ tool: toolName, input, output });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(output),
      });
    }
  }

  // Some free-model routes keep requesting another tool round instead of
  // returning a final answer. Give the model one tools-disabled synthesis
  // pass over the evidence already collected.
  try {
    messages.push({
      role: "user",
      content: `You have reached the ${MAX_TOOL_ROUNDS}-round tool-call budget. Do not request more tools. Using only the tool results above, return the required final JSON object now. If a detail was not checked, leave it out rather than inventing it.`,
    });
    const finalChoice = await requestCompletion(messages, null);
    const finalMessage = finalChoice.message;
    if (finalMessage.tool_calls?.length) {
      throw new Error("The model requested tools during the final synthesis pass.");
    }
    const plan = extractJson(finalMessage.content || "");
    return { plan, trace, mode: "agentic", model: finalChoice.model || MODEL };
  } catch (error) {
    // Keep the planner useful even if the selected model cannot synthesize a
    // final response after exhausting its tool-call budget.
    const fallback = runDeterministicFallback(input);
    fallback.plan.summary = `The AI model reached its tool-call limit, so a rule-based plan was generated instead. ${fallback.plan.summary}`;
    return {
      ...fallback,
      trace: [...trace, ...fallback.trace],
      fallbackReason: error.message,
    };
  }

}

// Used only when no OPENROUTER_API_KEY is configured, so the rest of the
// app (search, booking, UI) can still be demoed end-to-end without a key.
// It runs the SAME deterministic tools directly and ranks candidates with
// a simple fixed heuristic instead of a model call.
function runDeterministicFallback({ daysAvailable, fitness, budgetInr, month, travelers, region, origin }) {
  const trace = [];

  const candidates = searchTreks({ maxDays: daysAvailable, fitness, region });
  trace.push({ tool: "search_treks", input: { maxDays: daysAvailable, fitness, region }, output: candidates });

  const scored = candidates.map((t) => {
    const season = checkSeasonFit({ trekId: t.id, month });
    trace.push({ tool: "check_season_fit", input: { trekId: t.id, month }, output: season });
    const budget = estimateBudget({ trekId: t.id, travelers, nights: Math.max(t.durationDays - 1, 0) });
    trace.push({ tool: "estimate_budget", input: { trekId: t.id, travelers }, output: budget });
    const logistics = getTripLogistics({ trekId: t.id, travelers, days: Math.min(daysAvailable, t.durationDays), origin });
    trace.push({ tool: "get_trip_logistics", input: { trekId: t.id, travelers, days: Math.min(daysAvailable, t.durationDays), origin }, output: logistics });

    let score = 0;
    if (season.fit === "ideal") score += 3;
    else if (season.fit === "caution") score += 1;
    else score -= 3;
    if (logistics.costEstimateGroupInr.low <= budgetInr) score += 2;
    else score -= Math.min(3, Math.ceil((logistics.costEstimateGroupInr.low - budgetInr) / budgetInr));

    return { trek: t, season, budget, logistics, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3).filter((s) => s.season.fit !== "avoid" || scored.every((x) => x.season.fit === "avoid"));

  const picks = top.map(({ trek, season, budget, logistics }) => ({
    trekId: trek.id,
    trekName: trek.name,
    whyThisPick: `${season.reason} The full-trip demo estimate starts at ₹${logistics.costEstimateGroupInr.low} for your group, against your ₹${budgetInr} budget.`,
    seasonFit: season.fit,
    estimatedTotalInr: logistics.costEstimateGroupInr.low,
    estimatedTotalRangeInr: logistics.costEstimateGroupInr,
    logistics,
    packingChecklist: logistics.packingChecklist,
    itinerary: Array.from({ length: trek.durationDays }, (_, i) => ({
      day: i + 1,
      plan:
        i === 0
          ? `Travel to ${trek.region} and start the ${trek.name} trail.`
          : `Continue to the ${trek.name} summit / return leg.`,
    })),
    packingTips: ["Sturdy trekking shoes", "2L water minimum", "Rain cover even outside monsoon"],
  }));

  return {
    plan: {
      picks,
      notConsidered: "",
      summary: `Based on your ${daysAvailable}-day window, ${fitness} fitness and ₹${budgetInr} budget, here are your best-fitting, season-checked options. (Generated by the rule-based fallback planner.)`,
    },
    trace,
    mode: "fallback",
  };
}

module.exports = { runAgent };
