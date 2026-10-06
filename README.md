# TrekAI — trek search, booking, and an agentic AI trip planner

*TrekAI blends trek planning with a clean, fast booking workflow for Karnataka's trails.*

A full-stack trekking app for Karnataka's Western Ghats: explore trek and stay
catalogue data on a map, and plan a trip with an AI agent that checks season,
cost and fitness fit against the app's bundled data before recommending options.

The extended trip-planning demo accepts a starting city and date, estimates
rail, stay, food and trek costs, provides an interactive packing checklist,
downloads a calendar event, and can schedule email reminders through n8n.
Travel and food prices are demo allowances rather than live quotes.

A live, no-install demo of the map + AI planner is published separately (see
the link in the chat message this project came with). This repo is the real,
runnable full stack behind it: an Express API with auth, search, and
bookings, and a React + Leaflet frontend.

---

## 1. What's actually "AI" here, and why

This is the part worth reading before you skim the code.

**The naive approach** would be: dump the whole trek database into a prompt,
ask an LLM "plan me a trek," and print whatever comes back. That's fast to
build and bad in practice — the model can misremember a fee, get an elevation
wrong, or recommend a monsoon-season trek because it "sounds nice," and you'd
have no way to check its work.

**What this app does instead** is give the model **tools**, not data:

```
User: "Two of us, decent fitness, weekend trip, budget ~₹5000, October"
              │
              ▼
   ┌──────────────────────────────────────────────────────────┐
   │   OpenRouter model, given 5 tools:                        │
   │                                                          │
   │   1. search_treks(maxDays, fitness, region)  ──▶ filter  │
   │   2. check_season_fit(trekId, month)         ──▶ lookup  │
   │   3. get_stays_near(trekId)                  ──▶ lookup  │
   │   4. estimate_budget(trekId, travelers, ...) ──▶ math    │
   │   5. get_trip_logistics(origin, trekId, ...) ──▶ estimate│
   │                                                          │
   │   The model chooses which tools to call and in what      │
   │   order. That control flow is the agent's decision.      │
   └──────────────────────────────────────────────────────────┘
              │
              ▼
   Final answer: ranked picks + reasoning + a day-by-day
   itinerary, grounded only in what the tools actually returned
```

This is what "agentic AI" concretely means in this project: **the model is in
the loop deciding what to look up next**, not just generating text once. It's
implemented with OpenRouter's OpenAI-compatible chat completions and tool
calling API — see `backend/ai/agent.js`, which is the one file worth reading first.

### Why split it this way (code owns facts, the model owns judgment)

Every tool in `backend/ai/tools.js` is a plain, deterministic function —
array filters, a lookup table, arithmetic. None of it touches the model.
That's deliberate:

- **Filtering treks by days/difficulty/region** is a database query. A
  language model can usually do this correctly from a text dump, but
  "usually" isn't good enough for a filter a booking flow depends on, and a
  filter function is also orders of magnitude cheaper and faster than a
  model call.
- **Season safety** (is October safe for Kumara Parvatha?) is a fact lookup
  against real best/avoid-month data, not a judgment call. We want this
  answer to be the same every time, and auditable — you can read
  `checkSeasonFit()` and know exactly why it said what it said. That matters
  more for trek safety than for, say, a movie recommendation.
- **Cost totals** are arithmetic. LLMs are not reliable calculators; a
  booking app has to get money right.
- **What the model is actually good for** — and the only thing it's asked to
  do — is the soft part: given three season-safe, budget-fitting options
  with real but different trade-offs (cheaper vs. more scenic vs. shorter),
  which one actually fits *this* person's stated goals, and how do you
  explain that trade-off in plain, useful language? That's a judgment call
  over fuzzy, competing goals — exactly the kind of thing rule-based code is
  bad at and a language model is good at.

Tool calls are the seam between those two kinds of work. This also makes the
system **auditable**: the API response includes a `trace` array of every
tool call the model made with its inputs and outputs, which the frontend
renders directly (see `AgentTrace.jsx`) so a user — or you, marking this —
can see exactly what the model checked before it recommended anything,
rather than trusting a black box.

### Model choice and cost

The planner uses `OPENROUTER_MODEL` from the backend environment. The default
`openrouter/free` route selects from OpenRouter's available free models and
filters for request capabilities such as tool calling. Free routes have
provider limits and availability can vary; choose a specific OpenRouter model
slug if you need stable routing. The deterministic planner still works when
no key is configured.

### It still works without an API key

If `OPENROUTER_API_KEY` isn't set, `runAgent()` falls back to
`runDeterministicFallback()`, which calls the **exact same tool functions**
directly and ranks results with a fixed scoring heuristic instead of a model
call (see the bottom half of `agent.js`). The rest of the app — search,
login, booking — never depends on the AI key at all. This means the project
demos end-to-end for anyone who clones it, and the AI upgrade is opt-in.

## 2. Full-trip demo with n8n

The workflow is intentionally small and visible: the website sends a trip
brief to Express; Express forwards it to an n8n Webhook; an HTTP Request node
calls the OpenRouter-backed trip agent; n8n returns the agent's structured
plan to the website. The agent can call the trek, season, budget, stay and
logistics tools against the bundled catalogue and estimates. It does not
search the live web for current hotels, train schedules or ticket prices.

n8n is optional. Without an n8n webhook configured, the website calls the same
backend agent directly. Without an OpenRouter key, the deterministic planner
still returns the demo data. The reminder workflow uses n8n Wait and Send Email
nodes; configure an SMTP credential in n8n before using it to send messages.
Calendar export downloads an `.ics` file for the user's calendar app.

Run `docker compose -f n8n/docker-compose.yml up -d`, import the workflow files
from `n8n/workflows`, activate them, and copy their Production webhook URLs to
`N8N_PLAN_WEBHOOK_URL` and `N8N_REMINDER_WEBHOOK_URL` in `backend/.env`. Restart
the backend after changing those values. The full import and credential steps
are in [n8n/README.md](n8n/README.md).

**Demo boundary:** nearby stays and trek fees come from the bundled JSON
catalogue. Food, train and local transfer amounts are labelled planning
allowances. The app links to IRCTC for live rail searches; it does not query
train schedules, hotel inventory or send bookings to providers.

---

## 3. Project structure

```
trekai/
├── backend/
│   ├── server.js              Express app entrypoint
│   ├── routes/                auth, treks, bookings, ai
│   ├── middleware/auth.js     JWT verification
│   ├── ai/
│   │   ├── tools.js           the 5 deterministic tools + their JSON schemas
│   │   └── agent.js           the tool-calling loop + fallback planner (read this first)
│   └── data/
│       ├── treks.json         12 real Karnataka treks (seed data)
│       ├── stays.json         nearby stays per trek
│       └── store.js           tiny file-backed JSON "database" (users, bookings)
└── frontend/
    ├── src/
    │   ├── pages/ExplorePage.jsx      map + filters + search
    │   ├── pages/AIPlannerPage.jsx    the agent planner UI + trace viewer
    │   ├── pages/MyTripsPage.jsx
    │   ├── components/MapView.jsx     react-leaflet map, difficulty-colored markers
    │   ├── components/AgentTrace.jsx  renders the tool-call trace from the API
    │   └── styles/global.css          design tokens (see section 3)
    └── ...
```

We used a flat JSON file as the database (`data/store.js`) instead of
Postgres/Mongo so the whole project runs with nothing but `node` and
`npm install` — no DB server to stand up for a demo or a review. Swapping it
for a real database means changing `readTable`/`writeTable` in one file;
every route already goes through that module.

## 4. Design notes

The UI is dark-themed with a gradient amber/orange accent, numbered section
labels ("01 / EXPLORE", "02 / PLAN"), and stat call-outs — a pattern borrowed
from modern hackathon/dev-event landing pages. Difficulty is still
color-coded the way trail signage usually is (green → easy, ochre →
moderate, red → hard). Headings use **Space Grotesk** (a bold geometric
sans with the confident, technical feel of that reference style); body and
data use **IBM Plex Sans**/**IBM Plex Mono** — the mono face is used for the
numbered section labels and for the
agent trace log, where it's functionally honest (it's literally showing
tool-call output), not decorative.

## 5. Running it locally

### Backend

```bash
cd backend
npm install
cp .env.example .env
# optional: add an OpenRouter key from https://openrouter.ai/keys
# OPENROUTER_API_KEY=...
# OPENROUTER_MODEL=openrouter/free
# add catalogue managers as a comma-separated allowlist
# ADMIN_EMAILS=admin@example.com
npm start
# → http://localhost:4000
```

Sign in to the frontend with an email listed in `ADMIN_EMAILS` to open the
Catalogue dashboard at `/admin`. It can add new trek records and delete
existing ones from the file-backed catalogue. The dashboard also summarizes
confirmed bookings by month and trek, compares seasonal catalogue coverage,
and includes an AI portfolio advisor grounded in those aggregate figures.
Revenue is the demo's gross booking value, not profit; operating costs,
refunds, demand analytics, and payment settlement are not currently tracked.
AI recommendations do not make automatic catalogue changes.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # defaults to http://localhost:4000, change if needed
npm run dev
# → http://localhost:5173
```

Open the frontend, use **Explore** to search/filter treks on the map, **AI
Planner** to try the agent, and **My Trips** after signing up + booking
something.

### API quick reference

| Method | Path                  | Auth | Notes                              |
|--------|-----------------------|------|-------------------------------------|
| POST   | `/api/auth/signup`    | —    | `{ name, email, password }`         |
| POST   | `/api/auth/login`     | —    | `{ email, password }`               |
| GET    | `/api/treks`          | —    | query: `difficulty, maxDays, month, region, near, radiusKm` |
| GET    | `/api/treks/:id`      | —    |                                      |
| GET    | `/api/treks/:id/stays`| —    |                                      |
| POST   | `/api/bookings`       | ✓    | `{ trekId, stayId?, travelers, startDate }` |
| GET    | `/api/bookings/my`    | ✓    |                                      |
| POST   | `/api/ai/plan`        | —    | `{ message, daysAvailable, fitness, budgetInr, month, travelers, region? }` |
| POST   | `/api/trip-demo/plan` | —    | Full trip brief; uses n8n when configured |
| POST   | `/api/trip-demo/reminders` | — | Email and trip date; n8n workflow or preview |

## 5. Ideas for extending this

- Swap the JSON file store for Postgres and add a real migrations setup.
- Stream the agent's tool calls to the frontend live (Server-Sent Events)
  instead of returning the full trace only once the plan is done.
- Add a `book_trek` tool so the agent can complete the booking itself inside
  the same conversation, behind an explicit user confirmation step.
- Expand the seed dataset beyond Karnataka.
